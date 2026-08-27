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

// One proposal, normalised — or null when it is not something we can carry out.
// Anything unrecognised is dropped rather than guessed at.
export function normalizeAction(raw) {
  const verb = str(raw?.do).toLowerCase();
  if (!VERBS.includes(verb)) return null;
  const id = str(raw?.id);
  if ((verb === "update" || verb === "delete") && !id) return null;
  if (verb === "delete") return { do: "delete", id };

  const set = {};
  for (const [k, v] of Object.entries(raw?.set || {})) {
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
  if (!Object.keys(set).length) return null;
  if (verb === "create" && !set.product_name) return null;
  return { do: verb, ...(id ? { id } : {}), set };
}

export const normalizeActions = (list) =>
  (Array.isArray(list) ? list : []).map(normalizeAction).filter(Boolean).slice(0, 40);

// Also used on the product as it currently stands, where a field may be missing
// entirely or hold the wrong shape after an old import — so every branch checks
// rather than assuming.
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
