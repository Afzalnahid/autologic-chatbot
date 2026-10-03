// The purchase screen and both payment routes price the same basket the same way
// (owner, 2026-10-03): a package as Standard or own-key with add-ons, or add-ons
// mid-period. The browser sends ids and counts, never an amount; the server
// prices with lib/pricing.js through lib/billing-basket.js.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (...p) => readFileSync(join(root, ...p), "utf8");
const P = await import(pathToFileURL(join(root, "src", "lib", "pricing.js")).href);

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

// A business buys only its own side's packages.
ok("a shop may buy a shop package", P.planFitsBusiness({ biz: "ecommerce" }, "ecommerce"));
ok("a shop may not buy a service package", !P.planFitsBusiness({ biz: "agency" }, "ecommerce"));
ok("a service may not buy a shop package", !P.planFitsBusiness({ biz: "ecommerce" }, "agency"));
ok("a package for both fits everyone", P.planFitsBusiness({ biz: "both" }, "agency"));
ok("an untyped package fits everyone", P.planFitsBusiness({}, "agency"));
ok("no business type means a shop (the default)", P.planFitsBusiness({ biz: "ecommerce" }, undefined));

const basket = read("src", "lib", "billing-basket.js");
ok("the basket checks the business type", /planFitsBusiness\(plan, client\.business_type\)/.test(basket));
ok("a package basket is priced by quotePlan", /quotePlan\(\{ plan, cycle: body\.cycle \|\| "monthly", byok: !!body\.byok, picks: body\.addons \|\| \{\}, addons \}\)/.test(basket));
ok("an add-on basket is priced by quoteTopUp", /quoteTopUp\(\{ client, plan, picks: body\.addons \|\| \{\}, addons \}\)/.test(basket));
ok("add-ons need a running paid package", /!planActive\(client\)/.test(basket));
ok("the basket never reads an amount from the browser", !/body\.amount/.test(basket));

for (const [name, file] of [["manual", ["src", "app", "api", "billing", "route.js"]], ["online", ["src", "app", "api", "billing", "checkout", "route.js"]]]) {
  const src = read(...file);
  ok(`${name} payment prices with priceBasket`, /await priceBasket\(client, body\)/.test(src));
  ok(`${name} payment stores what was bought`, /\.\.\.basket\.row/.test(src));
  ok(`${name} payment no longer prices from the saved key`, !/priceForClient\(/.test(src));
}
const get = read("src", "app", "api", "billing", "route.js");
ok("billing GET gives the screen the add-ons this business may buy", /addon_catalogue: addonsForBiz\(addonCatalogue, client\.business_type \|\| "ecommerce"\)/.test(get));
ok("billing GET gives the current package as bought", /byok_plan: !!client\.byok_plan/.test(get) && /addons: client\.addons \|\| \{\}/.test(get));

const ui = read("src", "app", "dashboard", "components", "Billing.js");
ok("the screen totals with the server's pricing", /from "@\/lib\/pricing\.js"/.test(ui) && /quotePlan\(\{plan:selPlan/.test(ui) && /quoteTopUp\(\{/.test(ui));
ok("the screen sends a package basket without an amount", /\{kind:"plan",plan:sel,cycle,byok:/.test(ui) && !/amount:amount|amount,method/.test(ui));
ok("the screen sends an add-on basket", /\{kind:"addon",addons:picks\}/.test(ui));
ok("every package card shows the own-key price", /with your own AI key<\/div>/.test(ui));
ok("an own-key package without a key says the bot is waiting", /d\.byok_plan&&!d\.own_key&&d\.active/.test(ui));

console.log(`t-billing-basket: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
