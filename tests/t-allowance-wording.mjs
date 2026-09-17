// What a package's number MEANS, said the same way everywhere a customer reads
// it. The meter counts BOT REPLIES (the owner's 2026-09-08 rule, enforced in
// message-usage.js and proven in t-reply-turn.mjs) — but until 2026-09-18 the
// pricing page, every plan bullet and the dashboard meter all called it
// "customer messages", and the pricing FAQ went further and said outright that
// the bot's replies were NEVER counted. A shop owner reading "3,000 customer
// messages" budgets for 3,000 customers; they get about 600, and we told them
// the opposite of the truth in writing.
//
// The unit is read in four places and they cannot be allowed to drift apart, so
// each is checked against the source that is actually right: the counter.
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const read = (...p) => readFileSync(join(ROOT, ...p), "utf8");

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

// ── The counter itself: this is what the wording has to describe ─────────────
{
  const src = read("src", "lib", "message-usage.js");
  ok("the meter counts bot rows flagged as a reply", /\.eq\("role",\s*"bot"\)[\s\S]{0,60}reply_turn/.test(src));
  ok("and never counts the customer's own messages except as a fallback",
    src.indexOf('.eq("role", "customer")') > src.indexOf('reply_turn'));
}

// ── Every pricing bullet names the right unit ───────────────────────────────
{
  const { PLANS } = await import(pathToFileURL(join(ROOT, "src", "lib", "plans.js")).href + "?v=" + Date.now());
  const bullets = Object.values(PLANS).flatMap((p) => p.features || []);
  ok("there are bullets to check", bullets.length > 20);
  const allowance = bullets.filter((b) => /\d[\d,]*\s*(bot replies|customer messages)|Unlimited (bot replies|customer messages)/i.test(b));
  ok("every package states its allowance", allowance.length >= 7);
  ok("no bullet calls the allowance customer messages",
    !bullets.some((b) => /customer messages/i.test(b)));
  ok("the trial's bullet is per day and says replies",
    bullets.some((b) => /30 bot replies a day/i.test(b)));
  ok("the paid bullets are per month and say replies",
    ["3,000", "15,000", "50,000"].every((n) => bullets.some((b) => b.includes(`${n} bot replies / month`))));
}

// ── The dashboard meter and the admin drawer read the same counter ──────────
{
  const ent = read("src", "lib", "entitlements.js");
  ok('the dashboard meter is labelled "Bot replies"', /shapeMeter\("messages",\s*"Bot replies"/.test(ent));
  ok("the admin drawer uses the same label",
    /<Meter label="Bot replies"[^>]*s\.usage\.messages/.test(read("src", "app", "admin", "admin-client.js")));
}

// ── The public pricing page ─────────────────────────────────────────────────
{
  const pricing = read("src", "app", "pricing", "pricing-client.js");
  ok("the comparison table's allowance row says Bot replies", /label: "Bot replies"/.test(pricing));
  // The sentence that was not merely vague but backwards.
  ok("the page never claims the bot's replies are uncounted",
    !/bot's own replies are never counted/i.test(pricing));
  ok("it says a bot reply is what counts", /one bot reply/i.test(pricing));
  ok("it says the owner's own replies do not count", /type yourself are never counted/i.test(pricing));
}

// ── The admin boxes an owner types the limit into ───────────────────────────
{
  const { limitMeaning } = await import(pathToFileURL(join(ROOT, "src", "lib", "limit-conflicts.js")).href + "?v=" + Date.now());
  ok("the daily box says what it limits", limitMeaning("messages_per_day", "trial").label === "Bot replies / day");
  ok("and the monthly one too", limitMeaning("messages_per_month", "pro").label === "Bot replies / month");
}

// ── The fresh-database seed carries the same words as the code ──────────────
{
  const sql = read("docs", "sql", "2026-08-31-plans-biz.sql");
  ok("the plan seed says bot replies", /bot replies \/ month/.test(sql));
  ok("and no longer says customer messages in a bullet", !/\d,?\d* customer messages/.test(sql));
}

console.log(fail === 0 ? `${pass} passed, 0 failed` : `${pass} passed, ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
