// Options → variants. Options are the axes a customer chooses along ("Size":
// S/M/L); variants are the sellable combinations those axes produce.
//
// This lived inside the product drawer, which was fine while the drawer was the
// only place a variant could be born. The photo batch now creates them too, and
// two copies of a cartesian product that must agree on the shape of a variant
// row is exactly the kind of thing that drifts apart quietly. It is pure — no
// supabase, no AI — so a client component can import it.

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
