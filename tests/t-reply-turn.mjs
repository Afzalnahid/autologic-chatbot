// Usage is measured per BOT REPLY, not per bubble. One reply is saved as several
// message_buffer rows (a photo, the text, a follow-up question); botReplyRows
// flags EXACTLY the first as the counted reply_turn, so the plan limit counts
// replies, not bubbles, and never a customer or agent row.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { loadPure } from "./shim.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const BOT = join(here, "..", "src", "lib", "bot.js");

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

const { botReplyRows } = await loadPure(BOT, "tmp-reply-turn.mjs");

const base = { sender_id: "s1", client_id: "c1", platform: "facebook", page_id: "p1" };

// A three-bubble reply: image + text + question → exactly ONE reply_turn.
const three = botReplyRows([
  { type: "image_msg", url: "https://x/a.jpg" },
  { type: "text_msg", text: "Solar power bank" },
  { type: "text_msg", text: "Which mAh?" },
], base);
ok("three bubbles → three rows", three.length === 3);
ok("exactly one reply_turn flagged", three.filter((r) => r.reply_turn).length === 1);
ok("the FIRST bubble is the flagged one", three[0].reply_turn === true && three[1].reply_turn === false && three[2].reply_turn === false);
ok("every row is a bot row", three.every((r) => r.role === "bot" && r.status === "Replied"));
ok("base fields are carried through", three[0].sender_id === "s1" && three[0].client_id === "c1" && three[0].page_id === "p1");
ok("image row stores the url as attachment and a photo label", three[0].message_content === "📷 Photo" && three[0].attachments === "https://x/a.jpg");
ok("text row stores the text, no attachment", three[1].message_content === "Solar power bank" && three[1].attachments === null);

// A single-bubble reply is one counted reply.
const one = botReplyRows([{ type: "text_msg", text: "hi" }], base);
ok("single bubble → one row, flagged", one.length === 1 && one[0].reply_turn === true);

// No items → nothing to save, nothing counted.
ok("empty reply → no rows", botReplyRows([], base).length === 0);
ok("null items → no rows", botReplyRows(null, base).length === 0);

// The flag is a real boolean (so the DB column gets true/false, never undefined).
ok("flags are booleans", three.every((r) => typeof r.reply_turn === "boolean"));

console.log(fail === 0 ? `${pass} passed, 0 failed` : `${pass} passed, ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
