import { useState, useMemo, useRef, useEffect } from "react";
import { T } from "./ui.js";
import { markAllConvosRead } from "./convo-read.js";

// The bell in the header — everything worth the owner's attention, organised the
// way Facebook does it:
//   NEEDS YOU   a customer waiting for a person, a comment the bot could not
//               answer, an alert (plan, AI key, message limit, a channel that
//               needs reconnecting, a payment decision)
//   CUSTOMERS   messages waiting for a reply, new public comments
//   BUSINESS    orders and bookings, and quieter updates (payment confirmed)
// Messages come from the shell's live conversation list (10 s); everything else
// from /api/notifications (30 s).
//
// Read state, per device (localStorage): each notification stays unread until
// it is tapped or "Mark all as read" is pressed — opening the panel clears
// nothing; the badge is the unread count; a later notification is unread on its
// own. A watermark (everything older counts read; mark-all moves it) plus the
// keys of items tapped since.
//
// Tapping an item opens THE thing it is about — the conversation with that
// customer, that order — via onNavigate(tab, id).
const SEEN_KEY = "gv-notif-seen";
const READ_KEY = "gv-notif-read";
const FIRST_KEY = "gv-notif-first";   // key → when this device first saw it
const READ_CAP = 300;

// An alert's own time is the FACT's time (a plan's expiry date, the start of
// the month) and can be older than the last "Mark all as read" — so "new" is
// judged by when this device first saw the key, or the item's time, whichever
// is later. A brand-new alert is unread; one already seen stays read.
const readFirst = () => { try { const o = JSON.parse(localStorage.getItem(FIRST_KEY) || "{}"); return o && typeof o === "object" ? o : {}; } catch { return {}; } };
const writeFirst = (o) => {
  try {
    const entries = Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, READ_CAP);
    localStorage.setItem(FIRST_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch { /* private mode */ }
};

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

const SECTIONS = [
  { id: "needs", label: "Needs you" },
  { id: "customers", label: "Customers" },
  { id: "business", label: "Business" },
];
const sectionOf = (it) => {
  if (it.level === "urgent") return "needs";
  if (it.type === "message" || it.type === "comment") return "customers";
  return "business";
};
const ICON_COLOR = { message: T.gold, comment: T.info, order: T.success, booking: T.purple, handover: T.danger, alert: T.warn };

export default function NotificationsBell({ convos = [], feed = [], isMobile, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const [readSet, setReadSet] = useState(() => new Set());
  const wrap = useRef(null);
  const btn = useRef(null);
  const [top, setTop] = useState(0);

  useEffect(() => { setSeen(readSeen()); setReadSet(readReadSet()); }, []);

  // Messages waiting for a reply come from the live conversation list; the rest
  // arrives ready-made from the server.
  const items = useMemo(() => {
    const out = [];
    for (const c of convos) {
      if (c.status !== "active" || !c.time) continue;
      out.push({
        key: "msg-" + c.id, type: "message", level: "info", icon: "ti-message-2",
        title: c.sender || "A customer", body: c.lastMsg || "sent a message",
        time: c.time, target: "conversations", id: c.id,
      });
    }
    for (const f of feed) if (f && f.key) out.push(f);
    out.sort((a, b) => new Date(b.time) - new Date(a.time));
    return out.slice(0, 60);
  }, [convos, feed]);

  // Remember when each key was first seen on this device (persisted).
  const [first, setFirst] = useState(() => ({}));
  useEffect(() => { setFirst(readFirst()); }, []);
  useEffect(() => {
    if (!items.length) return;
    // Start from what is SAVED, not from the `first` state: on a mount where
    // items are already loaded the mount effect above has not yet delivered
    // the saved map, and building on `{}` re-stamped every key as first seen
    // "now" — which made everything unread again after "Mark all as read".
    let changed = false; const next = { ...readFirst(), ...first }; const now = Date.now();
    for (const it of items) if (!next[it.key]) { next[it.key] = now; changed = true; }
    if (changed || Object.keys(next).length !== Object.keys(first).length) { writeFirst(next); setFirst(next); }
  }, [items]); // eslint-disable-line

  const isUnread = (it) => Math.max(new Date(it.time).getTime() || 0, first[it.key] || 0) > seen && !readSet.has(it.key);
  const unread = useMemo(() => items.filter(isUnread).length, [items, seen, readSet, first]); // eslint-disable-line
  const urgent = useMemo(() => items.filter((i) => i.level === "urgent" && isUnread(i)).length, [items, seen, readSet, first]); // eslint-disable-line

  const grouped = useMemo(() => {
    const g = { needs: [], customers: [], business: [] };
    for (const it of items) g[sectionOf(it)].push(it);
    return g;
  }, [items]);

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

  useEffect(() => {
    if (!open || !isMobile) return;
    const measure = () => { const r = btn.current?.getBoundingClientRect(); if (r) setTop(Math.round(r.bottom + 8)); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, isMobile]);

  const toggle = () => setOpen((v) => !v);

  const markAll = () => {
    // The watermark is the later of the device clock and the newest item, so
    // a phone whose clock runs behind the server still clears everything.
    const now = items.reduce((t, it) => Math.max(t, new Date(it.time).getTime() || 0, first[it.key] || 0), Date.now());
    writeSeen(now); setSeen(now);
    const empty = new Set(); writeReadSet(empty); setReadSet(empty);
    // Also the inbox: every bold chat goes normal and the Inbox badge clears,
    // like Facebook — one "Mark all as read" means all of it.
    markAllConvosRead(convos);
  };

  const go = (it) => {
    if (isUnread(it)) {
      const next = new Set(readSet); next.add(it.key);
      writeReadSet(next); setReadSet(next);
    }
    setOpen(false);
    onNavigate?.(it.target, it.id || null);
  };

  const Row = ({ it }) => {
    const un = isUnread(it);
    const color = ICON_COLOR[it.type] || T.gold;
    return (
      <button onClick={() => go(it)} className="ui-btn" style={{
        width: "100%", textAlign: "left", display: "flex", gap: 11, alignItems: "flex-start",
        padding: "11px 15px", border: "none", borderBottom: `1px solid ${T.border}`,
        background: un ? `color-mix(in srgb, ${T.gold} 7%, transparent)` : "none",
        cursor: "pointer", fontFamily: "inherit", color: T.text,
      }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: `color-mix(in srgb, ${color} 12%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <i className={`ti ${it.icon || "ti-bell"}`} style={{ fontSize: 16, color }} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: un ? 700 : 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title}</span>
          <span style={{ display: "block", fontSize: 12, color: un ? T.text : T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.body}</span>
        </span>
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0, marginTop: 1 }}>
          <span style={{ fontSize: 11, color: un ? T.gold : T.textDim, fontWeight: un ? 600 : 400 }}>{ago(it.time)}</span>
          {un && <span aria-label="unread" style={{ width: 9, height: 9, borderRadius: 999, background: it.level === "urgent" ? T.danger : T.gold, display: "block" }} />}
        </span>
      </button>
    );
  };

  return (
    <div ref={wrap} style={{ position: "relative" }}>
      <button ref={btn} onClick={toggle} className="pbtn"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        style={isMobile ? { width: 36, height: 36, borderRadius: 11 } : undefined}>
        <i className="ti ti-bell" />
        {unread > 0 && <span className="pbadge" style={urgent ? { background: T.danger } : undefined}>{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div style={{
          ...(isMobile
            ? { position: "fixed", top, left: 10, right: 10, maxHeight: `calc(100dvh - ${top + 12}px)` }
            : { position: "absolute", top: "calc(100% + 8px)", right: 0, width: 380, maxHeight: "72vh" }),
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
              : SECTIONS.map((s) => grouped[s.id].length > 0 && (
                <div key={s.id}>
                  <div style={{ padding: "8px 15px 4px", fontSize: 10.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: s.id === "needs" ? T.danger : T.textDim, background: T.bgAlt }}>
                    {s.label}
                  </div>
                  {grouped[s.id].map((it) => <Row key={it.key} it={it} />)}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
