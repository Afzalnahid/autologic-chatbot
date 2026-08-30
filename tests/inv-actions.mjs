// What the inventory assistant is allowed to propose, and how a proposal is
// read out loud.
//
// This is the one place three parties have to agree: the prompt that tells the
// model what it may ask for, the route that applies what the owner confirmed,
// and the panel that shows the owner what they are confirming. If they drift,
// the owner is shown one thing and a different thing happens — which is the
// only failure mode that actually matters in a feature like this.
//
// Pure: no supabase, no AI, so the browser and the server both import it.

// Everything the assistant may change. A field that is not here cannot be set,
// whatever the model asks for — photos and variants' own prices included, both
// of which need the drawer.
export const FIELDS = {
  product_name: "Name",
  product_code: "Code",
  category: "Category",
  brand: "Brand",
  description: "Description",
  tags: "Tags",
  regular_price: "Price",
  sale_price: "Sale price",
  stock_qty: "Stock",
  stock_status: "Availability",
  options: "Sizes / colours",
};

export const VERBS = ["update", "create", "delete"];

const str = (v) => (v === undefined || v === null ? "" : String(v)).trim();
const money = (v) => str(v).replace(/[^\d.]/g, "");

// A bag of field changes, cleaned. Everything outside the whitelist is dropped,
// and a value that cannot be made sense of is dropped rather than guessed at —
// a price of "ask us" must not become 0, because 0 is a price the bot quotes.
export function normalizeSet(raw) {
  const set = {};
  for (const [k, v] of Object.entries(raw || {})) {
    if (!(k in FIELDS) || v === undefined || v === null) continue;
    if (k === "regular_price" || k === "sale_price") { const m = money(v); if (m) set[k] = m; continue; }
    if (k === "stock_qty") { const n = Math.floor(Number(str(v).replace(/[^\d]/g, ""))); if (Number.isFinite(n)) set[k] = n; continue; }
    if (k === "stock_status") { set[k] = str(v) === "outofstock" ? "outofstock" : "instock"; continue; }
    if (k === "tags") { set[k] = (Array.isArray(v) ? v : str(v).split(",")).map(str).filter(Boolean).slice(0, 30); continue; }
    if (k === "options") {
      const opts = (Array.isArray(v) ? v : []).map((o) => ({
        name: str(o?.name).slice(0, 40),
        values: (Array.isArray(o?.values) ? o.values : str(o?.values).split(",")).map(str).filter(Boolean).slice(0, 40),
      })).filter((o) => o.name && o.values.length).slice(0, 5);
      if (opts.length) set[k] = opts;
      continue;
    }
    const s = str(v);
    if (s) set[k] = s.slice(0, k === "description" ? 4000 : 160);
  }
  return set;
}

// One proposal, normalised — or null when it is not something we can carry out.
export function normalizeAction(raw) {
  const verb = str(raw?.do).toLowerCase();
  if (!VERBS.includes(verb)) return null;
  const id = str(raw?.id);
  if ((verb === "update" || verb === "delete") && !id) return null;
  if (verb === "delete") return { do: "delete", id };

  const set = normalizeSet(raw?.set);
  if (!Object.keys(set).length) return null;
  if (verb === "create" && !set.product_name) return null;
  return { do: verb, ...(id ? { id } : {}), set };
}

export const normalizeActions = (list) =>
  (Array.isArray(list) ? list : []).map(normalizeAction).filter(Boolean).slice(0, 40);

// Also used on the product as it currently stands, where a field may be missing
// entirely or hold the wrong shape after an old import — so every branch checks
// rather than assuming.
// ── Building one product by conversation ─────────────────────────────────────
// Three things a product cannot be sold without. Without a name nobody can ask
// for it, without a price the bot cannot answer the first question every
// customer asks, and without a photo it cannot be matched to the picture a
// customer sends — which is how this market actually shops.
export const MUST_HAVE = ["product_name", "regular_price", "photo"];
// Asked every time and shown as missing on the card, but never blocking. A shop
// that does not count stock must still be able to finish.
export const SHOULD_HAVE = ["category", "stock_qty"];
// The order the assistant works through what is still blank, and it is the
// owner's order, not the machine's: what the thing IS and what it costs, then
// its pictures, then the sizes and colours a customer chooses between. Photos
// used to come first because the AI can read a name off one — which is the
// convenient order for the AI and the wrong one for a person, who is holding
// their phone and has not decided what to call it yet.
export const ASK_ORDER = ["product_name", "regular_price", "category", "stock_qty", "photo", "options", "description", "brand", "sale_price", "product_code", "tags"];

export const LABELS = { ...FIELDS, photo: "Photos" };

const filled = (draft, k, photos) => {
  if (k === "photo") return (photos || 0) > 0;
  const v = draft?.[k];
  if (k === "stock_qty") return v !== undefined && v !== null && v !== "";
  if (k === "options" || k === "tags") return Array.isArray(v) && v.length > 0;
  return !!String(v ?? "").trim();
};

// What is still blank, split by how much it matters. `ready` is the only thing
// that decides whether the product can be saved — the assistant's own opinion
// that it is finished does not.
export function draftGaps(draft = {}, photos = 0) {
  const gap = (list) => list.filter((k) => !filled(draft, k, photos));
  const blocking = gap(MUST_HAVE);
  return {
    blocking,
    wanted: gap(SHOULD_HAVE),
    rest: gap(ASK_ORDER.filter((k) => !MUST_HAVE.includes(k) && !SHOULD_HAVE.includes(k))),
    ready: blocking.length === 0,
  };
}

const show = (k, v) => {
  if (v === undefined || v === null || v === "") return "";
  if (k === "options") return Array.isArray(v) ? v.map((o) => `${o?.name}: ${(o?.values || []).join(", ")}`).join("; ") : "";
  if (k === "tags") return Array.isArray(v) ? v.join(", ") : String(v);
  if (k === "stock_status") return v === "outofstock" ? "out of stock" : "in stock";
  return String(v);
};

// What the owner reads before pressing the button. `before` is the product as it
// stands, so a price change reads "450 → 500" rather than just "500" — the
// difference between confirming a change and confirming a number.
export function describeAction(a, before) {
  if (a.do === "delete") return { title: `Delete ${before?.product_name || "this product"}`, danger: true, lines: ["The product and its photos are removed from the catalogue. The bot stops offering it."] };
  if (a.do === "create") return {
    title: `Add ${a.set.product_name}`,
    lines: Object.entries(a.set).filter(([k]) => k !== "product_name").map(([k, v]) => `${FIELDS[k]}: ${show(k, v)}`)
      .concat("No photo yet — open the product to add one, or the bot cannot match it to a customer's picture."),
  };
  return {
    title: `Change ${before?.product_name || "product"}`,
    lines: Object.entries(a.set).map(([k, v]) => {
      const was = before ? show(k, before[k] ?? "") : "";
      const now = show(k, v);
      return was && was !== now ? `${FIELDS[k]}: ${was} → ${now}` : `${FIELDS[k]}: ${now}`;
    }),
  };
}
