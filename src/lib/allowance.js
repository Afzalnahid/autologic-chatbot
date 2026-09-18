// "May this client add N more?" — for products and knowledge documents. Pure:
// no database, so the rule is tested on its own (tests/t-allowance.mjs).
//
// Two limits, both the package number (owner's rule, 2026-09-19):
//   • ADDED this month — every add counts, and deleting does NOT give the slot
//     back. Each add is paid for (its photos are read and it is indexed by AI),
//     so delete-and-re-add must not be free. Counted by a database trigger into
//     allowance_events (docs/sql/2026-09-19-allowance-meters.sql).
//   • IN THE CATALOGUE — what the bot searches. The added count starts again
//     each month; this is what stops a catalogue growing past the package
//     month after month.
// A null max means the package sets no limit.

export function addVerdict({ max, added, stored, adding = 1 }) {
  if (max === null || max === undefined) return { ok: true };
  const lim = Number(max);
  const a = Number(added) || 0;
  const s = Number(stored) || 0;
  const n = Math.max(1, Number(adding) || 1);
  if (a + n > lim) return { ok: false, reason: "added", used: a, limit: lim };
  if (s + n > lim) return { ok: false, reason: "stored", used: s, limit: lim };
  return { ok: true, used: a, limit: lim };
}

const fmt = (n) => Number(n).toLocaleString("en-IN");

// The sentence the owner sees. `noun` is "products" or "knowledge documents".
export function addRefusal(v, { planName, noun, trial = false }) {
  if (v.reason === "added") {
    return trial
      ? `Your ${planName} lets you add ${fmt(v.limit)} ${noun} and you have added ${fmt(v.used)}. Choose a package to add more.`
      : `Your ${planName} package lets you add ${fmt(v.limit)} ${noun} a month and you have added ${fmt(v.used)} this month. Deleting does not give an add back. It resets on the 1st, or upgrade for more.`;
  }
  return `Your ${planName} package holds up to ${fmt(v.limit)} ${noun} and you have ${fmt(v.used)}. Remove some, or upgrade for more room.`;
}
