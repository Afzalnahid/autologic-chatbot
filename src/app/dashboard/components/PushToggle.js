import { useState, useEffect } from "react";
import { T, Card, Switch } from "./ui.js";
import { apiJson } from "./session.js";
import { isNativeApp, initNativePush, nativePushState, enableNativePush, disableNativePush } from "./native-push.js";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

// The VAPID public key is base64url; the browser wants the raw bytes.
function keyBytes(base64) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

const supported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator &&
  "PushManager" in window && "Notification" in window;

// Turn phone/browser push on or off. Notifications reach the owner even when the
// dashboard is closed — a new order, a new booking, a chat that needs a human.
export default function PushToggle() {
  const [state, setState] = useState("checking"); // checking|on|off|denied|unsupported|unconfigured
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // Inside the installed app, push goes through the native FCM path, not the
  // browser's PushManager (which the app's WebView does not support).
  const native = isNativeApp();

  useEffect(() => {
    // The native app: FCM, via the Capacitor plugin. Register the listeners, and
    // if the OS already granted permission, re-register (keeps the token fresh)
    // and show it as on.
    if (isNativeApp()) {
      initNativePush();
      (async () => {
        const p = await nativePushState();
        if (p === "granted") { enableNativePush().catch(() => {}); setState("on"); }
        else setState(p === "denied" ? "denied" : "off");
      })();
      return;
    }
    if (!VAPID) { setState("unconfigured"); return; }
    if (!supported()) { setState("unsupported"); return; }
    if (Notification.permission === "denied") { setState("denied"); return; }
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        setState(sub && Notification.permission === "granted" ? "on" : "off");
      } catch { setState("off"); }
    })();
  }, []);

  const enable = async () => {
    setBusy(true); setErr("");
    if (isNativeApp()) {
      const r = await enableNativePush();
      if (r === "granted") setState("on");
      else if (r === "denied") setState("denied");
      else { setErr("Could not turn on notifications. Please try again."); setState("off"); }
      setBusy(false); return;
    }
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "off"); setBusy(false); return; }
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID) });
      const r = await apiJson("/api/push/subscribe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub }),
      }).catch(() => null);
      if (!r || r.error) { setErr(r?.error === "push_not_configured" ? "Notifications are not set up on the server yet." : "Could not save. Please try again."); setState("off"); }
      else setState("on");
    } catch (e) {
      setErr(String(e?.message || e).slice(0, 140)); setState("off");
    }
    setBusy(false);
  };

  const disable = async () => {
    setBusy(true); setErr("");
    if (isNativeApp()) { await disableNativePush(); setState("off"); setBusy(false); return; }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await apiJson("/api/push/subscribe", {
          method: "DELETE", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => null);
        await sub.unsubscribe().catch(() => {});
      }
      setState("off");
    } catch (e) { setErr(String(e?.message || e).slice(0, 140)); }
    setBusy(false);
  };

  // One row, like a phone's own settings: the bell, "Notifications", and a
  // single on/off switch. The owner's rule (2026-09-11): no "Send a test"
  // button — the switch is the whole control. When notifications cannot be
  // turned on from here (blocked, unsupported, not configured) the row shows
  // the switch off and one line saying why, instead of a different card.
  const Row = ({ children, sub }) => (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <i className="ti ti-bell-ringing" style={{ fontSize: 18, color: T.gold, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 700 }}>Notifications</div>
        {children}
      </div>
      {sub && <div style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.6, marginTop: 8 }}>{sub}</div>}
      {err && <div style={{ fontSize: 12, color: T.danger, marginTop: 8 }}>{err}</div>}
    </Card>
  );

  if (state === "checking") return null;

  if (state === "unsupported") return (
    <Row sub="This browser cannot show notifications. On an iPhone, first add getvoicium to your Home Screen, then open it from there and turn this on."><Switch on={false} disabled title="Not available here" /></Row>
  );
  if (state === "unconfigured") return (
    <Row sub="Notifications are not switched on for this site yet."><Switch on={false} disabled title="Not set up yet" /></Row>
  );
  if (state === "denied") return (
    <Row sub={native
      ? "Blocked on this phone. Allow them in Settings → Apps → getvoicium → Notifications, then reopen the app."
      : "Blocked in this browser. Allow them for getvoicium.com in the browser's site settings, then reload this page."}>
      <Switch on={false} disabled title="Blocked" />
    </Row>
  );

  const on = state === "on";
  return (
    <Row sub={on ? "On for this device — a new order, a new booking, and a chat that needs you." : "Off. Turn on to get a notification on this device, even when the dashboard is closed."}>
      <Switch on={on} disabled={busy} onClick={on ? disable : enable} title={on ? "Turn off" : "Turn on"} />
    </Row>
  );
}
