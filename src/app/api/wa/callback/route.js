export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { verifyState } from "@/lib/oauth-state.js";
import { markSvg } from "@/lib/brand-mark.js";
import { readSignup, sharedWabaIds, choosePhone } from "@/lib/wa-signup.js";
import { completeWhatsApp, findWabaFor } from "@/lib/wa-connect.js";
import { encryptSecret } from "@/lib/crypt.js";
import { connectedPage, connectFailedPage } from "@/lib/connect-page.js";

const APP_ID = process.env.FB_APP_ID;
const APP_SECRET = process.env.FB_APP_SECRET;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Same brand tokens and neumorphic language as src/lib/connect-page.js (the
// "connected" pages) — maroon #7B1C3E on soft white, a lifted #C04A72 in dark mode, honouring
// the owner's saved al-theme. This page used to hardcode a generic dark-blue
// Meta-popup palette; that broke CLAUDE.md's "never hard-code a brand colour"
// rule and looked like a different product mid-flow.
const STYLE = `
:root,[data-theme=light]{--bg:#F7F5F7;--card:#FFFFFF;--in:#F3EEF1;--text:#121116;--muted:#56505A;--dim:#8E8792;--line:#ECE6EA;--acc:#7B1C3E;--accd:#5C1430;--ok:#0A7C5C;--shd:rgba(18,17,22,.07);--shl:rgba(255,255,255,0);color-scheme:light}
[data-theme=dark]{--bg:#121116;--card:#1B1920;--in:#16141B;--text:#F2EEF1;--muted:#B5ADB4;--dim:#857D86;--line:#2A2630;--acc:#C04A72;--accd:#7B1C3E;--ok:#3FE0B4;--shd:rgba(0,0,0,.45);--shl:rgba(255,255,255,0);color-scheme:dark}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;-webkit-font-smoothing:antialiased}
.card{width:100%;max-width:460px;background:var(--card);border:1px solid var(--line);border-radius:26px;padding:clamp(20px,5vw,30px);box-shadow:9px 9px 20px var(--shd),-9px -9px 20px var(--shl)}
.brand{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:700;margin-bottom:18px}
.brand i{width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,var(--acc),var(--accd));color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:14px}
h3{font-size:17px;font-weight:700;letter-spacing:-.02em}
.sub{font-size:12.5px;color:var(--muted);margin:5px 0 14px;line-height:1.55}
.search{width:100%;background:var(--in);border:1px solid var(--line);border-radius:12px;box-shadow:inset 2px 2px 5px var(--shd),inset -2px -2px 5px var(--shl);padding:10px 13px;color:var(--text);font-size:13.5px;font-family:inherit;margin-bottom:10px}
.search::placeholder{color:var(--dim)}
.search:focus{outline:0;border-color:var(--acc)}
form{display:flex;flex-direction:column}
.list{max-height:46vh;overflow-y:auto;border:1px solid var(--line);border-radius:16px;padding:6px;background:var(--in)}
.list::-webkit-scrollbar{width:5px}
.list::-webkit-scrollbar-thumb{background:var(--line);border-radius:4px}
.row{display:flex;align-items:center;gap:11px;padding:11px;border-radius:12px;cursor:pointer;transition:background .12s}
.row:hover{background:var(--card)}
.row.hide{display:none}
.row input{accent-color:var(--acc);width:15px;height:15px;flex-shrink:0}
.av{width:32px;height:32px;border-radius:10px;background:var(--card);box-shadow:2px 2px 5px var(--shd),-2px -2px 5px var(--shl);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--muted);flex-shrink:0}
.txt{min-width:0;overflow:hidden}
.nm{font-size:13.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.num{font-size:11.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar{padding-top:14px}
button,.btn{width:100%;padding:13px 18px;background:linear-gradient(135deg,var(--acc),var(--accd));color:#fff;border:0;border-radius:14px;font-size:14.5px;font-weight:700;font-family:inherit;cursor:pointer;text-align:center;text-decoration:none;display:block;box-shadow:0 10px 22px color-mix(in srgb,var(--acc) 32%,transparent);transition:transform .14s,filter .15s}
button:hover,.btn:hover{transform:translateY(-1px);filter:brightness(1.05)}
.empty{padding:20px;text-align:center;color:var(--dim);font-size:13px;display:none}
.hero{text-align:center}
.tile{width:64px;height:64px;border-radius:20px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;font-size:30px;background:var(--in);box-shadow:inset 3px 3px 7px var(--shd),inset -3px -3px 7px var(--shl)}
.lead{font-size:13px;color:var(--muted);line-height:1.6;margin-top:6px}
details{margin-top:22px;padding-top:20px;border-top:1px solid var(--line)}
summary{cursor:pointer;font-weight:600;font-size:13px;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px}
summary::-webkit-details-marker{display:none}
summary .chev{color:var(--dim);transition:transform .15s;font-size:12px}
details[open] summary .chev{transform:rotate(180deg)}
.steps{margin:14px 0 16px 18px;padding:0;color:var(--muted);font-size:12.5px;line-height:1.95}
.steps b{color:var(--text)}
.steps .perm{display:block;margin-top:2px;font-size:11.5px;color:var(--dim)}
.btn2{background:var(--in);color:var(--text);box-shadow:inset 2px 2px 5px var(--shd),inset -2px -2px 5px var(--shl);font-weight:600}
`;

function page(bodyHtml, title = "Connect WhatsApp") {
  return new NextResponse(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.6.0/dist/tabler-icons.min.css">
<script>try{var t=localStorage.getItem("al-theme");if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t);}catch(e){}</script>
<style>${STYLE}</style></head><body>${bodyHtml}</body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

function errorCard(title, text) {
  return page(`<main class="card">
    <div class="brand">${markSvg({ size: 26, tile: true, style: "border-radius:8px;box-shadow:0 1px 4px rgba(22,24,31,.16)" })}TellMore AI</div>
    <div class="hero"><div class="tile">⚠️</div><h3>${esc(title)}</h3><p class="lead">${esc(text)}</p></div>
  </main>`);
}

const GRAPH = "https://graph.facebook.com/v24.0";

// Finishes a same-tab Embedded Signup from the code alone: exchange it for the
// business token, read which WhatsApp account the signup shared with us from the
// token's granular scopes, pick its number, and connect it. The owner lands on
// the "connected" page, which returns them to the dashboard by itself.
async function finishSignup({ clientId, code, redirect, searchParams }) {
  const fail = (reason, title) => connectFailedPage({ platform: "whatsapp", reason, title, status: 400 });
  if (!code) {
    // Meta sends error=access_denied when the owner closes or cancels its window.
    return fail("Setup was cancelled in Meta's window before it finished. Nothing was changed — start again from Channels when you're ready.", "WhatsApp not connected");
  }
  if (!APP_ID || !APP_SECRET) return fail("The server is not configured for WhatsApp. Please contact support.");

  const tok = await fetch(
    `${GRAPH}/oauth/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}&redirect_uri=${encodeURIComponent(redirect)}&code=${encodeURIComponent(code)}`
  ).then(r => r.json()).catch(e => ({ error: { message: e.message } }));
  if (tok.error || !tok.access_token) {
    console.error("[wa-signup] token exchange failed:", JSON.stringify(tok.error || tok));
    return fail("Meta did not confirm the setup. Please start again from Channels.");
  }
  const token = tok.access_token;

  const dbg = await fetch(
    `${GRAPH}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${APP_ID}|${APP_SECRET}`
  ).then(r => r.json()).catch(e => ({ error: { message: e.message } }));
  const wabaIds = sharedWabaIds(dbg.data);
  console.log(`[wa-signup] client ${clientId}: ${wabaIds.length} WhatsApp account(s) shared`, wabaIds.join(","));
  if (!wabaIds.length) {
    console.error("[wa-signup] no WhatsApp account in the token scopes:", JSON.stringify(dbg.error || dbg.data?.scopes || dbg).slice(0, 300));
    return fail("Meta finished, but did not share a WhatsApp account with us. Start again from Channels and choose your WhatsApp account in Meta's window.");
  }

  // Newest-shared first: a fresh signup is the last account Meta listed.
  let picked = null;
  for (const wabaId of [...wabaIds].reverse()) {
    const ph = await fetch(
      `${GRAPH}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,code_verification_status&access_token=${encodeURIComponent(token)}`
    ).then(r => r.json()).catch(e => ({ error: { message: e.message } }));
    if (ph.error) console.error("[wa-signup] phone_numbers", wabaId, ph.error.message);
    const phone = choosePhone(ph.data);
    if (phone) { picked = { wabaId, phoneId: phone.id }; break; }
  }
  if (!picked) {
    return fail("Your WhatsApp account was created, but it has no phone number yet. Start again from Channels, pick the same account and verify your number with the code Meta sends.", "Add your phone number");
  }

  const res = await completeWhatsApp({ clientId, token, wabaId: picked.wabaId, phoneId: picked.phoneId });
  if (res.error) return connectFailedPage({ platform: "whatsapp", reason: res.error, status: res.status || 500 });
  console.log(`[wa-signup] client ${clientId} connected phone ${picked.phoneId}`);
  return connectedPage({ platform: "whatsapp", name: res.name, detail: res.number, rows: [
    { ok: true, title: "WhatsApp replies are live", sub: "TellMore AI answers every message this number receives, 24/7." },
    { ok: true, title: "Broadcasts and follow-ups ready", sub: "Reach people who messaged you in the last 24 hours from the Broadcast tab." },
  ] });
}

export async function GET(request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const stateToken = searchParams.get("state") || "";
    // A signup can take a while (business details, then an SMS code), so its
    // state is accepted for 2 hours; the login flow keeps the usual 30 minutes.
    const { clientId: cid, signup } = readSignup(verifyState(stateToken, 2 * 60 * 60 * 1000));
    const clientId = signup ? cid : verifyState(stateToken);
    if (!clientId) {
      return errorCard("Link expired", "This connect link has expired or is invalid. Please start again from your dashboard.");
    }

    const redirect = `${origin}/api/wa/callback`;

    // Embedded Signup came back to this same tab: finish it here, on the server.
    if (signup) return finishSignup({ clientId, code, redirect, searchParams });

    if (!code) return errorCard("Error", "Missing authorization code.");
    if (!APP_ID || !APP_SECRET) return errorCard("Error", "Server misconfigured.");

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
            phoneNumbers.push({ phoneId: p.id, wabaId: waba.id, displayNumber: p.display_phone_number, verifiedName: p.verified_name || biz.name, status: p.status, token: userToken });
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
            phoneNumbers.push({ phoneId: p.id, wabaId: waba.id, displayNumber: p.display_phone_number, verifiedName: p.verified_name || waba.name, status: p.status, token: userToken });
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

    // No WABA visible under any portfolio this person manages. Two real
    // causes, so two real paths — never a Phone Number ID typed by hand
    // (CLAUDE.md: a client never hunts for an ID or pastes a token):
    //  1. They genuinely have no WhatsApp Business number yet → Embedded
    //     Signup creates one.
    //  2. They DO have one, but it was never shared with our Business
    //     Portfolio (id 1214039840198586). Meta never lets a third-party
    //     app see a business asset just because the OAuth caller owns it —
    //     the owner has to explicitly Assign Partner access first, in
    //     WhatsApp Manager. No code path can skip this; it is Meta's own
    //     security boundary, not a bug. Instructions below use the numeric
    //     Business ID, not a name: the app is named "AutoLogic" but the
    //     Business Portfolio's legal name is different ("NORAY AFZAL
    //     NAHID"), and a client searching by name could pick a wrong
    //     match — the ID is unambiguous either way. The exact task
    //     permissions to grant (Messages + Phone numbers view-only) are
    //     spelled out too, so nobody has to guess or ask.
    //     Tested live 2026-08-20: with 0 WABAs shared, both this discovery
    //     AND Embedded Signup's own "use existing" picker come up empty —
    //     Embedded Signup only ever offers "create new" until the sharing
    //     step happens.
    if (!phoneNumbers.length) {
      return page(`<main class="card">
        <div class="brand">${markSvg({ size: 26, tile: true, style: "border-radius:8px;box-shadow:0 1px 4px rgba(22,24,31,.16)" })}TellMore AI</div>
        <div class="hero">
          <div class="tile">💬</div>
          <h3>No WhatsApp Business number found</h3>
          <p class="lead">We checked every business portfolio on this account and didn't find one shared with us yet.</p>
        </div>
        <a class="btn" href="/api/wa/embedded?client_id=${encodeURIComponent(clientId)}">Create a new WhatsApp Business number</a>
        <details>
          <summary>Already have a WhatsApp Business number? <i class="chev">▾</i></summary>
          <p style="font-size:12.5px;color:var(--muted);margin-top:10px">Share it with us first — takes under a minute, one time only:</p>
          <ol class="steps">
            <li>Open <b>business.facebook.com/settings/whatsapp-business-accounts</b></li>
            <li>Select your WhatsApp account → <b>Assign partner</b></li>
            <li>Search by <b>Partner Business ID</b> and enter <b>1214039840198586</b> — this finds us exactly, even if the name shown differs</li>
            <li>Under Partial access, toggle ON just <b>Messages</b> and <b>Phone numbers (view only)</b>
              <span class="perm">Leave message templates, phone number management and "Everything" off — the bot never uses them</span>
            </li>
            <li>Confirm access</li>
          </ol>
          <a class="btn btn2" href="/api/wa/login?client_id=${encodeURIComponent(clientId)}">I've shared it — check again</a>
        </details>
      </main>`);
    }

    // Found number(s) — same picker experience as Facebook's Page list.
    const rows = phoneNumbers.map((p, i) => {
      const initials = String(p.verifiedName || "W").trim().slice(0, 1).toUpperCase();
      const safeName = esc(p.verifiedName || "");
      const safeNum = esc(p.displayNumber || "");
      return `<label class="row" data-name="${(safeName + " " + safeNum).toLowerCase()}">
        <input type="radio" name="phone" value="${i}" required>
        <span class="av">${initials}</span>
        <span class="txt"><span class="nm">${safeName}</span><br><span class="num">${safeNum}${p.status ? " · " + esc(p.status) : ""}</span></span>
      </label>`;
    }).join("");

    // Exactly one number: nothing to choose, so connect it now — one click, the
    // same finishing step as the signup (completeWhatsApp).
    if (phoneNumbers.length === 1) {
      const only = phoneNumbers[0];
      const res = await completeWhatsApp({ clientId, token: only.token, wabaId: only.wabaId || await findWabaFor(only.phoneId, only.token), phoneId: only.phoneId });
      if (res.error) return connectFailedPage({ platform: "whatsapp", reason: res.error, status: res.status || 500 });
      return connectedPage({ platform: "whatsapp", name: res.name, detail: res.number, rows: [
        { ok: true, title: "WhatsApp replies are live", sub: "TellMore AI answers every message this number receives, 24/7." },
        { ok: true, title: "Broadcasts and follow-ups ready", sub: "Reach people who messaged you in the last 24 hours from the Broadcast tab." },
      ] });
    }

    // The list goes to the browser SEALED (AES-GCM, bound to this client): it
    // carries the access token, which no page may ever see, and the seal stops a
    // tampered form from connecting a number that was not offered.
    const encoded = esc(encryptSecret(JSON.stringify({ clientId, phones: phoneNumbers })));

    return page(`<main class="card">
      <div class="brand">${markSvg({ size: 26, tile: true, style: "border-radius:8px;box-shadow:0 1px 4px rgba(22,24,31,.16)" })}TellMore AI</div>
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
    </main>`, "Select a WhatsApp number");
  } catch (e) {
    console.error("[wa-callback]", e?.message || e);
    return errorCard("Something went wrong", "We could not finish connecting WhatsApp. Please close this window and try again from your dashboard.");
  }
}
