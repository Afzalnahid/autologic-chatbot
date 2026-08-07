export const metadata = { title: "Preview — Autologic", robots: { index: false, follow: false } };

// PREVIEW ONLY. Nothing links here. If this is approved it gets merged into
// src/app/page.js and this folder is deleted, so the tokens below stay a copy for
// exactly as long as the comparison is useful.
const T = {
  bg: "#0A0D14", card: "#0F1420", gold: "#5B8CFF", goldBg: "rgba(91,140,255,0.10)",
  text: "#E7EAF2", muted: "#98A3BA", dim: "#6B7689", border: "#1F2839", green: "#2ED3A7",
};

// Four sizes, four weights, one rhythm. Everything on the page picks from here —
// that consistency is what reads as expensive, not any single flourish.
const t = {
  display: { fontSize: "clamp(30px, 7.4vw, 50px)", fontWeight: 800, lineHeight: 1.12, letterSpacing: "-0.022em" },
  h2: { fontSize: "clamp(22px, 4.6vw, 30px)", fontWeight: 700, lineHeight: 1.25, letterSpacing: "-0.015em" },
  lead: { fontSize: "clamp(15.5px, 2.6vw, 17.5px)", lineHeight: 1.65, fontWeight: 400 },
  body: { fontSize: 14.5, lineHeight: 1.72, fontWeight: 400 },
  label: { fontSize: 11.5, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase" },
};

const FEATURES = [
  { icon: "ti-messages", title: "Multi-channel messaging", desc: "Facebook Messenger, Instagram Direct and WhatsApp Business in one inbox, answered by one assistant." },
  { icon: "ti-brain", title: "Smart AI replies", desc: "Answers come from your own products or uploaded documents — accurate, on-brand, around the clock." },
  { icon: "ti-calendar-check", title: "Calendar booking", desc: "Checks your Google Calendar, creates the meeting, generates the Meet link and sends it to the customer." },
  { icon: "ti-shopping-bag", title: "Products and orders", desc: "Recommends products, matches customer photos to your inventory and records the order as it is confirmed." },
  { icon: "ti-books", title: "Knowledge base", desc: "Upload PDFs, Word files or text. Your documents become an instant, searchable source the bot answers from." },
  { icon: "ti-lock", title: "Isolated and private", desc: "Every business's data is separated at the database. Access tokens are stored securely and never shared." },
];

const wrap = { maxWidth: 1120, margin: "0 auto", padding: "0 22px" };

function Feature({ icon, title, desc, i }) {
  return (
    <div className="al-card" data-reveal={(i % 3) * 80}
      style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "26px 24px" }}>
      <div style={{ width: 40, height: 40, borderRadius: 11, background: T.goldBg, border: `1px solid ${T.gold}22`,
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
        <i className={`ti ${icon}`} style={{ fontSize: 20, color: T.gold }} />
      </div>
      <div style={{ fontSize: 15.5, fontWeight: 650, marginBottom: 8, letterSpacing: "-0.01em" }}>{title}</div>
      <div style={{ ...t.body, color: T.muted }}>{desc}</div>
    </div>
  );
}

export default function Preview() {
  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <style>{`
        @keyframes al-rise { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
        .al-rise { animation: al-rise .45s cubic-bezier(.22,.61,.36,1) both }
        .al-obs { opacity: 0; transform: translateY(16px) }
        .al-obs.al-in { opacity: 1; transform: none; transition: opacity .55s ease, transform .55s cubic-bezier(.22,.61,.36,1) }

        .al-card { transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease }
        .al-card:hover { transform: translateY(-3px); border-color: ${T.gold}44; box-shadow: 0 12px 32px rgba(0,0,0,.35) }
        .al-card:active { transform: scale(.99); border-color: ${T.gold}44 }

        @keyframes al-pulse { 0%,100% { box-shadow: 0 0 0 0 ${T.green}55 } 50% { box-shadow: 0 0 0 5px ${T.green}00 } }
        .al-dot { width: 6px; height: 6px; border-radius: 50%; background: ${T.green}; display: inline-block;
                  margin-right: 9px; vertical-align: middle; animation: al-pulse 2.6s ease-in-out infinite }

        .al-link { color: ${T.muted}; text-decoration: none; transition: color .15s ease }
        .al-link:hover { color: ${T.text} }
        .al-btn { transition: transform .15s ease, border-color .15s ease }
        .al-btn:hover { border-color: ${T.gold}55 } .al-btn:active { transform: scale(.97) }
        .al-cta { transition: transform .15s ease, box-shadow .25s ease, filter .15s ease }
        .al-cta:hover { transform: translateY(-2px); box-shadow: 0 10px 30px ${T.gold}33; filter: brightness(1.05) }
        .al-cta:active { transform: scale(.97); box-shadow: none }

        a:focus-visible { outline: 2px solid ${T.gold}; outline-offset: 3px; border-radius: 8px }

        /* One column on a phone, and the tap targets grow rather than shrink. */
        @media (max-width: 620px) {
          .al-grid { grid-template-columns: 1fr !important }
          .al-cta, .al-btn { display: block; text-align: center }
        }
        @media (prefers-reduced-motion: reduce) {
          .al-rise, .al-card, .al-cta, .al-btn, .al-link { animation: none !important; transition: none !important; transform: none !important }
          .al-obs { opacity: 1 !important; transform: none !important }
          .al-dot { animation: none !important }
        }
      `}</style>

      <script dangerouslySetInnerHTML={{ __html: `(function(){
        function start(){
          if (!("IntersectionObserver" in window)) return;
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
          var els = document.querySelectorAll("[data-reveal]");
          for (var i=0;i<els.length;i++) els[i].classList.add("al-obs");
          var io = new IntersectionObserver(function(es){
            es.forEach(function(e){
              if (!e.isIntersecting) return;
              e.target.style.transitionDelay = (e.target.dataset.reveal||0) + "ms";
              e.target.classList.add("al-in"); io.unobserve(e.target);
            });
          }, { threshold: .12, rootMargin: "0px 0px -6% 0px" });
          for (var j=0;j<els.length;j++) io.observe(els[j]);
        }
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
      })();` }} />

      <nav style={{ borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, zIndex: 10,
        background: "rgba(10,13,20,.82)", backdropFilter: "blur(12px)" }}>
        <div style={{ ...wrap, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: T.goldBg, border: `1px solid ${T.gold}33`,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="ti ti-robot" style={{ fontSize: 17, color: T.gold }} />
            </div>
            <span style={{ fontSize: 17.5, fontWeight: 700, letterSpacing: "-0.01em" }}>Autologic</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <a href="/pricing" className="al-link" style={{ padding: "9px 12px", fontWeight: 600, fontSize: 14 }}>Pricing</a>
            <a href="/dashboard?auth=signin" className="al-btn" style={{ padding: "9px 16px", color: T.text,
              border: `1px solid ${T.border}`, borderRadius: 9, fontWeight: 600, fontSize: 14, textDecoration: "none" }}>Log in</a>
            <a href="/dashboard?auth=signup" className="al-cta" style={{ padding: "9px 18px", background: T.gold,
              color: "#0A0D14", borderRadius: 9, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>Sign up</a>
          </div>
        </div>
      </nav>

      {/* Hero — one idea, one action, nothing competing with them. */}
      <section style={{ ...wrap, padding: "clamp(56px, 11vw, 104px) 22px clamp(40px, 7vw, 64px)", textAlign: "center" }}>
        <div className="al-rise" style={{ display: "inline-flex", alignItems: "center", ...t.label, fontSize: 11.5,
          color: T.green, background: "rgba(46,211,167,.08)", border: `1px solid ${T.green}2A`, borderRadius: 999,
          padding: "6px 14px", marginBottom: 26 }}>
          <span className="al-dot" /> Answering customers right now
        </div>

        <h1 className="al-rise" style={{ ...t.display, animationDelay: ".08s", margin: "0 0 20px" }}>
          One AI chatbot for<br />all your customer channels
        </h1>

        <p className="al-rise" style={{ ...t.lead, animationDelay: ".16s", color: T.muted, maxWidth: 600,
          margin: "0 auto 34px" }}>
          Connects to Facebook, Instagram and WhatsApp, answers in Bangla or English,
          and books meetings straight into your Google Calendar.
        </p>

        <div className="al-rise" style={{ animationDelay: ".24s", display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/dashboard?auth=signup" className="al-cta" style={{ padding: "14px 30px", background: T.gold,
            color: "#0A0D14", borderRadius: 11, fontWeight: 700, fontSize: 15.5, textDecoration: "none" }}>
            Start free trial
          </a>
          <a href="/pricing" className="al-btn" style={{ padding: "14px 28px", color: T.text, border: `1px solid ${T.border}`,
            borderRadius: 11, fontWeight: 600, fontSize: 15.5, textDecoration: "none" }}>
            See pricing
          </a>
        </div>

        {/* Quiet reassurance. Only things that are true — no invented numbers. */}
        <div className="al-rise" style={{ animationDelay: ".32s", marginTop: 30, display: "flex", gap: 20,
          justifyContent: "center", flexWrap: "wrap", fontSize: 13, color: T.dim }}>
          <span><i className="ti ti-check" style={{ color: T.green, marginRight: 6 }} />3-day free trial</span>
          <span><i className="ti ti-check" style={{ color: T.green, marginRight: 6 }} />No card required</span>
          <span><i className="ti ti-check" style={{ color: T.green, marginRight: 6 }} />Bangla and English</span>
        </div>
      </section>

      <section style={{ ...wrap, padding: "clamp(24px, 5vw, 44px) 22px clamp(72px, 11vw, 104px)" }}>
        <div data-reveal="0" style={{ marginBottom: 34, maxWidth: 560 }}>
          <div style={{ ...t.label, color: T.gold, marginBottom: 12 }}>What it does</div>
          <h2 style={{ ...t.h2, margin: "0 0 12px" }}>Everything a customer conversation needs</h2>
          <p style={{ ...t.lead, fontSize: 15.5, color: T.muted, margin: 0 }}>
            Set it up once. The bot handles the questions you answer a hundred times a week.
          </p>
        </div>

        <div className="al-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 16 }}>
          {FEATURES.map((f, i) => <Feature key={f.title} {...f} i={i} />)}
        </div>
      </section>

      <footer style={{ borderTop: `1px solid ${T.border}` }}>
        <div style={{ ...wrap, padding: "28px 22px", display: "flex", justifyContent: "space-between",
          alignItems: "center", flexWrap: "wrap", gap: 14, fontSize: 13, color: T.dim }}>
          <div>© 2026 Autologic · Kandirpar, Cumilla, Bangladesh</div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <a href="/pricing" className="al-link">Pricing</a>
            <a href="/google-calendar" className="al-link">Google Calendar</a>
            <a href="/privacy" className="al-link">Privacy</a>
            <a href="/terms" className="al-link">Terms</a>
            <a href="/contact" className="al-link">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
