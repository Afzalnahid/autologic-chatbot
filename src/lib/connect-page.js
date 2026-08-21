// The page a business owner lands on the moment a channel finishes
// connecting (Facebook, Instagram, WhatsApp, Google Calendar). It is served
// straight from the API route, so it is plain HTML — but it wears the brand
// palette (crimson on soft white, dark mode honoured), names the channel and
// the exact Page/number/account that was connected, says in plain words what
// the bot will now do, and gives the owner a button plus a slow auto-continue
// instead of vanishing after a second.
//
// Every route calls connectedPage(); failures call connectFailedPage().
import { NextResponse } from "next/server";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const CHANNELS = {
  facebook:  { label: "Facebook Page",       icon: "ti-brand-facebook",  color: "#1877F2", event: "fb_connected",   noun: "Page" },
  instagram: { label: "Instagram account",   icon: "ti-brand-instagram", color: "#E1306C", event: "ig_connected",   noun: "account" },
  whatsapp:  { label: "WhatsApp number",     icon: "ti-brand-whatsapp",  color: "#25D366", event: "wa_connected",   noun: "number" },
  gcal:      { label: "Google Calendar",     icon: "ti-brand-google",    color: "#4285F4", event: "gcal-connected", noun: "calendar" },
};

// Shared page chrome: palette + type + the card. Both themes; the owner's saved
// choice (al-theme in localStorage) wins over the OS setting, like the app.
function shell({ title, body, script = "" }) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.6.0/dist/tabler-icons.min.css">
<script>try{var t=localStorage.getItem("al-theme");if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t);}catch(e){}</script>
<style>
:root,[data-theme=light]{--bg:#EEF0F5;--card:#F5F6FA;--in:#E7EAF1;--text:#191C24;--muted:#4C5364;--dim:#8A91A3;--line:#DFE3EC;--acc:#D92632;--accd:#B01824;--ok:#0A7C5C;--warn:#8A5A07;--warnbg:rgba(154,100,8,.10);--okbg:rgba(10,124,92,.10);--shd:rgba(166,173,192,.5);--shl:rgba(255,255,255,.95);color-scheme:light}
[data-theme=dark]{--bg:#111318;--card:#191C24;--in:#15181F;--text:#EAECF2;--muted:#A9B0C0;--dim:#7C8496;--line:#252A35;--acc:#FF4D59;--accd:#E23440;--ok:#3FE0B4;--warn:#F5C25A;--warnbg:rgba(245,194,90,.12);--okbg:rgba(63,224,180,.12);--shd:rgba(0,0,0,.55);--shl:rgba(255,255,255,.05);color-scheme:dark}
*{box-sizing:border-box;margin:0;padding:0}
html,body{min-height:100%}
body{background:var(--bg);color:var(--text);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex;align-items:center;justify-content:center;padding:16px;-webkit-font-smoothing:antialiased}
.card{width:100%;max-width:460px;background:var(--card);border:1px solid var(--line);border-radius:26px;padding:clamp(22px,5vw,34px) clamp(18px,5vw,30px);box-shadow:9px 9px 20px var(--shd),-9px -9px 20px var(--shl);animation:in .35s cubic-bezier(.16,1,.3,1) both}
@keyframes in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.brand{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:700;margin-bottom:22px}
.brand i{width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,var(--acc),var(--accd));color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 8px 18px color-mix(in srgb,var(--acc) 32%,transparent)}
.hero{text-align:center;margin-bottom:20px}
.tile{position:relative;width:74px;height:74px;border-radius:24px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:36px;background:var(--card);box-shadow:4px 4px 10px var(--shd),-4px -4px 10px var(--shl)}
.tick{position:absolute;right:-6px;bottom:-6px;width:30px;height:30px;border-radius:50%;background:var(--ok);color:#fff;display:flex;align-items:center;justify-content:center;font-size:17px;border:3px solid var(--card);animation:pop .4s .15s cubic-bezier(.16,1,.3,1) both}
.tick.bad{background:var(--acc)}
@keyframes pop{0%{transform:scale(.3);opacity:0}70%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
.eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);font-weight:700;margin-bottom:6px}
h1{font-size:21px;font-weight:700;letter-spacing:-.02em;line-height:1.25}
.name{margin-top:8px;display:inline-flex;align-items:center;gap:8px;max-width:100%;padding:7px 12px;border-radius:999px;background:var(--in);box-shadow:inset 3px 3px 7px var(--shd),inset -3px -3px 7px var(--shl);font-size:13.5px;font-weight:600}
.name span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.name small{font-weight:500;color:var(--muted)}
.lead{font-size:13.5px;color:var(--muted);line-height:1.6;margin-top:12px}
.rows{margin:18px 0 6px;display:flex;flex-direction:column;gap:8px}
.row{display:flex;gap:11px;align-items:flex-start;padding:11px 13px;border-radius:14px;background:var(--in);box-shadow:inset 3px 3px 7px var(--shd),inset -3px -3px 7px var(--shl);font-size:13px;line-height:1.5}
.row i{flex-shrink:0;width:24px;height:24px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-size:14px;margin-top:1px}
.row.ok i{background:var(--okbg);color:var(--ok)}
.row.warn i{background:var(--warnbg);color:var(--warn)}
.row b{display:block;font-weight:600}
.row small{display:block;color:var(--muted);font-size:12px;margin-top:1px}
.btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:18px;padding:14px 18px;border:0;border-radius:14px;cursor:pointer;font:inherit;font-size:14.5px;font-weight:700;color:#fff;background:linear-gradient(135deg,var(--acc),var(--accd));box-shadow:0 10px 22px color-mix(in srgb,var(--acc) 32%,transparent);transition:transform .14s,filter .15s}
.btn:hover{transform:translateY(-1px);filter:brightness(1.05)}
.btn:active{transform:scale(.98)}
.foot{margin-top:12px;text-align:center;font-size:12px;color:var(--dim)}
.foot b{color:var(--muted);font-weight:600}
@media (prefers-reduced-motion:reduce){.card,.tick{animation:none}}
</style></head><body>${body}${script}</body></html>`;
}

// rows: [{ok:true|false, title, sub}] in plain language — never a permission name.
export function connectedPage({ platform, name, detail, lead, rows = [], seconds = 6 }) {
  const ch = CHANNELS[platform];
  const dest = `/dashboard?connected=${encodeURIComponent(platform)}&name=${encodeURIComponent(name || "")}#channels`;
  const body = `<main class="card" role="status" aria-live="polite">
  <div class="brand"><i class="ti ti-bolt"></i>Autologic</div>
  <div class="hero">
    <div class="tile"><i class="ti ${ch.icon}" style="color:${ch.color}"></i><span class="tick"><i class="ti ti-check"></i></span></div>
    <div class="eyebrow">Connected</div>
    <h1>${esc(ch.label)} connected</h1>
    ${name ? `<div class="name"><i class="ti ${ch.icon}" style="color:${ch.color};font-size:15px"></i><span>${esc(name)}</span>${detail ? `<small>· ${esc(detail)}</small>` : ""}</div>` : ""}
    ${lead ? `<p class="lead">${esc(lead)}</p>` : ""}
  </div>
  ${rows.length ? `<div class="rows">${rows.map((r) => `<div class="row ${r.ok ? "ok" : "warn"}"><i class="ti ${r.ok ? "ti-check" : "ti-clock"}"></i><div><b>${esc(r.title)}</b>${r.sub ? `<small>${esc(r.sub)}</small>` : ""}</div></div>`).join("")}</div>` : ""}
  <button class="btn" id="go" type="button">Go to dashboard <i class="ti ti-arrow-right"></i></button>
  <div class="foot">Continuing automatically in <b id="n">${seconds}</b>s</div>
</main>`;
  const script = `<script>
(function(){
  var ev=${JSON.stringify(ch.event)}, dest=${JSON.stringify(dest)}, n=${Number(seconds) || 6};
  var payload={type:"al-connected",platform:${JSON.stringify(platform)},name:${JSON.stringify(name || "")}};
  function tell(){ try{ if(window.opener&&window.opener!==window){ window.opener.postMessage(ev,"*"); window.opener.postMessage(payload,"*"); } }catch(e){} }
  tell();
  function go(){ if(window.opener&&window.opener!==window){ try{window.close();}catch(e){} setTimeout(function(){ location.href=dest; },300); } else { location.href=dest; } }
  document.getElementById("go").onclick=go;
  var el=document.getElementById("n");
  var t=setInterval(function(){ n--; if(el) el.textContent=n; if(n<=0){ clearInterval(t); go(); } },1000);
})();
</script>`;
  return new NextResponse(shell({ title: `${ch.label} connected — Autologic`, body, script }), { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// `title` overrides the default "… could not be connected" heading (e.g. the
// no-Page case, which is not really a failure). `eyebrow` labels the state.
// `seconds` > 0 shows a countdown and glides the owner back to the dashboard on
// its own — for cases where there is nothing to fix on this screen, only to
// return. Default 0 keeps the old behaviour: a button, no auto-redirect.
export function connectFailedPage({ platform, reason, status = 500, title, eyebrow = "Not connected", seconds = 0 }) {
  const ch = CHANNELS[platform] || { label: "Channel", icon: "ti-plug-x", color: "#8A91A3" };
  const dest = "/dashboard#channels";
  const n = Number(seconds) || 0;
  const body = `<main class="card" role="alert">
  <div class="brand"><i class="ti ti-bolt"></i>Autologic</div>
  <div class="hero">
    <div class="tile"><i class="ti ${ch.icon}" style="color:${ch.color}"></i><span class="tick bad"><i class="ti ti-x"></i></span></div>
    <div class="eyebrow">${esc(eyebrow)}</div>
    <h1>${esc(title || `${ch.label} could not be connected`)}</h1>
    <p class="lead">${esc(reason || "Something interrupted the connection. Nothing was changed — please go back to your dashboard and try again.")}</p>
  </div>
  <button class="btn" id="go" type="button">Go to dashboard <i class="ti ti-arrow-right"></i></button>
  ${n > 0 ? `<div class="foot">Taking you to your dashboard in <b id="n">${n}</b>s</div>` : ""}
</main>`;
  const script = `<script>
(function(){
  var dest=${JSON.stringify(dest)};
  function go(){ if(window.opener&&window.opener!==window){ try{window.close();}catch(e){} setTimeout(function(){ location.href=dest; },300); } else { location.href=dest; } }
  document.getElementById("go").onclick=go;
  var n=${n};
  if(n>0){ var el=document.getElementById("n"); var t=setInterval(function(){ n--; if(el) el.textContent=n; if(n<=0){ clearInterval(t); go(); } },1000); }
})();
</script>`;
  return new NextResponse(shell({ title: `${esc(title || ch.label)} — Autologic`, body, script }), { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
