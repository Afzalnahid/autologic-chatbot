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

  const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Connect WhatsApp</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.6.0/dist/tabler-icons.min.css">
<script>try{var t=localStorage.getItem("al-theme");if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t);}catch(e){}</script>
<style>
/* Brand chrome — crimson on soft white, #FF4D59 in dark mode, honouring the
   owner's saved al-theme. Matches src/lib/connect-page.js and the WhatsApp
   picker (wa/callback). WhatsApp green stays on the icon tile only — a platform
   brand mark, exactly like the channel icons in the dashboard. */
:root,[data-theme=light]{--bg:#EEF0F5;--card:#F5F6FA;--in:#E7EAF1;--text:#191C24;--muted:#4C5364;--dim:#8A91A3;--line:#DFE3EC;--acc:#D92632;--accd:#B01824;--ok:#0A7C5C;--shd:rgba(166,173,192,.5);--shl:rgba(255,255,255,.95);color-scheme:light}
[data-theme=dark]{--bg:#111318;--card:#191C24;--in:#15181F;--text:#EAECF2;--muted:#A9B0C0;--dim:#7C8496;--line:#252A35;--acc:#FF4D59;--accd:#E23440;--ok:#3FE0B4;--shd:rgba(0,0,0,.55);--shl:rgba(255,255,255,.05);color-scheme:dark}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;-webkit-font-smoothing:antialiased}
.card{width:100%;max-width:460px;background:var(--card);border:1px solid var(--line);border-radius:26px;padding:clamp(22px,5vw,32px);box-shadow:9px 9px 20px var(--shd),-9px -9px 20px var(--shl);text-align:center}
.brand{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:700;margin-bottom:20px}
.brand i{width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,var(--acc),var(--accd));color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:14px}
.tile{width:64px;height:64px;border-radius:20px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:30px;background:var(--in);box-shadow:inset 3px 3px 7px var(--shd),inset -3px -3px 7px var(--shl);color:#25D366}
h3{font-size:19px;font-weight:700;letter-spacing:-.02em;margin-bottom:8px}
.lead{font-size:13.5px;color:var(--muted);line-height:1.65;margin-bottom:20px}
.lead b{color:var(--text);font-weight:600}
.checks{list-style:none;text-align:left;margin:2px 0 22px;padding:0}
.checks li{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:var(--muted);line-height:1.5;padding:5px 0}
.checks li i{color:var(--ok);font-size:15px;margin-top:1px;flex-shrink:0}
.checks li b{color:var(--text);font-weight:600}
button{width:100%;padding:15px 18px;background:linear-gradient(135deg,var(--acc),var(--accd));color:#fff;border:0;border-radius:14px;font-size:15px;font-weight:700;font-family:inherit;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:9px;box-shadow:0 10px 22px color-mix(in srgb,var(--acc) 32%,transparent);transition:transform .14s,filter .15s}
button:hover{transform:translateY(-1px);filter:brightness(1.05)}
button:disabled{opacity:.5;cursor:not-allowed;transform:none;box-shadow:none}
.btn-alt{margin-top:10px;background:var(--in);color:var(--text);box-shadow:inset 2px 2px 5px var(--shd),inset -2px -2px 5px var(--shl);font-size:13.5px;font-weight:600}
.btn-alt:hover{transform:translateY(-1px);filter:none}
.btn-alt i{color:#25D366}
.altcap{font-size:11px;color:var(--dim);line-height:1.5;margin-top:8px;text-align:center}
.status{margin-top:16px;font-size:13px;color:var(--muted);min-height:20px;line-height:1.6}
.err{color:var(--acc)}
.ok{color:var(--ok)}
.trust{display:flex;align-items:center;justify-content:center;gap:6px;font-size:11.5px;color:var(--dim);line-height:1.5;margin-top:14px}
.trust i{font-size:13px;flex-shrink:0}
/* Advanced options — deliberately quiet. The one-click Meta flow is the path;
   these are escape hatches for people who already run Cloud API themselves. */
.adv{margin-top:20px;border-top:1px solid var(--line);text-align:left}
.adv>summary{cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:13px 2px 3px;font-size:12.5px;font-weight:600;color:var(--muted)}
.adv>summary::-webkit-details-marker{display:none}
.adv[open]>summary .chev{transform:rotate(180deg)}
.advlead{font-size:11.5px;color:var(--dim);line-height:1.55;margin:2px 2px 4px}
.method{margin-top:10px;border:1px solid var(--line);border-radius:16px;background:var(--in);overflow:hidden;text-align:left}
.method>summary{cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;font-size:13.5px;font-weight:600}
.method>summary::-webkit-details-marker{display:none}
.method>summary>span{display:inline-flex;align-items:center;gap:9px;min-width:0}
.method>summary>span>i{color:var(--acc);font-size:16px;flex-shrink:0}
.chev{color:var(--dim);font-size:15px;transition:transform .15s;flex-shrink:0}
.method[open]>summary .chev{transform:rotate(180deg)}
.method .body{padding:2px 16px 16px;border-top:1px solid var(--line)}
.method .body>p{font-size:12.5px;color:var(--muted);line-height:1.6;margin:12px 0}
.steps{margin:10px 0 12px 18px;padding:0;color:var(--muted);font-size:12.5px;line-height:1.85}
.steps b{color:var(--text)}
.steps code{font-family:ui-monospace,Menlo,Consolas,monospace;background:var(--card);border:1px solid var(--line);border-radius:6px;padding:1px 6px;font-size:11.5px;color:var(--acc)}
label.fld{display:block;font-size:12px;font-weight:600;color:var(--muted);margin-top:12px}
label.fld input{width:100%;margin-top:6px;background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:inset 2px 2px 5px var(--shd),inset -2px -2px 5px var(--shl);padding:11px 13px;color:var(--text);font-size:13px;font-family:inherit}
label.fld input:focus{outline:0;border-color:var(--acc)}
.btn2{display:block;width:100%;text-align:center;text-decoration:none;margin-top:14px;padding:12px 16px;border-radius:12px;font-size:13.5px;font-weight:700;font-family:inherit;cursor:pointer;background:var(--card);color:var(--text);box-shadow:inset 2px 2px 5px var(--shd),inset -2px -2px 5px var(--shl)}
.btn3{width:100%;margin-top:14px;padding:12px 16px;border-radius:12px;font-size:13.5px;font-weight:700;border:0;background:linear-gradient(135deg,var(--acc),var(--accd));color:#fff;box-shadow:0 8px 18px color-mix(in srgb,var(--acc) 30%,transparent)}
.warn{font-size:11.5px;color:var(--muted);background:var(--card);border:1px solid var(--line);border-radius:10px;padding:9px 11px;line-height:1.55;margin-top:12px}
.warn b{color:var(--text)}
.subhelp{margin-top:12px}
.subhelp>summary{cursor:pointer;list-style:none;font-size:12px;font-weight:600;color:var(--acc);display:inline-flex;align-items:center;gap:6px}
.subhelp>summary::-webkit-details-marker{display:none}
.spin{display:inline-block;width:13px;height:13px;border:2px solid var(--line);border-top-color:var(--acc);border-radius:50%;animation:s .7s linear infinite;vertical-align:-2px;margin-right:7px}
@keyframes s{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.spin{animation:none}}
</style></head><body>
<main class="card">
  <div class="brand"><i class="ti ti-bolt"></i>Autologic</div>
  <div class="tile"><i class="ti ti-brand-whatsapp"></i></div>
  <h3>Connect WhatsApp Business</h3>
  <p class="lead">Set it up in Meta's own secure window. Already have a WhatsApp Business number?
     Choose it. Don't have one yet? Create it in the same flow — your business details are
     already filled in.</p>

  <ul class="checks">
    <li><i class="ti ti-check"></i><span>Pick an <b>existing number</b> or create a new one</span></li>
    <li><i class="ti ti-check"></i><span>Verify it with the code Meta sends by SMS or call</span></li>
    <li><i class="ti ti-check"></i><span>Your bot starts replying the moment it's connected</span></li>
  </ul>

  <button id="go"><i class="ti ti-brand-meta"></i>Set up with Meta</button>
  <button id="coex" class="btn-alt"><i class="ti ti-brand-whatsapp"></i>Bring my WhatsApp Business app number</button>
  <div class="altcap">Already chatting with customers on the green WhatsApp Business app? Keep that same number — the app and the bot work side by side.</div>
  <div class="status" id="status"></div>
  <div class="trust"><i class="ti ti-lock"></i>Meta handles verification — we never see your password.</div>

  <details class="adv">
    <summary><span>Advanced connection options</span><i class="chev ti ti-chevron-down"></i></summary>
    <p class="advlead">Most people never need these. Use them only if you already manage WhatsApp Cloud API yourself, or support asked you to.</p>

    <details class="method">
      <summary><span><i class="ti ti-search"></i>Connect a number you've shared with us</span><i class="chev ti ti-chevron-down"></i></summary>
      <div class="body">
        <p>Share your existing WhatsApp Business number with us once, then we detect it automatically. Takes under a minute, one time only:</p>
        <ol class="steps">
          <li>Open <b>business.facebook.com/settings/whatsapp-business-accounts</b></li>
          <li>Select your WhatsApp account → <b>Assign partner</b></li>
          <li>Search by <b>Partner Business ID</b> and enter <code>1214039840198586</code> — this finds us exactly, even if the name shown differs</li>
          <li>Under Partial access, turn on only <b>Messages</b> and <b>Phone numbers (view only)</b></li>
          <li>Confirm access</li>
        </ol>
        <a class="btn2" href="/api/wa/login?client_id=${encodeURIComponent(clientId)}">I've shared it — find my number</a>
      </div>
    </details>

    <details class="method">
      <summary><span><i class="ti ti-id-badge-2"></i>Enter a Phone Number ID manually</span><i class="chev ti ti-chevron-down"></i></summary>
      <div class="body">
        <p>For users who already run WhatsApp Cloud API. Paste the two values from Meta and we'll connect this number right away.</p>
        <form method="POST" action="/api/wa/select">
          <input type="hidden" name="state" value="${stateToken}">
          <label class="fld">Phone Number ID
            <input name="phone_id" inputmode="numeric" autocomplete="off" placeholder="e.g. 123456789012345" required>
          </label>
          <label class="fld">Access token
            <input name="manual_token" autocomplete="off" placeholder="Your permanent System User token" required>
          </label>
          <button type="submit" class="btn3">Connect this number</button>
        </form>
        <div class="warn"><b>Use a permanent token.</b> The 24-hour test token from API Setup makes the bot stop after a day — create a System User token in Business Settings so it never expires.</div>
        <details class="subhelp">
          <summary><i class="ti ti-help-circle"></i>Where do I find these?</summary>
          <ol class="steps">
            <li>Open <b>business.facebook.com</b> → <b>WhatsApp Manager</b> → <b>Account tools → Phone numbers</b></li>
            <li>Click your number — the <b>Phone number ID</b> is shown there (a long number, not the phone number itself)</li>
            <li>For the token, go to <b>Business Settings → Users → System users</b>, add a system user, give it your WhatsApp account, then <b>Generate token</b> with the <code>whatsapp_business_messaging</code> permission and paste it above</li>
          </ol>
        </details>
      </div>
    </details>
  </details>
</main>

<script async defer crossorigin="anonymous" src="https://connect.facebook.net/en_US/sdk.js"></script>
<script>
(function(){
  var STATE = ${JSON.stringify(stateToken)};
  var btn = document.getElementById('go');
  var btn2 = document.getElementById('coex');
  var status = document.getElementById('status');
  var PREFILL = ${JSON.stringify(prefill)};
  var session = null;   // waba_id + phone_number_id, from the popup
  var authCode = null;  // OAuth code, from the FB.login callback
  var done = false;

  function say(msg, cls){ status.innerHTML = msg; status.className = 'status ' + (cls||''); }
  function busy(msg){ say('<span class="spin"></span>' + msg); }
  function ready(){ btn.disabled = false; btn2.disabled = false; }
  function lock(){ btn.disabled = true; btn2.disabled = true; }

  window.fbAsyncInit = function(){
    FB.init({ appId: ${JSON.stringify(APP_ID)}, cookie:true, xfbml:false, version:'v26.0' });
    ready();
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
      ready();
    } else if (d.event === 'ERROR') {
      say('Meta reported an error: ' + ((d.data && d.data.error_message) || 'unknown'), 'err');
      ready();
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
      if (res.error) { say(res.error, 'err'); ready(); done = false; return; }
      // Hand over to the branded "connected" page, which names the number,
      // explains what the bot now does and returns to the dashboard.
      say('✓ Connected. One moment…', 'ok');
      var q = '/api/wa/finish?done=1&name=' + encodeURIComponent(res.name || 'WhatsApp Business') + '&number=' + encodeURIComponent(res.number || '');
      setTimeout(function(){ window.location.href = q; }, 500);
    })
    .catch(function(e){ say('Could not finish setup: ' + e.message, 'err'); ready(); done = false; });
  }

  lock();
  say('<span class="spin"></span>Loading…');

  var stallTimer = null;

  // One flow, two doors, chosen by featureType:
  //  • ''  → standard Embedded Signup: create a brand-new number, or pick an
  //          existing WhatsApp Business Account number.
  //  • 'whatsapp_business_app_onboarding' → Coexistence: onboard a number that
  //          is live on the consumer WhatsApp Business app, so the app and the
  //          bot run side by side on the same number.
  // They are kept as SEPARATE buttons on purpose. Meta replaces the create-new
  // screen when Coexistence is on, so forcing it globally would block a business
  // that just wants a fresh number. The extra Coexistence webhooks it brings
  // (history / smb_message_echoes / smb_app_state_sync) are ignored safely by
  // parseWhatsAppEvent in lib/messenger.js, which only ever answers a live
  // customer message on change.field === "messages".
  function startSignup(featureType){
    if (typeof FB === 'undefined') {
      say('Facebook has not loaded yet. Please reload the page.', 'err');
      return;
    }
    lock();
    busy('Waiting for Meta…');

    // FB.login opens a popup and its callback only fires once the person has
    // finished or dismissed it, which legitimately takes minutes. So a timeout
    // cannot mean "blocked" — it can only offer a hint, and must never claim
    // failure while the person is still working in Meta's window.
    clearTimeout(stallTimer);
    stallTimer = setTimeout(function(){
      if (!authCode && !done) {
        say('Still waiting for Meta. If no Meta window opened, allow pop-ups for this site and click again.');
        ready();
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
        ready();
      }
    }, {
      config_id: ${JSON.stringify(CONFIG_ID)},
      response_type: 'code',
      override_default_response_type: true,
      extras: { setup: PREFILL, featureType: featureType, sessionInfoVersion:'3' }
    });
  }

  btn.onclick = function(){ startSignup(''); };
  btn2.onclick = function(){ startSignup('whatsapp_business_app_onboarding'); };
})();
</script>
</body></html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
