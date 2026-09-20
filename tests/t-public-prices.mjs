// A price typed by hand into a public page goes stale the day the price list
// changes — and Google keeps printing it. On 2026-09-20 the pricing page's
// description still said "from ৳1,500/month" in the search results while the
// cheapest package was ৳2,299. Public copy that quotes our own price must take
// it from plans.js; this suite fails when someone types one in again.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const { PLANS, PAID_PLANS, lowestMonthly, bnNumber, formatMoney } =
  await import(pathToFileURL(join(root, "src", "lib", "plans.js")).href);

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

const monthly = PAID_PLANS.map((id) => PLANS[id].monthly);
ok("lowestMonthly is the cheapest package on sale", lowestMonthly() === Math.min(...monthly));
ok("lowestMonthly is a real, positive price", Number.isFinite(lowestMonthly()) && lowestMonthly() > 0);
ok("the free trial never counts as the lowest price", lowestMonthly() !== 0);
ok("bnNumber writes Bangla digits with grouping", bnNumber(2299) === "২,২৯৯" && bnNumber(11999) === "১১,৯৯৯");
ok("bnNumber leaves no Latin digit behind", !/\d/.test(bnNumber(lowestMonthly())));
ok("formatMoney matches what the pricing page prints", formatMoney(2299) === "৳2,299");

// Files whose words reach a search result. None may carry a typed-in taka
// figure of ours; the docs price table is checked against plans.js instead.
const read = (...p) => readFileSync(join(root, ...p), "utf8");
const typedPrice = /(৳\s?[\d০-৯][\d০-৯,]{2,}|[\d০-৯][\d০-৯,]{2,}\s?(৳|টাকা|taka|BDT))/;
const pricingMeta = read("src", "app", "pricing", "page.js");
ok("the pricing page description has no typed-in price", !typedPrice.test(pricingMeta));
ok("the pricing page description is built from the price list", pricingMeta.includes("lowestMonthly()"));
for (const lang of ["en", "bn"]) {
  const src = read("src", "lib", "solutions", `${lang}.js`);
  ok(`solutions/${lang}.js has no typed-in price`, !typedPrice.test(src));
  ok(`solutions/${lang}.js quotes the price from plans.js`, src.includes("lowestMonthly()"));
}

// The manual's package table is typed by hand (it is a table of words), so it
// is held to the catalogue here: every current price must appear in it.
for (const lang of ["en", "bn"]) {
  const doc = read("src", "lib", "docs", `${lang}.js`);
  const show = (n) => (lang === "bn" ? "৳" + bnNumber(n) : formatMoney(n));
  for (const id of PAID_PLANS) {
    ok(`manual (${lang}) shows ${id}'s monthly price`, doc.includes(show(PLANS[id].monthly)));
    if (typeof PLANS[id].byokMonthly === "number")
      ok(`manual (${lang}) shows ${id}'s own-key price`, doc.includes(show(PLANS[id].byokMonthly)));
  }
}

console.log(`t-public-prices: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
