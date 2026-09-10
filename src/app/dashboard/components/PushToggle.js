import { useState, useEffect } from "react";
import { T, Card, Btn } from "./ui.js";
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
  const [test, setTest] = useState(""); // last test-push result message
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

  // Fire the same push path a real order uses. The result tells the owner
  // exactly where the chain stands: delivered, server-not-configured, or no
  // device subscribed here.
  const sendTest = async () => {
    setBusy(true); setTest("");
    const r = await apiJson("/api/push/test", { method: "POST" }).catch(() => null);
    setBusy(false);
    if (!r) { setTest("Could not reach the server — try again."); return; }
    if (r.reason === "not_configured") { setTest("The server has no notification keys set yet — notifications can't be sent until that's fixed."); return; }
    if (r.reason === "no_subscriptions") { setTest("This device isn't subscribed. Turn notifications off and on again."); return; }
    if ((r.sent || 0) > 0) { setTest(`Sent to ${r.sent} device${r.sent > 1 ? "s" : ""} — check your phone/notification tray.`); return; }
    setTest("Nothing was sent. " + (r.reason ? `(${r.reason})` : ""));
  };

  const Head = ({ children }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14.5, fontWeight: 700, marginBottom: 6 }}>
      <i className="ti ti-bell-ringing" style={{ fontSize: 18, color: T.gold }} />{children}
    </div>
  );
  const Sub = ({ children }) => <div style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.6, marginBottom: 14 }}>{children}</div>;

  if (state === "checking") return null;

  if (state === "unsupported") return (
    <Card><Head>Phone notifications</Head>
      <Sub>This browser cannot show push notifications. On an iPhone, first add getvoicium to your Home Screen, then open it from there and turn this on.</Sub>
    </Card>
  );
  if (state === "unconfigured") return (
    <Card><Head>Phone notifications</Head>
      <Sub>Notifications are not switched on for this site yet.</Sub>
    </Card>
  );
  if (state === "denied") return (
    <Card><Head>Phone notifications</Head>
      <Sub>Notifications are <strong>blocked</strong>. {native
        ? "Allow them for getvoicium in your phone's Settings → Apps → getvoicium → Notifications, then reopen the app."
        : "Allow them for getvoicium.com in your browser's site settings, then reload this page."}</Sub>
    </Card>
  );

  return (
    <Card><Head>Phone notifications</Head>
      <Sub>Get a notification on this device — even when the dashboard is closed — for a new order, a new booking, and a chat that needs you.</Sub>
      {state === "on"
        ? <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: T.success, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <i className="ti ti-circle-check-filled" />On for this device
            </span>
            <button onClick={sendTest} disabled={busy} className="ui-btn" style={{ background: T.bgAlt, boxShadow: T.nmIn, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, fontSize: 12.5, fontWeight: 600, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit" }}>
              {busy ? "Sending…" : "Send a test"}
            </button>
            <button onClick={disable} disabled={busy} className="ui-btn" style={{ background: "none", border: "none", color: T.textMuted, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
              {busy ? "…" : "Turn off"}
            </button>
          </div>
        : <Btn gold onClick={enable} disabled={busy}>
            <i className="ti ti-bell" style={{ marginRight: 6 }} />{busy ? "Turning on…" : "Turn on notifications"}
          </Btn>}
      {test && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 10, background: T.bgAlt, boxShadow: T.nmIn, borderRadius: 10, padding: "8px 12px" }}>{test}</div>}
      {err && <div style={{ fontSize: 12, color: T.danger, marginTop: 10 }}>{err}</div>}
    </Card>
  );
}
