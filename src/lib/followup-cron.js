// Which accounts the scheduled follow-up run should visit. Pure: no database,
// so the rule is tested on its own (tests/t-followup-cron.mjs).
//
// Follow-ups used to run only when the owner's dashboard loaded the inbox, so
// an owner who trusted the bot and stayed away — the one the feature is for —
// sent none at all. The scheduled run visits every account that switched them
// on; runFollowups() still applies every other rule (plan, package, quota,
// window, throttle) exactly as before.

// settings.followup.enabled has been saved as a boolean by the dashboard, but a
// string "true" from a hand edit or an older build must not be silently skipped.
export function followupOn(settings) {
  const v = settings?.followup?.enabled;
  return v === true || v === "true";
}

// app_settings rows ({ id, settings }) → client ids with follow-ups on, each once.
export function followupClientIds(rows) {
  const out = [];
  const seen = new Set();
  for (const r of Array.isArray(rows) ? rows : []) {
    const id = r?.id == null ? "" : String(r.id).trim();
    if (!id || seen.has(id) || !followupOn(r.settings)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

// The run stops starting new accounts once this much of the function's time is
// gone, so one slow account cannot make the platform kill the run half-way
// through a send. What is left is picked up by the next run 30 minutes later.
export const RUN_BUDGET_MS = 45_000;
export const timeLeft = (startedAt, now = Date.now()) => now - startedAt < RUN_BUDGET_MS;
