// The owner answering a website visitor by hand. A visitor has no address to
// push to, so a reply typed in the inbox used to be sent to Facebook with the
// widget's empty token, fail, and never arrive (owner, 2026-10-02). Now it is
// saved and the widget on the visitor's page fetches it (GET /api/widget/chat).
// The rules are pure (lib/widget.js); the wiring is checked against the source.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (...p) => readFileSync(join(root, ...p), "utf8");
const W = await import(pathToFileURL(join(root, "src", "lib", "widget.js")).href);

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

// ── pollSince: what "after" may be ──────────────────────────────────────────
const NOW = Date.parse("2026-10-02T07:00:00Z");
ok("a database timestamp passes through untouched (microseconds kept)",
  W.pollSince("2026-10-02T06:59:07.123456+00:00", NOW) === "2026-10-02T06:59:07.123456+00:00");
ok("garbage becomes 'a day ago'", W.pollSince("'; drop table", NOW) === "2026-10-01T07:00:00.000Z");
ok("nothing becomes 'a day ago'", W.pollSince("", NOW) === "2026-10-01T07:00:00.000Z");
ok("older than a day is clamped to a day", W.pollSince("2026-09-01T00:00:00Z", NOW) === "2026-10-01T07:00:00.000Z");
ok("a future time is clamped to now", W.pollSince("2027-01-01T00:00:00Z", NOW) === "2026-10-02T07:00:00.000Z");

// ── nextSince: the next cut-off ─────────────────────────────────────────────
ok("with rows: the newest row shown", W.nextSince([{ created_at: "a" }, { created_at: "b" }], "x", NOW) === "b");
ok("without rows: ten seconds behind now, so a reply saved mid-poll is not skipped",
  W.nextSince([], "2026-10-02T06:00:00Z", NOW) === new Date(NOW - W.POLL_OVERLAP_MS).toISOString());
ok("without rows: never moves backwards past a newer cut-off",
  W.nextSince([], "2026-10-02T06:59:58Z", NOW) === "2026-10-02T06:59:58Z");

// ── agentItems: rows → what the widget shows ───────────────────────────────
const items = W.agentItems([
  { message_content: "হ্যাঁ আপু, আছে", attachments: null, created_at: "t1" },
  { message_content: "📷 Photo", attachments: "https://x.supabase.co/p.jpg", created_at: "t2" },
  { message_content: "ok", attachments: "javascript:alert(1)", created_at: "t3" },
]);
ok("text becomes a text item", items[0].type === "text_msg" && items[0].text === "হ্যাঁ আপু, আছে");
ok("a photo becomes an image item, without its placeholder text",
  items[1].type === "image_msg" && items[1].url === "https://x.supabase.co/p.jpg" && !items.some((i) => i.text === "📷 Photo"));
ok("only https links are shown as images", !items.some((i) => /javascript/.test(i.url || "")));
ok("every item carries its row time, for the widget to skip repeats", items.every((i) => i.at));

// ── the poll route ──────────────────────────────────────────────────────────
const route = read("src", "app", "api", "widget", "chat", "route.js");
const get = route.slice(route.indexOf("export const GET"), route.indexOf("export const POST"));
ok("GET checks the key and the site's origin like POST", /channelForKey\(q\.get\("k"\)\)/.test(get) && /originAllowed\(origin, channel\.allowed_domains\)/.test(get));
ok("GET is scoped to the channel's client", /\.eq\("client_id", channel\.client_id\)/.test(get));
ok("GET reads only this visitor's conversation", /\.eq\("sender_id", `web_\$\{sessionId\}`\)/.test(get));
ok("GET returns only the owner's replies", /\.eq\("role", "agent"\)/.test(get));
ok("GET is rate-limited", /rateLimit\(`widget-poll:/.test(get));

// ── the owner's send paths ─────────────────────────────────────────────────
const sm = read("src", "app", "api", "send-message", "route.js");
ok("a text reply to a website visitor is not sent to Meta", /if \(platform === "website"\) \{[\s\S]*?\} else if \(platform === "whatsapp"\)/.test(sm));
ok("a text reply never falls back to any channel at all", !/\|\|\s*\(chans \|\| \[\]\)\[0\]/.test(sm));
const media = read("src", "app", "api", "send-media", "route.js");
ok("a photo to a website visitor is not sent to Meta", /if \(platform === "website"\) \{[\s\S]*?\} else if \(platform === "whatsapp"\)/.test(media));
ok("a voice note to a website visitor is refused in plain words", /platform === "website" && kind === "audio"/.test(media));
ok("a photo/voice reply never falls back to any channel at all", !/\|\|\s*\(chans \|\| \[\]\)\[0\]/.test(media));

// ── the widget script ───────────────────────────────────────────────────────
const js = read("public", "widget.js");
ok("the widget polls the same endpoint with GET", /fetch\(url\)/.test(js) && /"\?k=" \+ encodeURIComponent\(KEY\)/.test(js));
ok("only a visitor who has written polls", /if \(!talked \|\| document\.hidden\) return;/.test(js));
ok("the widget skips a reply it has already shown", /if \(seen\[id\]\) return false;/.test(js));

console.log(`t-widget-replies: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
