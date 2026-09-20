export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { signState } from "@/lib/oauth-state.js";
import { supabase } from "@/lib/supabase.js";
import { markSvg } from "@/lib/brand-mark.js";
import { signupUrl, markSignup } from "@/lib/wa-signup.js";

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
// flow walks the owner through naming their business and verifying a phone
// number by SMS, and creates the WABA for them. It runs in the same tab and
// returns to /api/wa/callback, which finds the new account from the code and
// connects it (lib/wa-signup.js explains why it is no longer a popup).
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
  const { origin } = new URL(request.url);
  const signupLink = signupUrl({
    appId: APP_ID,
    configId: CONFIG_ID,
    redirect: `${origin}/api/wa/callback`,
    state: signState(markSignup(clientId)),
    prefill,
    featureType: "whatsapp_business_app_onboarding",
  });

  const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Connect WhatsApp</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.6.0/dist/tabler-icons.min.css">
<script>try{var s=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light",t=localStorage.getItem("al-theme");if(!(t&&localStorage.getItem("al-theme-sys")===s))t=s;document.documentElement.setAttribute("data-theme",t);}catch(e){}</script>
<style>
/* Brand chrome — maroon #7B1C3E on soft white, a lifted #C04A72 in dark mode, honouring the
   owner's saved al-theme. Matches src/lib/connect-page.js and the WhatsApp
   picker (wa/callback). WhatsApp green stays on the icon tile only — a platform
   brand mark, exactly like the channel icons in the dashboard. */
:root,[data-theme=light]{--bg:#F7F5F7;--card:#FFFFFF;--in:#F3EEF1;--text:#121116;--muted:#56505A;--dim:#8E8792;--line:#ECE6EA;--acc:#7B1C3E;--accd:#5C1430;--ok:#0A7C5C;--shd:rgba(18,17,22,.07);--shl:rgba(255,255,255,0);color-scheme:light}
[data-theme=dark]{--bg:#121116;--card:#1B1920;--in:#16141B;--text:#F2EEF1;--muted:#B5ADB4;--dim:#857D86;--line:#2A2630;--acc:#C04A72;--accd:#7B1C3E;--ok:#3FE0B4;--shd:rgba(0,0,0,.45);--shl:rgba(255,255,255,0);color-scheme:dark}
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
.guide{margin:0 0 20px;text-align:left}
.guide[hidden]{display:none}
.gq{font-size:13px;font-weight:700;margin:0 2px 2px}
.guide .steps{margin-top:12px}
.subhelp{margin-top:12px}
.subhelp>summary{cursor:pointer;list-style:none;font-size:12px;font-weight:600;color:var(--acc);display:inline-flex;align-items:center;gap:6px}
.subhelp>summary::-webkit-details-marker{display:none}
.spin{display:inline-block;width:13px;height:13px;border:2px solid var(--line);border-top-color:var(--acc);border-radius:50%;animation:s .7s linear infinite;vertical-align:-2px;margin-right:7px}
@keyframes s{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.spin{animation:none}}
</style></head><body>
<main class="card">
  <div class="brand">${markSvg({ size: 26, tile: true, style: "border-radius:8px;box-shadow:0 1px 4px rgba(22,24,31,.16)" })}TellMore AI</div>
  <div class="tile"><i class="ti ti-brand-whatsapp"></i></div>
  <h3>Connect WhatsApp Business</h3>
  <p class="lead">Set it up in Meta's own secure window. Already have a WhatsApp Business number?
     Choose it. Don't have one yet? Create it in the same flow — your business details are
     already filled in.</p>

  <ul class="checks">
    <li><i class="ti ti-check"></i><span>Create a new number, pick an existing one, or link your <b>WhatsApp Business app</b> — all in the same window</span></li>
    <li><i class="ti ti-check"></i><span>Verify it with the code Meta sends by SMS or call</span></li>
    <li><i class="ti ti-check"></i><span>Your bot starts replying the moment it's connected</span></li>
  </ul>

  <!-- Which door to take, by where the number lives today (owner, 2026-09-20).
       Both languages are in the page; the dashboard's own choice picks one. -->
  <div class="guide" data-lang="en">
    <div class="gq">Where does your number live today?</div>
    <details class="method">
      <summary><span><i class="ti ti-circle-plus"></i>A new number (no WhatsApp on it yet)</span><i class="chev ti ti-chevron-down"></i></summary>
      <div class="body"><ol class="steps"><li>Tap <b>Set up with Meta</b> below.</li><li>Choose <b>Create a new WhatsApp Business account</b> and type the number.</li><li>Enter the code Meta sends by SMS or call. Done — you come back here connected.</li></ol></div>
    </details>
    <details class="method">
      <summary><span><i class="ti ti-brand-whatsapp"></i>My normal WhatsApp (the personal app)</span><i class="chev ti ti-chevron-down"></i></summary>
      <div class="body"><ol class="steps"><li>Meta does not let the personal WhatsApp app connect to a bot. Move the number to the free <b>WhatsApp Business</b> app first: install it and open it with the same number — it offers to bring your chats along.</li><li>Then follow <b>“WhatsApp Business app”</b> below. You keep using WhatsApp on your phone and the bot answers too.</li><li>Only if that option does not appear: back up your chats, delete the WhatsApp account on that number (WhatsApp → Settings → Account → Delete account), then connect it as <b>a new number</b>. After that the number works only through TellMore AI, not in the phone app.</li></ol></div>
    </details>
    <details class="method">
      <summary><span><i class="ti ti-building-store"></i>WhatsApp Business app on my phone</span><i class="chev ti ti-chevron-down"></i></summary>
      <div class="body"><ol class="steps"><li>Update the WhatsApp Business app to the latest version.</li><li>Tap <b>Set up with Meta</b> and choose <b>Connect your WhatsApp Business app</b>.</li><li>Enter your number and confirm on your phone when the Business app asks.</li><li>Both keep working: the bot answers, and anything you type in the app is remembered by the bot.</li></ol></div>
    </details>
    <details class="method">
      <summary><span><i class="ti ti-arrows-exchange"></i>Already on WhatsApp API with another company</span><i class="chev ti ti-chevron-down"></i></summary>
      <div class="body"><ol class="steps"><li>Turn the number's two-step verification PIN <b>off</b>: WhatsApp Manager → Phone numbers → your number → Two-step verification — or ask your current provider to do it or to release the number.</li><li>Tap <b>Set up with Meta</b> and enter the same number. Meta moves it to us after a code by SMS or call; its name and quality rating come along.</li><li>If it still says a PIN is set, the PIN is not off yet — check again and retry.</li></ol></div>
    </details>
  </div>
  <div class="guide" data-lang="bn" hidden>
    <div class="gq">আপনার নম্বর এখন কোথায় চলে?</div>
    <details class="method">
      <summary><span><i class="ti ti-circle-plus"></i>নতুন নম্বর (এতে এখনো WhatsApp চলে না)</span><i class="chev ti ti-chevron-down"></i></summary>
      <div class="body"><ol class="steps"><li>নিচের <b>Set up with Meta</b> চাপুন।</li><li><b>Create a new WhatsApp Business account</b> বেছে নম্বরটা লিখুন।</li><li>Meta SMS বা কলে যে কোড পাঠায়, সেটা দিন। শেষ — যুক্ত হয়ে এখানে ফিরে আসবেন।</li></ol></div>
    </details>
    <details class="method">
      <summary><span><i class="ti ti-brand-whatsapp"></i>আমার সাধারণ WhatsApp (ব্যক্তিগত অ্যাপ)</span><i class="chev ti ti-chevron-down"></i></summary>
      <div class="body"><ol class="steps"><li>Meta ব্যক্তিগত WhatsApp অ্যাপকে বটের সাথে যুক্ত হতে দেয় না। আগে নম্বরটা ফ্রি <b>WhatsApp Business</b> অ্যাপে নিন: অ্যাপটা নামিয়ে একই নম্বর দিয়ে খুলুন — পুরনো চ্যাট সাথে আনার অপশন দেয়।</li><li>তারপর নিচের <b>“WhatsApp Business অ্যাপ”</b>-এর ধাপ মানুন। ফোনে WhatsApp আগের মতোই চালাবেন, বটও উত্তর দেবে।</li><li>ওই অপশন না এলে তবেই: চ্যাটের ব্যাকআপ নিন, ওই নম্বরের WhatsApp অ্যাকাউন্ট মুছে দিন (WhatsApp → Settings → Account → Delete account), তারপর <b>নতুন নম্বর</b> হিসেবে যুক্ত করুন। এরপর নম্বরটা শুধু TellMore AI দিয়ে চলবে, ফোনের অ্যাপে নয়।</li></ol></div>
    </details>
    <details class="method">
      <summary><span><i class="ti ti-building-store"></i>ফোনের WhatsApp Business অ্যাপ</span><i class="chev ti ti-chevron-down"></i></summary>
      <div class="body"><ol class="steps"><li>WhatsApp Business অ্যাপটা সর্বশেষ সংস্করণে আপডেট করুন।</li><li><b>Set up with Meta</b> চাপুন, <b>Connect your WhatsApp Business app</b> বেছে নিন।</li><li>নম্বর দিন, আর ফোনের Business অ্যাপ জিজ্ঞেস করলে নিশ্চিত করুন।</li><li>দুটোই চলবে: বট উত্তর দেবে, আর আপনি অ্যাপে যা লিখবেন বট তা মনে রাখবে।</li></ol></div>
    </details>
    <details class="method">
      <summary><span><i class="ti ti-arrows-exchange"></i>অন্য কোনো কোম্পানির মাধ্যমে আগে থেকেই WhatsApp API-তে আছে</span><i class="chev ti ti-chevron-down"></i></summary>
      <div class="body"><ol class="steps"><li>নম্বরের two-step verification PIN <b>বন্ধ</b> করুন: WhatsApp Manager → Phone numbers → আপনার নম্বর → Two-step verification — অথবা আপনার বর্তমান সার্ভিসকে বন্ধ করতে বা নম্বরটা ছেড়ে দিতে বলুন।</li><li><b>Set up with Meta</b> চাপুন, একই নম্বর দিন। SMS বা কলের কোডের পর Meta নম্বরটা আমাদের কাছে সরিয়ে আনবে; নাম আর রেটিং সাথে আসে।</li><li>তারপরও PIN-এর কথা বললে বুঝবেন PIN এখনো বন্ধ হয়নি — আবার দেখে চেষ্টা করুন।</li></ol></div>
    </details>
  </div>

  <button id="go"><i class="ti ti-brand-meta"></i>Set up with Meta</button>
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

<script>
// The dashboard's language choice (i18n.js, "al-dash-lang") picks the guide.
try { if (localStorage.getItem('al-dash-lang') === 'bn') {
  document.querySelector('.guide[data-lang="en"]').hidden = true;
  document.querySelector('.guide[data-lang="bn"]').hidden = false;
  document.documentElement.lang = 'bn';
} } catch(e){}
</script>
<script>
(function(){
  // Same tab, no popup: Meta's window used to be a popup that reported back to
  // this page, and on a phone this page was frozen or reloaded in the
  // background while the owner worked in Meta for 15–20 minutes — the result
  // was posted to nobody (seen live 2026-09-19). Now Meta sends the browser
  // straight back to /api/wa/callback, which finishes on the server and shows
  // the "connected" page, which returns to the dashboard. See lib/wa-signup.js.
  var URL_ = ${JSON.stringify(signupLink)};
  var btn = document.getElementById('go');
  var status = document.getElementById('status');
  // Inside the Android app the WebView cannot show facebook.com: it hands the
  // link to the phone's browser and stays on THIS page, where a spinner used
  // to spin forever. The signup finishes in the browser, so when the owner
  // switches back to the app, take them to Channels, which reloads its list.
  var isApp = false;
  try { isApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); } catch(e){}
  var left = false;
  function backToApp(){ if (isApp && left && !document.hidden) { left = false; window.location.href = '/dashboard#channels'; } }
  document.addEventListener('visibilitychange', backToApp);
  window.addEventListener('focus', backToApp);
  document.addEventListener('resume', backToApp);
  try {
    var App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (isApp && App) App.addListener('appStateChange', function(s){ if (s && s.isActive) backToApp(); });
  } catch(e){}
  btn.onclick = function(){
    btn.disabled = true;
    status.className = 'status';
    status.innerHTML = isApp
      ? '<span class="spin"></span>Finish in the browser that opened, then come back to this app.'
      : '<span class="spin"></span>Opening Meta…';
    // Set after a moment: leaving the app for the browser is what should
    // trigger the return, not a focus blip during the click itself.
    setTimeout(function(){ left = true; }, 800);
    window.location.href = URL_;
  };
  // Coming back with the Back button restores this page from cache with the
  // button still disabled; re-enable it.
  window.addEventListener('pageshow', function(){ btn.disabled = false; status.innerHTML = ''; });
})();
</script>
</body></html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
