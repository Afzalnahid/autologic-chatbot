import Script from "next/script";
import PublicFonts from "./public-fonts.js";
import { CASE_STUDIES, TYPE_LABEL, isPlaceholder, publishedCaseStudies } from "@/lib/case-studies.js";
import { P, CH, COPY, CONVOS, STAGES, BOARD_CSS, FLOW_CSS, REVEAL_JS, THEME_CSS } from "@/lib/landing.js";
import { BotMark } from "@/lib/brand.js";
import { pageMeta, siteJsonLd } from "@/lib/seo.js";
import { FOOTER_LINKS, solutionHref } from "@/lib/solutions/index.js";
import { COPYRIGHT, ADDRESS_SHORT } from "@/lib/company.js";
import { PLANS, PLAN_ORDER, formatMoney } from "@/lib/plans.js";
import { loadPlans } from "@/lib/plan-limits.js";

// Four facts for the strip under the features — each one true of the product
// today. The owner's Figma draft had revenue and conversion percentages and a
// store count in this place; none of those have been measured, so none are here.
const FACTS = {
  en: [["4", "Channels: Messenger, Instagram, WhatsApp, your website"], ["24/7", "Answers while you sleep"], ["2", "Languages: Bangla and English"], ["3 days", "Free trial, no card needed"]],
  bn: [["৪", "চ্যানেল: মেসেঞ্জার, ইনস্টাগ্রাম, হোয়াটসঅ্যাপ, ওয়েবসাইট"], ["২৪/৭", "আপনি ঘুমালেও উত্তর দেয়"], ["২", "ভাষা: বাংলা ও ইংরেজি"], ["৩ দিন", "ফ্রি ট্রায়াল, কার্ড লাগবে না"]],
};

// The paid packages for the pricing section, live from the database so a
// re-price in the admin panel shows here without a deploy; the code catalogue
// if the database cannot be read.
async function paidPlans() {
  try {
    const all = await loadPlans();
    const list = Object.values(all).filter((p) => p.active !== false && p.public !== false && Number(p.monthly) > 0);
    if (list.length) return list.sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0));
  } catch { /* fall through */ }
  return PLAN_ORDER.filter((id) => PLANS[id].monthly > 0).map((id) => ({ ...PLANS[id], feature_list: PLANS[id].features }));
}

// The 3-day free trial, shown as the first card of each set (owner, 2026-09-20:
// "the 3 days free trial is also a package"). Live from the database like the
// paid ones; the code catalogue if it cannot be read.
async function trialPlan() {
  try {
    const t = (await loadPlans()).trial;
    if (t && t.active !== false) return t;
  } catch { /* fall through */ }
  return PLANS.trial ? { ...PLANS.trial, feature_list: PLANS.trial.feature_list || PLANS.trial.features } : null;
}

// Google indexes the Bangla home page separately from the English one, so both
// need their own title, sentence and share picture rather than one set of tags
// written in English for both.
const META = {
  en: {
    title: "TellMore AI — AI Chatbot for Facebook, Instagram & WhatsApp",
    description:
      "TellMore AI is an AI-powered customer service chatbot platform that connects to Facebook, Instagram, WhatsApp and your own website, and books meetings into Google Calendar.",
  },
  bn: {
    title: "TellMore AI — ফেসবুক, ইনস্টাগ্রাম ও হোয়াটসঅ্যাপের জন্য এআই চ্যাটবট",
    description:
      "TellMore AI একটি এআই চ্যাটবট, যা ফেসবুক, ইনস্টাগ্রাম, হোয়াটসঅ্যাপ আর আপনার নিজের ওয়েবসাইটে যুক্ত হয়ে গ্রাহকদের বাংলা বা ইংরেজিতে উত্তর দেয়, আর মিটিং সরাসরি গুগল ক্যালেন্ডারে বুক করে।",
  },
};

export function generateMetadata({ searchParams }) {
  const lang = searchParams?.lang === "bn" ? "bn" : "en";
  return pageMeta({ ...META[lang], path: "/", lang });
}

const mono = { fontFamily: "'IBM Plex Mono', 'Plex Mono Fallback', ui-monospace, monospace", fontSize: 10.5,
  letterSpacing: "0.13em", textTransform: "uppercase" };
const wrap = { maxWidth: 1240, margin: "0 auto", padding: "0 clamp(16px, 4vw, 26px)" };

function Label({ children }) {
  // The eyebrow over each section heading — small maroon capitals, as in the
  // owner's Figma layout. "lbl" is the hook the .bn rule needs; without it a
  // Bangla label keeps the Latin font, the capitals and the tracking.
  return <div className="lbl eyebrow" style={{ ...mono, color: P.accent, marginBottom: 14, fontWeight: 500 }}>{children}</div>;
}

function Slide({ conv, c, k }) {
  const ch = CH[conv.ch];
  return (
    <div className={`al-slide s${k}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "34px 16px 11px",
        borderBottom: `1px solid ${P.line}`, background: P.paper2 }}>
        <i className={`ti ${ch.icon}`} style={{ fontSize: 16, color: P.blue }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>{ch.name}</span>
        <span className="lbl" style={{ marginLeft: "auto", ...mono, fontSize: 9, color: P.inkSoft }}>{c[conv.kind]}</span>
      </div>
      <div className="al-stack">
        <div className="al-msg b0" style={{ display: "flex", justifyContent: "flex-end" }}>
          {conv.photo ? (
            <div style={{ background: P.blue, borderRadius: 12, borderBottomRightRadius: 4, padding: 5, width: 116 }}>
              <img src={conv.photo} alt="" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 8, display: "block" }} />
              <div style={{ fontSize: 10.5, color: P.onAccent, padding: "5px 3px 1px", opacity: .9 }}>এই ড্রেসটা আপনাদের আছে?</div>
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
      <div className="lbl" style={{ padding: "9px 16px", borderTop: `1px solid ${P.line}`, ...mono, fontSize: 9,
        color: P.inkSoft, display: "flex", alignItems: "center", gap: 7, background: P.paper2 }}>
        <i className="ti ti-check" style={{ fontSize: 12, color: P.live }} />{c.notes[conv.note]}
      </div>
    </div>
  );
}

function Bub({ me, children }) {
  return (
    <div style={{ maxWidth: "84%", fontSize: 12.5, lineHeight: 1.6, padding: "8px 11px", borderRadius: 12,
      background: me ? P.fill : P.bubble, color: me ? P.onAccent : P.ink,
      borderBottomRightRadius: me ? 4 : 12, borderBottomLeftRadius: me ? 12 : 4,
      border: me ? "none" : `1px solid ${P.line}` }}>{children}</div>
  );
}


// The illustration was decoration. This is the same space doing work: a message
// arrives on one channel, the bot reads the right source, and something concrete
// comes out the other side. Four stages on one 13-second clock.
function Flow({ lang }) {
  const bn = lang === "bn";
  return (
    <div className="flow-wrap" style={{ border: `1px solid ${P.line}`, background: P.paper2,
      borderRadius: 20, overflow: "hidden", boxShadow: "var(--lp-nm-sm)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 18px 12px", borderBottom: `1px solid ${P.line}` }}>
        <span className="lbl" style={{ ...mono, fontSize: 9.5, color: P.inkSoft }}>⌗ {bn ? "যেভাবে কাজ করে" : "How it works"}</span>
        <span className="stk" style={{ ...mono, fontSize: 9.5, color: P.ink, justifyItems: "end" }}>
          {STAGES.map((s2, k) => (
            <span key={k} className={`fnum${k}`}>{String(k + 1).padStart(2, "0")}/0{STAGES.length}</span>
          ))}
        </span>
      </div>
      <div className="fprog"><i /></div>

      <div style={{ padding: "20px 18px" }}>
        <div className="flow-grid">
          <div>
            <div className="lbl" style={{ ...mono, fontSize: 8.5, color: P.inkSoft, marginBottom: 9 }}>{bn ? "গ্রাহক লেখেন" : "Customer writes"}</div>
            {STAGES.map((s2, k) => (
              <div key={k} className={`fch${k}`} style={{ display: "flex", gap: 9, padding: "10px 11px",
                background: P.paper2, border: `1px solid ${P.line}`, marginBottom: 6 }}>
                <i className={`ti ${CH[s2.ch].icon}`} style={{ fontSize: 15, color: P.blue, flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 11.5, lineHeight: 1.4, color: P.ink }}>{bn ? s2.inn : s2.inEn}</span>
              </div>
            ))}
          </div>

          <div className="flow-mid" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingTop: 22 }}>
            <div className="fwire" style={{ position: "relative", width: "100%", height: 2, background: P.line }}>
              {STAGES.map((s2, k) => (
                <span key={k} className={`fdot${k}`} style={{ position: "absolute", top: -2.5, left: 0, width: 6, height: 6,
                  borderRadius: "50%", background: P.accent }} />
              ))}
            </div>
            <div style={{ position: "relative", width: 62, height: 62 }}>
              <div className="core-arc" /><div className="core-ring" /><div className="core-ring" />
              <div style={{ position: "absolute", inset: 7, borderRadius: "50%", background: P.blue,
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BotMark size={30} color="#fff" ink="#fff" />
              </div>
            </div>
            <div style={{ textAlign: "center", width: "100%" }}>
              <div className="lbl" style={{ ...mono, fontSize: 8, color: P.inkSoft, marginBottom: 5 }}>{bn ? "যা দেখে" : "Reads"}</div>
              <div className="stk">
                {STAGES.map((s2, k) => (
                  <div key={k} className={`fsrc${k} lbl`} style={{ ...mono, fontSize: 8.5, color: P.blue, lineHeight: 1.4 }}>
                    {bn ? s2.srcBn : s2.src}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="lbl" style={{ ...mono, fontSize: 8.5, color: P.inkSoft, marginBottom: 9 }}>{bn ? "বট যা বলে" : "The bot replies"}</div>
            <div className="stk" style={{ marginBottom: 10 }}>
              {STAGES.map((s2, k) => (
                <div key={k} className={`fsay${k}`} style={{ padding: "10px 12px", background: P.fill, color: P.onAccent,
                  fontSize: 11.5, lineHeight: 1.5, borderRadius: 3, alignSelf: "start" }}>{bn ? s2.say : s2.sayEn}</div>
              ))}
            </div>
            <div className="lbl" style={{ ...mono, fontSize: 8.5, color: P.inkSoft, marginBottom: 9 }}>{bn ? "আর যা করে" : "And does"}</div>
            {STAGES.map((s2, k) => (
              <div key={k} className={`fout${k}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 11px",
                background: P.paper2, border: `1px solid ${P.line}`, borderLeft: `2px solid ${P.accent}`, marginBottom: 6 }}>
                <i className={`ti ${s2.icon}`} style={{ fontSize: 14, color: P.accent, flexShrink: 0 }} />
                <span style={{ fontSize: 11, lineHeight: 1.35, color: P.ink }}>{bn ? s2.didBn : s2.did}</span>
              </div>
            ))}
          </div>
        </div>

        {/* The caption names the feature the stage just demonstrated. */}
        <div className="stk" style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${P.line}` }}>
          {STAGES.map((s2, k) => (
            <p key={k} className={`fcap${k}`} style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: P.inkSoft,
              maxWidth: 640, alignSelf: "start" }}>{bn ? s2.capBn : s2.cap}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function Home({ searchParams }) {
  const lang = searchParams?.lang === "bn" ? "bn" : "en";
  const isProd = process.env.VERCEL_ENV === "production";
  const cases = isProd ? publishedCaseStudies() : CASE_STUDIES;
  const c = COPY[lang];
  const bn = lang === "bn";
  const other = lang === "bn" ? "/" : "/?lang=bn";
  const [plans, trial] = await Promise.all([paidPlans(), trialPlan()]);

  return (
    // The "bn" class is what every Bangla rule below hangs off. Without it the
    // headings kept .fr's Fraunces, which has no Bengali letters at all, so the
    // Bangla headline fell back to whatever Bengali font the phone happened to
    // own — a different typeface from the words underneath it.
    <div className={lang === "bn" ? "bn" : ""}
      style={{ background: P.paper, minHeight: "100vh", color: P.ink,
      fontFamily: lang === "bn" ? "'Anek Bangla', sans-serif" : "Geist, 'Inter Fallback', system-ui, sans-serif" }}>
      {/* What lets Google print "TellMore AI" above a result instead of the bare
          domain. It is data, not code — nothing runs it — so unlike the theme
          boot it works fine sitting here in the page. It still needs
          dangerouslySetInnerHTML: React escapes the text child of a script or
          style tag on the server, and the browser does not decode entities back
          inside one (lessons.md #21). */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{
        __html: JSON.stringify(siteJsonLd(lang)).replace(/</g, "\\u003c") }} />
      {/* Theme boot lives in the root layout (a script here never executes). */}
      <PublicFonts />
      <style dangerouslySetInnerHTML={{__html:`
        ${THEME_CSS}
        /* The sideways clip goes on <html>, never on <body>: "overflow-x:
           hidden" on body quietly turns body into a scroll container, and the
           sticky top bar below then sticks to a box nobody is scrolling, so it
           slid away with the page instead of staying put. On <html> the value
           propagates to the viewport and clips with no such side effect. */
        html { overflow-x: hidden }
        body { overflow-x: clip }
        html, body { -webkit-text-size-adjust: 100%; text-size-adjust: 100% }
        * { -webkit-tap-highlight-color: transparent }
        /* Long Bangla compounds and URLs must never push the layout sideways. */
        p, span, div { overflow-wrap: anywhere }

        /* Stacked states share one grid cell, so the box is always as tall as its
           tallest child. Absolute positioning with a guessed min-height was what
           made things overlap once a translation ran long. */
        /* Paused until the section is in view: motion off screen is wasted battery, and
   the loop should start from the beginning when someone arrives at it. */
        .flow-wrap *, .board-wrap * { animation-play-state: paused }
        .flow-wrap.play *, .board-wrap.play * { animation-play-state: running }

        .stk { display: grid }
        .stk > * { grid-area: 1 / 1 }

        /* A stand-in for Fraunces with its metrics, so the headline occupies the same
     space before the real face arrives and nothing below it jumps. The numbers
     were measured in Chrome on 2026-09-18 (Fraunces 600 is 77% of Georgia's
     width at the same size): a solution page shifted 0.15 without this. */
  /* Same trick for the body face: Inter is 100.6% of Arial's width at the same
     size, with taller ascenders. Without this the lead paragraph re-flowed when
     Inter arrived and pushed everything under it down (0.15 on a solution
     page, measured 2026-09-18). */
  /* And for the small mono labels and buttons: IBM Plex Mono sets 82% as wide
     as the system monospace, so the nav and the eyebrow labels changed width —
     and the nav's height with them — when it arrived. */
  @font-face { font-family: "Plex Mono Fallback"; src: local("Consolas"), local("Menlo"), local("DejaVu Sans Mono"), local("Courier New");
    size-adjust: 82%; ascent-override: 108.5%; descent-override: 26.8%; line-gap-override: 0% }
  @font-face { font-family: "Inter Fallback"; src: local("Arial"), local("Helvetica"), local("Liberation Sans");
    size-adjust: 100.6%; ascent-override: 96.4%; descent-override: 23.9%; line-gap-override: 0% }
  /* Headings: a heavy sans, as in the owner's Figma layout (2026-09-19). */
  .fr { font-family: Geist, 'Inter Fallback', system-ui, sans-serif; font-weight: 800; letter-spacing: -0.03em; overflow-wrap: normal; hyphens: none }
        .bn .fr { font-family: 'Anek Bangla', sans-serif; font-weight: 700 }
        /* Bangla headings need leading Latin ones do not. Anek Bangla's ink
           runs 1.33em from the top of a stacked conjunct to the bottom of a
           hasanta, and the display headings here are set at roughly 1.0 — so
           the second line's marks landed inside the first line's tails. The
           size is set inline on each heading, so overriding only the leading
           takes !important. Latin keeps its tight setting: the same
           measurement gives 0.88em for Fraunces. */
        .bn h1.fr, .bn h2.fr, .bn h3.fr { line-height: 1.45 !important }

        /* The small mono labels — the eyebrow above a heading, the caption on
           a mock, the words on the buttons. In English they are 8 to 11.5px
           small caps in IBM Plex Mono with the letters pushed apart, and that
           is right for Latin.

           None of it is right for Bangla. Plex Mono has no Bengali letters at
           all, so the browser silently substituted whatever Bengali font the
           reader's phone owned. Bangla has no capitals, so text-transform did
           nothing but mislead. Letter-spacing pulls a conjunct apart into
           pieces that read as broken type. And 8px is below the size at which
           a Bangla conjunct is legible at all.

           So in Bangla the label keeps only its smallness — one size, 12px,
           the same floor the manual at /docs settled on. The properties are
           set inline at every one of these places, so replacing them takes
           !important. That is what the rule is for, not a way around
           specificity. */
        .bn .lbl { font-family: 'Anek Bangla', sans-serif !important; letter-spacing: 0 !important;
          text-transform: none !important; font-size: 12px !important }
        /* Inside the flow diagram the columns are narrow and the labels sit
           under a 62px dial, so they stop one step earlier. */
        .bn .flow-wrap .lbl { font-size: 11px !important }

        /* The sheet: hairline rules and crop marks, so the page reads as a drawing. */
        .sheet { position: fixed; inset: 14px; pointer-events: none; border: 1px solid ${P.line}; z-index: 3 }
        .sheet i { position: absolute; width: 9px; height: 9px;
          border: 1px solid color-mix(in srgb, ${P.blue} 27%, transparent) }
        .sheet i:nth-child(1) { top: -5px; left: -5px } .sheet i:nth-child(2) { top: -5px; right: -5px }
        .sheet i:nth-child(3) { bottom: -5px; left: -5px } .sheet i:nth-child(4) { bottom: -5px; right: -5px }

        /* On a phone the fixed frame has no margin to live in — it just draws a
           line across whatever card is at the edge (and its crop marks land on
           the content). The drawing-sheet idea only reads at desktop widths. */
        @media (max-width: 760px) { .sheet { display: none } }

        @keyframes rise { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: none } }
        .r { animation: rise .55s cubic-bezier(.22,.61,.36,1) both }
        .al-obs { opacity: 0; transform: translateY(22px) }
        .al-obs.al-in { opacity: 1; transform: none; transition: opacity .5s ease-out, transform .65s cubic-bezier(.22,.61,.36,1) }

        .navbtn { font-family: 'IBM Plex Mono', 'Plex Mono Fallback', monospace; font-size: 10.5px; letter-spacing: .09em;
          text-transform: uppercase; text-decoration: none; color: ${P.ink}; border: 1px solid ${P.line};
          background: ${P.paper2}; border-radius: 11px; box-shadow: var(--lp-nm-sm);
          padding: 8px 11px; white-space: nowrap; line-height: 1; cursor: pointer;
          transition: all .15s ease-out }
        .navbtn:hover { border-color: color-mix(in srgb, ${P.blue} 40%, transparent); color: ${P.ink} }
        .navcta { background: var(--lp-grad); border-color: transparent; color: ${P.onAccent};
          box-shadow: var(--lp-glow) }
        .navcta:hover { filter: brightness(1.06); box-shadow: var(--lp-glow) }
        /* Phones: the row is wordmark + four controls. Nothing may be clipped
           and nothing may wrap, so at each step something gives way in order
           of importance. The red CTA is the page's one conversion action and
           is the last thing to shrink. */
        @media (max-width: 560px) {
          .navwrap { gap: 8px !important }
          .navbtns { gap: 6px !important }
          .navbtn { font-size: 9.5px; padding: 8px 9px; letter-spacing: .05em; border-radius: 10px }
          .navword { font-size: 17px !important }
          .navmark { width: 26px !important; height: 26px !important }
        }
        @media (max-width: 420px) {
          .navwrap { padding-left: 12px !important; padding-right: 12px !important }
          .navbtns { gap: 5px !important }
          .navbtn { font-size: 9px; padding: 8px 8px; letter-spacing: .03em }
          /* Log in loses its label; the icon says it. */
          .navlogin span { display: none }
          .navlogin { padding: 8px 9px }
        }
        @media (max-width: 340px) {
          .navwrap { padding-left: 8px !important; padding-right: 8px !important; gap: 5px !important }
          .navword { display: none }
          .navbtn { font-size: 8.5px; padding: 7px 7px; letter-spacing: .02em }
        }
        /* The ladder above shrinks the buttons to 8.5px on the narrowest
           phones. Latin small caps survive that; Bangla does not. The Bangla
           words are shorter than the English ones anyway (দাম against PRICING,
           লগ ইন against LOG IN), so they can afford the height. These come
           after the media queries and outrank them, so one floor covers every
           width. */
        .bn .navbtn { font-family: 'Anek Bangla', sans-serif; letter-spacing: 0; text-transform: none;
          font-size: 12px }
        @media (max-width: 420px) { .bn .navbtn { font-size: 11.5px } }
        @media (max-width: 340px) { .bn .navbtn { font-size: 11px } }

        .flink { font-family: 'IBM Plex Mono', 'Plex Mono Fallback', monospace; font-size: 10.5px; letter-spacing: .1em;
          text-transform: uppercase; color: ${P.inkSoft}; text-decoration: none; transition: color .15s ease-out }
        .bn .flink { font-family: 'Anek Bangla', sans-serif; letter-spacing: 0; text-transform: none;
          font-size: 12px }
        .flink:hover { color: ${P.ink}; text-decoration: underline; text-underline-offset: 4px }

        .btn { border-radius: 13px; transition: transform .15s ease-out, background .15s ease-out, box-shadow .2s ease-out }
        .btn:hover { transform: translateY(-2px) } .btn:active { transform: scale(.97) }
        .card { background: ${P.paper2}; border: 1px solid ${P.line}; border-radius: 18px;
          box-shadow: var(--lp-nm-sm);
          transition: transform .2s ease-out, border-color .2s ease-out, box-shadow .2s ease-out }
        .card:hover { transform: translateY(-3px);
          border-color: color-mix(in srgb, ${P.blue} 33%, transparent);
          box-shadow: 0 14px 40px color-mix(in srgb, ${P.blue} 12%, transparent) }
        a:focus-visible { outline: 2px solid ${P.accent}; outline-offset: 3px }

        /* ── The Figma layout (2026-09-19) ─────────────────────────────── */
        .navlink { font-size: 14px; font-weight: 500; color: ${P.inkSoft}; text-decoration: none; transition: color .15s ease-out }
        .navlink:hover { color: ${P.accent} }
        @media (max-width: 1080px) { .navlinks { display: none !important } }
        .pill { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: ${P.accent};
          background: ${P.blueSoft}; border: 1px solid color-mix(in srgb, ${P.accent} 22%, transparent); border-radius: 999px; padding: 6px 13px }
        .pill-dot { width: 7px; height: 7px; border-radius: 50%; background: ${P.live}; box-shadow: 0 0 0 3px color-mix(in srgb, ${P.live} 25%, transparent) }
        .btn-main { background: var(--lp-grad); color: #fff; font-weight: 700; font-size: 14.5px; padding: 14px 26px; text-decoration: none; box-shadow: var(--lp-glow) }
        .btn-ghost { border: 1px solid ${P.line}; background: ${P.paper2}; color: ${P.ink}; font-weight: 600; font-size: 14.5px; padding: 14px 22px;
          text-decoration: none; display: inline-flex; align-items: center; gap: 7px }
        .ficon { width: 44px; height: 44px; border-radius: 12px; background: ${P.blueSoft}; color: ${P.accent};
          display: flex; align-items: center; justify-content: center; font-size: 22px }
        .fact { border: 1px solid ${P.line}; border-radius: 16px; padding: 20px; text-align: center;
          background: linear-gradient(180deg, ${P.blueSoft}, transparent), ${P.paper2} }
        /* The dark band: the same near-black in both themes, a step darker in dark
           mode so it still reads as a band against the page. */
        .band { background: #121116; color: #F2EEF1 }
        [data-theme="dark"] .band { background: #0B0A0E; border-top: 1px solid ${P.line}; border-bottom: 1px solid ${P.line} }
        .band .eyebrow { color: #E08BA6 !important }
        .step { display: flex; gap: 14px; padding: 18px; border-radius: 16px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08) }
        .step-n { flex-shrink: 0; width: 32px; height: 32px; border-radius: 10px; background: #7B1C3E; color: #fff; font-size: 12.5px; font-weight: 700;
          display: flex; align-items: center; justify-content: center }
        .ptabs > input { position: absolute; opacity: 0; pointer-events: none }
        .ptab-row { display: flex; justify-content: center; gap: 4px; margin: 0 auto 26px; width: fit-content; padding: 4px;
          background: ${P.paper}; border: 1px solid ${P.line}; border-radius: 12px }
        .ptab-row label { padding: 9px 20px; border-radius: 9px; font-size: 13.5px; font-weight: 600; color: ${P.inkSoft}; cursor: pointer }
        #al-biz-shop:checked ~ .ptab-row label[for="al-biz-shop"],
        #al-biz-svc:checked ~ .ptab-row label[for="al-biz-svc"] { background: var(--lp-grad); color: #fff }
        #al-biz-shop:focus-visible ~ .ptab-row label[for="al-biz-shop"],
        #al-biz-svc:focus-visible ~ .ptab-row label[for="al-biz-svc"] { outline: 2px solid ${P.accent}; outline-offset: 2px }
        .pgrid { display: none; grid-template-columns: repeat(auto-fit, minmax(min(100%, 235px), 1fr)); gap: 16px; align-items: stretch }
        #al-biz-shop:checked ~ .p-shop, #al-biz-svc:checked ~ .p-svc { display: grid }
        .pcard { position: relative; display: flex; flex-direction: column; background: ${P.paper}; color: ${P.ink};
          border: 1px solid ${P.line}; border-radius: 20px; padding: 24px; box-shadow: var(--lp-nm-sm) }
        .pcard.trial { border-style: dashed; border-color: ${P.accent}; box-shadow: none }
        .pcard.trial .pbtn { background: transparent; color: ${P.accent}; border: 1.5px solid ${P.accent} }
        .pcard ul { flex: 1 }
        .pcard.hl { background: #7B1C3E; color: #fff; border-color: #7B1C3E; box-shadow: 0 18px 44px rgba(123,28,62,.30) }
        .pbadge { position: absolute; top: -11px; left: 50%; transform: translateX(-50%); background: #F4C95D; color: #3A2A06;
          font-size: 11px; font-weight: 700; padding: 4px 11px; border-radius: 999px; white-space: nowrap }
        .pbtn { display: block; text-align: center; text-decoration: none; font-weight: 700; font-size: 14px; padding: 13px 16px;
          background: var(--lp-grad); color: #fff }
        .pcard.hl .pbtn { background: #fff; color: #7B1C3E }
        .foot { background: #121116; color: #F2EEF1 }
        [data-theme="dark"] .foot { background: #0B0A0E; border-top: 1px solid ${P.line} }
        .foot-grid { display: grid; grid-template-columns: 1.4fr 1fr 1.2fr 1fr; gap: 28px }
        @media (max-width: 860px) { .foot-grid { grid-template-columns: 1fr 1fr } }
        @media (max-width: 480px) { .foot-grid { grid-template-columns: 1fr } }
        .foot-h { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #F2EEF1; margin-bottom: 12px }
        .foot-a { display: block; font-size: 13.5px; color: #B5ADB4; text-decoration: none; margin-bottom: 9px }
        .foot-a:hover { color: #fff }
        .bn .foot-h, .bn .pcard div { letter-spacing: 0; text-transform: none }
        @media (max-width: 900px) { .two { grid-template-columns: 1fr !important } .hide-sm { display: none } }
        @media (prefers-reduced-motion: reduce) { .r, .card, .btn { animation: none !important; transition: none !important } .al-obs { opacity: 1 !important; transform: none !important } }

        .al-phone { width: 100%; max-width: 300px; margin: 0 auto; border-radius: 38px; padding: 9px }
        .al-screen { border-radius: 30px; overflow: hidden; position: relative; height: 460px; display: block }
        .al-notch { position: absolute; top: 8px; left: 50%; transform: translateX(-50%); width: 80px; height: 18px;
          border-radius: 11px; background: #05070C; z-index: 5 }
        .al-status { display: flex; justify-content: space-between; align-items: center; padding: 11px 16px 4px;
          font-size: 10.5px; position: relative; z-index: 4 }
        .al-slide { position: absolute; inset: 0; opacity: 0; display: flex; flex-direction: column }
        .al-stack { margin-top: auto; display: flex; flex-direction: column; justify-content: flex-end; gap: 7px; padding: 10px 12px 12px; flex: 1 }
        .al-msg { opacity: 0 } .al-msgwrap { position: relative }
        .al-typing { display: inline-flex; gap: 4px; padding: 8px 12px; border-radius: 12px; background: ${P.bubble};
          border: 1px solid ${P.line}; opacity: 0; position: absolute; top: 0; left: 0 }
        .al-typing b { width: 5px; height: 5px; border-radius: 50%; background: ${P.inkSoft};
          animation: bnc 1.3s ease-in-out infinite }
        .al-typing b:nth-child(2) { animation-delay: .18s } .al-typing b:nth-child(3) { animation-delay: .36s }
        @keyframes bnc { 0%,60%,100% { opacity:.35; transform: translateY(0) } 30% { opacity:1; transform: translateY(-3px) } }
        .al-bars { display: flex; gap: 5px; margin-bottom: 12px }
        .al-bars span { flex: 1; height: 2px; background: ${P.line}; position: relative; overflow: hidden }
        .al-bars span::after { content: ""; position: absolute; inset: 0; background: ${P.accent}; transform: scaleX(0); transform-origin: left }
        .al-mono { font-variant-numeric: tabular-nums }

        .flow-grid { display: grid; grid-template-columns: 1fr 150px 1.15fr; gap: 20px; align-items: start }
        .fwire { --run: 140px }
        @media (max-width: 880px) {
          .flow-grid { grid-template-columns: 1fr; gap: 22px }
          .fwire { display: none }
          .flow-mid { flex-direction: row !important; justify-content: center; padding-top: 0 !important; gap: 16px !important }
        }
        @media (max-width: 560px) { .flow-grid { grid-template-columns: 1fr; gap: 18px }
          .flow-grid > div:nth-child(3) > div:first-child { text-align: left } }
        @media (prefers-reduced-motion: reduce) {
          [class^="fch"], [class^="fsrc"], [class^="fout"], .core-ring, .wire { animation: none !important; opacity: 1 !important }
        }
      ` + BOARD_CSS + FLOW_CSS}}/>
      {/* next/script, not a bare <script>: inline scripts rendered by a server
          component through dangerouslySetInnerHTML are inserted by React and
          never executed by the browser (innerHTML rule), so scroll-reveal, the
          film autoplay and the flow animation were all silently dead in
          production. afterInteractive runs them once React has hydrated. */}
      <Script id="al-reveal" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: REVEAL_JS }} />
      <Script id="al-film-js" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `(function(){
        function start(){
          var v = document.getElementById("al-film");
          var sec = document.getElementById("film");
          if (!v || !sec) return;

          // No file yet, or a codec the browser will not take: remove the whole
          // section rather than leaving a black rectangle on the page.
          v.addEventListener("error", function(){ sec.remove(); });
          v.addEventListener("stalled", function(){ if (!v.duration) sec.remove(); });

          // The file is attached on the first press and not before, so a
          // visitor who never watches never downloads it.
          var btn = document.getElementById("al-film-play");
          function play(){
            if (!v.currentSrc && v.dataset.src) v.src = v.dataset.src;
            if (btn) btn.style.display = "none";
            var p = v.play(); if (p && p.catch) p.catch(function(){});
          }
          if (btn) btn.addEventListener("click", play);
          v.addEventListener("play", function(){ if (btn) btn.style.display = "none"; });
          v.addEventListener("pause", function(){ if (btn && v.currentTime === 0) btn.style.display = "flex"; });
        }
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
      })();` }} />


      <Script id="al-flow-js" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `(function(){
        function start(){
          if (!("IntersectionObserver" in window)) {
            document.querySelectorAll(".flow-wrap,.board-wrap").forEach(function(el){ el.classList.add("play"); });
            return;
          }
          var io = new IntersectionObserver(function(es){
            es.forEach(function(e){
              // Restarting on re-entry means the story always begins at stage one.
              if (e.isIntersecting) { e.target.classList.add("play"); }
              else { e.target.classList.remove("play"); }
            });
          }, { threshold: 0.25 });
          document.querySelectorAll(".flow-wrap,.board-wrap").forEach(function(el){ io.observe(el); });
        }
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
      })();` }} />
      <nav style={{ borderBottom: `1px solid ${P.line}`, position: "sticky", top: 0, zIndex: 4,
        background: "color-mix(in srgb, var(--lp-bg) 88%, transparent)", WebkitBackdropFilter: "blur(12px)", backdropFilter: "blur(12px)" }}>
        <div className="navwrap" style={{ ...wrap, display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "11px clamp(16px, 4vw, 26px)", gap: 12 }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none", color: P.ink, flexShrink: 0, minWidth: 0 }}>
            <div className="navmark" style={{ width: 30, height: 30, background: "#fff", borderRadius: 9, flexShrink: 0,
              boxShadow: "0 1px 4px rgba(18,17,22,.16)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BotMark size={25} />
            </div>
            <span className="fr navword" style={{ fontSize: 18 }}>TellMore AI</span>
          </a>

          {/* The section links, as in the owner's Figma layout. Desktop only: on
              a phone the four controls beside them already fill the row. */}
          <div className="navlinks hide-sm" style={{ display: "flex", gap: 26 }}>
            <a href="#features" className="navlink">{bn ? "ফিচার" : "Features"}</a>
            <a href="#how" className="navlink">{bn ? "কীভাবে কাজ করে" : "How it works"}</a>
            <a href="#plans" className="navlink">{bn ? "দাম" : "Pricing"}</a>
            <a href="#film" className="navlink">{bn ? "ভিডিও" : "Demo"}</a>
          </div>

          <div className="navbtns" style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
            <button id="al-mode" type="button" className="navbtn" aria-label="Switch theme"
              style={{ display: "inline-flex", alignItems: "center", fontFamily: "inherit" }}>
              <i id="al-mode-ic" className="ti ti-moon" style={{ fontSize: 13 }} />
            </button>
            <a href={other} className="navbtn" aria-label="Change language"
              style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <i className="ti ti-language" style={{ fontSize: 13 }} />
              {bn ? "EN" : "বাং"}
            </a>
            <a href="/dashboard?auth=signin" className="navbtn navlogin" aria-label={bn ? "লগ ইন" : "Log in"}
              style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <i className="ti ti-user" style={{ fontSize: 13 }} />
              <span>{bn ? "লগ ইন" : "Log in"}</span>
            </a>
            <a href="/dashboard?auth=signup" className="navbtn navcta">
              {bn ? "ফ্রি ট্রায়াল" : "Start free"}
            </a>
          </div>
        </div>
      </nav>

      {/* Hero — the Figma layout: the promise on the left, the product on the
          right. The right side is the real conversation board, not a drawing. */}
      <section style={{ ...wrap, padding: "clamp(40px,7vw,80px) clamp(16px,4vw,26px) clamp(28px,4vw,44px)" }}>
        <div className="two" style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "clamp(30px,5vw,56px)", alignItems: "center" }}>
          <div>
            <div className="r pill"><span className="pill-dot" />{c.eyebrow}</div>
            <h1 className="r fr" style={{ animationDelay: ".07s", fontSize: "clamp(34px, 5.6vw, 62px)", lineHeight: 1.04, margin: "18px 0 20px" }}
              dangerouslySetInnerHTML={{ __html: c.h1.replace(/<em>|<\/em>/g, "") }} />
            <p className="r" style={{ animationDelay: ".14s", fontSize: 17, lineHeight: 1.65, color: P.inkSoft, maxWidth: 540, margin: "0 0 28px" }}>{c.lead}</p>
            <div className="r" style={{ animationDelay: ".2s", display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href="/dashboard?auth=signup" className="btn btn-main">{c.cta}</a>
              <a href="#plans" className="btn btn-ghost">{c.cta2} <i className="ti ti-arrow-right" style={{ fontSize: 15 }} /></a>
            </div>
            {/* What is true, where the Figma draft had star ratings and a store count. */}
            <div className="r" style={{ animationDelay: ".26s", marginTop: 24, display: "flex", gap: "8px 18px", flexWrap: "wrap" }}>
              {c.proof.map((t) => (
                <span key={t} style={{ fontSize: 13, color: P.inkSoft, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <i className="ti ti-circle-check" style={{ fontSize: 16, color: P.accent }} />{t}
                </span>
              ))}
            </div>
          </div>
          <div className="r" style={{ animationDelay: ".1s" }}>
            <div className="board-wrap" style={{ maxWidth: 330, margin: "0 auto", width: "100%" }}>
              <div className="al-bars"><span /><span /><span /><span /></div>
              <div className="al-phone" style={{ background: "linear-gradient(160deg, #2A2230, #121116)" }}>
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

        {/* The channels it answers on — where the Figma draft listed other
            companies' logos as "trusted by". */}
        <div style={{ marginTop: "clamp(36px,5vw,56px)", paddingTop: 22, borderTop: `1px solid ${P.line}`,
          display: "flex", alignItems: "center", justifyContent: "center", gap: "12px 30px", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: P.inkSoft }}>{bn ? "যেখানে উত্তর দেয়:" : "Answers on:"}</span>
          {Object.values(CH).map((x) => (
            <span key={x.name} style={{ fontSize: 14, fontWeight: 600, color: P.ink, display: "inline-flex", alignItems: "center", gap: 7 }}>
              <i className={`ti ${x.icon}`} style={{ fontSize: 19, color: P.inkSoft }} />{x.short}
            </span>
          ))}
        </div>
      </section>

      <section id="features" style={{ ...wrap, padding: "clamp(40px,7vw,80px) clamp(16px,4vw,26px)" }}>
        <div data-reveal="0" style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 36px" }}>
          <Label>{c.featLabel}</Label>
          <h2 className="fr" style={{ fontSize: "clamp(28px,4.2vw,42px)", lineHeight: 1.1, margin: "0 0 12px" }}>{c.featTitle}</h2>
          <p style={{ fontSize: 15.5, lineHeight: 1.65, color: P.inkSoft, margin: 0 }}>{c.convLead}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 16 }}>
          {c.features.map((f, i) => (
            <div key={f.title} className="card" data-reveal={(i % 3) * 70} style={{ padding: 26 }}>
              <div className="ficon"><i className={`ti ${f.icon}`} /></div>
              <div className="fr" style={{ fontSize: 18, margin: "16px 0 8px", lineHeight: 1.25 }}>{f.title}</div>
              <div style={{ fontSize: 14.5, lineHeight: 1.7, color: P.inkSoft }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Four numbers, every one of them true — where the Figma draft had
            revenue and conversion percentages nobody has measured. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 14, marginTop: 22 }}>
          {FACTS[lang].map(([n, t]) => (
            <div key={t} className="fact" data-reveal="0">
              <div className="fr" style={{ fontSize: 30, color: P.accent, lineHeight: 1.1 }}>{n}</div>
              <div style={{ fontSize: 13, color: P.inkSoft, marginTop: 6 }}>{t}</div>
            </div>
          ))}
        </div>
      </section>

      {/* See it in action — the dark band of the Figma layout. */}
      <section id="how" className="band">
        <div style={{ ...wrap, padding: "clamp(44px,7vw,84px) clamp(16px,4vw,26px)" }}>
          <div data-reveal="0" style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 34px" }}>
            <Label>{c.convLabel}</Label>
            <h2 className="fr" style={{ fontSize: "clamp(28px,4.2vw,42px)", lineHeight: 1.1, margin: "0 0 12px", color: "#F2EEF1" }}>{c.convTitle}</h2>
            <p style={{ fontSize: 15.5, lineHeight: 1.65, color: "#B5ADB4", margin: 0 }}>{c.lead}</p>
          </div>
          <div data-reveal="60"><Flow lang={lang} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))", gap: 14, marginTop: 26 }}>
            {STAGES.map((s2, k) => (
              <div key={k} className="step" data-reveal={(k % 4) * 60}>
                <span className="step-n">{String(k + 1).padStart(2, "0")}</span>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: "#F2EEF1", marginBottom: 5 }}>{CH[s2.ch].short} — {bn ? s2.didBn : s2.did}</div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "#B5ADB4" }}>{bn ? s2.capBn : s2.cap}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The film. The section removes itself if the file is not there, so the
          page never shows a broken player. */}
      <section id="film" style={{ background: P.paper }}>
        <div style={{ ...wrap, padding: "clamp(40px,7vw,80px) clamp(16px,4vw,26px)" }}>
          <div data-reveal="0" style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 28px" }}>
            <Label>{bn ? "৪৭ সেকেন্ডে" : "In 47 seconds"}</Label>
            <h2 className="fr" style={{ fontSize: "clamp(28px,4.2vw,42px)", lineHeight: 1.1, margin: 0 }}>
              {bn ? "পুরোটা কীভাবে কাজ করে" : "The whole thing, working"}
            </h2>
          </div>

          <div data-reveal="80" style={{ position: "relative", border: `1px solid ${P.line}`, maxWidth: 980, margin: "0 auto",
            borderRadius: 20, overflow: "hidden", background: "#000", aspectRatio: "16 / 9",
            boxShadow: "var(--lp-nm)" }}>
            {/* 3 MB and 47 seconds: a 23 KB still frame until someone presses play
                (autoplay cost 4.2 MB and a 7.8 s largest paint, 2026-09-18). */}
            <video id="al-film" playsInline preload="none" controls
              poster={bn ? "/film-bn-poster.jpg" : "/film-en-poster.jpg"}
              data-src={bn ? "/film-bn.mp4" : "/film-en.mp4"}
              style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }} />
            <button id="al-film-play" type="button" aria-label={bn ? "ভিডিও চালান" : "Play the film"}
              style={{ position: "absolute", inset: 0, margin: "auto", width: 66, height: 66, borderRadius: 33,
                border: "1px solid rgba(255,255,255,.28)", background: "rgba(18,17,22,.55)",
                WebkitBackdropFilter: "blur(10px)", backdropFilter: "blur(10px)", color: "#fff", cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center" }}>
              <i className="ti ti-player-play-filled" style={{ fontSize: 24, marginLeft: 3 }} />
            </button>
          </div>
        </div>
      </section>

      {/* Plans — read live from the database, shop and service side by side
          (the owner's two package sets). CSS-only switch: no script to fail. */}
      <section id="plans" style={{ borderTop: `1px solid ${P.line}`, background: P.paper2 }}>
        <div style={{ ...wrap, padding: "clamp(44px,7vw,84px) clamp(16px,4vw,26px)" }}>
          <div data-reveal="0" style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 26px" }}>
            <Label>{bn ? "প্যাকেজ ও দাম" : "Plans & pricing"}</Label>
            <h2 className="fr" style={{ fontSize: "clamp(28px,4.2vw,42px)", lineHeight: 1.1, margin: "0 0 12px" }}>
              {bn ? "আপনার ব্যবসার মাপে প্যাকেজ" : "A plan the size of your business"}
            </h2>
            <p style={{ fontSize: 15.5, lineHeight: 1.65, color: P.inkSoft, margin: 0 }}>
              {bn ? "৩ দিনের ফ্রি ট্রায়াল, কার্ড লাগবে না। প্রতিটা প্যাকেজে সব ফিচার — বদলায় শুধু পরিমাণ।"
                  : "A 3-day free trial, no card needed. Every plan has every feature — what changes is how much."}
            </p>
          </div>
          <div className="ptabs">
            <input type="radio" name="al-biz" id="al-biz-shop" defaultChecked />
            <input type="radio" name="al-biz" id="al-biz-svc" />
            <div className="ptab-row">
              <label htmlFor="al-biz-shop">{bn ? "দোকানের জন্য" : "For shops"}</label>
              <label htmlFor="al-biz-svc">{bn ? "সেবার জন্য" : "For services"}</label>
            </div>
            {[["ecommerce", "p-shop"], ["agency", "p-svc"]].map(([biz, cls]) => (
              <div key={biz} className={`pgrid ${cls}`}>
                {/* The free trial is a package too: its own card, its own button.
                    The paid cards are for buying, so they say so. */}
                {trial && (
                  <div className="pcard trial">
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", opacity: .8 }}>{bn ? "ফ্রি ট্রায়াল" : "Free trial"}</div>
                    <div style={{ margin: "10px 0 4px", display: "flex", alignItems: "baseline", gap: 4 }}>
                      <span className="fr" style={{ fontSize: 36 }}>{bn ? "ফ্রি" : "Free"}</span>
                      <span style={{ fontSize: 13, opacity: .75 }}>{bn ? "· ৩ দিন" : "· 3 days"}</span>
                    </div>
                    <div style={{ fontSize: 13, opacity: .8, minHeight: 38, lineHeight: 1.5 }}>{bn ? "সব ফিচার চালু, তিন দিনের জন্য। কার্ড লাগে না।" : "Every feature switched on, for three days. No card needed."}</div>
                    <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 22px", display: "grid", gap: 9 }}>
                      {(trial.feature_list || []).map((f) => (
                        <li key={f} style={{ display: "flex", gap: 8, fontSize: 13.5, lineHeight: 1.45 }}>
                          <i className="ti ti-check" style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} />{f}
                        </li>
                      ))}
                    </ul>
                    <a href="/dashboard?auth=signup" className="btn pbtn">{bn ? "ফ্রি ট্রায়াল শুরু করুন" : "Start free trial"}</a>
                  </div>
                )}
                {plans.filter((p) => p.biz === biz).map((p) => (
                  <div key={p.id} className={`pcard${p.highlight ? " hl" : ""}`}>
                    {p.highlight && <span className="pbadge">{bn ? "সবচেয়ে জনপ্রিয়" : "Most popular"}</span>}
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", opacity: .8 }}>{p.name}</div>
                    <div style={{ margin: "10px 0 4px", display: "flex", alignItems: "baseline", gap: 4 }}>
                      <span className="fr" style={{ fontSize: 36 }}>{formatMoney(p.monthly)}</span>
                      <span style={{ fontSize: 13, opacity: .75 }}>{bn ? "/মাস" : "/mo"}</span>
                    </div>
                    <div style={{ fontSize: 13, opacity: .8, minHeight: 38, lineHeight: 1.5 }}>{p.tagline}</div>
                    <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 22px", display: "grid", gap: 9 }}>
                      {(p.feature_list || []).map((f) => (
                        <li key={f} style={{ display: "flex", gap: 8, fontSize: 13.5, lineHeight: 1.45 }}>
                          <i className="ti ti-check" style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} />{f}
                        </li>
                      ))}
                    </ul>
                    {/* Same link as /pricing: signs in or up if needed, then opens
                        Billing with this package already chosen. */}
                    <a href={`/dashboard?upgrade=${encodeURIComponent(p.id)}&cycle=monthly`} className="btn pbtn">{bn ? `${p.name} কিনুন` : `Buy ${p.name}`}</a>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <p style={{ textAlign: "center", fontSize: 13, color: P.inkSoft, margin: "22px 0 0" }}>
            {bn ? "লঞ্চ দাম, ৩১ ডিসেম্বর ২০২৬ পর্যন্ত। নিজের AI কী, বছরের দাম আর পুরো তুলনা — " : "Launch prices, valid until 31 December 2026. Own-AI-key prices, yearly billing and the full comparison — "}
            <a href="/pricing" style={{ color: P.accent, fontWeight: 600 }}>{bn ? "দামের পাতায়" : "on the pricing page"}</a>
          </p>
        </div>
      </section>

      {cases.length > 0 && (
        <section id="case-studies" style={{ ...wrap, padding: "clamp(40px,7vw,80px) clamp(16px,4vw,26px)" }}>
          <div data-reveal="0" style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 30px" }}>
            <Label>{bn ? "যাঁরা ব্যবহার করছেন" : "In production"}</Label>
            <h2 className="fr" style={{ fontSize: "clamp(28px,4.2vw,42px)", lineHeight: 1.1, margin: 0 }}>
              {bn ? "যেসব ব্যবসা TellMore AI-এ চলছে" : "Businesses running on TellMore AI"}
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 290px), 1fr))",
            gap: 16 }}>
            {cases.map((cs, i) => {
              const draft = isPlaceholder(cs);
              return (
                <div key={cs.id} className="card" data-reveal={(i % 3) * 70}
                  style={{ padding: 26 }}>
                  <div style={{ ...mono, fontSize: 9, color: draft ? P.inkSoft : P.accent, marginBottom: 14 }}>
                    {TYPE_LABEL[cs.businessType] || cs.businessType}{draft ? " · DRAFT" : ""}
                  </div>
                  <div className="fr" style={{ fontSize: 22, lineHeight: 1.15, marginBottom: 14 }}>{cs.business}</div>
                  <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginBottom: 14 }}>
                    {cs.metrics.map((m) => (
                      <div key={m.label}>
                        <div className="fr" style={{ fontSize: 24, color: draft ? P.inkSoft : P.blue, lineHeight: 1.2 }}>{m.value}</div>
                        <div style={{ ...mono, fontSize: 8.5, color: P.inkSoft, marginTop: 3 }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.7, color: P.inkSoft }}>{cs.story}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* The maroon call to action of the Figma layout. */}
      <section style={{ background: "#7B1C3E", color: "#fff" }}>
        <div style={{ ...wrap, padding: "clamp(44px,7vw,78px) clamp(16px,4vw,26px)", textAlign: "center" }}>
          <h2 className="fr" style={{ fontSize: "clamp(26px,4vw,40px)", lineHeight: 1.12, margin: "0 0 12px", color: "#fff" }}>
            {bn ? "প্রতিটা গ্রাহকের উত্তর, এখনই" : "Answer every customer, starting today"}
          </h2>
          <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "rgba(255,255,255,.82)", margin: "0 auto 26px", maxWidth: 560 }}>
            {c.proof.join(" · ")}
          </p>
          <a href="/dashboard?auth=signup" className="btn" style={{ display: "inline-block", background: "#fff", color: "#7B1C3E",
            fontWeight: 700, fontSize: 14.5, padding: "14px 28px", textDecoration: "none" }}>{c.cta}</a>
        </div>
      </section>

      <footer className="foot">
        <div style={{ ...wrap, padding: "clamp(40px,6vw,64px) clamp(16px,4vw,26px) 26px" }}>
          <div className="foot-grid">
            <div>
              <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 9, textDecoration: "none", color: "#F2EEF1" }}>
                <div style={{ width: 30, height: 30, background: "#fff", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <BotMark size={25} />
                </div>
                <span className="fr" style={{ fontSize: 18 }}>TellMore AI</span>
              </a>
              <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "#B5ADB4", margin: "14px 0 0", maxWidth: 300 }}>{c.lead}</p>
            </div>
            <div>
              <div className="foot-h">{bn ? "পণ্য" : "Product"}</div>
              <a href="#features" className="foot-a">{bn ? "ফিচার" : "Features"}</a>
              <a href="/pricing" className="foot-a">{bn ? "দাম" : "Pricing"}</a>
              <a href="#film" className="foot-a">{bn ? "ভিডিও" : "Demo"}</a>
              <a href="/google-calendar" className="foot-a">Google Calendar</a>
            </div>
            {/* The solution pages, linked from every page: a reader finds the one
                that matches what they came for, and a crawler finds all of them. */}
            <div>
              <div className="foot-h">{bn ? "সমাধান" : "Solutions"}</div>
              {FOOTER_LINKS[bn ? "bn" : "en"].map(([slug, label]) => (
                <a key={slug} href={solutionHref(slug, bn ? "bn" : "en")} className="foot-a">{label}</a>
              ))}
            </div>
            {/* Not decoration: Meta's review requires the privacy and terms URLs
                to be reachable, and dropping them once nearly cost a submission. */}
            <div>
              <div className="foot-h">{bn ? "প্রতিষ্ঠান" : "Company"}</div>
              <a href="/contact" className="foot-a">{bn ? "যোগাযোগ" : "Contact"}</a>
              <a href="/privacy" className="foot-a">{bn ? "প্রাইভেসি পলিসি" : "Privacy Policy"}</a>
              <a href="/terms" className="foot-a">{bn ? "শর্তাবলি" : "Terms of Service"}</a>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, fontSize: 12.5,
            color: "#857D86", borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: 18, marginTop: 34 }}>
            <span>{COPYRIGHT}</span>
            <span>{ADDRESS_SHORT}</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
