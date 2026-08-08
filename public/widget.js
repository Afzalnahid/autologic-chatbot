/*!
 * Autologic website chat widget.
 * Embed with one line:
 *   <script src="https://YOUR-DOMAIN/widget.js" data-client="PUBLIC_WIDGET_KEY"></script>
 *
 * Everything lives inside a shadow root, so this cannot restyle the host page and
 * the host page's CSS cannot break it. Nothing here can throw into the host page.
 */
(function () {
  "use strict";

  if (window.__autologicWidgetLoaded) return;
  window.__autologicWidgetLoaded = true;

  var script =
    document.currentScript ||
    document.querySelector("script[data-client][src*='widget.js']");
  if (!script) return;

  var KEY = script.getAttribute("data-client") || "";
  if (!KEY) {
    console.warn("[Autologic] widget key missing: add data-client to the script tag.");
    return;
  }

  var API;
  try {
    API = new URL(script.src).origin + "/api/widget/chat";
  } catch (e) {
    return;
  }

  var TITLE = script.getAttribute("data-title") || "Chat with us";
  var GREETING =
    script.getAttribute("data-greeting") ||
    "আসসালামু আলাইকুম! কীভাবে সাহায্য করতে পারি? / Hello! How can we help you today?";
  var SIDE = script.getAttribute("data-side") === "left" ? "left" : "right";

  // ---- session -------------------------------------------------------------
  var SKEY = "autologic_session_" + KEY.slice(-8);
  var sessionId = "";
  try {
    sessionId = window.localStorage.getItem(SKEY) || "";
  } catch (e) {}
  if (!sessionId) {
    sessionId =
      Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
    try {
      window.localStorage.setItem(SKEY, sessionId);
    } catch (e) {}
  }

  // ---- shell ---------------------------------------------------------------
  var host = document.createElement("div");
  host.setAttribute("data-autologic-widget", "");
  host.style.cssText =
    "position:fixed;z-index:2147483000;bottom:0;" + SIDE + ":0;width:0;height:0;";
  var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : null;
  if (!root) return;

  var CSS =
    ":host{all:initial}" +
    "*{box-sizing:border-box;font-family:'Hind Siliguri',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}" +
    ".btn{position:fixed;bottom:20px;" + SIDE + ":20px;width:56px;height:56px;border-radius:50%;" +
    "background:#5B8CFF;color:#0A0D14;border:none;cursor:pointer;display:flex;align-items:center;" +
    "justify-content:center;box-shadow:0 6px 24px rgba(10,13,20,.35);transition:transform .15s ease}" +
    ".btn:hover{transform:scale(1.05)}" +
    ".btn:active{transform:scale(.94)}" +
    ".btn svg{transition:transform .26s cubic-bezier(.16,1,.3,1)}" +
    ".btn.on svg{transform:rotate(90deg) scale(.9)}" +
    // One quiet ring, twice, then it stops. A permanently pulsing button is nagging.
    "@keyframes ring{0%{box-shadow:0 6px 24px rgba(10,13,20,.35),0 0 0 0 rgba(91,140,255,.45)}" +
    "70%{box-shadow:0 6px 24px rgba(10,13,20,.35),0 0 0 14px rgba(91,140,255,0)}" +
    "100%{box-shadow:0 6px 24px rgba(10,13,20,.35),0 0 0 0 rgba(91,140,255,0)}}" +
    ".btn.hint{animation:ring 2.2s ease-out 1.2s 2}" +
    ".btn svg{width:26px;height:26px}" +
    ".panel{position:fixed;bottom:88px;" + SIDE + ":20px;width:360px;max-width:calc(100vw - 32px);" +
    "height:520px;max-height:calc(100vh - 120px);background:#0A0D14;border:1px solid #1F2839;" +
    "border-radius:16px;display:flex;flex-direction:column;overflow:hidden;color:#E7EAF2;" +
    "box-shadow:0 18px 50px rgba(10,13,20,.5);" +
    // Hidden with opacity rather than display, because display cannot be animated.
    // pointer-events keeps the invisible panel from swallowing clicks on the page.
    "opacity:0;visibility:hidden;pointer-events:none;transform:translateY(12px) scale(.97);" +
    "transform-origin:bottom " + SIDE + ";" +
    "transition:opacity .2s ease-out,transform .26s cubic-bezier(.16,1,.3,1),visibility .26s}" +
    ".panel.open{opacity:1;visibility:visible;pointer-events:auto;transform:none}" +
    ".hd{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;" +
    "border-bottom:1px solid #1F2839;background:#0F1420}" +
    ".hd b{font-size:15px;font-weight:600}" +
    ".hd small{display:block;font-size:11.5px;color:#98A3BA;font-weight:400;margin-top:2px}" +
    ".x{background:none;border:none;color:#98A3BA;cursor:pointer;font-size:20px;line-height:1;padding:4px}" +
    ".body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}" +
    ".m{max-width:82%;font-size:14px;line-height:1.6;padding:10px 13px;border-radius:12px;white-space:pre-wrap;word-wrap:break-word;" +
    "animation:in .3s cubic-bezier(.16,1,.3,1) both}" +
    "@keyframes in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}" +
    ".dots{animation:in .25s ease-out both}" +
    ".bot{align-self:flex-start;background:#0F1420;border:1px solid #1F2839;border-left:2px solid #5B8CFF}" +
    ".me{align-self:flex-end;background:#5B8CFF;color:#0A0D14}" +
    ".m img{max-width:100%;border-radius:8px;display:block}" +
    ".dots{align-self:flex-start;display:flex;gap:4px;padding:12px 13px}" +
    ".dots i{width:6px;height:6px;border-radius:50%;background:#98A3BA;animation:b 1.2s infinite}" +
    ".dots i:nth-child(2){animation-delay:.2s}.dots i:nth-child(3){animation-delay:.4s}" +
    "@keyframes b{0%,60%,100%{opacity:.35;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}" +
    ".ft{display:flex;gap:8px;padding:12px;border-top:1px solid #1F2839;background:#0F1420}" +
    ".ft input{flex:1;background:#0A0D14;border:1px solid #1F2839;border-radius:9px;padding:10px 12px;" +
    "color:#E7EAF2;font-size:14px;outline:none}" +
    ".ft input:focus{border-color:#5B8CFF}" +
    ".ft button{background:#5B8CFF;color:#0A0D14;border:none;border-radius:9px;padding:0 16px;" +
    "font-weight:600;font-size:14px;cursor:pointer;transition:filter .15s ease-out,transform .15s ease-out}" +
    ".ft button:hover:not(:disabled){filter:brightness(1.08)}" +
    ".ft button:active:not(:disabled){transform:scale(.96)}" +
    ".ft input{transition:border-color .15s ease-out}" +
    ".ft button:disabled{opacity:.5;cursor:default}" +
    ".cr{text-align:center;font-size:10.5px;color:#98A3BA;padding:0 0 8px}" +
    "@media(max-width:420px){.panel{width:calc(100vw - 24px);height:calc(100vh - 110px);" + SIDE + ":12px;bottom:80px}}" +
    "@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}" +
    ".panel{transform:none}}";

  var wrap = document.createElement("div");
  wrap.innerHTML =
    "<style>" + CSS + "</style>" +
    '<button class="btn" part="button" aria-label="' + esc(TITLE) + '">' +
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C6.9 3 3 6.5 3 10.8c0 2.3 1.1 4.3 3 5.7V21l3.3-2a11 11 0 0 0 2.7.3c5.1 0 9-3.5 9-7.8S17.1 3 12 3z"/></svg>' +
    "</button>" +
    '<div class="panel" role="dialog" aria-label="' + esc(TITLE) + '">' +
    '<div class="hd"><div><b>' + esc(TITLE) + "</b><small>Powered by Autologic</small></div>" +
    '<button class="x" aria-label="Close">&times;</button></div>' +
    '<div class="body"></div>' +
    '<div class="ft"><input type="text" placeholder="Write a message..." aria-label="Message"/>' +
    "<button>Send</button></div></div>";
  root.appendChild(wrap);

  function attach() {
    (document.body || document.documentElement).appendChild(host);
  }
  if (document.body) attach();
  else document.addEventListener("DOMContentLoaded", attach);

  var btn = root.querySelector(".btn");
  var panel = root.querySelector(".panel");
  var closeBtn = root.querySelector(".x");
  var body = root.querySelector(".body");
  var input = root.querySelector(".ft input");
  var send = root.querySelector(".ft button");

  var busy = false;
  var greeted = false;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function bubble(text, who) {
    var d = document.createElement("div");
    d.className = "m " + (who === "me" ? "me" : "bot");
    d.textContent = text;
    body.appendChild(d);
    body.scrollTop = body.scrollHeight;
    return d;
  }

  function image(url) {
    var d = document.createElement("div");
    d.className = "m bot";
    var img = document.createElement("img");
    img.src = url;
    img.alt = "";
    d.appendChild(img);
    body.appendChild(d);
    body.scrollTop = body.scrollHeight;
  }

  function typing(on) {
    var t = root.querySelector(".dots");
    if (on) {
      if (t) return;
      var d = document.createElement("div");
      d.className = "dots";
      d.innerHTML = "<i></i><i></i><i></i>";
      body.appendChild(d);
      body.scrollTop = body.scrollHeight;
    } else if (t) {
      t.remove();
    }
  }

  function open() {
    panel.classList.add("open");
    // The icon turns into a close mark, and the attention ring stops for good.
    btn.classList.add("on");
    btn.classList.remove("hint");
    if (!greeted) {
      greeted = true;
      bubble(GREETING, "bot");
    }
    setTimeout(function () {
      input.focus();
    }, 50);
  }

  function close() {
    panel.classList.remove("open");
    btn.classList.remove("on");
  }

  function submit() {
    var text = (input.value || "").trim();
    if (!text || busy) return;
    input.value = "";
    bubble(text, "me");
    busy = true;
    send.disabled = true;
    typing(true);

    fetch(API, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ key: KEY, session_id: sessionId, message: text }),
    })
      .then(function (r) {
        return r.json().catch(function () {
          return {};
        });
      })
      .then(function (j) {
        typing(false);
        var items = j && j.items;
        if (!items || !items.length) {
          bubble(
            j && j.error === "not_authorised"
              ? "এই চ্যাটটি এই ওয়েবসাইটের জন্য চালু নেই। / This chat is not enabled for this website."
              : "উত্তর পেতে সমস্যা হচ্ছে — একটু পরে আবার চেষ্টা করুন। / We couldn't get a reply. Please try again shortly.",
            "bot"
          );
          return;
        }
        items.forEach(function (it) {
          if (it.type === "image_msg" && it.url) image(it.url);
          else if (it.text) bubble(it.text, "bot");
        });
      })
      .catch(function () {
        typing(false);
        bubble(
          "সংযোগে সমস্যা হচ্ছে — ইন্টারনেট দেখে আবার চেষ্টা করুন। / Connection problem. Please check your internet and try again.",
          "bot"
        );
      })
      .then(function () {
        busy = false;
        send.disabled = false;
        input.focus();
      });
  }

  btn.classList.add("hint");

  btn.addEventListener("click", function () {
    panel.classList.contains("open") ? close() : open();
  });
  closeBtn.addEventListener("click", close);
  send.addEventListener("click", submit);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") submit();
    if (e.key === "Escape") close();
  });
})();
