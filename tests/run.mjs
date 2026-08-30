// Run every suite in this folder, one child process each.
//
// The suites lived in a scratch directory outside the repository until
// 2026-08-31: not version-controlled, not run by anything, and one careless
// filename away from being overwritten — which is exactly how one of them was
// lost. They are here now, and this is the thing that runs them.
//
//   node tests/run.mjs            every suite
//   node tests/run.mjs limits fx  only the suites whose name contains one of these
//
// A suite passes if it exits 0. That is the whole contract: each file prints
// its own detail and sets its own exit code, so a suite can be run on its own
// with `node tests/t-limits.mjs` and read directly.

import { readdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DIR = dirname(fileURLToPath(import.meta.url));
const pick = process.argv.slice(2).filter((a) => !a.startsWith("-"));

// shim.mjs is a helper, not a suite; audit.cjs is a sweep that reports findings
// for a person to read rather than something that passes or fails.
const suites = readdirSync(DIR)
  .filter((f) => /^t-.*\.(mjs|cjs)$/.test(f))
  .filter((f) => !pick.length || pick.some((p) => f.includes(p)))
  .sort();

if (!suites.length) {
  console.error(pick.length ? `No suite matches ${pick.join(", ")}` : "No suites found.");
  process.exit(1);
}

const run = (file) => new Promise((resolve) => {
  const out = [];
  const p = spawn(process.execPath, [join(DIR, file)], { stdio: ["ignore", "pipe", "pipe"] });
  p.stdout.on("data", (d) => out.push(d));
  p.stderr.on("data", (d) => out.push(d));
  p.on("error", (e) => resolve({ file, code: -1, text: "spawn failed: " + e.message }));
  p.on("close", (code, signal) => resolve({ file, code, signal, text: Buffer.concat(out).toString() }));
});

// Node itself crashes on this Windows machine every so often — an access
// violation (0xC0000005), no output, any suite, no pattern. The same thing
// happens to headless Chrome here, which is why scripts/make-doc-shot.mjs
// already retries. Left alone it made the whole run flaky: three runs in a row
// failed on three DIFFERENT suites.
//
// Only a NATIVE crash with NO OUTPUT is retried. A suite that actually fails
// prints its FAIL lines and exits 1, and that is reported the first time,
// every time — this must never become a way for a real failure to pass on the
// second attempt.
const NATIVE_CRASH = (r) => r.code >= 0xC0000000 && !r.text.trim();
const ATTEMPTS = 3;

const runWithRetry = async (file) => {
  let last;
  for (let i = 1; i <= ATTEMPTS; i++) {
    last = await run(file);
    if (!NATIVE_CRASH(last)) return i > 1 ? { ...last, retried: i - 1 } : last;
  }
  return { ...last, crashed: true, retried: ATTEMPTS - 1 };
};

const started = Date.now();
// Sequential on purpose: several suites write a temp copy of a module beside
// themselves, and running those at the same time would have them overwrite
// each other's copy — the exact bug that once had the tests passing against
// code that no longer existed.
const results = [];
for (const f of suites) results.push(await runWithRetry(f));

const failed = results.filter((r) => r.code !== 0);
const pad = Math.max(...results.map((r) => r.file.length));

for (const r of results) {
  // The last non-empty line is each suite's own summary.
  const last = r.text.trim().split("\n").filter((l) => l.trim()).pop() || "";
  const mark = r.code === 0 ? "ok  " : "FAIL";
  const note = r.crashed ? "  (node crashed " + ATTEMPTS + "x — see above)" : r.retried ? `  (retried ${r.retried}x after a node crash)` : "";
  console.log(`${mark} ${r.file.padEnd(pad)}  ${last.slice(0, 70)}${note}`);
}

if (failed.length) {
  for (const r of failed) {
    const body = r.text.trim()
      || (r.crashed ? `Node crashed with 0x${r.code.toString(16).toUpperCase()} on all ${ATTEMPTS} attempts. This is the machine, not the suite — run it alone with: node tests/${r.file}` : `(no output — exited ${r.code})`);
    console.log(`\n${"─".repeat(70)}\n${r.file}  exit ${r.code}\n${"─".repeat(70)}\n${body}`);
  }
}

const secs = ((Date.now() - started) / 1000).toFixed(1);
console.log(`\n${results.length - failed.length}/${results.length} suites passed in ${secs}s`);
process.exit(failed.length ? 1 : 0);
