# Tests

```bash
npm test
```

One suite per file, `t-<subject>.mjs`. Run one on its own while working on it:

```bash
node tests/t-limits.mjs
```

Or a few by substring: `node tests/run.mjs limits quota`.

## What these are

Plain node scripts. No framework, no config, no watcher. A suite prints its own
result and exits 0 or 1; `run.mjs` runs them all and fails if any did. That is
the whole contract, which is why a suite is also readable on its own — the
assertions are sentences about what the code should do, and the failure output
is meant to be understood without opening the file.

There is no browser and no database here. Anything needing either is verified
in the screenshot studio (`/shots`) instead, and the gaps are listed at the
foot of `docs/bug-audit-2026-08-31.md`.

## Why the suites copy modules before importing

Several files under test import `@/lib/supabase.js` at the top, which node
cannot resolve and which would reach for a real database if it could. Those
suites read the module's source, rewrite the import to a stub, write the copy
**beside themselves**, and import it by URL (`tests/tmp-*.mjs`, gitignored).

Two rules learned the hard way and worth keeping:

- The copy is written next to the importing file and addressed by URL. Written
  to the working directory instead, it once landed in the project root while
  `import("./x.mjs")` resolved beside the test — so every run wrote a fresh copy
  where nothing read it and imported a stale one. The tests passed against code
  that no longer existed.
- The rewrite matches the import by **regex, not by the exact line**. Matching
  the exact text fails silently the day a module gains a named import, so each
  shim throws if an `@/lib/` import survives it.

## ⚠️ This machine crashes node at random

Roughly one run in five, a node process here dies with an access violation
(`0xC0000005` / exit `3221225477`) — no output, no pattern, any file. Headless
Chrome does the same thing, which is why `scripts/make-doc-shot.mjs` already
retries.

`run.mjs` retries a suite up to three times, but **only** when the exit is a
native crash AND there was no output at all. A suite that genuinely fails
prints its FAIL lines and exits 1, and is reported the first time, every time.
Retrying must never become a way for a real failure to pass on a later attempt.

The runner process itself can also crash the same way, and it cannot retry
itself. If `npm test` ends with exit `-1073741819` and no summary, that is this
machine — run it again. It does not happen on Linux, so CI is unaffected.
