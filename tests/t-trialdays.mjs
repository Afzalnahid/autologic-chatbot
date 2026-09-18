import { fileURLToPath as __f } from "node:url";
// Paths are derived from this file's own location so the suite runs
// anywhere — another machine, another checkout, CI.
const __R = (p) => new URL("../" + p, import.meta.url);
const ROOT_SLASH = __f(new URL("../", import.meta.url)).replace(/\\/g, "/");

// The trial length: the pure clamp both sides share, and the reader that turns
// whatever is in app_settings into a number a trial can start with.
import { readFileSync, writeFileSync } from "node:fs";

const v = Date.now();
const P = await import(__R("src/lib/plans.js?v=").href + v);
const { clampTrialDays, TRIAL_DAYS, MIN_TRIAL_DAYS, MAX_TRIAL_DAYS } = P;

// plan-limits.js reaches for supabase; the reader under test is what the stub
// stands in for, so the import is rewritten rather than the module stripped.
let reply = { data: null, error: null };
// By regex, not by the exact import line — the named imports change whenever
// the module gains a helper, and an exact match fails silently.
const src = readFileSync(__R("src/lib/plan-limits.js"), "utf8")
  .replace(/^import .*from "@\/lib\/supabase\.js";$/m,
    "export let __reply = { data: null, error: null };\nexport const __setReply = (r) => { __reply = r; };\n" +
    "const supabase = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => { if (__reply.throws) throw new Error('down'); return __reply; } }) }) }) };")
  .replace(/from "@\/lib\/plans\.js";$/m, 'from "./tmp-plans2.mjs";')
  // features.js is pure (no imports), so the real file is copied beside the test.
  .replace(/from "@\/lib\/features\.js";$/m, 'from "./tmp-features2.mjs";')
  // allowance.js is pure (no imports), so the real file is imported where it lives.
  .replace(/from "@\/lib\/allowance\.js";$/m, 'from "../src/lib/allowance.js";');
if (/@\/lib\//.test(src)) throw new Error("an import was left unrewritten — the shim needs updating");
writeFileSync(new URL("tmp-plans2.mjs", import.meta.url), readFileSync(__R("src/lib/plans.js"), "utf8"));
writeFileSync(new URL("tmp-features2.mjs", import.meta.url), readFileSync(__R("src/lib/features.js"), "utf8"));
const at = new URL("tmp-pl2.mjs", import.meta.url);
writeFileSync(at, src);
const M = await import(`${at.href}?v=${v}`);

let pass = 0, fail = 0;
const is = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) pass++; else { fail++; console.log(`FAIL ${name}\n  got  ${a}\n  want ${b}`); }
};
const set = (r) => M.__setReply(r);

// ── the clamp ──────────────────────────────────────────────────────────────
is("a plain number passes through", clampTrialDays(7), 7);
is("a string from an input reads the same", clampTrialDays("7"), 7);
is("a fraction rounds", clampTrialDays(6.6), 7);
is("the floor holds", clampTrialDays(0), MIN_TRIAL_DAYS);
is("negatives cannot make a trial", clampTrialDays(-5), MIN_TRIAL_DAYS);
is("the ceiling holds", clampTrialDays(9999), MAX_TRIAL_DAYS);
// A slipped key is the whole reason for the ceiling: 300 must not become a
// free ten months for everyone who signs up before somebody notices.
is("a slipped key is caught", clampTrialDays(300), MAX_TRIAL_DAYS);
// Anything that is not a number falls back rather than becoming 1 — an unset
// value must read as "the default", not "the shortest trial possible".
is("nothing set falls back", clampTrialDays(undefined), TRIAL_DAYS);
is("null falls back", clampTrialDays(null), TRIAL_DAYS);
is("words fall back", clampTrialDays("soon"), TRIAL_DAYS);
is("an empty box falls back", clampTrialDays(""), TRIAL_DAYS);
is("and so does nonsense arithmetic", clampTrialDays(NaN), TRIAL_DAYS);

// ── the reader ─────────────────────────────────────────────────────────────
set({ data: { settings: { trial_days: 7 } }, error: null });
is("the stored value is used", await M.trialDays(), 7);

set({ data: { settings: { trial_days: 400 } }, error: null });
is("and it is clamped on the way out too", await M.trialDays(), MAX_TRIAL_DAYS);

set({ data: { settings: { usd_bdt: 122 } }, error: null });
is("a settings row without the key falls back", await M.trialDays(), TRIAL_DAYS);

set({ data: null, error: null });
is("no settings row at all falls back", await M.trialDays(), TRIAL_DAYS);

// The failure cases matter more than the happy one: a trial that cannot read
// its own length must still start, and start at the length everyone expects.
set({ data: null, error: { message: "permission denied" } });
is("an unreadable table falls back", await M.trialDays(), TRIAL_DAYS);

set({ throws: true });
is("a table that throws falls back", await M.trialDays(), TRIAL_DAYS);

set({ data: { settings: { trial_days: null } }, error: null });
is("a key explicitly cleared falls back", await M.trialDays(), TRIAL_DAYS);

set({ data: { settings: { trial_days: 0 } }, error: null });
is("zero stored is the floor, not the fallback", await M.trialDays(), MIN_TRIAL_DAYS);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
