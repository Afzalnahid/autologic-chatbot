export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { verifyState } from "@/lib/oauth-state.js";

const APP_ID = process.env.FB_APP_ID;
const APP_SECRET = process.env.FB_APP_SECRET;

export async function GET(request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const stateToken = searchParams.get("state") || "";
    const clientId = verifyState(stateToken);
    if (!clientId) {
      return new NextResponse("This connect link has expired or is invalid. Please start again from your dashboard.", { status: 400 });
    }
    if (!code) return new NextResponse("Missing code", { status: 400 });
    if (!APP_ID || !APP_SECRET) return new NextResponse("Server misconfigured: FB_APP_ID or FB_APP_SECRET missing", { status: 500 });

    const redirect = `${origin}/api/fb/callback`;
    const tokRes = await fetch(`https://graph.facebook.com/v24.0/oauth/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}&redirect_uri=${encodeURIComponent(redirect)}&code=${code}`).then(r => r.json());
    if (tokRes.error) return new NextResponse("Auth failed: " + tokRes.error.message, { status: 400 });

    const longRes = await fetch(`https://graph.facebook.com/v24.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${tokRes.access_token}`).then(r => r.json());
    const userToken = longRes.access_token || tokRes.access_token;

    const pages = await fetch(`https://graph.facebook.com/v24.0/me/accounts?fields=id,name,access_token&access_token=${userToken}`).then(r => r.json());
    if (pages.error) return new NextResponse("Pages fetch failed: " + pages.error.message, { status: 400 });
    const list = pages.data || [];
    if (!list.length) return new NextResponse("No pages found on this account", { status: 400 });

    const options = list.map(p => {
      const initials = String(p.name).trim().slice(0, 1).toUpperCase();
      const safeName = String(p.name).replace(/</g, "&lt;");
      return `<label class="row" data-name="${safeName.toLowerCase()}">
      <input type="radio" name="page" value="${p.id}|${encodeURIComponent(p.name)}|${p.access_token}" required>
      <span class="av">${initials}</span>
      <span class="nm">${safeName}</span>
    </label>`;
    }).join("");

    // The list is scrollable with a sticky action bar: a business owner with a
    // dozen Pages could previously scroll past the one they wanted and never see
    // it, because the popup is short and the list had no visible bounds.
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Select a Page</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0A0D14;color:#E7EAF2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
       height:100vh;display:flex;flex-direction:column;padding:20px}
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
  .row input{accent-color:#FF6B75;width:15px;height:15px;flex-shrink:0}
  .av{width:30px;height:30px;border-radius:8px;background:#1C2436;border:1px solid #2C374D;
      display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;
      color:#98A3BA;flex-shrink:0}
  .nm{font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .bar{padding-top:14px}
  button{width:100%;padding:11px;background:#E23440;color:#fff;border:0;border-radius:8px;
         font-size:14px;font-weight:600;font-family:inherit;cursor:pointer}
  button:hover{background:#7BA2FF}
  .empty{padding:22px;text-align:center;color:#5E6B85;font-size:13px;display:none}
</style></head><body>
  <h3>Select a Page to connect</h3>
  <div class="sub">${list.length} Page${list.length === 1 ? "" : "s"} available — scroll to see them all.</div>
  <input class="search" id="q" placeholder="Search your Pages" autocomplete="off">
  <form method="POST" action="/api/fb/select">
    <input type="hidden" name="state" value="${stateToken}">
    <div class="list" id="list">${options}<div class="empty" id="empty">No Page matches that name.</div></div>
    <div class="bar"><button type="submit">Connect</button></div>
  </form>
<script>
  var q=document.getElementById('q'),rows=document.querySelectorAll('.row'),empty=document.getElementById('empty');
  q.addEventListener('input',function(){
    var t=q.value.trim().toLowerCase(),shown=0;
    rows.forEach(function(r){var m=!t||r.dataset.name.indexOf(t)>-1;r.classList.toggle('hide',!m);if(m)shown++;});
    empty.style.display=shown?'none':'block';
  });
</script>
</body></html>`;
    return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
  } catch (e) {
    console.error("[fb-callback]", e?.message || e);
    return new NextResponse(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="background:#0b0f1a;color:#eee;font-family:sans-serif;padding:40px;text-align:center"><h3>Something went wrong</h3><p style="color:#8b9cbd">We could not finish connecting. Please close this window and try again from your dashboard.</p></body></html>`, { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}
