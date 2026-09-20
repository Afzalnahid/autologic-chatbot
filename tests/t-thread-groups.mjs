// Which pictures in a chat belong together. The module has no imports, so it
// is loaded where it lives.
import { groupThread, plainText, BURST_MS } from "../src/lib/thread-groups.js";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) pass++; else { fail++; console.error("FAIL:", name, typeof extra === "string" ? extra : JSON.stringify(extra)); } };
const T0 = new Date("2026-09-21T10:00:00Z").getTime();
const at = (s) => new Date(T0 + s * 1000).toISOString();
const pic = (role, url, s, text = "📷 Photo") => ({ role, text, attachments: [url], time: at(s) });

// The placeholders a picture carries are not text.
ok("a customer's photo has no text", plainText({ text: "📷 Photo", attachments: ["a"] }) === "");
ok("the bot's image line is dropped, its words kept", plainText({ text: "Here it is\n🖼️ Image", attachments: ["a"] }) === "Here it is");
ok("plain messages pass through", plainText({ text: "hello", attachments: [] }) === "hello");
ok("a message that really says 🖼️ Image with no picture keeps it", plainText({ text: "🖼️ Image", attachments: [] }) === "🖼️ Image");

// A burst: one photo per message, seconds apart → one group.
let g = groupThread([pic("customer", "a", 0), pic("customer", "b", 2), pic("customer", "c", 5), { role: "customer", text: "which one?", attachments: [], time: at(9) }]);
ok("three photos in a burst are one group, then the text", g.length === 2 && g[0].imgs.join() === "a,b,c" && g[1].text === "which one?", g.map((x) => x.imgs));
ok("the group's time is its first photo's", g[0].m.time === at(0));

// Several attachments on ONE message.
g = groupThread([{ role: "customer", text: "📷 Photo", attachments: ["a", "b", "c", "d"], time: at(0) }]);
ok("four attachments on one message are one group", g.length === 1 && g[0].imgs.length === 4 && g[0].onlyPics);

// Not a burst: too far apart, the other side, or another day.
g = groupThread([pic("customer", "a", 0), pic("customer", "b", BURST_MS / 1000 + 5)]);
ok("photos more than two minutes apart stay separate", g.length === 2);
g = groupThread([pic("customer", "a", 0), pic("agent", "b", 3)]);
ok("the owner's photo does not join the customer's", g.length === 2 && g[1].m.role === "agent");
g = groupThread([pic("customer", "a", 0), { role: "bot", text: "Nice!", attachments: [], time: at(1) }, pic("customer", "b", 2)]);
ok("a message in between breaks the burst", g.length === 3);
// The window slides: each photo within two minutes of the PREVIOUS one.
g = groupThread([pic("customer", "a", 0), pic("customer", "b", 100), pic("customer", "c", 200)]);
ok("a slow burst still groups photo by photo", g.length === 1 && g[0].imgs.length === 3);

// A photo with a caption is its own item, and ends a burst.
g = groupThread([pic("customer", "a", 0), { role: "customer", text: "this one in red?", attachments: ["b"], time: at(2) }, pic("customer", "c", 4)]);
ok("a captioned photo stands alone", g.length === 3 && g[1].text === "this one in red?" && g[1].imgs.join() === "b" && !g[1].onlyPics);

// The bot's product picture stays a card; its other pictures are pictures.
const productFor = (u) => (u === "prod.jpg" ? { id: "p1", product_name: "Panjabi" } : null);
g = groupThread([{ role: "bot", text: "Yes, in stock.\n🖼️ Image", attachments: ["prod.jpg"], time: at(0) }], productFor);
ok("a product's own image is a card, not a picture", g[0].cards.length === 1 && g[0].imgs.length === 0 && g[0].text === "Yes, in stock.");
g = groupThread([{ role: "customer", text: "📷 Photo", attachments: ["prod.jpg"], time: at(0) }], productFor);
ok("the same image from a CUSTOMER is just a picture", g[0].cards.length === 0 && g[0].imgs.join() === "prod.jpg");
g = groupThread([{ role: "bot", text: "🖼️ Image\n🖼️ Image", attachments: ["prod.jpg", "size-chart.png"], time: at(0) }], productFor);
ok("a card and a plain picture on one bot message", g.length === 1 && g[0].cards.length === 1 && g[0].imgs.join() === "size-chart.png" && !g[0].onlyPics);

// Nothing in, nothing out; text-only threads are untouched.
ok("empty and missing threads", groupThread([]).length === 0 && groupThread(null).length === 0);
g = groupThread([{ role: "customer", text: "hi", attachments: [], time: at(0) }, { role: "bot", text: "hello", attachments: [], time: at(1) }]);
ok("text messages come through one for one", g.length === 2 && g[0].text === "hi" && g[1].text === "hello" && g.every((x) => !x.imgs.length));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
