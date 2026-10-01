// A paused channel still RECEIVES. "Paused" means the bot stays quiet there and
// the messages wait for the owner (the customer manual says so), but every
// lookup used to ask for status "connected" only, so a paused Page's messages
// were dropped before they reached the inbox, the owner could not answer them,
// and "Hand back" could fall through to a different Page (owner, 2026-10-02).
// The lookups need the database, so the wiring is checked against the source.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (...p) => readFileSync(join(root, ...p), "utf8");

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

const channels = read("src", "lib", "channels.js");
const m = channels.match(/export const RECEIVING = (\[[^\]]*\])/);
const RECEIVING = m ? JSON.parse(m[1]) : null;
ok("RECEIVING is exported from lib/channels.js", !!RECEIVING);
ok("RECEIVING is exactly connected + paused", JSON.stringify(RECEIVING) === JSON.stringify(["connected", "paused"]));

const bot = read("src", "lib", "bot.js");
const fnBody = (src, name) => {
  const i = src.indexOf(`function ${name}(`);
  return i < 0 ? "" : src.slice(i, src.indexOf("\n}\n", i));
};
const getCh = fnBody(bot, "getChannelByPage");
ok("getChannelByPage finds paused channels", /\.in\("status", RECEIVING\)/.test(getCh));
ok("getChannelByPage no longer asks for connected only", !/\.eq\("status", "connected"\)/.test(getCh));
const allowed = fnBody(bot, "botAllowed");
ok("botAllowed keeps the bot silent on a paused channel",
  /channel\.status === "paused"[^\n]*channel_paused[^\n]*silent: true/.test(allowed));

// every path that takes a message in or sends the owner's reply
for (const [label, path] of [
  ["website widget", ["src", "app", "api", "widget", "chat", "route.js"]],
  ["owner's text reply", ["src", "app", "api", "send-message", "route.js"]],
  ["owner's photo/voice reply", ["src", "app", "api", "send-media", "route.js"]],
  ["hand back to the bot", ["src", "app", "api", "contacts", "route.js"]],
]) {
  const src = read(...path);
  ok(`${label}: imports RECEIVING`, /import \{ RECEIVING \} from "@\/lib\/channels\.js"/.test(src));
  ok(`${label}: looks up RECEIVING channels`, /\.in\("status", RECEIVING\)/.test(src));
}

// "Hand back" must never answer from a different platform's channel
const contacts = read("src", "app", "api", "contacts", "route.js");
const rtp = fnBody(contacts, "replyToPending");
ok("hand back does not fall back to any channel at all", !/\|\|\s*\(chans \|\| \[\]\)\[0\]/.test(rtp));

// comments on a paused Page are still left alone
ok("comments are not answered on a paused channel", /channel\.status === "paused" \|\| channel\.bot_enabled === false\) return;/.test(bot));

console.log(`t-paused-channel: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
