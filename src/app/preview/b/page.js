import { T, FEATURES, COPY, wrap, Head, Nav, Footer, Eyebrow, Proof, Switch, shell } from "../shared.js";
export const metadata = { title: "B · Editorial — Autologic preview", robots: { index: false, follow: false } };

// VARIANT B — editorial. Left-aligned, much larger headline, no card boxes at all:
// the features become a numbered list separated by hairlines. Fewer containers means
// more air, which is where a page starts to feel expensive rather than busy.
export default function B() {
  return (
    <div style={shell}>
      <Head />
      <Nav />

      <section style={{ ...wrap, padding: "clamp(60px, 12vw, 120px) 22px clamp(48px, 8vw, 72px)" }}>
        <Eyebrow style={{ marginBottom: 30 }} />
        <h1 className="al-rise" style={{ animationDelay: ".08s", fontSize: "clamp(34px, 9vw, 68px)", fontWeight: 800,
          lineHeight: 1.04, letterSpacing: "-0.034em", margin: "0 0 24px", maxWidth: 880 }}>
          One AI chatbot for all your customer channels
        </h1>
        <p className="al-rise" style={{ animationDelay: ".16s", fontSize: "clamp(16px, 3vw, 20px)", lineHeight: 1.6,
          color: T.muted, maxWidth: 620, margin: "0 0 36px" }}>{COPY.lead}</p>
        <div className="al-rise" style={{ animationDelay: ".24s", display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a href="/dashboard?auth=signup" className="al-cta" style={{ padding: "15px 32px", background: T.gold,
            color: "#0A0D14", borderRadius: 11, fontWeight: 700, fontSize: 16, textDecoration: "none" }}>{COPY.cta}</a>
          <a href="/pricing" className="al-btn" style={{ padding: "15px 30px", color: T.text,
            border: `1px solid ${T.border}`, borderRadius: 11, fontWeight: 600, fontSize: 16, textDecoration: "none" }}>{COPY.cta2}</a>
        </div>
        <Proof align="flex-start" />
      </section>

      <section style={{ ...wrap, padding: "clamp(32px, 6vw, 56px) 22px clamp(64px, 10vw, 96px)" }}>
        <div data-reveal="0" style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap",
          borderBottom: `1px solid ${T.border}`, paddingBottom: 20, marginBottom: 8 }}>
          <h2 style={{ fontSize: "clamp(22px, 4.6vw, 32px)", fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
            {COPY.sectionTitle}
          </h2>
          <span style={{ fontSize: 13.5, color: T.dim }}>{COPY.sectionLead}</span>
        </div>

        {/* A numbered list, not boxes. The hairline does the work a border used to. */}
        {FEATURES.map((f, i) => (
          <div key={f.title} data-reveal={i * 60} className="al-row"
            style={{ display: "flex", gap: "clamp(16px, 4vw, 40px)", padding: "26px 0",
              borderBottom: i < FEATURES.length - 1 ? `1px solid ${T.border}` : "none" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.gold, minWidth: 34, paddingTop: 3,
              fontVariantNumeric: "tabular-nums" }}>
              {String(i + 1).padStart(2, "0")}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <i className={`ti ${f.icon}`} style={{ fontSize: 18, color: T.gold }} />
                <span style={{ fontSize: "clamp(16px, 3.2vw, 19px)", fontWeight: 650, letterSpacing: "-0.012em" }}>{f.title}</span>
              </div>
              <div style={{ fontSize: 14.5, lineHeight: 1.75, color: T.muted, maxWidth: 640 }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </section>

      <Footer />
      <Switch active="B" />
    </div>
  );
}
