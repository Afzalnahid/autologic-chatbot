// The per-product "bot sells" switch: how the flag is read, and that hidden
// products never reach the bot's prompt. product-visibility.js has no imports,
// so it is loaded where it lives.
import { isHidden, parseHidden, dropHidden } from "../src/lib/product-visibility.js";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) pass++; else { fail++; console.error("FAIL:", name, typeof extra === "string" ? extra : JSON.stringify(extra)); } };

// The stored flag.
ok("absent means visible (every product from before the switch)", !isHidden({ product_name: "x" }));
ok("null metadata is visible", !isHidden(null));
ok("true hides", isHidden({ hidden: true }));
ok("the text forms an older row might hold hide too", isHidden({ hidden: "true" }) && isHidden({ hidden: "1" }));
ok("false stays visible", !isHidden({ hidden: false }) && !isHidden({ hidden: "0" }) && !isHidden({ hidden: "" }));

// The form field.
ok("1 / true / on / yes switch it off", parseHidden("1") && parseHidden("true") && parseHidden("ON") && parseHidden("yes"));
ok("0 / false / empty / missing keep it selling", !parseHidden("0") && !parseHidden("false") && !parseHidden("") && !parseHidden(undefined));

// The search.
const rows = [
  { id: 1, metadata: { product_name: "A" }, similarity: 0.9 },
  { id: 2, metadata: { product_name: "B", hidden: true }, similarity: 0.85 },
  { id: 3, metadata: { product_name: "C" }, similarity: 0.8 },
  { id: 4, metadata: { product_name: "D", hidden: "1" }, similarity: 0.7 },
  { id: 5, metadata: { product_name: "E" }, similarity: 0.6 },
];
const kept = dropHidden(rows, 3);
ok("hidden rows are dropped, the rest kept in rank order", kept.map((r) => r.id).join(",") === "1,3,5", kept.map((r) => r.id));
ok("k caps what is left, not what was asked for", dropHidden(rows, 1).length === 1 && dropHidden(rows, 1)[0].id === 1);
ok("no k keeps every visible row", dropHidden(rows).length === 3);
ok("plain metadata objects are accepted", dropHidden([{ hidden: true }, { product_name: "x" }]).length === 1);
ok("an empty or missing list is fine", dropHidden([]).length === 0 && dropHidden(null).length === 0 && dropHidden([null, undefined]).length === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
