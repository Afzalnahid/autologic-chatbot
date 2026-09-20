// A lapsed plan locks the inbox; an active one never does. inbox-lock.js and
// plans.js import nothing outside src/lib by alias, so they load where they live.
import { inboxLocked, lockedSince, LOCKED } from "../src/lib/inbox-lock.js";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) pass++; else { fail++; console.error("FAIL:", name, typeof extra === "string" ? extra : JSON.stringify(extra)); } };
const past = (d) => new Date(Date.now() - d * 86400000).toISOString();
const future = (d) => new Date(Date.now() + d * 86400000).toISOString();

// Never locked while the plan is good.
ok("an active paid plan is open", !inboxLocked({ plan: "shop_growth", plan_expires_at: future(10) }));
ok("a paid plan with no expiry (legacy) is open", !inboxLocked({ plan: "shop_growth", plan_expires_at: null }));
ok("a running trial is open", !inboxLocked({ plan: "trial", trial_end: future(2) }));
ok("an admin-made package id is a paid plan too", !inboxLocked({ plan: "custom_vip", plan_expires_at: future(30) }));

// Locked when it has lapsed.
ok("an expired paid plan is locked", inboxLocked({ plan: "shop_growth", plan_expires_at: past(1) }));
ok("an ended trial is locked", inboxLocked({ plan: "trial", trial_end: past(1) }));
ok("a trial with no end date is locked", inboxLocked({ plan: "trial", trial_end: null }));
ok("no plan at all is locked", inboxLocked({ plan: "none" }) && inboxLocked({ plan: "" }));
ok("a suspended account is locked even with time left", inboxLocked({ plan: "shop_growth", plan_expires_at: future(10), suspended: true }));
ok("no client, no lock (the route answers 401 instead)", !inboxLocked(null) && !inboxLocked(undefined));

// Since when — the moment the lock screen counts from.
const exp = past(3);
ok("a paid plan counts from its expiry", lockedSince({ plan: "shop_growth", plan_expires_at: exp }) === new Date(exp).toISOString());
ok("a trial counts from its end", lockedSince({ plan: "trial", trial_end: exp }) === new Date(exp).toISOString());
ok("an open inbox has no such moment", lockedSince({ plan: "shop_growth", plan_expires_at: future(5) }) === null);
ok("a suspended account has none either", lockedSince({ plan: "shop_growth", plan_expires_at: future(5), suspended: true }) === null);
ok("nor an account that never had a plan", lockedSince({ plan: "none" }) === null);
ok("a broken date does not throw", lockedSince({ plan: "shop_growth", plan_expires_at: "not-a-date" }) === null);

// What the routes answer.
ok("the locked answer is a sentence the owner can read, with a code", LOCKED.locked === true && LOCKED.code === "plan_inactive" && /still being saved/.test(LOCKED.error));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
