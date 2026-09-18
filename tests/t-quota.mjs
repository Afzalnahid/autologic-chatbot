import { fileURLToPath as __f } from "node:url";
// Paths are derived from this file's own location so the suite runs
// anywhere — another machine, another checkout, CI.
const __R = (p) => new URL("../" + p, import.meta.url);
const ROOT_SLASH = __f(new URL("../", import.meta.url)).replace(/\\/g, "/");

// checkChannelQuota and checkBroadcastQuota. Both were saved in the admin
// panel and read by nothing until now, so these are the first tests they have.
import { readFileSync, writeFileSync } from "node:fs";

// By regex, not by the exact import line — the named imports change whenever
// the module gains a helper, and an exact match fails silently.
const src = readFileSync(__R("src/lib/plan-limits.js"), "utf8")
  .replace(/^import .*from "@\/lib\/supabase\.js";$/m,
    "export let __db = {};\nexport const __setDb = (d) => { __db = d; };\nconst supabase = { from: (t) => __db[t] };")
  .replace(/from "@\/lib\/plans\.js";$/m, 'from "./tmp-plans3.mjs";')
  // features.js is pure (no imports), so the real file is copied beside the test.
  .replace(/from "@\/lib\/features\.js";$/m, 'from "./tmp-features3.mjs";')
  // allowance.js is pure (no imports), so the real file is imported where it lives.
  .replace(/from "@\/lib\/allowance\.js";$/m, 'from "../src/lib/allowance.js";');
if (/@\/lib\//.test(src)) throw new Error("an import was left unrewritten — the shim needs updating");
writeFileSync(new URL("tmp-plans3.mjs", import.meta.url), readFileSync(__R("src/lib/plans.js"), "utf8"));
writeFileSync(new URL("tmp-features3.mjs", import.meta.url), readFileSync(__R("src/lib/features.js"), "utf8"));
const at = new URL("tmp-pl3.mjs", import.meta.url);
writeFileSync(at, src);
const M = await import(`${at.href}?v=${Date.now()}`);

let pass = 0, fail = 0;
const is = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) pass++; else { fail++; console.log(`FAIL ${name}\n  got  ${a}\n  want ${b}`); }
};
const ok = (name, cond) => is(name, !!cond, true);

// The plans table is read through loadPlans(); one row is enough.
const PLANS_ROWS = [
  { id: "trial", name: "Free Trial", messages_per_day: 30, messages_per_month: null, messages_per_channel: null, channels: 1, max_products: 20, max_kb_files: 2, max_scrapes_per_month: 5, max_broadcasts_per_month: 2, features: {}, feature_list: [], active: true },
  { id: "pro", name: "Pro", messages_per_day: null, messages_per_month: 15000, messages_per_channel: null, channels: 3, max_products: 3000, max_kb_files: 40, max_scrapes_per_month: 200, max_broadcasts_per_month: 20, features: {}, feature_list: [], active: true },
  { id: "unlimited", name: "Unlimited", messages_per_month: null, channels: null, max_broadcasts_per_month: null, features: {}, feature_list: [], active: true },
];

// A chainable stub shaped like the PostgREST builder. Each table is given the
// rows it should answer with, or an error to answer with instead.
const table = (rows, error = null, count = null) => {
  const b = {
    __rows: rows, select: () => b, eq: () => b, gte: () => b, neq: () => b, limit: () => b,
    order: () => b, maybeSingle: async () => ({ data: rows?.[0] ?? null, error }),
    then: (res) => res({ data: rows, error, count: count ?? (rows ? rows.length : 0) }),
  };
  return b;
};
const db = ({ plans = PLANS_ROWS, channels = [], broadcasts = [], clients = null, chErr = null, bcErr = null }) => ({
  plans: table(plans), channels: table(channels, chErr), broadcasts: table(broadcasts, bcErr),
  clients: table(clients ? [clients] : null),
});
const reset = () => M.invalidatePlans();

const CH = (platform, page_id) => ({ platform, page_id });
const trial = { id: "c1", plan: "trial", limit_overrides: null };
const pro = { id: "c2", plan: "pro", limit_overrides: null };

// ── channels ───────────────────────────────────────────────────────────────
reset(); M.__setDb(db({ channels: [] }));
ok("the first channel on a trial is allowed", (await M.checkChannelQuota(trial, "facebook", "P1")).ok);

reset(); M.__setDb(db({ channels: [CH("facebook", "P1")] }));
const second = await M.checkChannelQuota(trial, "instagram", "P2");
is("a second channel on a one-channel trial is refused", second.ok, false);
ok("and the message says what to do", /Disconnect one first|upgrade/.test(second.message));
ok("with the plan named", second.message.includes("Free Trial"));

// Reconnecting is not a new channel. A client at their limit whose token
// expired must still be able to repair it.
reset(); M.__setDb(db({ channels: [CH("facebook", "P1")] }));
ok("reconnecting the same channel is allowed", (await M.checkChannelQuota(trial, "facebook", "P1")).ok);
// The page id arrives as a string from Meta and as a number from a form.
reset(); M.__setDb(db({ channels: [CH("facebook", 12345)] }));
ok("a numeric page id still matches", (await M.checkChannelQuota(trial, "facebook", "12345")).ok);
// Same id on a different platform is a different channel.
reset(); M.__setDb(db({ channels: [CH("facebook", "P1")] }));
is("the same id on another platform is a new channel", (await M.checkChannelQuota(trial, "instagram", "P1")).ok, false);

reset(); M.__setDb(db({ channels: [CH("facebook", "P1"), CH("instagram", "P2")] }));
ok("a three-channel package still has room", (await M.checkChannelQuota(pro, "whatsapp", "P3")).ok);
reset(); M.__setDb(db({ channels: [CH("facebook", "P1"), CH("instagram", "P2"), CH("whatsapp", "P3")] }));
is("and is refused the fourth", (await M.checkChannelQuota(pro, "facebook", "P4")).ok, false);

// The widget has its own switch in the package; making it eat a messaging slot
// would charge a client twice for something already turned on.
reset(); M.__setDb(db({ channels: [CH("facebook", "P1")] }));
ok("the website widget is never refused for the channel count", (await M.checkChannelQuota(trial, "website", "site")).ok);
reset(); M.__setDb(db({ channels: [CH("website", "site")] }));
ok("and does not use up a slot", (await M.checkChannelQuota(trial, "facebook", "P1")).ok);

reset(); M.__setDb(db({ channels: [CH("facebook", "P1"), CH("instagram", "P2")], plans: PLANS_ROWS }));
ok("an unlimited package is never refused", (await M.checkChannelQuota({ id: "c3", plan: "unlimited" }, "whatsapp", "P9")).ok);

// A per-client exception beats the package.
reset(); M.__setDb(db({ channels: [CH("facebook", "P1")] }));
ok("an override raises the allowance", (await M.checkChannelQuota({ ...trial, limit_overrides: { channels: 5 } }, "instagram", "P2")).ok);

// Failing OPEN would mean the quota does not exist on the day the database
// hiccups, and nothing anywhere would say so.
reset(); M.__setDb(db({ channels: null, chErr: { message: "boom" } }));
is("an unreadable channel list refuses", (await M.checkChannelQuota(trial, "facebook", "P1")).ok, false);

// The OAuth callbacks hold only the id they signed into the state parameter.
reset(); M.__setDb(db({ channels: [], clients: trial }));
ok("an id is loaded into a client", (await M.checkChannelQuota("c1", "facebook", "P1")).ok);
reset(); M.__setDb(db({ channels: [], clients: null }));
is("an id that loads nothing refuses", (await M.checkChannelQuota("nope", "facebook", "P1")).ok, false);
is("no client at all refuses", (await M.checkChannelQuota(null, "facebook", "P1")).ok, false);

// ── broadcasts ─────────────────────────────────────────────────────────────
reset(); M.__setDb(db({ broadcasts: [] }));
ok("the first broadcast is allowed", (await M.checkBroadcastQuota(trial)).ok);

reset(); M.__setDb(db({ broadcasts: [{ id: 1 }, { id: 2 }] }));
const third = await M.checkBroadcastQuota(trial);
is("a third on a two-broadcast trial is refused", third.ok, false);
ok("a trial is told to choose a package, not to wait for next month",
  /Choose a package/.test(third.message) && !/resets next month/.test(third.message));

reset(); M.__setDb(db({ broadcasts: Array.from({ length: 20 }, (_, i) => ({ id: i })) }));
const over = await M.checkBroadcastQuota(pro);
is("a package at its limit is refused", over.ok, false);
ok("and IS told it resets next month", /resets next month/.test(over.message));

reset(); M.__setDb(db({ broadcasts: Array.from({ length: 19 }, (_, i) => ({ id: i })) }));
ok("one under the limit is allowed", (await M.checkBroadcastQuota(pro)).ok);

reset(); M.__setDb(db({ broadcasts: [{ id: 1 }] }));
ok("an unlimited package is never refused", (await M.checkBroadcastQuota({ id: "c3", plan: "unlimited" })).ok);

reset(); M.__setDb(db({ broadcasts: null, bcErr: { message: "boom" } }));
is("an unreadable count refuses", (await M.checkBroadcastQuota(pro)).ok, false);

// ── the window they are counted over ───────────────────────────────────────
// Both windowed limits must read the same clock, or a trial's broadcasts and
// its scrapes disagree about when the month started.
const monthStart = M.quotaWindowStart({ plan: "pro" });
is("a package counts by the calendar month", M.quotaWindowStart({ plan: "pro", trial_start: "2020-01-05T00:00:00.000Z" }), monthStart);
is("a trial counts over the trial", M.quotaWindowStart({ plan: "trial", trial_start: "2026-08-30T10:00:00.000Z" }), "2026-08-30T10:00:00.000Z");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
