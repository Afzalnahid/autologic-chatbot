// Shared base for the preview variants. Same layout, same copy, same colours —
// only the motion system changes, so comparing them is a fair test.

export const T = {
  bg: "#0A0D14", card: "#0F1420", gold: "#5B8CFF", goldBg: "rgba(91,140,255,0.10)",
  text: "#E7EAF2", muted: "#98A3BA", dim: "#6B7689", border: "#1F2839", green: "#2ED3A7",
};

export const CH = {
  whatsapp:  { icon: "ti-brand-whatsapp",  name: "WhatsApp Business",  short: "WhatsApp",  tint: "#25D366" },
  messenger: { icon: "ti-brand-messenger", name: "Facebook Messenger", short: "Messenger", tint: "#0084FF" },
  instagram: { icon: "ti-brand-instagram", name: "Instagram Business", short: "Instagram", tint: "#E1306C" },
  website:   { icon: "ti-world",           name: "Your website",       short: "Website",   tint: "#5B8CFF" },
};

// Both languages, written rather than machine-translated, because the customer
// this page has to convince is a shop owner in Cumilla.
export const COPY = {
  en: {
    eyebrow: "Answering customers right now",
    h1: "One AI chatbot for <em>all</em> your customer channels",
    lead: "Connects to Facebook, Instagram, WhatsApp and your own website, answers in Bangla or English, and books meetings straight into your Google Calendar.",
    cta: "Start free trial", cta2: "See pricing",
    proof: ["3-day free trial", "No card required", "Bangla and English"],
    convLabel: "Real conversations",
    convTitle: "Whether you sell products or services",
    convLead: "The same assistant, trained on your own catalogue or your own documents. It replies in the language the customer wrote in.",
    swipe: "Swipe to see every channel",
    featLabel: "What it does",
    featTitle: "Everything a customer conversation needs",
    shop: "Online shop", service: "Service business",
    features: [
      { icon: "ti-messages", title: "Multi-channel messaging", desc: "Messenger, Instagram, WhatsApp and your own website — one inbox, one assistant." },
      { icon: "ti-brain", title: "Smart AI replies", desc: "Answers come from your own products or uploaded documents — accurate, on-brand, around the clock." },
      { icon: "ti-calendar-check", title: "Calendar booking", desc: "Checks your Google Calendar, creates the meeting, generates the Meet link and sends it to the customer." },
      { icon: "ti-shopping-bag", title: "Products and orders", desc: "Recommends products, matches customer photos to your inventory and records the order as it is confirmed." },
      { icon: "ti-books", title: "Knowledge base", desc: "Upload PDFs, Word files or text. Your documents become an instant, searchable source the bot answers from." },
      { icon: "ti-lock", title: "Isolated and private", desc: "Every business's data is separated at the database. Access tokens are stored securely and never shared." },
    ],
    notes: { order: "Order saved to your dashboard", photo: "Matched the customer's photo to your inventory", docs: "Answered from your uploaded documents", code: "One line of code on your own website" },
  },
  bn: {
    eyebrow: "এখনই গ্রাহকদের উত্তর দিচ্ছে",
    h1: "আপনার <em>সব</em> চ্যানেলের জন্য একটাই এআই চ্যাটবট",
    lead: "ফেসবুক, ইনস্টাগ্রাম, হোয়াটসঅ্যাপ আর আপনার নিজের ওয়েবসাইটে যুক্ত হয়, বাংলা বা ইংরেজিতে উত্তর দেয়, আর মিটিং সরাসরি আপনার গুগল ক্যালেন্ডারে বুক করে।",
    cta: "ফ্রি ট্রায়াল শুরু করুন", cta2: "দাম দেখুন",
    proof: ["৩ দিনের ফ্রি ট্রায়াল", "কার্ড লাগবে না", "বাংলা ও ইংরেজি"],
    convLabel: "সত্যিকারের কথোপকথন",
    convTitle: "পণ্য বিক্রি করুন বা সেবা — দুটোতেই",
    convLead: "একই সহকারী, আপনার নিজের পণ্য বা নিজের ডকুমেন্ট থেকে শেখা। গ্রাহক যে ভাষায় লেখেন, সেই ভাষাতেই উত্তর দেয়।",
    swipe: "সব চ্যানেল দেখতে সোয়াইপ করুন",
    featLabel: "যা যা করে",
    featTitle: "একটি কথোপকথনে যা যা লাগে, সব",
    shop: "অনলাইন শপ", service: "সার্ভিস ব্যবসা",
    features: [
      { icon: "ti-messages", title: "সব চ্যানেল এক জায়গায়", desc: "মেসেঞ্জার, ইনস্টাগ্রাম, হোয়াটসঅ্যাপ আর আপনার ওয়েবসাইট — এক ইনবক্স, এক সহকারী।" },
      { icon: "ti-brain", title: "বুদ্ধিমান উত্তর", desc: "উত্তর আসে আপনার নিজের পণ্য বা আপলোড করা ডকুমেন্ট থেকে — সঠিক, আপনার ভাষায়, দিনরাত।" },
      { icon: "ti-calendar-check", title: "ক্যালেন্ডারে বুকিং", desc: "গুগল ক্যালেন্ডার দেখে খালি সময় বের করে, মিটিং তৈরি করে, মিট লিংক বানিয়ে গ্রাহককে পাঠায়।" },
      { icon: "ti-shopping-bag", title: "পণ্য ও অর্ডার", desc: "পণ্য সাজেস্ট করে, গ্রাহকের পাঠানো ছবি আপনার স্টকের সাথে মেলায়, আর অর্ডার কনফার্ম হলেই লিখে রাখে।" },
      { icon: "ti-books", title: "নলেজ বেস", desc: "পিডিএফ, ওয়ার্ড বা টেক্সট ফাইল আপলোড করুন। আপনার ডকুমেন্টই হয়ে যায় বটের উত্তরের উৎস।" },
      { icon: "ti-lock", title: "আলাদা ও নিরাপদ", desc: "প্রতিটি ব্যবসার তথ্য ডাটাবেসেই আলাদা। অ্যাক্সেস টোকেন নিরাপদে থাকে, কখনো শেয়ার হয় না।" },
    ],
    notes: { order: "অর্ডার আপনার ড্যাশবোর্ডে সেভ হলো", photo: "গ্রাহকের ছবি আপনার স্টকের সাথে মিলিয়েছে", docs: "আপনার আপলোড করা ডকুমেন্ট থেকে উত্তর", code: "আপনার ওয়েবসাইটে এক লাইন কোড" },
  },
};

export const CONVOS = [
  { ch: "messenger", kind: "shop", note: "order",
    lines: [["me","এই শাড়িটার দাম কত? স্টকে আছে?"],["bot","জি আছে। জামদানি শাড়ি — ৩,২০০৳, ফ্রি ডেলিভারি। কোন রঙটা নেবেন?"],["me","লাল। নাম রাহেলা, কুমিল্লা।"],["bot","অর্ডার কনফার্ম হলো — কোড #AL2481। ক্যাশ অন ডেলিভারি, ২ দিনে পৌঁছাবে।"]] },
  { ch: "instagram", kind: "shop", note: "photo", photo: "/demo/dress.svg",
    lines: [["me","📷 এই ড্রেসটা আপনাদের আছে?"],["bot","ছবির সাথে মিলে গেছে — কটন কুর্তি, ১,৪৫০৳। M ও L আছে।"],["me","Do you deliver outside Dhaka?"],["bot","Yes — nationwide, 2–3 days outside Dhaka."]] },
  { ch: "whatsapp", kind: "service", note: "docs",
    lines: [["me","আপনাদের সার্ভিস প্যাকেজ কত?"],["bot","স্টার্টার ১,৫০০৳, প্রো ৩,৫০০৳ এবং এজেন্সি ৬,০০০৳ প্রতি মাসে।"],["me","বৃহস্পতিবার একটা মিটিং করা যাবে?"],["bot","বৃহস্পতিবার বিকেল ৪টা খালি আছে। মিটিং বুক করে দিলাম — লিংক পাঠিয়ে দিয়েছি। ✅"]] },
  { ch: "website", kind: "service", note: "code",
    lines: [["me","Hi, I run a small clothing store. Can this handle my Facebook page?"],["bot","Yes — Messenger, Instagram, WhatsApp and this website widget, all from one dashboard."],["me","How do I add it to my site?"],["bot","One line of code, copied from your dashboard. It takes about a minute."]] },
];

export const wrap = { maxWidth: 1120, margin: "0 auto", padding: "0 22px" };
export const shell = { background: T.bg, minHeight: "100vh", color: T.text,
  fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" };

// ---- the five motion systems -------------------------------------------------
// Entering elements use ease-out curves, never linear. Each one is a different
// idea about how the page should arrive, not five speeds of the same idea.
export const MOTION = {
  m1: { name: "Quiet", note: "Opacity only. Nothing moves.", css: `
    .al-rise { animation: al-fade .3s ease-out both }
    .al-obs { opacity: 0 }
    .al-obs.al-in { opacity: 1; transition: opacity .4s ease-out }
    @keyframes al-fade { from { opacity: 0 } to { opacity: 1 } }` },

  m2: { name: "Lift", note: "Rises and settles. Expo easing.", css: `
    .al-rise { animation: al-lift .55s cubic-bezier(.16,1,.3,1) both }
    .al-obs { opacity: 0; transform: translateY(16px) scale(.985) }
    .al-obs.al-in { opacity: 1; transform: none; transition: opacity .5s ease-out, transform .6s cubic-bezier(.16,1,.3,1) }
    @keyframes al-lift { from { opacity: 0; transform: translateY(16px) scale(.985) } to { opacity: 1; transform: none } }` },

  m3: { name: "Cascade", note: "Arrives line by line, like a chat.", css: `
    .al-rise { animation: al-casc .5s cubic-bezier(.22,.61,.36,1) both }
    .al-obs { opacity: 0; transform: translateY(22px) }
    .al-obs.al-in { opacity: 1; transform: none; transition: opacity .5s ease-out, transform .65s cubic-bezier(.22,.61,.36,1) }
    @keyframes al-casc { from { opacity: 0; transform: translateY(22px) } to { opacity: 1; transform: none } }` },

  m4: { name: "Focus", note: "Resolves from soft blur.", css: `
    .al-rise { animation: al-blur .65s cubic-bezier(.16,1,.3,1) both }
    .al-obs { opacity: 0; filter: blur(9px); transform: translateY(8px) }
    .al-obs.al-in { opacity: 1; filter: blur(0); transform: none; transition: opacity .6s ease-out, filter .7s ease-out, transform .7s cubic-bezier(.16,1,.3,1) }
    @keyframes al-blur { from { opacity: 0; filter: blur(9px); transform: translateY(8px) } to { opacity: 1; filter: blur(0); transform: none } }` },

  m5: { name: "Reveal", note: "Wipes up behind a mask.", css: `
    .al-rise { animation: al-mask .7s cubic-bezier(.16,1,.3,1) both }
    .al-obs { opacity: 0; clip-path: inset(0 0 100% 0); transform: translateY(10px) }
    .al-obs.al-in { opacity: 1; clip-path: inset(0 0 0 0); transform: none; transition: opacity .45s ease-out, clip-path .8s cubic-bezier(.16,1,.3,1), transform .8s cubic-bezier(.16,1,.3,1) }
    @keyframes al-mask { from { opacity: 0; clip-path: inset(0 0 100% 0); transform: translateY(10px) } to { opacity: 1; clip-path: inset(0 0 0 0); transform: none } }` },
};


// Four slides on one 44-second clock. Generated rather than hand-written so the
// timings cannot drift out of step with each other.
// Four slides, 7 seconds each, on one 28-second clock. The schedule below is in
// seconds within a slide, converted to percentages of the whole cycle — written
// this way so changing the pace is one number, not thirty.
const SLIDES = 4, PER = 7, CYCLE = SLIDES * PER;
function boardCss() {
  let out = "";
  for (let k = 0; k < SLIDES; k++) {
    const at = (sec) => (((k * PER + sec) / CYCLE) * 100).toFixed(2) + "%";
    const hold = PER - 0.4;          // visible until the handover
    out += `
      .al-slide.s${k} { animation: al-s${k} ${CYCLE}s linear infinite }
      @keyframes al-s${k} { 0%,${at(0)} { opacity:0 } ${at(0.25)},${at(hold)} { opacity:1 } ${at(PER)},100% { opacity:0 } }
      .s${k} .al-msg.b0 { animation: al-b${k}0 ${CYCLE}s cubic-bezier(.22,.61,.36,1) infinite }
      .s${k} .al-msg.b1 { animation: al-b${k}1 ${CYCLE}s cubic-bezier(.22,.61,.36,1) infinite }
      .s${k} .al-msg.b2 { animation: al-b${k}2 ${CYCLE}s cubic-bezier(.22,.61,.36,1) infinite }
      .s${k} .al-msg.b3 { animation: al-b${k}3 ${CYCLE}s cubic-bezier(.22,.61,.36,1) infinite }
      @keyframes al-b${k}0 { 0%,${at(0.3)} { opacity:0; transform:translateY(7px) } ${at(0.7)},${at(hold)} { opacity:1; transform:none } ${at(PER)},100% { opacity:0 } }
      @keyframes al-b${k}1 { 0%,${at(1.7)} { opacity:0; transform:translateY(7px) } ${at(2.1)},${at(hold)} { opacity:1; transform:none } ${at(PER)},100% { opacity:0 } }
      @keyframes al-b${k}2 { 0%,${at(3.0)} { opacity:0; transform:translateY(7px) } ${at(3.4)},${at(hold)} { opacity:1; transform:none } ${at(PER)},100% { opacity:0 } }
      @keyframes al-b${k}3 { 0%,${at(4.6)} { opacity:0; transform:translateY(7px) } ${at(5.0)},${at(hold)} { opacity:1; transform:none } ${at(PER)},100% { opacity:0 } }
      .s${k} .al-typing.t0 { animation: al-tp${k}0 ${CYCLE}s linear infinite }
      .s${k} .al-typing.t1 { animation: al-tp${k}1 ${CYCLE}s linear infinite }
      @keyframes al-tp${k}0 { 0%,${at(0.8)} { opacity:0 } ${at(1.0)},${at(1.6)} { opacity:1 } ${at(1.7)},100% { opacity:0 } }
      @keyframes al-tp${k}1 { 0%,${at(3.6)} { opacity:0 } ${at(3.8)},${at(4.5)} { opacity:1 } ${at(4.6)},100% { opacity:0 } }
      .al-bars span:nth-child(${k + 1})::after { animation: al-bar${k} ${CYCLE}s linear infinite }
      @keyframes al-bar${k} { 0%,${at(0)} { transform:scaleX(0) } ${at(PER - 0.3)},${at(PER - 0.1)} { transform:scaleX(1) } ${at(PER)},100% { transform:scaleX(0) } }`;
  }
  return out;
}
export const BOARD_CSS = boardCss();

export const BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&family=Anek+Bangla:wght@400;500;600;700&display=swap');

  /* Typography does most of the work here. A serif display face against a technical
     sans is what separates a considered page from a template — system-ui in a
     headline reads as a settings screen, whatever else is done around it. */
  .al-display { font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; letter-spacing: -0.012em }
  .al-display em { font-style: italic; color: ${T.gold} }
  .bn .al-display, .bn { font-family: 'Anek Bangla', system-ui, sans-serif }
  .bn .al-display { font-weight: 600; letter-spacing: -0.02em }
  .al-mono { font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' }

  /* A fine grid, a vignette, and a whisper of grain. Dark surfaces look empty
     without texture; these three are individually invisible and jointly the
     difference between "flat black" and "a material". */
  .al-tex { position: fixed; inset: 0; pointer-events: none; z-index: 1; opacity: .5;
    background-image:
      linear-gradient(${T.border}55 1px, transparent 1px),
      linear-gradient(90deg, ${T.border}55 1px, transparent 1px);
    background-size: 56px 56px;
    mask-image: radial-gradient(120% 80% at 50% 0%, #000 20%, transparent 75%);
    -webkit-mask-image: radial-gradient(120% 80% at 50% 0%, #000 20%, transparent 75%) }
  .al-vig { position: fixed; inset: 0; pointer-events: none; z-index: 1;
    background: radial-gradient(110% 70% at 50% 0%, transparent 55%, rgba(0,0,0,.55) 100%) }

  /* Cards get a lit top edge, the way a real panel catches light from above. */
  .al-surface { background: linear-gradient(180deg, #121829, #0D1220);
    border: 1px solid ${T.border}; position: relative }
  .al-surface::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.14), transparent) }

  /* ---- the board ------------------------------------------------------------
     Four conversations play one after another, on a loop, like a board outside a
     shop. Each one types, answers, holds, and hands over to the next. The whole
     thing is CSS on a single shared clock, so the slides can never drift apart. */
  /* A phone, because that is where every one of these conversations actually
     happens. The screen clips, so the chat sits on the bottom and older messages
     ride up out of view exactly as they would on a real handset. */
  .al-phone { width: 300px; margin: 0 auto; border-radius: 40px; padding: 10px;
    background: linear-gradient(160deg, #232B3D, #10151F);
    box-shadow: 0 30px 70px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,255,255,.06) }
  .al-screen { border-radius: 31px; overflow: hidden; background: ${T.bg}; position: relative; height: 470px }
  .al-notch { position: absolute; top: 9px; left: 50%; transform: translateX(-50%); width: 86px; height: 20px;
    border-radius: 12px; background: #05070C; z-index: 5 }
  .al-status { display: flex; justify-content: space-between; align-items: center; padding: 11px 18px 6px;
    font-size: 11px; color: ${T.muted}; position: relative; z-index: 4 }

  .al-board { position: relative; overflow: hidden; flex: 1 }
  .al-slide { position: absolute; inset: 0; opacity: 0; display: flex; flex-direction: column }
  /* Bottom-anchored: the newest message sits at the bottom, the rest move up. */
  .al-stack { margin-top: auto; display: flex; flex-direction: column; gap: 7px; padding: 10px 12px 12px }
  .al-msg { opacity: 0 }
  .al-typing { display: inline-flex; gap: 4px; padding: 8px 12px; border-radius: 13px;
    background: #151B29; border: 1px solid ${T.border}; opacity: 0;
    position: absolute; top: 0; left: 0 }
  .al-msgwrap { position: relative }
  .al-typing b { width: 5px; height: 5px; border-radius: 50%; background: ${T.muted};
    animation: al-bounce 1.3s ease-in-out infinite }
  .al-typing b:nth-child(2) { animation-delay: .18s } .al-typing b:nth-child(3) { animation-delay: .36s }
  @keyframes al-bounce { 0%,60%,100% { opacity:.35; transform: translateY(0) } 30% { opacity:1; transform: translateY(-3px) } }
  .al-bars { display: flex; gap: 5px; margin-bottom: 13px }
  .al-bars span { flex: 1; height: 3px; border-radius: 2px; background: ${T.border}; overflow: hidden; position: relative }
  .al-bars span::after { content: ""; position: absolute; inset: 0; background: ${T.gold}; transform: scaleX(0);
    transform-origin: left }

  /* A slow wash of brand light behind the hero. Barely there on purpose — it should
     read as depth, not as a light show. */
  .al-aurora { position: absolute; inset: -20% -10% auto -10%; height: 460px; pointer-events: none;
    background: radial-gradient(50% 60% at 50% 40%, ${T.gold}22, transparent 70%);
    filter: blur(50px); animation: al-drift 18s ease-in-out infinite; z-index: 0 }
  @keyframes al-drift { 0%,100% { transform: translateX(-4%) scale(1) } 50% { transform: translateX(4%) scale(1.08) } }

  /* Light passes across the main button, the way it does on a real surface. */
  .al-cta { position: relative; overflow: hidden }
  .al-cta::after { content: ""; position: absolute; top: 0; left: -60%; width: 40%; height: 100%;
    background: linear-gradient(100deg, transparent, rgba(255,255,255,.42), transparent);
    transform: skewX(-18deg); animation: al-sheen 4.5s ease-in-out infinite }
  @keyframes al-sheen { 0%,72% { left: -60% } 88%,100% { left: 120% } }

  /* Each channel lights up in turn: four channels, one after another. */
  .al-chip { transition: border-color .3s ease-out, color .3s ease-out }
  .al-chip.c0 { animation: al-chip 7s ease-in-out infinite }
  .al-chip.c1 { animation: al-chip 7s ease-in-out infinite 1.75s }
  .al-chip.c2 { animation: al-chip 7s ease-in-out infinite 3.5s }
  .al-chip.c3 { animation: al-chip 7s ease-in-out infinite 5.25s }
  @keyframes al-chip {
    0%,88%,100% { border-color: ${T.border}; box-shadow: none }
    10%,20% { border-color: ${T.gold}66; box-shadow: 0 0 0 3px ${T.gold}12 }
  }

  .al-card { transition: transform .2s ease-out, border-color .2s ease-out, box-shadow .2s ease-out }
  /* On a dark surface a wider glow reads better than a deeper shadow. */
  .al-card:hover { transform: translateY(-3px); border-color: ${T.gold}55; box-shadow: 0 16px 44px ${T.gold}22 }
  .al-card:active { transform: scale(.99); border-color: ${T.gold}44 }

  @keyframes al-pulse { 0%,100% { box-shadow: 0 0 0 0 ${T.green}55 } 50% { box-shadow: 0 0 0 5px ${T.green}00 } }
  .al-dot { width: 6px; height: 6px; border-radius: 50%; background: ${T.green}; display: inline-block;
            margin-right: 9px; vertical-align: middle; animation: al-pulse 2.6s ease-in-out infinite }

  .al-link { color: ${T.muted}; text-decoration: none; transition: color .15s ease-out }
  .al-link:hover { color: ${T.text} }
  .al-btn { transition: transform .15s ease-out, border-color .15s ease-out }
  .al-btn:hover { border-color: ${T.gold}55 } .al-btn:active { transform: scale(.97) }
  .al-cta { transition: transform .15s ease-out, box-shadow .25s ease-out, filter .15s ease-out }
  .al-cta:hover { transform: translateY(-2px); box-shadow: 0 10px 30px ${T.gold}44; filter: brightness(1.05) }
  .al-cta:active { transform: scale(.97); box-shadow: none }
  a:focus-visible { outline: 2px solid ${T.gold}; outline-offset: 3px; border-radius: 8px }

  .al-rail { display: flex; gap: 14px; overflow-x: auto; scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch; padding: 2px 22px 6px; margin: 0 -22px; scrollbar-width: none }
  .al-rail::-webkit-scrollbar { display: none }
  .al-rail > * { flex: 0 0 calc(100% - 2px); scroll-snap-align: center; scroll-snap-stop: always }
  @media (min-width: 900px) { .al-rail > * { flex-basis: 330px } }
  .al-hint { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: ${T.dim}; margin-top: 14px }
  @keyframes al-nudge { 0%,100% { transform: translateX(0) } 50% { transform: translateX(5px) } }
  .al-hint i { animation: al-nudge 1.8s ease-in-out infinite }

  .al-switch { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; display: flex; gap: 6px;
    justify-content: center; padding: 9px 10px calc(9px + env(safe-area-inset-bottom));
    background: rgba(10,13,20,.92); backdrop-filter: blur(14px); border-top: 1px solid ${T.border}; overflow-x: auto }
  .al-switch a { flex: 0 0 auto; padding: 9px 12px; border-radius: 9px; font-size: 12.5px; font-weight: 600;
    text-decoration: none; color: ${T.muted}; border: 1px solid ${T.border}; white-space: nowrap; transition: all .15s ease-out }
  .al-switch a.on { color: #0A0D14; background: ${T.gold}; border-color: ${T.gold} }
  .al-pad { height: 74px }

  @media (max-width: 620px) { .al-grid { grid-template-columns: 1fr !important } }
  @media (max-width: 860px) { .al-two { grid-template-columns: 1fr !important } }
  @media (prefers-reduced-motion: reduce) {
    .al-rise, .al-card, .al-cta, .al-btn, .al-link { animation: none !important; transition: none !important; transform: none !important }
    .al-obs { opacity: 1 !important; transform: none !important; filter: none !important; clip-path: none !important }
    .al-dot, .al-hint i, .al-chip, .al-aurora, .al-typing, .al-typing b { animation: none !important }
    .al-cta::after { display: none }
    .al-msg { opacity: 1 !important; animation: none !important }
    .al-slide { animation: none !important }
    .al-slide.s0 { opacity: 1 !important } .al-slide.s1, .al-slide.s2, .al-slide.s3 { display: none }
    .al-typing { display: none }
    .al-bars span::after { animation: none !important }
  }
`;

export const REVEAL_JS = `(function(){
  function start(){
    if (!("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var els = document.querySelectorAll("[data-reveal]");
    for (var i=0;i<els.length;i++) els[i].classList.add("al-obs");
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){
        if (!e.isIntersecting) return;
        e.target.style.transitionDelay = (e.target.dataset.reveal||0) + "ms";
        e.target.classList.add("al-in"); io.unobserve(e.target);
      });
    }, { threshold: .12, rootMargin: "0px 0px -6% 0px" });
    for (var j=0;j<els.length;j++) io.observe(els[j]);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();`;

export function Switch({ active, lang }) {
  const q = lang === "bn" ? "?lang=bn" : "";
  return (
    <>
      <div className="al-pad" />
      <div className="al-switch">
        {Object.entries(MOTION).map(([k, m], i) => (
          <a key={k} href={`/preview/${k}${q}`} className={active === k ? "on" : ""}>{i + 1} · {m.name}</a>
        ))}
      </div>
    </>
  );
}
