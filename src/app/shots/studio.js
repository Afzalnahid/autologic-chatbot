"use client";
import { useEffect, useState } from "react";
import { Motion, Theme, useIsMobile } from "../dashboard/components/ui.js";
import { useT } from "../dashboard/components/i18n.js";
import Shell from "../dashboard/components/Shell.js";
import Analytics from "../dashboard/components/Analytics.js";
import Overview from "../dashboard/components/Overview.js";
import Conversations from "../dashboard/components/Conversations.js";
import Comments from "../dashboard/components/Comments.js";
import Broadcast from "../dashboard/components/Broadcast.js";
import Inventory from "../dashboard/components/Inventory.js";
import InventoryAssistant from "../dashboard/components/InventoryAssistant.js";
import KnowledgeBase from "../dashboard/components/KnowledgeBase.js";
import Orders from "../dashboard/components/Orders.js";
import Bookings from "../dashboard/components/Bookings.js";
import Channels from "../dashboard/components/Channels.js";
import WebsiteWidget from "../dashboard/components/WebsiteWidget.js";
import Settings from "../dashboard/components/Settings.js";
import AIEngine from "../dashboard/components/AIEngine.js";
import Billing from "../dashboard/components/Billing.js";
import Profile from "../dashboard/components/Profile.js";
import Packages from "../admin/Packages.js";
import { AdminApp } from "../admin/admin-client.js";
import LearnMore from "../dashboard/components/LearnMore.js";
// The dashboard's own tab keys, so the docs-links scene below lists exactly
// what the sidebar lists rather than a copy that can fall behind it.
import { PAGES as DASH_PAGES, GROUPS as DASH_GROUPS, ICONS as DASH_ICONS, LaunchScreen } from "../dashboard-client.js";
import { SAMPLE, PROPS, ADMIN } from "./sample.js";

// The console takes its data as a prop and its actions as callbacks, so it
// mounts here without a super-admin login. The callbacks do nothing on
// purpose: this is for looking at and for checking that moving around the
// console works, not for changing anything.
// The client drawer is where the plan dropdown lives, and it only renders when
// `detail` is set — openDetail does nothing here, so a scene that wants the
// drawer has to be handed one already open.
const DETAIL = {
  // plan matches the subscription below on purpose: the dropdown and the card
  // describe the same account, and a fixture where they disagree teaches the
  // next reader that they can.
  client: { ...ADMIN.clients[0], plan: "shop_growth", trial_start: null, trial_end: null, phone: "01711000111", address: "Dhanmondi, Dhaka", website: "nokshithreads.com" },
  channels: [], products: [], orders: [], bookings: [], files: [], ai_key: null,
  payments: [
    { id: "p1", plan: "shop_growth", billing_cycle: "monthly", amount: 3500, method: "bKash", txn_id: "7A1B2C3D", status: "approved", created_at: new Date(Date.now() - 12 * 86400000).toISOString() },
    { id: "p2", plan: "shop_growth", billing_cycle: "monthly", amount: 3500, method: "bKash", txn_id: "5K9L2M7N", status: "approved", created_at: new Date(Date.now() - 43 * 86400000).toISOString() },
    { id: "p3", plan: "shop_starter", billing_cycle: "monthly", amount: 1500, method: "Nagad", txn_id: "2Q4R6S8T", status: "approved", created_at: new Date(Date.now() - 74 * 86400000).toISOString() },
  ],
  // What /api/admin/client-detail works out. Deliberately a client CLOSE to two
  // of their limits: a subscription card that only ever shows healthy bars
  // proves nothing about the one thing it is for.
  subscription: {
    plan: "shop_growth", plan_name: "Shop Growth", monthly: 3500, yearly: 35000,
    is_trial: false, suspended: false,
    started_at: new Date(Date.now() - 74 * 86400000).toISOString(),
    expires_at: new Date(Date.now() + 18 * 86400000).toISOString(),
    days_left: 18,
    usage: {
      period: "month",
      messages: { used: 13820, limit: 15000 },
      channels: { used: 3, limit: 3 },
      products: { used: 1240, limit: 3000 },
      documents: { used: 0, limit: 0 },
    },
    payments: {
      count: 3, total: 8500, pending: 0,
      last: { amount: 3500, method: "bKash", txn_id: "7A1B2C3D", cycle: "monthly", at: new Date(Date.now() - 12 * 86400000).toISOString() },
    },
  },
};

const noopAdmin = {
  data: ADMIN, refreshing: false, busy: null, err: null, detail: null, detailLoading: false, superKey: "",
  onRefresh: () => {}, clearErr: () => {}, act: () => {}, reviewPayment: () => {}, del: () => {},
  setRole: () => {}, removeAdmin: () => {}, setSuperKey: () => {}, allowAiKey: () => {}, revokeAiKey: () => {},
  openDetail: () => {}, closeDetail: () => {}, logout: () => {}, token: "studio",
};

// The screenshot studio.
//
// It renders the REAL dashboard tab components — same code, same crimson, same
// spacing as a paying client sees — but answers their API calls from
// sample.js instead of the database. That gets us documentation screenshots
// that are honest about what the product looks like, contain no real customer
// data, and can be retaken in one pass whenever the design changes.
//
// The page is 404 outside `next dev` (see page.js); this never ships to a user.

const noop = () => {};

// One entry per documentable tab. The key is the docs page slug wherever the
// two line up, so a screenshot's file name matches the page that shows it.
const TABS = {
  overview:         () => <Overview me={{ client: { business_name: "Nokshi Threads" } }} convos={PROPS.convos} orders={PROPS.orders} channels={PROPS.channels} businessType="ecommerce" onGo={noop} />,
  "overview-agency": () => <Overview me={{ client: { business_name: "Pixel Studio" } }} convos={PROPS.convos} orders={[]} channels={PROPS.channels} businessType="agency" onGo={noop} />,
  analytics:        () => <Analytics isAgency={false} />,
  conversations:    () => <Conversations convos={PROPS.convos} channels={PROPS.channels} products={PROPS.products} refresh={noop} />,
  // A lapsed plan: the lock screen, with customers waiting.
  "conversations-locked": () => <Conversations convos={[]} channels={PROPS.channels} refresh={noop} locked lockInfo={{ locked: true, waiting: 7, since: new Date(Date.now() - 3 * 86400000).toISOString() }} onRenew={noop} />,
  comments:         () => <Comments />,
  broadcast:        () => <Broadcast />,
  inventory:        () => <Inventory products={PROPS.products} refresh={noop} />,
  assistant:        () => <InventoryAssistant fullPage products={PROPS.products} settings={PROPS.settings} refresh={noop} onGo={noop} onImport={noop} />,
  knowledge:        () => <KnowledgeBase />,
  orders:           () => <Orders orders={PROPS.orders} refresh={noop} onGo={noop} />,
  bookings:         () => <Bookings calConnected clientId="demo" />,
  channels:         () => <Channels onConnect={noop} onDismissConnected={noop} />,
  "website-widget": () => <WebsiteWidget />,
  "bot-training":   () => <Settings settings={PROPS.settings} setSettings={noop} />,
  "ai-engine":      () => <AIEngine />,
  billing:          () => <Billing />,
  profile:          () => <Profile />,
  // The admin console, not a client tab — it answers from the same stubbed
  // fetch, so the cost breakdown can be checked without a super-admin login.
  "admin-packages": () => <Packages token="studio" isSuper />,
  // The whole console, so its navigation can be checked: which section a
  // refresh comes back to, and what the back button does.
  admin: () => <AdminApp {...noopAdmin} />,
  // The same console with a client open, because the plan dropdown lives in
  // that drawer and had been offering four ids written into the file.
  "admin-client": () => <AdminApp {...noopAdmin} detail={DETAIL} />,
  // Every tab's link to its own page in the manual, in one place. The AI
  // Assistant tab shipped with a documentation page and no link to it, and
  // nothing about the dashboard showed that: a missing link looks exactly like
  // a tab that has nothing to read. Here a gap is a blank row.
  "docs-links": () => <div style={{ display: "grid", gap: 2, maxWidth: 420 }}>
    {DASH_PAGES.map((p) => <div key={p} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "6px 10px", borderRadius: 10, background: "var(--card, #ffffff10)" }}>
      <code style={{ fontSize: 12 }}>{p}</code>
      <LearnMore page={p} plain />
    </div>)}
  </div>,
};

// The frame itself — sidebar and top bar — around one of the tabs above, with
// the same sample data. "shell" wraps the home tab; "shell-<tab>" wraps that
// tab. The real frame is the one dashboard-client.js renders (Shell.js); only
// the state it is handed is made up here.
function ShellScene({ inner }) {
  const isMobile = useIsMobile();
  const t = useT();
  const [page, setPage] = useState(inner);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  useEffect(() => { setSidebarOpen(!isMobile); }, [isMobile]);
  const me = { client: { id: "demo", business_name: "Nokshi Threads", business_type: "ecommerce", plan: "shop_growth" }, usage: { today: 62, limit: null }, active: true };
  const navLabel = (i) => t("nav." + (DASH_PAGES[i] || ""));
  // A phone with a chat open fills the screen with it (no header, no bottom
  // bar) — the same rule dashboard-client.js applies.
  const [chatOpen, setChatOpen] = useState(false);
  const fullBleed = isMobile && page === "conversations" && chatOpen;
  const render = page === "conversations"
    ? () => <Conversations convos={PROPS.convos} channels={PROPS.channels} products={PROPS.products} refresh={noop} onChatOpen={setChatOpen} />
    : (TABS[page] || TABS.overview);
  return <Shell isMobile={isMobile} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} fullBleed={fullBleed}
    me={me} groups={DASH_GROUPS} PAGES={DASH_PAGES} ICONS={DASH_ICONS} channels={PROPS.channels}
    page={page} setPage={setPage} HOME="overview" navLabel={navLabel} t={t} isAgency={false} activeCount={3} pendingOrders={1}
    onLogout={noop} load={noop} loading={false} mode="light" toggleTheme={noop} convos={PROPS.convos} feed={[]}
    goTo={(p) => { if (TABS[p]) setPage(p); }} orders={PROPS.orders} products={PROPS.products}
    onFind={(kind) => setPage(kind === "customer" ? "conversations" : kind === "order" ? "orders" : "inventory")}>
    <div className="ui-scroll" style={{ flex: 1, overflow: "auto", padding: fullBleed ? 0 : (isMobile ? "12px 10px" : 20), minHeight: 0, minWidth: 0 }}>
      <div key={page} className="ui-page" style={fullBleed ? { height: "100%", display: "flex", flexDirection: "column", minHeight: 0 } : undefined}>{render()}</div>
    </div>
  </Shell>;
}
const SHELL_IDS = ["shell", "shell-conversations", "shell-orders", "shell-inventory"];

export const TAB_IDS = [...Object.keys(TABS), ...SHELL_IDS];

// Longest match wins, so "/api/channels/website" is not swallowed by
// "/api/channels" whichever order the object happens to be written in.
const KEYS = Object.keys(SAMPLE).sort((a, b) => b.length - a.length);

export default function Studio({ tab, theme }) {
  const [ready, setReady] = useState(false);

  // ?theme=light|dark, so a shot is never at the mercy of whatever the machine
  // taking it prefers. It has to be written to localStorage as well as to the
  // element: the theme boot script in the root layout re-asserts the stored
  // choice on a few timers, and would otherwise undo this a second later.
  useEffect(() => {
    if (theme !== "light" && theme !== "dark") return;
    // Stored the way the toggle stores it (src/lib/theme-pref.js): a choice is
    // kept beside the machine's own mode, and is only a choice when it differs.
    try {
      const system = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      if (theme === system) { localStorage.removeItem("al-theme"); localStorage.removeItem("al-theme-sys"); }
      else { localStorage.setItem("al-theme", theme); localStorage.setItem("al-theme-sys", system); }
    } catch {}
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // The website widget builds its snippet from window.location.origin, which on
  // this machine is localhost. A screenshot of the manual must show what a
  // client actually gets, so the rendered text is put back to the live origin
  // after paint. This is a documentation prop and lives only in this dev-only
  // file — the component itself is untouched and still reads the real origin.
  useEffect(() => {
    if (!ready) return;
    const fix = () => {
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (n.nodeValue.includes("localhost:3000")) {
          n.nodeValue = n.nodeValue.replace(/https?:\/\/localhost:3000/g, "https://www.tellmoreai.com");
        }
      }
    };
    const t = [80, 400, 1200].map((ms) => setTimeout(fix, ms));
    return () => t.forEach(clearTimeout);
  }, [ready, tab]);

  useEffect(() => {
    // Installed before any tab mounts, so a component's very first request on
    // mount is already served from SAMPLE rather than racing the stub.
    const real = window.fetch;
    window.fetch = (url, ...rest) => {
      const path = String(typeof url === "string" ? url : url?.url || "");
      const key = KEYS.find((k) => path.startsWith(k));
      if (key) {
        return Promise.resolve(new Response(JSON.stringify(SAMPLE[key]),
          { headers: { "content-type": "application/json" } }));
      }
      // Anything the sample does not cover answers empty rather than reaching
      // the network — a screenshot must never depend on a live service.
      if (path.startsWith("/api/")) {
        return Promise.resolve(new Response("{}", { headers: { "content-type": "application/json" } }));
      }
      return real(url, ...rest);
    };
    setReady(true);
    return () => { window.fetch = real; };
  }, []);

  const render = TABS[tab];

  // What the app shows between the native splash and the first real screen.
  if (tab === "launch") return <LaunchScreen />;
  // The frame draws its own page: full height, no studio margin.
  if (SHELL_IDS.includes(tab)) {
    return <><Theme /><Motion />{ready && <ShellScene inner={tab === "shell" ? "overview" : tab.slice("shell-".length)} />}</>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Both, and in this order — exactly what dashboard-client.js renders.
          <Theme/> alone leaves class-based styling (the red pill behind the
          selected filter, among others) with nothing to paint. */}
      <Theme /><Motion />
      {/* Generous padding so the screenshot has a margin and does not look
          cropped out of a bigger page. */}
      <div style={{ padding: "34px clamp(16px, 4vw, 40px) 60px", maxWidth: 1100, margin: "0 auto" }}>
        {!render ? (
          <div style={{ fontFamily: "system-ui", color: "var(--text)" }}>
            <h1 style={{ fontSize: 20, marginBottom: 14 }}>Screenshot studio</h1>
            <p style={{ fontSize: 14, opacity: .75, marginBottom: 10 }}>Pick a tab:</p>
            <ul style={{ fontSize: 14, lineHeight: 2 }}>
              {TAB_IDS.map((id) => (
                <li key={id}><a href={`/shots?tab=${id}`} style={{ color: "var(--gold)" }}>/shots?tab={id}</a></li>
              ))}
            </ul>
          </div>
        ) : ready ? render() : null}
      </div>
    </div>
  );
}
