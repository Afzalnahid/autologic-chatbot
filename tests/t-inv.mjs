// The whitelist is the only thing standing between a model's JSON and the
// shop's catalogue, so it is tested as a boundary, not as a formatter.
import { normalizeAction, normalizeActions, describeAction, FIELDS } from "./inv-actions.mjs";

let bad = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) console.log(`      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
};

// ── What must get through ────────────────────────────────────────────────────
check("a plain price change",
  normalizeAction({ do: "update", id: "p1", set: { regular_price: "৳ 1,200" } }),
  { do: "update", id: "p1", set: { regular_price: "1200" } });

check("stock count arrives as a number",
  normalizeAction({ do: "update", id: "p1", set: { stock_qty: "12 pieces" } }).set.stock_qty, 12);

check("tags from a comma string",
  normalizeAction({ do: "update", id: "p1", set: { tags: "winter, wool" } }).set.tags, ["winter", "wool"]);

check("options keep name and values",
  normalizeAction({ do: "update", id: "p1", set: { options: [{ name: "Size", values: "S, M, L" }] } }).set.options,
  [{ name: "Size", values: ["S", "M", "L"] }]);

check("create needs only a name",
  normalizeAction({ do: "create", set: { product_name: "Red scarf", regular_price: "350" } }),
  { do: "create", set: { product_name: "Red scarf", regular_price: "350" } });

check("delete carries nothing but the id",
  normalizeAction({ do: "delete", id: "p9", set: { regular_price: "1" } }), { do: "delete", id: "p9" });

// ── What must NOT get through ────────────────────────────────────────────────
check("an unknown verb is dropped", normalizeAction({ do: "drop table", id: "p1", set: { regular_price: "1" } }), null);
check("update without an id is dropped", normalizeAction({ do: "update", set: { regular_price: "1" } }), null);
check("delete without an id is dropped", normalizeAction({ do: "delete" }), null);
check("create without a name is dropped", normalizeAction({ do: "create", set: { regular_price: "350" } }), null);
check("a field outside the whitelist is stripped",
  normalizeAction({ do: "update", id: "p1", set: { client_id: "someone-else", image_url: "http://x/y.jpg", regular_price: "10" } }),
  { do: "update", id: "p1", set: { regular_price: "10" } });
check("an action that is nothing BUT forbidden fields is dropped entirely",
  normalizeAction({ do: "update", id: "p1", set: { client_id: "someone-else" } }), null);
check("stock_status can only be one of two things",
  normalizeAction({ do: "update", id: "p1", set: { stock_status: "maybe" } }).set.stock_status, "instock");
check("a price of nonsense is not stored as 0",
  normalizeAction({ do: "update", id: "p1", set: { regular_price: "ask us" } }), null);
check("junk in the list does not break the list",
  normalizeActions([null, "nope", { do: "update", id: "p1", set: { brand: "Ash" } }, {}]).length, 1);
check("the list is capped", normalizeActions(Array.from({ length: 60 }, (_, i) => ({ do: "update", id: `p${i}`, set: { brand: "x" } }))).length, 40);
check("a description is cut, not sliced from the middle",
  normalizeAction({ do: "update", id: "p1", set: { description: "A".repeat(5000) } }).set.description.length, 4000);
check("a long name is cut to 160", normalizeAction({ do: "update", id: "p1", set: { product_name: "N".repeat(400) } }).set.product_name.length, 160);

// ── What the owner reads ─────────────────────────────────────────────────────
const before = { product_name: "Box T-shirt 3", regular_price: "450", stock_qty: 8, options: [{ name: "Size", values: ["S", "M"] }] };
const d1 = describeAction({ do: "update", id: "p1", set: { regular_price: "500" } }, before);
check("a price change reads as from → to", d1.lines, ["Price: 450 → 500"]);
check("the card names the product", d1.title, "Change Box T-shirt 3");

const d2 = describeAction({ do: "update", id: "p1", set: { brand: "Ash" } }, before);
check("a field that was empty shows only the new value", d2.lines, ["Brand: Ash"]);

const d3 = describeAction({ do: "delete", id: "p1" }, before);
check("deleting is marked dangerous", d3.danger, true);
check("deleting names the product", d3.title, "Delete Box T-shirt 3");

const d4 = describeAction({ do: "create", set: { product_name: "Red scarf", regular_price: "350" } }, null);
check("creating warns there is no photo", d4.lines.some((l) => /No photo/.test(l)), true);

// A product from an old import may be missing the field entirely, or hold the
// wrong shape. Reading it must not throw in front of the owner.
const d5 = describeAction({ do: "update", id: "p1", set: { options: [{ name: "Colour", values: ["Red"] }] } }, { product_name: "X" });
check("missing options on the existing product does not throw", d5.lines, ["Sizes / colours: Colour: Red"]);
const d6 = describeAction({ do: "update", id: "p1", set: { tags: ["a"] } }, { product_name: "X", tags: "not-an-array" });
check("a tags field of the wrong shape does not throw", d6.lines, ["Tags: not-an-array → a"]);
check("describing an unknown product still renders", describeAction({ do: "update", id: "p1", set: { brand: "Ash" } }, null).title, "Change product");

check("every whitelisted field has a label", Object.values(FIELDS).filter(Boolean).length, Object.keys(FIELDS).length);

console.log(bad === 0 ? "\nALL PASSED" : `\n${bad} FAILED`);
