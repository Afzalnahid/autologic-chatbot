// What counts as money taken. Overview's "Revenue today" left cancelled and
// returned orders out while Analytics added every order, cancelled ones
// included, so the two screens disagreed and the manual described a third rule
// (owner, 2026-10-02: every order except Cancelled and Returned). One rule in
// lib/order-status.js, read by both screens.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (...p) => readFileSync(join(root, ...p), "utf8");
const S = await import(pathToFileURL(join(root, "src", "lib", "order-status.js")).href);

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

for (const s of ["Pending", "Confirmed", "Shipped", "Delivered"]) ok(`${s} counts as a sale`, S.countsAsSale({ status: s }));
for (const s of ["Cancelled", "Returned"]) ok(`${s} does not count`, !S.countsAsSale({ status: s }));
ok("an order with no status yet (Pending) counts", S.countsAsSale({}));

const analytics = read("src", "app", "api", "analytics", "route.js");
ok("Analytics imports the rule", /import \{ countsAsSale \} from "@\/lib\/order-status\.js"/.test(analytics));
ok("Analytics revenue uses it", /const revenue = orders\.filter\(countsAsSale\)/.test(analytics));
ok("Analytics previous-period revenue uses it", /const prevRevenue = prevOrders\.filter\(countsAsSale\)/.test(analytics));
ok("Analytics per-day revenue uses it", /if \(countsAsSale\(o\)\) b\.revenue \+=/.test(analytics));

const overview = read("src", "app", "dashboard", "components", "Overview.js");
ok("Overview imports the rule", /import \{ countsAsSale \} from "@\/lib\/order-status\.js"/.test(overview));
ok("Overview revenue uses it", /const kept = orders\.filter\(countsAsSale\)/.test(overview));

// the manual says the same thing in both languages
ok("the English manual no longer says Delivered-only", !/counts \*\*Delivered\*\* only|Only \*\*Delivered\*\* orders count/.test(read("src", "lib", "docs", "en.js")));
ok("the Bangla manual no longer says Delivered-only", !/কেবল \*\*Delivered\*\*/.test(read("src", "lib", "docs", "bn.js")));

console.log(`t-order-status: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
