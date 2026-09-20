// How a connection started INSIDE the Android/iOS app finds its way back to
// the app. Pure (no imports), shared by the API route that starts the trip,
// the page that ends it, the dashboard that listens for it, and the tests.
//
// Why this exists (owner's report, 2026-09-21): the app is a WebView on
// tellmoreai.com. Facebook, Instagram, WhatsApp and Google refuse to run their
// login inside a WebView, so the login has to happen in a real browser. Done
// naively — a link the WebView hands to the phone's browser — the owner ends
// up in Chrome, on a dashboard where they are not signed in, and the app never
// hears about it. The professional pattern (AppAuth, RFC 8252) is:
//   1. the app opens the login in a BROWSER SHEET over itself (Chrome Custom
//      Tab / SFSafariViewController — @capacitor/browser);
//   2. the last page of the login redirects to the app's OWN address,
//      tellmoreai://connected?…, which the OS routes to the app;
//   3. the app closes the sheet and refreshes. The owner never left the app.
// The sheet has its own cookie jar, so step 2 knows it is an app trip from a
// short-lived cookie set in step 1 (/api/app/connect).

export const APP_SCHEME = "tellmoreai";
export const APP_COOKIE = "tm_app";
export const APP_COOKIE_MAX_AGE = 20 * 60; // seconds — longer than any login takes

// The only places an app trip may start. Anything else is refused, so
// /api/app/connect can never be used as an open redirect.
const STARTS = ["/api/fb/login", "/api/ig/login", "/api/wa/embedded", "/api/wa/login", "/api/gcal/login"];

// "to" as given by the app → the same-origin path to start at, or null.
export function safeConnectTarget(to) {
  const s = String(to || "");
  if (!s.startsWith("/") || s.startsWith("//") || s.includes("\\") || /[\r\n]/.test(s)) return null;
  const path = s.split("?")[0];
  return STARTS.includes(path) ? s : null;
}

const PLATFORMS = ["facebook", "instagram", "whatsapp", "gcal"];
const clip = (v, n) => String(v ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, n);

// The address the last page redirects to. Nothing secret ever goes in it: a
// platform, the connected Page's name, or a sentence saying why it failed.
export function appReturnUrl(kind, { platform = "", name = "", reason = "" } = {}) {
  const p = PLATFORMS.includes(platform) ? platform : "";
  const q = new URLSearchParams();
  if (p) q.set("platform", p);
  if (kind === "connected") { if (name) q.set("name", clip(name, 80)); }
  else if (reason) q.set("reason", clip(reason, 240));
  const host = kind === "connected" ? "connected" : "connect-failed";
  const qs = q.toString();
  return `${APP_SCHEME}://${host}${qs ? "?" + qs : ""}`;
}

// What the app makes of the address it was opened with; null when it is not ours.
export function parseAppUrl(url) {
  const s = String(url || "");
  const m = new RegExp(`^${APP_SCHEME}://(connected|connect-failed)/?(?:\\?(.*))?$`, "i").exec(s);
  if (!m) return null;
  const q = new URLSearchParams(m[2] || "");
  const platform = PLATFORMS.includes(q.get("platform")) ? q.get("platform") : "";
  return m[1].toLowerCase() === "connected"
    ? { kind: "connected", platform, name: clip(q.get("name"), 80) }
    : { kind: "failed", platform, reason: clip(q.get("reason"), 240) };
}

// The message each connect screen in the dashboard already listens for (the
// popup flow posts the same strings from connect-page.js).
export const DONE_EVENT = { facebook: "fb_connected", instagram: "ig_connected", whatsapp: "wa_connected", gcal: "gcal-connected" };
