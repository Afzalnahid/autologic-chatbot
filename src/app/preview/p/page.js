import { CH, COPY, CONVOS, BOARD_CSS, REVEAL_JS } from "../shared.js";
export const metadata = { title: "P · Paper — Autologic preview", robots: { index: false, follow: false } };

// A different language entirely, taken from the reference: drafting paper instead
// of a dark panel, one heavy serif carrying the page, technical microtype in the
// margins, and a single warm accent against the blue. Content is unchanged.
const P = {
  paper: "#E9E0CC", paper2: "#F2EBDB", ink: "#14171F", inkSoft: "#4A4E5A",
  blue: "#2447C9", blueLite: "#5B8CFF", accent: "#E85A2A", line: "#14171F1F",
};

const mono = { fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 10.5,
  letterSpacing: "0.13em", textTransform: "uppercase" };
const wrap = { maxWidth: 1240, margin: "0 auto", padding: "0 26px" };

function Label({ children }) {
  return <div style={{ ...mono, color: P.inkSoft, marginBottom: 18 }}>⌗ {children}</div>;
}

function Slide({ conv, c, k }) {
  const ch = CH[conv.ch];
  return (
    <div className={`al-slide s${k}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "34px 16px 11px",
        borderBottom: `1px solid ${P.line}`, background: P.paper2 }}>
        <i className={`ti ${ch.icon}`} style={{ fontSize: 16, color: P.blue }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>{ch.name}</span>
        <span style={{ marginLeft: "auto", ...mono, fontSize: 9, color: P.inkSoft }}>{c[conv.kind]}</span>
      </div>
      <div className="al-stack">
        <div className="al-msg b0" style={{ display: "flex", justifyContent: "flex-end" }}>
          {conv.photo ? (
            <div style={{ background: P.blue, borderRadius: 12, borderBottomRightRadius: 4, padding: 5, width: 116 }}>
              <img src={conv.photo} alt="" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 8, display: "block" }} />
              <div style={{ fontSize: 10.5, color: "#fff", padding: "5px 3px 1px", opacity: .9 }}>এই ড্রেসটা আপনাদের আছে?</div>
            </div>
          ) : <Bub me>{conv.lines[0][1]}</Bub>}
        </div>
        <div className="al-msgwrap">
          <div className="al-typing t0"><b /><b /><b /></div>
          <div className="al-msg b1" style={{ display: "flex" }}><Bub>{conv.lines[1][1]}</Bub></div>
        </div>
        <div className="al-msg b2" style={{ display: "flex", justifyContent: "flex-end" }}><Bub me>{conv.lines[2][1]}</Bub></div>
        <div className="al-msgwrap">
          <div className="al-typing t1"><b /><b /><b /></div>
          <div className="al-msg b3" style={{ display: "flex" }}><Bub>{conv.lines[3][1]}</Bub></div>
        </div>
      </div>
      <div style={{ padding: "9px 16px", borderTop: `1px solid ${P.line}`, ...mono, fontSize: 9,
        color: P.inkSoft, display: "flex", alignItems: "center", gap: 7, background: P.paper2 }}>
        <i className="ti ti-check" style={{ fontSize: 12, color: P.accent }} />{c.notes[conv.note]}
      </div>
    </div>
  );
}

function Bub({ me, children }) {
  return (
    <div style={{ maxWidth: "84%", fontSize: 12.5, lineHeight: 1.6, padding: "8px 11px", borderRadius: 12,
      background: me ? P.blue : "#FFFFFF", color: me ? "#fff" : P.ink,
      borderBottomRightRadius: me ? 4 : 12, borderBottomLeftRadius: me ? 12 : 4,
      border: me ? "none" : `1px solid ${P.line}` }}>{children}</div>
  );
}


// The illustration was decoration. This is the same space doing work: a message
// arrives on one channel, the bot reads the right source, and something concrete
// comes out the other side. Four stages on one 13-second clock.
const STAGES = [
  { ch: "messenger", inn: "এই শাড়িটার দাম কত?",        src: "Your product catalogue", out: "Order #AL2481 saved",  icon: "ti-shopping-bag",
    inEn: "How much is this saree?",                     outEn: "Order #AL2481 saved" },
  { ch: "instagram", inn: "📷 এই ড্রেসটা আছে?",          src: "Photo matched to stock",  out: "Product found, size M", icon: "ti-photo",
    inEn: "📷 Do you have this dress?",                   outEn: "Product found, size M" },
  { ch: "whatsapp",  inn: "বৃহস্পতিবার মিটিং হবে?",      src: "Your Google Calendar",    out: "Meeting booked, 4 PM", icon: "ti-calendar-check",
    inEn: "Can we meet on Thursday?",                     outEn: "Meeting booked, 4 PM" },
  { ch: "website",   inn: "How do I add this to my site?", src: "Your uploaded documents", out: "Answered in English",  icon: "ti-file-text",
    inEn: "How do I add this to my site?",                outEn: "Answered in English" },
];

function flowCss() {
  const N = STAGES.length, PER = 3.25, CY = (N * PER).toFixed(2);
  let out = `.flow-wrap { position: relative }
    @keyframes fpulse { 0%,100% { transform: scale(1); opacity:.28 } 50% { transform: scale(1.5); opacity:0 } }
    .core-ring { position:absolute; inset:0; border-radius:50%; border:1px solid ${P.blue}; animation: fpulse 2.6s ease-out infinite }
    .core-ring:nth-child(2) { animation-delay: 1.3s }
    @keyframes dash { to { stroke-dashoffset: -22 } }
    .wire { stroke: ${P.blue}; stroke-width: 1.5; stroke-dasharray: 4 7; opacity:.45; animation: dash 1.1s linear infinite }`;
  for (let k = 0; k < N; k++) {
    const at = (sec) => (((k * PER + sec) / (N * PER)) * 100).toFixed(2) + "%";
    out += `
      .fch${k}, .fsrc${k}, .fout${k}, .fcap${k} { opacity: .3 }
      .fch${k} { animation: fa${k} ${CY}s linear infinite }
      .fsrc${k} { animation: fb${k} ${CY}s linear infinite }
      .fout${k} { animation: fc${k} ${CY}s linear infinite }
      .fcap${k} { animation: fd${k} ${CY}s linear infinite }
      .fdot${k} { animation: fe${k} ${CY}s cubic-bezier(.4,0,.2,1) infinite; opacity: 0 }
      @keyframes fa${k} { 0%,${at(0)} { opacity:.3; transform:none } ${at(.25)},${at(PER - .3)} { opacity:1; transform: translateX(4px) } ${at(PER)},100% { opacity:.3; transform:none } }
      @keyframes fb${k} { 0%,${at(.9)} { opacity:.3 } ${at(1.15)},${at(PER - .3)} { opacity:1 } ${at(PER)},100% { opacity:.3 } }
      @keyframes fc${k} { 0%,${at(1.8)} { opacity:.3; transform:none } ${at(2.05)},${at(PER - .3)} { opacity:1; transform: translateX(-4px) } ${at(PER)},100% { opacity:.3; transform:none } }
      @keyframes fd${k} { 0%,${at(0)} { opacity:0 } ${at(.3)},${at(PER - .25)} { opacity:1 } ${at(PER)},100% { opacity:0 } }
      @keyframes fe${k} { 0%,${at(.35)} { opacity:0; offset-distance: 0% } ${at(.5)} { opacity:1 } ${at(1.7)} { opacity:1; offset-distance: 100% } ${at(1.85)},100% { opacity:0; offset-distance: 100% } }`;
  }
  return out;
}

function Flow({ lang, c }) {
  const bn = lang === "bn";
  return (
    <div className="flow-wrap" style={{ border: `1px solid ${P.line}`, background: P.paper2, padding: "26px 20px" }}>
      <div style={{ ...mono, fontSize: 9.5, color: P.inkSoft, marginBottom: 20 }}>
        ⌗ {bn ? "যেভাবে কাজ করে" : "How it works"}
      </div>

      <div className="flow-grid">
        <div>
          <div style={{ ...mono, fontSize: 8.5, color: P.inkSoft, marginBottom: 10 }}>{bn ? "গ্রাহক লেখেন" : "Customer writes"}</div>
          {STAGES.map((s, k) => (
            <div key={k} className={`fch${k}`} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px",
              background: "#fff", border: `1px solid ${P.line}`, marginBottom: 7 }}>
              <i className={`ti ${CH[s.ch].icon}`} style={{ fontSize: 15, color: P.blue, flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, lineHeight: 1.35, color: P.ink }}>{bn ? s.inn : s.inEn}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
          <svg viewBox="0 0 120 40" className="wire-box" style={{ width: "100%", height: 40 }}>
            <path id="w1" className="wire" d="M2 20 H118" fill="none" />
          </svg>
          <div style={{ position: "relative", width: 66, height: 66 }}>
            <div className="core-ring" /><div className="core-ring" />
            <div style={{ position: "absolute", inset: 8, borderRadius: "50%", background: P.blue,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="ti ti-robot" style={{ fontSize: 24, color: "#fff" }} />
            </div>
          </div>
          <div style={{ ...mono, fontSize: 8.5, color: P.inkSoft, textAlign: "center" }}>
            {bn ? "যা পড়ে" : "Reads"}
          </div>
          {STAGES.map((s, k) => (
            <div key={k} className={`fsrc${k}`} style={{ ...mono, fontSize: 9, color: P.blue, marginTop: -8 }}>{s.src}</div>
          ))}
        </div>

        <div>
          <div style={{ ...mono, fontSize: 8.5, color: P.inkSoft, marginBottom: 10, textAlign: "right" }}>{bn ? "যা ঘটে" : "What happens"}</div>
          {STAGES.map((s, k) => (
            <div key={k} className={`fout${k}`} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px",
              background: "#fff", border: `1px solid ${P.line}`, borderLeft: `2px solid ${P.accent}`, marginBottom: 7 }}>
              <i className={`ti ${s.icon}`} style={{ fontSize: 15, color: P.accent, flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, lineHeight: 1.35, color: P.ink }}>{bn ? s.out : s.outEn}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Paper({ searchParams }) {
  const lang = searchParams?.lang === "bn" ? "bn" : "en";
  const c = COPY[lang];
  const other = lang === "bn" ? "" : "?lang=bn";

  return (
    <div style={{ background: P.paper, minHeight: "100vh", color: P.ink,
      fontFamily: lang === "bn" ? "'Anek Bangla', sans-serif" : "Inter, system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600&family=Anek+Bangla:wght@400;600;700&display=swap');
        .fr { font-family: 'Fraunces', Georgia, serif; font-weight: 700; letter-spacing: -0.02em }
        .bn .fr { font-family: 'Anek Bangla', sans-serif; font-weight: 700 }

        /* The sheet: hairline rules and crop marks, so the page reads as a drawing. */
        .sheet { position: fixed; inset: 14px; pointer-events: none; border: 1px solid ${P.line}; z-index: 3 }
        .sheet i { position: absolute; width: 9px; height: 9px; border: 1px solid #14171F55 }
        .sheet i:nth-child(1) { top: -5px; left: -5px } .sheet i:nth-child(2) { top: -5px; right: -5px }
        .sheet i:nth-child(3) { bottom: -5px; left: -5px } .sheet i:nth-child(4) { bottom: -5px; right: -5px }

        @keyframes rise { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: none } }
        .r { animation: rise .55s cubic-bezier(.22,.61,.36,1) both }
        .al-obs { opacity: 0; transform: translateY(22px) }
        .al-obs.al-in { opacity: 1; transform: none; transition: opacity .5s ease-out, transform .65s cubic-bezier(.22,.61,.36,1) }

        .btn { transition: transform .15s ease-out, background .15s ease-out }
        .btn:hover { transform: translateY(-2px) } .btn:active { transform: scale(.97) }
        .card { background: ${P.paper2}; border: 1px solid ${P.line}; transition: transform .2s ease-out, background .2s ease-out }
        .card:hover { transform: translateY(-3px); background: #FFF }
        a:focus-visible { outline: 2px solid ${P.accent}; outline-offset: 3px }
        @media (max-width: 900px) { .two { grid-template-columns: 1fr !important } .hide-sm { display: none } }
        @media (prefers-reduced-motion: reduce) { .r, .card, .btn { animation: none !important; transition: none !important } .al-obs { opacity: 1 !important; transform: none !important } }

        .al-phone { width: 100%; max-width: 300px; margin: 0 auto; border-radius: 38px; padding: 9px }
        .al-screen { border-radius: 30px; overflow: hidden; position: relative; height: 460px; display: block }
        .al-notch { position: absolute; top: 8px; left: 50%; transform: translateX(-50%); width: 80px; height: 18px;
          border-radius: 11px; background: #14171F; z-index: 5 }
        .al-status { display: flex; justify-content: space-between; align-items: center; padding: 11px 16px 4px;
          font-size: 10.5px; position: relative; z-index: 4 }
        .al-slide { position: absolute; inset: 0; opacity: 0; display: flex; flex-direction: column }
        .al-stack { margin-top: auto; display: flex; flex-direction: column; gap: 7px; padding: 10px 12px 12px }
        .al-msg { opacity: 0 } .al-msgwrap { position: relative }
        .al-typing { display: inline-flex; gap: 4px; padding: 8px 12px; border-radius: 12px; background: #fff;
          border: 1px solid ${P.line}; opacity: 0; position: absolute; top: 0; left: 0 }
        .al-typing b { width: 5px; height: 5px; border-radius: 50%; background: ${P.inkSoft};
          animation: bnc 1.3s ease-in-out infinite }
        .al-typing b:nth-child(2) { animation-delay: .18s } .al-typing b:nth-child(3) { animation-delay: .36s }
        @keyframes bnc { 0%,60%,100% { opacity:.35; transform: translateY(0) } 30% { opacity:1; transform: translateY(-3px) } }
        .al-bars { display: flex; gap: 5px; margin-bottom: 12px }
        .al-bars span { flex: 1; height: 2px; background: ${P.line}; position: relative; overflow: hidden }
        .al-bars span::after { content: ""; position: absolute; inset: 0; background: ${P.accent}; transform: scaleX(0); transform-origin: left }
        .al-switch { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; display: flex; gap: 8px; justify-content: center;
          padding: 10px 12px calc(10px + env(safe-area-inset-bottom)) }
        .al-switch a { padding: 9px 14px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: .1em;
          text-transform: uppercase; text-decoration: none; border: 1px solid; border-radius: 2px }
        .al-pad { height: 70px }
        .al-mono { font-variant-numeric: tabular-nums }

        .flow-grid { display: grid; grid-template-columns: 1fr 132px 1fr; gap: 14px; align-items: start }
        @media (max-width: 560px) { .flow-grid { grid-template-columns: 1fr; gap: 18px }
          .flow-grid > div:nth-child(3) > div:first-child { text-align: left } }
        @media (prefers-reduced-motion: reduce) {
          [class^="fch"], [class^="fsrc"], [class^="fout"], .core-ring, .wire { animation: none !important; opacity: 1 !important }
        }
      ` + BOARD_CSS + flowCss()}</style>
      <script dangerouslySetInnerHTML={{ __html: REVEAL_JS }} />
      <div className="sheet"><i /><i /><i /><i /></div>

      <nav style={{ borderBottom: `1px solid ${P.line}`, position: "sticky", top: 0, zIndex: 4, background: P.paper }}>
        <div style={{ ...wrap, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 26px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 26, height: 26, background: P.blue, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="ti ti-robot" style={{ fontSize: 15, color: "#fff" }} />
            </div>
            <span className="fr" style={{ fontSize: 19 }}>Autologic</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <a href="/pricing" className="hide-sm" style={{ ...mono, color: P.inkSoft, textDecoration: "none" }}>Pricing</a>
            <a href={`/preview/p${other}`} style={{ ...mono, color: P.inkSoft, textDecoration: "none" }}>{lang === "bn" ? "EN" : "বাংলা"}</a>
            <a href="/dashboard?auth=signin" style={{ ...mono, color: P.ink, textDecoration: "none" }}>{lang === "bn" ? "লগ ইন" : "Log in"}</a>
            <a href="/dashboard?auth=signup" className="btn" style={{ ...mono, background: P.accent, color: "#fff",
              padding: "9px 15px", textDecoration: "none" }}>{lang === "bn" ? "ফ্রি ট্রায়াল" : "Try for free"}</a>
          </div>
        </div>
      </nav>

      <section style={{ ...wrap, padding: "clamp(48px,8vw,86px) 26px clamp(30px,5vw,50px)" }}>
        <div className="two" style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: "clamp(28px,5vw,60px)", alignItems: "center" }}>
          <div>
            <div className="r"><Label>{lang === "bn" ? "চার চ্যানেল, এক সহকারী" : "Four channels, one assistant"}</Label></div>
            <h1 className="r fr" style={{ animationDelay: ".07s", fontSize: "clamp(40px,7.2vw,74px)", lineHeight: 0.98, margin: "0 0 22px" }}
              dangerouslySetInnerHTML={{ __html: c.h1.replace(/<em>|<\/em>/g, "") }} />
            <p className="r" style={{ animationDelay: ".14s", fontSize: 16.5, lineHeight: 1.6, color: P.inkSoft, maxWidth: 460, margin: "0 0 28px" }}>{c.lead}</p>
            <div className="r" style={{ animationDelay: ".2s", display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href="/dashboard?auth=signup" className="btn" style={{ ...mono, fontSize: 11.5, background: P.accent,
                color: "#fff", padding: "14px 26px", textDecoration: "none" }}>{c.cta}</a>
              <a href="/pricing" className="btn" style={{ ...mono, fontSize: 11.5, border: `1px solid ${P.ink}`,
                color: P.ink, padding: "14px 26px", textDecoration: "none" }}>{c.cta2}</a>
            </div>
            <div className="r" style={{ animationDelay: ".26s", marginTop: 26, display: "flex", gap: 14, flexWrap: "wrap" }}>
              {Object.values(CH).map((x) => (
                <span key={x.name} style={{ ...mono, fontSize: 9.5, color: P.inkSoft, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <i className={`ti ${x.icon}`} style={{ fontSize: 14, color: P.blue }} />{x.short}
                </span>
              ))}
            </div>
          </div>
          <div className="r" style={{ animationDelay: ".1s" }}>
            <Flow lang={lang} c={c} />
          </div>
        </div>
      </section>

      <section style={{ borderTop: `1px solid ${P.line}`, borderBottom: `1px solid ${P.line}`, background: P.paper2 }}>
        <div style={{ ...wrap, padding: "clamp(44px,7vw,80px) 26px" }}>
          <div className="two" style={{ display: "grid", gridTemplateColumns: "0.85fr 1.15fr", gap: "clamp(28px,5vw,56px)", alignItems: "center" }}>
            <div data-reveal="0">
              <Label>{c.convLabel}</Label>
              <h2 className="fr" style={{ fontSize: "clamp(30px,5vw,50px)", lineHeight: 1.02, margin: "0 0 16px" }}>{c.convTitle}</h2>
              <p style={{ fontSize: 15.5, lineHeight: 1.65, color: P.inkSoft, margin: 0, maxWidth: 420 }}>{c.convLead}</p>
            </div>
            <div style={{ maxWidth: 330, margin: "0 auto", width: "100%" }}>
              <div className="al-bars"><span /><span /><span /><span /></div>
              <div className="al-phone" style={{ background: P.ink }}>
                <div className="al-screen" style={{ background: P.paper2 }}>
                  <div className="al-notch" />
                  <div className="al-status" style={{ color: P.inkSoft }}>
                    <span className="al-mono">9:41</span>
                    <span style={{ display: "inline-flex", gap: 5 }}>
                      <i className="ti ti-wifi" style={{ fontSize: 12 }} /><i className="ti ti-battery-3" style={{ fontSize: 12 }} />
                    </span>
                  </div>
                  {CONVOS.map((cv, k) => <Slide key={cv.ch} conv={cv} c={c} k={k} />)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ ...wrap, padding: "clamp(44px,7vw,80px) 26px" }}>
        <div data-reveal="0" style={{ marginBottom: 34, maxWidth: 620 }}>
          <Label>{c.featLabel}</Label>
          <h2 className="fr" style={{ fontSize: "clamp(30px,5vw,50px)", lineHeight: 1.02, margin: 0 }}>{c.featTitle}</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))", gap: 0, borderTop: `1px solid ${P.line}`, borderLeft: `1px solid ${P.line}` }}>
          {c.features.map((f, i) => (
            <div key={f.title} className="card" data-reveal={(i % 3) * 70}
              style={{ borderTop: "none", borderLeft: "none", padding: 28, background: "transparent" }}>
              <div style={{ ...mono, fontSize: 9.5, color: P.accent, marginBottom: 16 }}>{String(i + 1).padStart(2, "0")}</div>
              <i className={`ti ${f.icon}`} style={{ fontSize: 22, color: P.blue }} />
              <div className="fr" style={{ fontSize: 21, margin: "12px 0 8px", lineHeight: 1.15 }}>{f.title}</div>
              <div style={{ fontSize: 14.5, lineHeight: 1.7, color: P.inkSoft }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <footer style={{ borderTop: `1px solid ${P.line}` }}>
        <div style={{ ...wrap, padding: "26px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, ...mono, fontSize: 9.5, color: P.inkSoft }}>
          <span>© 2026 Autologic</span><span>Kandirpar, Cumilla, Bangladesh</span>
        </div>
      </footer>

      <div className="al-switch" style={{ background: P.paper, borderTop: `1px solid ${P.line}` }}>
        <a href="/preview/m3" style={{ color: P.inkSoft, borderColor: P.line }}>3 · Cascade</a>
        <a href="/preview/p" className="on" style={{ background: P.accent, borderColor: P.accent, color: "#fff" }}>P · Paper</a>
      </div>
      <div className="al-pad" />
    </div>
  );
}
