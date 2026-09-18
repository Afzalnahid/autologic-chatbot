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
  // ── Free, and the same whichever business you are ─────────────────────────
  trial: {
    id: "trial",
    biz: "both",
    name: "Free Trial",
    tagline: "Every feature, for a few days",
    monthly: 0,
    yearly: 0,
    messagesPerDay: 30,
    messagesPerMonth: null,
    channels: 1,
    highlight: false,
    features: [
      "Every feature switched on",
      "30 bot replies a day (about 5-6 customers)",
      "1 channel (Facebook, Instagram or WhatsApp)",
      "20 products or 2 documents",
      "No card needed",
    ],
  },

  // ── Shops ────────────────────────────────────────────────────────────────
  shop_starter: {
    id: "shop_starter",
    biz: "ecommerce",
    name: "Shop Starter",
    tagline: "One channel, your whole catalogue answering for itself",
    monthly: 1500,
    yearly: 15000,
    byokMonthly: 1000,
    byokYearly: 10000,
    messagesPerDay: null,
    messagesPerMonth: 3000,
    channels: 1,
    highlight: false,
    features: [
      "3,000 bot replies / month",
      "1 channel of your choice",
      "300 products",
      "20 website imports, 4 broadcasts a month",
      "Every feature — nothing is held back",
    ],
  },
  shop_growth: {
    id: "shop_growth",
    biz: "ecommerce",
    name: "Shop Growth",
    tagline: "Every channel, five times the replies",
    monthly: 3500,
    yearly: 35000,
    byokMonthly: 2500,
    byokYearly: 25000,
    messagesPerDay: null,
    messagesPerMonth: 15000,
    channels: 3,
    highlight: true,
    features: [
      "15,000 bot replies / month",
      "All 3 channels — Facebook, Instagram, WhatsApp",
      "3,000 products",
      "200 website imports, 20 broadcasts a month",
      "Every feature — nothing is held back",
    ],
  },
  shop_scale: {
    id: "shop_scale",
    biz: "ecommerce",
    name: "Shop Scale",
    tagline: "For a catalogue and a crowd that keep growing",
    monthly: 6000,
    yearly: 60000,
    byokMonthly: 4000,
    byokYearly: 40000,
    messagesPerDay: null,
    messagesPerMonth: 50000,
    channels: 3,
    highlight: false,
    features: [
      "50,000 bot replies / month",
      "All 3 channels — Facebook, Instagram, WhatsApp",
      "Unlimited products",
      "Unlimited website imports and broadcasts",
      "Priority support",
    ],
  },

  // ── Services ─────────────────────────────────────────────────────────────
  svc_starter: {
    id: "svc_starter",
    biz: "agency",
    name: "Service Starter",
    tagline: "One channel, answering from your own documents",
    monthly: 1500,
    yearly: 15000,
    byokMonthly: 1000,
    byokYearly: 10000,
    messagesPerDay: null,
    messagesPerMonth: 3000,
    channels: 1,
    highlight: false,
    features: [
      "3,000 bot replies / month",
      "1 channel of your choice",
      "10 knowledge documents",
      "20 website imports, 4 broadcasts a month",
      "Every feature — nothing is held back",
    ],
  },
  svc_growth: {
    id: "svc_growth",
    biz: "agency",
    name: "Service Growth",
    tagline: "Every channel, five times the replies",
    monthly: 3500,
    yearly: 35000,
    byokMonthly: 2500,
    byokYearly: 25000,
    messagesPerDay: null,
    messagesPerMonth: 15000,
    channels: 3,
    highlight: true,
    features: [
      "15,000 bot replies / month",
      "All 3 channels — Facebook, Instagram, WhatsApp",
      "40 knowledge documents",
      "200 website imports, 20 broadcasts a month",
      "Every feature — nothing is held back",
    ],
  },
  svc_scale: {
    id: "svc_scale",
    biz: "agency",
    name: "Service Scale",
    tagline: "For a practice that answers all day",
    monthly: 6000,
    yearly: 60000,
    byokMonthly: 4000,
    byokYearly: 40000,
    messagesPerDay: null,
    messagesPerMonth: 50000,
    channels: 3,
    highlight: false,
    features: [
      "50,000 bot replies / month",
      "All 3 channels — Facebook, Instagram, WhatsApp",
      "Unlimited knowledge documents",
      "Unlimited website imports and broadcasts",
      "Priority support",
    ],
  },
};

// Every package a business of this type may buy, cheapest first. The trial is
// left out: it is not something anyone chooses from a price list.
export const plansFor = (biz) =>
  PLAN_ORDER
    .filter((id) => id !== "trial" && (PLANS[id].biz === "both" || PLANS[id].biz === biz))
    .map((id) => PLANS[id]);

// Three tiers on each side, cheapest first, and the trial ahead of both.
export const PLAN_ORDER = [
  "trial",
  "shop_starter", "shop_growth", "shop_scale",
  "svc_starter", "svc_growth", "svc_scale",
];

// Anything that is not the trial and is not "no plan". Kept as a list because
// messageAllowance() uses it as one of two ways to recognise a live package —
// the other being a package the owner created in the panel, which will never
// appear here. The old ids stay so an account still on one keeps working until
// it is moved.
export const PAID_PLANS = [
  "shop_starter", "shop_growth", "shop_scale",
  "svc_starter", "svc_growth", "svc_scale",
  "starter", "pro", "agency",
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
