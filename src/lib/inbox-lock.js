// What a lapsed plan does to the inbox. One rule, used by every route that
// reads or answers a chat and by /api/me, so they cannot disagree.
//
// Owner's decision (2026-09-21): when a package ends the bot already stops
// (botAllowed). The inbox used to stay fully usable — a free helpdesk. Now:
//   · every message a customer sends is STILL SAVED, exactly as before;
//   · the inbox is LOCKED: chats cannot be listed, opened or deleted, and the
//     owner cannot send a reply (text or media) from the dashboard;
//   · renewing unlocks it with nothing lost — the messages were never dropped.
// The only import is the plan rule itself, by a relative path, so the test
// suite loads this file where it lives.
import { planActive } from "./plans.js";

export function inboxLocked(client) {
  return !!client && !planActive(client);
}

// When the lock began, so the lock screen can say how many customers have
// written SINCE: the trial's end, or the paid plan's expiry. A suspended
// account, or one that never had a plan, has no such moment.
export function lockedSince(client) {
  if (!inboxLocked(client) || client.suspended) return null;
  const plan = String(client.plan || "").trim().toLowerCase();
  const at = plan === "trial" ? client.trial_end : plan && plan !== "none" ? client.plan_expires_at : null;
  if (!at || isNaN(new Date(at))) return null;
  return new Date(at) <= new Date() ? new Date(at).toISOString() : null;
}

// What a locked route answers, with HTTP 402. `error` is a sentence because
// the dashboard shows it to the owner as it is.
export const LOCKED = {
  code: "plan_inactive",
  locked: true,
  error: "Your plan has ended, so the inbox is locked. Every message is still being saved — renew and they are all here.",
};
