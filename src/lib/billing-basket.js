// What a payment request is for, and what it costs — read from the browser's
// choice, priced on the server. Both ways to pay (manual bKash/Nagad/Rocket in
// /api/billing and online in /api/billing/checkout) call this, so they cannot
// price the same basket differently. The arithmetic is lib/pricing.js (pure);
// this file only loads the live catalogue and the client's current package.
//
// The browser sends:
//   { kind: "plan",  plan, cycle, byok, custom: { replies: 500, products: -50 } }
//                                          buy / renew / change a package
//   { kind: "topup", custom: { ... } }     raise numbers mid-period (the NEW set)
// It never sends an amount.
import { loadPlans, loadUnits } from "@/lib/plan-limits.js";
import { quotePlan, quoteTopUp, planFitsBusiness } from "@/lib/pricing.js";
import { planActive } from "@/lib/plans.js";

const bad = (error, status = 400) => ({ ok: false, error, status });

// → { ok:true, row: { kind, plan, billing_cycle, amount, byok, custom_limits }, label, quote }
// → { ok:false, error, status }
export async function priceBasket(client, body = {}) {
  const [plans, units] = await Promise.all([loadPlans(), loadUnits()]);
  const kind = body.kind === "topup" ? "topup" : "plan";

  if (kind === "topup") {
    const plan = plans[client.plan];
    if (!plan || !(Number(plan.monthly) > 0) || !planActive(client)) {
      return bad("Raising your numbers works on a running paid package. Choose a package first — you can set the numbers with it.");
    }
    const q = quoteTopUp({ client, plan, custom: body.custom || {}, units, plans });
    if (!q.ok) return bad(q.error);
    if (!(q.total > 0)) return bad("Raise at least one number.");
    return {
      ok: true, quote: q,
      label: `More for ${plan.name || plan.id}`,
      row: { kind, plan: plan.id, billing_cycle: q.cycle, amount: q.total, byok: q.byok, custom_limits: q.custom },
    };
  }

  const plan = plans[body.plan];
  if (!plan) return bad("Invalid plan");
  if (!planFitsBusiness(plan, client.business_type)) {
    return bad(client.business_type === "agency"
      ? "That package is for online shops. Choose one of the service packages."
      : "That package is for service businesses. Choose one of the shop packages.");
  }
  const q = quotePlan({ plan, cycle: body.cycle || "monthly", byok: !!body.byok, custom: body.custom || {}, units, plans });
  if (!q.ok) return bad(q.error);
  return {
    ok: true, quote: q,
    label: `${plan.name || plan.id}${q.byok ? " (own AI key)" : ""}${Object.keys(q.custom).length ? " · your numbers" : ""}`,
    row: { kind, plan: plan.id, billing_cycle: q.cycle, amount: q.total, byok: q.byok, custom_limits: q.custom },
  };
}
