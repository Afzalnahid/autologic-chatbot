// Message echoes. When the owner answers a customer by hand in the Messenger
// app or Page Inbox, Meta reports it ONLY as an echo. Echoes used to be dropped
// wholesale, so a human reply reached neither the dashboard thread nor the bot's
// memory and the bot answered as if nothing had been said. The bot's OWN sends
// come back as echoes too and must still be dropped — they carry our app_id.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { loadPure } from "./shim.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const MSG = join(here, "..", "src", "lib", "messenger.js");

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

// Our own Meta app ids, read by messenger.js at load — set BEFORE loading.
process.env.FB_APP_ID = "771122";
process.env.IG_APP_ID = "881133";
const { parseMessengerEvent, parseWhatsAppEvent } = await loadPure(MSG, "tmp-echo.mjs");

const PAGE = "1122334455", CUST = "9988776655";
const wrap = (messaging, object = "page") => ({ object, entry: [{ id: PAGE, messaging: [messaging] }] });

// ── An ordinary inbound customer message is unchanged ────────────────────────
const inbound = parseMessengerEvent(wrap({
  sender: { id: CUST }, recipient: { id: PAGE }, message: { mid: "m1", text: "powerbank ache?" },
}));
ok("inbound still parses", !!inbound);
ok("inbound is not an echo", !inbound.echo);
ok("inbound sender is the customer", inbound.senderId === CUST);
ok("inbound page is the page", inbound.pageId === PAGE);

// ── Our OWN send comes back as an echo carrying our app_id → still dropped ───
ok("our own send (app_id) is dropped", parseMessengerEvent(wrap({
  sender: { id: PAGE }, recipient: { id: CUST },
  message: { mid: "m2", text: "জি ভাইয়া, আছে", is_echo: true, app_id: 771122 },
})) === null);

// ── An echo stamped with META'S OWN app id (Business Suite / Page Inbox /
// Messenger app) is a HUMAN reply → captured. "Has an app_id" ≠ "is ours". ──
const suite = parseMessengerEvent(wrap({
  sender: { id: PAGE }, recipient: { id: CUST },
  message: { mid: "m2b", text: "Business Suite theke reply", is_echo: true, app_id: 263902037430900 },
}));
ok("Business Suite echo (foreign app_id) is captured", !!suite && suite.echo === true);
ok("Business Suite echo keeps the text", suite && suite.text === "Business Suite theke reply");
ok("our IG app id is also ours", parseMessengerEvent(wrap({
  sender: { id: PAGE }, recipient: { id: CUST },
  message: { mid: "m2c", text: "x", is_echo: true, app_id: "881133" },
}, "instagram")) === null);

// ── A human typing in Meta's inbox with NO app_id at all → must be captured ─
const human = parseMessengerEvent(wrap({
  sender: { id: PAGE }, recipient: { id: CUST },
  message: { mid: "m3", text: "ভাইয়া ৩০০০ টাকা দিলেই হবে", is_echo: true },
}));
ok("human echo is captured", !!human);
ok("human echo is flagged as an echo", human.echo === true);
// In an echo the ids are the other way round: the page SENT it to the customer.
ok("echo senderId is the CUSTOMER", human.senderId === CUST);
ok("echo pageId is the PAGE", human.pageId === PAGE);
ok("echo keeps the text", human.text === "ভাইয়া ৩০০০ টাকা দিলেই হবে");
ok("echo keeps the message id", human.msgId === "m3");
ok("echo never carries audio", human.audio === null);
ok("echo never carries video", human.video === false);

// A human echo with a photo keeps the image so the thread is complete.
const withPhoto = parseMessengerEvent(wrap({
  sender: { id: PAGE }, recipient: { id: CUST },
  message: { mid: "m4", is_echo: true, attachments: [{ type: "image", payload: { url: "https://x/a.jpg" } }] },
}));
ok("echo keeps an image", withPhoto.images.length === 1 && withPhoto.images[0] === "https://x/a.jpg");
ok("echo with only a photo has empty text", withPhoto.text === "");

// Instagram sends echoes the same way.
const ig = parseMessengerEvent(wrap({
  sender: { id: PAGE }, recipient: { id: CUST }, message: { mid: "m5", text: "hi", is_echo: true },
}, "instagram"));
ok("instagram echo is captured", ig && ig.echo === true && ig.platform === "instagram");

// ── WhatsApp: a reply typed on the owner's own phone (coexistence echo) ──────
const waWrap = (field, value) => ({ object: "whatsapp_business_account", entry: [{ id: "WABA1", changes: [{ field, value }] }] });
const META = { display_phone_number: "8801700000000", phone_number_id: "PHONE1" };
const waEcho = parseWhatsAppEvent(waWrap("smb_message_echoes", {
  messaging_product: "whatsapp", metadata: META,
  message_echoes: [{ from: "8801700000000", to: "8801911111111", id: "wamid.E1", timestamp: "1789120000", type: "text", text: { body: "500 tk e dite parbo" } }],
}));
ok("wa phone echo is captured", !!waEcho && waEcho.echo === true && waEcho.platform === "whatsapp");
ok("wa echo customer is `to`", waEcho.senderId === "8801911111111");
ok("wa echo number is the phone_number_id", waEcho.pageId === "PHONE1");
ok("wa echo keeps text + id", waEcho.text === "500 tk e dite parbo" && waEcho.msgId === "wamid.E1");
const waPhoto = parseWhatsAppEvent(waWrap("smb_message_echoes", {
  messaging_product: "whatsapp", metadata: META,
  message_echoes: [{ from: "8801700000000", to: "8801911111111", id: "wamid.E2", type: "image", image: { id: "MEDIA1", caption: "ei ta" } }],
}));
ok("wa photo echo keeps the caption and marks a photo", waPhoto.text === "ei ta" && waPhoto.images.length === 1 && !/^https?:/.test(waPhoto.images[0]));
ok("wa echo with no `to` is dropped", parseWhatsAppEvent(waWrap("smb_message_echoes", { metadata: META, message_echoes: [{ from: "x", id: "wamid.E3", text: { body: "hi" } }] })) === null);
// The other coexistence webhooks are still ignored — the bot must never
// answer replayed history or contact syncs.
ok("wa history replay is still dropped", parseWhatsAppEvent(waWrap("history", { metadata: META, messages: [{ from: "8801911111111", id: "wamid.H1", text: { body: "old" } }] })) === null);
ok("wa app state sync is still dropped", parseWhatsAppEvent(waWrap("smb_app_state_sync", { metadata: META })) === null);
// An ordinary customer message is unchanged.
const waIn = parseWhatsAppEvent(waWrap("messages", { metadata: META, contacts: [{ profile: { name: "Rima" } }], messages: [{ from: "8801911111111", id: "wamid.M1", type: "text", text: { body: "dam koto?" } }] }));
ok("wa customer message still parses", waIn && !waIn.echo && waIn.senderId === "8801911111111" && waIn.text === "dam koto?" && waIn.profileName === "Rima");

// ── Junk never throws and never invents an event ─────────────────────────────
ok("echo with no recipient is dropped", parseMessengerEvent(wrap({
  sender: { id: PAGE }, message: { mid: "m6", text: "x", is_echo: true },
})) === null);
ok("no message at all is dropped", parseMessengerEvent(wrap({ sender: { id: CUST } })) === null);
ok("empty body is dropped", parseMessengerEvent({}) === null);

console.log(fail === 0 ? `${pass} passed, 0 failed` : `${pass} passed, ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
