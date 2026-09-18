// Single source of truth for pricing. Used by the public pricing page,
// the dashboard billing screen and the server-side billing API.

export const CURRENCY = "\u09F3"; // ৳

// How long the free trial runs, when nobody has said otherwise. It was written
// as `3 * 24 * 3600 * 1000` inside the start_trial handler and nowhere else, so
// the admin panel had no way to say what a "per month" box means on a plan that
// lasts three days. The owner now sets it in the panel — see trialDays() in
// plan-limits.js — and this is the fallback for a value nobody has stored yet.
export const TRIAL_DAYS = 3;

// One day is the shortest trial that means anything. Ninety stops a slipped
// key turning a free trial into a free quarter for everyone who signs up
// before somebody notices.
export const MIN_TRIAL_DAYS = 1;
export const MAX_TRIAL_DAYS = 90;

// Anything at all → a usable number of days. A value nobody has set, or one
// that is not a number, falls back rather than throwing: a trial that cannot
// work out its own length must still start.
//
// Unset is checked BEFORE the arithmetic, because Number(null) and Number("")
// are both 0, and 0 clamps to the shortest trial there is. A cleared box would
// have quietly become a one-day trial instead of returning to the default.
export const clampTrialDays = (v) => {
  if (v === null || v === undefined || String(v).trim() === "") return TRIAL_DAYS;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return TRIAL_DAYS;
  return Math.min(MAX_TRIAL_DAYS, Math.max(MIN_TRIAL_DAYS, n));
};

// The two kinds of business this platform serves. A package belongs to one of
// them, or to "both" — which is what the free trial is, because somebody
// trying the product has not chosen yet.
//
// The word "agency" used to name BOTH the top tier and one of these, so
// "the agency package for an agency" meant two different things depending on
// who was reading. The tiers are Starter / Growth / Scale on each side now,
// and "agency" only ever means the business type.
export const BIZ = { ecommerce: "Shop", agency: "Services" };

// Features that only make sense on one side, so a package never advertises
// something the dashboard will not show. A shop matches photos against a
// catalogue and takes orders; a service answers from documents and books time.
export const BIZ_FEATURES = {
  ecommerce: ["vision"],
  agency: ["calendar", "kb"],
};

export const PLANS = {
  // Two sets of three, one per business type (owner's rule, 2026-09-19: "there
  // are two types, ecommerce and agency, so there will be two types of
  // packages"), plus one trial for both. Every package carries every feature;
  // what separates them is SIZE. A shop is sized by products added, a service
  // by knowledge documents added — and a service costs less because there is no
  // catalogue for the AI to read. Each set has its own BYOK price list.
  trial: {
    id: "trial",
    biz: "both",
    name: "Free Trial",
    tagline: "Every feature, for three days",
    monthly: 0,
    yearly: 0,
    messagesPerDay: 30,
    messagesPerMonth: null,
    channels: 1,
    highlight: false,
    features: [
      "Every feature switched on",
      "30 bot replies a day (about 5-6 customers)",
      "1 channel of your choice",
      "20 products or 2 documents",
      "30 AI Assistant questions",
      "No card needed",
    ],
  },


  // ── Shops (ecommerce) ──
  shop_basic: {
    id: "shop_basic",
    biz: "ecommerce",
    name: "Shop Basic",
    tagline: "One or two pages, your catalogue answering all day",
    monthly: 2699,
    yearly: 26990,
    byokMonthly: 1999,
    byokYearly: 19990,
    messagesPerDay: null,
    messagesPerMonth: 2000,
    channels: 2,
    highlight: false,
    features: [
      "2,000 bot replies / month",
      "2 channels + website widget",
      "500 products added / month",
      "100 AI Assistant questions / month",
      "Every feature — nothing is held back",
    ],
  },

  shop_pro: {
    id: "shop_pro",
    biz: "ecommerce",
    name: "Shop Pro",
    tagline: "Every channel, a full catalogue",
    monthly: 5999,
    yearly: 59990,
    byokMonthly: 4499,
    byokYearly: 44990,
    messagesPerDay: null,
    messagesPerMonth: 5500,
    channels: 3,
    highlight: true,
    features: [
      "5,500 bot replies / month",
      "All 3 channels + website widget",
      "1,000 products added / month",
      "400 AI Assistant questions / month",
      "Every feature — nothing is held back",
    ],
  },

  shop_enterprise: {
    id: "shop_enterprise",
    biz: "ecommerce",
    name: "Shop Enterprise",
    tagline: "The most of everything, and room to fit your shop",
    monthly: 11999,
    yearly: 119990,
    byokMonthly: 8999,
    byokYearly: 89990,
    messagesPerDay: null,
    messagesPerMonth: 12000,
    channels: 3,
    highlight: false,
    features: [
      "12,000 bot replies / month",
      "All 3 channels + website widget",
      "2,500 products added / month",
      "800 AI Assistant questions / month",
      "Priority support",
      "Need more? We set your limits to fit",
    ],
  },

  // ── Services (agency) — no product catalogue to read, so a lower price ──
  svc_basic: {
    id: "svc_basic",
    biz: "agency",
    name: "Service Basic",
    tagline: "One or two pages, answering from your own documents",
    monthly: 2299,
    yearly: 22990,
    byokMonthly: 1699,
    byokYearly: 16990,
    messagesPerDay: null,
    messagesPerMonth: 2000,
    channels: 2,
    highlight: false,
    features: [
      "2,000 bot replies / month",
      "2 channels + website widget",
      "20 knowledge documents added / month",
      "100 AI Assistant questions / month",
      "Every feature, Google Calendar booking included",
    ],
  },

  svc_pro: {
    id: "svc_pro",
    biz: "agency",
    name: "Service Pro",
    tagline: "Every channel, and meetings booked while you sleep",
    monthly: 4999,
    yearly: 49990,
    byokMonthly: 3499,
    byokYearly: 34990,
    messagesPerDay: null,
    messagesPerMonth: 5500,
    channels: 3,
    highlight: true,
    features: [
      "5,500 bot replies / month",
      "All 3 channels + website widget",
      "60 knowledge documents added / month",
      "400 AI Assistant questions / month",
      "Every feature, Google Calendar booking included",
    ],
  },

  svc_enterprise: {
    id: "svc_enterprise",
    biz: "agency",
    name: "Service Enterprise",
    tagline: "The most of everything, and room to fit your practice",
    monthly: 9999,
    yearly: 99990,
    byokMonthly: 7499,
    byokYearly: 74990,
    messagesPerDay: null,
    messagesPerMonth: 12000,
    channels: 3,
    highlight: false,
    features: [
      "12,000 bot replies / month",
      "All 3 channels + website widget",
      "150 knowledge documents added / month",
      "800 AI Assistant questions / month",
      "Priority support",
      "Need more? We set your limits to fit",
    ],
  },
};

// Every package a business of this type may buy, cheapest first. The trial is
// left out: it is not something anyone chooses from a price list.
export const plansFor = (biz) =>
  PLAN_ORDER
    .filter((id) => id !== "trial" && (PLANS[id].biz === "both" || PLANS[id].biz === biz))
    .map((id) => PLANS[id]);

// Cheapest first, the trial ahead of them all.
export const PLAN_ORDER = ["trial", "shop_basic", "shop_pro", "shop_enterprise", "svc_basic", "svc_pro", "svc_enterprise"];

// Anything that is not the trial and is not "no plan". Kept as a list because
// messageAllowance() uses it as one of two ways to recognise a live package —
// the other being a package the owner created in the panel, which will never
// appear here. The retired ids (basic/pro/enterprise "both", and the 2026-08-31
// shop_/svc_ starter/growth/scale set) were removed on 2026-09-19 after every
// account on them was moved to a current package.
export const PAID_PLANS = [
  "shop_basic", "shop_pro", "shop_enterprise",
  "svc_basic", "svc_pro", "svc_enterprise",
];

export function planOf(id) {
  return PLANS[id] || null;
}

export function priceOf(planId, cycle = "monthly") {
  const p = PLANS[planId];
  if (!p) return 0;
  return cycle === "yearly" ? p.yearly : p.monthly;
}

// Yearly is billed as 10 months — two months free.
export function yearlySavingMonths(planId) {
  const p = PLANS[planId];
  if (!p || !p.monthly) return 0;
  return Math.round((p.monthly * 12 - p.yearly) / p.monthly);
}

// ── BYOK pricing ────────────────────────────────────────────────────────────
// A client running on their OWN AI key covers their own AI cost, so every paid
// package carries a second, lower price for them. It applies ONLY while the
// client actually has a saved own key (see clientHasOwnKey); with no key, or on
// a package that sets no BYOK price, they pay the standard price.
//
// A plan object reaches these two ways: the code constant uses camelCase
// (byokMonthly/byokYearly) and a `plans` table row uses snake_case
// (byok_monthly/byok_yearly). Both are read so the same helper serves every
// caller, and 0/blank/unset all mean "no BYOK price for this package".
const numOrNull = (v) => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// { std, byok } for a plan + cycle. std is always a number; byok is a number
// only when the package sets a real (> 0) BYOK price, else null.
export function planPrices(plan, cycle = "monthly") {
  const yearly = cycle === "yearly";
  const std = yearly ? numOrNull(plan?.yearly) : numOrNull(plan?.monthly);
  const byokRaw = yearly
    ? (plan?.byokYearly ?? plan?.byok_yearly)
    : (plan?.byokMonthly ?? plan?.byok_monthly);
  const byok = numOrNull(byokRaw);
  return { std: std ?? 0, byok: byok && byok > 0 ? byok : null };
}

// The amount a client actually pays. ownKey clients get the BYOK price when the
// package sets one; everyone else, and any package with no BYOK price, pays the
// standard price. Never returns the BYOK price to a client without a key.
export function priceForClient(plan, cycle = "monthly", ownKey = false) {
  const { std, byok } = planPrices(plan, cycle);
  return ownKey && byok !== null ? byok : std;
}

export function formatMoney(n) {
  return CURRENCY + Number(n || 0).toLocaleString("en-IN");
}

// A plan is active when it has not expired. Legacy rows without an expiry stay active.
// A plan id that is neither the trial nor "no plan" is a paid package —
// INCLUDING one the owner created in the admin panel, which by definition can
// never appear in PAID_PLANS below. Testing that hard-coded list instead meant
// a custom package read as "no plan at all": the bot still replied (it resolves
// plans from the database), but broadcasts refused to send and follow-ups
// skipped with "plan_inactive", giving no reason anyone could see.
const NO_PLAN = ["", "none"];
export function planActive(client) {
  if (!client) return false;
  if (client.suspended) return false;
  const plan = String(client.plan || "").trim().toLowerCase();
  if (NO_PLAN.includes(plan)) return false;
  if (plan === "trial") return !!client.trial_end && new Date(client.trial_end) > new Date();
  if (!client.plan_expires_at) return true;
  return new Date(client.plan_expires_at) > new Date();
}
