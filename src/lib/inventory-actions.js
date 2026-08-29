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
// owner's order, not the machine's — the order they would say it out loud in:
// what it IS and where it lives, what it costs, what it is like, what a
// customer picks between, and the photos LAST.
//
// Photos are last on purpose, and they are not last because they matter least
// — nothing can be saved without one. They are last because that is the only
// step that leaves the conversation: the owner has to stop typing, open their
// phone's picker and find the pictures. Everything that can be answered in a
// sentence is answered first, so that trip happens once, at the end, with the
// product otherwise finished.
//
// Photos used to come earlier still, before even the name, because the AI can
// read a name off one — the convenient order for the AI and the wrong one for
// a person, who is holding their phone and has not decided what to call it yet.
export const ASK_ORDER = ["product_name", "category", "regular_price", "description", "options", "photo", "stock_qty", "brand", "sale_price", "product_code", "tags"];

export const LABELS = { ...FIELDS, photo: "Photos" };

// An ACTUAL answer for every question, not a description of one.
//
// "What size does it come in?" is a fine question and a person still hesitates
// over it — do they type "medium", "M", "M/L", "all sizes"? Every question the
// assistant asks carries one of these on the end of it, so nobody has to guess
// the shape of the answer, and the answers come back in a shape that parses.
//
// Both languages, because the dashboard has both and an English example under a
// Bangla question is the same guessing game again. Names and numbers are left
// as they are in the Bangla ones: a shop writes "500", not "৫০০", into a price.
export const EXAMPLES = {
  product_name: { en: "Box T-shirt — green seed print", bn: "বক্স টি-শার্ট — সবুজ সিড প্রিন্ট" },
  category: { en: "T-shirts", bn: "টি-শার্ট" },
  regular_price: { en: "500", bn: "500" },
  description: { en: "Heavy cotton, oversized fit, does not shrink in the wash", bn: "মোটা সুতি কাপড়, ওভারসাইজ ফিট, ধুলে ছোট হয় না" },
  options: { en: "Size: S, M, L; Colour: Black, White", bn: "সাইজ: S, M, L; রং: কালো, সাদা" },
  photo: { en: "the front, the back, and a close-up — all at once", bn: "সামনে, পেছনে আর একটা ক্লোজ-আপ — একসাথেই" },
  stock_qty: { en: "12", bn: "12" },
  brand: { en: "Aarong", bn: "আড়ং" },
  sale_price: { en: "450", bn: "450" },
  product_code: { en: "BOXT-GRN-01", bn: "BOXT-GRN-01" },
  tags: { en: "summer, cotton, gift", bn: "গরমের, সুতি, গিফট" },
};

export const exampleFor = (key, lang = "en") => EXAMPLES[key]?.[lang === "bn" ? "bn" : "en"] || EXAMPLES[key]?.en || "";

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
//
// `queue` is what to ASK next, and it is deliberately a different thing from
// `blocking`. Importance and order are not the same question: a photo blocks
// the save and is still the last thing worth asking for. Sorting the questions
// by importance is what made the assistant demand a picture before it had
// asked what the thing was like — correct by its own lights, and nonsense to
// the person answering.
export function draftGaps(draft = {}, photos = 0) {
  const gap = (list) => list.filter((k) => !filled(draft, k, photos));
  const blocking = gap(MUST_HAVE);
  return {
    blocking,
    wanted: gap(SHOULD_HAVE),
    rest: gap(ASK_ORDER.filter((k) => !MUST_HAVE.includes(k) && !SHOULD_HAVE.includes(k))),
    queue: gap(ASK_ORDER),
    ready: blocking.length === 0,
  };
}

const show = (k, v, t) => {
  if (v === undefined || v === null || v === "") return "";
  if (k === "options") return Array.isArray(v) ? v.map((o) => `${o?.name}: ${(o?.values || []).join(", ")}`).join("; ") : "";
  if (k === "tags") return Array.isArray(v) ? v.join(", ") : String(v);
  if (k === "stock_status") return t(v === "outofstock" ? "card.outOfStock" : "card.inStock");
  return String(v);
};

// What the owner reads before pressing the button. `before` is the product as it
// stands, so a price change reads "450 → 500" rather than just "500" — the
// difference between confirming a change and confirming a number.
//
// `t` is the dashboard's translator, and it is required rather than optional:
// this is the only place in the whole panel that was still writing English
// under a Bangla screen, and a default that quietly falls back to English is
// how it would come back. Only the browser calls this — the routes import the
// whitelist, never the describer — so there is always a translator to hand.
//
// The field names come from keys that already exist for the drawer, so a label
// is translated once and read in both places.
export function describeAction(a, before, t) {
  const name = before?.product_name;
  if (a.do === "delete") return { title: t("card.deleteProduct", { name: name || t("card.thisProduct") }), danger: true, lines: [t("card.deleteProductWhy")] };
  if (a.do === "create") return {
    title: t("card.addProduct", { name: a.set.product_name }),
    lines: Object.entries(a.set).filter(([k]) => k !== "product_name").map(([k, v]) => `${t(`fld.${k}`)}: ${show(k, v, t)}`)
      .concat(t("card.noPhotoYet")),
  };
  return {
    title: t("card.changeProduct", { name: name || t("card.aProduct") }),
    lines: Object.entries(a.set).map(([k, v]) => {
      const was = before ? show(k, before[k] ?? "", t) : "";
      const now = show(k, v, t);
      return was && was !== now ? `${t(`fld.${k}`)}: ${was} → ${now}` : `${t(`fld.${k}`)}: ${now}`;
    }),
  };
}
