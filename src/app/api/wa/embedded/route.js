export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { signState } from "@/lib/oauth-state.js";

const APP_ID = process.env.FB_APP_ID || "914246304594380";
const CONFIG_ID = process.env.WA_CONFIG_ID;

// WhatsApp Embedded Signup.
//
// The plain OAuth flow could only find numbers that already belonged to a
// WhatsApp Business Account, which meant a client had to go and create a WABA
// in Meta Business Manager and then hunt for a Phone Number ID before they
// could connect anything. Embedded Signup removes all of that: Meta's own
// popup walks the owner through naming their business and verifying a phone
// number by SMS, and creates the WABA for them. We receive the resulting
// waba_id and phone_number_id directly from the popup.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("client_id") || "";

  if (!CONFIG_ID) {
    return new NextResponse(
      "WhatsApp signup is not configured on this server yet. Please contact support.",
      { status: 500 }
    );
  }

  const stateToken = signState(clientId);

  const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect WhatsApp</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0A0D14;color:#E7EAF2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
       min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .box{max-width:420px;width:100%;text-align:center}
  .icon{width:56px;height:56px;border-radius:16px;background:rgba(37,211,102,.12);
        border:1px solid rgba(37,211,102,.3);display:flex;align-items:center;justify-content:center;
        margin:0 auto 18px;font-size:28px}
  h3{font-size:19px;font-weight:600;letter-spacing:-.02em;margin-bottom:8px}
  p{font-size:13.5px;color:#98A3BA;line-height:1.65;margin-bottom:22px}
  ul{text-align:left;list-style:none;background:#0F1420;border:1px solid #1F2839;border-radius:12px;
     padding:16px 18px;margin-bottom:22px}
  li{font-size:13px;color:#98A3BA;padding:6px 0 6px 22px;position:relative;line-height:1.55}
  li:before{content:"";position:absolute;left:0;top:13px;width:6px;height:6px;border-radius:50%;background:#25D366}
  button{width:100%;padding:13px;background:#25D366;color:#06210F;border:0;border-radius:10px;
         font-size:15px;font-weight:700;font-family:inherit;cursor:pointer}
  button:hover{background:#3BE07A}
  button:disabled{opacity:.5;cursor:not-allowed}
  .status{margin-top:18px;font-size:13px;color:#98A3BA;min-height:20px;line-height:1.6}
  .err{color:#FF5A5F}
  .ok{color:#2ED3A7}
  .spin{display:inline-block;width:13px;height:13px;border:2px solid #2C374D;border-top-color:#5B8CFF;
        border-radius:50%;animation:s .7s linear infinite;vertical-align:-2px;margin-right:7px}
  @keyframes s{to{transform:rotate(360deg)}}
</style></head><body>
<div class="box">
  <div class="icon">💬</div>
  <h3>Connect WhatsApp Business</h3>
  <p>Meta will guide you through setting up your WhatsApp Business account. You do not need to
     create anything beforehand.</p>
  <ul>
    <li>Enter your business name and details</li>
    <li>Add the phone number you want customers to message</li>
    <li>Verify it with the code Meta sends you by SMS</li>
    <li>Your bot starts replying immediately</li>
  </ul>
  <button id="go">Continue with Meta</button>
  <div class="status" id="status"></div>
</div>

<script async defer crossorigin="anonymous" src="https://connect.facebook.net/en_US/sdk.js"></script>
<script>
(function(){
  var STATE = ${JSON.stringify(stateToken)};
  var btn = document.getElementById('go');
  var status = document.getElementById('status');
  var session = null;   // waba_id + phone_number_id, from the popup
  var authCode = null;  // OAuth code, from the FB.login callback
  var done = false;

  function say(msg, cls){ status.innerHTML = msg; status.className = 'status ' + (cls||''); }
  function busy(msg){ say('<span class="spin"></span>' + msg); }

  window.fbAsyncInit = function(){
    FB.init({ appId: ${JSON.stringify(APP_ID)}, cookie:true, xfbml:false, version:'v24.0' });
    btn.disabled = false;
    say('');
  };

  // If the SDK never loads (blocked script, offline, ad blocker) the button
  // would otherwise stay dead with no explanation.
  setTimeout(function(){
    if (typeof FB === 'undefined') {
      say('Could not load Facebook. Disable any ad blocker for this page and reload.', 'err');
    }
  }, 6000);

  // Meta's popup reports progress on a postMessage channel. The FINISH event
  // carries the WABA and phone number ids that the owner just created.
  window.addEventListener('message', function(ev){
    if (ev.origin !== 'https://www.facebook.com' && ev.origin !== 'https://web.facebook.com') return;
    var d;
    try { d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data; } catch(e){ return; }
    if (!d || d.type !== 'WA_EMBEDDED_SIGNUP') return;

    if (d.event === 'FINISH' || d.event === 'FINISH_ONLY_WABA') {
      session = { waba_id: d.data && d.data.waba_id, phone_number_id: d.data && d.data.phone_number_id };
      maybeFinish();
    } else if (d.event === 'CANCEL') {
      say('Setup was cancelled before it finished. You can start again when ready.', 'err');
      btn.disabled = false;
    } else if (d.event === 'ERROR') {
      say('Meta reported an error: ' + ((d.data && d.data.error_message) || 'unknown'), 'err');
      btn.disabled = false;
    }
  });

  // Both halves arrive independently, so finish once we hold each of them.
  function maybeFinish(){
    if (done || !session || !authCode) return;
    done = true;
    busy('Finishing setup…');
    fetch('/api/wa/finish', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        state: STATE,
        code: authCode,
        waba_id: session.waba_id,
        phone_number_id: session.phone_number_id
      })
    })
    .then(function(r){ return r.json(); })
    .then(function(res){
      if (res.error) { say(res.error, 'err'); btn.disabled = false; done = false; return; }
      say('✓ WhatsApp connected' + (res.number ? ' — ' + res.number : '') + '. Returning to your dashboard…', 'ok');
      setTimeout(function(){
        if (window.opener) { window.opener.postMessage('wa_connected','*'); window.close(); }
        else { window.location.href = '/dashboard#channels'; }
      }, 1400);
    })
    .catch(function(e){ say('Could not finish setup: ' + e.message, 'err'); btn.disabled = false; done = false; });
  }

  btn.disabled = true;
  say('<span class="spin"></span>Loading…');

  var stallTimer = null;
  btn.onclick = function(){
    if (typeof FB === 'undefined') {
      say('Facebook has not loaded yet. Please reload the page.', 'err');
      return;
    }
    btn.disabled = true;
    busy('Waiting for Meta…');

    // FB.login opens a popup. If the browser blocks it, or the domain is not on
    // the app's JavaScript SDK allowlist, the callback never fires and this page
    // would sit on "Waiting for Meta" forever. Tell the person what to check.
    clearTimeout(stallTimer);
    stallTimer = setTimeout(function(){
      if (!authCode && !done) {
        say('The Meta window did not open. Allow pop-ups for this site and try again.', 'err');
        btn.disabled = false;
      }
    }, 12000);

    FB.login(function(resp){
      clearTimeout(stallTimer);
      if (resp.authResponse && resp.authResponse.code) {
        authCode = resp.authResponse.code;
        busy('Waiting for you to finish setup with Meta…');
        maybeFinish();
      } else {
        say('Setup was not completed. You can start again when ready.', 'err');
        btn.disabled = false;
      }
    }, {
      config_id: ${JSON.stringify(CONFIG_ID)},
      response_type: 'code',
      override_default_response_type: true,
      extras: { setup:{}, featureType:'', sessionInfoVersion:'3' }
    });
  };
})();
</script>
</body></html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
