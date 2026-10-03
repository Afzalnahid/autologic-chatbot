// The purchase screen and both payment routes price the same basket the same way
// (owner, 2026-10-03/04): a package as Standard or own-key with its numbers
// moved by sliders, or numbers raised mid-period. The browser sends a package
// id and the changes, never an amount; the server prices with lib/pricing.js
// through lib/billing-basket.js. And the way from payment to approval: one
// transaction ID per purchase, the owner told both ways, the dashboard opening
// by itself when the payment is approved.
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
ok("a package basket is priced by quotePlan", /quotePlan\(\{ plan, cycle: body\.cycle \|\| "monthly", byok: !!body\.byok, custom: body\.custom \|\| \{\}, units, plans \}\)/.test(basket));
ok("a top-up basket is priced by quoteTopUp", /quoteTopUp\(\{ client, plan, custom: body\.custom \|\| \{\}, units, plans \}\)/.test(basket));
ok("a top-up needs a running paid package", /!planActive\(client\)/.test(basket));
ok("the basket never reads an amount from the browser", !/body\.amount/.test(basket));
ok("the row stores the customer's numbers", /custom_limits: q\.custom/.test(basket));

for (const [name, file] of [["manual", ["src", "app", "api", "billing", "route.js"]], ["online", ["src", "app", "api", "billing", "checkout", "route.js"]]]) {
  const src = read(...file);
  ok(`${name} payment prices with priceBasket`, /await priceBasket\(client, body\)/.test(src));
  ok(`${name} payment stores what was bought`, /\.\.\.basket\.row/.test(src));
  ok(`${name} payment no longer prices from the saved key`, !/priceForClient\(/.test(src));
}
const get = read("src", "app", "api", "billing", "route.js");
ok("billing GET gives the screen the step prices for this business", /units: unitsForBiz\(units, client\.business_type \|\| "ecommerce"\)/.test(get));
ok("billing GET gives the current package as bought", /byok_plan: !!client\.byok_plan/.test(get) && /custom_limits: client\.custom_limits \|\| \{\}/.test(get));
ok("a transaction ID already used is refused", /\.ilike\("txn_id", txnClean\)\.in\("status", \["pending", "approved"\]\)/.test(get) && /insErr\.code === "23505"/.test(get));

const ui = read("src", "app", "dashboard", "components", "Billing.js");
ok("the screen totals with the server's pricing", /from "@\/lib\/pricing\.js"/.test(ui) && /quotePlan\(\{ plan: selPlan/.test(ui) && /quoteTopUp\(\{/.test(ui));
ok("the screen sends a package basket without an amount", /\{ kind: "plan", plan: sel, cycle, byok: byokOn, custom \}/.test(ui) && !/amount: amount|amount, method/.test(ui));
ok("the screen sends a top-up basket", /\{ kind: "topup", custom \}/.test(ui));
ok("it opens on the customer's own package, not every package", /useState\(initialPlan \? "change" : "home"\)/.test(ui) && /view === "home" && <Card/.test(ui));
ok("the packages appear only after Update / Choose", /\{view === "change" && <Card/.test(ui) && /Update package/.test(ui));
ok("the numbers move with sliders", /<input type="range"/.test(ui) && /<NumberSlider key=\{s\.kind\}/.test(ui));
ok("a top-up slider cannot go below what is already bought", /floor=\{Number\(d\.custom_limits\?\.\[s\.kind\]\) \|\| 0\}/.test(ui));
ok("an own-key package without a key says the bot is waiting", /d\.byok_plan && !d\.own_key && d\.active/.test(ui));
ok("a turned-down payment shows its reason", /lastRejected\.admin_note/.test(ui));
ok("the screen looks again while a payment waits", /if \(!d\?\.pending_request\) return;\s*const t = setInterval\(load, 20000\)/.test(ui));

// Payment → approval.
const dash = read("src", "app", "dashboard-client.js");
ok("no package + a payment waiting = only the review screen", /if\(noPackage&&d\.pending_payment\) return "pending";/.test(dash));
ok("the review screen polls until approval", /if\(stage!=="pending"\) return;\s*const t=setInterval\(\(\)=>loadMe\(\),20000\)/.test(dash));
ok("a buyer's choice survives signup (buy-intent.js)", /saveBuyIntent\(intent\)/.test(dash) && /intent=\{readBuyIntent\(\)\}/.test(dash));
const me = read("src", "app", "api", "me", "route.js");
ok("the trial is one per account", /if \(client\.trial_start\) \{\s*return NextResponse\.json\(\{ error: "The free trial has already been used/.test(me));
ok("/api/me says when a payment is waiting", /pending_payment = \(rows \|\| \[\]\)\.find\(\(r\) => blocksNewPayment\(r\)\)/.test(me) && /\.eq\("client_id", client\.id\)/.test(me));
const pend = read("src", "app", "dashboard", "components", "PendingPayment.js");
ok("the review screen offers the trial only if unused", /!me\?\.trial_used && <>/.test(pend));
const act = read("src", "lib", "billing-activate.js");
ok("approval tells the owner on the phone", /notify\(pr\.client_id/.test(act));
const adminRoute = read("src", "app", "api", "admin", "route.js");
ok("a rejection tells the owner on the phone", /tag: "payment-rejected"/.test(adminRoute));

// The admin side: step prices are edited in the panel (owner-only), and the
// payment queue shows what each payment buys.
const pkgRoute = read("src", "app", "api", "admin", "packages", "route.js");
ok("saving a step price is a full-access (pricing) action", /const needsOwner = \[[^\]]*"save_unit"/.test(pkgRoute));
ok("a step-price edit changes only the price and the switch", /const patch = \{ price, active: u\.active !== false/.test(pkgRoute) && !/step: int\(u\.step\)/.test(pkgRoute));
ok("a blank own-key price is half the Standard price", /int\(p\.byok_monthly\) \?\? byokFromStandard\(p\.monthly\)/.test(pkgRoute));
ok("the panel loads the step prices", /units: unitsQ\?\.data \|\| \[\]/.test(pkgRoute));
const pkgUi = read("src", "app", "admin", "Packages.js");
ok("the package editor shows the step-price editor", /<UnitEditor units=\{d\.units \|\| \[\]\}/.test(pkgUi));
const adminUi = read("src", "app", "admin", "admin-client.js");
ok("the payment queue marks own-key payments", /\{p\.byok && <Badge color=\{T\.textMuted\}>Own AI key<\/Badge>\}/.test(adminUi));
ok("the payment queue lists the customer's numbers", /describeCustom\(p\.custom_limits\)/.test(adminUi));
ok("the payment queue warns of a reused transaction ID", /dupTxn\(p\)/.test(adminUi));

console.log(`t-billing-basket: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
