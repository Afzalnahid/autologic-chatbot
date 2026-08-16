import { D, FONT, mono, NAV, SAMPLE as S } from "./kit.js";
import { TABS } from "./tabs.js";
import { Btn } from "./parts.js";

export const metadata = { title: "Dashboard preview — Autologic", robots: { index: false, follow: false } };

// PREVIEW ONLY — a design proposal, not the working dashboard. Sample data, no
// login, nothing here reads or writes the database. The live dashboard at
// /dashboard is untouched; if this is approved the real tabs adopt it one at a
// time, keeping every feature that already works.

export default function PreviewDash({ searchParams }) {
  const id = TABS[searchParams?.tab] ? searchParams.tab : "overview";
  const tab = TABS[id];

  return (
    <div style={{ background: D.canvas, minHeight: "100vh", color: D.ink, fontFamily: FONT.ui }}>
      <style dangerouslySetInnerHTML={{__html:`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&family=Anek+Bangla:wght@400;500;600&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent }
        html, body { margin: 0; overflow-x: hidden; -webkit-text-size-adjust: 100% }
        p, span, div, td, th { overflow-wrap: anywhere }

        .rail a { display: flex; align-items: center; gap: 11px; padding: 9px 11px; border-radius: 9px;
          color: ${D.railText}; text-decoration: none; font-size: 13.5px; font-weight: 500;
          transition: background .15s ease-out, color .15s ease-out }
        .rail a:hover { background: ${D.railHover}; color: ${D.railTextOn} }
        .rail a.on { background: ${D.railHover}; color: ${D.railTextOn} }
        .rail a.on i:first-child { color: ${D.blue} }

        .btn { transition: filter .15s ease-out, transform .12s ease-out, border-color .15s ease-out }
        .btn:hover { filter: brightness(.985); border-color: ${D.inkFaint}44 }
        .btn:active { transform: scale(.97) }
        .card { transition: box-shadow .18s ease-out, transform .18s ease-out }
        .card:hover { box-shadow: 0 6px 20px rgba(19,23,34,.07); transform: translateY(-1px) }
        .row:hover { background: ${D.canvas} }
        .chip:hover { border-color: ${D.blue}66 }
        .inp:focus { outline: none; border-color: ${D.blue}; box-shadow: 0 0 0 3px ${D.blue}22 }
        a:focus-visible, button:focus-visible { outline: 2px solid ${D.blue}; outline-offset: 2px }

        /* Content arrives a beat after the frame, so the page reads as settled
           rather than assembled. */
        @keyframes up { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
        .in { animation: up .34s cubic-bezier(.16,1,.3,1) both }

        .shell { display: grid; grid-template-columns: 244px 1fr; min-height: 100vh }
        @media (max-width: 1080px) { .two { grid-template-columns: 1fr !important } }
        @media (max-width: 880px) {
          .shell { grid-template-columns: 1fr }
          .rail { position: static !important; height: auto !important; flex-direction: row !important;
            overflow-x: auto; padding: 10px !important; gap: 8px !important }
          .rail .grp, .rail .plan, .rail .brandsub { display: none }
          .rail .items { display: flex; flex-direction: row; gap: 6px }
          .rail a { white-space: nowrap }
        }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important } }
      `}}/>

      <div className="shell">
        <aside className="rail" style={{ background: D.rail, padding: "18px 14px", position: "sticky",
          top: 0, height: "100vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 4px" }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: D.blue,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="ti ti-robot" style={{ fontSize: 17, color: "#0A0D14" }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: "#fff" }}>Autologic</div>
              <div className="brandsub" style={{ ...mono, fontSize: 8.5, color: D.railText, marginTop: 2 }}>
                {S.business}
              </div>
            </div>
          </div>

          {NAV.map((g) => (
            <nav key={g.group}>
              <div className="grp" style={{ ...mono, fontSize: 8.5, color: "#5C6780", padding: "0 11px", marginBottom: 8 }}>
                {g.group}
              </div>
              <div className="items">
                {g.items.map((it) => (
                  <a key={it.id} href={`/preview-dash?tab=${it.id}`} className={it.id === id ? "on" : ""}>
                    <i className={`ti ${it.icon}`} style={{ fontSize: 17 }} />
                    {it.label}
                    {it.badge && (
                      <span style={{ marginLeft: "auto", background: D.blue, color: "#0A0D14", fontSize: 10.5,
                        fontWeight: 700, minWidth: 18, height: 18, borderRadius: 9, display: "inline-flex",
                        alignItems: "center", justifyContent: "center" }}>{it.badge}</span>
                    )}
                  </a>
                ))}
              </div>
            </nav>
          ))}

          <div className="plan" style={{ marginTop: "auto", background: D.railHover, borderRadius: 12, padding: 15 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
              <i className="ti ti-circle-filled" style={{ fontSize: 7, color: D.mint }} />
              <span style={{ ...mono, fontSize: 8.5, color: D.mint }}>Bot is live</span>
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "#fff", marginBottom: 4 }}>{S.plan} plan</div>
            <div style={{ fontSize: 12, color: D.railText, lineHeight: 1.55, marginBottom: 12 }}>
              Renews in {S.planDays} days · 8,412 of 10,000 messages
            </div>
            <div style={{ height: 4, background: "#242C3E", borderRadius: 2, marginBottom: 13 }}>
              <div style={{ width: "84%", height: "100%", background: D.blue, borderRadius: 2 }} />
            </div>
            <a href="/preview-dash?tab=billing" style={{ display: "block", textAlign: "center", background: D.blue,
              color: "#0A0D14", fontSize: 12.5, fontWeight: 700, padding: "9px 0", borderRadius: 8,
              textDecoration: "none" }}>Manage plan</a>
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          <header style={{ background: D.surface, borderBottom: `1px solid ${D.line}`, position: "sticky",
            top: 0, zIndex: 5, padding: "15px clamp(16px, 3vw, 28px)", display: "flex", alignItems: "center",
            gap: 14, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em" }}>{tab.title}</h1>
              <div style={{ fontSize: 12.5, color: D.inkFaint, marginTop: 3 }}>{tab.sub}</div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 9 }}>
              <Btn kind="ghost" icon="ti-calendar">Last 7 days</Btn>
              <Btn kind="primary" icon="ti-plus">New broadcast</Btn>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: D.blueSoft, color: D.blue,
                display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>N</div>
            </div>
          </header>

          <div className="in" style={{ padding: "clamp(16px, 3vw, 26px)" }}>
            {tab.render()}
          </div>

          <footer style={{ padding: "0 clamp(16px, 3vw, 26px) 26px", ...mono, color: D.inkFaint }}>
            ⌗ Preview only · sample data · the live dashboard is unchanged
          </footer>
        </main>
      </div>
    </div>
  );
}
