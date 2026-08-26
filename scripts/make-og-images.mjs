// Builds the pictures that show up when someone shares a getvoicium.com link in
// Messenger, WhatsApp or anywhere else that reads Open Graph tags:
//
//   public/og.png      1200x630, English
//   public/og-bn.png   1200x630, Bangla
//   public/logo.png    512x512, the brand mark on white (for search engines)
//
// Why a browser and not a drawing library: the card is set in the same faces the
// landing page uses — Fraunces for the headline, IBM Plex Mono for the small
// labels, Anek Bangla for the Bangla one. Laying real type out by hand is not
// something a few hundred lines of pixel code can do, and Chrome is already on
// this machine. next/og would have been the obvious tool, but it cannot load its
// own font on Windows (ERR_INVALID_URL on noto-sans, the same fault that breaks
// /apple-icon locally), so nothing it produced here could be checked before
// shipping.
//
// Run it with:  node scripts/make-og-images.mjs
//
// The output is committed, so this only needs re-running when the wording, the
// palette or the mark changes. Needs Chrome and a network connection (the fonts
// come from Google Fonts, exactly as the live pages load them).

import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PUBLIC = join(ROOT, "public");
const TMP = join(ROOT, ".og-tmp");

const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((p) => existsSync(p));

if (!CHROME) throw new Error("No Chrome or Edge found — cannot render the images.");

// The landing page's light palette, from THEME_CSS in src/lib/landing.js.
const C = {
  bg: "#EEF0F5",
  card: "#F7F8FC",
  ink: "#16181F",
  soft: "#5A6170",
  acc: "#D92632",
  accDim: "#B01824",
  line: "#DFE3EC",
};

// icon.svg, inline, so the mark on the card is the same mark as the favicon.
const MARK = `
<svg width="SIZE" height="SIZE" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${C.acc}"/><stop offset="1" stop-color="${C.accDim}"/>
  </linearGradient></defs>
  <rect width="64" height="64" rx="15" fill="url(#g)"/>
  <path transform="translate(5.5,5.4) scale(2.2)" d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11z" fill="#ffffff"/>
</svg>`;

// Both languages say the same thing the landing page's hero says, because that
// is the promise someone is deciding on when the card appears in their chat.
// The small print follows the same rules the landing page settled on in
// commit 7bc456d, and for the same reasons: IBM Plex Mono carries no Bengali
// letters, and letter-spacing pulls a Bangla conjunct into pieces that read as
// broken type. So Latin gets the mono microtype it is designed for, and Bangla
// gets Anek Bangla with the tracking taken off.
const COPY = {
  en: {
    font: "Fraunces:ital,opsz,wght@0,9..144,600;1,9..144,600",
    family: "'Fraunces', Georgia, serif",
    head: ["One AI chatbot for", "<em>all</em> your channels"],
    lead: "Facebook · Instagram · WhatsApp · Your website",
    foot: "3-DAY FREE TRIAL · NO CARD NEEDED",
    // Fraunces sits tight; Bangla does not. See lessons.md on Anek Bangla.
    lh: 1.06,
    size: 76,
    label: "'IBM Plex Mono', monospace",
    track: ".03em",
    footTrack: ".08em",
    // Fraunces has a drawn italic, so the accent word can lean.
    em: "font-style:italic",
  },
  bn: {
    font: "Anek+Bangla:wght@500;600;700",
    family: "'Anek Bangla', system-ui, sans-serif",
    head: ["আপনার <em>সব</em> চ্যানেলের", "জন্য একটাই এআই চ্যাটবট"],
    lead: "ফেসবুক · ইনস্টাগ্রাম · হোয়াটসঅ্যাপ · আপনার ওয়েবসাইট",
    foot: "৩ দিনের ফ্রি ট্রায়াল · কার্ড লাগবে না",
    lh: 1.45,
    size: 60,
    label: "'Anek Bangla', system-ui, sans-serif",
    track: "0",
    footTrack: "0",
    // Anek Bangla has no italic. Asking for one makes the browser shear the
    // glyphs, which leans them into the following word and closes the space
    // after it. The accent carries on colour and weight alone.
    em: "font-style:normal; font-weight:700",
  },
};

function cardHtml(lang) {
  const t = COPY[lang];
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${t.font}&family=IBM+Plex+Mono:wght@500&display=block" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box }
  body { width:1200px; height:630px; background:${C.bg}; overflow:hidden;
         font-family:${t.family}; color:${C.ink} }
  .card { position:absolute; inset:26px; background:${C.card}; border-radius:28px;
          border:1px solid ${C.line}; padding:62px 66px;
          display:flex; flex-direction:column; justify-content:space-between;
          box-shadow: 16px 16px 44px rgba(166,173,192,.5), -16px -16px 44px rgba(255,255,255,.95) }
  .brand { display:flex; align-items:center; gap:18px }
  .word { font-size:38px; font-weight:600; letter-spacing:-.02em }
  h1 { font-size:${t.size}px; line-height:${t.lh}; font-weight:600; letter-spacing:-.025em;
       max-width:960px }
  h1 em { color:${C.acc}; ${t.em} }
  .lead { font-family:${t.label}; font-size:19px; letter-spacing:${t.track};
          color:${C.soft}; margin-top:26px }
  .foot { display:flex; align-items:center; justify-content:space-between;
          font-family:${t.label}; font-size:17px; letter-spacing:${t.footTrack} }
  /* The address is Latin in both languages, so it keeps the mono face. */
  .url { font-family:'IBM Plex Mono', monospace; letter-spacing:.08em;
         color:${C.acc}; font-weight:500 }
  .tag { color:${C.soft} }
  /* The hairline crop marks the landing page uses in its corners. */
  .m { position:absolute; width:22px; height:22px; border:0 solid ${C.acc}; opacity:.5 }
  .m1 { top:12px; left:12px; border-top-width:2px; border-left-width:2px }
  .m2 { top:12px; right:12px; border-top-width:2px; border-right-width:2px }
  .m3 { bottom:12px; left:12px; border-bottom-width:2px; border-left-width:2px }
  .m4 { bottom:12px; right:12px; border-bottom-width:2px; border-right-width:2px }
</style></head><body>
  <div class="m m1"></div><div class="m m2"></div><div class="m m3"></div><div class="m m4"></div>
  <div class="card">
    <div class="brand">${MARK.replace(/SIZE/g, "62")}<div class="word">Autologic</div></div>
    <div>
      <h1>${t.head.join("<br>")}</h1>
      <div class="lead">${t.lead}</div>
    </div>
    <div class="foot"><div class="url">getvoicium.com</div><div class="tag">${t.foot}</div></div>
  </div>
</body></html>`;
}

// Square mark on white. Google's structured-data guidance wants a raster logo,
// so the SVG cannot be used directly here.
const logoHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0}
  body{width:512px;height:512px;background:#fff;display:flex;align-items:center;justify-content:center}
</style></head><body>${MARK.replace(/SIZE/g, "420")}</body></html>`;

function shoot(html, out, w, h) {
  const page = join(TMP, `${out.replace(/\.png$/, "")}.html`);
  writeFileSync(page, html, "utf8");
  execFileSync(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      `--window-size=${w},${h}`,
      // Fonts arrive over the network; without a budget Chrome shoots too early
      // and the card renders in a fallback face.
      "--virtual-time-budget=8000",
      `--screenshot=${join(PUBLIC, out)}`,
      pathToFileURL(page).href,
    ],
    { stdio: "pipe" }
  );
  console.log(`  wrote public/${out}`);
}

mkdirSync(TMP, { recursive: true });
mkdirSync(PUBLIC, { recursive: true });

shoot(cardHtml("en"), "og.png", 1200, 630);
shoot(cardHtml("bn"), "og-bn.png", 1200, 630);
shoot(logoHtml, "logo.png", 512, 512);

rmSync(TMP, { recursive: true, force: true });
console.log("done");
