// What the platform owner is told, and how loudly.
//
// Owner, 2026-09-24: "From the admin panel I don't get any notifications when
// any customer enters, or any error occurs, or something happens — it is bad
// for me." Two emails existed in the whole product; a business could register,
// a bot could stop replying, an AI key could die and a route could start
// failing, and the console said nothing.
//
// The catalogue and the quiet periods are pure and tested here; the wiring —
// that the events are actually raised where those things happen — is checked
// against the source, because those files need a database to run.
import { fileURLToPath } from "node:url";
import { loadPure } from "./shim.mjs";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (...p) => readFileSync(join(root, ...p), "utf8");
// The module reaches for supabase at the top; everything tested here is pure,
// so it loads with the imports stripped (see tests/shim.mjs).
const M = await loadPure(join(root, "src", "lib", "platform-events.js"), "tmp-platform-events.mjs");
const { EVENTS, EVENT_KINDS, SEVERITIES, normaliseKind, eventMeta, UNKNOWN_EVENT, groupEvents, unreadCount, shouldLog } = M;

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

// ── the catalogue ──────────────────────────────────────────────────────────
ok("the things the owner asked about are all here",
  ["client_signup", "server_error", "payment_request"].every((k) => EVENT_KINDS.includes(k)));
ok("so is a bot going quiet, a dead key and a dropped channel",
  ["bot_blocked", "key_failing", "channel_expired"].every((k) => EVENT_KINDS.includes(k)));
ok("every kind has a severity we recognise", EVENT_KINDS.every((k) => SEVERITIES.includes(EVENTS[k].severity)));
ok("every kind has words a person can read", EVENT_KINDS.every((k) => EVENTS[k].label && EVENTS[k].icon));
ok("money is urgent", EVENTS.payment_request.severity === "urgent");
ok("a server error is urgent", EVENTS.server_error.severity === "urgent");
ok("a new business is good news, not an alarm", EVENTS.client_signup.severity === "info");

// Email is the loudest channel and is spent sparingly: only what must not be
// missed even if the console is not open.
{
  const emailed = EVENT_KINDS.filter((k) => EVENTS[k].email);
  ok("only a couple of things are emailed", emailed.length > 0 && emailed.length <= 3);
  ok("money is one of them", emailed.includes("payment_request"));
  ok("a routine sign-up is NOT emailed", !EVENTS.client_signup.email);
}
ok("a deleted business is recorded but does not buzz anybody", EVENTS.client_deleted.push === false);

// ── reading a kind ─────────────────────────────────────────────────────────
ok("a known kind passes through", normaliseKind("client_signup") === "client_signup");
ok("an unknown kind is refused rather than guessed", normaliseKind("whatever") === null && normaliseKind("") === null);
ok("and still gets safe, silent defaults", eventMeta("whatever") === UNKNOWN_EVENT && UNKNOWN_EVENT.push === false && UNKNOWN_EVENT.email === false);

// ── the bell's own arithmetic ──────────────────────────────────────────────
{
  const rows = [{ id: 1, severity: "urgent" }, { id: 2, severity: "info" }, { id: 3, severity: "warn" }, { id: 4, severity: "nonsense" }];
  const g = groupEvents(rows);
  ok("events are grouped by how loud they are", g.urgent.length === 1 && g.warn.length === 1 && g.info.length === 2);
  ok("an unknown severity is treated as the quietest, never dropped", g.info.some((r) => r.id === 4));
  ok("nothing in, nothing out", JSON.stringify(groupEvents(null)) === JSON.stringify({ urgent: [], warn: [], info: [] }));

  ok("unread counts what this admin has not seen", unreadCount(rows, [1, 2]) === 2);
  ok("having seen nothing means everything is unread", unreadCount(rows, []) === 4);
  ok("having seen everything means none", unreadCount(rows, [1, 2, 3, 4]) === 0);
}

// ── a storm collapses into one line ────────────────────────────────────────
// A route that starts failing fails a lot. A bell that rings a thousand times
// is a bell you switch off, and then the urgent ones are lost too.
{
  const now = Date.now();
  ok("the first server error is always written", shouldLog("server_error", null, now) === true);
  ok("a second one a minute later is not", shouldLog("server_error", new Date(now - 60_000).toISOString(), now) === false);
  ok("but one eleven minutes later is", shouldLog("server_error", new Date(now - 11 * 60_000).toISOString(), now) === true);
  ok("a bot going quiet is quiet for an hour", shouldLog("bot_blocked", new Date(now - 30 * 60_000).toISOString(), now) === false);
  ok("a new business is never suppressed — each one matters", shouldLog("client_signup", new Date(now - 1000).toISOString(), now) === true);
  ok("a payment is never suppressed either", shouldLog("payment_request", new Date(now - 1000).toISOString(), now) === true);
}

// ── raised where those things actually happen ──────────────────────────────
const wired = [
  ["a business registers", ["src", "app", "api", "me", "route.js"], "client_signup"],
  ["a payment is submitted", ["src", "app", "api", "billing", "route.js"], "payment_request"],
  ["a route throws", ["src", "lib", "route-errors.js"], "server_error"],
  ["an AI key dies", ["src", "lib", "ai.js"], "key_failing"],
  ["a bot is blocked", ["src", "lib", "bot.js"], "bot_blocked"],
  ["a channel expires", ["src", "app", "api", "cron", "channels", "route.js"], "channel_expired"],
];
for (const [what, f, kind] of wired) {
  const src = read(...f);
  ok(`the owner is told when ${what}`, src.includes(`kind: "${kind}"`));
  ok(`…and it never blocks that path`, /logEvent\([\s\S]{0,400}\)\)?\.catch\(\(\) => \{\}\)/.test(src) || /\.catch\(\(\) => \{\}\)/.test(src));
}

// The safety net must not become the thing that fails.
ok("route-errors imports the logger lazily, inside the catch",
  /import\("@\/lib\/platform-events\.js"\)/.test(read("src", "lib", "route-errors.js")));

// ── the console reads it ───────────────────────────────────────────────────
const api = read("src", "app", "api", "admin", "events", "route.js");
ok("there is an endpoint for the bell", /export async function GET/.test(api) && /platform_events/.test(api));
ok("reading is per-admin, so two people do not clear each other's bell", /platform_event_reads/.test(api) && /\.eq\("email", email\)/.test(api));
ok("marking read twice is the same as once", /upsert\(/.test(api));
ok("a pending or blocked admin sees nothing", /role === "pending" \|\| role === "blocked"/.test(api));

const bell = read("src", "app", "admin", "AdminBell.js");
ok("the console has a bell", /ti-bell/.test(bell));
ok("it shows how many are unread", /st\.unread/.test(bell));
ok("urgent ones are a different colour", /urgentUnread \? T\.danger/.test(bell));
ok("it refreshes by itself and when the tab comes back", /setInterval\(load/.test(bell) && /visibilitychange/.test(bell));
ok("tapping one opens that business", /openDetail\(e\.client_id\)/.test(bell));
ok("a bell that cannot load stays quiet about it", /if \(!r \|\| r\.error\) return;/.test(bell));
ok("it is placed in the console's header", /<AdminBell /.test(read("src", "app", "admin", "admin-client.js")));

// ── the admin app and the user app are two different apps ───────────────────
// Owner, 2026-09-24: "my native app which is for users automatically converted
// to admin app — the admin app and the user app will be separated. There will
// be two separated apps, one is for user where the user notification comes, and
// an admin app where the admin panel notifications come."
//
// A shield button in the client dashboard and admin alerts addressed to an
// admin's own CLIENT id are what merged them. Both are gone, and these
// assertions are here so neither comes back by accident.
{
  const shell = read("src", "app", "dashboard", "components", "Shell.js");
  ok("the client dashboard has NO link to the admin console", !/href="\/admin"/.test(shell));
  ok("and /api/me does not tell it who is an admin",
    !/is_admin/.test(read("src", "app", "api", "me", "route.js")));

  const ev = read("src", "lib", "platform-events.js");
  ok("platform alerts go to admins by EMAIL, not by their client id",
    /notifyAdmin\(email/.test(ev) && !/adminClientIds/.test(ev));
  ok("…through the admin-only sender", /admin-push\.js/.test(ev));
  ok("a platform alert still points at the console", ev.includes('url: "/admin"'));

  const ap = read("src", "lib", "admin-push.js");
  ok("an admin device is stored in its own table", /admin_fcm_tokens/.test(ap) && /admin_push_subscriptions/.test(ap));
  ok("and nothing in there reads a client's devices",
    !/from\("fcm_tokens"\)/.test(ap) && !/from\("push_subscriptions"\)/.test(ap));
  ok("client sending never reads the admin tables",
    !/admin_/.test(read("src", "lib", "fcm.js")) && !/admin_/.test(read("src", "lib", "push.js")));

  const reg = read("src", "app", "admin", "admin-push.js");
  ok("only the admin app may register as an admin device", /com\.tellmoreai\.admin/.test(reg));
  ok("the check is made before the token is sent", /isAdminApp\(\)\)\) return/.test(reg));
  ok("registration is auth-gated on the server",
    /callerRole/.test(read("src", "app", "api", "admin", "push", "route.js")));

  // Both notification paths still follow the url they are given, which is what
  // lets an admin alert open the console inside the ADMIN app.
  ok("the native app opens the url a notification carries",
    read("src", "app", "dashboard", "components", "native-push.js").includes("window.location.href = url;"));
  ok("so does the browser's service worker", read("public", "sw.js").includes("openWindow(url)"));
}

console.log(`t-platform-events: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
