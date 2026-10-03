// What a purchase costs. Pure, no imports, so the dashboard, the payment routes
// and the approval step all price a basket the same way, and tests/t-pricing.mjs
// can check it.
//
// A basket is (owner, 2026-10-04):
//   · a package (a `plans` row) — its numbers are the starting point,
//   · Standard (our AI) or BYOK (the customer's own AI key). BYOK is HALF the
//     Standard price: the package's own byok_monthly, and half of every change
//     below (BYOK_SHARE),
//   · monthly or yearly (ten months' price, two free),
//   · the package's countable allowances RAISED with a slider — bot replies a
//     month, products (shops), knowledge files (services) and AI Assistant
//     questions a month. Each moves in fixed steps (50 replies, 50 products,
//     5 files, 50 questions) and each step has a price (`plan_units`).
//     Everything else is the same in every package, so it is not priced.
//
// Only up, never down (owner, 2026-10-04: "there will be no option to reduce
// anywhere"): a slider starts at the package's own number. And never close to
// the next package: it goes at most HALF the way to the next package's number
// (MAX_GAP_SHARE), the biggest package at most +50% (TOP_RAISE). With the
// step prices that keeps a fully raised package at about 75–82% of the next
// package's price for half of what it adds — upgrading stays the better deal.
//
// Raising in the middle of a running package (a "top-up") costs the difference
// for the days that are left (prorate).
//
// The browser never sends a price. It sends a package id and the changes; the
// server prices them with this file.

export const YEARLY_MULTIPLIER = 10;
export const CYCLE_DAYS = { monthly: 30, yearly: 365 };
export const BYOK_SHARE = 0.5;
export const MAX_GAP_SHARE = 0.5;
export const TOP_RAISE = 0.5;
export const BETTER_AT = 0.7;

// Which limit (a `plans` column) each slider moves.
export const UNIT_LIMIT = {
  replies: "messages_per_month",
  products: "max_products",
  docs: "max_kb_files",
  assistant: "max_assistant_per_month",
};
export const UNIT_KINDS = Object.keys(UNIT_LIMIT);

// The built-in step prices, used only if the plan_units table cannot be read —
// the same rows the 2026-10-04 migration seeded. Shop Basic with every slider at
// its top is ৳4,499 against Shop Pro's ৳5,999.
export const UNIT_DEFAULTS = [
  { kind: "replies", name: "Bot replies a month", step: 50, price: 40, biz: "both", active: true, sort: 1 },
  { kind: "products", name: "Products", step: 50, price: 50, biz: "ecommerce", active: true, sort: 2 },
  { kind: "docs", name: "Knowledge files", step: 5, price: 50, biz: "agency", active: true, sort: 3 },
  { kind: "assistant", name: "AI Assistant questions a month", step: 50, price: 50, biz: "both", active: true, sort: 4 },
];

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
export const validCycle = (c) => c === "monthly" || c === "yearly";
const isPaid = (p) => num(p?.monthly) > 0;

// May a business of this type buy this package? A shop's package sells a
// catalogue a service has no use for, and the other way round. "both" (the
// trial) and a package with no type fit everyone.
export function planFitsBusiness(plan, businessType) {
  const biz = plan?.biz;
  if (!biz || biz === "both") return true;
  return biz === (businessType || "ecommerce");
}

// Does this package have an own-key price at all?
export function hasByokPrice(plan) {
  return num(plan?.byok_monthly) > 0;
}

// The package's own price for a full period, or null when that option does not exist.
export function planPrice(plan, { cycle = "monthly", byok = false } = {}) {
  if (!plan || !validCycle(cycle)) return null;
  if (byok) {
    if (!hasByokPrice(plan)) return null;
    // A yearly own-key price set by hand wins; otherwise ten months.
    if (cycle === "yearly") return num(plan.byok_yearly) > 0 ? num(plan.byok_yearly) : num(plan.byok_monthly) * YEARLY_MULTIPLIER;
    return num(plan.byok_monthly);
  }
  const monthly = num(plan.monthly);
  if (!(monthly > 0)) return null;
  if (cycle === "yearly") return num(plan.yearly) > 0 ? num(plan.yearly) : monthly * YEARLY_MULTIPLIER;
  return monthly;
}

// Half the Standard price, the owner's rule for own-key packages (2026-10-04),
// rounded down to a whole taka: 2,699 → 1,349.
export function byokFromStandard(standard) {
  const n = num(standard);
  return n > 0 ? Math.floor(n * BYOK_SHARE) : null;
}

// The paid packages of one business type, cheapest first — the ladder a
// slider runs along.
export function ladderFor(plans, biz) {
  return (Array.isArray(plans) ? plans : Object.values(plans || {}))
    .filter((p) => p && isPaid(p) && p.active !== false && (p.biz || "both") === (biz || "both"))
    .sort((a, b) => num(a.monthly) - num(b.monthly));
}

// The step prices this business may use, in display order.
export function unitsForBiz(units, biz) {
  return (units || [])
    .filter((u) => u && u.active !== false && UNIT_LIMIT[u.kind] && (u.biz === "both" || !biz || u.biz === biz))
    .sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0));
}

// One slider per countable allowance of this package:
//   { kind, name, step, price, limit, base, min, max }
// `min` is always 0 (the package's own number); `max` is the raise allowed,
// always a whole number of steps. A package that does not count something (a
// shop's knowledge files, an unlimited allowance) has no slider for it.
export function slidersFor(plan, { units = UNIT_DEFAULTS, plans = [] } = {}) {
  if (!plan || !isPaid(plan)) return [];
  const biz = plan.biz && plan.biz !== "both" ? plan.biz : null;
  const ladder = ladderFor(plans, plan.biz || "both");
  const at = ladder.findIndex((p) => p.id === plan.id);
  const above = at >= 0 && at < ladder.length - 1 ? ladder[at + 1] : null;
  const out = [];
  for (const u of unitsForBiz(units, biz)) {
    const limit = UNIT_LIMIT[u.kind];
    const base = num(plan[limit]);
    const step = Math.round(num(u.step));
    if (!(base > 0) || !(step > 0) || !(num(u.price) >= 0)) continue;
    const room = above && num(above[limit]) > base ? (num(above[limit]) - base) * MAX_GAP_SHARE : base * TOP_RAISE;
    const max = Math.floor(room / step) * step;
    if (!(max > 0)) continue;
    const min = 0;
    out.push({ kind: u.kind, name: u.name || u.kind, step, price: num(u.price), limit, base, min, max });
  }
  return out;
}

// Turn what the browser sent into { kind: change } this package allows. Anything
// unknown, off a step, or outside the range is refused, never quietly fixed — a
// refused basket is a clear error, a changed one is a customer charged for
// something they did not pick. Zero changes are left out.
export function cleanCustom(custom, sliders) {
  const out = {};
  const byKind = Object.fromEntries((sliders || []).map((s) => [s.kind, s]));
  for (const [kind, raw] of Object.entries(custom || {})) {
    const d = Number(raw);
    if (d === 0) continue;
    const s = byKind[kind];
    if (!s) return { ok: false, error: `This package cannot change "${kind}".` };
    if (!Number.isInteger(d) || d % s.step !== 0) return { ok: false, error: `${s.name} moves in steps of ${s.step}.` };
    if (d < 0) return { ok: false, error: `${s.name} can only go up from the package's ${s.base}.` };
    if (d < s.min || d > s.max) return { ok: false, error: `${s.name} can go from ${s.base + s.min} to ${s.base + s.max} on this package.` };
    out[kind] = d;
  }
  return { ok: true, custom: out };
}

// What one slider's raise costs for a full month at the Standard price.
export function changeMonthly(slider, change) {
  const d = Number(change) || 0;
  if (!slider || !(d > 0)) return 0;
  return (d / slider.step) * slider.price;
}

// All changes together for one period, Standard or own key, in whole taka.
function changesFor(sliders, custom, { cycle, byok }) {
  const lines = [];
  for (const s of sliders) {
    const d = Number(custom?.[s.kind]) || 0;
    if (!d) continue;
    let amount = changeMonthly(s, d) * (byok ? BYOK_SHARE : 1);
    if (cycle === "yearly") amount *= YEARLY_MULTIPLIER;
    lines.push({ type: "change", kind: s.kind, name: s.name, change: d, to: s.base + d, amount: Math.round(amount) });
  }
  return lines;
}

// The resulting numbers: { messages_per_month: 2500, max_products: 450, ... }
export function limitsAfter(sliders, custom = {}) {
  const out = {};
  for (const s of sliders || []) out[s.limit] = s.base + (Number(custom?.[s.kind]) || 0);
  return out;
}

// The price of a whole package purchase or renewal.
//   → { ok:true, total, lines, custom, byok, cycle, sliders, limits, better }
//   → { ok:false, error }
// `better` names the next package up once this basket costs 70% of it, so the
// screen can suggest it.
export function quotePlan({ plan, cycle = "monthly", byok = false, custom = {}, units = UNIT_DEFAULTS, plans = [] } = {}) {
  if (!plan || plan.active === false || !isPaid(plan)) return { ok: false, error: "Invalid plan" };
  if (!validCycle(cycle)) return { ok: false, error: "Invalid billing cycle" };
  const base = planPrice(plan, { cycle, byok: !!byok });
  if (base === null) return { ok: false, error: byok ? "This package has no own-key (BYOK) option." : "Invalid plan" };
  const sliders = slidersFor(plan, { units, plans });
  const c = cleanCustom(custom, sliders);
  if (!c.ok) return c;
  const lines = [{ type: "plan", id: plan.id, name: plan.name || plan.id, amount: base }, ...changesFor(sliders, c.custom, { cycle, byok: !!byok })];
  const total = Math.max(0, lines.reduce((n, l) => n + l.amount, 0));
  const ladder = ladderFor(plans, plan.biz || "both");
  const next = ladder[ladder.findIndex((p) => p.id === plan.id) + 1] || null;
  const nextPrice = next ? planPrice(next, { cycle, byok: !!byok }) : null;
  // Raised far enough that the next package is within reach: say so, with how
  // much more it costs (BETTER_AT of its price).
  const better = next && nextPrice !== null && Object.keys(c.custom).length && total >= nextPrice * BETTER_AT
    ? { id: next.id, name: next.name || next.id, price: nextPrice, more: Math.max(0, nextPrice - total) } : null;
  return { ok: true, total, lines, custom: c.custom, byok: !!byok, cycle, sliders, limits: limitsAfter(sliders, c.custom), better };
}

// Whole days left before expiry, rounded UP — a customer with 3.2 days left has
// four days of use left to pay for, not three.
export function daysLeft(expiresAt, now = Date.now()) {
  const end = new Date(expiresAt).getTime();
  if (!Number.isFinite(end) || end <= now) return 0;
  return Math.ceil((end - now) / 86400000);
}

// The share of a full-period price for the days that are left, in whole taka
// (rounded up), and never more than the full price.
export function prorate(fullPrice, left, cycle = "monthly") {
  const days = CYCLE_DAYS[cycle] || CYCLE_DAYS.monthly;
  if (!(fullPrice > 0) || !(left > 0)) return 0;
  return Math.min(fullPrice, Math.ceil((fullPrice * Math.min(left, days)) / days));
}

// Raising allowances in the middle of a running paid package.
//   client: { plan, plan_expires_at, byok_plan, billing_cycle, custom_limits }
//   custom: the NEW full set of changes (not the difference). Every number
//           must be at least what the client has now — lowering waits for
//           the renewal.
export function quoteTopUp({ client, plan, custom = {}, units = UNIT_DEFAULTS, plans = [], now = Date.now() } = {}) {
  if (!client || !plan || !isPaid(plan)) return { ok: false, error: "Choose a package first." };
  const left = daysLeft(client.plan_expires_at, now);
  if (!left) return { ok: false, error: "Your package has ended. Renew it, and choose the new numbers with it." };
  const cycle = validCycle(client.billing_cycle) ? client.billing_cycle : "monthly";
  const byok = !!client.byok_plan;
  const sliders = slidersFor(plan, { units, plans });
  const current = cleanCustom(client.custom_limits || {}, sliders);
  const now_ = current.ok ? current.custom : {};
  const c = cleanCustom(custom, sliders);
  if (!c.ok) return c;
  let raised = false;
  for (const s of sliders) {
    const was = Number(now_[s.kind]) || 0, to = Number(c.custom[s.kind]) || 0;
    if (to < was) return { ok: false, error: `${s.name} can only go down when you renew.` };
    if (to > was) raised = true;
  }
  if (!raised) return { ok: false, error: "Raise at least one number." };
  const before = changesFor(sliders, now_, { cycle, byok });
  const after = changesFor(sliders, c.custom, { cycle, byok });
  const sum = (ls, kind) => ls.filter((l) => l.kind === kind).reduce((n, l) => n + l.amount, 0);
  const lines = [];
  for (const s of sliders) {
    const full = sum(after, s.kind) - sum(before, s.kind);
    const was = Number(now_[s.kind]) || 0, to = Number(c.custom[s.kind]) || 0;
    if (to === was) continue;
    lines.push({ type: "change", kind: s.kind, name: s.name, change: to - was, to: s.base + to, full, amount: prorate(full, left, cycle) });
  }
  const total = lines.reduce((n, l) => n + l.amount, 0);
  return { ok: true, total, lines, custom: c.custom, byok, cycle, daysLeft: left, sliders, limits: limitsAfter(sliders, c.custom) };
}

// A package's limit with the client's change applied. Unlimited (null) stays
// unlimited; a limit never goes below zero.
export function withChange(limit, change) {
  if (limit === null || limit === undefined) return limit ?? null;
  return Math.max(0, Number(limit) + (Number(change) || 0));
}

// { messages_per_month: +500, max_products: -50 } from { replies: 500, products: -50 }
export function changesByLimit(custom = {}) {
  const out = {};
  for (const [kind, d] of Object.entries(custom || {})) {
    const key = UNIT_LIMIT[kind];
    if (key && Number(d)) out[key] = Number(d);
  }
  return out;
}
