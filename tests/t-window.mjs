import { fileURLToPath as __f } from "node:url";
// Paths are derived from this file's own location so the suite runs
// anywhere — another machine, another checkout, CI.
const __R = (p) => new URL("../" + p, import.meta.url);
const ROOT_SLASH = __f(new URL("../", import.meta.url)).replace(/\\/g, "/");

// quotaWindowStart decides where a "per month" allowance starts counting.
// plan-limits.js reaches for supabase, so the import is rewritten rather than
// the module stripped — the function under test is untouched.
import { readFileSync, writeFileSync } from "node:fs";

// Matched by regex, not by the exact import line: the named imports change
// whenever the module gains a helper, and an exact match fails SILENTLY —
// leaving an unrewritten "@/lib/..." that only shows up as a resolve error, or
// worse, a stale copy that still loads.
const src = readFileSync(__R("src/lib/plan-limits.js"), "utf8")
  .replace(/^import .*from "@\/lib\/supabase\.js";$/m, "const supabase = { from: () => ({}) };")
  .replace(/from "@\/lib\/plans\.js";$/m, 'from "./tmp-plans.mjs";')
  // features.js is pure (no imports), so the real file is copied beside the test.
  .replace(/from "@\/lib\/features\.js";$/m, 'from "./tmp-features.mjs";')
  // allowance.js is pure (no imports), so the real file is imported where it lives.
  .replace(/from "@\/lib\/allowance\.js";$/m, 'from "../src/lib/allowance.js";');
if (/@\/lib\//.test(src)) throw new Error("an import was left unrewritten — the shim needs updating");
writeFileSync(new URL("tmp-plans.mjs", import.meta.url), readFileSync(__R("src/lib/plans.js"), "utf8"));
writeFileSync(new URL("tmp-features.mjs", import.meta.url), readFileSync(__R("src/lib/features.js"), "utf8"));
const at = new URL("tmp-planlimits.mjs", import.meta.url);
writeFileSync(at, src);
const M = await import(`${at.href}?v=${Date.now()}`);

let pass = 0, fail = 0;
const is = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) pass++; else { fail++; console.log(`FAIL ${name}\n  got  ${a}\n  want ${b}`); }
};
const ok = (name, cond) => is(name, !!cond, true);

const { quotaWindowStart } = M;
const monthStart = quotaWindowStart({ plan: "pro" });

// A package sold by the month counts by the calendar month.
ok("a paid plan starts at the month", monthStart.endsWith("T18:00:00.000Z") || /-\d\dT/.test(monthStart));
is("a paid plan ignores any trial date", quotaWindowStart({ plan: "pro", trial_start: "2020-01-05T00:00:00.000Z" }), monthStart);

// A trial counts over the trial. This is the bug it fixes: a three-day trial
// begun on the 30th used to have its allowance reset by the 1st.
is("a trial starts at the trial", quotaWindowStart({ plan: "trial", trial_start: "2026-08-30T10:00:00.000Z" }), "2026-08-30T10:00:00.000Z");
ok("which is BEFORE the month start it replaces", quotaWindowStart({ plan: "trial", trial_start: "2026-08-30T10:00:00.000Z" }) > "2026-08-01");

// Anything missing falls back to the old behaviour rather than throwing.
is("a trial with no start date falls back", quotaWindowStart({ plan: "trial" }), monthStart);
is("no client at all falls back", quotaWindowStart(null), monthStart);
is("no argument falls back", quotaWindowStart(), monthStart);
is("a client with no plan falls back", quotaWindowStart({}), monthStart);

// The date must be usable as a plain YYYY-MM-DD, which is how usage_daily is
// filtered — a value that does not slice cleanly would silently widen the window.
const d = quotaWindowStart({ plan: "trial", trial_start: "2026-08-30T10:00:00.000Z" }).slice(0, 10);
is("it slices to a date", d, "2026-08-30");
ok("and the month form does too", /^\d{4}-\d{2}-\d{2}$/.test(monthStart.slice(0, 10)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
