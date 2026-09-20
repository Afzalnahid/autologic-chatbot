// The app's login trip: where it may start, the address it comes back on, and
// what the app reads from that address. app-return.js has no imports.
import { safeConnectTarget, appReturnUrl, parseAppUrl, DONE_EVENT, APP_SCHEME } from "../src/lib/app-return.js";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) pass++; else { fail++; console.error("FAIL:", name, typeof extra === "string" ? extra : JSON.stringify(extra)); } };

// Where a trip may start — and nowhere else (no open redirect).
ok("facebook login with its client id", safeConnectTarget("/api/fb/login?client_id=abc") === "/api/fb/login?client_id=abc");
ok("instagram, whatsapp hub, whatsapp login, google calendar", ["/api/ig/login?client_id=1", "/api/wa/embedded?client_id=1", "/api/wa/login?client_id=1", "/api/gcal/login?client_id=1"].every((u) => safeConnectTarget(u) === u));
ok("another site is refused", safeConnectTarget("https://evil.example/api/fb/login") === null);
ok("a protocol-relative address is refused", safeConnectTarget("//evil.example/api/fb/login") === null);
ok("a backslash trick is refused", safeConnectTarget("/\\evil.example") === null);
ok("any other path on our own site is refused", safeConnectTarget("/dashboard") === null && safeConnectTarget("/api/admin/clients") === null);
ok("a look-alike path is refused", safeConnectTarget("/api/fb/login/../../admin") === null && safeConnectTarget("/api/fb/loginx") === null);
ok("a header-splitting newline is refused", safeConnectTarget("/api/fb/login?x=1\r\nSet-Cookie: a=b") === null);
ok("nothing is refused quietly", safeConnectTarget("") === null && safeConnectTarget(null) === null);

// The address the last page redirects to.
ok("connected carries the platform and the name", appReturnUrl("connected", { platform: "facebook", name: "Nokshi Threads" }) === "tellmoreai://connected?platform=facebook&name=Nokshi+Threads");
ok("a failure carries the reason", appReturnUrl("failed", { platform: "gcal", reason: "Not in your package" }) === "tellmoreai://connect-failed?platform=gcal&reason=Not+in+your+package");
ok("an unknown platform is dropped, not passed on", appReturnUrl("connected", { platform: "tiktok", name: "x" }) === "tellmoreai://connected?name=x");
ok("a long or multi-line reason is clipped to one line", (() => { const u = appReturnUrl("failed", { platform: "facebook", reason: "a\nb" + "x".repeat(500) }); const r = parseAppUrl(u).reason; return r.length === 240 && !/\n/.test(r); })());
ok("a connected address never carries a reason, a failed one never a name", !appReturnUrl("connected", { platform: "facebook", reason: "x" }).includes("reason") && !appReturnUrl("failed", { platform: "facebook", name: "x" }).includes("name"));

// What the app reads back.
let r = parseAppUrl("tellmoreai://connected?platform=whatsapp&name=%2B880+1322-916440");
ok("the app reads a connection", r && r.kind === "connected" && r.platform === "whatsapp" && r.name === "+880 1322-916440", r);
r = parseAppUrl(appReturnUrl("failed", { platform: "instagram", reason: "You closed the login." }));
ok("and a failure, round trip", r && r.kind === "failed" && r.platform === "instagram" && r.reason === "You closed the login.", r);
ok("a bare address works", parseAppUrl("tellmoreai://connected")?.kind === "connected" && parseAppUrl("tellmoreai://connected/")?.kind === "connected");
ok("somebody else's address is not ours", parseAppUrl("https://www.tellmoreai.com/dashboard") === null && parseAppUrl("tellmoreai://evil") === null && parseAppUrl("othertellmoreai://connected") === null && parseAppUrl("") === null);
ok("the scheme is matched whatever its case", parseAppUrl("TELLMOREAI://connected?platform=facebook")?.platform === "facebook");

// The messages the dashboard's connect screens already listen for.
ok("every platform has its done message", DONE_EVENT.facebook === "fb_connected" && DONE_EVENT.instagram === "ig_connected" && DONE_EVENT.whatsapp === "wa_connected" && DONE_EVENT.gcal === "gcal-connected");
ok("the scheme is the one the Android manifest registers", APP_SCHEME === "tellmoreai");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
