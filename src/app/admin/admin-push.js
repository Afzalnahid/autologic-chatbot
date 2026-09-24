"use client";
// Notifications for the admin console and the admin app.
//
// The sibling of src/app/dashboard/components/native-push.js, and deliberately
// a separate file with a separate endpoint. Owner, 2026-09-24: "the admin app
// and the user app will be separated... one is for user where the user
// notification comes, and an admin app where the admin panel notifications
// come." A token registered here reaches /api/admin/push and lands in
// admin_fcm_tokens; nothing in here can touch a client's devices.
//
// Everything is a quiet no-op outside the native app, except enableAdminWebPush
// which works in an ordinary browser so the console can also buzz on a laptop.

const TOKEN_KEY = "tm_admin_fcm_token";

export function isNativeApp() {
  try { return !!(typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.()); }
  catch { return false; }
}

const plugin = () => {
  try { return window.Capacitor?.Plugins?.PushNotifications || null; } catch { return null; }
};

// Which app is this page running inside? The admin app and the user app load
// the SAME website, so the page cannot tell them apart by url alone — somebody
// can always type an address. The package id can: only the admin app is
// com.tellmoreai.admin. When it cannot be read (an ordinary browser) the answer
// is "not the admin app", which is the safe way round: a device registers as an
// admin device only when it is provably the admin app.
export async function isAdminApp() {
  if (!isNativeApp()) return false;
  try {
    const App = window.Capacitor?.Plugins?.App;
    const info = await App?.getInfo?.();
    return String(info?.id || "") === "com.tellmoreai.admin";
  } catch { return false; }
}

const saved = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };

async function post(token, body) {
  return fetch("/api/admin/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }).then((r) => r.json()).catch(() => null);
}

let _inited = false;

// Wire the listeners once: store the device token, and follow a tapped alert.
// Every platform alert carries url "/admin", so the app stays where it belongs.
export function initAdminPush(authToken) {
  if (_inited || !isNativeApp()) return;
  const PN = plugin(); if (!PN) return;
  _inited = true;
  try {
    PN.addListener("registration", async (t) => {
      const value = t?.value || null;
      if (!value) return;
      try { localStorage.setItem(TOKEN_KEY, value); } catch {}
      if (!(await isAdminApp())) return;   // the user app must never register here
      await post(authToken, { token: value });
    });
    PN.addListener("registrationError", (e) => console.error("[admin-push] registration error", e));
    PN.addListener("pushNotificationActionPerformed", (a) => {
      const url = a?.notification?.data?.url || "/admin";
      try { window.location.href = url; } catch {}
    });
  } catch (e) { console.error("[admin-push] init", e); }
}

// "granted" | "denied" | "prompt" | "unsupported"
export async function adminPushState() {
  const PN = plugin(); if (!PN) return "unsupported";
  try { const p = await PN.checkPermissions(); return p?.receive || "prompt"; }
  catch { return "prompt"; }
}

// Ask permission and register this device as an admin device.
export async function enableAdminPush(authToken) {
  const PN = plugin(); if (!PN) return "unsupported";
  if (!(await isAdminApp())) return "not_admin_app";
  initAdminPush(authToken);
  try {
    let p = await PN.checkPermissions().catch(() => null);
    if (p?.receive !== "granted") p = await PN.requestPermissions().catch(() => null);
    if (p?.receive !== "granted") return p?.receive || "denied";
    await PN.register();
    return "granted";
  } catch (e) {
    console.error("[admin-push] enable", e);
    return "error";
  }
}

export async function disableAdminPush(authToken) {
  const token = saved();
  if (!token) return;
  await fetch("/api/admin/push", {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ token }),
  }).catch(() => {});
}

// The console on a laptop: ordinary browser Web Push, through the same
// /api/admin/push endpoint and the same admin_push_subscriptions table.
export async function enableAdminWebPush(authToken, vapidPublicKey) {
  try {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
    if (!vapidPublicKey) return "not_configured";
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return perm;
    const reg = await navigator.serviceWorker.register("/sw.js");
    const existing = await reg.pushManager.getSubscription();
    const sub = existing || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
    const r = await post(authToken, { subscription: sub.toJSON() });
    return r?.ok ? "granted" : "error";
  } catch (e) {
    console.error("[admin-push] web", e);
    return "error";
  }
}

// The VAPID public key is base64url; PushManager wants raw bytes.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
