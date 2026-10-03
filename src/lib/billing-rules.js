// Which payment rows still count as "under review". Pure, so tests/t-billing-rules.mjs
// can check it. Its one import, pricing.js, is pure too.
//
// An online (SSLCommerz) checkout writes a pending row BEFORE the customer reaches
// the gateway. If they close the tab, cancel, or the card fails, nothing ever
// comes back to flip it, and that row used to stay "pending" for ever:
//   · the customer could never pay again ("You already have a payment under
//     review"), and
//   · it sat in the admin queue, where approving it gave a plan for money that
//     never arrived.
// So an online row that has not been confirmed within ONLINE_CHECKOUT_TTL_MIN is
// treated as abandoned. A manual bKash/Nagad/Rocket row is different: the money
// has (by the customer's word) been sent, and it waits for a person, however long
// that takes.

import { mergePicks, CYCLE_DAYS } from "./pricing.js";

export const ONLINE_CHECKOUT_TTL_MIN = 60;

export function isOnline(row) {
  return row?.method === "online";
}

export function isAbandonedOnline(row, now = Date.now()) {
  if (!isOnline(row) || row?.status !== "pending") return false;
  const at = new Date(row.created_at).getTime();
  if (!Number.isFinite(at)) return false;
  return now - at > ONLINE_CHECKOUT_TTL_MIN * 60 * 1000;
}

// Does this row stop the customer from starting another payment?
export function blocksNewPayment(row, now = Date.now()) {
  return row?.status === "pending" && !isAbandonedOnline(row, now);
}

// Statuses a gateway confirmation may still turn into a plan. "expired" is in the
// list on purpose: we close a checkout we stopped waiting for, but if SSLCommerz
// later proves the money DID arrive (a slow IPN), the customer must still get
// what they paid for.
export const ACTIVATABLE = ["pending", "expired"];

// An admin may approve a manual payment by hand; an online one is only ever
// confirmed by the gateway's own validation, never by a click.
export function adminMayApprove(row) {
  return row?.status === "pending" && !isOnline(row);
}

// The new expiry for a package payment. Used by lib/billing-activate.js.
export function extendedExpiry(currentExpiry, cycle, now = new Date()) {
  const current = currentExpiry ? new Date(currentExpiry) : null;
  const base = current && current > now ? new Date(current) : new Date(now);
  base.setDate(base.getDate() + (cycle === "yearly" ? CYCLE_DAYS.yearly : CYCLE_DAYS.monthly));
  return base;
}

// What the client row becomes. Used by lib/billing-activate.js.
export function clientPatchFor(pr, cl, now = new Date()) {
  if (pr.kind === "addon") {
    return { addons: mergePicks(cl.addons || {}, pr.addons || {}) };
  }
  const cycle = pr.billing_cycle === "yearly" ? "yearly" : "monthly";
  return {
    plan: pr.plan,
    plan_expires_at: extendedExpiry(cl.plan_expires_at, cycle, now).toISOString(),
    suspended: false,
    billing_cycle: cycle,
    byok_plan: !!pr.byok,
    addons: pr.addons || {},
  };
}
