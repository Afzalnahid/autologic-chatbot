"use client";
import { useEffect, useMemo, useState } from "react";
import { T, Card, Badge, fmtNum, fmtMoney, useIsMobile } from "./ui.js";
import { api } from "./session.js";
import { useT } from "./i18n.js";
import { useConvoRead } from "./convo-read.js";

// The home tab (design handoff Part 3, screen 1): what happened this week,
// who needs the owner right now, the newest orders or the next meetings, and
// whether every channel is live. Everything on it is data the app already
// keeps — the week's numbers come from /api/analytics?days=7, the rest from
// the lists the dashboard shell has already loaded — so nothing here is
// generated or estimated.

const PICON = { facebook: "ti-brand-facebook", instagram: "ti-brand-instagram", whatsapp: "ti-brand-whatsapp", website: "ti-world" };
const PCOLOR = { facebook: "#1877f2", instagram: "#e1306c", whatsapp: "#25d366" };
const SCOLOR = { Pending: T.warn, Confirmed: T.success, Shipped: T.info, Delivered: T.success, Cancelled: T.danger, Returned: T.danger };

const ago = (iso, t) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return t("ov.now");
  if (m < 60) return t("ov.min", { n: m });
  if (m < 1440) return t("ov.hr", { n: Math.round(m / 60) });
  return t("ov.day", { n: Math.round(m / 1440) });
};

// A tiny 7-point line for the KPI cards — no library, no axes; the number
// beside it is the reading, the line only says which way it went.
function MiniSpark({ data, color, wide = false }) {
  const W = 92, H = 30, P = 2;
  const max = Math.max(1, ...data), n = data.length;
  const x = (i) => (n <= 1 ? W / 2 : P + (i / (n - 1)) * (W - P * 2));
  const y = (v) => H - P - (v / max) * (H - P * 2);
  const d = data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = n > 1 ? `${d} L${x(n - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z` : "";
  return <svg viewBox={`0 0 ${W} ${H}`} width={wide ? "100%" : W} height={H} preserveAspectRatio="none" style={{ display: "block", flexShrink: 0, overflow: "visible" }} aria-hidden="true">
    {area && <path d={area} fill={color} opacity="0.12" />}
    <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
  </svg>;
}

function Kpi({ icon, label, value, sub, trend, spark, color = T.gold, stack = false }) {
  const up = typeof trend === "number" && trend > 0, down = typeof trend === "number" && trend < 0;
  return <Card style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 28, height: 28, borderRadius: 8, background: `color-mix(in srgb, ${color} 10%, transparent)`, color, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><i className={`ti ${icon}`} style={{ fontSize: 15 }} /></span>
      <span style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: .7, lineHeight: 1.25, minWidth: 0 }}>{label}</span>
    </div>
    <div style={{ display: "flex", flexDirection: stack ? "column" : "row", alignItems: stack ? "stretch" : "flex-end", justifyContent: "space-between", gap: 10, minWidth: 0 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.05, color: T.text }}>{value}</div>
        <div style={{ fontSize: 11.5, color: T.textDim, marginTop: 5, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {typeof trend === "number" && <span style={{ color: up ? T.success : down ? T.danger : T.textDim, fontWeight: 600, whiteSpace: "nowrap" }}>
            <i className={`ti ${up ? "ti-trending-up" : down ? "ti-trending-down" : "ti-minus"}`} style={{ marginRight: 3 }} />{Math.abs(trend)}%
          </span>}
          <span style={{ whiteSpace: "nowrap" }}>{sub}</span>
        </div>
      </div>
      {spark && <MiniSpark data={spark} color={color} wide={stack} />}
    </div>
  </Card>;
}

function Section({ title, action, onAction, children, style }) {
  return <Card style={{ padding: "16px 18px", ...style }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
      {action && <button onClick={onAction} className="ui-btn" style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, color: T.gold, padding: 0 }}>{action} <i className="ti ti-arrow-right" style={{ fontSize: 12 }} /></button>}
    </div>
    {children}
  </Card>;
}

const Empty = ({ icon, text }) => <div style={{ padding: "18px 6px", textAlign: "center", color: T.textDim, fontSize: 12.5 }}>
  <i className={`ti ${icon}`} style={{ fontSize: 22, display: "block", marginBottom: 6 }} />{text}
</div>;

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

  // The greeting and the date are the page header now (Shell.js), on every
  // tab; this page opens with what the week looked like and whether the bot
  // is live.
  const liveN = channels.filter((c) => c.status === "connected").length;
  const expiredN = channels.filter((c) => c.status === "expired").length;

  // ── the week ─────────────────────────────────────────────────────────────
  const k = an?.kpi, g = an?.growth, cv = an?.conversations;
  const daily = (an?.daily || []).map((d) => ({ ...d, total: d.total ?? ((d.customer || 0) + (d.bot || 0) + (d.agent || 0)) }));
  const week = daily.slice(-7);
  const spark = (key) => week.map((d) => d[key] || 0);
  const convDaily = (an?.conversions_daily || []).slice(-7);
  const dayName = (s) => new Date(s + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" });
  const maxDay = Math.max(1, ...week.map((d) => d.total || 0));

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
    human: { label: t("ov.why.human"), color: T.danger, icon: "ti-hand-stop" },
    complaint: { label: t("ov.why.complaint"), color: T.danger, icon: "ti-alert-triangle" },
    unread: { label: t("ov.why.unread"), color: T.gold, icon: "ti-mail" },
  };

  // ── recent orders / next meetings ────────────────────────────────────────
  const recentOrders = [...orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
  const nextMeetings = bookings
    .filter((b) => b.meeting_datetime && !isNaN(new Date(b.meeting_datetime)) && new Date(b.meeting_datetime) >= new Date() && !/cancel/i.test(b.status || ""))
    .sort((a, b) => new Date(a.meeting_datetime) - new Date(b.meeting_datetime)).slice(0, 4);
  const when = (iso) => new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  const cols = isMobile ? "1fr" : "repeat(auto-fit, minmax(min(100%, 300px), 1fr))";

  return <div style={{ display: "grid", gap: 16 }}>
    {/* the week's lead line + live pill */}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div style={{ fontSize: 14, fontWeight: 600, minWidth: 0 }}>{t("ov.lead")}</div>
      <button onClick={() => onGo?.("channels")} className="ui-btn" title={t("nav.channels")}
        style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 13px", borderRadius: 999, border: `1px solid ${liveN ? "transparent" : T.border}`, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600,
          background: liveN ? T.liveBg : T.card, color: liveN ? T.live : T.textMuted }}>
        <span className={liveN ? "ui-live" : ""} style={{ width: 8, height: 8, borderRadius: "50%", background: liveN ? T.live : T.textDim, display: "inline-block" }} />
        {liveN ? t("ov.live", { n: liveN }) : t("ov.notLive")}
      </button>
    </div>

    {expiredN > 0 && <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: T.dangerBg, color: T.danger, fontSize: 12.5 }}>
      <i className="ti ti-plug-x" style={{ fontSize: 16 }} /><span style={{ flex: 1 }}>{t("ov.expired", { n: expiredN })}</span>
      <button onClick={() => onGo?.("channels")} className="ui-btn" style={{ background: "none", border: "none", color: T.danger, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5 }}>{t("ov.fix")}</button>
    </div>}

    {/* KPI cards */}
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
      <Kpi stack={isMobile} icon="ti-messages" color={T.info} label={t("ov.kpi.messages")} value={k ? fmtNum(k.total_messages) : "—"} sub={k ? t("ov.today", { n: k.messages_today }) : ""} trend={g?.messages} spark={k && spark("total")} />
      <Kpi stack={isMobile} icon="ti-users" color={T.success} label={t("ov.kpi.customers")} value={k ? fmtNum(k.unique_contacts) : "—"} sub={k ? t("ov.new", { n: k.new_contacts }) : ""} trend={g?.contacts} spark={k && spark("customer")} />
      <Kpi stack={isMobile} icon="ti-robot" color={T.gold} label={t("ov.kpi.bot")} value={cv ? (cv.bot_resolved_pct === null ? "—" : `${cv.bot_resolved_pct}%`) : "—"} sub={cv ? t("ov.needed", { n: cv.handoff }) : ""} trend={g?.bot_handled_points} spark={k && spark("bot")} />
      {isAgency
        ? <Kpi stack={isMobile} icon="ti-calendar-event" color={T.purple} label={t("ov.kpi.bookings")} value={k ? fmtNum(k.bookings) : "—"} sub={k ? (k.conversion_pct === null ? "" : t("ov.ofCustomers", { n: k.conversion_pct })) : ""} trend={g?.conversions} spark={k && convDaily.map((d) => d.bookings || 0)} />
        : <Kpi stack={isMobile} icon="ti-cash" color={T.purple} label={t("ov.kpi.revenue")} value={k ? fmtMoney(k.revenue) : "—"} sub={k ? t("ov.orders", { n: k.orders }) : ""} trend={g?.revenue} spark={k && convDaily.map((d) => d.revenue || 0)} />}
    </div>

    {/* messages this week + needs you */}
    <div style={{ display: "grid", gridTemplateColumns: cols, gap: 16 }}>
      <Section title={t("ov.week")}>
        {week.length ? <>
          <div style={{ display: "flex", gap: 12, fontSize: 11.5, color: T.textMuted, marginBottom: 12 }}>
            <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: T.inset, border: `1px solid ${T.borderStrong}`, marginRight: 5, verticalAlign: "-1px" }} />{t("ov.all")}</span>
            <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: T.gold, marginRight: 5, verticalAlign: "-1px" }} />{t("ov.byAI")}</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: isMobile ? 6 : 10, height: 120 }}>
            {week.map((d) => <div key={d.date} title={`${d.date}: ${d.total} · AI ${d.bot}`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%", minWidth: 0 }}>
              <div style={{ position: "relative", height: `${Math.max(d.total ? 4 : 2, (d.total / maxDay) * 100)}%`, background: T.inset, border: `1px solid ${T.border}`, borderRadius: 5, overflow: "hidden" }}>
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${d.total ? (Math.min(d.bot, d.total) / d.total) * 100 : 0}%`, background: T.gold, opacity: .9 }} />
              </div>
              <div style={{ fontSize: 10.5, color: T.textDim, textAlign: "center", marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{dayName(d.date)}</div>
            </div>)}
          </div>
        </> : <Empty icon="ti-chart-bar" text={t("ov.weekEmpty")} />}
      </Section>

      <Section title={t("ov.needs")} action={t("ov.openInbox")} onAction={() => onGo?.("conversations")}>
        {needs.length ? <div style={{ display: "grid", gap: 4 }}>
          {needs.slice(0, 6).map(({ c, why }) => {
            const w = WHY[why];
            return <button key={c.id} onClick={() => onGo?.("conversations", c.id)} className="ui-btn" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: T.text, width: "100%", minWidth: 0 }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: T.inset, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0, position: "relative" }}>
                {(c.sender || "?").trim().slice(0, 1).toUpperCase()}
                <i className={`ti ${PICON[c.platform] || "ti-message"}`} style={{ position: "absolute", right: -4, bottom: -4, fontSize: 11, color: PCOLOR[c.platform] || T.textMuted, background: T.card, borderRadius: "50%", padding: 1 }} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.sender}</span>
                <span style={{ display: "block", fontSize: 11.5, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.lastMsg}</span>
              </span>
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                <Badge color={w.color}><i className={`ti ${w.icon}`} style={{ marginRight: 4 }} />{w.label}</Badge>
                <span style={{ fontSize: 10.5, color: T.textDim }}>{ago(c.time, t)}</span>
              </span>
            </button>;
          })}
          {needs.length > 6 && <div style={{ fontSize: 11.5, color: T.textDim, padding: "4px 8px" }}>{t("ov.more", { n: needs.length - 6 })}</div>}
        </div> : <Empty icon="ti-circle-check" text={t("ov.needsEmpty")} />}
      </Section>
    </div>

    {/* recent orders / next meetings + channels */}
    <div style={{ display: "grid", gridTemplateColumns: cols, gap: 16 }}>
      {isAgency
        ? <Section title={t("ov.meetings")} action={t("nav.bookings")} onAction={() => onGo?.("orders")}>
            {nextMeetings.length ? <div style={{ display: "grid", gap: 4 }}>
              {nextMeetings.map((b) => <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", borderRadius: 8 }}>
                <span style={{ width: 32, height: 32, borderRadius: 10, background: `color-mix(in srgb, ${T.purple} 10%, transparent)`, color: T.purple, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><i className="ti ti-calendar-event" /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.customer_name || t("ov.customer")}{b.service_want ? ` · ${b.service_want}` : ""}</span>
                  <span style={{ display: "block", fontSize: 11.5, color: T.textMuted }}>{when(b.meeting_datetime)}</span>
                </span>
                {b.meeting_link
                  ? <a href={b.meeting_link} target="_blank" rel="noreferrer" className="ui-btn" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 8, background: T.accGrad, color: T.onGold, fontSize: 12, fontWeight: 600, textDecoration: "none", flexShrink: 0 }}><i className="ti ti-video" />{t("ov.join")}</a>
                  : <Badge color={T.textMuted}>{b.status || "—"}</Badge>}
              </div>)}
            </div> : <Empty icon="ti-calendar" text={t("ov.meetingsEmpty")} />}
          </Section>
        : <Section title={t("ov.recentOrders")} action={t("nav.orders")} onAction={() => onGo?.("orders")}>
            {recentOrders.length ? <div style={{ display: "grid", gap: 4 }}>
              {recentOrders.map((o) => <button key={o.id} onClick={() => onGo?.("orders", o.id)} className="ui-btn" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: T.text, width: "100%", minWidth: 0 }}>
                <span style={{ width: 32, height: 32, borderRadius: 10, background: T.inset, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{(o.customer_name || "?").trim().slice(0, 1).toUpperCase()}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.customer_name || t("ov.customer")} <span style={{ color: T.textDim, fontWeight: 500 }}>· {o.order_code || ""}</span></span>
                  <span style={{ display: "block", fontSize: 11.5, color: T.textMuted }}>{ago(o.created_at, t)}{o.qty_total ? ` · ${t("ov.items", { n: o.qty_total })}` : ""}</span>
                </span>
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmtMoney(o.total)}</span>
                  <Badge color={SCOLOR[o.status] || T.textMuted}>{o.status || "Pending"}</Badge>
                </span>
              </button>)}
            </div> : <Empty icon="ti-shopping-cart" text={t("ov.ordersEmpty")} />}
          </Section>}

      <Section title={t("ov.channels")} action={t("ov.manage")} onAction={() => onGo?.("channels")}>
        {channels.length ? <div style={{ display: "grid", gap: 4 }}>
          {channels.map((ch) => {
            const on = ch.status === "connected", exp = ch.status === "expired";
            return <div key={ch.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", borderRadius: 8 }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: `${PCOLOR[ch.platform] || T.gold}14`, color: PCOLOR[ch.platform] || T.gold, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><i className={`ti ${PICON[ch.platform] || "ti-plug"}`} style={{ fontSize: 16 }} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.name || ch.platform}</span>
                <span style={{ display: "block", fontSize: 11.5, color: exp ? T.danger : T.textMuted }}>{on ? t("ov.ch.live") : exp ? t("ov.ch.expired") : t("ov.ch.paused")}</span>
              </span>
              <span className={on ? "ui-live" : ""} style={{ width: 9, height: 9, borderRadius: "50%", background: on ? T.live : exp ? T.danger : T.textDim, flexShrink: 0 }} />
            </div>;
          })}
        </div> : <Empty icon="ti-plug" text={t("ov.channelsEmpty")} />}
      </Section>
    </div>
  </div>;
}
