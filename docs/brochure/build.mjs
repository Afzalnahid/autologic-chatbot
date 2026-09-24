// Builds the product document: one HTML page per language, then a PDF of each
// through headless Chrome.
//
//   node docs/brochure/build.mjs
//
// Everything printed comes from content.mjs and commercial.mjs; this file only
// arranges it. The screenshots are read from docs/shots (docs/brochure/shoot —
// real renders of the real screens at 2x, light theme, so they print sharp) and
// embedded as data URIs, which is what makes each PDF a single file that can be
// emailed without anything else beside it.
//
// The design follows the product's own "Obsidian" theme so the document looks
// like the thing it describes: brand maroon #7B1C3E on near-white, white cards
// with a hairline border, flat depth, tight radii. Print-specific care: page
// breaks never fall inside a screenshot or a table row, and the Bangla is set
// in Hind Siliguri, which has to be embedded or the PDF renders boxes.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { META, COVER, INTRO, HOWITWORKS, SECTIONS, EXTRA_FEATURES } from "./content.mjs";
import { PLANS_TABLE, COMPARISON, SECURITY, CONTACT } from "./commercial.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const SHOTS = join(root, "docs", "shots");
const OUT = join(root, "docs", "brochure", "out");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

mkdirSync(OUT, { recursive: true });

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const taka = (n) => "\u09F3" + Number(n).toLocaleString("en-US");

// Screenshots go in as data URIs so each PDF stands alone.
const shot = (name) => {
  const p = join(SHOTS, `${name}.png`);
  if (!existsSync(p)) throw new Error(`missing screenshot: ${p} — run the capture first`);
  return `data:image/png;base64,${readFileSync(p).toString("base64")}`;
};

const CSS = `
:root{
  --acc:#7B1C3E; --acc-deep:#5C1430; --ink:#0B0B0E; --body:#3A3A42;
  --muted:#6B6B76; --line:#E6E6EA; --bg:#FCFCFD; --card:#fff; --soft:#F7F7F9;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:var(--bg);color:var(--body);
  font-family:"Hind Siliguri","Geist","Segoe UI",system-ui,sans-serif;
  font-size:10.5pt;line-height:1.65;-webkit-font-smoothing:antialiased}
h1,h2,h3,h4{color:var(--ink);margin:0;font-weight:700;letter-spacing:-.01em;text-wrap:balance}
a{color:var(--acc);text-decoration:none}
.page{page-break-after:always;padding:26mm 18mm}
.page:last-child{page-break-after:auto}

/* cover */
.cover{background:var(--acc);color:#fff;min-height:247mm;padding:30mm 20mm;
  display:flex;flex-direction:column;justify-content:space-between}
.cover .kick{font-size:10pt;letter-spacing:.22em;text-transform:uppercase;opacity:.78}
/* Bangla is a connected script: letter-spacing pulls conjuncts apart and makes
   words look broken, and there is no upper case to transform. Both are undone
   for the Bangla edition rather than applied to a script they damage. */
html[lang="bn"] .cover .kick{letter-spacing:.04em;text-transform:none}
.cover h1{color:#fff;font-size:46pt;line-height:1.02;margin:10mm 0 6mm}
.cover .sub{font-size:14pt;line-height:1.55;max-width:135mm;opacity:.95}
/* The cover is one page exactly. Left to grow it pushed the footer down and
   opened a hole in the middle of the page. */
.cover{height:247mm}
.cover .badge{display:inline-block;border:1px solid rgba(255,255,255,.5);
  border-radius:999px;padding:5px 15px;font-size:10pt;font-weight:600}
.cover .foot{font-size:9.5pt;opacity:.8;display:flex;justify-content:space-between;align-items:flex-end;gap:10mm}

h2.sec{font-size:22pt;margin:0 0 3mm;color:var(--acc)}
.lead{font-size:11.5pt;color:var(--ink);margin:0 0 6mm}
p{margin:0 0 4mm}
.rule{height:2px;width:54px;background:var(--acc);border-radius:2px;margin:0 0 6mm}

/* feature block */
.feat{page-break-inside:avoid;margin:0}
.feat h3{font-size:19pt;margin:0 0 1.5mm}
.feat .tagline{color:var(--acc);font-weight:600;font-size:11.5pt;margin:0 0 4mm}
.feat p{font-size:11pt}
.shot{border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--card);margin:0 0 4mm}
.shot img{display:block;width:100%}
.how{background:var(--soft);border-left:3px solid var(--acc);border-radius:0 8px 8px 0;
  padding:3.5mm 5mm;font-size:10pt;margin:3mm 0 0}
.how b{color:var(--ink)}
.pill{display:inline-block;background:#F3E7EC;color:var(--acc-deep);border-radius:999px;
  padding:2px 10px;font-size:8.5pt;font-weight:600;margin:0 0 3mm}

/* grids and tables */
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:5mm}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:5mm;page-break-inside:avoid}
.card h4{font-size:11.5pt;margin:0 0 1.5mm}
.card p{margin:0;font-size:10pt;color:var(--muted)}
table{width:100%;border-collapse:collapse;font-size:9.5pt;margin:0 0 5mm}
th{background:var(--acc);color:#fff;text-align:left;padding:3mm;font-weight:600;font-size:9.5pt}
td{border-bottom:1px solid var(--line);padding:3mm;vertical-align:top}
tr{page-break-inside:avoid}
tbody tr:nth-child(even){background:var(--soft)}
td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.tblH{font-size:12pt;color:var(--ink);margin:5mm 0 2mm;font-weight:700}
ul.notes{margin:0;padding-left:5mm;font-size:9.5pt;color:var(--muted)}
ul.notes li{margin:0 0 1.5mm}
ol.steps{margin:0;padding-left:0;list-style:none;counter-reset:s}
ol.steps li{counter-increment:s;position:relative;padding-left:13mm;margin:0 0 5mm;page-break-inside:avoid}
ol.steps li::before{content:counter(s);position:absolute;left:0;top:0;width:9mm;height:9mm;
  border-radius:50%;background:var(--acc);color:#fff;display:flex;align-items:center;
  justify-content:center;font-weight:700;font-size:11pt}
ol.steps b{display:block;color:var(--ink);font-size:11.5pt}
.note{background:#FFF8E6;border:1px solid #F0E0B0;border-radius:8px;padding:4mm 5mm;font-size:9.5pt;margin:4mm 0 0}
.contact{background:var(--acc);color:#fff;border-radius:12px;padding:8mm}
.contact h2{color:#fff}
.contact .row{display:flex;gap:4mm;padding:2.5mm 0;border-bottom:1px solid rgba(255,255,255,.22);font-size:10.5pt}
.contact .row:last-child{border-bottom:none}
.contact .k{width:32mm;opacity:.8;flex-shrink:0}
.contact .v{font-weight:600}
.cta{margin-top:6mm;font-size:12pt;font-weight:700}
.toc li{margin:0 0 2mm;font-size:11pt}
.foot-note{font-size:8.5pt;color:var(--muted);margin-top:8mm;border-top:1px solid var(--line);padding-top:3mm}
`;

function featureBlock(s, lang) {
  const c = s[lang];
  const tag = c.biz ? `<div class="pill">${esc(c.biz)}</div>` : "";
  const howLabel = lang === "en" ? "How to use it" : "কীভাবে ব্যবহার করবেন";
  return `<div class="feat">
    <h3>${esc(c.h)}</h3>
    <div class="tagline">${esc(c.lead)}</div>
    ${tag}
    <div class="shot"><img src="${shot(s.shot)}" alt="${esc(c.h)}"></div>
    <p>${esc(c.body)}</p>
    <div class="how"><b>${howLabel}:</b> ${esc(c.how)}</div>
  </div>`;
}

function planRows(biz, lang) {
  return PLANS_TABLE.rows.filter((r) => r.biz === biz).map((r) => `<tr>
    <td><b>${esc(r.name)}</b></td>
    <td class="num">${taka(r.monthly)}</td>
    <td class="num">${taka(r.yearly)}</td>
    <td class="num">${taka(r.byok)}</td>
    <td class="num">${r.perMonth.toLocaleString("en-US")}</td>
  </tr>`).join("");
}

function html(lang) {
  const C = COVER[lang], I = INTRO[lang], W = HOWITWORKS[lang];
  const P = PLANS_TABLE[lang], K = COMPARISON[lang], S = SECURITY[lang], T = CONTACT[lang], X = EXTRA_FEATURES[lang];
  const dir = "ltr";

  // One feature to a page. Two fitted, but the screenshot then printed at half
  // the height and the detail in it stopped being readable — and the owner's
  // requirement was that every screenshot is clear. A page each costs paper and
  // buys legibility, which is the whole point of putting them in.
  const featurePages = SECTIONS.map((s) => `<div class="page">${featureBlock(s, lang)}</div>`).join("");

  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8">
<title>${esc(META.product)} — ${lang === "en" ? "Product Documentation" : "প্রোডাক্ট ডকুমেন্টেশন"}</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Geist:wght@400;500;600;700&display=swap">
<style>${CSS}</style></head><body>

<section class="cover">
  <div>
    <div class="kick">${esc(C.kicker)}</div>
    <h1>${esc(C.title)}</h1>
    <div class="sub">${esc(C.sub)}</div>
  </div>
  <div class="foot">
    <div><div class="badge">${esc(C.badge)}</div><div style="margin-top:5mm">${esc(C.foot)}</div></div>
    <div style="text-align:right">${esc(META.site)}<br>${esc(META.email)}<br>${esc(META.phone)}</div>
  </div>
</section>

<div class="page">
  <h2 class="sec">${esc(I.h)}</h2><div class="rule"></div>
  ${I.body.map((p) => `<p>${esc(p)}</p>`).join("")}
  <div class="grid2" style="margin-top:6mm">
    ${I.points.map(([h, b]) => `<div class="card"><h4>${esc(h)}</h4><p>${esc(b)}</p></div>`).join("")}
  </div>
  <h2 class="sec" style="margin-top:12mm">${esc(W.h)}</h2><div class="rule"></div>
  <ol class="steps">${W.steps.map(([h, b]) => `<li><b>${esc(h)}</b>${esc(b)}</li>`).join("")}</ol>
</div>

${featurePages}

<div class="page">
  <h2 class="sec">${esc(X.h)}</h2><div class="rule"></div>
  <div class="grid2">${X.items.map(([h, b]) => `<div class="card"><h4>${esc(h)}</h4><p>${esc(b)}</p></div>`).join("")}</div>

  <h2 class="sec" style="margin-top:12mm">${esc(P.h)}</h2><div class="rule"></div>
  <p class="lead">${esc(P.lead)}</p>
  <div class="tblH">${esc(P.shopH)}</div>
  <table><thead><tr>${P.cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${planRows("shop", lang)}</tbody></table>
  <div class="tblH">${esc(P.svcH)}</div>
  <table><thead><tr>${P.cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${planRows("svc", lang)}</tbody></table>
  <ul class="notes">${P.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
</div>

<div class="page">
  <h2 class="sec">${esc(K.h)}</h2><div class="rule"></div>
  <p class="lead">${esc(K.lead)}</p>
  <table><thead><tr>${K.cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>
    ${K.rows.map(([a, b, c]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td><td>${esc(c)}</td></tr>`).join("")}
  </tbody></table>
  <div class="tblH">${esc(K.src_h)}</div>
  <ul class="notes">${COMPARISON.sources.map((s) => `<li><b>${esc(s.name)}</b> (${esc(s.url)}, ${esc(s.read)}): ${esc(s[lang])}</li>`).join("")}</ul>
  <div class="note"><b>${esc(K.honest_h)}</b><ul class="notes" style="margin-top:2mm">${K.honest.map((h) => `<li>${esc(h)}</li>`).join("")}</ul></div>
</div>

<div class="page">
  <h2 class="sec">${esc(S.h)}</h2><div class="rule"></div>
  <div class="grid2">${S.items.map(([h, b]) => `<div class="card"><h4>${esc(h)}</h4><p>${esc(b)}</p></div>`).join("")}</div>

  <div class="contact" style="margin-top:12mm">
    <h2 class="sec" style="color:#fff">${esc(T.h)}</h2>
    <p style="opacity:.9;margin-bottom:5mm">${esc(T.lead)}</p>
    <div class="row"><div class="k">${esc(T.labels.company)}</div><div class="v">${esc(META.company)}</div></div>
    <div class="row"><div class="k">${esc(T.labels.product)}</div><div class="v">${esc(META.product)}</div></div>
    <div class="row"><div class="k">${esc(T.labels.email)}</div><div class="v">${esc(META.email)}</div></div>
    <div class="row"><div class="k">${esc(T.labels.phone)}</div><div class="v">${esc(META.phone)}</div></div>
    <div class="row"><div class="k">${esc(T.labels.address)}</div><div class="v">${esc(META.address)}</div></div>
    <div class="row"><div class="k">${esc(T.labels.web)}</div><div class="v">${esc(META.site)} &nbsp;·&nbsp; ${esc(META.parent)}</div></div>
    <div class="cta">${esc(T.cta)}</div>
  </div>

  <div class="foot-note">
    ${lang === "en"
      ? `Screenshots in this document are real screens of ${esc(META.product)}, shown with demonstration data (&ldquo;Nokshi Threads&rdquo;, &ldquo;Pixel Studio&rdquo;). No figure in them is a customer's result. Prices and limits are those in force on ${esc(META.docDate.en)}. © 2026 ${esc(META.product)} · ${esc(COVER.en.badge)}.`
      : `এই ডকুমেন্টের স্ক্রিনশটগুলো ${esc(META.product)}-এর সত্যিকারের পর্দা, তবে দেখানোর জন্য নমুনা তথ্য বসানো (“Nokshi Threads”, “Pixel Studio”)। এর কোনো সংখ্যাই কোনো গ্রাহকের আসল ফল নয়। দাম ও সীমা ${esc(META.docDate.bn)} তারিখ অনুযায়ী। © ২০২৬ ${esc(META.product)} · ${esc(COVER.bn.badge)}।`}
  </div>
</div>

</body></html>`;
}

for (const lang of ["en", "bn"]) {
  const htmlPath = join(OUT, `TellMore-AI-${lang}.html`);
  const pdfPath = join(OUT, `TellMore-AI-${lang === "en" ? "English" : "Bangla"}.pdf`);
  writeFileSync(htmlPath, html(lang), "utf8");
  execFileSync(CHROME, [
    "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
    "--virtual-time-budget=30000",
    `--print-to-pdf=${pdfPath}`,
    "file:///" + htmlPath.replace(/\\/g, "/"),
  ], { stdio: "ignore", timeout: 180000 });
  const kb = (readFileSync(pdfPath).length / 1024).toFixed(0);
  console.log(`${lang}: ${pdfPath}  (${kb} KB)`);
}
