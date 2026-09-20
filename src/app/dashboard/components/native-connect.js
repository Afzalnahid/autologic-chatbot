"use client";
// Connecting a channel (or Google Calendar) from INSIDE the installed app.
// Everything here is a no-op in a browser, and in an older APK that was built
// without the Browser plugin — both keep the popup / same-tab flow they had.
//
// The whole trip is described in src/lib/app-return.js. This file is the
// app's two ends of it:
//   · openConnect(path) opens the login in a browser sheet over the app
//     (Chrome Custom Tab / SFSafariViewController) instead of letting the
//     WebView throw the owner out to the phone's browser;
//   · initNativeConnect() listens for the app being opened with
//     tellmoreai://connected… and tells the dashboard exactly what the popup
//     flow would have told it — the same postMessage strings — so every
//     connect screen keeps working without knowing which flow ran.
import { isNativeApp } from "./native-push.js";
import { parseAppUrl, DONE_EVENT } from "@/lib/app-return.js";

const plugins = () => { try { return (typeof window !== "undefined" && window.Capacitor && window.Capacitor.Plugins) || {}; } catch { return {}; } };

export function canConnectInApp() {
  return isNativeApp() && !!plugins().Browser && !!plugins().App;
}

// True when the sheet was opened; false means "carry on the old way".
export async function openConnect(path) {
  if (!canConnectInApp()) return false;
  try {
    const url = new URL("/api/app/connect", window.location.origin);
    url.searchParams.set("to", path);
    await plugins().Browser.open({ url: url.href, toolbarColor: "#7B1C3E", presentationStyle: "popover" });
    return true;
  } catch { return false; }
}

function handle(url) {
  const r = parseAppUrl(url);
  if (!r) return;
  // Android closes the sheet by itself when the app comes to the front
  // (singleTask); iOS needs telling. Either way a failed close is harmless.
  try { const c = plugins().Browser?.close?.(); if (c && c.catch) c.catch(() => {}); } catch {}
  const origin = window.location.origin;
  if (r.kind === "connected") {
    if (DONE_EVENT[r.platform]) window.postMessage(DONE_EVENT[r.platform], origin);
    window.postMessage({ type: "al-connected", platform: r.platform, name: r.name }, origin);
  } else {
    window.dispatchEvent(new CustomEvent("al-connect-failed", { detail: r }));
  }
}

let _inited = false;
export function initNativeConnect() {
  if (_inited || !canConnectInApp()) return;
  _inited = true;
  const { App, Browser } = plugins();
  try { App.addListener("appUrlOpen", (e) => handle(e && e.url)); } catch {}
  // The phone may have closed the app while the owner was logging in; then the
  // address arrives as the LAUNCH address instead of an event.
  try { Promise.resolve(App.getLaunchUrl && App.getLaunchUrl()).then((r) => { if (r && r.url) handle(r.url); }).catch(() => {}); } catch {}
  // The owner closed the sheet themselves: nothing to report, but every list
  // that might have changed should look again.
  try { Browser.addListener("browserFinished", () => window.dispatchEvent(new Event("al-connect-closed"))); } catch {}
}

// The native splash stays up until the first real screen is ready, so there is
// never a white flash between the splash and the app. Safe to call repeatedly,
// and harmless where the plugin is missing (the splash hides itself then).
export function hideNativeSplash() {
  try { const S = plugins().SplashScreen; if (isNativeApp() && S && S.hide) { const p = S.hide({ fadeOutDuration: 250 }); if (p && p.catch) p.catch(() => {}); } } catch {}
}
