import { T, FEATURES, COPY, wrap, Head, Nav, Footer, Eyebrow, Proof, Switch, shell } from "./shared.js";
export const metadata = { title: "A · Calm — Autologic preview", robots: { index: false, follow: false } };

// VARIANT A — calm and operational. Centred, restrained, icon cards.
// The safest of the three: closest to the page you have now, just tidied.
export default function A() {
  return (
    <div style={shell}>
      <Head />
      <Nav />

      <section style={{ ...wrap, padding: "clamp(56px, 11vw, 100px) 22px clamp(40px, 7vw, 64px)", textAlign: "center" }}>
        <Eyebrow style={{ marginBottom: 26 }} />
        <h1 className="al-rise" style={{ animationDelay: ".08s", fontSize: "clamp(30px, 7.4vw, 50px)", fontWeight: 800,
          lineHeight: 1.12, letterSpacing: "-0.022em", margin: "0 0 20px" }}>
          {COPY.h1a}<br />{COPY.h1b}
        </h1>
        <p className="al-rise" style={{ animationDelay: ".16s", fontSize: "clamp(15.5px, 2.6vw, 17.5px)",
          lineHeight: 1.65, color: T.muted, maxWidth: 600, margin: "0 auto 34px" }}>{COPY.lead}</p>
        <div className="al-rise" style={{ animationDelay: ".24s", display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/dashboard?auth=signup" className="al-cta" style={{ padding: "14px 30px", background: T.gold,
            color: "#0A0D14", borderRadius: 11, fontWeight: 700, fontSize: 15.5, textDecoration: "none" }}>{COPY.cta}</a>
          <a href="/pricing" className="al-btn" style={{ padding: "14px 28px", color: T.text,
            border: `1px solid ${T.border}`, borderRadius: 11, fontWeight: 600, fontSize: 15.5, textDecoration: "none" }}>{COPY.cta2}</a>
        </div>
        <Proof />
      </section>

      <section style={{ ...wrap, padding: "clamp(24px, 5vw, 44px) 22px clamp(64px, 10vw, 96px)" }}>
        <div data-reveal="0" style={{ marginBottom: 34, maxWidth: 560 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase",
            color: T.gold, marginBottom: 12 }}>{COPY.sectionLabel}</div>
          <h2 style={{ fontSize: "clamp(22px, 4.6vw, 30px)", fontWeight: 700, lineHeight: 1.25,
            letterSpacing: "-0.015em", margin: "0 0 12px" }}>{COPY.sectionTitle}</h2>
          <p style={{ fontSize: 15.5, lineHeight: 1.65, color: T.muted, margin: 0 }}>{COPY.sectionLead}</p>
        </div>
        <div className="al-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 16 }}>
          {FEATURES.map((f, i) => (
            <div key={f.title} className="al-card" data-reveal={(i % 3) * 80}
              style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "26px 24px" }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: T.goldBg, border: `1px solid ${T.gold}22`,
                display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
                <i className={`ti ${f.icon}`} style={{ fontSize: 20, color: T.gold }} />
              </div>
              <div style={{ fontSize: 15.5, fontWeight: 650, marginBottom: 8, letterSpacing: "-0.01em" }}>{f.title}</div>
              <div style={{ fontSize: 14.5, lineHeight: 1.72, color: T.muted }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <Footer />
      <Switch active="A" />
    </div>
  );
}
