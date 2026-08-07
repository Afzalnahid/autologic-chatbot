import { T, CH, COPY, CONVOS, MOTION, wrap, shell, BASE_CSS, REVEAL_JS, Switch } from "./shared.js";

function Bubble({ me, text }) {
  return (
    <div style={{ display: "flex", justifyContent: me ? "flex-end" : "flex-start" }}>
      <div style={{ maxWidth: "84%", fontSize: 13, lineHeight: 1.62, padding: "9px 12px", borderRadius: 13,
        background: me ? T.gold : "#151B29", color: me ? "#0A0D14" : T.text,
        borderBottomRightRadius: me ? 4 : 13, borderBottomLeftRadius: me ? 13 : 4,
        border: me ? "none" : `1px solid ${T.border}` }}>{text}</div>
    </div>
  );
}

function Chat({ conv, c, delay }) {
  const ch = CH[conv.ch];
  return (
    <div className="al-card" data-reveal={delay} style={{ background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 16, padding: 15 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, paddingBottom: 11, marginBottom: 13,
        borderBottom: `1px solid ${T.border}` }}>
        <i className={`ti ${ch.icon}`} style={{ fontSize: 17, color: ch.tint }} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>{ch.name}</span>
        <span style={{ marginLeft: "auto", fontSize: 10.5, color: T.dim, border: `1px solid ${T.border}`,
          borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap" }}>{c[conv.kind]}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {conv.lines.map((l, i) => <Bubble key={i} me={l[0] === "me"} text={l[1]} />)}
      </div>
      <div style={{ marginTop: 13, paddingTop: 11, borderTop: `1px solid ${T.border}`, fontSize: 11.5,
        color: T.dim, display: "flex", alignItems: "center", gap: 7 }}>
        <i className="ti ti-check" style={{ color: T.green, fontSize: 14 }} />{c.notes[conv.note]}
      </div>
    </div>
  );
}

const label = { fontSize: 11.5, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase" };

export default function Body({ motion = "m2", lang = "en" }) {
  const c = COPY[lang === "bn" ? "bn" : "en"];
  const m = MOTION[motion] || MOTION.m2;
  const other = lang === "bn" ? "en" : "bn";
  const here = `/preview/${motion}`;

  return (
    <div style={shell}>
      <style>{BASE_CSS + m.css}</style>
      <script dangerouslySetInnerHTML={{ __html: REVEAL_JS }} />

      <nav style={{ borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, zIndex: 10,
        background: "rgba(10,13,20,.82)", backdropFilter: "blur(12px)" }}>
        <div style={{ ...wrap, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: T.goldBg, border: `1px solid ${T.gold}33`,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="ti ti-robot" style={{ fontSize: 17, color: T.gold }} />
            </div>
            <span style={{ fontSize: 17.5, fontWeight: 700, letterSpacing: "-0.01em" }}>Autologic</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* One tap, and the whole page speaks the customer's language. */}
            <a href={`${here}${other === "bn" ? "?lang=bn" : ""}`} className="al-btn"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", color: T.text,
                border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
              <i className="ti ti-language" style={{ fontSize: 15, color: T.gold }} />
              {other === "bn" ? "বাংলা" : "English"}
            </a>
            <a href="/dashboard?auth=signup" className="al-cta" style={{ padding: "9px 16px", background: T.gold,
              color: "#0A0D14", borderRadius: 9, fontWeight: 700, fontSize: 13.5, textDecoration: "none" }}>
              {lang === "bn" ? "শুরু করুন" : "Sign up"}
            </a>
          </div>
        </div>
      </nav>

      <section style={{ ...wrap, padding: "clamp(52px, 10vw, 92px) 22px clamp(30px, 5vw, 44px)", textAlign: "center" }}>
        <div className="al-rise" style={{ display: "inline-flex", alignItems: "center", ...label, color: T.green,
          background: "rgba(46,211,167,.08)", border: `1px solid ${T.green}2A`, borderRadius: 999,
          padding: "6px 14px", marginBottom: 24 }}>
          <span className="al-dot" /> {c.eyebrow}
        </div>

        <h1 className="al-rise" style={{ animationDelay: ".08s", fontSize: "clamp(30px, 6.8vw, 48px)", fontWeight: 800,
          lineHeight: 1.12, letterSpacing: "-0.024em", margin: "0 auto 18px", maxWidth: 820 }}>{c.h1}</h1>

        <p className="al-rise" style={{ animationDelay: ".16s", fontSize: "clamp(15.5px, 2.6vw, 17.5px)",
          lineHeight: 1.68, color: T.muted, maxWidth: 620, margin: "0 auto 26px" }}>{c.lead}</p>

        <div className="al-rise" style={{ animationDelay: ".22s", display: "flex", gap: 9, flexWrap: "wrap",
          justifyContent: "center", marginBottom: 28 }}>
          {Object.values(CH).map((x) => (
            <span key={x.name} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5,
              color: T.muted, background: T.card, border: `1px solid ${T.border}`, borderRadius: 999, padding: "7px 13px" }}>
              <i className={`ti ${x.icon}`} style={{ fontSize: 15, color: x.tint }} />{x.short}
            </span>
          ))}
        </div>

        <div className="al-rise" style={{ animationDelay: ".28s", display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/dashboard?auth=signup" className="al-cta" style={{ padding: "14px 30px", background: T.gold,
            color: "#0A0D14", borderRadius: 11, fontWeight: 700, fontSize: 15.5, textDecoration: "none" }}>{c.cta}</a>
          <a href="/pricing" className="al-btn" style={{ padding: "14px 28px", color: T.text,
            border: `1px solid ${T.border}`, borderRadius: 11, fontWeight: 600, fontSize: 15.5, textDecoration: "none" }}>{c.cta2}</a>
        </div>

        <div className="al-rise" style={{ animationDelay: ".34s", marginTop: 26, display: "flex", gap: 18,
          justifyContent: "center", flexWrap: "wrap", fontSize: 13, color: T.dim }}>
          {c.proof.map((p) => <span key={p}><i className="ti ti-check" style={{ color: T.green, marginRight: 6 }} />{p}</span>)}
        </div>
      </section>

      <section style={{ ...wrap, padding: "clamp(20px, 4vw, 36px) 22px clamp(48px, 8vw, 72px)" }}>
        <div data-reveal="0" style={{ marginBottom: 24, maxWidth: 640 }}>
          <div style={{ ...label, color: T.gold, marginBottom: 12 }}>{c.convLabel}</div>
          <h2 style={{ fontSize: "clamp(22px, 4.6vw, 30px)", fontWeight: 700, lineHeight: 1.25,
            letterSpacing: "-0.015em", margin: "0 0 12px" }}>{c.convTitle}</h2>
          <p style={{ fontSize: 15.5, lineHeight: 1.65, color: T.muted, margin: 0 }}>{c.convLead}</p>
        </div>

        <div className="al-rail">
          {CONVOS.map((cv, i) => <Chat key={cv.ch} conv={cv} c={c} delay={i * 70} />)}
        </div>
        <div className="al-hint"><i className="ti ti-arrow-right" /> {c.swipe}</div>
      </section>

      <section style={{ ...wrap, padding: "0 22px clamp(56px, 9vw, 88px)" }}>
        <div data-reveal="0" style={{ marginBottom: 24, maxWidth: 560 }}>
          <div style={{ ...label, color: T.gold, marginBottom: 12 }}>{c.featLabel}</div>
          <h2 style={{ fontSize: "clamp(22px, 4.6vw, 30px)", fontWeight: 700, lineHeight: 1.25,
            letterSpacing: "-0.015em", margin: 0 }}>{c.featTitle}</h2>
        </div>
        <div className="al-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 14 }}>
          {c.features.map((f, i) => (
            <div key={f.title} className="al-card" data-reveal={(i % 3) * 80}
              style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 22, display: "flex", gap: 14 }}>
              <i className={`ti ${f.icon}`} style={{ fontSize: 19, color: T.gold, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 650, marginBottom: 6, letterSpacing: "-0.01em" }}>{f.title}</div>
                <div style={{ fontSize: 14, lineHeight: 1.7, color: T.muted }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer style={{ borderTop: `1px solid ${T.border}` }}>
        <div style={{ ...wrap, padding: "26px 22px", fontSize: 13, color: T.dim, textAlign: "center" }}>
          © 2026 Autologic · Kandirpar, Cumilla, Bangladesh
          <div style={{ marginTop: 8, fontSize: 12 }}>{m.name} — {m.note}</div>
        </div>
      </footer>

      <Switch active={motion} lang={lang} />
    </div>
  );
}
