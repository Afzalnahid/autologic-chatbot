"use client";
// Native push for the installed app (Capacitor + FCM). Everything here is a
// no-op in a normal browser — isNativeApp() is false, so the dashboard's browser
// behaviour is completely unchanged. Inside the app, Capacitor injects its bridge
// into this remote page, so window.Capacitor.Plugins.PushNotifications is the
// live native plugin.
import { apiJson, getSb } from "./session.js";

export function isNativeApp() {
  try { return !!(typeof window !== "undefined" && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }
  catch { return false; }
}

const plugin = () => {
  try { return window.Capacitor?.Plugins?.PushNotifications || null; } catch { return null; }
};

let _inited = false;
let _lastToken = null;

// Save the token on the server. The registration endpoint needs a signed-in
// client, and on first launch the permission is asked BEFORE the owner has
// logged in — so if there is no session yet, wait for the sign-in and send it
// then, rather than losing the token.
const postToken = async (token) => {
  const send = () => apiJson("/api/push/register-native", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  }).catch(() => null);
  try {
    const { data } = await getSb().auth.getSession();
    if (data?.session) { await send(); return; }
    const { data: sub } = getSb().auth.onAuthStateChange((_evt, s) => {
      if (!s) return;
      // The shell stores the fresh access token on this same event; give it a beat.
      setTimeout(send, 1500);
      try { sub?.subscription?.unsubscribe?.(); } catch {}
    });
  } catch { await send(); }
};

// Wire the listeners ONCE: save the FCM token when the device registers, and
// follow a tapped notification to its tab. Safe to call repeatedly.
export function initNativePush() {
  if (_inited || !isNativeApp()) return;
  const PN = plugin(); if (!PN) return;
  _inited = true;
  try {
    PN.addListener("registration", async (t) => {
      _lastToken = t?.value || null;
      if (_lastToken) await postToken(_lastToken);
    });
    PN.addListener("registrationError", (e) => console.error("[native-push] registration error", e));
    // Tapping a notification: jump to its tab (the app uses the same "al-goto"
    // event the Profile card fires), or open its url if it has no #tab.
    PN.addListener("pushNotificationActionPerformed", (a) => {
      const url = a?.notification?.data?.url || "/dashboard";
      const tab = String(url).split("#")[1] || "";
      try {
        if (tab) window.dispatchEvent(new CustomEvent("al-goto", { detail: tab }));
        else window.location.href = url;
      } catch {}
    });
  } catch (e) { console.error("[native-push] init", e); }
}

// "granted" | "denied" | "prompt" | "unsupported"
export async function nativePushState() {
  const PN = plugin(); if (!PN) return "unsupported";
  try { const p = await PN.checkPermissions(); return p?.receive || "prompt"; }
  catch { return "prompt"; }
}

// Ask permission (if needed) and register the device. On success the "registration"
// listener above stores the token. Returns the permission result.
export async function enableNativePush() {
  const PN = plugin(); if (!PN) return "unsupported";
  initNativePush();
  try {
    let p = await PN.checkPermissions().catch(() => null);
    if (p?.receive !== "granted") p = await PN.requestPermissions().catch(() => null);
    if (p?.receive !== "granted") return p?.receive || "denied";
    await PN.register();
    return "granted";
  } catch (e) {
    console.error("[native-push] enable", e);
    return "error";
  }
}

// Stop notifications on this device: forget its token on the server. (The OS
// permission stays granted; turning back on re-registers instantly.)
export async function disableNativePush() {
  if (!_lastToken) return;
  await apiJson("/api/push/register-native", {
    method: "DELETE", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: _lastToken }),
  }).catch(() => {});
}
