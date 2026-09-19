// "May this client add N more?" — for products and knowledge documents. Pure:
// no database, so the rule is tested on its own (tests/t-allowance.mjs).
//
// Two limits, both the package number (owner's rules, 2026-09-19 and -20):
//   • ADDED IN TOTAL — every add the account has ever made counts, for as long
//     as it uses the package; it never starts again on the 1st (owner,
//     2026-09-20: "500 means you can add 500 products for the life time").
//     Deleting does NOT give the slot back: each add is paid for (its photos
//     are read and it is indexed by AI), so delete-and-re-add must not be free.
//     Counted by a database trigger into allowance_events
//     (docs/sql/2026-09-19-allowance-meters.sql).
//   • IN THE CATALOGUE — what the bot searches. Mostly implied by the first,
//     but it also holds catalogues that existed before adds were counted.
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
      : `Your ${planName} package lets you add ${fmt(v.limit)} ${noun} in total and you have added ${fmt(v.used)}. Deleting does not give an add back, and it does not reset each month. Upgrade for more.`;
  }
  return `Your ${planName} package holds up to ${fmt(v.limit)} ${noun} and you have ${fmt(v.used)}. Remove some, or upgrade for more room.`;
}
