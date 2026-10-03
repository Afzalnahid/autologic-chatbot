// What a purchase costs (owner, 2026-10-03). Pure, no imports, so the dashboard,
// the payment routes and the approval step all price a basket the same way, and
// tests/t-pricing.mjs can check it.
//
// A basket is:
//   · a package (a `plans` row),
//   · Standard (our AI) or BYOK (the customer's own AI key — every AI call runs
//     on their key, so the package costs less),
//   · monthly or yearly,
//   · optional add-ons from the `plan_addons` table: more bot replies, more
//     AI Assistant questions, more products (shops) or more documents
//     (services), each with a quantity.
//
// Yearly is ten months' price for the package (two free), and the same rule
// applies to add-ons. An add-on bought in the middle of a running package costs
// only the share of the period that is left (prorate), and from the next renewal
// it is part of the package at its full price.
//
// The client never sends a price. It sends ids and counts; the server prices them.

export const YEARLY_MULTIPLIER = 10;
export const CYCLE_DAYS = { monthly: 30, yearly: 365 };
export const MAX_ADDON_QTY = 10;

// Which limit each kind of add-on raises (column names of a `plans` row).
export const ADDON_LIMIT = { replies: "messages_per_month", products: "max_products", docs: "max_kb_files", assistant: "max_assistant_per_month" };

// The built-in add-on list, used only if the plan_addons table cannot be read —
// the same rows the 2026-10-03 migration seeded.
export const ADDON_DEFAULTS = [
  { id: "replies_100", name: "+100 bot replies", kind: "replies", amount: 100, biz: "both", monthly: 149, byok_monthly: 89, active: true, sort: 1 },
  { id: "replies_200", name: "+200 bot replies", kind: "replies", amount: 200, biz: "both", monthly: 279, byok_monthly: 169, active: true, sort: 2 },
  { id: "products_50", name: "+50 products", kind: "products", amount: 50, biz: "ecommerce", monthly: 99, byok_monthly: 59, active: true, sort: 3 },
  { id: "products_100", name: "+100 products", kind: "products", amount: 100, biz: "ecommerce", monthly: 179, byok_monthly: 109, active: true, sort: 4 },
  { id: "docs_5", name: "+5 documents", kind: "docs", amount: 5, biz: "agency", monthly: 99, byok_monthly: 59, active: true, sort: 5 },
  { id: "docs_10", name: "+10 documents", kind: "docs", amount: 10, biz: "agency", monthly: 179, byok_monthly: 109, active: true, sort: 6 },
  { id: "assistant_100", name: "+100 AI Assistant questions", kind: "assistant", amount: 100, biz: "both", monthly: 99, byok_monthly: 59, active: true, sort: 7 },
  { id: "assistant_200", name: "+200 AI Assistant questions", kind: "assistant", amount: 200, biz: "both", monthly: 179, byok_monthly: 109, active: true, sort: 8 },
];

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
export const validCycle = (c) => c === "monthly" || c === "yearly";

// Add-ons a business of this type may buy. "both" rows (replies) suit everyone.
export function addonsForBiz(addons, biz) {
  return (addons || [])
    .filter((a) => a && a.active !== false && (a.biz === "both" || !biz || a.biz === biz))
    .sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0));
}

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

// The package's price for a full period, or null when that option does not exist.
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

// One add-on for a full period. BYOK uses its own-key price when one is set.
export function addonPrice(addon, { cycle = "monthly", byok = false } = {}) {
  if (!addon || !validCycle(cycle)) return null;
  const monthly = byok && num(addon.byok_monthly) !== null ? num(addon.byok_monthly) : num(addon.monthly);
  if (monthly === null || monthly < 0) return null;
  return cycle === "yearly" ? monthly * YEARLY_MULTIPLIER : monthly;
}

// Turn what the browser sent into { id: qty } of add-ons this business may buy.
// Anything unknown, inactive, for the other business type, or with a silly
// count is refused, never silently dropped — a refused basket is a clear error,
// a quietly changed one is a customer charged for something they did not pick.
export function cleanPicks(picks, available) {
  const out = {};
  const byId = Object.fromEntries((available || []).map((a) => [a.id, a]));
  for (const [id, raw] of Object.entries(picks || {})) {
    const qty = Number(raw);
    if (qty === 0) continue;
    if (!byId[id]) return { ok: false, error: `That add-on (${id}) is not available for this package.` };
    if (!Number.isInteger(qty) || qty < 0 || qty > MAX_ADDON_QTY) return { ok: false, error: `Choose between 1 and ${MAX_ADDON_QTY} of each add-on.` };
    out[id] = qty;
  }
  return { ok: true, picks: out };
}

// The price of a whole package purchase or renewal.
//   → { ok:true, total, lines:[{ type, id, name, qty, unit, amount }], picks, byok, cycle }
//   → { ok:false, error }
export function quotePlan({ plan, cycle = "monthly", byok = false, picks = {}, addons = [] } = {}) {
  if (!plan || plan.active === false || !(num(plan.monthly) > 0)) return { ok: false, error: "Invalid plan" };
  if (!validCycle(cycle)) return { ok: false, error: "Invalid billing cycle" };
  const base = planPrice(plan, { cycle, byok: !!byok });
  if (base === null) return { ok: false, error: byok ? "This package has no own-key (BYOK) option." : "Invalid plan" };
  const available = addonsForBiz(addons, plan.biz === "both" ? null : plan.biz);
  const c = cleanPicks(picks, available);
  if (!c.ok) return c;
  const lines = [{ type: "plan", id: plan.id, name: plan.name || plan.id, qty: 1, unit: base, amount: base }];
  for (const [id, qty] of Object.entries(c.picks)) {
    const a = available.find((x) => x.id === id);
    const unit = addonPrice(a, { cycle, byok: !!byok });
    lines.push({ type: "addon", id, name: a.name || id, qty, unit, amount: unit * qty });
  }
  const total = lines.reduce((n, l) => n + l.amount, 0);
  return { ok: true, total, lines, picks: c.picks, byok: !!byok, cycle };
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

// Add-ons bought in the middle of a running paid package.
//   client: { plan, plan_expires_at, byok_plan, billing_cycle }
export function quoteTopUp({ client, plan, picks = {}, addons = [], now = Date.now() } = {}) {
  if (!client || !plan || !(num(plan.monthly) > 0)) return { ok: false, error: "Add-ons need a paid package. Choose a package first." };
  const left = daysLeft(client.plan_expires_at, now);
  if (!left) return { ok: false, error: "Your package has ended. Renew it, and add these with it." };
  const cycle = validCycle(client.billing_cycle) ? client.billing_cycle : "monthly";
  const byok = !!client.byok_plan;
  const available = addonsForBiz(addons, plan.biz === "both" ? null : plan.biz);
  const c = cleanPicks(picks, available);
  if (!c.ok) return c;
  if (!Object.keys(c.picks).length) return { ok: false, error: "Choose at least one add-on." };
  const lines = [];
  for (const [id, qty] of Object.entries(c.picks)) {
    const a = available.find((x) => x.id === id);
    const full = addonPrice(a, { cycle, byok }) * qty;
    lines.push({ type: "addon", id, name: a.name || id, qty, full, amount: prorate(full, left, cycle) });
  }
  const total = lines.reduce((n, l) => n + l.amount, 0);
  return { ok: true, total, lines, picks: c.picks, byok, cycle, daysLeft: left };
}

// { replies_100: 2 } + { replies_100: 1, docs_5: 1 } → { replies_100: 3, docs_5: 1 }
export function mergePicks(a = {}, b = {}) {
  const out = { ...a };
  for (const [id, qty] of Object.entries(b || {})) out[id] = (Number(out[id]) || 0) + (Number(qty) || 0);
  for (const id of Object.keys(out)) if (!(out[id] > 0)) delete out[id];
  return out;
}

// How much each limit grows: { messages_per_month: 300, max_products: 50, ... }
export function addonExtras(picks = {}, addons = []) {
  const out = {};
  const byId = Object.fromEntries((addons || []).map((a) => [a.id, a]));
  for (const [id, qty] of Object.entries(picks || {})) {
    const a = byId[id];
    const key = a && ADDON_LIMIT[a.kind];
    if (!key || !(qty > 0)) continue;
    out[key] = (out[key] || 0) + Number(a.amount) * Number(qty);
  }
  return out;
}

// A limit plus what the add-ons give. Unlimited (null) stays unlimited.
export function withExtra(limit, extra) {
  if (limit === null || limit === undefined) return limit ?? null;
  return Number(limit) + (Number(extra) || 0);
}
