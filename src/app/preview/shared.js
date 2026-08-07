// Shared by the three preview variants so the comparison is fair: same colours,
// same copy, same motion. Only the layout and typography differ.

export const T = {
  bg: "#0A0D14", card: "#0F1420", gold: "#5B8CFF", goldBg: "rgba(91,140,255,0.10)",
  text: "#E7EAF2", muted: "#98A3BA", dim: "#6B7689", border: "#1F2839", green: "#2ED3A7",
};

export const FEATURES = [
  { icon: "ti-messages", title: "Multi-channel messaging", desc: "Facebook Messenger, Instagram Direct and WhatsApp Business in one inbox, answered by one assistant." },
  { icon: "ti-brain", title: "Smart AI replies", desc: "Answers come from your own products or uploaded documents — accurate, on-brand, around the clock." },
  { icon: "ti-calendar-check", title: "Calendar booking", desc: "Checks your Google Calendar, creates the meeting, generates the Meet link and sends it to the customer." },
  { icon: "ti-shopping-bag", title: "Products and orders", desc: "Recommends products, matches customer photos to your inventory and records the order as it is confirmed." },
  { icon: "ti-books", title: "Knowledge base", desc: "Upload PDFs, Word files or text. Your documents become an instant, searchable source the bot answers from." },
  { icon: "ti-lock", title: "Isolated and private", desc: "Every business's data is separated at the database. Access tokens are stored securely and never shared." },
];

export const COPY = {
  eyebrow: "Answering customers right now",
  h1a: "One AI chatbot for",
  h1b: "all your customer channels",
  lead: "Connects to Facebook, Instagram and WhatsApp, answers in Bangla or English, and books meetings straight into your Google Calendar.",
  cta: "Start free trial",
  cta2: "See pricing",
  proof: ["3-day free trial", "No card required", "Bangla and English"],
  sectionLabel: "What it does",
  sectionTitle: "Everything a customer conversation needs",
  sectionLead: "Set it up once. The bot handles the questions you answer a hundred times a week.",
};

export const wrap = { maxWidth: 1120, margin: "0 auto", padding: "0 22px" };

export const BASE_CSS = `
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

  .al-switch { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; display: flex; gap: 8px;
    justify-content: center; padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
    background: rgba(10,13,20,.9); backdrop-filter: blur(14px); border-top: 1px solid ${T.border} }
  .al-switch a { flex: 1; max-width: 150px; text-align: center; padding: 11px 8px; border-radius: 10px;
    font-size: 13px; font-weight: 600; text-decoration: none; color: ${T.muted};
    border: 1px solid ${T.border}; transition: all .15s ease }
  .al-switch a.on { color: #0A0D14; background: ${T.gold}; border-color: ${T.gold} }
  .al-pad { height: 78px }

  @media (max-width: 620px) { .al-grid { grid-template-columns: 1fr !important } }
  @media (prefers-reduced-motion: reduce) {
    .al-rise, .al-card, .al-cta, .al-btn, .al-link { animation: none !important; transition: none !important; transform: none !important }
    .al-obs { opacity: 1 !important; transform: none !important }
    .al-dot { animation: none !important }
  }
`;

export const REVEAL_JS = `(function(){
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
})();`;

// Always reachable, so switching between the three is one tap on a phone.
export function Switch({ active }) {
  const items = [["A", "/preview"], ["B", "/preview/b"], ["C", "/preview/c"]];
  return (
    <>
      <div className="al-pad" />
      <div className="al-switch">
        {items.map(([k, href]) => (
          <a key={k} href={href} className={active === k ? "on" : ""}>
            {k === "A" ? "A · Calm" : k === "B" ? "B · Editorial" : "C · Product"}
          </a>
        ))}
      </div>
    </>
  );
}

export function Eyebrow({ style }) {
  return (
    <div className="al-rise" style={{ display: "inline-flex", alignItems: "center", fontSize: 11.5, fontWeight: 600,
      letterSpacing: "0.09em", textTransform: "uppercase", color: T.green, background: "rgba(46,211,167,.08)",
      border: `1px solid ${T.green}2A`, borderRadius: 999, padding: "6px 14px", ...style }}>
      <span className="al-dot" /> {COPY.eyebrow}
    </div>
  );
}

export function Proof({ align = "center" }) {
  return (
    <div className="al-rise" style={{ animationDelay: ".32s", marginTop: 30, display: "flex", gap: 20,
      justifyContent: align, flexWrap: "wrap", fontSize: 13, color: T.dim }}>
      {COPY.proof.map((p) => (
        <span key={p}><i className="ti ti-check" style={{ color: T.green, marginRight: 6 }} />{p}</span>
      ))}
    </div>
  );
}

export function Nav() {
  return (
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
          <a href="/dashboard?auth=signup" className="al-cta" style={{ padding: "9px 18px", background: T.gold,
            color: "#0A0D14", borderRadius: 9, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>Sign up</a>
        </div>
      </div>
    </nav>
  );
}

export function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${T.border}` }}>
      <div style={{ ...wrap, padding: "28px 22px", display: "flex", justifyContent: "space-between",
        alignItems: "center", flexWrap: "wrap", gap: 14, fontSize: 13, color: T.dim }}>
        <div>© 2026 Autologic · Kandirpar, Cumilla, Bangladesh</div>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <a href="/pricing" className="al-link">Pricing</a>
          <a href="/privacy" className="al-link">Privacy</a>
          <a href="/terms" className="al-link">Terms</a>
          <a href="/contact" className="al-link">Contact</a>
        </div>
      </div>
    </footer>
  );
}

export function Head() {
  return (
    <>
      <style>{BASE_CSS}</style>
      <script dangerouslySetInnerHTML={{ __html: REVEAL_JS }} />
    </>
  );
}

export const shell = {
  background: T.bg, minHeight: "100vh", color: T.text,
  fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
};
