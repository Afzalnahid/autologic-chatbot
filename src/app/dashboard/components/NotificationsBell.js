import { useState, useMemo, useRef, useEffect } from "react";
import { T } from "./ui.js";

// The bell in the header. It opens a dropdown of recent things worth the owner's
// attention, built from data the dashboard already has — no extra fetch:
//   • conversations waiting for a reply (an unanswered customer message)
//   • orders the bot has taken
// "Unread" is anything newer than the last time the dropdown was opened, kept in
// localStorage so the badge is not noisy across refreshes. (This is the in-app
// list; the phone push in Profile is the separate "reach me when the app is shut".)
const SEEN_KEY = "gv-notif-seen";

const readSeen = () => {
  try { return Number(localStorage.getItem(SEEN_KEY)) || 0; } catch { return 0; }
};
const writeSeen = (t) => { try { localStorage.setItem(SEEN_KEY, String(t)); } catch { /* private mode */ } };

function ago(t) {
  const s = Math.max(0, (Date.now() - new Date(t).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  if (s < 604800) return Math.floor(s / 86400) + "d";
  return new Date(t).toLocaleDateString();
}

export default function NotificationsBell({ convos = [], orders = [], isMobile, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const wrap = useRef(null);
  const btn = useRef(null);
  // Where the panel's top edge sits on a phone, measured from the bell itself.
  const [top, setTop] = useState(0);

  useEffect(() => { setSeen(readSeen()); }, []);

  // Build the list once from whatever the shell is holding.
  const items = useMemo(() => {
    const out = [];
    for (const c of convos) {
      if (c.status !== "active" || !c.time) continue; // only chats waiting on a reply
      out.push({
        key: "msg-" + c.id, type: "message", icon: "ti-message-2",
        title: c.sender || "A customer", body: c.lastMsg || "sent a message",
        time: c.time, target: "conversations",
      });
    }
    for (const o of orders) {
      if (!o.created_at) continue;
      const total = o.total || o.total_price;
      out.push({
        key: "ord-" + (o.id || o.order_code), type: "order", icon: "ti-shopping-cart",
        title: "New order · " + (o.customer_name || "customer"),
        body: [o.product_names, total ? "৳" + total : ""].filter(Boolean).join(" · "),
        time: o.created_at, target: "orders",
      });
    }
    out.sort((a, b) => new Date(b.time) - new Date(a.time));
    return out.slice(0, 20);
  }, [convos, orders]);

  const unread = useMemo(() => items.filter((i) => new Date(i.time).getTime() > seen).length, [items, seen]);

  // Close on a click anywhere outside the bell + dropdown. touchstart as well as
  // mousedown: on a phone the panel is a fixed sheet, and a tap outside it has
  // to shut it the same way a click does.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);

  // On a phone the panel spans the SCREEN, not the bell, so it needs the bell's
  // position in viewport coordinates. Re-measured whenever it opens (and on
  // resize/rotate) rather than assumed from a header height that can wrap.
  useEffect(() => {
    if (!open || !isMobile) return;
    const measure = () => { const r = btn.current?.getBoundingClientRect(); if (r) setTop(Math.round(r.bottom + 8)); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, isMobile]);

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      if (next) { const now = Date.now(); writeSeen(now); setSeen(now); } // opening = read
      return next;
    });
  };

  const go = (it) => { setOpen(false); onNavigate?.(it.target); };

  const iconColor = { message: T.gold, order: T.success, booking: T.purple };

  return (
    <div ref={wrap} style={{ position: "relative" }}>
      <button ref={btn} onClick={toggle} className="pbtn"
        aria-label={`Notifications${unread ? `, ${unread} new` : ""}`}
        style={isMobile ? { width: 36, height: 36, borderRadius: 11 } : undefined}>
        <i className="ti ti-bell" />
        {unread > 0 && <span className="pbadge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        // The panel used to hang off the bell with right:0 on every screen. The
        // bell is not the last thing in the header (the avatar is), so on a phone
        // a 340px panel started ~40px off the LEFT edge of the screen and its
        // title was cut in half. On a phone it is now pinned to the VIEWPORT —
        // 10px from each side, below the bell — and only the desktop keeps the
        // anchored dropdown, where there is room for it.
        <div style={{
          ...(isMobile
            ? { position: "fixed", top, left: 10, right: 10, maxHeight: `calc(100dvh - ${top + 12}px)` }
            : { position: "absolute", top: "calc(100% + 8px)", right: 0, width: 360, maxHeight: "70vh" }),
          zIndex: 60,
          display: "flex", flexDirection: "column",
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 14,
          boxShadow: "0 12px 40px rgba(0,0,0,0.18)", overflow: "hidden",
        }}>
          <div style={{ padding: "12px 15px", borderBottom: `1px solid ${T.border}`, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>Notifications</span>
            {items.length > 0 && <span style={{ fontSize: 11.5, color: T.textDim, fontWeight: 500 }}>{items.length}</span>}
          </div>

          <div style={{ overflowY: "auto", minHeight: 0 }}>
            {items.length === 0
              ? <div style={{ padding: "34px 16px", textAlign: "center", color: T.textDim, fontSize: 13 }}>
                  <i className="ti ti-bell-off" style={{ fontSize: 26, display: "block", marginBottom: 8 }} />
                  Nothing new right now.
                </div>
              : items.map((it) => (
                <button key={it.key} onClick={() => go(it)} className="ui-btn" style={{
                  width: "100%", textAlign: "left", display: "flex", gap: 11, alignItems: "flex-start",
                  padding: "11px 15px", background: "none", border: "none", borderBottom: `1px solid ${T.border}`,
                  cursor: "pointer", fontFamily: "inherit", color: T.text,
                }}>
                  <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: T.bgAlt, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <i className={`ti ${it.icon}`} style={{ fontSize: 16, color: iconColor[it.type] || T.gold }} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title}</span>
                    <span style={{ display: "block", fontSize: 12, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.body}</span>
                  </span>
                  <span style={{ fontSize: 11, color: T.textDim, flexShrink: 0, marginTop: 1 }}>{ago(it.time)}</span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
