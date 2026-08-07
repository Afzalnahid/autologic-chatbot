export const metadata = {
  title: "Autologic — AI Chatbot for Facebook, Instagram & WhatsApp",
  description: "Autologic is an AI-powered customer service chatbot platform that connects to Facebook, Instagram, and WhatsApp, and automates meeting scheduling with Google Calendar.",
};

import { CASE_STUDIES, TYPE_LABEL, isPlaceholder, publishedCaseStudies } from "@/lib/case-studies.js";

const T = {
  bg: "#0A0D14", card: "#0F1420", gold: "#5B8CFF", goldBg: "rgba(91,140,255,0.12)",
  text: "#E7EAF2", muted: "#98A3BA", border: "#1F2839", green: "#2ED3A7",
  warn: "#F5A524",
};

function Feature({ icon, title, desc, i = 0 }) {
  return (
    <div className="al-card" data-reveal={(i % 3) * 90} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.7 }}>{desc}</div>
    </div>
  );
}

function CaseStudy({ cs, draft }) {
  return (
    <div className="al-card" data-reveal="0" style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `2px solid ${draft ? T.warn : T.gold}`, borderRadius: 14, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
        <span style={{ fontSize: 17, fontWeight: 700 }}>{cs.business}</span>
        <span style={{ fontSize: 11.5, color: T.gold, background: T.goldBg, border: `1px solid ${T.gold}33`, borderRadius: 20, padding: "3px 10px" }}>
          {TYPE_LABEL[cs.businessType] || cs.businessType}
        </span>
        {draft && (
          <span style={{ fontSize: 11.5, color: T.warn, border: `1px solid ${T.warn}55`, borderRadius: 20, padding: "3px 10px" }}>
            Draft — hidden in production
          </span>
        )}
      </div>
      <div style={{ fontSize: 13.5, color: T.muted, marginBottom: 18 }}>
        {cs.subtitle} · {cs.channels}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 14, marginBottom: 18 }}>
        {cs.metrics.map((m, i) => (
          <div key={i}>
            <div style={{ fontSize: 21, fontWeight: 800, color: draft ? T.warn : T.green, lineHeight: 1.3 }}>{m.value}</div>
            <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.5, marginTop: 2 }}>{m.label}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.75 }}>{cs.story}</div>
    </div>
  );
}

export default function Home() {
  // Unfinished case studies are visible on preview builds so the layout can be
  // reviewed, and filtered out of production so nothing unverified is published.
  const isProd = process.env.VERCEL_ENV === "production";
  const cases = isProd ? publishedCaseStudies() : CASE_STUDIES;
  const wrap = { maxWidth: 1080, margin: "0 auto", padding: "0 24px" };
  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: "system-ui, sans-serif" }}>
      <style>{`
        /* The subject is a chat product, so the page arrives the way a conversation
           does: one line at a time, each settling a beat after the last. Short and
           quiet — the copy has to be readable before the motion finishes. */
        @keyframes al-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .al-rise { animation: al-rise .42s cubic-bezier(.22,.61,.36,1) both; }

        .al-card { transition: transform .18s ease, border-color .18s ease, background .18s ease; }
        .al-card:hover { transform: translateY(-3px); border-color: ${T.gold}55; }
        /* Touch has no hover, so the press itself has to answer. */
        .al-card:active { transform: scale(.985); border-color: ${T.gold}55; }

        /* Reveal on scroll. The class is only added by the script below, so with
           JavaScript off every card is simply visible from the start. */
        .al-obs { opacity: 0; transform: translateY(18px); }
        .al-obs.al-in { opacity: 1; transform: none; transition: opacity .5s ease, transform .5s cubic-bezier(.22,.61,.36,1); }

        .al-link { transition: color .15s ease; }
        .al-link:hover { color: ${T.text}; }

        .al-btn { transition: transform .15s ease, border-color .15s ease, background .15s ease, box-shadow .15s ease; }
        .al-btn:hover { transform: translateY(-1px); border-color: ${T.gold}66; }
        .al-btn:active { transform: translateY(0); }

        .al-cta { transition: transform .15s ease, box-shadow .25s ease, filter .15s ease; }
        .al-cta:hover { transform: translateY(-2px); box-shadow: 0 10px 28px ${T.gold}33; filter: brightness(1.06); }
        .al-cta:active { transform: scale(.97); box-shadow: none; }
        .al-btn:active { transform: scale(.97); }

        a:focus-visible, .al-card:focus-visible { outline: 2px solid ${T.gold}; outline-offset: 3px; border-radius: 8px; }

        @media (prefers-reduced-motion: reduce) {
          .al-rise, .al-card, .al-link, .al-btn, .al-cta { animation: none !important; transition: none !important; transform: none !important; }
          .al-obs { opacity: 1 !important; transform: none !important; }
        }
      `}</style>


      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){
            if (!("IntersectionObserver" in window)) return;
            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
            var els = document.querySelectorAll("[data-reveal]");
            for (var i = 0; i < els.length; i++) els[i].classList.add("al-obs");
            var io = new IntersectionObserver(function(entries){
              entries.forEach(function(e){
                if (!e.isIntersecting) return;
                e.target.style.transitionDelay = (e.target.dataset.reveal || 0) + "ms";
                e.target.classList.add("al-in");
                io.unobserve(e.target);
              });
            }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
            for (var j = 0; j < els.length; j++) io.observe(els[j]);
          })();`,
        }}
      />
      {/* Nav */}
      <nav style={{ borderBottom: `1px solid ${T.border}` }}>
        <div style={{ ...wrap, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: T.goldBg, border: `1px solid ${T.gold}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🤖</div>
            <span style={{ fontSize: 19, fontWeight: 700 }}>Autologic</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a href="/pricing" className="al-link" style={{ padding: "9px 14px", color: T.muted, fontWeight: 600, fontSize: 14, textDecoration: "none" }}>Pricing</a>
            <a href="/dashboard?auth=signin" className="al-btn" style={{ padding: "9px 18px", background: "transparent", color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: "none" }}>Log in</a>
            <a href="/dashboard?auth=signup" className="al-cta" style={{ padding: "9px 20px", background: T.gold, color: "#0a0a0a", borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: "none" }}>Sign up</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ ...wrap, textAlign: "center", padding: "72px 24px 56px" }}>
        <div className="al-rise" style={{ display: "inline-block", fontSize: 12.5, color: T.gold, background: T.goldBg, border: `1px solid ${T.gold}33`, borderRadius: 20, padding: "5px 14px", marginBottom: 22 }}>
          AI Customer Service Automation
        </div>
        <h1 className="al-rise" style={{ animationDelay: ".09s", fontSize: 42, fontWeight: 800, lineHeight: 1.2, margin: "0 0 18px", letterSpacing: -0.5 }}>
          One AI chatbot for<br />all your customer channels
        </h1>
        <p className="al-rise" style={{ animationDelay: ".18s", fontSize: 17, color: T.muted, maxWidth: 620, margin: "0 auto 32px", lineHeight: 1.7 }}>
          Autologic connects to your Facebook, Instagram, and WhatsApp, answers customer questions automatically with AI, and books meetings straight into your Google Calendar — 24/7, in your own voice.
        </p>
        <a href="/dashboard?auth=signup" className="al-rise al-cta" style={{ animationDelay: ".27s", display: "inline-block", padding: "13px 30px", background: T.gold, color: "#0a0a0a", borderRadius: 10, fontWeight: 700, fontSize: 15.5, textDecoration: "none" }}>Get started</a>
      </section>

      {/* Features */}
      <section style={{ ...wrap, padding: "20px 24px 64px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
          <Feature icon="💬" title="Multi-channel messaging" desc="Connect Facebook Messenger, Instagram Direct, and WhatsApp Business. All your customer conversations, handled by one AI assistant in a single dashboard." i={0} />
          <Feature icon="🧠" title="Smart AI replies" desc="The bot understands customer questions and answers using your own products or uploaded knowledge base — accurate, on-brand, and available around the clock." i={1} />
          <Feature icon="📅" title="Google Calendar booking" desc="For service businesses, the bot checks your Google Calendar availability, creates meetings, generates a Google Meet link, and sends it to the customer automatically." i={2} />
          <Feature icon="🛍️" title="Product & order handling" desc="For online shops, the bot recommends products, matches customer photos to your inventory, and records orders — turning chats into sales." i={3} />
          <Feature icon="📚" title="Knowledge base" desc="Upload PDFs, Word documents, or text files. Agencies can turn their documents into an instant, searchable knowledge base the bot answers from." i={4} />
          <Feature icon="🔒" title="Secure & private" desc="Each business's data is fully isolated. Access tokens are stored securely and never shared. Your customer data stays yours." i={5} />
        </div>
      </section>

      {/* Case studies */}
      {cases.length > 0 && (
        <section id="case-studies" style={{ ...wrap, padding: "0 24px 64px" }}>
          <h2 data-reveal="0" style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.3, margin: "0 0 10px" }}>
            Businesses running on Autologic
          </h2>
          <p style={{ fontSize: 15.5, color: T.muted, lineHeight: 1.7, maxWidth: 620, margin: "0 0 26px" }}>
            Online shops and service businesses in Bangladesh using the same platform, each with the bot trained on their own products or services.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
            {cases.map((cs) => (
              <CaseStudy key={cs.id} cs={cs} draft={isPlaceholder(cs)} />
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${T.border}` }}>
        <div style={{ ...wrap, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, padding: "26px 24px", fontSize: 13.5, color: T.muted }}>
          <div>© 2026 Autologic · Kandirpar, Cumilla, Bangladesh</div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <a href="/pricing" className="al-link" style={{ color: T.muted, textDecoration: "none" }}>Pricing</a>
            <a href="/google-calendar" className="al-link" style={{ color: T.muted, textDecoration: "none" }}>Google Calendar</a>
            <a href="/privacy" className="al-link" style={{ color: T.muted, textDecoration: "none" }}>Privacy Policy</a>
            <a href="/terms" className="al-link" style={{ color: T.muted, textDecoration: "none" }}>Terms of Service</a>
            <a href="/contact" className="al-link" style={{ color: T.muted, textDecoration: "none" }}>Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
