// The app runs on Vercel, whose server clock is UTC. Every customer, and the
// business itself, is in Bangladesh — Asia/Dhaka, a fixed UTC+6 offset (the
// country has had no daylight saving since 2010, so a plain fixed offset is
// safe here in a way it would not be for most other timezones). Anywhere the
// bot or the dashboard's server-side code needs to reason about "now",
// "today", or a wall-clock hour, it should go through this file instead of
// calling `new Date()` and reading its local getters/`toLocaleString()` with
// no `timeZone` — those read as UTC on the server, not Dhaka time.
//
// Client-side dashboard code does NOT need this: a value rendered with
// `toLocaleString()` inside the browser already reflects the visitor's own
// device timezone.

export const DHAKA_TZ = "Asia/Dhaka";
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

// A Date object whose UTC-getters (getUTCHours, getUTCDate, toISOString, ...)
// read as Dhaka's wall-clock time. Never read this value's local getters
// (getHours, toString, ...) or hand it to another timeZone-aware formatter —
// that would re-apply an offset on top and double-shift the result.
export function nowInDhaka(date = new Date()) {
  return new Date(date.getTime() + DHAKA_OFFSET_MS);
}

// Human-readable current time for AI prompts and any user-facing "as of"
// text, e.g. "Friday, 15 August 2026, 2:41 PM". Uses Intl.DateTimeFormat
// directly against Asia/Dhaka on the real Date — the standard, correct way
// to format a timestamp in a specific zone.
export function formatDhaka(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: DHAKA_TZ,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

// Date-only version for things like "plan valid until 15 Aug 2026" — no
// weekday, no time of day.
export function formatDhakaDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: DHAKA_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

// One line to append to every AI reply prompt so the model always knows the
// real current date and time in Bangladesh, instead of guessing (it used to
// invent the year 2024, and ecommerce replies had no time awareness at all).
export function currentTimeLine() {
  return `\n\nCURRENT DATE & TIME: Right now it is ${formatDhaka()} in Bangladesh ` +
    `(Asia/Dhaka, UTC+6, no daylight saving). Always use this as the reference for ` +
    `"today", "now", "tomorrow", "this week", opening/closing hours and any other ` +
    `date or time question. Never invent or assume a different year.`;
}

// YYYY-MM-DD for the current Dhaka calendar day — used for machine-readable
// examples (e.g. the booking flow's worked ISO8601 example) and for grouping
// records by the day a Bangladeshi user experiences as "today".
export function todayDhakaISO(date = new Date()) {
  return nowInDhaka(date).toISOString().slice(0, 10);
}

// Start of the current Dhaka calendar day / month, returned as the UTC
// instant it corresponds to — safe to use directly in `.gte("created_at", …)`
// against a timestamptz column. Used for daily/monthly quota and usage
// windows so a tenant's "day" resets at Dhaka midnight, not at 6am local
// time (which is what UTC midnight is, in Bangladesh).
export function startOfDayDhaka(date = new Date()) {
  const d = nowInDhaka(date);
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() - DHAKA_OFFSET_MS);
}

export function startOfMonthDhaka(date = new Date()) {
  const d = nowInDhaka(date);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() - DHAKA_OFFSET_MS);
}
