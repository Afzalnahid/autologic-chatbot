// What a payment request is for, and what it costs — read from the browser's
// choice, priced on the server. Both ways to pay (manual bKash/Nagad/Rocket in
// /api/billing and online in /api/billing/checkout) call this, so they cannot
// price the same basket differently. The arithmetic is lib/pricing.js (pure);
// this file only loads the live catalogue and the client's current package.
//
// The browser sends:
//   { kind: "plan",  plan, cycle, byok, addons: { id: qty } }   buy / renew a package
//   { kind: "addon", addons: { id: qty } }                       add-ons mid-period
// It never sends an amount.
import { loadPlans, loadAddons } from "@/lib/plan-limits.js";
import { quotePlan, quoteTopUp, planFitsBusiness } from "@/lib/pricing.js";
import { planActive } from "@/lib/plans.js";

const bad = (error, status = 400) => ({ ok: false, error, status });

// → { ok:true, row: { kind, plan, billing_cycle, amount, byok, addons }, label, quote }
// → { ok:false, error, status }
export async function priceBasket(client, body = {}) {
  const [plans, addons] = await Promise.all([loadPlans(), loadAddons()]);
  const kind = body.kind === "addon" ? "addon" : "plan";

  if (kind === "addon") {
    const plan = plans[client.plan];
    if (!plan || !(Number(plan.monthly) > 0) || !planActive(client)) {
      return bad("Add-ons go on top of a running paid package. Choose a package first — you can add them to it.");
    }
    const q = quoteTopUp({ client, plan, picks: body.addons || {}, addons });
    if (!q.ok) return bad(q.error);
    if (!(q.total > 0)) return bad("Choose at least one add-on.");
    return {
      ok: true, quote: q,
      label: `Add-ons for ${plan.name || plan.id}`,
      row: { kind, plan: plan.id, billing_cycle: q.cycle, amount: q.total, byok: q.byok, addons: q.picks },
    };
  }

  const plan = plans[body.plan];
  if (!plan) return bad("Invalid plan");
  if (!planFitsBusiness(plan, client.business_type)) {
    return bad(client.business_type === "agency"
      ? "That package is for online shops. Choose one of the service packages."
      : "That package is for service businesses. Choose one of the shop packages.");
  }
  const q = quotePlan({ plan, cycle: body.cycle || "monthly", byok: !!body.byok, picks: body.addons || {}, addons });
  if (!q.ok) return bad(q.error);
  return {
    ok: true, quote: q,
    label: `${plan.name || plan.id}${q.byok ? " (own AI key)" : ""}`,
    row: { kind, plan: plan.id, billing_cycle: q.cycle, amount: q.total, byok: q.byok, addons: q.picks },
  };
}
