"use client";
import { useState, useEffect, useCallback } from "react";
import { T, Switch } from "../dashboard/components/ui.js";

// One switch, inside the bell, for the platform's own alerts on THIS device.
//
// Owner, 2026-09-24: "where is the toggle to turn on and off the notification?"
// There wasn't one — only a button that appeared when the permission had not
// been granted, so once it was granted there was nothing on screen to tell him
// notifications were on, or to turn them off again.
//
// It lives in the bell rather than on a settings page because that is where
// somebody goes when they are thinking about notifications, and the console has
// no settings page to put it on.
//
// The admin app uses the native FCM path; the console in a laptop browser uses
// ordinary Web Push. Both end up in the admin tables, never a client's.

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

const webSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator &&
  "PushManager" in window && "Notification" in window;

export default function AdminPushToggle({ token }) {
  // checking | on | off | denied | unsupported | unconfigured
  const [state, setState] = useState("checking");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [native, setNative] = useState(false);

  const check = useCallback(async () => {
    const m = await import("./admin-push.js");
    if (await m.isAdminApp()) {
      setNative(true);
      const p = await m.adminPushState();
      setState(p === "granted" ? "on" : p === "denied" ? "denied" : "off");
      return;
    }
    setNative(false);
    if (!VAPID) { setState("unconfigured"); return; }
    if (!webSupported()) { setState("unsupported"); return; }
    if (Notification.permission === "denied") { setState("denied"); return; }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      setState(sub && Notification.permission === "granted" ? "on" : "off");
    } catch { setState("off"); }
  }, []);

  useEffect(() => { check().catch(() => setState("off")); }, [check]);

  const enable = async () => {
    setBusy(true); setErr("");
    try {
      const m = await import("./admin-push.js");
      const r = native ? await m.enableAdminPush(token) : await m.enableAdminWebPush(token, VAPID);
      if (r === "granted") setState("on");
      else if (r === "denied") setState("denied");
      else { setErr("Could not turn notifications on. Please try again."); setState("off"); }
    } catch (e) { setErr(String(e?.message || e).slice(0, 140)); setState("off"); }
    setBusy(false);
  };

  const disable = async () => {
    setBusy(true); setErr("");
    try {
      const m = await import("./admin-push.js");
      await m.disableAdminPush(token);
      if (!native) {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (sub) {
          await fetch("/api/admin/push", {
            method: "DELETE",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          }).catch(() => {});
          await sub.unsubscribe().catch(() => {});
        }
      }
      setState("off");
    } catch (e) { setErr(String(e?.message || e).slice(0, 140)); }
    setBusy(false);
  };

  if (state === "checking") return null;

  const on = state === "on";
  const blocked = state === "denied" || state === "unsupported" || state === "unconfigured";
  const why = {
    denied: native
      ? "Blocked on this phone. Settings → Apps → TellMore AI Admin → Notifications → allow, then reopen the app."
      : "Blocked in this browser. Allow notifications for tellmoreai.com in the site settings, then reload.",
    unsupported: "This browser cannot show notifications.",
    unconfigured: "Notifications are not set up on the server yet.",
    on: native ? "On for this phone — new businesses, payments and errors." : "On in this browser.",
    off: "Off. Turn on to be told here even when the console is closed.",
  }[state];

  return <div style={{
    display: "flex", alignItems: "center", gap: 10, padding: "10px 11px", marginBottom: 6,
    borderRadius: 12, border: `1px solid ${T.border}`, background: T.bgAlt,
  }}>
    <i className="ti ti-bell-ringing" style={{ fontSize: 16, color: T.gold, flexShrink: 0 }} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12.8, fontWeight: 700 }}>Notifications on this device</div>
      <div style={{ fontSize: 11.5, color: err ? T.danger : T.textMuted, lineHeight: 1.5, marginTop: 2 }}>{err || why}</div>
    </div>
    <Switch size="sm" on={on} disabled={busy || blocked} onClick={on ? disable : enable}
      title={blocked ? "Not available here" : on ? "Turn off" : "Turn on"} />
  </div>;
}
