// What a purchase costs (lib/pricing.js): a package, Standard or own-key (BYOK),
// monthly or yearly, plus add-ons (more replies, products or documents), and
// add-ons bought in the middle of a running package (prorated). Owner, 2026-10-03.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (...p) => readFileSync(join(root, ...p), "utf8");
const P = await import(pathToFileURL(join(root, "src", "lib", "pricing.js")).href);

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

// Rows shaped like the database (numerics arrive as strings).
const shopPro = { id: "shop_pro", name: "Shop Pro", biz: "ecommerce", active: true, monthly: "5999", yearly: "59990", byok_monthly: 4499, byok_yearly: 44990, messages_per_month: 5500, max_products: 1000 };
const svcBasic = { id: "svc_basic", name: "Service Basic", biz: "agency", active: true, monthly: "2299", yearly: "22990", byok_monthly: 1699, byok_yearly: null, messages_per_month: 2000, max_kb_files: 20 };
const noByok = { id: "x", name: "X", biz: "ecommerce", active: true, monthly: "1000", yearly: null, byok_monthly: null };
const trial = { id: "trial", biz: "both", active: true, monthly: "0" };
const A = P.ADDON_DEFAULTS;

// Package prices.
ok("standard monthly", P.planPrice(shopPro) === 5999);
ok("standard yearly uses the stored yearly", P.planPrice(shopPro, { cycle: "yearly" }) === 59990);
ok("byok monthly", P.planPrice(shopPro, { byok: true }) === 4499);
ok("byok yearly uses the stored own-key yearly", P.planPrice(shopPro, { cycle: "yearly", byok: true }) === 44990);
ok("byok yearly with none stored is ten months", P.planPrice(svcBasic, { cycle: "yearly", byok: true }) === 16990);
ok("standard yearly with none stored is ten months", P.planPrice(noByok, { cycle: "yearly" }) === 10000);
ok("a package without an own-key price has no BYOK option", P.planPrice(noByok, { byok: true }) === null);
ok("a bad cycle has no price", P.planPrice(shopPro, { cycle: "weekly" }) === null);

// Which add-ons a business sees.
const shopAddons = P.addonsForBiz(A, "ecommerce").map((a) => a.id);
const svcAddons = P.addonsForBiz(A, "agency").map((a) => a.id);
ok("a shop sees replies and products", shopAddons.join() === "replies_100,replies_200,products_50,products_100");
ok("a service sees replies and documents", svcAddons.join() === "replies_100,replies_200,docs_5,docs_10");
ok("an inactive add-on is not offered", !P.addonsForBiz([{ ...A[0], active: false }], "ecommerce").length);

// Add-on prices.
ok("add-on standard monthly", P.addonPrice(A[0]) === 149);
ok("add-on byok monthly", P.addonPrice(A[0], { byok: true }) === 89);
ok("add-on yearly is ten months", P.addonPrice(A[1], { cycle: "yearly" }) === 2790);
ok("add-on byok yearly is ten months", P.addonPrice(A[1], { cycle: "yearly", byok: true }) === 1690);

// Whole basket.
const q = P.quotePlan({ plan: shopPro, cycle: "monthly", byok: true, picks: { replies_100: 1, products_50: 2 }, addons: A });
ok("basket ok", q.ok);
ok("basket total = 4499 + 89 + 2×59", q.total === 4499 + 89 + 118);
ok("basket lines name the package first", q.lines[0].type === "plan" && q.lines.length === 3);
ok("basket keeps the picks it charged for", q.picks.replies_100 === 1 && q.picks.products_50 === 2);
const qs = P.quotePlan({ plan: svcBasic, cycle: "yearly", picks: { docs_10: 1 }, addons: A });
ok("service yearly with a document add-on", qs.ok && qs.total === 22990 + 1790);
ok("a shop cannot buy documents", !P.quotePlan({ plan: shopPro, picks: { docs_5: 1 }, addons: A }).ok);
ok("a service cannot buy products", !P.quotePlan({ plan: svcBasic, picks: { products_50: 1 }, addons: A }).ok);
ok("an unknown add-on is refused, not dropped", !P.quotePlan({ plan: shopPro, picks: { free_stuff: 1 }, addons: A }).ok);
ok("a fractional count is refused", !P.quotePlan({ plan: shopPro, picks: { replies_100: 1.5 }, addons: A }).ok);
ok("more than the maximum is refused", !P.quotePlan({ plan: shopPro, picks: { replies_100: P.MAX_ADDON_QTY + 1 }, addons: A }).ok);
ok("a negative count is refused", !P.quotePlan({ plan: shopPro, picks: { replies_100: -1 }, addons: A }).ok);
ok("a zero count is simply nothing", P.quotePlan({ plan: shopPro, picks: { replies_100: 0 }, addons: A }).total === 5999);
ok("the trial cannot be bought", !P.quotePlan({ plan: trial, addons: A }).ok);
ok("BYOK on a package without an own-key price is refused", !P.quotePlan({ plan: noByok, byok: true, addons: A }).ok);

// Mid-period add-ons.
const now = Date.parse("2026-10-03T00:00:00Z");
const inDays = (d) => new Date(now + d * 86400000).toISOString();
ok("days left rounds up", P.daysLeft(new Date(now + 3.2 * 86400000).toISOString(), now) === 4);
ok("no days left after expiry", P.daysLeft(inDays(-1), now) === 0);
ok("half a month costs half", P.prorate(100, 15, "monthly") === 50);
ok("prorate rounds up to whole taka", P.prorate(149, 10, "monthly") === Math.ceil(149 * 10 / 30));
ok("prorate never exceeds the full price", P.prorate(149, 45, "monthly") === 149);
const client = { plan: "shop_pro", plan_expires_at: inDays(15), byok_plan: false, billing_cycle: "monthly" };
const t = P.quoteTopUp({ client, plan: shopPro, picks: { replies_200: 1 }, addons: A, now });
ok("a mid-month top-up is prorated", t.ok && t.total === P.prorate(279, 15, "monthly") && t.daysLeft === 15);
const tb = P.quoteTopUp({ client: { ...client, byok_plan: true }, plan: shopPro, picks: { replies_100: 1 }, addons: A, now });
ok("a BYOK customer's top-up uses the own-key price", tb.ok && tb.total === P.prorate(89, 15, "monthly"));
const ty = P.quoteTopUp({ client: { ...client, billing_cycle: "yearly", plan_expires_at: inDays(200) }, plan: shopPro, picks: { replies_100: 1 }, addons: A, now });
ok("a yearly customer's top-up is prorated over the year", ty.ok && ty.total === P.prorate(1490, 200, "yearly"));
ok("no top-up after the package ended", !P.quoteTopUp({ client: { ...client, plan_expires_at: inDays(-2) }, plan: shopPro, picks: { replies_100: 1 }, addons: A, now }).ok);
ok("no top-up on the trial", !P.quoteTopUp({ client, plan: trial, picks: { replies_100: 1 }, addons: A, now }).ok);
ok("an empty top-up is refused", !P.quoteTopUp({ client, plan: shopPro, picks: {}, addons: A, now }).ok);

// Limits.
ok("merge adds counts", JSON.stringify(P.mergePicks({ replies_100: 2 }, { replies_100: 1, docs_5: 1 })) === JSON.stringify({ replies_100: 3, docs_5: 1 }));
const ex = P.addonExtras({ replies_100: 2, replies_200: 1, products_50: 1, docs_10: 1 }, A);
ok("replies add up", ex.messages_per_month === 400);
ok("products add up", ex.max_products === 50);
ok("documents add up", ex.max_kb_files === 10);
ok("a limit grows by its extra", P.withExtra(5500, 100) === 5600);
ok("unlimited stays unlimited", P.withExtra(null, 100) === null);

// Wiring: the limits every gate reads include the add-ons.
const pl = read("src", "lib", "plan-limits.js");
ok("limitsFor adds add-on extras on paid packages", /const paid = Number\(plan\.monthly \|\| 0\) > 0;/.test(pl) && /addonExtras\(client\.addons, await loadAddons\(\)\)/.test(pl));
ok("loadAddons falls back to the built-in list", /addons = ADDON_DEFAULTS;/.test(pl));

console.log(`t-pricing: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
