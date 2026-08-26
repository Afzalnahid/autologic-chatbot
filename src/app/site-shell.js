import { P, THEME_CSS } from "@/lib/landing.js";
import { COMPANY, COPYRIGHT, ADDRESS_LINE } from "@/lib/company.js";

// The frame the plain content pages sit in — contact, privacy, terms and the
// Google Calendar disclosure.
//
// Those four were written before the 2026-08-16 redesign and never moved onto
// it. They were painted #0A0D14 with a #FF6B75 red that the redesign retired,
// carried no nav bar and no footer, ignored the light/dark switch entirely, and
// offered a bare "Back to home" text link as their only way out. A visitor who
// clicked "Privacy Policy" in the footer landed on what looked like a different
// company's website.
//
// This is the same furniture the landing page and the manual already use: the
// same palette variables, the same Fraunces headings, the same nav buttons, the
// same footer. Nothing new is invented here — where a rule exists in
// docs/shell.js or page.js, it is the same rule.
//
// Server-rendered, no client JavaScript. The theme button works because the
// boot script in the root layout listens on document rather than on the button,
// so any page that renders an element with this id gets a working toggle.

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap');
  ${THEME_CSS}
  /* The sideways clip goes on html, never on body: overflow-x hidden on body
     turns body into a scroll container and every sticky thing inside it then
     rides away with the page instead of sticking. That bug cost this project
     two top bars and a sidebar once already. */
  html { overflow-x: hidden }
  body { overflow-x: clip }
  html, body { -webkit-text-size-adjust: 100%; text-size-adjust: 100% }
  * { -webkit-tap-highlight-color: transparent; box-sizing: border-box }
  p, span, div, td, th, li { overflow-wrap: anywhere }

  .fr { font-family: 'Fraunces', Georgia, serif; font-weight: 700; letter-spacing: -0.02em;
    overflow-wrap: normal; hyphens: none }
  .lbl { font-family: 'IBM Plex Mono', ui-monospace, monospace; letter-spacing: .09em;
    text-transform: uppercase }

  .navbtn { display: inline-flex; align-items: center; gap: 5px; padding: 7px 12px; border-radius: 9px;
    border: 1px solid var(--lp-line); background: var(--lp-card); color: var(--lp-ink);
    font-size: 12.5px; font-weight: 500; text-decoration: none; cursor: pointer; font-family: inherit;
    transition: border-color .15s ease-out, filter .15s ease-out }
  .navbtn:hover { border-color: color-mix(in srgb, var(--lp-acc) 45%, transparent) }
  .navcta { background: var(--lp-grad); color: #fff; border-color: transparent; box-shadow: var(--lp-glow) }
  .navcta:hover { filter: brightness(1.06) }
  /* Icon-only, so its width has to be set or it comes out narrower than tall. */
  #al-mode { width: 34px; padding: 0; justify-content: center }

  .flink { color: var(--lp-soft); text-decoration: none; font-size: 13px }
  .flink:hover { color: var(--lp-acc) }

  /* Body copy. 680px rather than 760: at 760 a line ran to 86 characters, and
     the eye starts losing its place on the way back to the left margin past
     about 75. These are pages people read end to end. */
  .doc { max-width: 680px }
  .doc p { font-size: 16px; line-height: 1.75; color: var(--lp-ink); margin: 0 0 14px }
  .doc li { font-size: 16px; line-height: 1.7; color: var(--lp-ink); margin-bottom: 8px }
  .doc ul, .doc ol { padding-left: 22px; margin: 0 0 16px }
  .doc a { color: var(--lp-acc); text-decoration: none; border-bottom: 1px solid transparent }
  .doc a:hover { border-bottom-color: currentColor }
  .doc strong { font-weight: 600 }

  /* A hairline above every section, so a long legal page reads as a set of
     parts rather than one unbroken wall. */
  .sec { margin-top: 40px; padding-top: 20px; border-top: 1px solid var(--lp-line) }
  .sec:first-of-type { margin-top: 32px }

  .card { background: var(--lp-card); border: 1px solid var(--lp-line); border-radius: 18px;
    padding: 20px 22px; margin-bottom: 14px; display: flex; gap: 16px; align-items: flex-start;
    box-shadow: var(--lp-nm-sm) }
  .tile { width: 44px; height: 44px; border-radius: 13px; background: var(--lp-grad);
    box-shadow: var(--lp-glow); color: #fff; display: flex; align-items: center;
    justify-content: center; font-size: 20px; flex-shrink: 0 }

  .note { margin-top: 40px; padding: 18px 20px; border-radius: 16px;
    background: var(--lp-accSoft); border: 1px solid color-mix(in srgb, var(--lp-acc) 22%, transparent);
    font-size: 14.5px; line-height: 1.7; color: var(--lp-ink) }

  /* A finger is not a mouse pointer. Same floors the manual settled on. */
  @media (pointer: coarse) {
    .navbtn { min-height: 40px }
    #al-mode { width: 40px; min-width: 40px }
    .flink { display: inline-block; padding: 12px 0 }
    /* The wordmark is the way back to the front of the site; measured at 29px
       it was the shortest thing in a bar of 40px buttons. */
    .brandlink { min-height: 40px }
    .doc a[href^="mailto:"], .doc a[href^="tel:"] { display: inline-block; padding: 11px 0; margin: -11px 0 }
  }
  @media (max-width: 420px) {
    .navbtn { font-size: 11.5px; padding: 7px 9px }
  }
`;

const WRAP = { maxWidth: 1240, margin: "0 auto", padding: "0 clamp(16px,4vw,26px)" };

export function H2({ children }) {
  return <h2 className="fr" style={{ fontSize: 21, lineHeight: 1.25, margin: "0 0 12px" }}>{children}</h2>;
}

/** One numbered or titled part of a long document. */
export function Section({ title, children }) {
  return <section className="sec"><H2>{title}</H2>{children}</section>;
}

/** The tinted callout the privacy page uses for its Google disclosure. */
export function Note({ children }) {
  return <div className="note">{children}</div>;
}

/** A fact with an icon: email, address, opening hours. */
export function InfoCard({ icon, label, children, note }) {
  return (
    <div className="card">
      <div className="tile"><i className={`ti ${icon}`} /></div>
      <div style={{ minWidth: 0 }}>
        <div className="lbl" style={{ fontSize: 9.5, color: P.inkSoft, marginBottom: 6 }}>{label}</div>
        <div style={{ fontSize: 16.5, fontWeight: 600, color: P.ink, lineHeight: 1.45 }}>{children}</div>
        {note && <div style={{ fontSize: 14, color: P.inkSoft, marginTop: 6, lineHeight: 1.6 }}>{note}</div>}
      </div>
    </div>
  );
}

export default function SiteShell({ eyebrow, title, lead, updated, children }) {
  return (
    <div style={{ background: P.paper, minHeight: "100vh", color: P.ink,
      fontFamily: "Inter, system-ui, sans-serif" }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <nav style={{ position: "sticky", top: 0, zIndex: 5, borderBottom: `1px solid ${P.line}`,
        background: `color-mix(in srgb, ${P.paper} 88%, transparent)`, backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)" }}>
        <div style={{ ...WRAP, display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "11px clamp(16px,4vw,26px)", gap: 12 }}>
          <a href="/" className="brandlink" style={{ display: "flex", alignItems: "center", gap: 9,
            textDecoration: "none", color: P.ink, minWidth: 0 }}>
            <div style={{ width: 28, height: 28, background: "var(--lp-grad)", borderRadius: 9,
              flexShrink: 0, boxShadow: "var(--lp-glow)", display: "flex", alignItems: "center",
              justifyContent: "center" }}>
              <i className="ti ti-robot" style={{ fontSize: 15, color: P.onAccent }} />
            </div>
            <span className="fr" style={{ fontSize: 19 }}>{COMPANY.name}</span>
          </a>

          <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
            <a href="/pricing" className="navbtn">Pricing</a>
            <button id="al-mode" type="button" className="navbtn" aria-label="Switch theme">
              <i id="al-mode-ic" className="ti ti-moon" style={{ fontSize: 13 }} />
            </button>
            <a href="/dashboard?auth=signin" className="navbtn navcta">Log in</a>
          </div>
        </div>
      </nav>

      {/* A div, not a main: the root layout already wraps every page in one, and
          nesting them makes a screen reader announce two main landmarks. */}
      <div style={{ ...WRAP, padding: "clamp(30px,6vw,54px) clamp(16px,4vw,26px) 64px" }}>
        <div className="doc">
          {eyebrow && <div className="lbl" style={{ fontSize: 9.5, color: P.blue, marginBottom: 14 }}>⌗ {eyebrow}</div>}
          <h1 className="fr" style={{ fontSize: "clamp(30px,5vw,44px)", lineHeight: 1.08, margin: "0 0 14px" }}>{title}</h1>
          {lead && <p style={{ fontSize: 17, lineHeight: 1.7, color: P.inkSoft, margin: "0 0 6px" }}>{lead}</p>}
          {updated && <div className="lbl" style={{ fontSize: 9.5, color: P.inkSoft, marginTop: 14 }}>Last updated · {updated}</div>}
          {children}
        </div>
      </div>

      <footer style={{ borderTop: `1px solid ${P.line}` }}>
        <div style={{ ...WRAP, padding: "26px clamp(16px,4vw,26px) 30px" }}>
          {/* Meta's review needs the privacy and terms URLs reachable from the
              site, and they went missing from a footer once already. */}
          <div style={{ display: "flex", gap: "14px 26px", flexWrap: "wrap", marginBottom: 18 }}>
            <a href="/" className="flink">Home</a>
            <a href="/pricing" className="flink">Pricing</a>
            <a href="/docs" className="flink">Documentation</a>
            <a href="/google-calendar" className="flink">Google Calendar</a>
            <a href="/privacy" className="flink">Privacy Policy</a>
            <a href="/terms" className="flink">Terms of Service</a>
            <a href="/contact" className="flink">Contact</a>
          </div>
          <div className="lbl" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap",
            gap: 12, fontSize: 9.5, color: P.inkSoft, borderTop: `1px solid ${P.line}`, paddingTop: 18 }}>
            <span>{COPYRIGHT}</span>
            <span>{ADDRESS_LINE}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
