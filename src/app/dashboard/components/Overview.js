"use client";
import { useEffect, useMemo, useState } from "react";
import { T, Card, Badge, fmtMoney, useIsMobile } from "./ui.js";
import { api } from "./session.js";
import { useT } from "./i18n.js";
import { useConvoRead } from "./convo-read.js";

// The home tab, as the owner's final design deck draws it (2026-09-20):
// four numbers for today, the week's messages as paired bars (the customers'
// and the bot's), who needs the owner right now with an Open button each,
// the newest orders as a table (or the next meetings), and every channel
// with how many people wrote to it today. Everything on it is data the app
// already keeps — the bot's share comes from /api/analytics?days=7, the rest
// from the lists the dashboard shell has already loaded — so nothing here is
// generated or estimated. The greeting, the date and the live pill are the
// page header (Shell.js); on a phone the pill sits here under the title.

const PLABEL = { facebook: "Messenger", instagram: "Instagram", whatsapp: "WhatsApp", website: "Website" };
const SCOLOR = { Pending: T.warn, Confirmed: T.gold, Shipped: T.purple, Delivered: T.success, Cancelled: T.danger, Returned: T.danger };

const ago = (iso, t) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return t("ov.now");
  if (m < 60) return t("ov.min", { n: m });
  if (m < 1440) return t("ov.hr", { n: Math.round(m / 60) });
  return t("ov.day", { n: Math.round(m / 1440) });
};
// "2m", "38m", "2h", "5d" — the deck's short form for the orders table.
const agoShort = (iso) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
};
const initialsOf = (s) => (String(s || "?").trim().replace(/^\+/, "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?");
const dayKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; };

// A tiny 7-point line for the KPI cards — no library, no axes; the number
// beside it is the reading, the line only says which way it went.
function MiniSpark({ data, color }) {
  const W = 92, H = 30, P = 2;
  const max = Math.max(1, ...data), n = data.length;
  const x = (i) => (n <= 1 ? W / 2 : P + (i / (n - 1)) * (W - P * 2));
  const y = (v) => H - P - (v / max) * (H - P * 2);
  const d = data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} preserveAspectRatio="none" style={{ display: "block", flexShrink: 0, overflow: "visible" }} aria-hidden="true">
    <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
  </svg>;
}

// One of the four cards: a label, the number, the change since yesterday
// (green up, red down; "pts" for a percentage, "+4" for a count), and on a
// wide screen the last seven days as a line.
function Kpi({ label, value, delta, unit = "%", spark, isMobile }) {
  const up = typeof delta === "number" && delta > 0, down = typeof delta === "number" && delta < 0;
  const deltaText = typeof delta === "number" && delta !== 0 ? `${delta > 0 ? "+" : "−"}${Math.abs(delta)}${unit}` : null;
  // The card measures itself: when four of them share a narrow row the line
  // steps aside so the label and the number keep their room.
  return <Card style={{ padding: isMobile ? "14px 16px" : "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minWidth: 0, containerType: "inline-size" }}>
    <style dangerouslySetInnerHTML={{ __html: `@container (max-width: 262px) { .ov-spark { display: none } }` }} />
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12.5, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6, flexWrap: isMobile ? "wrap" : "nowrap" }}>
        <span style={{ fontSize: isMobile ? 22 : 24, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.05, color: T.text, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{value}</span>
        {deltaText && <span style={{ fontSize: 12.5, fontWeight: 600, color: up ? T.success : down ? T.danger : T.textDim, whiteSpace: "nowrap", ...(isMobile ? { flexBasis: "100%" } : {}) }}>{deltaText}</span>}
      </div>
    </div>
    {!isMobile && spark && <span className="ov-spark" style={{ display: "block", flexShrink: 0 }}><MiniSpark data={spark} color={T.gold} /></span>}
  </Card>;
}

function Section({ title, action, onAction, right, children, style }) {
  return <Card style={{ padding: "16px 18px", ...style }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
      <div style={{ fontSize: 14.5, fontWeight: 600 }}>{title}</div>
      {right}
      {action && <button onClick={onAction} className="ui-btn" style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: T.gold, padding: 0 }}>{action}</button>}
    </div>
    {children}
  </Card>;
}

const Empty = ({ icon, text }) => <div style={{ padding: "18px 6px", textAlign: "center", color: T.textDim, fontSize: 12.5 }}>
  <i className={`ti ${icon}`} style={{ fontSize: 22, display: "block", marginBottom: 6 }} />{text}
</div>;

const OpenBtn = ({ onClick, label }) => <button onClick={onClick} className="ui-btn" style={{ padding: "7px 13px", borderRadius: 8, border: `1px solid ${T.borderStrong}`, background: T.card, color: T.text, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0, whiteSpace: "nowrap" }}>{label}</button>;

export default function Overview({ me, convos = [], orders = [], channels = [], businessType = "ecommerce", onGo }) {
  const t = useT();
  const isMobile = useIsMobile();
  const isAgency = businessType === "agency";
  const convoRead = useConvoRead();
  const [an, setAn] = useState(null);
  const [tags, setTags] = useState(null);
  const [contacts, setContacts] = useState({});
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    let live = true;
    const load = async () => {
      const [a, tg, ct, bk] = await Promise.all([
        api(`/api/analytics?days=7&t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        api(`/api/tags?t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        api("/api/contacts").then((r) => r.json()).catch(() => null),
        isAgency ? api("/api/bookings").then((r) => r.json()).catch(() => []) : Promise.resolve([]),
      ]);
      if (!live) return;
      if (a && !a.error) setAn(a);
      if (tg && !tg.error) setTags(tg);
      if (ct && Array.isArray(ct.contacts)) setContacts(Object.fromEntries(ct.contacts.map((c) => [c.sender_id, c])));
      if (Array.isArray(bk)) setBookings(bk);
    };
    load();
    const iv = setInterval(load, 60000);
    return () => { live = false; clearInterval(iv); };
  }, [isAgency]);

  const liveN = channels.filter((c) => c.status === "connected").length;
  const expiredN = channels.filter((c) => c.status === "expired").length;

  // ── today, against yesterday, and the last seven days ──────────────────
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i)); return d; }), []);
  const keys = days.map(dayKey);
  const todayK = keys[6], ydayK = keys[5];
  const series = (items, keyOf, valueOf = () => 1) => {
    const m = Object.fromEntries(keys.map((k) => [k, 0]));
    for (const it of items) { const k = keyOf(it); if (k in m) m[k] += valueOf(it); }
    return m;
  };
  // A conversation counts on every day its customer wrote.
  const convDays = series(convos.flatMap((c) => [...new Set((c.messages || []).filter((m) => m.role === "customer").map((m) => dayKey(m.time)))]), (k) => k);
  const kept = orders.filter((o) => o.status !== "Cancelled" && o.status !== "Returned");
  const amount = (o) => Number(o.total ?? o.total_price) || 0;
  const orderDays = series(orders, (o) => dayKey(o.created_at));
  const revenueDays = series(kept, (o) => dayKey(o.created_at), amount);
  const bookingDays = series(bookings, (b) => dayKey(b.created_at || b.meeting_datetime));
  const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : a ? 100 : null);
  const line = (m) => keys.map((k) => m[k]);

  const cv = an?.conversations, g = an?.growth;
  const daily = (an?.daily || []).slice(-7);
  const aiLine = daily.map((d) => { const tot = (d.customer || 0) + (d.bot || 0); return tot ? Math.round(((d.bot || 0) / tot) * 100) : 0; });
  const weekCustomer = daily.reduce((s, d) => s + (d.customer || 0), 0);
  const weekBot = daily.reduce((s, d) => s + (d.bot || 0), 0);
  const weekTotal = weekCustomer + weekBot + daily.reduce((s, d) => s + (d.agent || 0), 0);
  const weekPct = weekCustomer + weekBot ? Math.round((weekBot / (weekCustomer + weekBot)) * 100) : 0;
  const maxBar = Math.max(1, ...daily.map((d) => Math.max(d.customer || 0, d.bot || 0)));
  const dayName = (s) => new Date(s + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" });
  const upcoming = bookings.filter((b) => b.meeting_datetime && !isNaN(new Date(b.meeting_datetime)) && new Date(b.meeting_datetime) >= new Date() && new Date(b.meeting_datetime) < new Date(Date.now() + 7 * 86400000) && !/cancel/i.test(b.status || ""));

  // ── who needs the owner ──────────────────────────────────────────────────
  const complaintTag = tags?.complaint_tag;
  const tagsOf = (id) => (tags?.tags?.[id] || []).map((x) => x.tag);
  const needs = useMemo(() => {
    const out = [];
    for (const c of convos) {
      const ct = contacts[c.id];
      const why = ct?.needs_human ? "human" : (complaintTag && tagsOf(c.id).includes(complaintTag)) ? "complaint" : convoRead.isUnread(c) ? "unread" : null;
      if (why) out.push({ c, why });
    }
    const rank = { human: 0, complaint: 1, unread: 2 };
    return out.sort((a, b) => rank[a.why] - rank[b.why] || new Date(b.c.time) - new Date(a.c.time));
  }, [convos, contacts, tags, convoRead.state]); // eslint-disable-line
  const WHY = {
    human: { label: t("ov.why.human"), color: T.warn },
    complaint: { label: t("ov.why.complaint"), color: T.gold },
    unread: { label: t("ov.why.unread"), color: T.warn },
  };

  // ── recent orders / next meetings ────────────────────────────────────────
  const recentOrders = [...orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
  const nextMeetings = bookings
    .filter((b) => b.meeting_datetime && !isNaN(new Date(b.meeting_datetime)) && new Date(b.meeting_datetime) >= new Date() && !/cancel/i.test(b.status || ""))
    .sort((a, b) => new Date(a.meeting_datetime) - new Date(b.meeting_datetime)).slice(0, 4);
  const when = (iso) => new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  // ── chats today, per channel ─────────────────────────────────────────────
  const chatsToday = (ch) => convos.filter((c) => (ch.page_id ? String(c.page_id || "") === String(ch.page_id) : (c.platform || "facebook") === ch.platform)
    && (c.messages || []).some((m) => m.role === "customer" && dayKey(m.time) === todayK)).length;

  const cols = isMobile ? "minmax(0, 1fr)" : "repeat(auto-fit, minmax(min(100%, 300px), 1fr))";
  const row = { display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${T.border}` };

  return <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16 }}>
    {/* On a phone the live pill sits under the title; on a wider screen it is in the page header. */}
    {isMobile && <div>
      <button onClick={() => onGo?.("channels")} className="ui-btn" title={t("nav.channels")}
        style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 13px", borderRadius: 999, border: `1px solid ${liveN ? "transparent" : T.border}`, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600,
          background: liveN ? T.liveBg : T.card, color: liveN ? T.live : T.textMuted }}>
        <span className={liveN ? "ui-live" : ""} style={{ width: 8, height: 8, borderRadius: "50%", background: liveN ? T.live : T.textDim, display: "inline-block" }} />
        {liveN ? t("ov.live", { n: liveN }) : t("ov.notLive")}
      </button>
    </div>}

    {expiredN > 0 && <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: T.dangerBg, color: T.danger, fontSize: 12.5 }}>
      <i className="ti ti-plug-x" style={{ fontSize: 16 }} /><span style={{ flex: 1 }}>{t("ov.expired", { n: expiredN })}</span>
      <button onClick={() => onGo?.("channels")} className="ui-btn" style={{ background: "none", border: "none", color: T.danger, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5 }}>{t("ov.fix")}</button>
    </div>}

    {/* the four numbers for today */}
    {/* minmax(0, 1fr): a card's content can never widen its column past the
        screen — "1fr" alone lets a long label push the whole page out. */}
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0, 1fr) minmax(0, 1fr)" : "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
      <Kpi isMobile={isMobile} label={t("ov.kpi.convToday")} value={String(convDays[todayK])} delta={pct(convDays[todayK], convDays[ydayK])} spark={line(convDays)} />
      <Kpi isMobile={isMobile} label={t("ov.kpi.handled")} value={cv && cv.bot_resolved_pct != null ? `${cv.bot_resolved_pct}%` : "—"} delta={g?.bot_handled_points ?? null} unit=" pts" spark={aiLine.length ? aiLine : null} />
      {isAgency
        ? <Kpi isMobile={isMobile} label={t("ov.kpi.bookingsToday")} value={String(bookingDays[todayK])} delta={bookingDays[todayK] - bookingDays[ydayK]} unit="" spark={line(bookingDays)} />
        : <Kpi isMobile={isMobile} label={t("ov.kpi.ordersToday")} value={String(orderDays[todayK])} delta={orderDays[todayK] - orderDays[ydayK]} unit="" spark={line(orderDays)} />}
      {isAgency
        ? <Kpi isMobile={isMobile} label={t("ov.kpi.meetingsWeek")} value={String(upcoming.length)} spark={null} />
        : <Kpi isMobile={isMobile} label={t("ov.kpi.revenueToday")} value={fmtMoney(revenueDays[todayK])} delta={pct(revenueDays[todayK], revenueDays[ydayK])} spark={line(revenueDays)} />}
    </div>

    {/* messages this week + needs you */}
    <div style={{ display: "grid", gridTemplateColumns: cols, gap: 16 }}>
      <Section title={t("ov.week")} right={daily.length ? <span style={{ fontSize: 12, color: T.textMuted, fontVariantNumeric: "tabular-nums", marginLeft: "auto" }}>{t("ov.totalByAI", { n: weekTotal.toLocaleString("en-US"), p: weekPct })}</span> : null}>
        {daily.length ? <>
          <div style={{ display: "flex", gap: 14, fontSize: 11.5, color: T.textMuted, marginBottom: 12 }}>
            <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: T.inset, border: `1px solid ${T.borderStrong}`, marginRight: 5, verticalAlign: "-1px" }} />{t("ov.customerMsgs")}</span>
            <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: T.gold, marginRight: 5, verticalAlign: "-1px" }} />{t("ov.byAI")}</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: isMobile ? 8 : 14, height: 150 }}>
            {daily.map((d) => <div key={d.date} title={`${d.date}: ${d.customer || 0} · AI ${d.bot || 0}`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 4, flex: 1 }}>
                <div style={{ width: "34%", maxWidth: 14, height: `${Math.max(3, ((d.customer || 0) / maxBar) * 100)}%`, background: T.inset, border: `1px solid ${T.border}`, borderRadius: 6 }} />
                <div style={{ width: "34%", maxWidth: 14, height: `${Math.max(3, ((d.bot || 0) / maxBar) * 100)}%`, background: T.gold, borderRadius: 6 }} />
              </div>
              <div style={{ fontSize: 11, color: T.textDim, textAlign: "center", marginTop: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{dayName(d.date)}</div>
            </div>)}
          </div>
        </> : <Empty icon="ti-chart-bar" text={t("ov.weekEmpty")} />}
      </Section>

      <Section title={t("ov.needs")} action={t("ov.openInbox")} onAction={() => onGo?.("conversations")}>
        {needs.length ? <div>
          {needs.slice(0, 5).map(({ c, why }, i, a) => {
            const w = WHY[why];
            return <div key={c.id} style={{ ...row, borderBottom: i === a.length - 1 ? "none" : row.borderBottom }}>
              <span style={{ width: 36, height: 36, borderRadius: "50%", background: T.goldBg, color: T.gold, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12.5, flexShrink: 0 }}>{initialsOf(c.sender)}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: w.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.sender}</span>
                  <span style={{ fontSize: 11.5, color: T.textDim, flexShrink: 0 }}>{ago(c.time, t)}</span>
                </span>
                <span style={{ display: "block", fontSize: 12.5, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{w.label} · {c.lastMsg}</span>
              </span>
              <OpenBtn label={t("ov.open")} onClick={() => onGo?.("conversations", c.id)} />
            </div>;
          })}
          {needs.length > 5 && <div style={{ fontSize: 11.5, color: T.textDim, padding: "8px 0 0" }}>{t("ov.more", { n: needs.length - 5 })}</div>}
        </div> : <Empty icon="ti-circle-check" text={t("ov.needsEmpty")} />}
      </Section>
    </div>

    {/* recent orders / next meetings + channels */}
    <div style={{ display: "grid", gridTemplateColumns: cols, gap: 16 }}>
      {isAgency
        ? <Section title={t("ov.meetings")} action={t("nav.bookings")} onAction={() => onGo?.("orders")}>
            {nextMeetings.length ? <div>
              {nextMeetings.map((b, i, a) => <div key={b.id} style={{ ...row, borderBottom: i === a.length - 1 ? "none" : row.borderBottom }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.customer_name || t("ov.customer")}{b.service_want ? ` · ${b.service_want}` : ""}</span>
                  <span style={{ display: "block", fontSize: 12, color: T.textMuted, marginTop: 2 }}>{when(b.meeting_datetime)}</span>
                </span>
                {b.meeting_link
                  ? <a href={b.meeting_link} target="_blank" rel="noreferrer" className="ui-btn" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 8, background: T.accGrad, color: T.onGold, fontSize: 12.5, fontWeight: 600, textDecoration: "none", flexShrink: 0 }}><i className="ti ti-video" />{t("ov.join")}</a>
                  : <Badge color={T.textMuted}>{b.status || "—"}</Badge>}
              </div>)}
            </div> : <Empty icon="ti-calendar" text={t("ov.meetingsEmpty")} />}
          </Section>
        : <Section title={t("ov.recentOrders")} action={t("ov.allOrders")} onAction={() => onGo?.("orders")}>
            {recentOrders.length ? <div>
              {recentOrders.map((o, i, a) => <button key={o.id} onClick={() => onGo?.("orders", o.id)} className="ui-btn" style={{ ...row, width: "100%", border: "none", borderBottom: i === a.length - 1 ? "none" : row.borderBottom, background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: T.text, minWidth: 0, borderRadius: 0 }}>
                {!isMobile && <span style={{ fontSize: 12.5, color: T.textMuted, fontVariantNumeric: "tabular-nums", width: 64, flexShrink: 0 }}>{o.order_code || ""}</span>}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.customer_name || t("ov.customer")}</span>
                  {isMobile && <span style={{ display: "block", fontSize: 12, color: T.textMuted, marginTop: 2 }}>{o.order_code || ""} · {agoShort(o.created_at)}</span>}
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 600, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{fmtMoney(amount(o))}</span>
                <Badge color={SCOLOR[o.status] || T.textMuted}>{o.status || "Pending"}</Badge>
                {!isMobile && <span style={{ fontSize: 12, color: T.textDim, width: 36, textAlign: "right", flexShrink: 0, whiteSpace: "nowrap" }}>{agoShort(o.created_at)}</span>}
              </button>)}
            </div> : <Empty icon="ti-shopping-cart" text={t("ov.ordersEmpty")} />}
          </Section>}

      <Section title={t("ov.channels")} action={t("ov.manage")} onAction={() => onGo?.("channels")}>
        {channels.length ? <div>
          {channels.map((ch, i, a) => {
            const on = ch.status === "connected", exp = ch.status === "expired";
            const n = chatsToday(ch);
            return <div key={ch.id} style={{ ...row, borderBottom: i === a.length - 1 ? "none" : row.borderBottom }}>
              <span className={on ? "ui-live" : ""} title={on ? t("ov.ch.live") : exp ? t("ov.ch.expired") : t("ov.ch.paused")} style={{ width: 9, height: 9, borderRadius: "50%", background: on ? T.live : exp ? T.danger : T.textDim, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{PLABEL[ch.platform] || ch.platform}</span>
                <span style={{ display: "block", fontSize: 12, color: exp ? T.danger : T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{exp ? t("ov.ch.expired") : (ch.name || (ch.allowed_domains || [])[0] || ch.page_id || "")}</span>
              </span>
              <span style={{ textAlign: "right", flexShrink: 0 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{n}</span>
                <span style={{ display: "block", fontSize: 11.5, color: T.textMuted }}>{t("ov.chatsToday")}</span>
              </span>
            </div>;
          })}
        </div> : <Empty icon="ti-plug" text={t("ov.channelsEmpty")} />}
      </Section>
    </div>
  </div>;
}
