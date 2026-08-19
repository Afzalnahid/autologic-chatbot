export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { signState } from "@/lib/oauth-state.js";
import { supabase } from "@/lib/supabase.js";

const APP_ID = process.env.FB_APP_ID || "914246304594380";
// The WhatsApp Embedded Signup configuration id. Like FB_APP_ID and
// FB_CONFIG_ID above, this is a public value (it appears in the Embedded
// Signup URL in the browser), so a hardcoded fallback is safe.
const CONFIG_ID = process.env.WA_CONFIG_ID || "1417283913551939";

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

  // Meta requires a business portfolio and a filled-in business profile before
  // it will create a WhatsApp account. We cannot remove those steps, but we
  // already hold the same details from onboarding, so we pre-fill them and the
  // owner only has to confirm. A client with no portfolio can still create one
  // inside Meta's own window.
  let profile = null;
  if (clientId) {
    const { data } = await supabase
      .from("clients")
      .select("business_name, owner_email, phone, website, address")
      .eq("id", clientId)
      .maybeSingle();
    profile = data || null;
  }

  // Meta wants the country code and the local number separately.
  const rawPhone = String(profile?.phone || "").replace(/[^0-9]/g, "");
  let phoneCode = "";
  let phoneNumber = "";
  if (rawPhone.length >= 10) {
    if (rawPhone.startsWith("880")) { phoneCode = "880"; phoneNumber = rawPhone.slice(3); }
    else if (rawPhone.startsWith("0")) { phoneCode = "880"; phoneNumber = rawPhone.slice(1); }
    else { phoneCode = "880"; phoneNumber = rawPhone; }
  }

  const prefill = {
    business: {
      name: profile?.business_name || "",
      email: profile?.owner_email || "",
      website: profile?.website || "",
      ...(phoneNumber ? { phone: { code: Number(phoneCode), number: phoneNumber } } : {}),
      address: {
        streetAddress1: profile?.address || "",
        country: "BD",
      },
    },
  };

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
  p b{color:#E7EAF2;font-weight:600}
  ul{text-align:left;list-style:none;background:#0F1420;border:1px solid #1F2839;border-radius:12px;
     padding:16px 18px;margin-bottom:22px}
  li{font-size:13px;color:#98A3BA;padding:6px 0 6px 22px;position:relative;line-height:1.55}
  li:before{content:"";position:absolute;left:0;top:13px;width:6px;height:6px;border-radius:50%;background:#25D366}
  li b{color:#E7EAF2;font-weight:600}
  button{width:100%;padding:13px;background:#25D366;color:#06210F;border:0;border-radius:10px;
         font-size:15px;font-weight:700;font-family:inherit;cursor:pointer}
  button:hover{background:#3BE07A}
  button:disabled{opacity:.5;cursor:not-allowed}
  .status{margin-top:18px;font-size:13px;color:#98A3BA;min-height:20px;line-height:1.6}
  .err{color:#FF5A5F}
  .ok{color:#2ED3A7}
  .alt{margin-top:20px;padding-top:18px;border-top:1px solid #1F2839;font-size:12.5px;color:#5E6B85;line-height:1.6}
  .alt a{color:#FF6B75;text-decoration:none;display:block;margin-top:3px;font-weight:500}
  .alt a:hover{text-decoration:underline}
  .spin{display:inline-block;width:13px;height:13px;border:2px solid #2C374D;border-top-color:#FF6B75;
        border-radius:50%;animation:s .7s linear infinite;vertical-align:-2px;margin-right:7px}
  @keyframes s{to{transform:rotate(360deg)}}
</style></head><body>
<div class="box">
  <div class="icon">💬</div>
  <h3>Connect WhatsApp Business</h3>
  <p>Meta will guide you through the setup in its own window. We have filled in what we already
     know about your business. If you do not have a business portfolio yet, choose
     <b>Create a business portfolio</b> — it takes one field.</p>
  <ul>
    <li>Choose or create a business portfolio</li>
    <li>Your business details are filled in already — just pick a <b>category</b></li>
    <li>Add the phone number you want customers to message</li>
    <li>Verify it with the code Meta sends by SMS or call</li>
    <li>Your bot starts replying immediately</li>
  </ul>
  <button id="go">Continue with Meta</button>
  <div class="status" id="status"></div>
  <div class="alt">
    Already have a WhatsApp Business account with Meta?
    <a href="/api/wa/login?client_id=${encodeURIComponent(clientId)}">Connect the one you have</a>
  </div>
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
    FB.init({ appId: ${JSON.stringify(APP_ID)}, cookie:true, xfbml:false, version:'v26.0' });
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
      // Hand over to the branded "connected" page, which names the number,
      // explains what the bot now does and returns to the dashboard.
      say('✓ Connected. One moment…', 'ok');
      var q = '/api/wa/finish?done=1&name=' + encodeURIComponent(res.name || 'WhatsApp Business') + '&number=' + encodeURIComponent(res.number || '');
      setTimeout(function(){ window.location.href = q; }, 500);
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

    // FB.login opens a popup and its callback only fires once the person has
    // finished or dismissed it, which legitimately takes minutes. So a timeout
    // cannot mean "blocked" — it can only offer a hint, and must never claim
    // failure while the person is still working in Meta's window.
    clearTimeout(stallTimer);
    stallTimer = setTimeout(function(){
      if (!authCode && !done) {
        say('Still waiting for Meta. If no Meta window opened, allow pop-ups for this site and click again.');
        btn.disabled = false;
      }
    }, 20000);

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
      extras: { setup: ${JSON.stringify(prefill)}, featureType:'', sessionInfoVersion:'3' }
    });
  };
})();
</script>
</body></html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
