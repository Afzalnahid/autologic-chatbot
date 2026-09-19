"use client";
import { useEffect, useState } from "react";
import { T, ThemeToggle, Theme, Motion } from "./ui.js";
import { BotMark } from "@/lib/brand.js";
import NotificationsBell from "./NotificationsBell.js";
import { LangToggle, useLang } from "./i18n.js";
import { api } from "./session.js";

// The dashboard's frame — the sidebar, the page header and the column the
// tabs render in — as the owner's design deck draws it ("TellMore AI —
// Premium UI Directions", the maroon direction, 2026-09-20):
//
//   · a flat sidebar: the product mark, one plain list of tabs with a tinted
//     pill on the current one and a count on Inbox (unread) and Orders
//     (pending), and at the bottom the package meter — "Shop Growth ·
//     1,834 of 5,000 replies used this month";
//   · no bar across the top. Each page opens with the date as an eyebrow and
//     a greeting as its title, the bell and one primary button, "Train your
//     bot", on the right.
//
// The language, theme and sync controls live in the sidebar footer on every
// screen size, where the phone already kept them. dashboard-client.js owns
// every piece of state; this only draws it. The screenshot studio draws the
// same component around sample data ("shell" scenes).

const rail = `linear-gradient(180deg, color-mix(in srgb, ${T.gold} 5%, ${T.rail}) 0%, ${T.rail} 58%)`;

function NavItem({ icon, label, badge, on, onClick }) {
  return <button type="button" onClick={onClick} className="nav-item" aria-current={on ? "page" : undefined}
    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", borderRadius: 10,
      border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: on ? 600 : 500,
      textAlign: "left", minHeight: 40, background: on ? T.goldBg : "transparent", color: on ? T.gold : T.railText,
      transition: "background .18s ease-out, color .18s ease-out" }}>
    <i className={`ti ${icon}`} style={{ fontSize: 17, flexShrink: 0 }} />
    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
    {badge != null && <span style={{ background: on ? T.accGrad : T.goldBg, color: on ? T.onGold : T.gold, fontSize: 10.5,
      fontWeight: 700, minWidth: 20, height: 20, borderRadius: 10, display: "inline-flex", alignItems: "center",
      justifyContent: "center", padding: "0 6px", flexShrink: 0 }}>{badge}</span>}
  </button>;
}

// The package meter at the foot of the sidebar. /api/billing already works
// out the month's (or, on a trial, the day's) bot replies against the
// package, so this reads that rather than counting again.
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
  // Whole numbers with separators ("1,834 of 5,000"), not the short form the
  // KPI cards use — an allowance is read exactly.
  const n = (v) => Number(v || 0).toLocaleString("en-US");
  const line = used == null ? "" : limit
    ? t(daily ? "shell.usedDay" : "shell.usedMonth", { used: n(used), limit: n(limit) })
    : t("shell.usedFree", { used: n(used) });
  return <button type="button" onClick={onClick} className="ui-btn" title={t("shell.managePlan")}
    style={{ display: "block", width: "100%", textAlign: "left", margin: "8px 0 0", padding: "11px 13px", borderRadius: 12,
      background: T.card, border: `1px solid ${T.border}`, cursor: "pointer", fontFamily: "inherit", color: T.text }}>
    <div style={{ fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.plan_name || t("nav.billing")}</div>
    {line && <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 2, lineHeight: 1.4 }}>{line}</div>}
    {pct != null && <div style={{ height: 6, borderRadius: 3, background: T.inset, marginTop: 8, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: pct >= 90 ? T.danger : T.accGrad, transition: "width .4s ease-out" }} />
    </div>}
  </button>;
}

export default function Shell({ isMobile, sidebarOpen, setSidebarOpen, fullBleed, me, nav, PAGES, ICONS,
  page, setPage, HOME, navLabel, t, isAgency, activeCount, pendingOrders, onLogout, load, loading, mode, toggleTheme,
  convos, feed, goTo, children }) {
  const lang = useLang();
  const hour = new Date().getHours();
  const greet = hour < 12 ? t("ov.morning") : hour < 17 ? t("ov.afternoon") : t("ov.evening");
  const name = me?.client?.business_name || "";
  // "Sunday, 20 September" — the weekday, a comma, then the date.
  const loc = lang === "bn" ? "bn-BD" : "en-GB";
  const now = new Date();
  const today = `${now.toLocaleDateString(loc, { weekday: "long" })}, ${now.toLocaleDateString(loc, { day: "numeric", month: "long" })}`;
  const tabName = navLabel(PAGES.indexOf(page));
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
  const SIDE = 236;

  return <div style={{ display: "flex", height: "100dvh", overflow: "hidden", background: T.bg }}>
    <Theme /><Motion />
    <style dangerouslySetInnerHTML={{ __html: `
      @media (hover: hover) and (pointer: fine) { .nav-item:not([aria-current]):hover { background: ${T.railHover}; color: ${T.text} } }
      .nav-item:focus-visible { outline: 2px solid ${T.gold}; outline-offset: 2px }
      .shell-primary { background: var(--acc-grad); color: var(--onGold); box-shadow: var(--acc-glow) }
      @media (hover: hover) and (pointer: fine) { .shell-primary:hover { filter: brightness(1.06) } }
    ` }} />
    {sidebarOpen && isMobile && <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 40 }} />}

    {/* The sidebar: a flat panel with a hairline border, tinted a little
        towards the maroon at the top the way the deck draws it. On a phone
        it slides in over the page; on a desktop it stays put. */}
    <div style={{ position: "fixed", zIndex: 50, top: isMobile ? 10 : 14, bottom: isMobile ? 10 : 14, left: isMobile ? 10 : 14,
      width: isMobile ? "min(272px, calc(100vw - 20px))" : SIDE, background: rail, border: `1px solid ${T.border}`,
      borderRadius: 18, boxShadow: isMobile && sidebarOpen ? T.nmOut : "none", display: "flex", flexDirection: "column", flexShrink: 0,
      transform: sidebarOpen ? "translateX(0)" : "translateX(calc(-100% - 60px))",
      // visibility flips after the slide finishes on close (0.28s delay), and
      // at once on open — so the closed sidebar's shadow can never bleed
      // onto the page.
      visibility: sidebarOpen ? "visible" : "hidden",
      transition: sidebarOpen
        ? "transform 0.28s cubic-bezier(.22,.61,.36,1), box-shadow .2s ease-out, visibility 0s"
        : "transform 0.28s cubic-bezier(.22,.61,.36,1), box-shadow .2s ease-out, visibility 0s .28s",
      paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div style={{ padding: "16px 14px 10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 32, height: 32, borderRadius: 10, background: T.card, border: `1px solid ${T.border}`, display: "flex",
          alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
          {me?.client?.logo_url
            ? <img src={me.client.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <BotMark size={24} />}
        </span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: T.text, letterSpacing: "-0.01em",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>TellMore AI</span>
        <button onClick={() => setSidebarOpen(false)} className="ui-btn" aria-label="Collapse menu"
          style={{ width: 28, height: 28, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center",
            background: "transparent", border: "none", color: T.textDim, cursor: "pointer", padding: 0 }}>
          <i className={`ti ti-${isMobile ? "x" : "chevron-left"}`} style={{ fontSize: 16 }} />
        </button>
      </div>

      <nav style={{ flex: 1, padding: "2px 12px", overflowY: "auto", minHeight: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        {nav.map((p) => <NavItem key={p} icon={iconFor(p)} label={navLabel(PAGES.indexOf(p))} badge={badgeFor(p)} on={page === p} onClick={() => go(p)} />)}
      </nav>

      <div style={{ padding: "6px 12px 12px" }}>
        <PlanMeter me={me} t={t} onClick={() => go("billing")} />
        {/* Language, sync and theme first; Log out on its own line so its label
            never wraps. Log out lands on the app's own sign-in screen. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 10 }}>
          <LangToggle compact />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => load(false)} disabled={loading} className={`pbtn${loading ? " is-busy" : ""}`}
              title={t("shell.sync")} aria-label={t("shell.sync")} style={{ width: 36, height: 36, borderRadius: 10 }}>
              <i className="ti ti-refresh" style={{ animation: loading ? "spin 0.8s linear infinite" : "none", fontSize: 17 }} />
            </button>
            <ThemeToggle mode={mode} toggle={toggleTheme} style={{ width: 36, height: 36, borderRadius: 10 }} />
          </div>
        </div>
        <button onClick={onLogout} className="ui-btn nav-item" style={{ display: "flex", alignItems: "center", gap: 9, width: "100%",
          marginTop: 4, padding: "9px 12px", borderRadius: 10, border: "none", cursor: "pointer", background: "transparent",
          fontFamily: "inherit", fontSize: 13.5, fontWeight: 500, color: T.textMuted, textAlign: "left", whiteSpace: "nowrap" }}>
          <i className="ti ti-logout" style={{ fontSize: 17, flexShrink: 0 }} />{t("shell.logout")}
        </button>
      </div>
    </div>

    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0,
      marginLeft: (!isMobile && sidebarOpen) ? SIDE + 28 : 0, transition: "margin-left 0.28s cubic-bezier(.22,.61,.36,1)" }}>
      {/* The page header: the date, a greeting, the bell and the one button
          the deck gives every page. On a phone the tab's name is the title —
          the sidebar that would say it is off screen. */}
      {/* The same side padding as the page below it, so the title and the
          first card share a left edge. */}
      {!fullBleed && <div style={{ padding: isMobile ? "12px 10px 0" : "22px 20px 0", display: "flex", alignItems: "center",
        gap: isMobile ? 8 : 16, flexShrink: 0 }}>
        {!sidebarOpen && <button onClick={() => setSidebarOpen(true)} className="pbtn" aria-label="Menu"
          style={isMobile ? { width: 38, height: 38, borderRadius: 10 } : undefined}>
          <i className="ti ti-menu-2" />
        </button>}
        {/* Stepping back out to Home reopens the menu, so it is where it was
            before the detour. The phone's own back button does the same. */}
        {isMobile && page !== HOME && <button onClick={() => { setPage(HOME); setSidebarOpen(true); }} className="pbtn hide-xs" aria-label="Back"
          style={{ width: 38, height: 38, borderRadius: 10 }}>
          <i className="ti ti-arrow-left" style={{ fontSize: 16 }} />
        </button>}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: isMobile ? 11.5 : 12.5, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {today}{!isMobile && page !== HOME ? ` · ${tabName}` : ""}
          </div>
          <div style={{ fontSize: isMobile ? 17 : 24, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15, marginTop: 2,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {isMobile ? tabName : `${greet}${name ? `, ${name}` : ""}`}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 10, flexShrink: 0 }}>
          <NotificationsBell convos={convos} feed={feed} isMobile={isMobile} onNavigate={goTo} />
          <button onClick={() => setPage("settings")} className="ui-btn shell-primary" title={t("shell.train")} aria-label={t("shell.train")}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, border: "none", cursor: "pointer",
              fontFamily: "inherit", fontSize: 13.5, fontWeight: 600, borderRadius: 10,
              ...(isMobile ? { width: 38, height: 38, padding: 0 } : { height: 42, padding: "0 18px" }) }}>
            <i className="ti ti-wand" style={{ fontSize: 17 }} />{!isMobile && t("shell.train")}
          </button>
        </div>
      </div>}
      {children}
    </div>
  </div>;
}
