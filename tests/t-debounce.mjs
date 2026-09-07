// The reply debounce: a burst of quick messages must become ONE reply, not one
// per message. The timing and the DB live in processConversation, but the actual
// DECISION — stop / bail / go / wait — is pure, and this is where the "don't reply
// twice" rule is pinned down.
//
// Actions:
//   stop = nothing pending, this handler is done
//   bail = a newer message arrived; ITS handler will answer the whole burst
//   go   = the customer has gone quiet; answer now (combining all pending)
//   wait = look again shortly
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { loadPure } from "./shim.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const BOT = join(here, "..", "src", "lib", "bot.js");

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; }
  else { fail++; console.error("FAIL:", name, typeof extra === "string" ? extra : JSON.stringify(extra)); }
};

const { debounceDecision, DEBOUNCE_QUIET_MS, DEBOUNCE_MAX_MS } = await loadPure(BOT, "tmp-debounce.mjs");

const T0 = 1_000_000_000_000; // a fixed "now" base
const row = (id, ageMs) => ({ id, created_at: new Date(T0 - ageMs).toISOString() });

// nothing pending
ok("empty → stop", debounceDecision([], "a", T0, T0).action === "stop");
ok("null rows → stop", debounceDecision(null, "a", T0, T0).action === "stop");

// a lone message that just arrived → wait, not reply
{
  const d = debounceDecision([row("a", 0)], "a", T0, T0);
  ok("fresh lone message → wait", d.action === "wait", d);
  ok("wait is bounded to 1200ms", d.waitMs <= 1200 && d.waitMs >= 50, d);
}

// the same message, once the customer has been quiet long enough → go
ok("quiet elapsed → go",
  debounceDecision([row("a", DEBOUNCE_QUIET_MS)], "a", T0, T0).action === "go");
ok("just under quiet → still wait",
  debounceDecision([row("a", DEBOUNCE_QUIET_MS - 500)], "a", T0, T0).action === "wait");

// THE BUG: a newer message arrived, so an older handler must BAIL (not reply).
{
  const rows = [row("a", 3000), row("b", 100)]; // b is newest
  ok("older handler bails when a newer message exists",
    debounceDecision(rows, "a", T0, T0).action === "bail");
  ok("the newest handler does NOT bail (waits for quiet)",
    debounceDecision(rows, "b", T0, T0).action === "wait");
}

// three messages a second apart: only the last one's handler proceeds; the first
// two bail. Together that is exactly one reply for the burst.
{
  const rows = [row("a", 2000), row("b", 1000), row("c", 200)];
  ok("burst: first bails", debounceDecision(rows, "a", T0, T0).action === "bail");
  ok("burst: middle bails", debounceDecision(rows, "b", T0, T0).action === "bail");
  ok("burst: last waits then will go", debounceDecision(rows, "c", T0, T0).action === "wait");
  // once c has been quiet:
  const later = [row("a", 2000 + DEBOUNCE_QUIET_MS), row("b", 1000 + DEBOUNCE_QUIET_MS), row("c", DEBOUNCE_QUIET_MS)];
  ok("burst: last goes after quiet", debounceDecision(later, "c", T0, T0).action === "go");
}

// ids compared as strings — a numeric row id must still match a string myRowId.
ok("numeric vs string id matches (no false bail)",
  debounceDecision([row(42, 100)], "42", T0, T0).action !== "bail");
ok("numeric myRowId vs string id matches",
  debounceDecision([row("42", 100)], 42, T0, T0).action !== "bail");

// null myRowId (no guard) never bails — it just waits/goes on quiet.
ok("null myRowId never bails",
  debounceDecision([row("a", 3000), row("b", 100)], null, T0, T0).action !== "bail");

// safety cap: if the customer keeps typing past the max, reply anyway.
ok("max wait forces go even if not quiet",
  debounceDecision([row("a", 500)], "a", T0, T0 - DEBOUNCE_MAX_MS - 1).action === "go");

// wait time shrinks as the quiet point approaches.
{
  const d = debounceDecision([row("a", DEBOUNCE_QUIET_MS - 300)], "a", T0, T0);
  ok("wait shrinks near the quiet point", d.action === "wait" && d.waitMs <= 300 + 1, d);
}

console.log(fail === 0 ? `${pass} passed, 0 failed` : `${pass} passed, ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
