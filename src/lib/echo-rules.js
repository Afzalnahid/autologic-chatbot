// Is this echo (the Page's own outgoing message, seen via the webhook) Meta's
// AUTOMATED reply — Business Suite's "instant reply" / "away message" — rather
// than a human typing? Meta stamps both with the same app id, so timing is the
// only tell, and it is a strong one: on 2026-09-11 the instant reply echoed
// 1.8 s after the customer's message. No person answers a fresh message that
// fast — and if they are already mid-conversation (a business reply in the
// last few minutes) a quick "ok" is a person, not a robot.
//
// Why it matters: a human reply marks the customer's Pending rows Replied so
// the bot does not re-answer them. Treating the instant reply as human did the
// same, so with the bot ON the greeting would have silenced the bot for every
// new conversation on a Page with instant replies switched on.
export const AUTO_REPLY_WINDOW_MS = 20_000;
export const RECENT_BUSINESS_MS = 10 * 60_000;

// now / lastCustomerAt / lastBusinessAt are epoch ms (0 or null when none).
export function isAutomatedEcho({ now, lastCustomerAt, lastBusinessAt }) {
  const c = Number(lastCustomerAt) || 0;
  if (!c) return false;                                 // nothing to be answering
  const age = (Number(now) || 0) - c;
  if (age < 0 || age > AUTO_REPLY_WINDOW_MS) return false;   // slow enough to be a person
  const b = Number(lastBusinessAt) || 0;
  if (b && (Number(now) || 0) - b < RECENT_BUSINESS_MS) return false; // already chatting → a person
  return true;
}
