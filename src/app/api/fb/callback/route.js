export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { verifyState } from "@/lib/oauth-state.js";
import { connectFailedPage } from "@/lib/connect-page.js";

const APP_ID = process.env.FB_APP_ID;
const APP_SECRET = process.env.FB_APP_SECRET;

const fail = (reason, status = 400, extra = {}) => connectFailedPage({ platform: "facebook", reason, status, ...extra });

export async function GET(request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const stateToken = searchParams.get("state") || "";
    const clientId = verifyState(stateToken);
    if (!clientId) {
      return fail("This connect link has expired or is invalid. Please start again from your dashboard.", 403);
    }
    if (!code) return fail("Facebook did not return an authorisation code. Please try connecting again.");
    if (!APP_ID || !APP_SECRET) return fail("This server is not fully configured for Facebook yet. Please contact support.", 500);

    const redirect = `${origin}/api/fb/callback`;
    const tokRes = await fetch(`https://graph.facebook.com/v24.0/oauth/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}&redirect_uri=${encodeURIComponent(redirect)}&code=${code}`).then(r => r.json());
    if (tokRes.error) return fail("Facebook could not complete the sign-in: " + tokRes.error.message);

    const longRes = await fetch(`https://graph.facebook.com/v24.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${tokRes.access_token}`).then(r => r.json());
    const userToken = longRes.access_token || tokRes.access_token;

    const pages = await fetch(`https://graph.facebook.com/v24.0/me/accounts?fields=id,name,access_token&access_token=${userToken}`).then(r => r.json());
    if (pages.error) return fail("We could not read your Facebook Pages: " + pages.error.message);
    const list = pages.data || [];
    // No Page on this Facebook account. This is not an error the owner can fix
    // here — Autologic connects to a Facebook Page, and there simply isn't one
    // yet. Say so plainly and glide back to the dashboard on its own.
    if (!list.length) {
      return fail(
        "This Facebook account doesn't manage any Page yet. Autologic connects to a Facebook Page — create one on Facebook (it's free and takes a minute), then come back and connect again.",
        400,
        { title: "No Facebook Page found", eyebrow: "Nothing to connect", seconds: 9 }
      );
    }

    const options = list.map(p => {
      const initials = String(p.name).trim().slice(0, 1).toUpperCase();
      const safeName = String(p.name).replace(/</g, "&lt;");
      return `<label class="row" data-name="${safeName.toLowerCase()}">
      <input type="radio" name="page" value="${p.id}|${encodeURIComponent(p.name)}|${p.access_token}" required>
      <span class="av">${initials}</span>
      <span class="nm">${safeName}</span>
    </label>`;
    }).join("");

    // Brand chrome — crimson on soft white, #FF4D59 in dark mode, honouring the
    // owner's saved al-theme. Matches src/lib/connect-page.js and the WhatsApp
    // picker (wa/callback). This page used to hard-code a dark Meta-popup palette
    // with a periwinkle hover, which broke CLAUDE.md's brand rules and looked
    // like a different product mid-flow.
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Select a Page</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.6.0/dist/tabler-icons.min.css">
<script>try{var t=localStorage.getItem("al-theme");if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t);}catch(e){}</script>
<style>
:root,[data-theme=light]{--bg:#EEF0F5;--card:#F5F6FA;--in:#E7EAF1;--text:#191C24;--muted:#4C5364;--dim:#8A91A3;--line:#DFE3EC;--acc:#D92632;--accd:#B01824;--shd:rgba(166,173,192,.5);--shl:rgba(255,255,255,.95);color-scheme:light}
[data-theme=dark]{--bg:#111318;--card:#191C24;--in:#15181F;--text:#EAECF2;--muted:#A9B0C0;--dim:#7C8496;--line:#252A35;--acc:#FF4D59;--accd:#E23440;--shd:rgba(0,0,0,.55);--shl:rgba(255,255,255,.05);color-scheme:dark}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;-webkit-font-smoothing:antialiased}
.card{width:100%;max-width:460px;max-height:calc(100vh - 32px);background:var(--card);border:1px solid var(--line);border-radius:26px;padding:clamp(20px,5vw,30px);box-shadow:9px 9px 20px var(--shd),-9px -9px 20px var(--shl);display:flex;flex-direction:column;min-height:0}
.brand{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:700;margin-bottom:18px}
.brand i{width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,var(--acc),var(--accd));color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:14px}
h3{font-size:17px;font-weight:700;letter-spacing:-.02em}
.sub{font-size:12.5px;color:var(--muted);margin:5px 0 14px;line-height:1.55}
.search{width:100%;background:var(--in);border:1px solid var(--line);border-radius:12px;box-shadow:inset 2px 2px 5px var(--shd),inset -2px -2px 5px var(--shl);padding:10px 13px;color:var(--text);font-size:13.5px;font-family:inherit;margin-bottom:10px}
.search::placeholder{color:var(--dim)}
.search:focus{outline:0;border-color:var(--acc)}
form{display:flex;flex-direction:column;min-height:0}
.list{max-height:46vh;overflow-y:auto;border:1px solid var(--line);border-radius:16px;padding:6px;background:var(--in)}
.list::-webkit-scrollbar{width:5px}
.list::-webkit-scrollbar-thumb{background:var(--line);border-radius:4px}
.row{display:flex;align-items:center;gap:11px;padding:11px;border-radius:12px;cursor:pointer;transition:background .12s}
.row:hover{background:var(--card)}
.row.hide{display:none}
.row input{accent-color:var(--acc);width:15px;height:15px;flex-shrink:0}
.av{width:32px;height:32px;border-radius:10px;background:var(--card);box-shadow:2px 2px 5px var(--shd),-2px -2px 5px var(--shl);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--muted);flex-shrink:0}
.nm{font-size:13.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar{padding-top:14px}
button{width:100%;padding:13px 18px;background:linear-gradient(135deg,var(--acc),var(--accd));color:#fff;border:0;border-radius:14px;font-size:14.5px;font-weight:700;font-family:inherit;cursor:pointer;box-shadow:0 10px 22px color-mix(in srgb,var(--acc) 32%,transparent);transition:transform .14s,filter .15s}
button:hover{transform:translateY(-1px);filter:brightness(1.05)}
.empty{padding:20px;text-align:center;color:var(--dim);font-size:13px;display:none}
</style></head><body>
  <main class="card">
  <div class="brand"><i class="ti ti-bolt"></i>Autologic</div>
  <h3>Select a Page to connect</h3>
  <div class="sub">${list.length} Page${list.length === 1 ? "" : "s"} available${list.length > 5 ? " — scroll to see them all" : ""}.</div>
  ${list.length > 5 ? `<input class="search" id="q" placeholder="Search your Pages" autocomplete="off">` : ""}
  <form method="POST" action="/api/fb/select">
    <input type="hidden" name="state" value="${stateToken}">
    <div class="list" id="list">${options}<div class="empty" id="empty">No Page matches that name.</div></div>
    <div class="bar"><button type="submit">Connect</button></div>
  </form>
  </main>
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
</body></html>`;
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (e) {
    console.error("[fb-callback]", e?.message || e);
    return fail("We could not finish connecting. Please close this window and try again from your dashboard.", 500, { eyebrow: "Something went wrong", title: "Connection interrupted" });
  }
}
