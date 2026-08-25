"use client";
import { useEffect, useState } from "react";
import { Motion, Theme } from "../dashboard/components/ui.js";
import Analytics from "../dashboard/components/Analytics.js";
import Conversations from "../dashboard/components/Conversations.js";
import Comments from "../dashboard/components/Comments.js";
import Broadcast from "../dashboard/components/Broadcast.js";
import Inventory from "../dashboard/components/Inventory.js";
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
import { SAMPLE, PROPS } from "./sample.js";

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
  analytics:        () => <Analytics isAgency={false} />,
  conversations:    () => <Conversations convos={PROPS.convos} channels={PROPS.channels} refresh={noop} />,
  comments:         () => <Comments />,
  broadcast:        () => <Broadcast />,
  inventory:        () => <Inventory products={PROPS.products} refresh={noop} />,
  knowledge:        () => <KnowledgeBase />,
  orders:           () => <Orders orders={PROPS.orders} refresh={noop} />,
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
};

export const TAB_IDS = Object.keys(TABS);

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
    try { localStorage.setItem("al-theme", theme); } catch {}
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
          n.nodeValue = n.nodeValue.replace(/https?:\/\/localhost:3000/g, "https://getvoicium.com");
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
