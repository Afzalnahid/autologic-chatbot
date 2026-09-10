// BYOK pricing: a client on their own AI key pays the lower price when the
// package sets one, otherwise the standard price. plans.js has no imports, so it
// loads as-is. Covers both the camelCase (code constant) and snake_case (plans
// table row) shapes, and the PLANS catalogue itself.
const M = await import(new URL("../src/lib/plans.js", import.meta.url).href + "?v=" + Date.now());
const { planPrices, priceForClient, PLANS } = M;

let pass = 0, fail = 0;
const is = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) pass++; else { fail++; console.log(`FAIL ${name}\n  got  ${a}\n  want ${b}`); }
};

// ── planPrices reads both shapes ─────────────────────────────────────────────
is("camelCase monthly", planPrices({ monthly: 1500, yearly: 15000, byokMonthly: 1000, byokYearly: 10000 }, "monthly"),
  { std: 1500, byok: 1000 });
is("camelCase yearly", planPrices({ monthly: 1500, yearly: 15000, byokMonthly: 1000, byokYearly: 10000 }, "yearly"),
  { std: 15000, byok: 10000 });
is("snake_case monthly (plans table row)", planPrices({ monthly: 3500, yearly: 35000, byok_monthly: 2500, byok_yearly: 25000 }, "monthly"),
  { std: 3500, byok: 2500 });
is("snake_case yearly", planPrices({ monthly: 3500, yearly: 35000, byok_monthly: 2500, byok_yearly: 25000 }, "yearly"),
  { std: 35000, byok: 25000 });

// ── no BYOK price → byok is null, never 0 ────────────────────────────────────
is("no byok fields", planPrices({ monthly: 1500, yearly: 15000 }, "monthly"), { std: 1500, byok: null });
is("byok explicitly null", planPrices({ monthly: 1500, byok_monthly: null }, "monthly"), { std: 1500, byok: null });
is("byok zero counts as none", planPrices({ monthly: 1500, byok_monthly: 0 }, "monthly"), { std: 1500, byok: null });
is("byok blank string counts as none", planPrices({ monthly: 1500, byok_monthly: "" }, "monthly"), { std: 1500, byok: null });
is("cycle defaults to monthly", planPrices({ monthly: 1500, byok_monthly: 1000 }), { std: 1500, byok: 1000 });

// ── priceForClient picks the right one ───────────────────────────────────────
const shopGrowth = { monthly: 3500, yearly: 35000, byok_monthly: 2500, byok_yearly: 25000 };
is("own key, monthly → byok price", priceForClient(shopGrowth, "monthly", true), 2500);
is("own key, yearly → byok price", priceForClient(shopGrowth, "yearly", true), 25000);
is("no key, monthly → standard price", priceForClient(shopGrowth, "monthly", false), 3500);
is("no key, yearly → standard price", priceForClient(shopGrowth, "yearly", false), 35000);
is("ownKey defaults to false", priceForClient(shopGrowth, "monthly"), 3500);

// Critical safety: a client WITHOUT a key must never be handed the BYOK price,
// and a client WITH a key on a no-BYOK package must never be charged 0.
is("own key but package has no byok → standard, not 0", priceForClient({ monthly: 1500, yearly: 15000 }, "monthly", true), 1500);
is("own key, byok accidentally 0 → standard, not 0", priceForClient({ monthly: 1500, byok_monthly: 0 }, "monthly", true), 1500);

// ── the catalogue carries the agreed prices ──────────────────────────────────
is("shop_starter byok", [PLANS.shop_starter.byokMonthly, PLANS.shop_starter.byokYearly], [1000, 10000]);
is("shop_growth byok", [PLANS.shop_growth.byokMonthly, PLANS.shop_growth.byokYearly], [2500, 25000]);
is("shop_scale byok", [PLANS.shop_scale.byokMonthly, PLANS.shop_scale.byokYearly], [4000, 40000]);
is("svc_starter byok", [PLANS.svc_starter.byokMonthly, PLANS.svc_starter.byokYearly], [1000, 10000]);
is("svc_growth byok", [PLANS.svc_growth.byokMonthly, PLANS.svc_growth.byokYearly], [2500, 25000]);
is("svc_scale byok", [PLANS.svc_scale.byokMonthly, PLANS.svc_scale.byokYearly], [4000, 40000]);
is("trial has no byok price", [PLANS.trial.byokMonthly ?? null, PLANS.trial.byokYearly ?? null], [null, null]);

// Every BYOK price is strictly lower than its standard price (a BYOK client
// should never pay more for bringing their own key).
for (const id of ["shop_starter", "shop_growth", "shop_scale", "svc_starter", "svc_growth", "svc_scale"]) {
  const p = PLANS[id];
  is(`${id} byok < standard (monthly)`, p.byokMonthly < p.monthly, true);
  is(`${id} byok < standard (yearly)`, p.byokYearly < p.yearly, true);
}

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
