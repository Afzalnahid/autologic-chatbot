// Warnings about the PLATFORM's own AI key running out — before the bot goes
// quiet, not after (owner, 2026-09-30: "if the api has a limit then there is
// possibility in my product that api stop working").
//
// Google limits every key per model per day. The bot already walks a chain of
// models (src/lib/gemini.js), so one model hitting its limit is survivable —
// but it is the moment to know, because the next one may be close behind. And
// when every model in the chain has failed, the bot is answering nobody: that
// is urgent. A third, gentler warning comes from counting the day's calls
// (the /api/cron/ai-usage check), so a busy day is seen before any limit.
//
// A client on their OWN key is not covered here: that key's failures already
// raise "key_failing" (src/lib/ai.js) and pause only that client.
//
// The rules are pure and tested (tests/t-ai-alerts.mjs); `reportPlatformAIFailure`
// at the bottom is the one line that reaches the database.

/** A daily/rate limit ("429", "quota", "RESOURCE_EXHAUSTED", "rate limit"). */
export function isQuotaError(message) {
  return /\b429\b|quota|resource[_ ]exhausted|rate.?limit/i.test(String(message || ""));
}

/**
 * The event to raise for a platform model that failed, or null for none.
 *   last  — true when it was the last model tried, so the call itself failed
 *           and the customer got no answer.
 * One model out of quota with others still to try is a warning; the whole
 * chain failing, for any reason that made us move on, is urgent. Anything that
 * is not a limit on a model that still had a successor (a 503 blip) is left to
 * the logs: an alert nobody can act on teaches people to ignore the rest.
 */
export function aiFailureEvent({ model, message, last = false, what = "a reply" } = {}) {
  const m = String(model || "an AI model");
  const why = String(message || "").replace(/\s+/g, " ").slice(0, 160);
  if (last) return {
    kind: "ai_down",
    title: "The bot's AI stopped answering",
    body: `Every AI model failed for ${what} (last: ${m}). Customers are not getting answers until it recovers. ${why}`.trim(),
  };
  if (isQuotaError(message)) return {
    kind: "ai_quota",
    title: `${m} reached its daily limit`,
    body: `The bot moved on to the next model, so it is still answering. The limit resets by itself (Google's day). ${why}`.trim(),
  };
  return null;
}

/** The day's calls on the platform key, per model, from usage_daily rows. */
export function callsPerModel(rows) {
  const out = {};
  for (const r of rows || []) {
    if (!r || r.own_key) continue;
    const m = String(r.model || "unknown");
    out[m] = (out[m] || 0) + (Number(r.calls) || 0);
  }
  return out;
}

/** Models at or past the warning mark, busiest first. */
export function busyModels(perModel, warnAt) {
  const n = Number(warnAt);
  if (!(n > 0)) return [];
  return Object.entries(perModel || {})
    .filter(([, c]) => c >= n)
    .sort((a, b) => b[1] - a[1])
    .map(([model, calls]) => ({ model, calls }));
}

// How many calls a day on one model count as "busy". Google's real limit
// depends on the key's billing tier and is shown in Google AI Studio → Rate
// limits; set AI_DAILY_WARN_CALLS to about 80% of the lowest daily limit there.
// The default is only a sensible first guess, not Google's number.
export const DEFAULT_WARN_CALLS = 5000;
export function warnMark(env = process.env) {
  const v = Number(env?.AI_DAILY_WARN_CALLS);
  return v > 0 ? v : DEFAULT_WARN_CALLS;
}

export function busyEvent(busy, warnAt) {
  if (!busy?.length) return null;
  return {
    kind: "ai_busy",
    title: "AI use is high today",
    body: `${busy.map((b) => `${b.model}: ${b.calls} calls`).join(" · ")} — past the ${warnAt}-a-day mark. Check the key's daily limits in Google AI Studio.`,
  };
}

/**
 * Tell the platform owner. Never throws and is never awaited by a reply.
 * Repeats are collapsed by platform-events (ai_quota: 6 h, ai_down: 1 h).
 */
export function reportPlatformAIFailure(model, error, { last = false, what } = {}) {
  const ev = aiFailureEvent({ model, message: error?.message || error, last, what });
  if (!ev) return;
  import("@/lib/platform-events.js")
    .then(({ logEvent }) => logEvent(ev))
    .catch(() => {});
}
