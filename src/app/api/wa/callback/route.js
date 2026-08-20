export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { verifyState } from "@/lib/oauth-state.js";

const APP_ID = process.env.FB_APP_ID;
const APP_SECRET = process.env.FB_APP_SECRET;

// Same visual language as fb/callback.js's Page picker — search box, a
// bounded scrollable list, avatar-style initials, a sticky Connect button —
// so WhatsApp connect feels like the same product as Facebook connect, not a
// different, cruder flow bolted on next to it.
const STYLE = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0A0D14;color:#E7EAF2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
       min-height:100vh;display:flex;flex-direction:column;padding:20px}
  h3{font-size:17px;font-weight:600;letter-spacing:-.02em}
  .sub{font-size:12.5px;color:#98A3BA;margin:4px 0 14px}
  .search{width:100%;background:#0F1420;border:1px solid #2C374D;border-radius:8px;
          padding:9px 12px;color:#E7EAF2;font-size:13.5px;font-family:inherit;margin-bottom:10px}
  .search::placeholder{color:#5E6B85}
  .search:focus{outline:0;border-color:#FF6B75;box-shadow:0 0 0 3px rgba(255,107,117,.14)}
  form{flex:1;display:flex;flex-direction:column;min-height:0}
  .list{flex:1;overflow-y:auto;border:1px solid #1F2839;border-radius:10px;padding:6px;background:#0F1420}
  .list::-webkit-scrollbar{width:5px}
  .list::-webkit-scrollbar-thumb{background:#2C374D;border-radius:4px}
  .row{display:flex;align-items:center;gap:11px;padding:10px 11px;border-radius:8px;
       cursor:pointer;transition:background .12s}
  .row:hover{background:#151B2A}
  .row.hide{display:none}
  .row input{accent-color:#25D366;width:15px;height:15px;flex-shrink:0}
  .av{width:30px;height:30px;border-radius:8px;background:#1C2436;border:1px solid #2C374D;
      display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;
      color:#98A3BA;flex-shrink:0}
  .txt{min-width:0;overflow:hidden}
  .nm{font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .num{font-size:11.5px;color:#98A3BA;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .bar{padding-top:14px}
  button,.btn{width:100%;padding:11px;background:#25D366;color:#04170D;border:0;border-radius:8px;
         font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;text-align:center;
         text-decoration:none;display:block}
  button:hover,.btn:hover{background:#3CE07D}
  .empty{padding:22px;text-align:center;color:#5E6B85;font-size:13px;display:none}
  .card{max-width:420px;margin:auto;text-align:center}
  .icon{font-size:34px;margin-bottom:14px}
  .card p{font-size:13px;color:#98A3BA;line-height:1.6;margin:8px 0 22px}
`;

function page(bodyHtml) {
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect WhatsApp</title><style>${STYLE}</style></head><body>${bodyHtml}</body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

function errorCard(title, text) {
  return page(`<div class="card" style="margin-top:20vh">
    <div class="icon">⚠️</div><h3>${title}</h3><p>${text}</p>
  </div>`);
}

export async function GET(request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const stateToken = searchParams.get("state") || "";
    const clientId = verifyState(stateToken);
    if (!clientId) {
      return errorCard("Link expired", "This connect link has expired or is invalid. Please start again from your dashboard.");
    }

    if (!code) return errorCard("Error", "Missing authorization code.");
    if (!APP_ID || !APP_SECRET) return errorCard("Error", "Server misconfigured.");

    const redirect = `${origin}/api/wa/callback`;

    // 1. Exchange code for token
    const tokRes = await fetch(
      `https://graph.facebook.com/v24.0/oauth/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}&redirect_uri=${encodeURIComponent(redirect)}&code=${code}`
    ).then(r => r.json());
    if (tokRes.error) return errorCard("Auth failed", tokRes.error.message);

    const longRes = await fetch(
      `https://graph.facebook.com/v24.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${tokRes.access_token}`
    ).then(r => r.json());
    const userToken = longRes.access_token || tokRes.access_token;

    // 2. Try multiple endpoints to find phone numbers under any business
    // portfolio this person manages — mirrors how fb/callback lists Pages.
    const phoneNumbers = [];

    try {
      const bizRes = await fetch(
        `https://graph.facebook.com/v24.0/me/businesses?fields=id,name,whatsapp_business_accounts{id,name}&access_token=${userToken}`
      ).then(r => r.json());
      for (const biz of (bizRes.data || [])) {
        for (const waba of (biz.whatsapp_business_accounts?.data || [])) {
          const phonesRes = await fetch(
            `https://graph.facebook.com/v24.0/${waba.id}/phone_numbers?fields=id,display_phone_number,verified_name,status&access_token=${userToken}`
          ).then(r => r.json());
          for (const p of (phonesRes.data || [])) {
            phoneNumbers.push({ phoneId: p.id, displayNumber: p.display_phone_number, verifiedName: p.verified_name || biz.name, status: p.status, token: userToken });
          }
        }
      }
    } catch(e) { console.error("approach A:", e.message); }

    if (!phoneNumbers.length) {
      try {
        const directRes = await fetch(
          `https://graph.facebook.com/v24.0/me/whatsapp_business_accounts?access_token=${userToken}`
        ).then(r => r.json());
        for (const waba of (directRes.data || [])) {
          const phonesRes = await fetch(
            `https://graph.facebook.com/v24.0/${waba.id}/phone_numbers?fields=id,display_phone_number,verified_name,status&access_token=${userToken}`
          ).then(r => r.json());
          for (const p of (phonesRes.data || [])) {
            phoneNumbers.push({ phoneId: p.id, displayNumber: p.display_phone_number, verifiedName: p.verified_name || waba.name, status: p.status, token: userToken });
          }
        }
      } catch(e) { console.error("approach B:", e.message); }
    }

    if (!phoneNumbers.length) {
      try {
        const appPhones = await fetch(
          `https://graph.facebook.com/v24.0/${APP_ID}/phone_numbers?access_token=${userToken}`
        ).then(r => r.json());
        for (const p of (appPhones.data || [])) {
          phoneNumbers.push({ phoneId: p.id, displayNumber: p.display_phone_number || p.id, verifiedName: p.verified_name || "WhatsApp Number", status: p.status, token: userToken });
        }
      } catch(e) { console.error("approach C:", e.message); }
    }

    // No WABA under any portfolio this person manages — the one-click way
    // forward is Embedded Signup, never a Phone Number ID typed by hand
    // (CLAUDE.md: a client never hunts for an ID or pastes a token).
    if (!phoneNumbers.length) {
      return page(`<div class="card" style="margin-top:14vh">
        <div class="icon">💬</div>
        <h3>No WhatsApp Business number found</h3>
        <p>We checked every business portfolio on this account and didn't find one yet.
           Let's create one — it only takes a couple of minutes.</p>
        <a class="btn" href="/api/wa/embedded?client_id=${encodeURIComponent(clientId)}">Create a WhatsApp Business number</a>
      </div>`);
    }

    // Found number(s) — same picker experience as Facebook's Page list.
    const rows = phoneNumbers.map((p, i) => {
      const initials = String(p.verifiedName || "W").trim().slice(0, 1).toUpperCase();
      const safeName = String(p.verifiedName || "").replace(/</g, "&lt;");
      const safeNum = String(p.displayNumber || "").replace(/</g, "&lt;");
      return `<label class="row" data-name="${(safeName + " " + safeNum).toLowerCase()}">
        <input type="radio" name="phone" value="${i}" required>
        <span class="av">${initials}</span>
        <span class="txt"><span class="nm">${safeName}</span><br><span class="num">${safeNum}${p.status ? " · " + p.status : ""}</span></span>
      </label>`;
    }).join("");

    const encoded = encodeURIComponent(JSON.stringify(phoneNumbers));

    return page(`
      <h3>Select a WhatsApp number to connect</h3>
      <div class="sub">${phoneNumbers.length} number${phoneNumbers.length === 1 ? "" : "s"} available${phoneNumbers.length > 5 ? " — scroll to see them all" : ""}.</div>
      ${phoneNumbers.length > 5 ? `<input class="search" id="q" placeholder="Search your numbers" autocomplete="off">` : ""}
      <form method="POST" action="/api/wa/select">
        <input type="hidden" name="state" value="${stateToken}">
        <input type="hidden" name="phones" value="${encoded}">
        <div class="list" id="list">${rows}<div class="empty" id="empty">No number matches that search.</div></div>
        <div class="bar"><button type="submit">Connect</button></div>
      </form>
      <script>
        var q=document.getElementById('q');
        if(q){
          var rows=document.querySelectorAll('.row'),empty=document.getElementById('empty');
          q.addEventListener('input',function(){
            var t=q.value.trim().toLowerCase(),shown=0;
            rows.forEach(function(r){var m=!t||r.dataset.name.indexOf(t)>-1;r.classList.toggle('hide',!m);if(m)shown++;});
            empty.style.display=shown?'none':'block';
          });
        }
      </script>
    `);
  } catch (e) {
    console.error("[wa-callback]", e?.message || e);
    return errorCard("Something went wrong", "We could not finish connecting WhatsApp. Please close this window and try again from your dashboard.");
  }
}
