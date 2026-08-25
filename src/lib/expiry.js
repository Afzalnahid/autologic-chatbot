// "Your plan ends in N days" — the one warning that has to arrive whether or not
// the owner is looking.
//
// This used to run only when someone opened their dashboard. An owner whose bot
// was quietly working, who therefore had no reason to log in, got no warning at
// all: their bot simply stopped one morning. The people most likely to be caught
// out were exactly the ones for whom the product was working.
//
// The same function now runs from two places, and neither can send twice:
//   - /api/cron/expiry, once a day, for everyone
//   - /api/me, when the owner opens the dashboard — kept as a safety net so a
//     missed or misconfigured cron run does not mean silence
//
// Sending at most once per plan period is enforced by expiry_warned_at holding
// the expiry date it warned about, not the time it sent. Renewing moves the
// expiry date, which arms the next warning by itself.
import { supabase } from "@/lib/supabase.js";
import { notifyExpiringSoon } from "@/lib/email.js";

export const WARN_DAYS = 3;

// When this client's access actually runs out, or null if nothing is dated.
export function expiryOf(client) {
  const raw = String(client?.plan || "").trim().toLowerCase() === "trial"
    ? client?.trial_end
    : client?.plan_expires_at;
  return raw || null;
}

// Whole days until it ends: 0 means it ends today, negative means it is gone.
export function daysUntil(expiry, now = new Date()) {
  return Math.ceil((new Date(expiry) - now) / 86400000);
}

// Returns what happened, so the cron can report a real count instead of "done".
//   { sent: true, daysLeft } | { skipped: reason }
export async function warnIfExpiringSoon(client, now = new Date()) {
  if (!client?.owner_email) return { skipped: "no_email" };
  if (client.suspended) return { skipped: "suspended" };

  const expiry = expiryOf(client);
  if (!expiry) return { skipped: "no_expiry" };

  const daysLeft = daysUntil(expiry, now);
  if (daysLeft < 0) return { skipped: "already_expired" };
  if (daysLeft > WARN_DAYS) return { skipped: "not_yet" };

  // Already warned about THIS expiry date. Compared against the date rather than
  // "have we emailed recently", so a renewal re-arms it and a second cron run on
  // the same day does not send again.
  const warned = client.expiry_warned_at ? new Date(client.expiry_warned_at) : null;
  if (warned && Math.abs(warned - new Date(expiry)) < 24 * 3600 * 1000) {
    return { skipped: "already_warned" };
  }

  await notifyExpiringSoon(client.owner_email, {
    business: client.business_name,
    plan: client.plan,
    daysLeft: Math.max(0, daysLeft),
    expiresAt: expiry,
  });
  // Stamped only after the email is away, so a send that throws is retried on
  // the next run instead of being silently marked as handled.
  await supabase.from("clients")
    .update({ expiry_warned_at: new Date(expiry).toISOString() })
    .eq("id", client.id);

  return { sent: true, daysLeft };
}

const FIELDS = "id,business_name,owner_email,plan,trial_end,plan_expires_at,expiry_warned_at,suspended";

// Everyone whose access ends within the warning window. Filtered at the database
// on the date, so the sweep stays small however many clients there are.
//
// Two plain queries rather than one .or() with nested and() groups: the dates go
// into the filter as text, and a query string that quietly fails to parse would
// return nothing at all — which looks exactly like "nobody is expiring", the one
// wrong answer this job must never give.
export async function clientsExpiringSoon(now = new Date()) {
  const horizon = new Date(now.getTime() + (WARN_DAYS + 1) * 86400000).toISOString();
  const floor = new Date(now.getTime() - 86400000).toISOString();

  const [trials, paid] = await Promise.all([
    supabase.from("clients").select(FIELDS).gte("trial_end", floor).lte("trial_end", horizon),
    supabase.from("clients").select(FIELDS).gte("plan_expires_at", floor).lte("plan_expires_at", horizon),
  ]);
  if (trials.error) throw new Error(trials.error.message);
  if (paid.error) throw new Error(paid.error.message);

  // A client can match both queries (a trial_end left behind after upgrading),
  // so de-duplicate before anyone is emailed. warnIfExpiringSoon picks the date
  // that matters for the plan they are actually on.
  const seen = new Map();
  for (const c of [...(trials.data || []), ...(paid.data || [])]) seen.set(c.id, c);
  return [...seen.values()];
}
