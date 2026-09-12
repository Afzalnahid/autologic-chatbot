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
let _boundClient = null;               // which client this device's token is currently tied to
const TOKEN_KEY = "gv_fcm_token";      // survives reloads so logout can still un-register

const savedToken = () => { try { return _lastToken || localStorage.getItem(TOKEN_KEY); } catch { return _lastToken; } };

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
      // Persist it so we can still un-register this device after a reload (the
      // module variable is lost then), e.g. when the owner logs out.
      try { if (_lastToken) localStorage.setItem(TOKEN_KEY, _lastToken); } catch {}
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
  const token = savedToken();
  if (!token) return;
  await apiJson("/api/push/register-native", {
    method: "DELETE", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  }).catch(() => {});
}

// Bind this device's FCM token to the account that is signed in NOW. Called
// after every sign-in, because the token belongs to whoever last registered it:
// without this, logging into account B on a phone that first ran account A left
// the token tied to A, so A kept getting this phone's notifications. Registering
// again re-fires the "registration" listener, which upserts the token onto the
// current client (unique(token) → the old account's row is overwritten, not
// duplicated). Permission is only checked, never requested, so a signed-in owner
// is never prompted; a device that never turned notifications on stays silent.
export async function rebindNativePush(clientId) {
  if (!isNativeApp() || !clientId || _boundClient === clientId) return;
  const PN = plugin(); if (!PN) return;
  initNativePush();
  try {
    const p = await PN.checkPermissions().catch(() => null);
    if (p?.receive !== "granted") return;   // notifications are off here — leave it off
    _boundClient = clientId;
    await PN.register();                     // → "registration" → postToken() under this account
  } catch (e) { _boundClient = null; console.error("[native-push] rebind", e); }
}

// On logout: drop this device's token so the account just left stops pushing to
// it at once, and forget the binding so the next sign-in re-registers cleanly.
export async function unbindNativePush() {
  _boundClient = null;
  await disableNativePush();
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}
