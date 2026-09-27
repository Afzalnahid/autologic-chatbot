// Week-1 post images for the TellMore AI Facebook Page and Instagram
// (see content-plan.md for the captions and the posting order).
//
//   node week1.mjs      → out/w1-1.png … out/w1-4.png, each 1080×1080
//
// Same brand and the same headless-Chrome route as build.mjs, so the Bangla
// renders in Hind Siliguri. Chat examples are labelled "উদাহরণ" (example): the
// shop, product and price in them are made up, not a client's data.
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = resolve("out");
mkdirSync(OUT, { recursive: true });

const FONTS = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Geist:wght@400;500;600;700;800&display=block">`;

const base = (body, extra = "") => `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
html,body{margin:0;width:1080px;height:1080px;overflow:hidden}
body{background:#FCFCFD;color:#0B0B0E;font-family:"Hind Siliguri","Geist",sans-serif;position:relative}
.wrap{position:absolute;inset:80px 84px 0 84px}
.brand{position:absolute;left:84px;right:84px;bottom:56px;display:flex;justify-content:space-between;align-items:center;
  font-family:"Geist",sans-serif;font-size:26px;color:#52525B;border-top:1px solid #E6E6EA;padding-top:24px}
.brand b{color:#7B1C3E;font-weight:700}
.eyebrow{font-size:28px;font-weight:600;color:#7B1C3E;letter-spacing:.01em}
h1{margin:14px 0 0;font-size:68px;line-height:1.18;font-weight:700;letter-spacing:-.01em}
h1 em{font-style:normal;color:#7B1C3E}
.tag{display:inline-block;border:1px solid #E6E6EA;border-radius:8px;padding:6px 14px;font-size:22px;color:#52525B;background:#fff}
.chat{margin-top:44px;background:#fff;border:1px solid #E6E6EA;border-radius:10px;padding:34px 34px 38px}
.msg{max-width:78%;font-size:31px;line-height:1.45;padding:18px 24px;border-radius:22px;margin-top:18px}
.me{background:#F1F1F4;border-bottom-left-radius:6px}
.bot{margin-left:auto;background:#7B1C3E;color:#fff;border-bottom-right-radius:6px}
.who{font-family:"Geist",sans-serif;font-size:20px;color:#71717A;margin-top:22px}
.who.r{text-align:right}
${extra}
</style></head><body>${body}
<div class="brand"><span><b>TellMore AI</b> · tellmoreai.com</span><span>৩ দিন ফ্রি ট্রায়াল · কার্ড লাগে না</span></div>
</body></html>`;

// 1 — the five questions every inbox gets
const q = ["দাম কত?", "ডেলিভারি চার্জ কত?", "এই সাইজটা আছে?", "কতদিনে পাব?", "অর্ডার করব কীভাবে?"];
const w1 = base(`<div class="wrap">
  <div class="eyebrow">প্রতিদিন, প্রতিটা পেজে</div>
  <h1>এই ৫টা প্রশ্নের উত্তর<br>আর <em>নিজে লিখতে হবে না</em></h1>
  <div class="list">${q.map((t, i) => `<div class="row"><span class="n">${"১২৩৪৫"[i]}</span><span class="t">${t}</span><span class="ok">✓ বট উত্তর দেয়</span></div>`).join("")}</div>
</div>`, `.list{margin-top:46px;display:flex;flex-direction:column;gap:16px}
.row{display:flex;align-items:center;gap:22px;background:#fff;border:1px solid #E6E6EA;border-radius:10px;padding:20px 26px}
.n{flex:none;width:52px;height:52px;border-radius:8px;background:#7B1C3E;color:#fff;display:grid;place-items:center;font-size:28px;font-weight:600}
.t{flex:1;font-size:36px;font-weight:600}
.ok{font-size:24px;color:#7B1C3E;font-weight:600}`);

// 2 — Banglish in, Bangla out
const w2 = base(`<div class="wrap">
  <div class="eyebrow">বাংলিশ? কোনো সমস্যা নেই</div>
  <h1>গ্রাহক যেভাবে লেখেন,<br><em>সেভাবেই বোঝে</em></h1>
  <div class="chat">
    <span class="tag">উদাহরণ চ্যাট</span>
    <div class="who">গ্রাহক · রাত ১১:৪০</div>
    <div class="msg me">vai eta r black ta ase? XL lagbe</div>
    <div class="who r">TellMore AI · সঙ্গে সঙ্গে</div>
    <div class="msg bot">জি, কালো রঙে XL আছে। দাম ৳৮৫০, ডেলিভারি ২–৩ দিনে। অর্ডার কনফার্ম করব?</div>
  </div>
</div>`);

// 3 — five questions about TellMore itself
const faq = [
  ["কোড জানতে হবে?", "না। নিজের Facebook দিয়ে লগইন করে পেজ বেছে নিলেই হয়।"],
  ["কোন কোন জায়গায় চলে?", "Messenger, Instagram, WhatsApp আর আপনার ওয়েবসাইট।"],
  ["বট না জানলে?", "আপনাকে জানায়, যাতে আপনি নিজে কথা বলতে পারেন।"],
  ["কোন ভাষায়?", "বাংলা, ইংরেজি আর বাংলিশ।"],
  ["খরচ কত?", "দোকান মাসে ৳২,৬৯৯ থেকে, সেবা ৳২,২৯৯ থেকে।"],
];
const w3 = base(`<div class="wrap">
  <div class="eyebrow">সবাই যা জিজ্ঞেস করেন</div>
  <h1>TellMore AI — <em>৫টা প্রশ্ন</em></h1>
  <div class="faq">${faq.map(([a, b]) => `<div class="f"><div class="qa">${a}</div><div class="an">${b}</div></div>`).join("")}</div>
</div>`, `.faq{margin-top:34px;display:grid;gap:12px}
.f{background:#fff;border:1px solid #E6E6EA;border-radius:10px;padding:14px 24px}
.qa{font-size:30px;font-weight:700;color:#7B1C3E}
.an{font-size:26px;color:#3F3F46;margin-top:2px;line-height:1.35}`);

// 4 — voice notes
const bars = Array.from({ length: 34 }, (_, i) => 14 + Math.round(34 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6))));
const w4 = base(`<div class="wrap">
  <div class="eyebrow">টাইপ করতে চান না? সমস্যা নেই</div>
  <h1>ভয়েস মেসেজ শুনে<br><em>উত্তর দেয়</em></h1>
  <div class="chat">
    <span class="tag">উদাহরণ চ্যাট</span>
    <div class="who">গ্রাহক · ভয়েস মেসেজ</div>
    <div class="msg me voice"><span class="play">▶</span><span class="wave">${bars.map((h) => `<i style="height:${h}px"></i>`).join("")}</span><span class="dur">০:০৭</span></div>
    <div class="who r">TellMore AI</div>
    <div class="msg bot">জি আপু, নীল রঙের থ্রি-পিসটা এখনো আছে। কোন সাইজটা দেব?</div>
  </div>
</div>`, `.voice{display:flex;align-items:center;gap:16px}
.play{width:46px;height:46px;border-radius:50%;background:#7B1C3E;color:#fff;display:grid;place-items:center;font-size:20px}
.wave{display:flex;align-items:center;gap:4px}.wave i{display:block;width:5px;border-radius:3px;background:#71717A}
.dur{font-family:"Geist",sans-serif;font-size:22px;color:#52525B}`);

function shoot(name, html) {
  const src = resolve(OUT, `${name}.html`);
  writeFileSync(src, html);
  execFileSync(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--window-size=1080,1080", "--virtual-time-budget=8000",
    `--screenshot=${resolve(OUT, `${name}.png`)}`, pathToFileURL(src).href,
  ], { stdio: "ignore" });
  console.log("wrote", `out/${name}.png`);
}

shoot("w1-1", w1);
shoot("w1-2", w2);
shoot("w1-3", w3);
shoot("w1-4", w4);
