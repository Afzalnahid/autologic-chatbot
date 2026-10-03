// What a purchase costs (lib/pricing.js): a package, Standard or own-key (BYOK,
// half price), monthly or yearly, with the package's countable numbers RAISED by
// a slider (never lowered, never close to the next package), and numbers raised
// in the middle of a running package (prorated). Owner, 2026-10-04.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const P = await import(pathToFileURL(join(root, "src", "lib", "pricing.js")).href);

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

// Rows shaped like the database (numerics arrive as strings) — the live ladder.
const shop = (id, monthly, byok, msgs, prods, asst) => ({ id, name: id, biz: "ecommerce", active: true, monthly: String(monthly), yearly: String(monthly * 10), byok_monthly: byok, byok_yearly: byok * 10, messages_per_month: msgs, max_products: prods, max_kb_files: 0, max_assistant_per_month: asst });
const svc = (id, monthly, byok, msgs, docs, asst) => ({ id, name: id, biz: "agency", active: true, monthly: String(monthly), yearly: String(monthly * 10), byok_monthly: byok, byok_yearly: null, messages_per_month: msgs, max_products: 0, max_kb_files: docs, max_assistant_per_month: asst });
const sB = shop("shop_basic", 2699, 1349, 2000, 500, 100);
const sP = shop("shop_pro", 5999, 2999, 5500, 1000, 400);
const sE = shop("shop_enterprise", 11999, 5999, 12000, 2500, 800);
const vB = svc("svc_basic", 2299, 1149, 2000, 20, 100);
const vP = svc("svc_pro", 4999, 2499, 5500, 60, 400);
const vE = svc("svc_enterprise", 9999, 4999, 12000, 150, 800);
const trial = { id: "trial", biz: "both", active: true, monthly: "0", messages_per_day: 30, max_products: 20 };
const PLANS = [trial, sB, sP, sE, vB, vP, vE];
const U = P.UNIT_DEFAULTS;
const opts = { units: U, plans: PLANS };

// Package prices, and own key at half.
ok("standard monthly", P.planPrice(sP) === 5999);
ok("standard yearly uses the stored yearly", P.planPrice(sP, { cycle: "yearly" }) === 59990);
ok("byok monthly", P.planPrice(sP, { byok: true }) === 2999);
ok("byok yearly with none stored is ten months", P.planPrice(vB, { cycle: "yearly", byok: true }) === 11490);
ok("a bad cycle has no price", P.planPrice(sP, { cycle: "weekly" }) === null);
ok("own key is half, rounded down: 2,699 → 1,349", P.byokFromStandard(2699) === 1349);
ok("…5,999 → 2,999 and 9,999 → 4,999", P.byokFromStandard(5999) === 2999 && P.byokFromStandard(9999) === 4999);
ok("…and no price gives no own-key price", P.byokFromStandard(0) === null && P.byokFromStandard(null) === null);

// The ladder and the sliders: only up, at most half the way to the next package.
ok("a shop's ladder is its three packages, cheapest first", P.ladderFor(PLANS, "ecommerce").map((p) => p.id).join() === "shop_basic,shop_pro,shop_enterprise");
ok("the trial is never on a ladder", !P.ladderFor(PLANS, "both").length);
const sl = (plan) => Object.fromEntries(P.slidersFor(plan, opts).map((s) => [s.kind, s]));
const b = sl(sB), p = sl(sP), e = sl(sE), vb = sl(vB);
ok("a shop moves replies, products and assistant questions", Object.keys(b).join() === "replies,products,assistant");
ok("a service moves replies, knowledge files and assistant questions", Object.keys(vb).join() === "replies,docs,assistant");
ok("no slider goes below the package's own number", P.slidersFor(sP, opts).every((s) => s.min === 0));
ok("basic replies go up half the way to Pro: 2,000 → 3,750", b.replies.max === 1750);
ok("pro replies go half the way to Enterprise: 5,500 → 8,750", p.replies.max === 3250);
ok("enterprise goes up at most half again", e.replies.max === 6000 && e.products.max === 1250);
ok("basic products 500 → 750 in steps of 50", b.products.max === 250 && b.products.step === 50);
ok("service files 20 → 40 in steps of 5", vb.docs.step === 5 && vb.docs.max === 20);
ok("a range is always a whole number of steps", P.slidersFor(sP, opts).every((s) => s.max % s.step === 0));
ok("the trial has no sliders", !P.slidersFor(trial, opts).length);
ok("an unlimited allowance has no slider", !P.slidersFor({ ...sB, messages_per_month: null }, opts).some((s) => s.kind === "replies"));
ok("an inactive step price has no slider", !P.slidersFor(sB, { units: U.map((u) => u.kind === "products" ? { ...u, active: false } : u), plans: PLANS }).some((s) => s.kind === "products"));

// Checking what the browser sent.
const S = P.slidersFor(sB, opts);
ok("a valid raise passes", P.cleanCustom({ replies: 500, products: 50 }, S).ok);
ok("zero changes are dropped", JSON.stringify(P.cleanCustom({ replies: 0 }, S).custom) === "{}");
ok("lowering is refused", !P.cleanCustom({ replies: -50 }, S).ok);
ok("off-step is refused", !P.cleanCustom({ replies: 30 }, S).ok);
ok("past half the way to the next package is refused", !P.cleanCustom({ replies: 1800 }, S).ok);
ok("a shop cannot move knowledge files", !P.cleanCustom({ docs: 5 }, S).ok);
ok("a fraction is refused", !P.cleanCustom({ products: 50.5 }, S).ok);

// Quotes.
const q0 = P.quotePlan({ plan: sB, ...opts });
ok("no change: the package price", q0.ok && q0.total === 2699 && q0.lines.length === 1);
ok("…and the limits are the package's", q0.limits.messages_per_month === 2000 && q0.limits.max_products === 500);
const up = P.quotePlan({ plan: sB, custom: { replies: 500, products: 100 }, ...opts });
ok("+500 replies (10 × ৳40) and +100 products (2 × ৳50) = 2,699 + 400 + 100", up.ok && up.total === 3199);
ok("…and the limits move with it", up.limits.messages_per_month === 2500 && up.limits.max_products === 600);
const own = P.quotePlan({ plan: sB, byok: true, custom: { replies: 500, products: 100 }, ...opts });
ok("own key: half the package and half the raise: 1,349 + 250", own.ok && own.total === 1599);
const yr = P.quotePlan({ plan: sB, cycle: "yearly", custom: { replies: 500 }, ...opts });
ok("yearly: ten months of the package and of the raise", yr.ok && yr.total === 26990 + 4000);
const maxed = P.quotePlan({ plan: sB, custom: { replies: 1750, products: 250, assistant: 150 }, ...opts });
ok("Basic at its top is ৳4,499 — well short of Pro's ৳5,999", maxed.ok && maxed.total === 4499);
ok("…and points at Pro, ৳1,500 more", maxed.better?.id === "shop_pro" && maxed.better.more === 1500);
ok("a small raise suggests nothing", !up.better);
for (const [plan, next] of [[sB, sP], [sP, sE], [vB, vP], [vP, vE]]) {
  const top = Object.fromEntries(P.slidersFor(plan, opts).map((s) => [s.kind, s.max]));
  const q = P.quotePlan({ plan, custom: top, ...opts });
  ok(`${plan.id} at its top stays under ${next.id}'s price`, q.ok && q.total < Number(next.monthly));
}
const svcUp = P.quotePlan({ plan: vB, custom: { docs: 10 }, ...opts });
ok("service: +10 files = 2 × ৳50", svcUp.ok && svcUp.total === 2399);
ok("a refused change refuses the quote", !P.quotePlan({ plan: sB, custom: { replies: 7 }, ...opts }).ok);
ok("own key on a package without it is refused", !P.quotePlan({ plan: { ...sB, byok_monthly: null }, byok: true, ...opts }).ok);
ok("the trial cannot be bought", !P.quotePlan({ plan: trial, ...opts }).ok);

// Days and proration.
const now = Date.parse("2026-10-04T00:00:00Z");
ok("days left rounds up", P.daysLeft(new Date(now + 3.2 * 86400000).toISOString(), now) === 4);
ok("an ended package has no days", P.daysLeft(new Date(now - 1000).toISOString(), now) === 0);
ok("prorate: 15 of 30 days of ৳400 is ৳200", P.prorate(400, 15, "monthly") === 200);
ok("prorate never charges more than the full price", P.prorate(400, 40, "monthly") === 400);

// Raising numbers mid-period.
const client = { plan: "shop_basic", plan_expires_at: new Date(now + 15 * 86400000).toISOString(), byok_plan: false, billing_cycle: "monthly", custom_limits: { replies: 500 } };
const t = P.quoteTopUp({ client, plan: sB, custom: { replies: 1000, products: 50 }, ...opts, now });
ok("top-up: only the raise, for the days left: (+500 replies ৳400 + 50 products ৳50) × 15/30", t.ok && t.total === 225);
ok("…and keeps the full new set to save", JSON.stringify(t.custom) === JSON.stringify({ replies: 1000, products: 50 }));
ok("lowering mid-period is refused", !P.quoteTopUp({ client, plan: sB, custom: { replies: 0 }, ...opts, now }).ok);
ok("no raise is refused", !P.quoteTopUp({ client, plan: sB, custom: { replies: 500 }, ...opts, now }).ok);
const tOwn = P.quoteTopUp({ client: { ...client, byok_plan: true }, plan: sB, custom: { replies: 1000 }, ...opts, now });
ok("own key: half the raise", tOwn.ok && tOwn.total === 100);
ok("an ended package cannot be topped up", !P.quoteTopUp({ client: { ...client, plan_expires_at: new Date(now - 1).toISOString() }, plan: sB, custom: { replies: 1000 }, ...opts, now }).ok);

// Limits.
ok("a change applies to a limit", P.withChange(2000, 500) === 2500 && P.withChange(500, -50) === 450);
ok("unlimited stays unlimited", P.withChange(null, 500) === null);
ok("a limit never goes below zero", P.withChange(100, -500) === 0);
ok("changes by limit column", JSON.stringify(P.changesByLimit({ replies: 500, docs: -5, bogus: 3 })) === JSON.stringify({ messages_per_month: 500, max_kb_files: -5 }));

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
