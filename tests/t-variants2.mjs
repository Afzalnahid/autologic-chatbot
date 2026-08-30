// The extraction must behave exactly like the drawer's old inline generate().
import { buildVariants, usableOptions, cartesian, attrsKey } from "./variants.mjs";

// A verbatim copy of what ProductEditor.generate() used to do.
const oldGenerate = (options, f) => {
  const opts = options.filter((o) => o.name.trim() && o.values.length);
  if (!opts.length) return null;
  const combos = cartesian(opts);
  const byKey = new Map(f.variants.map((v) => [attrsKey(v.attrs), v]));
  return combos.map((attrs) => byKey.get(attrsKey(attrs)) || ({
    id: "ID", name: Object.values(attrs).join(" / "), sku: "", attrs,
    regular_price: f.regular_price, sale_price: f.sale_price,
    stock_qty: "", stock_status: "instock", image_url: "",
  }));
};

let bad = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) console.log(`      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
};
const flat = (vs) => (vs || []).map(({ id, ...rest }) => rest); // ids are random by design

const opts = [{ name: "Size", values: ["S", "M"] }, { name: "Colour", values: ["Red", "Blue"] }];
const f = { regular_price: "450", sale_price: "", variants: [] };

check("same rows as the old inline generate", flat(buildVariants(opts, f, f.variants)), flat(oldGenerate(opts, f)));
check("four combinations from 2×2", buildVariants(opts, f, []).length, 4);
check("name is the combination", buildVariants(opts, f, []).map((v) => v.name), ["S / Red", "S / Blue", "M / Red", "M / Blue"]);
check("price is inherited", buildVariants(opts, f, [])[0].regular_price, "450");

// The reason attrsKey sorts: a typed stock count must survive a regenerate,
// even when the option order changed in between.
const typed = { id: "keep", name: "S / Red", sku: "SR-1", attrs: { Colour: "Red", Size: "S" }, regular_price: "450", sale_price: "", stock_qty: 7, stock_status: "instock", image_url: "" };
check("an already-typed row is kept, order-independent",
  buildVariants(opts, f, [typed])[0], typed);

check("an option with no values produces nothing", buildVariants([{ name: "Size", values: [] }], f, []), []);
check("an unnamed option produces nothing", buildVariants([{ name: " ", values: ["S"] }], f, []), []);
check("no options at all", buildVariants([], f, []), []);
check("usableOptions drops the empty ones", usableOptions([...opts, { name: "X", values: [] }]).length, 2);
check("ids are unique", new Set(buildVariants(opts, f, []).map((v) => v.id)).size, 4);

console.log(bad === 0 ? "\nALL PASSED" : `\n${bad} FAILED`);
