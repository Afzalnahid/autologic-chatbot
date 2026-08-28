// Options → variants. Options are the axes a customer chooses along ("Size":
// S/M/L); variants are the sellable combinations those axes produce.
//
// This lived inside the product drawer, which was fine while the drawer was the
// only place a variant could be born. The photo batch now creates them too, and
// two copies of a cartesian product that must agree on the shape of a variant
// row is exactly the kind of thing that drifts apart quietly. It is pure — no
// supabase, no AI — so a client component can import it.

// ── What a customer chooses between ──────────────────────────────────────────
// "Size" and "Colour" were written into the photo batch as two fixed boxes,
// which is a clothing shop's answer written into everybody's tool. An
// electronics shop needs Capacity and Model, a food shop Weight and Flavour, an
// agency Package and Duration. So the axis NAMES come from three places, in
// this order: what this shop already uses, what the AI proposes from the photos,
// and whatever the owner types over the top.

const listOf = (s) => String(s || "").split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

// The option names this shop's own catalogue already uses, most used first.
// Free, instant, and right far more often than any guess: a shop that has ever
// added one product has already told us what it sells choices along.
export function knownAxes(products, limit = 4) {
  const tally = new Map();
  for (const p of products || []) {
    for (const o of p?.options || []) {
      const n = String(o?.name || "").trim();
      if (!n) continue;
      // Case-insensitive so "size" and "Size" are one axis, but the spelling
      // the shop used most is the one shown back to them.
      const key = n.toLowerCase();
      const seen = tally.get(key) || { name: n, n: 0 };
      tally.set(key, { name: seen.n ? seen.name : n, n: seen.n + 1 });
    }
  }
  return [...tally.values()].sort((a, b) => b.n - a.n).map((x) => x.name).slice(0, limit);
}

// What the owner typed when asked what these come in. Accepts the short answer
// — "S, M, L" — and the fuller one — "Size: S, M, L; Colour: Black, White" —
// because both are things a person types when asked that question.
export function parseAxes(text, fallbackName = "Size") {
  const s = String(text || "").trim();
  if (!s) return [];
  if (s.includes(":")) {
    return s.split(/[;\n]+/)
      .map((part) => {
        const at = part.indexOf(":");
        return { name: part.slice(0, at).trim().slice(0, 40), values: listOf(part.slice(at + 1)) };
      })
      .filter((a) => a.name && a.values.length)
      .slice(0, 5);
  }
  const values = listOf(s);
  return values.length ? [{ name: String(fallbackName || "Size").trim().slice(0, 40), values }] : [];
}

export const cartesian = (opts) =>
  opts.reduce((acc, o) => acc.flatMap((row) => o.values.map((v) => ({ ...row, [o.name]: v }))), [{}]);

// Identifies a combination regardless of the order the attributes were written
// in, so regenerating after adding a colour keeps the stock counts already typed.
export const attrsKey = (a) => Object.entries(a || {}).map(([k, v]) => `${k}=${v}`).sort().join("|");

export const newVariantId = () => `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// Only options with both a name and some values can produce anything.
export const usableOptions = (options) =>
  (options || []).filter((o) => (o?.name || "").trim() && (o?.values || []).length);

// Every combination of the given options, inheriting the product's prices.
// A combination that already exists is kept as it is — its SKU, its stock count
// and its own photo were typed by hand and must survive a regenerate.
export function buildVariants(options, base = {}, existing = []) {
  const opts = usableOptions(options);
  if (!opts.length) return [];
  const byKey = new Map((existing || []).map((v) => [attrsKey(v.attrs), v]));
  return cartesian(opts).map((attrs) => byKey.get(attrsKey(attrs)) || ({
    id: newVariantId(),
    name: Object.values(attrs).join(" / "),
    sku: "", attrs,
    regular_price: base.regular_price || "",
    sale_price: base.sale_price || "",
    stock_qty: "", stock_status: "instock", image_url: "",
  }));
}
