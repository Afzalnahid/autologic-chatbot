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

export const PLANS = {
  trial: {
    id: "trial",
    name: "Free Trial",
    tagline: "Try everything for 3 days",
    monthly: 0,
    yearly: 0,
    messagesPerDay: 30,
    messagesPerMonth: null,
    channels: 1,
    highlight: false,
    features: [
      "3 days full access",
      "30 customer messages per day",
      "1 channel (Facebook, Instagram or WhatsApp)",
      "AI replies in Bangla & English",
      "Live conversation inbox",
    ],
  },
  starter: {
    id: "starter",
    name: "Starter",
    tagline: "For small shops getting started",
    monthly: 1500,
    yearly: 15000,
    messagesPerDay: null,
    messagesPerMonth: 3000,
    channels: 1,
    highlight: false,
    features: [
      "3,000 customer messages / month",
      "1 channel of your choice",
      "AI replies in Bangla & English",
      "Product catalogue & order collection",
      "Live conversation inbox",
      "Analytics dashboard",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "For growing businesses",
    monthly: 3500,
    yearly: 35000,
    messagesPerDay: null,
    messagesPerMonth: 15000,
    channels: 3,
    highlight: true,
    features: [
      "15,000 customer messages / month",
      "All 3 channels — Facebook, Instagram, WhatsApp",
      "Photo product matching (Vision AI)",
      "Knowledge Base with document upload",
      "Voice message understanding",
      "Everything in Starter",
    ],
  },
  agency: {
    id: "agency",
    name: "Agency",
    tagline: "For service providers & agencies",
    monthly: 6000,
    yearly: 60000,
    messagesPerDay: null,
    messagesPerMonth: null,
    channels: 99,
    highlight: false,
    features: [
      "Unlimited customer messages",
      "Google Calendar meeting booking",
      "Automatic Google Meet links",
      "Knowledge Base for your services",
      "Priority support",
      "Everything in Pro",
    ],
  },
};

export const PAID_PLANS = ["starter", "pro", "agency"];
export const PLAN_ORDER = ["trial", "starter", "pro", "agency"];

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
