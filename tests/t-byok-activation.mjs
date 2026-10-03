// What happens when a payment is confirmed (owner, 2026-10-03/04): the package,
// cycle, Standard/BYOK and the customer's own numbers are applied in one place
// for the gateway and the admin alike; a BYOK package opens the AI Engine, a
// Standard one after BYOK closes it; numbers raised mid-period replace the old
// set; and a BYOK customer with no key saved gets a waiting bot, never our AI.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (...p) => readFileSync(join(root, ...p), "utf8");
const B = await import(pathToFileURL(join(root, "src", "lib", "billing-rules.js")).href);

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

const now = new Date("2026-10-03T00:00:00Z");
const day = 86400000;

// Expiry.
ok("a new monthly package runs 30 days from today", B.extendedExpiry(null, "monthly", now).getTime() === now.getTime() + 30 * day);
ok("a yearly package runs 365 days", B.extendedExpiry(null, "yearly", now).getTime() === now.getTime() + 365 * day);
const running = new Date(now.getTime() + 10 * day).toISOString();
ok("a renewal extends from the current expiry", B.extendedExpiry(running, "monthly", now).getTime() === now.getTime() + 40 * day);
const lapsed = new Date(now.getTime() - 5 * day).toISOString();
ok("a lapsed package restarts from today", B.extendedExpiry(lapsed, "monthly", now).getTime() === now.getTime() + 30 * day);

// Package payment.
const cl = { plan_expires_at: null, custom_limits: { replies: 500 }, byok_plan: false };
const byokPlan = B.clientPatchFor({ kind: "plan", plan: "shop_pro", billing_cycle: "monthly", byok: true, custom_limits: { products: 100 } }, cl, now);
ok("a package payment sets the plan", byokPlan.plan === "shop_pro");
ok("…the cycle", byokPlan.billing_cycle === "monthly");
ok("…BYOK", byokPlan.byok_plan === true);
ok("…and REPLACES the numbers with the ones just bought (they renew with the package)", JSON.stringify(byokPlan.custom_limits) === JSON.stringify({ products: 100 }));
ok("…and lifts a suspension", byokPlan.suspended === false);
const std = B.clientPatchFor({ kind: "plan", plan: "svc_basic", billing_cycle: "yearly", byok: false, custom_limits: {} }, { ...cl, byok_plan: true }, now);
ok("a Standard package clears BYOK", std.byok_plan === false && std.billing_cycle === "yearly");
ok("a row with no kind is a package payment (rows from before 2026-10-03)", B.clientPatchFor({ plan: "shop_basic", billing_cycle: "monthly" }, cl, now).plan === "shop_basic");

ok("a package with no numbers moved clears the old ones", JSON.stringify(std.custom_limits) === "{}");

// Numbers raised mid-period.
const add = B.clientPatchFor({ kind: "topup", plan: "shop_pro", custom_limits: { replies: 1000, products: 50 } }, cl, now);
ok("a top-up saves the new full set", add.custom_limits.replies === 1000 && add.custom_limits.products === 50);
ok("…and touches nothing else (no plan, no expiry, no BYOK change)", Object.keys(add).join() === "custom_limits");
ok("the change is described for the admin in one line", B.describeCustom({ replies: 500, products: -50 }) === "replies +500 · products −50");

// Wiring.
const act = read("src", "lib", "billing-activate.js");
ok("activation applies clientPatchFor", /const patch = clientPatchFor\(pr, cl\);/.test(act));
ok("BYOK opens the AI Engine without wiping an existing key", /upsert\(\{ client_id: pr\.client_id, status: "no_key" \}, \{ onConflict: "client_id", ignoreDuplicates: true \}\)/.test(act));
ok("Standard closes it only after a BYOK package", /else if \(cl\.byok_plan\) \{\s*await supabase\.from\("client_ai"\)\.delete\(\)\.eq\("client_id", pr\.client_id\);/.test(act));
ok("only a package payment touches the AI Engine", /if \(pr\.kind !== "topup"\) \{/.test(act));
ok("the owner is told on the phone when a Standard package or a top-up is approved", /if \(pr\.kind === "topup" \|\| !pr\.byok\) \{\s*notify\(pr\.client_id/.test(act));
const admin = read("src", "app", "api", "admin", "route.js");
ok("admin approval uses the same activation", /const a = await activatePaymentRow\(pr, \{ reviewedBy: email \}\);/.test(admin));
ok("admin approval no longer sets the plan itself", !/\.update\(\{ plan: pr\.plan, plan_expires_at/.test(admin));
const bot = read("src", "lib", "bot.js");
ok("the bot waits for a BYOK customer's key", /if \(client\.byok_plan && !\(await clientHasOwnKey\(client\.id\)\)\) \{\s*return \{ allowed: false, reason: "byok_no_key", client \};/.test(bot));
ok("the owner is sent to AI Engine, not billing", /block\.reason === "byok_no_key" \? "\/dashboard#ai"/.test(bot));
const ai = read("src", "lib", "ai.js");
ok("no AI call falls back to the platform for a BYOK customer without a key", /if \(c\?\.byok_plan\) waiting = true;/.test(ai) && /if \(waiting\) return waitingForKey\(id\);/.test(ai));
const email = read("src", "lib", "email.js");
ok("the email explains the waiting bot and links AI Engine", /byok_no_key: \{[\s\S]*?href: "https:\/\/www\.tellmoreai\.com\/dashboard#ai"/.test(email));

console.log(`t-byok-activation: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
