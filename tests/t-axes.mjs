// The axis names decide what a customer is offered a choice of, and getting
// them from the shop rather than from a clothing assumption is the whole point.
import { knownAxes, parseAxes } from "./variants.mjs";

let bad = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) console.log(`      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
};

// ── What the shop already uses ───────────────────────────────────────────────
const clothes = [
  { options: [{ name: "Size", values: ["S"] }, { name: "Colour", values: ["Red"] }] },
  { options: [{ name: "Size", values: ["M"] }] },
  { options: [] },
];
check("a clothing shop's own axes, most used first", knownAxes(clothes), ["Size", "Colour"]);

const electronics = [
  { options: [{ name: "Capacity", values: ["128GB"] }, { name: "Colour", values: ["Black"] }] },
  { options: [{ name: "Capacity", values: ["256GB"] }] },
  { options: [{ name: "Model", values: ["Pro"] }] },
];
check("an electronics shop gets ITS axes, not Size", knownAxes(electronics), ["Capacity", "Colour", "Model"]);

check("an empty catalogue proposes nothing", knownAxes([]), []);
check("null is safe", knownAxes(null), []);
check("products with no options propose nothing", knownAxes([{ product_name: "X" }, {}]), []);
check("blank names are ignored", knownAxes([{ options: [{ name: "  ", values: ["a"] }] }]), []);
check("case is one axis, spelled as the shop spells it most",
  knownAxes([{ options: [{ name: "size" }] }, { options: [{ name: "size" }] }, { options: [{ name: "Size" }] }]), ["size"]);
check("capped", knownAxes([{ options: [{ name: "a" }, { name: "b" }, { name: "c" }, { name: "d" }, { name: "e" }] }]).length, 4);

// ── What the owner typed ─────────────────────────────────────────────────────
check("the short answer uses the axis we asked about",
  parseAxes("S, M, L", "Size"), [{ name: "Size", values: ["S", "M", "L"] }]);
check("...and the fallback name is whatever the shop calls it",
  parseAxes("128GB, 256GB", "Capacity"), [{ name: "Capacity", values: ["128GB", "256GB"] }]);
check("the fuller answer names its own axes",
  parseAxes("Size: S, M, L; Colour: Black, White"),
  [{ name: "Size", values: ["S", "M", "L"] }, { name: "Colour", values: ["Black", "White"] }]);
check("newlines separate axes too",
  parseAxes("Weight: 500g, 1kg\nFlavour: Mango"),
  [{ name: "Weight", values: ["500g", "1kg"] }, { name: "Flavour", values: ["Mango"] }]);
check("spacing around the colon does not matter",
  parseAxes("Size:S,M"), [{ name: "Size", values: ["S", "M"] }]);
check("an axis with no values is dropped", parseAxes("Size: ; Colour: Black"), [{ name: "Colour", values: ["Black"] }]);
check("nothing typed is no axes", parseAxes(""), []);
check("whitespace is no axes", parseAxes("   "), []);
check("null is safe", parseAxes(null), []);
check("a lone value still works", parseAxes("One size", "Size"), [{ name: "Size", values: ["One size"] }]);
check("capped at five axes",
  parseAxes("a:1;b:2;c:3;d:4;e:5;f:6").length, 5);
check("a value containing a colon is not torn apart",
  parseAxes("Model: A:1, B:2")[0].values, ["A:1", "B:2"]);

console.log(bad === 0 ? "\nALL PASSED" : `\n${bad} FAILED`);
