// What the platform earned, and what it merely expected to earn.
//
// Until 2026-09-18 the admin panel had one number called "Revenue", and it was
// neither: it read the `plan` column of every client and multiplied by the
// package price. So it counted a plan that expired last week, an account
// comped to 2029 that was never going to pay, and a suspended one — and on a
// platform where NOT ONE payment had ever been recorded it reported ৳8,500 a
// month. A number that confident and that wrong is worse than a blank.
//
// Two different questions, so two different numbers:
//
//   BILLED   what the active paid packages are worth over this window. It is
//            an expectation, and it is honest as long as it only counts days a
//            package was actually live for somebody who is actually charged.
//   RECEIVED what verified payments actually brought in. This is money.
//
// Everything here is pure arithmetic over rows handed in — no database, so it
// is unit-tested (tests/t-revenue.mjs) and the same rules can be read by any
// screen that needs them.

const ms = (v) => { const t = Date.parse(v); return Number.isFinite(t) ? t : null; };
const DAY = 86400000;

// The reasons a client contributes nothing. Ordered: the first that applies is
// the one reported, and each is written to be shown to the owner as-is.
export const NO_REVENUE = {
  internal: "Internal account — excluded on purpose",
  suspended: "Suspended",
  no_plan: "No paid package",
  trial: "On the free trial",
  expired_before: "Package expired before this window",
  free: "Package price is zero",
};

// One client's BILLED revenue over [from, to].
//
// `plan` is the row from the plans table (or null). `ownKey` true when the
// client runs on their own AI key, which is a LOWER price — the old figure
// always used the standard one, so a BYOK client was over-counted by the whole
// discount the package offers them.
//
// Days are counted, not assumed: a package that expires on the 19th earns for
// the days up to the 19th and nothing after. A month is treated as 30 days,
// which is the convention the rest of the panel uses.
export function clientRevenue(client = {}, plan = null, { from, to, ownKey = false } = {}) {
  const startMs = ms(from), endMs = ms(to);
  if (startMs === null || endMs === null || endMs <= startMs) return zero("no_plan");

  if (client.internal) return zero("internal");
  if (client.suspended) return zero("suspended");

  const id = String(client.plan || "").trim().toLowerCase();
  if (!id || id === "none") return zero("no_plan");
  if (id === "trial") return zero("trial");
  if (!plan) return zero("no_plan");

  // The price this client is actually charged.
  const monthly = ownKey && Number(plan.byok_monthly) > 0 ? Number(plan.byok_monthly) : Number(plan.monthly) || 0;
  if (monthly <= 0) return zero("free");

  // The part of the window the package was live for. No start date is stored,
  // so the package is taken to have been live from the start of the window —
  // the expiry is the end that actually exists and the one that was ignored.
  const expiry = ms(client.plan_expires_at);
  const liveEnd = expiry === null ? endMs : Math.min(endMs, expiry);
  if (liveEnd <= startMs) return zero("expired_before");

  const days = (liveEnd - startMs) / DAY;
  const whole = (endMs - startMs) / DAY;
  return {
    bdt: (monthly / 30) * days,
    days,
    windowDays: whole,
    monthly,
    ownKey: !!(ownKey && Number(plan.byok_monthly) > 0),
    // True when the package ran out part-way through, so the panel can say why
    // this client is worth less than a full window of their price.
    partial: days < whole - 0.01,
    reason: null,
  };

  function zero(why) {
    return { bdt: 0, days: 0, windowDays: endMs !== null && startMs !== null ? (endMs - startMs) / DAY : 0, monthly: 0, ownKey: false, partial: false, reason: why };
  }
}

// Money that actually arrived in the window.
//
// Only an APPROVED request counts, and it counts on the day it was approved or
// paid — not the day it was submitted, because a request sitting in the queue
// is not income. A request with no usable date falls back to when it was
// created rather than being dropped: losing real money from the total is worse
// than dating it a day early.
export function receivedRevenue(payments = [], { from, to } = {}) {
  const startMs = ms(from), endMs = ms(to);
  let bdt = 0, count = 0;
  for (const p of payments || []) {
    if (String(p?.status || "").toLowerCase() !== "approved") continue;
    const at = ms(p.paid_at) ?? ms(p.reviewed_at) ?? ms(p.created_at);
    if (at === null) continue;
    if (startMs !== null && at < startMs) continue;
    if (endMs !== null && at > endMs) continue;
    const amount = Number(p.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    bdt += amount; count += 1;
  }
  return { bdt, count };
}

// The whole platform, in one pass: what is billed, what came in, and WHY the
// two differ — which is the thing a single "Revenue" number can never say.
export function revenueSummary(clients = [], plans = {}, payments = [], { from, to } = {}) {
  let billed = 0;
  const excluded = {};
  const rows = [];
  for (const c of clients || []) {
    const r = clientRevenue(c, plans[c?.plan] || null, { from, to, ownKey: !!c?.own_key });
    billed += r.bdt;
    if (r.reason) excluded[r.reason] = (excluded[r.reason] || 0) + 1;
    rows.push({ client_id: c?.id || c?.client_id || null, ...r });
  }
  const received = receivedRevenue(payments, { from, to });
  return {
    billed,
    received: received.bdt,
    payments: received.count,
    // Billed but not collected. Positive is money owed; it is not profit.
    outstanding: billed - received.bdt,
    excluded,
    rows,
  };
}
