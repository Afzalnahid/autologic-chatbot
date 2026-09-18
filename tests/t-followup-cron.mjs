// The scheduled follow-up run: which accounts it visits, and when it stops
// starting new ones. Follow-ups used to run only when the owner's dashboard
// loaded the inbox; this pins down who the scheduled run now reaches.
import { followupOn, followupClientIds, timeLeft, RUN_BUDGET_MS } from "../src/lib/followup-cron.js";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) pass++;
  else { fail++; console.error("FAIL:", name, typeof extra === "string" ? extra : JSON.stringify(extra)); }
};

ok("enabled boolean is on", followupOn({ followup: { enabled: true } }));
ok("enabled string 'true' is on", followupOn({ followup: { enabled: "true" } }));
ok("disabled is off", !followupOn({ followup: { enabled: false } }));
ok("missing followup block is off", !followupOn({}));
ok("null settings are off", !followupOn(null));
ok("'false' string is off", !followupOn({ followup: { enabled: "false" } }));
ok("truthy-but-not-true (1) is off", !followupOn({ followup: { enabled: 1 } }));

const rows = [
  { id: "a", settings: { followup: { enabled: true } } },
  { id: "b", settings: { followup: { enabled: false } } },
  { id: "c", settings: {} },
  { id: "a", settings: { followup: { enabled: true } } },
  { id: " d ", settings: { followup: { enabled: "true" } } },
  { id: null, settings: { followup: { enabled: true } } },
  { id: "", settings: { followup: { enabled: true } } },
  null,
];
const ids = followupClientIds(rows);
ok("only accounts with follow-ups on, each once, trimmed", JSON.stringify(ids) === JSON.stringify(["a", "d"]), ids);
ok("non-array input gives no accounts", followupClientIds(undefined).length === 0);
ok("numeric id is kept as text", followupClientIds([{ id: 7, settings: { followup: { enabled: true } } }])[0] === "7");

const t0 = 1_000_000;
ok("time left at the start", timeLeft(t0, t0));
ok("time left just inside the budget", timeLeft(t0, t0 + RUN_BUDGET_MS - 1));
ok("no time left at the budget", !timeLeft(t0, t0 + RUN_BUDGET_MS));
ok("budget leaves room under the 60s function limit", RUN_BUDGET_MS <= 50_000);

console.log(`t-followup-cron: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
