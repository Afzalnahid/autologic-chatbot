// Warnings about the platform's own AI key reaching its limits.
//
// Owner, 2026-09-30: "if the api has a limit then there is possibility in my
// product that api stop working". One model out of quota is survivable (the
// chain moves on) and is a warning; every model failing means customers get no
// answers and is urgent; a busy day is an early notice. The rules are pure and
// tested here; the wiring is checked against the source.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { loadPure } from "./shim.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (...p) => readFileSync(join(root, ...p), "utf8");
const A = await loadPure(join(root, "src", "lib", "ai-alerts.js"), "tmp-ai-alerts.mjs");
const E = await loadPure(join(root, "src", "lib", "platform-events.js"), "tmp-platform-events-ai.mjs");

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

// ── what counts as a limit ─────────────────────────────────────────────────
const QUOTA = "[GoogleGenerativeAI Error]: [429 Too Many Requests] You exceeded your current quota";
ok("Google's 429 is a limit", A.isQuotaError(QUOTA));
ok("RESOURCE_EXHAUSTED is a limit", A.isQuotaError("RESOURCE_EXHAUSTED"));
ok("a rate limit is a limit", A.isQuotaError("rate limit reached"));
ok("an overloaded model is not a limit", !A.isQuotaError("503 Service Unavailable: The model is overloaded"));
ok("nothing is not a limit", !A.isQuotaError(undefined));

// ── which event, if any ─────────────────────────────────────────────────────
const q = A.aiFailureEvent({ model: "gemini-3.6-flash", message: QUOTA });
ok("one model at its limit is ai_quota", q?.kind === "ai_quota");
ok("…and names the model", q.title.includes("gemini-3.6-flash"));
ok("…and says the bot is still answering", /still answering/.test(q.body));
ok("a 503 blip with a model still to try raises nothing",
  A.aiFailureEvent({ model: "gemini-3.6-flash", message: "503 overloaded" }) === null);
const d = A.aiFailureEvent({ model: "gemini-3.8-flash", message: "503 overloaded", last: true });
ok("the last model failing is ai_down, whatever the reason", d?.kind === "ai_down");
ok("…and says customers get no answers", /not getting answers/.test(d.body));
ok("…and says what stopped", A.aiFailureEvent({ model: "gemini-embedding-001", message: QUOTA, last: true, what: "product and document search" }).body.includes("product and document search"));
ok("a long error is cut short", A.aiFailureEvent({ model: "m", message: "x".repeat(900), last: true }).body.length < 400);

// ── counting the day ─────────────────────────────────────────────────────────
const rows = [
  { model: "gemini-3.6-flash", calls: 3000 }, { model: "gemini-3.6-flash", calls: 2500 },
  { model: "gemini-embedding-001", calls: 1200 },
  { model: "gemini-3.6-flash", calls: 9999, own_key: true },   // a client's own key: not ours
];
const per = A.callsPerModel(rows);
ok("calls add up per model", per["gemini-3.6-flash"] === 5500);
ok("a client's own-key calls are left out", !Object.values(per).includes(15499));
ok("busy means at or past the mark", A.busyModels(per, 5000).map((b) => b.model).join() === "gemini-3.6-flash");
ok("busiest first", A.busyModels({ a: 6000, b: 9000 }, 5000)[0].model === "b");
ok("no mark, no warning", A.busyModels(per, 0).length === 0);
ok("a quiet day raises nothing", A.busyEvent([], 5000) === null);
ok("a busy day names the model and its calls", /gemini-3\.6-flash: 5500 calls/.test(A.busyEvent(A.busyModels(per, 5000), 5000).body));
ok("the mark comes from AI_DAILY_WARN_CALLS", A.warnMark({ AI_DAILY_WARN_CALLS: "8000" }) === 8000);
ok("…with a default when unset or nonsense", A.warnMark({}) === A.DEFAULT_WARN_CALLS && A.warnMark({ AI_DAILY_WARN_CALLS: "abc" }) === A.DEFAULT_WARN_CALLS);

// ── how loudly ───────────────────────────────────────────────────────────────
ok("all three are known events", ["ai_quota", "ai_down", "ai_busy"].every((k) => E.EVENT_KINDS.includes(k)));
ok("the bot going silent is urgent and emailed", E.EVENTS.ai_down.severity === "urgent" && E.EVENTS.ai_down.email);
ok("a model at its limit reaches the phone", E.EVENTS.ai_quota.push);
ok("a limit is not repeated within the hour", E.shouldLog("ai_quota", new Date(Date.now() - 30 * 60 * 1000).toISOString()) === false);
ok("…but is again hours later", E.shouldLog("ai_quota", new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString()) === true);

// ── wired where it happens ───────────────────────────────────────────────────
const gem = read("src", "lib", "gemini.js"), ai = read("src", "lib", "ai.js");
ok("every chained call reports skipped models", (gem.match(/\}, opts, "/g) || []).length >= 3 && /onChain\(run, opts, "a reply"\)/.test(gem));
ok("the embedding model reports too", /unavailable\(opts, "gemini-embedding-001"/.test(gem));
ok("the platform key listens", /onUnavailable: reportPlatformAIFailure/.test(ai));
ok("a client's own key does not (it has key_failing)", !/const o = \{[^}]*onUnavailable/.test(ai));
ok("the half-hourly job calls the usage check", /api\/cron\/ai-usage/.test(read(".github", "workflows", "followups.yml")));

console.log(`t-ai-alerts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
