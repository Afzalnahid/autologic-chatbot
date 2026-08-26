import { P, THEME_CSS } from "@/lib/landing.js";
import { PAGES, GROUPS } from "@/lib/docs/index.js";
import { docHref } from "./copy.js";
import { COPYRIGHT, ADDRESS_LINE } from "@/lib/company.js";
import DocsSearch from "./search.js";

// The frame every documentation page sits in: nav, sidebar, content, footer.
//
// Server-rendered on purpose. The language comes from ?lang=bn in the URL — the
// same switch the landing page and pricing page already use — so a Bangla page
// is a real URL that can be bookmarked, shared and indexed by Google, rather
// than a client-side toggle that leaves the address bar lying.
//
// Only the search box is a client component; everything else is plain HTML.

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600&family=Anek+Bangla:wght@400;600;700&display=swap');
  ${THEME_CSS}
  /* The sideways clip belongs on <html>, never on <body>. "overflow-x: hidden"
     on body makes body a scroll container (its overflow-y computes to auto),
     and every sticky thing inside then sticks to a box that is not the one the
     reader is scrolling — which is why the top bar and the sidebar used to
     scroll away instead of staying put. On <html> the value propagates to the
     viewport and clips with no such side effect. "clip" on body clips the same
     way without becoming a scroll container, kept as a second line of defence. */
  html { overflow-x: hidden }
  body { overflow-x: clip }
  html, body { -webkit-text-size-adjust: 100%; text-size-adjust: 100% }
  * { -webkit-tap-highlight-color: transparent; box-sizing: border-box }
  /* Long Bangla compounds and URLs must never push the layout sideways. */
  p, span, div, td, th, li { overflow-wrap: anywhere }

  .fr { font-family: 'Fraunces', Georgia, serif; font-weight: 700; letter-spacing: -0.02em; overflow-wrap: normal; hyphens: none }
  .bn .fr { font-family: 'Anek Bangla', sans-serif; font-weight: 700 }
  /* Bangla headings need leading that Latin ones do not. Painted to a canvas
     and measured pixel by pixel, Anek Bangla's actual ink runs 1.33em from the
     top of a stacked conjunct to the bottom of a hasanta — so a heading set at
     1.1 does not merely look tight, the second line's marks land 7px inside
     the first line's tails. 1.45 leaves clearance at every heading size while
     still reading as a tightly set display line. The size is set inline on
     each heading, so overriding only the leading takes !important; that is the
     purpose of the rule, not a way around specificity. Latin keeps 1.1, where
     the same measurement gives 0.88em of ink and it is right. The wordmark is
     left alone. */
  .bn h1.fr, .bn h2.fr { line-height: 1.45 !important }

  /* The small all-caps label. Bangla has no capitals, and letter-spacing pulls
     its conjuncts apart into something that reads as broken — so in Bangla the
     label keeps only its smallness and drops the typographic tricks. Done in
     CSS rather than inline styles precisely so the .bn class can override it.
     (No backticks anywhere in here — this whole block is a template literal,
     and one backtick ends the string. It has bitten this codebase before.) */
  .lbl { font-family: 'IBM Plex Mono', ui-monospace, monospace; letter-spacing: .09em; text-transform: uppercase }
  /* 9.5px works for Latin small caps and does not work for Bangla, whose
     conjuncts need the height. The size is set inline for the Latin case, so
     overriding it takes !important — which is the point of the rule, not a
     shortcut around specificity. */
  .bn .lbl { font-family: 'Anek Bangla', sans-serif; letter-spacing: 0; text-transform: none;
    font-size: 12px !important }

  .navbtn { display: inline-flex; align-items: center; gap: 5px; padding: 7px 12px; border-radius: 9px;
    border: 1px solid var(--lp-line); background: var(--lp-card); color: var(--lp-ink);
    font-size: 12.5px; font-weight: 500; text-decoration: none; cursor: pointer; font-family: inherit;
    transition: border-color .15s ease-out, filter .15s ease-out }
  .navbtn:hover { border-color: color-mix(in srgb, var(--lp-acc) 45%, transparent) }
  .navcta { background: var(--lp-grad); color: #fff; border-color: transparent; box-shadow: var(--lp-glow) }

  /* The theme button carries an icon and no text, so it needs its width set or
     it comes out narrower than it is tall. */
  #al-mode { width: 34px; padding: 0; justify-content: center }

  /* The eyebrow beside the wordmark. On a phone the logo, the wordmark, the
     eyebrow and three buttons do not fit across 375px, so the eyebrow broke
     over three lines and pushed the bar to 93px tall — a tenth of the screen,
     stuck to the top of every page. The word is already the first thing in the
     menu directly below, so on a narrow screen the bar drops it rather than
     stretching to hold it. */
  @media (max-width: 460px) { .brandtag { display: none } }

  /* A finger is not a mouse pointer. The buttons here were 28 to 34px tall,
     which is under the 44px a touch target wants, and the footer links were a
     20px-tall row of words sitting right next to each other. */
  @media (pointer: coarse) {
    .navbtn { min-height: 40px }
    #al-mode { width: 40px; min-width: 40px }
    .flink { display: inline-block; padding: 12px 0 }
    /* Fourteen menu rows stacked at 32px each are easy to mis-tap. */
    .dlink { min-height: 44px }
    /* "On this page" was a stack of 17px-tall links 6px apart: the hardest
       thing on the page to hit and the one a phone reader needs most, because
       it is how you skip to the section you came for. The gap goes so the
       taller rows do not turn the box into a screenful. */
    .toc ul { gap: 0 !important }
    .toc a { display: flex; align-items: center; min-height: 40px }
    /* The breadcrumb was a 12px-tall line of text. */
    .crumb a { display: inline-block; padding: 13px 0; margin: -13px 0 }
    /* The wordmark is the way back to the front of the manual; at 29px it was
       the shortest thing in a bar of 40px buttons. */
    .brandlink { min-height: 40px }
  }

  /* Two columns on a desktop, one on a phone. The sidebar becomes a <details>
     drawer so it needs no JavaScript to open — it works with the page half
     loaded, and on every browser. */
  .dshell { display: grid; grid-template-columns: 262px minmax(0, 1fr); gap: 40px;
    max-width: 1240px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 26px) 60px; align-items: start }
  .drail { position: sticky; top: 76px; max-height: calc(100vh - 96px); overflow-y: auto; padding-bottom: 20px }
  .drail-m { display: none }
  @media (max-width: 900px) {
    .dshell { grid-template-columns: minmax(0, 1fr); gap: 0 }
    .drail { display: none }
    .drail-m { display: block; margin-bottom: 26px }
  }

  .dgrp { font-size: 9.5px; color: var(--lp-soft); margin: 22px 0 7px }
  .dlink { display: flex; align-items: center; gap: 9px; padding: 7px 10px; border-radius: 9px;
    color: var(--lp-soft); text-decoration: none; font-size: 13.5px; line-height: 1.35;
    transition: background .14s ease-out, color .14s ease-out }
  .dlink:hover { background: var(--lp-card); color: var(--lp-ink) }
  .dlink.on { background: var(--lp-accSoft); color: var(--lp-acc); font-weight: 600 }
  .dlink.on i { color: var(--lp-acc) }
  .dlink i { font-size: 15px; flex-shrink: 0; opacity: .85 }
  .dlink.soon { opacity: .45 }

  .dsum { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 8px;
    padding: 11px 14px; border: 1px solid var(--lp-line); border-radius: 11px;
    background: var(--lp-card); font-size: 13.5px; font-weight: 600 }
  .dsum::-webkit-details-marker { display: none }
  details[open] .dsum { border-bottom-left-radius: 0; border-bottom-right-radius: 0 }
  .dsheet { border: 1px solid var(--lp-line); border-top: 0; border-radius: 0 0 11px 11px;
    padding: 8px; background: var(--lp-card) }

  .card { background: var(--lp-card); border: 1px solid var(--lp-line); border-radius: 16px }

  /* Screenshots come in pairs where a dark one has been taken. The theme boot
     script stamps data-theme on <html> before first paint, so the right one is
     showing from the very first frame — no flash of the wrong picture. */
  figure img { display: block }
  figure a { display: block; border-radius: 14px }
  .shot-d { display: none }
  [data-theme="dark"] .shot-l { display: none }
  [data-theme="dark"] .shot-d { display: block }

  /* The zoom hint earns its place only where the picture is genuinely too
     small to read. On a wide screen the screenshot is legible as it sits. */
  .shot-zoom { display: none }
  @media (max-width: 760px) { .shot-zoom { display: inline } }

  .flink { color: var(--lp-soft); text-decoration: none; font-size: 13px }
  .flink:hover { color: var(--lp-acc) }

  a:focus-visible, button:focus-visible, summary:focus-visible {
    outline: 2px solid var(--lp-acc); outline-offset: 2px }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important } }
`;

function RailLinks({ lang, slug, ui, written }) {
  return GROUPS.map((g) => {
    const items = PAGES.filter((p) => p.group === g);
    if (!items.length) return null;
    return (
      <div key={g}>
        <div className="dgrp lbl" style={{ fontSize: 9.5 }}>{ui.groups[g] || g}</div>
        {items.map((p) => {
          const soon = !written.has(p.slug);
          return (
            <a key={p.slug} href={docHref(p.slug, lang)}
              className={`dlink${p.slug === slug ? " on" : ""}${soon ? " soon" : ""}`}
              /* The slug rides along so the Bangla pages also answer to an
                 English search — plenty of owners will type "billing" even
                 while reading বিলিং. */
              data-doc-name={`${ui.names[p.slug] || p.slug} ${p.slug.replace(/-/g, " ")}`.toLowerCase()}>
              <i className={`ti ${p.icon}`} />
              <span>{ui.names[p.slug] || p.slug}</span>
            </a>
          );
        })}
      </div>
    );
  });
}

export default function DocsShell({ lang, slug, ui, written, children }) {
  const bn = lang === "bn";
  // The language button swaps to the other language on the SAME page, so a
  // reader never loses their place by switching.
  const other = bn ? docHref(slug, "en") : docHref(slug, "bn");
  const rail = <RailLinks lang={lang} slug={slug} ui={ui} written={written} />;

  return (
    <div className={bn ? "bn" : ""} style={{ background: P.paper, minHeight: "100vh", color: P.ink,
      fontFamily: bn ? "'Anek Bangla', sans-serif" : "Inter, system-ui, sans-serif" }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <nav style={{ position: "sticky", top: 0, zIndex: 5, background: `color-mix(in srgb, ${P.paper} 88%, transparent)`,
        backdropFilter: "blur(10px)", borderBottom: `1px solid ${P.line}` }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "11px clamp(16px,4vw,26px)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <a href={docHref("", lang)} className="brandlink" style={{ display: "flex", alignItems: "center", gap: 9,
            textDecoration: "none", color: P.ink, minWidth: 0 }}>
            <div style={{ width: 28, height: 28, background: "var(--lp-grad)", borderRadius: 9, flexShrink: 0,
              boxShadow: "var(--lp-glow)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="ti ti-robot" style={{ fontSize: 15, color: P.onAccent }} />
            </div>
            <span className="fr" style={{ fontSize: 19 }}>Autologic</span>
            <span className="lbl brandtag" style={{ fontSize: 9, color: P.inkSoft, paddingTop: 3 }}>{ui.brand}</span>
          </a>

          <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
            <button id="al-mode" type="button" className="navbtn" aria-label="Switch theme">
              <i id="al-mode-ic" className="ti ti-moon" style={{ fontSize: 13 }} />
            </button>
            <a href={other} className="navbtn" aria-label="Change language">
              <i className="ti ti-language" style={{ fontSize: 13 }} />{ui.langOther}
            </a>
            <a href="/dashboard?auth=signin" className="navbtn navcta">{ui.login}</a>
          </div>
        </div>
      </nav>

      <div className="dshell" style={{ paddingTop: 26 }}>
        <aside className="drail">
          <DocsSearch placeholder={ui.search} empty={ui.searchEmpty} />
          {rail}
        </aside>

        {/* Phone: the same menu, folded into a drawer. */}
        <details className="drail-m">
          <summary className="dsum"><i className="ti ti-list" style={{ fontSize: 16 }} />{ui.brand}</summary>
          {/* Search belongs in here too. It used to live only in the desktop
              sidebar, which is display:none on a phone — so a phone had no way
              to search the manual at all. */}
          <div className="dsheet">
            <DocsSearch placeholder={ui.search} empty={ui.searchEmpty} />
            {rail}
          </div>
        </details>

        {/* A <div>, not a <main>: the root layout already wraps every page in
            one, and a <main> inside a <main> is invalid HTML that makes a
            screen reader announce two "main" landmarks on the same page. */}
        <div style={{ minWidth: 0 }}>{children}</div>
      </div>

      <footer style={{ borderTop: `1px solid ${P.line}` }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "26px clamp(16px,4vw,26px) 30px" }}>
          <div style={{ display: "flex", gap: "14px 26px", flexWrap: "wrap", marginBottom: 18 }}>
            <a href={bn ? "/?lang=bn" : "/"} className="flink">{ui.home}</a>
            <a href={docHref("", lang)} className="flink">{ui.brand}</a>
            <a href="/pricing" className="flink">{bn ? "দাম" : "Pricing"}</a>
            <a href="/contact" className="flink">{ui.contact}</a>
            <a href="/privacy" className="flink">{bn ? "প্রাইভেসি পলিসি" : "Privacy Policy"}</a>
            <a href="/terms" className="flink">{bn ? "শর্তাবলি" : "Terms of Service"}</a>
          </div>
          <div className="lbl" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
            fontSize: 9.5, color: P.inkSoft, borderTop: `1px solid ${P.line}`, paddingTop: 18 }}>
            <span>{COPYRIGHT}</span>
            <span>{ADDRESS_LINE}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
