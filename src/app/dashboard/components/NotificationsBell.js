import { useState, useMemo, useRef, useEffect } from "react";
import { T } from "./ui.js";

// The bell in the header. It opens a dropdown of recent things worth the owner's
// attention, built from data the dashboard already has — no extra fetch:
//   • conversations waiting for a reply (an unanswered customer message)
//   • orders the bot has taken
//
// Read state works the way Facebook's does, which is what the owner asked for:
//   • each notification is unread until it is tapped, or "Mark all as read" is
//     pressed — merely OPENING the panel no longer clears anything;
//   • the bell badge is the number still unread, and disappears at zero;
//   • a new notification arriving later is unread again, on its own.
// Kept in localStorage so it survives a refresh: a watermark (everything older
// than it counts as read — also what "Mark all as read" moves) plus the keys of
// the individual items tapped since. (This is the in-app list; the phone push in
// Profile is the separate "reach me when the app is shut".)
const SEEN_KEY = "gv-notif-seen";
const READ_KEY = "gv-notif-read";
const READ_CAP = 200;

const readSeen = () => { try { return Number(localStorage.getItem(SEEN_KEY)) || 0; } catch { return 0; } };
const writeSeen = (t) => { try { localStorage.setItem(SEEN_KEY, String(t)); } catch { /* private mode */ } };
const readReadSet = () => {
  try { const a = JSON.parse(localStorage.getItem(READ_KEY) || "[]"); return new Set(Array.isArray(a) ? a : []); }
  catch { return new Set(); }
};
const writeReadSet = (set) => {
  try { localStorage.setItem(READ_KEY, JSON.stringify([...set].slice(-READ_CAP))); } catch { /* private mode */ }
};

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
  const [readSet, setReadSet] = useState(() => new Set());
  const wrap = useRef(null);
  const btn = useRef(null);
  // Where the panel's top edge sits on a phone, measured from the bell itself.
  const [top, setTop] = useState(0);

  useEffect(() => { setSeen(readSeen()); setReadSet(readReadSet()); }, []);

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

  const isUnread = (it) => new Date(it.time).getTime() > seen && !readSet.has(it.key);
  const unread = useMemo(() => items.filter(isUnread).length, [items, seen, readSet]); // eslint-disable-line

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

  const toggle = () => setOpen((v) => !v);

  // Everything up to now is read: move the watermark, and the per-item keys are
  // no longer needed (they are all older than it).
  const markAll = () => {
    const now = Date.now();
    writeSeen(now); setSeen(now);
    const empty = new Set(); writeReadSet(empty); setReadSet(empty);
  };

  // Tapping one notification reads THAT one and follows it.
  const go = (it) => {
    if (isUnread(it)) {
      const next = new Set(readSet); next.add(it.key);
      writeReadSet(next); setReadSet(next);
    }
    setOpen(false);
    onNavigate?.(it.target);
  };

  const iconColor = { message: T.gold, order: T.success, booking: T.purple };

  return (
    <div ref={wrap} style={{ position: "relative" }}>
      <button ref={btn} onClick={toggle} className="pbtn"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
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
          <div style={{ padding: "12px 15px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Notifications{unread > 0 && <span style={{ fontSize: 11.5, color: T.gold, fontWeight: 600, marginLeft: 7 }}>{unread} unread</span>}</span>
            {unread > 0 && (
              <button onClick={markAll} className="ui-btn" style={{ background: "none", border: "none", padding: "4px 2px", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, color: T.gold, minHeight: 0 }}>
                <i className="ti ti-checks" style={{ marginRight: 4 }} />Mark all as read
              </button>
            )}
          </div>

          <div style={{ overflowY: "auto", minHeight: 0 }}>
            {items.length === 0
              ? <div style={{ padding: "34px 16px", textAlign: "center", color: T.textDim, fontSize: 13 }}>
                  <i className="ti ti-bell-off" style={{ fontSize: 26, display: "block", marginBottom: 8 }} />
                  Nothing new right now.
                </div>
              : items.map((it) => {
                const un = isUnread(it);
                return (
                  <button key={it.key} onClick={() => go(it)} className="ui-btn" style={{
                    width: "100%", textAlign: "left", display: "flex", gap: 11, alignItems: "flex-start",
                    padding: "11px 15px", border: "none", borderBottom: `1px solid ${T.border}`,
                    // An unread row sits on a faint brand tint, like Facebook's, so the
                    // eye finds what is new before reading a word of it.
                    background: un ? `color-mix(in srgb, ${T.gold} 7%, transparent)` : "none",
                    cursor: "pointer", fontFamily: "inherit", color: T.text,
                  }}>
                    <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: T.bgAlt, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <i className={`ti ${it.icon}`} style={{ fontSize: 16, color: iconColor[it.type] || T.gold }} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13, fontWeight: un ? 700 : 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title}</span>
                      <span style={{ display: "block", fontSize: 12, color: un ? T.text : T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.body}</span>
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0, marginTop: 1 }}>
                      <span style={{ fontSize: 11, color: un ? T.gold : T.textDim, fontWeight: un ? 600 : 400 }}>{ago(it.time)}</span>
                      {un && <span aria-label="unread" style={{ width: 9, height: 9, borderRadius: 999, background: T.gold, display: "block" }} />}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
