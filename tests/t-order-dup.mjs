// The second order-duplicate guard: when the model invents a fresh order_code on
// a second pass, the code-based check and the unique index both miss it (they key
// on the code), so the same order saves twice. isDuplicateOrder catches it on the
// content instead — same items AND same total for the same customer.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { loadPure } from "./shim.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const BOT = join(here, "..", "src", "lib", "bot.js");

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

const { isDuplicateOrder } = await loadPure(BOT, "tmp-order-dup.mjs");

const recent = [
  { product_names: "10000 mAh Solar Powerbank D508", total_price: "2100" },
  { product_names: "Cotton Panjabi", total_price: "1450" },
];

// THE BUG: same items + same total (a different code doesn't matter here).
ok("same items + total → duplicate",
  isDuplicateOrder(recent, "10000 mAh Solar Powerbank D508", "2100") === true);

// Genuinely different orders are NOT blocked.
ok("same items, different total → not a duplicate",
  isDuplicateOrder(recent, "10000 mAh Solar Powerbank D508", "2500") === false);
ok("different items, same total → not a duplicate",
  isDuplicateOrder(recent, "Some Other Thing", "2100") === false);
ok("a product not ordered recently → not a duplicate",
  isDuplicateOrder(recent, "20000 mAh Solar Powerbank D509", "2500") === false);

// Robust to whitespace and to number-vs-string totals.
ok("whitespace around names is ignored",
  isDuplicateOrder(recent, "  10000 mAh Solar Powerbank D508 ", " 2100 ") === true);
ok("numeric total matches string total",
  isDuplicateOrder([{ product_names: "X", total_price: 999 }], "X", 999) === true);

// Empty / missing inputs never falsely block a save.
ok("empty recent list → not a duplicate", isDuplicateOrder([], "X", "100") === false);
ok("null recent list → not a duplicate", isDuplicateOrder(null, "X", "100") === false);
ok("nothing to compare on → not a duplicate", isDuplicateOrder(recent, "", "") === false);
ok("a recent row with missing fields does not throw or match",
  isDuplicateOrder([{}], "X", "100") === false);

console.log(fail === 0 ? `${pass} passed, 0 failed` : `${pass} passed, ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
