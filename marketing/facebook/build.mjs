// The Facebook Page's profile picture and cover photo, drawn from the same
// vector mark the Android app icon uses (mobile/scripts/gen-assets.mjs), so
// the Page, the app and the website show one logo, not three.
//
//   node build.mjs      → profile.png (1080×1080) and cover.png (1640×624)
//
// Rendered through headless Chrome so the Bangla line gets a real Bangla
// font (Hind Siliguri) rather than whatever the OS falls back to.
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = resolve("out");
mkdirSync(OUT, { recursive: true });

const MAROON = "#7B1C3E", MAROON_DEEP = "#5C1430", FIELD_FROM = "#8A2348", ACCENT = "#C04A72";

const mark = (color, ink) =>
  `<path fill="${color}" d="M330 522V517A115 115 0 0 1 445 402H580A115 115 0 0 1 695 517V522H632.6A74 74 0 0 0 559 456H466A74 74 0 0 0 392.4 522Z"/>` +
  `<path fill="${color}" d="M330 538V545A115 115 0 0 0 375 636V674L446 660H580A115 115 0 0 0 695 545V538H632.6A74 74 0 0 1 559 604H466A74 74 0 0 1 392.4 538Z"/>` +
  `<path fill="${color}" d="M322 458A47 67 0 0 0 322 592Z"/>` +
  `<path fill="${color}" d="M703 458A47 67 0 0 1 703 592Z"/>` +
  `<rect x="510" y="362" width="4" height="42" fill="${ink}"/>` +
  `<circle cx="512" cy="350" r="14" fill="${ink}"/>` +
  `<path d="M424 514Q447 481 470 514M554 514Q577 481 600 514" stroke="${ink}" stroke-width="13" stroke-linecap="round" fill="none"/>`;

const FONTS = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@500;600;700&family=Geist:wght@400;500;600;700;800&display=block">`;

// Facebook crops the profile picture to a circle, so the mark sits inside the
// middle ~68%: a 700-unit window centred on the mark (512, 505).
const profile = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:1080px;height:1080px;overflow:hidden}
body{background:linear-gradient(135deg,${FIELD_FROM},${MAROON_DEEP})}
svg{display:block}
</style></head><body>
<svg width="1080" height="1080" viewBox="162 155 700 700">${mark("#fff", "#fff")}</svg>
</body></html>`;

// The cover. On a phone Facebook shows only the middle ~1110 px of the 1640,
// and the profile picture overlaps the bottom edge, so everything that must be
// read sits in the central band and above the bottom 90 px.
const channels = ["Messenger", "Instagram", "WhatsApp", "Website"];
const cover = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
html,body{margin:0;width:1640px;height:624px;overflow:hidden}
body{background:#0B0B0E;font-family:"Geist","Segoe UI",system-ui,sans-serif;color:#F2F2F5;position:relative}
.glow{position:absolute;inset:0;background:
  radial-gradient(600px 380px at 78% 30%, rgba(192,74,114,.30), transparent 70%),
  radial-gradient(520px 340px at 18% 90%, rgba(123,28,62,.35), transparent 70%)}
.grid{position:absolute;inset:0;opacity:.35;background-image:
  linear-gradient(#26262D 1px,transparent 1px),linear-gradient(90deg,#26262D 1px,transparent 1px);
  background-size:48px 48px;mask-image:radial-gradient(ellipse at center,#000 30%,transparent 75%)}
.wrap{position:absolute;left:300px;right:300px;top:64px;display:flex;align-items:center;gap:56px}
.tile{flex:none;width:210px;height:210px;border-radius:48px;background:linear-gradient(135deg,${FIELD_FROM},${MAROON_DEEP});
  box-shadow:0 30px 70px rgba(123,28,62,.45), inset 0 0 0 1px rgba(255,255,255,.08)}
.tile svg{display:block}
.eyebrow{font-size:19px;letter-spacing:.14em;text-transform:uppercase;color:${ACCENT};font-weight:600}
h1{margin:14px 0 0;font-size:62px;line-height:1.04;font-weight:800;letter-spacing:-.025em}
h1 em{font-style:normal;color:${ACCENT}}
.bn{margin-top:16px;font-family:"Hind Siliguri",sans-serif;font-size:27px;font-weight:600;color:#D4D4D8;line-height:1.45}
.chips{display:flex;gap:10px;margin-top:22px;flex-wrap:wrap}
.chip{border:1px solid #33333B;background:#121216;border-radius:8px;padding:8px 14px;font-size:18px;font-weight:500;color:#E4E4E7}
.foot{position:absolute;left:300px;right:300px;top:452px;display:flex;justify-content:space-between;align-items:center;
  border-top:1px solid #26262D;padding-top:18px;font-size:20px;color:#A1A1AA}
.foot b{color:#F2F2F5;font-weight:700;font-size:24px}
.trial{background:${MAROON};color:#fff;border-radius:8px;padding:10px 18px;font-weight:600;font-size:19px}
</style></head><body><div class="glow"></div><div class="grid"></div>
<div class="wrap">
  <div class="tile"><svg width="210" height="210" viewBox="152 145 720 720">${mark("#fff", "#fff")}</svg></div>
  <div>
    <div class="eyebrow">TellMore AI · AI chatbot for Bangladesh</div>
    <h1>One AI chatbot for <em>all</em><br>your customer channels</h1>
    <div class="bn">বাংলা, ইংরেজি ও বাংলিশে — দিনরাত ২৪ ঘণ্টা গ্রাহকের উত্তর দেয়</div>
    <div class="chips">${channels.map((c) => `<span class="chip">${c}</span>`).join("")}</div>
  </div>
</div>
<div class="foot"><span><b>tellmoreai.com</b> &nbsp;·&nbsp; An Autolinium product</span><span class="trial">3-day free trial · no card needed</span></div>
</body></html>`;

function shoot(name, html, w, h) {
  const src = resolve(OUT, `${name}.html`);
  writeFileSync(src, html);
  execFileSync(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    `--window-size=${w},${h}`, "--virtual-time-budget=8000",
    `--screenshot=${resolve(OUT, `${name}.png`)}`, pathToFileURL(src).href,
  ], { stdio: "ignore" });
  console.log("wrote", `out/${name}.png`);
}

shoot("profile", profile, 1080, 1080);
shoot("cover", cover, 1640, 624);
