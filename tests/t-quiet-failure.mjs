// A bot that cannot answer says NOTHING to the customer, and wakes the owner.
//
// The owner watched it happen on their own Facebook page (2026-09-24): the bot
// answered one question well, then met the next with "Sorry, I can't answer
// right now — someone from our team will get back to you shortly." Two things
// were wrong with that sentence. It tells a customer the robot is broken, which
// no business would say; and it promised a person whom nothing ever told. The
// rule now: silence to the customer, a flag on the conversation and an alert to
// the owner, on every channel.
//
// composeReply needs the network and the database, so this holds the shape of
// the code rather than running it — and, more usefully, it fails if an apology
// of any wording appears on a path that reaches a customer.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (...p) => readFileSync(join(root, ...p), "utf8");
const bot = read("src", "lib", "bot.js");
const widget = read("src", "app", "api", "widget", "chat", "route.js");
const script = read("public", "widget.js");
const email = read("src", "lib", "email.js");

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

// No apology may reach a customer, in either language, on any of these paths.
// If a new one is ever written, this is what stops it.
const APOLOGY = [
  /can'?t answer right now/i,
  /get back to you shortly/i,
  /couldn'?t get a reply/i,
  /something went wrong at our end/i,
  /try (that )?again (shortly|later)/i,
  /উত্তর দিতে পারছি না/,
  /উত্তর পেতে সমস্যা/,
  /একটু সমস্যা হচ্ছে/,
];
for (const [label, src] of [["the reply engine", bot], ["the website widget route", widget]]) {
  for (const re of APOLOGY) ok(`${label} sends no apology matching ${re}`, !re.test(src));
}
// The embedded script may keep exactly one message: the site key does not match
// this website, which is a setup mistake its owner has to be able to see.
ok("the embedded script no longer tells a visitor the reply failed",
  !/couldn'?t get a reply/i.test(script) && !/উত্তর পেতে সমস্যা/.test(script));
ok("it still reports a widget that is not enabled for the site", /not_authorised/.test(script));
ok("it stays silent when told to", /if \(j && j\.off\) return;/.test(script));

// The engine reports the failure instead of papering over it.
ok("composeReply decides whether it failed", /const failed = !items\.length;/.test(bot));
ok("and hands that verdict to its caller", /return \{ items, bookingNote, handoff, failed \};/.test(bot));

// Messenger, Instagram, WhatsApp.
const proc = bot.slice(bot.indexOf("async function processConversation"));
ok("the caller takes the verdict", /const \{ items, bookingNote, handoff, failed \} = await composeReply/.test(proc));
ok("nothing is sent when it failed", /if \(failed\) \{[\s\S]{0,260}return;/.test(proc));
ok("the owner is told, with the reason", /flagNeedsHuman\(clientId, senderId, combined, channel\.platform, "bot_failed"\)/.test(proc));
{
  const i = proc.search(/if \(failed\) \{/);
  const j = proc.search(/await waSendResponses/);
  ok("the silence happens BEFORE any send, not after", i > -1 && j > -1 && i < j);
}

// The website widget.
ok("the widget stays silent through the same flag the lapsed-plan case uses", /quiet \? \{ off: true \} : \{\}/.test(widget));
ok("a thrown error is silent too, not a bubble", /items = \[\];[\s\S]{0,80}quiet = true;/.test(widget));
ok("the widget tells the owner as well", /flagNeedsHuman\([^)]*"bot_failed"\)/.test(widget));
ok("an unanswered message is left waiting in the inbox", /if \(!quiet\) \{[\s\S]{0,200}status: "Replied"/.test(widget));
ok("silence is not written into the conversation's memory", /if \(!quiet\) \{[\s\S]{0,220}saveMemory/.test(widget));

// The alert has to say which of the two situations it is.
ok("flagNeedsHuman takes a reason", /export async function flagNeedsHuman\(clientId, senderId, preview, platform, reason\)/.test(bot));
ok("the push says the bot could not answer", /got no answer/.test(bot) && /could not reply/.test(bot));
ok("the email has a separate wording for it", /botFailed/.test(email) && /nothing was sent to them/.test(email));
ok("the email points the owner at the inbox", /saved and waiting there/.test(email));

console.log(`t-quiet-failure: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
