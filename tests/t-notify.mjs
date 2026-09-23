// Which notifications the owner gets, and when.
//
// The rule the owner set on 2026-09-24: "every customer's every message should
// be in the notification, like Messenger sends us". It used to fire only for
// the FIRST message of a twenty-minute burst, so an hour-long conversation
// buzzed once and then went quiet — and the message that actually mattered, a
// price or a complaint, usually arrived several lines in.
//
// notifyIncomingMessage touches the database, so this holds the shape of the
// code and the set of alerts rather than running them.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (...p) => readFileSync(join(root, ...p), "utf8");
const bot = read("src", "lib", "bot.js");
const widget = read("src", "app", "api", "widget", "chat", "route.js");

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

const fn = bot.slice(bot.indexOf("export async function notifyIncomingMessage"));
const body = fn.slice(0, fn.indexOf("\n}\n"));

// Every message, not the first of a burst.
ok("nothing is skipped for being mid-conversation", !/mid-conversation/.test(body));
ok("no twenty-minute window is counted any more", !/20 \* 60 \* 1000/.test(body));
ok("it does not count earlier messages before deciding", !/message_buffer/.test(body));
ok("it takes no timestamp to compare against", /notifyIncomingMessage\(clientId, senderId, content\)/.test(body));
ok("and no caller still passes one", !/notifyIncomingMessage\([^)]*created_at/.test(bot) && !/notifyIncomingMessage\([^)]*created_at/.test(widget));

// Ten messages must not become ten alerts sitting on the phone. One tag per
// customer is what makes a phone REPLACE the previous one, the way Messenger
// shows one line per conversation.
ok("alerts for one customer share a tag", /tag: "msg-" \+ senderId/.test(body));
ok("the alert shows the customer's name", /title: "💬 " \+ name/.test(body));
ok("and their latest words", /body: preview/.test(body));
ok("tapping it opens that conversation, not just the inbox", /#conversations:" \+ encodeURIComponent\(senderId\)/.test(body));
ok("a failure to notify never breaks the reply", /catch \(e\) \{ console\.error\("\[push\] new-message notify:"/.test(body));

// Every channel raises it — a customer on the website matters as much as one
// on Messenger.
ok("Messenger, Instagram and WhatsApp raise it", (bot.match(/notifyIncomingMessage\(clientId, event\.senderId/g) || []).length === 2);
ok("the website widget raises it too", /notifyIncomingMessage\(clientId, senderId, text\)/.test(widget));

// The rest of the set, each worth a buzz because each one costs the owner
// money or a customer if it is missed. Kept deliberately short: an alert that
// fires for something the owner cannot act on teaches them to ignore all of
// them.
const ALERTS = [
  ["a customer's message", /title: "💬 " \+ name/, bot],
  ["a customer who needs a person", /needs you"/, bot],
  ["a bot that could not answer", /got no answer"/, bot],
  ["the bot stopping for a billing reason", /Your bot has stopped replying/, bot],
  ["an AI key that stopped working", /Your AI key stopped working/, read("src", "lib", "ai.js")],
  ["a channel that needs reconnecting", /needs reconnecting/, read("src", "app", "api", "cron", "channels", "route.js")],
];
for (const [what, re, src] of ALERTS) ok(`the owner is told about ${what}`, re.test(src));

// One switch turns the lot off, and it is the owner's to set.
ok("every alert goes through the one notify() that checks the owner's switch",
  !/webpush|sendToFcm/.test(bot));

console.log(`t-notify: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
