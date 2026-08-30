import { fileURLToPath as __f } from "node:url";
// Paths are derived from this file's own location so the suite runs
// anywhere — another machine, another checkout, CI.
const __R = (p) => new URL("../" + p, import.meta.url);
const ROOT_SLASH = __f(new URL("../", import.meta.url)).replace(/\\/g, "/");

// pageAll: read every row, or say you could not. It has no imports.
const P = await import(__R("src/lib/page.js?v=").href + Date.now());
const { pageAll } = P;

let pass = 0, fail = 0;
const is = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) pass++; else { fail++; console.log(`FAIL ${name}\n  got  ${a}\n  want ${b}`); }
};
const ok = (name, cond) => is(name, !!cond, true);

// A fake table of n rows that answers a range the way PostgREST does.
const table = (n, { failAt = -1 } = {}) => {
  const calls = [];
  const q = async (from, to) => {
    calls.push([from, to]);
    if (calls.length - 1 === failAt) return { error: { message: "boom" } };
    return { data: Array.from({ length: Math.max(0, Math.min(n, to + 1) - from) }, (_, i) => ({ i: from + i })) };
  };
  q.calls = calls;
  return q;
};

// ── the ordinary cases ─────────────────────────────────────────────────────
const small = table(5);
is("a short table is one page", (await pageAll(small, { page: 10 })).rows.length, 5);
is("and one request", small.calls.length, 1);

const exact = table(10);
const r2 = await pageAll(exact, { page: 10 });
is("a table exactly one page long is still complete", r2.rows.length, 10);
// It cannot know it is done until a page comes back short, so it asks once more.
is("which costs one extra request", exact.calls.length, 2);
is("and is not reported as truncated", r2.truncated, false);

const big = table(2500);
const r3 = await pageAll(big, { page: 1000 });
is("three pages are joined in order", r3.rows.length, 2500);
is("first row first", r3.rows[0], { i: 0 });
is("last row last", r3.rows[2499], { i: 2499 });
is("nothing is skipped or repeated", new Set(r3.rows.map((x) => x.i)).size, 2500);
is("the ranges are contiguous", big.calls.slice(0, 3), [[0, 999], [1000, 1999], [2000, 2499 + 500]].slice(0, 3).map(([a], i) => [i * 1000, i * 1000 + 999]));

is("an empty table is empty, not an error", (await pageAll(table(0), { page: 10 })).rows, []);

// ── the case this exists for ───────────────────────────────────────────────
// An unbounded read is capped SILENTLY. Paging is only worth anything if a
// failure mid-way is not mistaken for the end of the rows.
let threw = null;
try { await pageAll(table(2500, { failAt: 1 }), { page: 1000 }); } catch (e) { threw = e.message; }
is("a failed page throws rather than returning what arrived", threw, "boom");
threw = null;
try { await pageAll(table(50, { failAt: 0 }), { page: 10 }); } catch (e) { threw = e.message; }
is("a failure on the very first page throws too", threw, "boom");
// An error object with no message must still not read as success.
threw = null;
try { await pageAll(async () => ({ error: {} }), { page: 10 }); } catch (e) { threw = e.message; }
ok("a nameless error still throws", !!threw);

// ── the runaway ────────────────────────────────────────────────────────────
const huge = table(1e9);
const r4 = await pageAll(huge, { page: 100, ceiling: 300 });
is("the ceiling stops it", r4.rows.length, 300);
is("and it says the answer is partial", r4.truncated, true);
is("without asking for ever", huge.calls.length, 3);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
