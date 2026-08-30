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
// client component and plan-limits.js pulls in the Supabase client.

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
export function limitConflicts(limits = {}, planId = "") {
  const day = num(limits.messages_per_day);
  const month = num(limits.messages_per_month);
  const perCh = num(limits.messages_per_channel);
  const channels = num(limits.channels) ?? 1;
  const id = String(planId || "").trim().toLowerCase();
  const byDay = id === "trial";
  const out = [];

  // The box that is never read.
  if (byDay && month !== null) {
    out.push(`A trial is counted by the day, so “Messages / month” (${fmt(month)}) is never read. Only “Messages / day” applies.`);
  }
  if (id && !byDay && day !== null) {
    out.push(`A paid package is counted by the month, so “Messages / day” (${fmt(day)}) is never read. Only “Messages / month” applies.`);
  }

  // The cap that quietly becomes the ceiling.
  if (perCh !== null) {
    const ceiling = perCh * channels;
    const headline = byDay ? day : month;
    const chText = `${fmt(channels)} channel${channels === 1 ? "" : "s"}`;
    if (headline !== null && ceiling < headline) {
      out.push(byDay
        ? `“Messages / channel / month” (${fmt(perCh)}) × ${chText} allows ${fmt(ceiling)} for the whole month — less than a single day’s ${fmt(headline)}. That ${fmt(ceiling)} is the real ceiling. Clear the box to remove it.`
        : `“Messages / channel / month” (${fmt(perCh)}) × ${chText} allows ${fmt(ceiling)} a month — below the ${fmt(headline)} a month set above. That ${fmt(ceiling)} is the real ceiling. Clear the box to remove it.`);
    }
  }

  return out;
}
