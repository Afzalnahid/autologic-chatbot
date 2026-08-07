import { T, FEATURES, COPY, wrap, Head, Nav, Footer, Eyebrow, Proof, Switch, shell } from "../shared.js";
export const metadata = { title: "C · Product — Autologic preview", robots: { index: false, follow: false } };

// VARIANT C — product-forward. The hero shows the thing working: a real chat,
// in Bangla, ending in a booked meeting. Enterprise buyers trust a screen of the
// product more than a sentence about it, and this is the only variant that proves
// the bot answers in Bangla without claiming it.
function Bubble({ side, text, delay }) {
  const me = side === "me";
  return (
    <div data-reveal={delay} style={{ display: "flex", justifyContent: me ? "flex-end" : "flex-start" }}>
      <div style={{
        maxWidth: "82%", fontSize: 13.5, lineHeight: 1.65, padding: "10px 13px", borderRadius: 13,
        background: me ? T.gold : "#151B29", color: me ? "#0A0D14" : T.text,
        borderBottomRightRadius: me ? 4 : 13, borderBottomLeftRadius: me ? 13 : 4,
        border: me ? "none" : `1px solid ${T.border}`,
      }}>{text}</div>
    </div>
  );
}

export default function C() {
  return (
    <div style={shell}>
      <Head />
      <Nav />

      <section style={{ ...wrap, padding: "clamp(48px, 9vw, 88px) 22px clamp(40px, 7vw, 64px)" }}>
        <div className="al-two" style={{ display: "grid", gridTemplateColumns: "1.05fr .95fr", gap: "clamp(32px, 6vw, 64px)", alignItems: "center" }}>
          <div>
            <Eyebrow style={{ marginBottom: 24 }} />
            <h1 className="al-rise" style={{ animationDelay: ".08s", fontSize: "clamp(30px, 6.6vw, 46px)", fontWeight: 800,
              lineHeight: 1.1, letterSpacing: "-0.026em", margin: "0 0 18px" }}>
              One AI chatbot for all your customer channels
            </h1>
            <p className="al-rise" style={{ animationDelay: ".16s", fontSize: "clamp(15.5px, 2.6vw, 17.5px)",
              lineHeight: 1.65, color: T.muted, margin: "0 0 30px", maxWidth: 520 }}>{COPY.lead}</p>
            <div className="al-rise" style={{ animationDelay: ".24s", display: "flex", gap: 12, flexWrap: "wrap" }}>
              <a href="/dashboard?auth=signup" className="al-cta" style={{ padding: "14px 30px", background: T.gold,
                color: "#0A0D14", borderRadius: 11, fontWeight: 700, fontSize: 15.5, textDecoration: "none" }}>{COPY.cta}</a>
              <a href="/pricing" className="al-btn" style={{ padding: "14px 28px", color: T.text,
                border: `1px solid ${T.border}`, borderRadius: 11, fontWeight: 600, fontSize: 15.5, textDecoration: "none" }}>{COPY.cta2}</a>
            </div>
            <Proof align="flex-start" />
          </div>

          {/* The product, not a promise. */}
          <div className="al-rise" style={{ animationDelay: ".2s", background: T.card, border: `1px solid ${T.border}`,
            borderRadius: 18, padding: 16, boxShadow: "0 24px 60px rgba(0,0,0,.45)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, paddingBottom: 12, marginBottom: 14,
              borderBottom: `1px solid ${T.border}` }}>
              <i className="ti ti-brand-whatsapp" style={{ fontSize: 17, color: T.green }} />
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>WhatsApp Business</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: T.green, display: "inline-flex", alignItems: "center" }}>
                <span className="al-dot" /> Bot live
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <Bubble side="me" text="আপনাদের সার্ভিস প্যাকেজ কত?" delay={0} />
              <Bubble side="bot" text="আমাদের তিনটি প্যাকেজ আছে — স্টার্টার ১,৫০০৳, প্রো ৩,৫০০৳ এবং এজেন্সি ৬,০০০৳ প্রতি মাসে।" delay={90} />
              <Bubble side="me" text="বৃহস্পতিবার একটা মিটিং করা যাবে?" delay={180} />
              <Bubble side="bot" text="বৃহস্পতিবার বিকেল ৪টা খালি আছে। মিটিং বুক করে দিলাম — লিংক পাঠিয়ে দিয়েছি। ✅" delay={270} />
            </div>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}`, fontSize: 11.5,
              color: T.dim, display: "flex", alignItems: "center", gap: 7 }}>
              <i className="ti ti-calendar-check" style={{ color: T.gold, fontSize: 14 }} />
              Added to Google Calendar automatically
            </div>
          </div>
        </div>
      </section>

      <section style={{ ...wrap, padding: "clamp(24px, 5vw, 44px) 22px clamp(64px, 10vw, 96px)" }}>
        <div data-reveal="0" style={{ marginBottom: 30, maxWidth: 560 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase",
            color: T.gold, marginBottom: 12 }}>{COPY.sectionLabel}</div>
          <h2 style={{ fontSize: "clamp(22px, 4.6vw, 30px)", fontWeight: 700, lineHeight: 1.25,
            letterSpacing: "-0.015em", margin: 0 }}>{COPY.sectionTitle}</h2>
        </div>
        <div className="al-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 14 }}>
          {FEATURES.map((f, i) => (
            <div key={f.title} className="al-card" data-reveal={(i % 3) * 80}
              style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 22,
                display: "flex", gap: 14 }}>
              <i className={`ti ${f.icon}`} style={{ fontSize: 19, color: T.gold, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 650, marginBottom: 6, letterSpacing: "-0.01em" }}>{f.title}</div>
                <div style={{ fontSize: 14, lineHeight: 1.7, color: T.muted }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <style>{`@media (max-width: 860px) { .al-two { grid-template-columns: 1fr !important } }`}</style>
      <Footer />
      <Switch active="C" />
    </div>
  );
}
