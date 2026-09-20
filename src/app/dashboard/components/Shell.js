"use client";
import { useEffect, useState } from "react";
import { T, ThemeToggle, Theme, Motion } from "./ui.js";
import { BotMark } from "@/lib/brand.js";
import NotificationsBell from "./NotificationsBell.js";
import GlobalSearch from "./GlobalSearch.js";
import { LangToggle, useLang } from "./i18n.js";
import { api } from "./session.js";

// The dashboard's frame — the sidebar, the page header and the column the
// tabs render in — as the owner's final design deck draws it ("TellMore AI
// Premium UI Directions", the ten-page Overview set, 2026-09-20), one
// component for every screen:
//
//   · desktop and Mac (≥1100px): a flush sidebar with the business name, the
//     tabs under Workspace / Grow / Train / Account headings, a white card on
//     the current one, grey counts on Inbox and Orders, and "Replies this
//     month · 84%" at the foot;
//   · tablet (768–1099px): the same tabs as an icon rail with a small label
//     under each icon and a dot where a count would be;
//   · phone (<768px): the tabs along the bottom of the screen (Overview,
//     Inbox, Orders or Bookings, Analytics, More — which opens the full menu
//     as a drawer), and a header of just the title, the date and the bell.
//
// Every page opens with the date ("Sunday, 20 September · 3 chats need
// you"), a greeting, the "Bot is live on N channels" pill and one button,
// "Train your bot". dashboard-client.js owns every piece of state; this
// only draws it. The screenshot studio draws the same component around
// sample data ("shell" scenes).

const PCOLOR = { facebook: "#1877f2", instagram: "#e1306c", whatsapp: "#25d366" };

function NavItem({ icon, label, badge, on, onClick, rail = false }) {
  if (rail) return <button type="button" onClick={onClick} className="nav-item" aria-current={on ? "page" : undefined} aria-label={label} title={label}
    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: "100%", padding: "8px 4px", borderRadius: 10, border: "none",
      cursor: "pointer", fontFamily: "inherit", background: "transparent", color: on ? T.gold : T.railText, minHeight: 56 }}>
    <span style={{ position: "relative", width: 40, height: 30, borderRadius: 15, background: on ? T.goldBg : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <i className={`ti ${icon}`} style={{ fontSize: 19 }} />
      {badge != null && <span aria-label={badge} style={{ position: "absolute", top: 3, right: 5, width: 7, height: 7, borderRadius: "50%", background: T.gold, border: `2px solid ${T.rail}`, boxSizing: "content-box" }} />}
    </span>
    <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 500, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
  </button>;
  return <button type="button" onClick={onClick} className="nav-item" aria-current={on ? "page" : undefined}
    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 11px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit",
      fontSize: 13.5, fontWeight: on ? 600 : 500, textAlign: "left", minHeight: 38, background: on ? T.card : "transparent",
      border: `1px solid ${on ? T.border : "transparent"}`, boxShadow: on ? T.nmSm : "none", color: on ? T.text : T.railText,
      transition: "background .18s ease-out, color .18s ease-out" }}>
    <i className={`ti ${icon}`} style={{ fontSize: 17, flexShrink: 0, color: on ? T.gold : "inherit" }} />
    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
    {badge != null && <span style={{ background: T.inset, color: T.textMuted, fontSize: 11, fontWeight: 600, minWidth: 22, height: 20, borderRadius: 10,
      display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 7px", flexShrink: 0 }}>{badge}</span>}
  </button>;
}

// "Replies this month · 84%" at the foot of the sidebar. /api/billing
// already works out the month's (or, on a trial, the day's) bot replies
// against the package, so this reads that rather than counting again.
function PlanMeter({ me, t, onClick }) {
  const [b, setB] = useState(null);
  useEffect(() => {
    let live = true;
    api(`/api/billing?t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json())
      .then((d) => { if (live && d && !d.error) setB(d); }).catch(() => {});
    return () => { live = false; };
  }, [me?.client?.plan]);
  if (!b) return null;
  const u = b.usage || {};
  const daily = u.daily_limit != null && u.daily_limit > 0;
  const used = daily ? u.today : u.month;
  const limit = daily ? u.daily_limit : u.monthly_limit;
  const pct = limit && used != null ? Math.min(100, Math.round((used / limit) * 100)) : null;
  const n = (v) => Number(v || 0).toLocaleString("en-US");
  const title = `${b.plan_name || ""}${used != null ? ` · ${n(used)}${limit ? ` / ${n(limit)}` : ""}` : ""}`;
  return <button type="button" onClick={onClick} className="ui-btn" title={title} aria-label={`${t(daily ? "shell.repliesToday" : "shell.repliesMonth")}: ${title}`}
    style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 10, background: T.card, border: `1px solid ${T.border}`,
      cursor: "pointer", fontFamily: "inherit", color: T.text }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
      <span style={{ fontSize: 12, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t(daily ? "shell.repliesToday" : "shell.repliesMonth")}</span>
      <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{pct != null ? `${pct}%` : n(used)}</span>
    </div>
    {pct != null && <div style={{ height: 5, borderRadius: 3, background: T.inset, marginTop: 8, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: pct >= 90 ? T.danger : T.gold, transition: "width .4s ease-out" }} />
    </div>}
  </button>;
}

export default function Shell({ isMobile, sidebarOpen, setSidebarOpen, fullBleed, me, groups, PAGES, ICONS,
  page, setPage, HOME, navLabel, t, isAgency, activeCount, pendingOrders, onLogout, load, loading, mode, toggleTheme,
  convos, feed, goTo, orders = [], products = [], channels = [], onFind, children }) {
  const lang = useLang();
  // Tablet or desktop: the same tabs, as an icon rail or a full sidebar.
  const [w, setW] = useState(1400);
  useEffect(() => {
    const check = () => setW(window.innerWidth);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const rail = !isMobile && w < 1100;
  const [searchOpen, setSearchOpen] = useState(false);
  const hour = new Date().getHours();
  const greet = hour < 12 ? t("ov.morning") : hour < 17 ? t("ov.afternoon") : t("ov.evening");
  const name = me?.client?.business_name || "";
  // "Sunday, 20 September" — the weekday, a comma, then the date.
  const loc = lang === "bn" ? "bn-BD" : "en-GB";
  const now = new Date();
  const today = `${now.toLocaleDateString(loc, { weekday: "long" })}, ${now.toLocaleDateString(loc, { day: "numeric", month: "long" })}`;
  const tabName = navLabel(PAGES.indexOf(page));
  const liveN = channels.filter((c) => c.status === "connected").length;
  const iconFor = (p) => {
    const i = PAGES.indexOf(p);
    if (isAgency && p === "inventory") return "ti-database";
    if (isAgency && p === "orders") return "ti-calendar-event";
    return ICONS[i];
  };
  const badgeFor = (p) => {
    if (p === "conversations" && activeCount) return String(activeCount);
    if (p === "orders" && !isAgency && pendingOrders) return String(pendingOrders);
    return undefined;
  };
  const go = (p) => { setPage(p); if (isMobile) setSidebarOpen(false); };
  const SIDE = rail ? 96 : 240;
  // A phone gets the sidebar's most-used entries as a bar along the bottom:
  // Overview, Inbox, Orders or Bookings, Analytics, and More, which opens the
  // full menu. Not while a chat or the assistant fills the screen — the
  // composer owns the bottom then. The bar's height is published as
  // --bottom-bar so anything fixed to the bottom of the screen (a save bar,
  // a bulk-action bar) can sit above it.
  const showBar = isMobile && !fullBleed;
  const BAR = 58;
  const tabs = [
    { p: "overview" },
    { p: "conversations", badge: badgeFor("conversations") },
    { p: "orders", badge: badgeFor("orders") },
    { p: "analytics" },
    { more: true },
  ];
  const livePill = <button onClick={() => go("channels")} className="ui-btn" title={t("nav.channels")}
    style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "0 13px", height: 36, borderRadius: 999, border: `1px solid ${liveN ? "transparent" : T.border}`,
      cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, background: liveN ? T.liveBg : T.card, color: liveN ? T.live : T.textMuted, whiteSpace: "nowrap" }}>
    <span className={liveN ? "ui-live" : ""} style={{ width: 8, height: 8, borderRadius: "50%", background: liveN ? T.live : T.textDim, display: "inline-block" }} />
    {liveN ? t("ov.live", { n: liveN }) : t("ov.notLive")}
  </button>;

  return <div style={{ display: "flex", height: "100dvh", overflow: "hidden", background: T.bg, "--bottom-bar": showBar ? `${BAR}px` : "0px" }}>
    <Theme /><Motion />
    <style dangerouslySetInnerHTML={{ __html: `
      @media (hover: hover) and (pointer: fine) { .nav-item:not([aria-current]):hover { background: ${T.railHover}; color: ${T.text} } }
      .nav-item:focus-visible { outline: 2px solid ${T.gold}; outline-offset: 2px }
      .shell-primary { background: var(--acc-grad); color: var(--onGold); box-shadow: var(--acc-glow) }
      @media (hover: hover) and (pointer: fine) { .shell-primary:hover { filter: brightness(1.06) } }
    ` }} />
    {sidebarOpen && isMobile && <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 40 }} />}

    {/* The sidebar: flush to the left edge with a hairline on its right. On a
        phone it is a drawer over the page (opened from More); on a tablet an
        icon rail; on a desktop the full list under its headings. */}
    <div style={{ position: "fixed", zIndex: 50, top: 0, bottom: 0, left: 0,
      width: isMobile ? "min(280px, calc(100vw - 40px))" : SIDE, background: T.rail, borderRight: `1px solid ${T.border}`,
      boxShadow: isMobile && sidebarOpen ? T.nmOut : "none", display: "flex", flexDirection: "column", flexShrink: 0,
      transform: sidebarOpen ? "translateX(0)" : "translateX(calc(-100% - 40px))",
      visibility: sidebarOpen ? "visible" : "hidden",
      transition: sidebarOpen
        ? "transform 0.28s cubic-bezier(.22,.61,.36,1), box-shadow .2s ease-out, visibility 0s"
        : "transform 0.28s cubic-bezier(.22,.61,.36,1), box-shadow .2s ease-out, visibility 0s .28s",
      paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* The brand block: the business, then the product. On the rail only the mark. */}
      <div style={{ padding: rail ? "16px 0 8px" : "18px 14px 10px 18px", display: "flex", alignItems: "center", justifyContent: rail ? "center" : "flex-start", gap: 10 }}>
        <span style={{ width: rail ? 40 : 32, height: rail ? 40 : 32, borderRadius: rail ? 12 : 9, background: T.card, border: `1px solid ${T.border}`, display: "flex",
          alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
          {me?.client?.logo_url
            ? <img src={me.client.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <BotMark size={rail ? 28 : 24} />}
        </span>
        {!rail && <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: T.text, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name || "TellMore AI"}</span>
          <span style={{ display: "block", fontSize: 11.5, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>TellMore AI · {isAgency ? t("shell.service") : t("shell.business")}</span>
        </span>}
        {isMobile && <button onClick={() => setSidebarOpen(false)} className="ui-btn" aria-label="Close menu"
          style={{ width: 32, height: 32, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center",
            background: "transparent", border: "none", color: T.textDim, cursor: "pointer", padding: 0 }}>
          <i className="ti ti-x" style={{ fontSize: 17 }} />
        </button>}
      </div>

      <nav style={{ flex: 1, padding: rail ? "2px 8px" : "2px 12px", overflowY: "auto", minHeight: 0 }}>
        {groups.map((g, gi) => <div key={g.title} style={{ marginTop: gi ? (rail ? 6 : 12) : 0 }}>
          {!rail && <div style={{ fontSize: 11, fontWeight: 600, color: T.textDim, padding: "0 11px", marginBottom: 4 }}>{t("group." + g.title)}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {g.pages.map((p) => <NavItem key={p} rail={rail} icon={iconFor(p)} label={navLabel(PAGES.indexOf(p))} badge={badgeFor(p)} on={page === p} onClick={() => go(p)} />)}
          </div>
        </div>)}
      </nav>

      <div style={{ padding: rail ? "6px 8px 12px" : "6px 12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        {!rail && <PlanMeter me={me} t={t} onClick={() => go("billing")} />}
        {/* Language, sync, theme and Log out, small, under the meter. Log out
            lands on the app's own sign-in screen. */}
        {/* The rail is 96px wide, and a touch screen makes every square button
            44px — a row of them spilled out of the panel. On the rail the
            controls stack; refresh stays on the full sidebar. */}
        <div style={{ display: "flex", flexDirection: rail ? "column" : "row", alignItems: "center", justifyContent: rail ? "center" : "space-between", gap: 6, flexWrap: rail ? "nowrap" : "wrap", minWidth: 0 }}>
          <LangToggle compact />
          <div style={{ display: "flex", flexDirection: rail ? "column" : "row", alignItems: "center", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
            {!rail && <button onClick={() => load(false)} disabled={loading} className={`pbtn${loading ? " is-busy" : ""}`}
              title={t("shell.sync")} aria-label={t("shell.sync")} style={{ width: 34, height: 34, borderRadius: 9, boxShadow: "none", background: "transparent" }}>
              <i className="ti ti-refresh" style={{ animation: loading ? "spin 0.8s linear infinite" : "none", fontSize: 17 }} />
            </button>}
            <ThemeToggle mode={mode} toggle={toggleTheme} style={{ width: 34, height: 34, borderRadius: 9, boxShadow: "none", background: "transparent" }} />
            <button onClick={onLogout} className="pbtn" title={t("shell.logout")} aria-label={t("shell.logout")}
              style={{ width: 34, height: 34, borderRadius: 9, boxShadow: "none", background: "transparent" }}>
              <i className="ti ti-logout" style={{ fontSize: 17 }} />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0,
      marginLeft: (!isMobile && sidebarOpen) ? SIDE : 0, transition: "margin-left 0.28s cubic-bezier(.22,.61,.36,1)" }}>
      {/* The page header. Desktop and tablet: the date with how many chats
          need a person, a greeting, the live pill and Train your bot. Phone:
          the title ("Today" on the home tab), the date and the bell. */}
      {!fullBleed && <div style={{ padding: isMobile ? "12px 14px 0" : "20px 24px 0", display: "flex", alignItems: "center", gap: isMobile ? 10 : 14, flexShrink: 0 }}>
        {!sidebarOpen && !isMobile && <button onClick={() => setSidebarOpen(true)} className="pbtn" aria-label="Menu"><i className="ti ti-menu-2" /></button>}
        {isMobile && <span style={{ width: 36, height: 36, borderRadius: 10, background: T.card, border: `1px solid ${T.border}`, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
          {me?.client?.logo_url ? <img src={me.client.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <BotMark size={26} />}
        </span>}
        <div style={{ minWidth: 0, flex: 1 }}>
          {isMobile
            ? <>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{page === HOME ? t("ov.todayTitle") : tabName}</div>
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{today}</div>
            </>
            : <>
              <div style={{ fontSize: 12.5, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {today}{activeCount ? ` · ${t("shell.needYou", { n: activeCount })}` : page !== HOME ? ` · ${tabName}` : ""}
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {greet}{name ? `, ${name}` : ""}
              </div>
            </>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 10, flexShrink: 0 }}>
          {!isMobile && w >= 1280 && <GlobalSearch convos={convos} orders={orders} products={products} isAgency={isAgency} onGo={onFind} t={t} style={{ width: 240 }} />}
          {isMobile && <button onClick={() => setSearchOpen((v) => !v)} className="pbtn" aria-label={t("shell.searchAria")} aria-expanded={searchOpen}
            style={{ width: 38, height: 38, borderRadius: 10, boxShadow: "none", background: "transparent" }}><i className={`ti ti-${searchOpen ? "x" : "search"}`} /></button>}
          {!isMobile && livePill}
          <NotificationsBell convos={convos} feed={feed} isMobile={isMobile} onNavigate={goTo} />
          {!isMobile && <button onClick={() => setPage("settings")} className="ui-btn shell-primary" title={t("shell.train")}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, border: "none", cursor: "pointer",
              fontFamily: "inherit", fontSize: 13.5, fontWeight: 600, borderRadius: 8, height: 40, padding: "0 16px", whiteSpace: "nowrap" }}>
            {t("shell.train")}
          </button>}
        </div>
      </div>}
      {!fullBleed && isMobile && searchOpen && <div style={{ padding: "10px 14px 0", flexShrink: 0 }}>
        <GlobalSearch convos={convos} orders={orders} products={products} isAgency={isAgency} onGo={onFind} t={t} autoFocus onClose={() => setSearchOpen(false)} />
      </div>}
      {children}
      {showBar && <nav aria-label="Main" style={{ flexShrink: 0, display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", background: T.card,
        borderTop: `1px solid ${T.border}`, height: `calc(${BAR}px + env(safe-area-inset-bottom))`, paddingBottom: "env(safe-area-inset-bottom)", zIndex: 45 }}>
        {tabs.map((tab) => {
          const on = tab.more ? sidebarOpen : page === tab.p;
          const label = tab.more ? t("nav.more") : navLabel(PAGES.indexOf(tab.p));
          const icon = tab.more ? "ti-dots-vertical" : iconFor(tab.p);
          return <button key={tab.p || "more"} type="button" onClick={() => tab.more ? setSidebarOpen(true) : go(tab.p)} aria-current={on && !tab.more ? "page" : undefined}
            aria-label={label} className="tab-item"
            style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, minWidth: 0, height: BAR,
              background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "0 2px", color: on ? T.gold : T.textMuted }}>
            <span style={{ position: "relative", width: 44, height: 28, borderRadius: 14, background: on ? T.goldBg : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <i className={`ti ${icon}`} style={{ fontSize: 20 }} />
              {tab.badge && <span style={{ position: "absolute", top: -5, right: 0, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8, background: T.accGrad, color: T.onGold,
                fontSize: 9.5, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", border: `2px solid ${T.card}`, boxSizing: "content-box" }}>{tab.badge}</span>}
            </span>
            <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 500, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
          </button>;
        })}
      </nav>}
    </div>
  </div>;
}
