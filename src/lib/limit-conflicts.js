// Why one message limit can cancel another, said where the number is typed.
//
// The admin panel shows five message boxes side by side as if all five applied
// at once. Two things are true of how they are actually enforced, and neither
// was visible until a client's bot stopped early:
//
//   A plan is metered EITHER by the day or by the month, never both.
//   messageAllowance() gives a trial `period: "day"` and reads only
//   messages_per_day; every paid package gets `period: "month"` and reads only
//   messages_per_month. Whichever of the two does not match the plan is dead —
//   typing a number into it changes nothing at all.
//
//   The per-channel cap is a SEPARATE check, made after that one, and it is a
//   monthly figure. So a small number there quietly becomes the real ceiling
//   (messages_per_channel × channels) however large the headline says.
//
// This decides nothing. Enforcement stays in botAllowed() and this only
// describes it, so the two cannot drift: the day/month test below is the same
// test messageAllowance makes.
//
// Keys are snake_case because that is the shape of both the packages table and
// the admin panel's boxes. Values may be strings straight out of an input.
// A separate module, not part of plan-limits.js, because this is imported by a
// client component and plan-limits.js pulls in the Supabase client. plans.js is
// safe to pull in here — it is a catalogue with no imports of its own.

import { TRIAL_DAYS } from "./plans.js";

const num = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === "") return null;           // empty box means unlimited, not zero
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const fmt = (n) => Number(n).toLocaleString("en-IN");

// Merged figures (package + any per-client override) and the plan id.
// → an array of plain sentences, empty when the limits agree with each other.
// Which box is dead is now said under the box itself, by limitMeaning below.
// What a label cannot show is arithmetic across two boxes — that is what is
// left here.
export function limitConflicts(limits = {}, planId = "", trialDays = TRIAL_DAYS) {
  const day = num(limits.messages_per_day);
  const month = num(limits.messages_per_month);
  const perCh = num(limits.messages_per_channel);
  const channels = num(limits.channels) ?? 1;
  const id = String(planId || "").trim().toLowerCase();
  const byDay = id === "trial";
  const days = num(trialDays) ?? 0;
  const out = [];

  // The cap that quietly becomes the ceiling. Both sides are measured over the
  // same window — the trial for a trial, a month for a package — so the
  // comparison is like for like.
  if (perCh !== null && id) {
    const ceiling = perCh * channels;
    const headline = byDay ? (day === null ? null : day * days) : month;
    const chText = `${fmt(channels)} channel${channels === 1 ? "" : "s"}`;
    if (headline !== null && ceiling < headline) {
      out.push(byDay
        ? `“Messages / channel / trial” (${fmt(perCh)}) × ${chText} allows ${fmt(ceiling)} for the whole trial — below the ${fmt(headline)} that ${fmt(day)} a day over ${fmt(days)} days allows. That ${fmt(ceiling)} is the real ceiling. Clear the box to remove it.`
        : `“Messages / channel / month” (${fmt(perCh)}) × ${chText} allows ${fmt(ceiling)} a month — below the ${fmt(headline)} a month set above. That ${fmt(ceiling)} is the real ceiling. Clear the box to remove it.`);
    }
  }

  return out;
}

// ── What one box means on this plan ────────────────────────────────────────
//
// The panel used to print the same eight labels for every package, so a trial
// that lasts three days advertised "Messages / month" and "Website scrapes /
// month". A month is not a unit that exists on a three-day plan, and reading
// those labels there is how a limit gets typed wrong.
//
// Two boxes are also read by nothing at all: no route checks how many channels
// a client may connect, and max_broadcasts_per_month is defined in limitsFor()
// and never consulted. Saying so is better than a number that looks enforced.
//
// → { label, note } for the key, note null when the label is the whole truth.
const NOT_ENFORCED = "Not enforced yet — nothing reads this.";

export function limitMeaning(key, planId, trialDays = TRIAL_DAYS) {
  const byDay = String(planId || "").trim().toLowerCase() === "trial";
  const days = `${trialDays} day${Number(trialDays) === 1 ? "" : "s"}`;

  switch (key) {
    case "messages_per_day":
      return { label: "Messages / day",
        note: byDay ? null : "Not used — a package is counted by the month." };

    case "messages_per_month":
      return { label: "Messages / month",
        note: byDay ? `Not used — a trial is counted by the day, and runs ${days}.` : null };

    // Both of these are real windows, and for a trial the window is the trial.
    case "messages_per_channel":
      return byDay
        ? { label: "Messages / channel / trial", note: `Counted over the ${days}, per channel.` }
        : { label: "Messages / channel / month", note: null };

    case "max_scrapes_per_month":
      return byDay
        ? { label: "Website scrapes / trial", note: `Counted over the ${days}, not the calendar month.` }
        : { label: "Website scrapes / month", note: null };

    case "channels":
      return { label: "Channels allowed", note: NOT_ENFORCED };

    case "max_broadcasts_per_month":
      return { label: byDay ? "Broadcasts / trial" : "Broadcasts / month", note: NOT_ENFORCED };

    default:
      return { label: null, note: null };   // the caller keeps its own label
  }
}

// The trial's length is also written in prose the owner typed: the tagline that
// sits on the public pricing page, and the bullets under it. Changing the
// number in the box does not change those, and nobody re-reads their own
// marketing copy — so a trial can quietly advertise three days and run five.
//
// Only a plain "N day" / "N days" is looked for. Anything cleverer would start
// guessing at sentences, and a false alarm on the owner's own words is worse
// than staying quiet.
// → a sentence, or null when the prose agrees or says nothing about days.
export function trialTextMismatch(text, days) {
  const want = num(days);
  if (want === null || !text) return null;
  for (const m of String(text).matchAll(/(\d+)[\s-]*days?\b/gi)) {
    const said = Number(m[1]);
    if (Number.isFinite(said) && said !== want) {
      return `This still says “${m[0]}”, but the trial runs ${fmt(want)} day${want === 1 ? "" : "s"}. Customers read this on the pricing page.`;
    }
  }
  return null;
}

// "3 days × 30 a day = 90 messages for the whole trial" — the figure an owner
// is actually deciding when they price a trial, and the one number the eight
// boxes never showed. Null for anything that is not a day-metered plan, or
// when the daily figure is unlimited.
export function trialTotal(limits = {}, planId = "", trialDays = TRIAL_DAYS) {
  if (String(planId || "").trim().toLowerCase() !== "trial") return null;
  const day = num(limits.messages_per_day);
  const d = num(trialDays);
  if (day === null || d === null) return null;
  return { days: d, perDay: day, total: day * d,
    text: `${fmt(d)} day${d === 1 ? "" : "s"} × ${fmt(day)} a day = ${fmt(day * d)} customer messages for the whole trial.` };
}
