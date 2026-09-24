"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { T } from "../dashboard/components/ui.js";
import { readJson, offlineError } from "@/lib/api-error.js";

// The admin console's bell.
//
// Owner, 2026-09-24: "From the admin panel I don't get any notifications when
// any customer enters, or any error occurs, or something happens — it is bad
// for me." Before this the console was silent: two emails existed in the whole
// product, and a new business, a dead AI key or a failing route reached nobody.
//
// What lands here is decided in src/lib/platform-events.js, on one rule — an
// event earns a line only if the owner could act on it, or if it is money.
// Everything else would teach them to ignore the bell, and then the urgent ones
// are lost too.

const AGO = [[31536000, "y"], [2592000, "mo"], [604800, "w"], [86400, "d"], [3600, "h"], [60, "m"]];
function ago(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  for (const [n, u] of AGO) if (s >= n) return Math.floor(s / n) + u;
  return "now";
}

const TONE = {
  urgent: { color: T.danger, bg: T.dangerBg },
  warn: { color: T.warn, bg: T.warnBg },
  info: { color: T.textMuted, bg: T.bgAlt },
};

export default function AdminBell({ token, openDetail, isMobile }) {
  const [st, setSt] = useState({ events: [], unread: 0 });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef(null);

  const load = useCallback(async () => {
    if (!token) return;
    const r = await fetch(`/api/admin/events?t=${Date.now()}`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } })
      .then(readJson).catch(offlineError);
    // A bell that cannot load must not shout about it — the console has real
    // work on screen, and this is the least important thing on it.
    if (!r || r.error) return;
    setSt(r);
  }, [token]);

  useEffect(() => { load(); }, [load]);
  // Every half minute, and again whenever the tab comes back — the console is
  // left open on a second screen for hours.
  useEffect(() => {
    const t = setInterval(load, 30000);
    const onShow = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onShow); };
  }, [load]);

  // Click anywhere else to close.
  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const post = async (body) => {
    setBusy(true);
    const r = await fetch("/api/admin/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }).then(readJson).catch(offlineError);
    setBusy(false);
    if (r && !r.error) setSt(r);
  };

  const openOne = (e) => {
    if (!e.read) post({ action: "read", id: e.id });
    // Land on the business it is about, not just the tab — the same rule the
    // client dashboard's own notifications follow.
    if (e.client_id && openDetail) { setOpen(false); openDetail(e.client_id); }
  };

  const urgentUnread = st.events.some((e) => !e.read && e.severity === "urgent");
  const size = isMobile ? 36 : 42;

  return <div ref={box} style={{ position: "relative", flexShrink: 0 }}>
    <button onClick={() => setOpen((v) => !v)} className="pbtn" aria-label={st.unread ? `${st.unread} unread notifications` : "Notifications"}
      title="What is happening on the platform"
      style={isMobile ? { width: 36, height: 36, borderRadius: 11, position: "relative" } : { position: "relative" }}>
      <i className={`ti ti-bell${st.unread ? "-ringing" : ""}`} />
      {st.unread > 0 && <span style={{
        position: "absolute", top: -3, right: -3, minWidth: 17, height: 17, padding: "0 4px", borderRadius: 9,
        background: urgentUnread ? T.danger : T.gold, color: "#fff", fontSize: 10, fontWeight: 800,
        display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
      }}>{st.unread > 99 ? "99+" : st.unread}</span>}
    </button>

    {open && <div className="ui-menu" style={{
      position: "absolute", top: size + 8, right: 0, width: isMobile ? "min(92vw, 340px)" : 400,
      maxHeight: "min(70vh, 560px)", overflowY: "auto", background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 16, boxShadow: T.nmOut, zIndex: 80, padding: 6,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px 10px" }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, flex: 1 }}>What is happening</div>
        {st.unread > 0 && <button onClick={() => post({ action: "read_all" })} disabled={busy}
          style={{ background: "none", border: "none", cursor: "pointer", color: T.gold, fontSize: 11.5, fontWeight: 600, fontFamily: "inherit", padding: 4 }}>
          Mark all as read
        </button>}
      </div>

      {!st.events.length && <div style={{ padding: "26px 16px", textAlign: "center", color: T.textDim, fontSize: 12.5, lineHeight: 1.6 }}>
        Nothing yet.<br />New sign-ups, payments waiting for you, a bot that stopped, a key that died and server errors all land here.
      </div>}

      {st.events.map((e) => {
        const tone = TONE[e.severity] || TONE.info;
        return <button key={e.id} onClick={() => openOne(e)} style={{
          display: "flex", gap: 10, width: "100%", textAlign: "left", padding: "10px 11px", marginBottom: 2,
          borderRadius: 12, border: "none", cursor: "pointer", fontFamily: "inherit",
          background: e.read ? "transparent" : tone.bg, color: T.text,
        }}>
          <span style={{ fontSize: 16, lineHeight: 1.3, flexShrink: 0 }}>{e.icon}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 12.8, fontWeight: e.read ? 500 : 700, lineHeight: 1.45 }}>{e.title}</span>
            {e.client_name && <span style={{ display: "block", fontSize: 11.5, color: tone.color, fontWeight: 600, marginTop: 1 }}>{e.client_name}</span>}
            {e.body && <span style={{ fontSize: 11.5, color: T.textMuted, marginTop: 2, lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{e.body}</span>}
          </span>
          <span style={{ fontSize: 10.5, color: T.textDim, flexShrink: 0, marginTop: 2 }}>{ago(e.created_at)}</span>
        </button>;
      })}

      {st.events.length > 0 && <div style={{ padding: "8px 11px 4px", fontSize: 10.5, color: T.textDim, lineHeight: 1.5 }}>
        Tap one to open that business. The same alerts reach your phone if notifications are on in your own dashboard.
      </div>}
    </div>}
  </div>;
}
