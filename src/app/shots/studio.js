"use client";
import { useEffect, useState } from "react";
import { Motion, Theme } from "../dashboard/components/ui.js";
import Comments from "../dashboard/components/Comments.js";
import { SAMPLE } from "./sample.js";

// The screenshot studio.
//
// It renders the REAL dashboard tab components — same code, same crimson, same
// spacing as a paying client sees — but answers their API calls from
// sample.js instead of the database. That gets us documentation screenshots
// that are honest about what the product looks like, contain no real customer
// data, and can be retaken in one pass whenever the design changes.
//
// The page is 404 in production (see page.js); this file never ships to a user.

// One entry per documentable tab. Add a tab here and it becomes shootable.
const TABS = {
  comments: { title: "Comments", render: () => <Comments /> },
};

export const TAB_IDS = Object.keys(TABS);

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

  useEffect(() => {
    // Installed before any tab mounts, so a component's very first request on
    // mount is already served from SAMPLE rather than racing the stub.
    const real = window.fetch;
    window.fetch = (url, ...rest) => {
      const key = Object.keys(SAMPLE).find((k) => String(url).startsWith(k));
      if (key) {
        return Promise.resolve(new Response(JSON.stringify(SAMPLE[key]),
          { headers: { "content-type": "application/json" } }));
      }
      return real(url, ...rest);
    };
    setReady(true);
    return () => { window.fetch = real; };
  }, []);

  const entry = TABS[tab];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Both, and in this order — exactly what dashboard-client.js renders.
          <Theme/> alone leaves class-based styling (the red pill behind the
          selected filter, among others) with nothing to paint. */}
      <Theme /><Motion />
      {/* Generous padding so the screenshot has a margin and does not look
          cropped out of a bigger page. */}
      <div style={{ padding: "34px clamp(16px, 4vw, 40px) 60px", maxWidth: 1100, margin: "0 auto" }}>
        {!entry ? (
          <div style={{ fontFamily: "system-ui", color: "var(--text)" }}>
            <h1 style={{ fontSize: 20, marginBottom: 14 }}>Screenshot studio</h1>
            <p style={{ fontSize: 14, opacity: .75, marginBottom: 10 }}>Pick a tab:</p>
            <ul style={{ fontSize: 14, lineHeight: 2 }}>
              {TAB_IDS.map((id) => (
                <li key={id}><a href={`/shots?tab=${id}`} style={{ color: "var(--gold)" }}>/shots?tab={id}</a></li>
              ))}
            </ul>
          </div>
        ) : ready ? entry.render() : null}
      </div>
    </div>
  );
}
