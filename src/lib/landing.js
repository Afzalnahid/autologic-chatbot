// Everything the landing page says and shows. Kept out of the page file so the
// copy can be edited without touching layout, and so both languages sit side by
// side where a mismatch is obvious.

// The product's palette, not the reference's. A visitor who signs up lands in a
// dashboard painted these colours; a mismatched landing page made the two look
// like different companies. Every value is a CSS variable so the page follows
// the same light/dark switch as the dashboard (shared "al-theme" storage key).
// 2026-09-20 "Obsidian" theme in the brand maroon: maroon on near-white; dark mode near-black.
// --lp-acc is for text and icons, --lp-fill for anything with white text on it.
export const P = {
  paper: "var(--lp-bg)",        // page
  paper2: "var(--lp-card)",     // raised surface
  ink: "var(--lp-ink)",         // text
  inkSoft: "var(--lp-soft)",    // secondary text
  blue: "var(--lp-acc)",        // the brand accent (crimson), everywhere
  blueSoft: "var(--lp-accSoft)",
  accent: "var(--lp-acc)",      // one accent is enough
  live: "#2ED3A7",              // mint, and only ever "the bot is live"
  line: "var(--lp-line)",
  onAccent: "#FFFFFF",          // text sitting on a crimson fill (always P.fill, never P.blue)
  fill: "var(--lp-fill)",       // crimson behind white text — stays readable in dark mode
  bubble: "var(--lp-bubble)",   // chat bubbles / typing dots in the phone demo
};

// The two palettes plus the neumorphic depth tokens. Loaded by every public
// page (landing, pricing), so the whole site re-themes from one place.
export const THEME_CSS = `
  :root, [data-theme="light"] {
    --lp-bg:#FCFCFD; --lp-card:#FFFFFF; --lp-ink:#111114; --lp-soft:#5C5C66;
    --lp-acc:#7B1C3E; --lp-accDim:#5C1430; --lp-accSoft:rgba(123,28,62,.07); --lp-fill:#7B1C3E;
    --lp-line:#E6E6EA; --lp-bubble:#FFFFFF;
    --lp-shd:rgba(17,17,20,.06); --lp-shl:rgba(255,255,255,0);
    color-scheme: light;
  }
  [data-theme="dark"] {
    --lp-bg:#0B0B0E; --lp-card:#121216; --lp-ink:#EDEDF0; --lp-soft:#9C9CA6;
    --lp-acc:#C04A72; --lp-accDim:#7B1C3E; --lp-accSoft:rgba(192,74,114,.14); --lp-fill:#C04A72;
    --lp-line:#222228; --lp-bubble:#18181D;
    --lp-shd:rgba(0,0,0,.45); --lp-shl:rgba(255,255,255,0);
    color-scheme: dark;
  }
  :root {
    --lp-nm: 0 12px 32px var(--lp-shd), 0 2px 6px var(--lp-shd);
    --lp-nm-sm: 0 2px 10px var(--lp-shd);
    --lp-grad: linear-gradient(135deg, var(--lp-fill), var(--lp-accDim));
    --lp-glow: 0 8px 20px color-mix(in srgb, var(--lp-fill) 24%, transparent);
  }
  body { background: var(--lp-bg) }
`;

// Applies the theme before first paint and wires the nav toggle. The storage
// keys are shared with the dashboard, so one choice follows the visitor across
// the whole site. The rule is src/lib/theme-pref.js, written out by hand because
// an inline script cannot import: follow the device; a choice made with the
// toggle stands only while the device stays in the mode it was made under.
export const THEME_BOOT_JS = `(function(){
  // The public pages carry their language in the query string, and only the
  // root layout renders <html>, which never sees it. Set it here, before the
  // first paint, so assistive software reads Bangla as Bangla.
  try { if (/[?&]lang=bn(&|$)/.test(location.search)) document.documentElement.lang = "bn"; } catch(e){}
  var KEY = "al-theme", SYS = "al-theme-sys";
  var mq = window.matchMedia("(prefers-color-scheme: dark)");
  function system(){ return mq.matches ? "dark" : "light"; }
  function current(){
    var t = null, s = null, sys = system();
    try { t = localStorage.getItem(KEY); s = localStorage.getItem(SYS); } catch(e){}
    if ((t === "light" || t === "dark") && s === sys && t !== sys) return t;
    if (t || s) { try { localStorage.removeItem(KEY); localStorage.removeItem(SYS); } catch(e3){} }
    return sys;
  }
  function apply(t){
    document.documentElement.setAttribute("data-theme", t);
    var ic = document.getElementById("al-mode-ic");
    // Whole names, not "ti-" + name: scripts/make-icon-font.mjs finds icons by their
    // full name, and a built one was left out of the subset (a blank sun in dark mode).
    if (ic) ic.className = t === "dark" ? "ti ti-sun" : "ti ti-moon";
  }
  apply(current());
  // Delegated, so it survives React replacing the button during hydration.
  document.addEventListener("click", function(e){
    var b = e.target && e.target.closest ? e.target.closest("#al-mode") : null;
    if (!b) return;
    var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    apply(next);
    try {
      if (next === system()) { localStorage.removeItem(KEY); localStorage.removeItem(SYS); }
      else { localStorage.setItem(KEY, next); localStorage.setItem(SYS, system()); }
    } catch(e2){}
  }, true);
  // The device changed mode with the page open: follow it.
  function follow(){ apply(current()); }
  if (mq.addEventListener) mq.addEventListener("change", follow); else if (mq.addListener) mq.addListener(follow);
  // Hydration can rewrite <html>'s attributes from the server markup (which
  // has none); re-assert the choice once it settles, and whenever the icon
  // node is swapped in.
  function reassert(){ apply(current()); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", reassert); else reassert();
  window.addEventListener("load", reassert);
  setTimeout(reassert, 0); setTimeout(reassert, 300); setTimeout(reassert, 1500);
})();`;

export const CH = {
  whatsapp:  { icon: "ti-brand-whatsapp",  name: "WhatsApp Business",  short: "WhatsApp",  tint: "#25D366" },
  messenger: { icon: "ti-brand-messenger", name: "Facebook Messenger", short: "Messenger", tint: "#0084FF" },
  instagram: { icon: "ti-brand-instagram", name: "Instagram Business", short: "Instagram", tint: "#E1306C" },
  website:   { icon: "ti-world",           name: "Your website",       short: "Website",   tint: "#7B1C3E" },
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
    // Both true, checked in Meta's developer console on 2026-09-29: the app's
    // "Become Tech Provider" page reads "You are now a Tech Provider", and its
    // business verification step reads "Approved". Never "Meta Verified" (a
    // different, paid Meta product) and never "partner" — Meta does not endorse us.
    meta: "Meta Tech Provider · Business verified by Meta",
    convLabel: "Real conversations",
    convTitle: "Whether you sell products or services",
    convLead: "The same assistant, trained on your own catalogue or your own documents. It replies in the language the customer wrote in.",
    swipe: "Swipe to see every channel",
    featLabel: "What it does",
    featTitle: "Everything a customer conversation needs",
    shop: "Online shop", service: "Service business", showroom: "Showroom",
    features: [
      { icon: "ti-messages", title: "Multi-channel messaging", desc: "Messenger, Instagram, WhatsApp and your own website — one inbox, one assistant." },
      { icon: "ti-brain", title: "Smart AI replies", desc: "Answers come from your own products or uploaded documents — accurate, on-brand, around the clock." },
      { icon: "ti-calendar-check", title: "Calendar booking", desc: "Checks your Google Calendar, creates the meeting, generates the Meet link and sends it to the customer." },
      { icon: "ti-shopping-bag", title: "Products and orders", desc: "Recommends products, matches customer photos to your inventory and records the order as it is confirmed." },
      { icon: "ti-books", title: "Knowledge base", desc: "Upload PDFs, Word files or text. Your documents become an instant, searchable source the bot answers from." },
      { icon: "ti-lock", title: "Isolated and private", desc: "Every business's data is separated at the database. Access tokens are stored securely and never shared." },
    ],
    notes: { order: "Order saved to your dashboard", photo: "Matched the customer's photo to your inventory", docs: "Answered from your uploaded documents", code: "One line of code on your own website", booking: "Test ride booked in your Google Calendar" },
  },
  bn: {
    eyebrow: "এখনই গ্রাহকদের উত্তর দিচ্ছে",
    h1: "আপনার <em>সব</em> চ্যানেলের জন্য একটাই এআই চ্যাটবট",
    lead: "ফেসবুক, ইনস্টাগ্রাম, হোয়াটসঅ্যাপ আর আপনার নিজের ওয়েবসাইটে যুক্ত হয়, বাংলা বা ইংরেজিতে উত্তর দেয়, আর মিটিং সরাসরি আপনার গুগল ক্যালেন্ডারে বুক করে।",
    cta: "ফ্রি ট্রায়াল শুরু করুন", cta2: "দাম দেখুন",
    proof: ["৩ দিনের ফ্রি ট্রায়াল", "কার্ড লাগবে না", "বাংলা ও ইংরেজি"],
    meta: "Meta-র Tech Provider · Meta-য় যাচাই করা ব্যবসা",
    convLabel: "সত্যিকারের কথোপকথন",
    convTitle: "পণ্য বিক্রি করুন বা সেবা — দুটোতেই",
    convLead: "একই সহকারী, আপনার নিজের পণ্য বা নিজের ডকুমেন্ট থেকে শেখা। গ্রাহক যে ভাষায় লেখেন, সেই ভাষাতেই উত্তর দেয়।",
    swipe: "সব চ্যানেল দেখতে সোয়াইপ করুন",
    featLabel: "যা যা করে",
    featTitle: "একটি কথোপকথনে যা যা লাগে, সব",
    shop: "অনলাইন শপ", service: "সার্ভিস ব্যবসা", showroom: "শোরুম",
    features: [
      { icon: "ti-messages", title: "সব চ্যানেল এক জায়গায়", desc: "মেসেঞ্জার, ইনস্টাগ্রাম, হোয়াটসঅ্যাপ আর আপনার ওয়েবসাইট — এক ইনবক্স, এক সহকারী।" },
      { icon: "ti-brain", title: "বুদ্ধিমান উত্তর", desc: "উত্তর আসে আপনার নিজের পণ্য বা আপলোড করা ডকুমেন্ট থেকে — সঠিক, আপনার ভাষায়, দিনরাত।" },
      { icon: "ti-calendar-check", title: "ক্যালেন্ডারে বুকিং", desc: "গুগল ক্যালেন্ডার দেখে খালি সময় বের করে, মিটিং তৈরি করে, মিট লিংক বানিয়ে গ্রাহককে পাঠায়।" },
      { icon: "ti-shopping-bag", title: "পণ্য ও অর্ডার", desc: "পণ্য সাজেস্ট করে, গ্রাহকের পাঠানো ছবি আপনার স্টকের সাথে মেলায়, আর অর্ডার কনফার্ম হলেই লিখে রাখে।" },
      { icon: "ti-books", title: "নলেজ বেস", desc: "পিডিএফ, ওয়ার্ড বা টেক্সট ফাইল আপলোড করুন। আপনার ডকুমেন্টই হয়ে যায় বটের উত্তরের উৎস।" },
      { icon: "ti-lock", title: "আলাদা ও নিরাপদ", desc: "প্রতিটি ব্যবসার তথ্য ডাটাবেসেই আলাদা। অ্যাক্সেস টোকেন নিরাপদে থাকে, কখনো শেয়ার হয় না।" },
    ],
    notes: { order: "অর্ডার আপনার ড্যাশবোর্ডে সেভ হলো", photo: "গ্রাহকের ছবি আপনার স্টকের সাথে মিলিয়েছে", docs: "আপনার আপলোড করা ডকুমেন্ট থেকে উত্তর", code: "আপনার ওয়েবসাইটে এক লাইন কোড", booking: "টেস্ট রাইড গুগল ক্যালেন্ডারে বুক হলো" },
  },
};

// The hero's phone: four conversations on four channels, shown as a carousel
// the visitor can move through (src/app/hero-board.js). Real product photos
// (public/demo, owner-supplied, 2026-10-04), so the photo matching and the
// product cards look like what a customer actually sees.
//   { me: true, text, photo }                        a customer message, optionally with a photo
//   { text, product: {…} } or { text, products: [{ img, name, price, meta }, …] }
//                                                     a bot reply with one card, or two side by side
export const CONVOS = [
  { ch: "messenger", kind: "shop", note: "order", msgs: [
    { me: true, photo: "/demo/bangle-gold.jpg", text: "এই বালাটা আছে? দাম কত?" },
    { text: "ছবির সাথে মিলে গেছে! জোড়া ডিজাইনও আছে:", products: [
      { img: "/demo/bangle-gold.jpg", name: "কারুকাজ বালা", price: "১,৮৫০৳" },
      { img: "/demo/bangles-pair.jpg", name: "জালি জোড়া চুড়ি", price: "২,৪৫০৳", meta: "এক জোড়া" } ] },
    { me: true, text: "জোড়াটা নেব। সুমাইয়া, মিরপুর ১০।" },
    { text: "অর্ডার কনফার্ম ✅ কোড #TM2481 · ক্যাশ অন ডেলিভারি, ঢাকার ভেতর ১ দিনে।" },
  ] },
  { ch: "instagram", kind: "shop", note: "photo", msgs: [
    { me: true, photo: "/demo/watch-steel.jpg", text: "Eta ki available? Smartwatch o ache?" },
    { text: "জি, দুটোই স্টকে আছে 👇", products: [
      { img: "/demo/watch-steel.jpg", name: "স্টিল চেইন ঘড়ি", price: "৭,৯৫০৳", meta: "১ বছরের ওয়ারেন্টি" },
      { img: "/demo/smartwatch.jpg", name: "স্মার্টওয়াচ", price: "১৮,৫০০৳", meta: "হার্ট রেট · ঘুম" } ] },
    { me: true, text: "Chittagong e delivery koto din?" },
    { text: "চট্টগ্রামে ২–৩ দিন, চার্জ ১২০৳। কোনটা অর্ডার করবেন?" },
  ] },
  { ch: "whatsapp", kind: "showroom", note: "booking", msgs: [
    { me: true, text: "১২৫ সিসির স্কুটার আছে? EMI-তে নেওয়া যাবে?" },
    { text: "জি আছে, ১২ মাসের EMI-তেও নেওয়া যায়।", product: { img: "/demo/scooter.jpg", name: "১২৫ সিসি স্কুটার", price: "২,৮৯,০০০৳", meta: "১২ মাসের EMI · ৩টি রঙ" } },
    { me: true, text: "শনিবার টেস্ট রাইড দেওয়া যাবে?" },
    { text: "শনিবার বিকেল ৪টায় শোরুমে টেস্ট রাইড বুক করলাম ✅ ঠিকানা আর রিমাইন্ডার পাঠিয়ে দিয়েছি।" },
  ] },
  { ch: "website", kind: "service", note: "code", msgs: [
    { me: true, text: "Hi, I run a small clothing store. Can this handle my Facebook page?" },
    { text: "Yes — Messenger, Instagram, WhatsApp and this website widget, all from one dashboard." },
    { me: true, text: "How do I add it to my site?" },
    { text: "One line of code, copied from your dashboard. It takes about a minute." },
  ] },
];

// The carousel's own look. Movement is driven by hero-board.js; these are
// only the shapes, the slide-in and the typing dots.
export const BOARD_CSS = `
  .al-phone { width: 100%; max-width: 300px; margin: 0 auto; border-radius: 38px; padding: 9px; isolation: isolate }
  .al-screen { border-radius: 30px; overflow: hidden; position: relative; height: 560px; display: flex; flex-direction: column }
  .al-notch { position: absolute; top: 8px; left: 50%; transform: translateX(-50%); width: 80px; height: 18px;
    border-radius: 11px; background: #05070C; z-index: 3 }
  .al-status { display: flex; justify-content: space-between; align-items: center; padding: 11px 16px 4px;
    font-size: 10.5px; position: relative; z-index: 2 }
  .al-slide { flex: 1; min-height: 0; display: flex; flex-direction: column }
  .al-slide.in-next { animation: al-in-next .45s cubic-bezier(.22,.61,.36,1) both }
  .al-slide.in-prev { animation: al-in-prev .45s cubic-bezier(.22,.61,.36,1) both }
  @keyframes al-in-next { from { opacity: 0; transform: translateX(28px) } to { opacity: 1; transform: none } }
  @keyframes al-in-prev { from { opacity: 0; transform: translateX(-28px) } to { opacity: 1; transform: none } }
  .al-stack { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; gap: 6px; padding: 8px 11px 10px }
  .al-msg { display: flex; flex-shrink: 0; animation: al-pop .32s cubic-bezier(.22,.61,.36,1) both }
  .al-msg.me { justify-content: flex-end }
  @keyframes al-pop { from { opacity: 0; transform: translateY(7px) } to { opacity: 1; transform: none } }
  .al-cards { display: flex; gap: 6px; margin-top: 6px } .al-cards .al-card { width: auto; flex: 1; min-width: 0; margin-top: 0 }
  .al-card { width: 150px; border-radius: 12px; overflow: hidden; border: 1px solid var(--lp-line); background: var(--lp-bubble); margin-top: 6px }
  .al-card img { width: 100%; height: 64px; object-fit: contain; background: #fff; display: block }
  .al-photo { width: 92px; border-radius: 9px; overflow: hidden; background: #fff; margin-bottom: 5px }
  .al-photo img { width: 100%; height: 72px; object-fit: contain; display: block }
  .al-typing { display: inline-flex; gap: 4px; padding: 8px 12px; border-radius: 12px; background: var(--lp-bubble); border: 1px solid var(--lp-line) }
  .al-typing b { width: 5px; height: 5px; border-radius: 50%; background: var(--lp-soft); animation: bnc 1.3s ease-in-out infinite }
  .al-typing b:nth-child(2) { animation-delay: .18s } .al-typing b:nth-child(3) { animation-delay: .36s }
  @keyframes bnc { 0%,60%,100% { opacity:.35; transform: translateY(0) } 30% { opacity:1; transform: translateY(-3px) } }
  .al-bars { display: flex; gap: 5px; margin-bottom: 10px }
  .al-bars button { flex: 1; padding: 7px 0; border: 0; background: none; cursor: pointer }
  .al-bars button span { display: block; height: 3px; background: var(--lp-line); position: relative; overflow: hidden; border-radius: 3px }
  .al-bars button span i { position: absolute; inset: 0; background: var(--lp-acc); transform-origin: left; transform: scaleX(0) }
  .al-bars button.done span i { transform: scaleX(1) }
  .al-bars button.on span i { animation: al-fill var(--al-dur, 8s) linear forwards }
  .al-bars.paused button.on span i { animation-play-state: paused }
  @keyframes al-fill { from { transform: scaleX(0) } to { transform: scaleX(1) } }
  .al-ctrl { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 14px }
  .al-ctrl button { width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--lp-line); background: var(--lp-card);
    color: var(--lp-ink); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-size: 17px;
    padding: 0; font-family: inherit; transition: border-color .15s ease-out, background .15s ease-out }
  .al-ctrl button:hover { border-color: color-mix(in srgb, var(--lp-acc) 50%, transparent) }
  .al-ctrl button:focus-visible, .al-bars button:focus-visible { outline: 2px solid var(--lp-acc); outline-offset: 2px }
  .al-ctrl .al-ch { width: 34px; height: 34px; font-size: 15px; color: var(--lp-soft) }
  .al-ctrl .al-ch.on { color: #fff; background: var(--lp-fill); border-color: transparent }
  .al-mono { font-variant-numeric: tabular-nums }
  @media (prefers-reduced-motion: reduce) { .al-slide.in-next, .al-slide.in-prev, .al-msg { animation: none } .al-bars button.on span i { animation: none; transform: scaleX(1) } }
`;


// "How it works" on the home page (src/app/how-it-works.js): four things the
// bot does, each shown as one message going through the same four beats —
// the customer writes, the bot reads your own information, it replies, and it
// does the work. The examples match the hero's conversations (owner's product
// photos in public/demo, 2026-10-04).
export const STAGES = [
  { ch: "messenger", icon: "ti-shopping-bag",
    title: "Takes the order", titleBn: "অর্ডার নেয়",
    cap: "It recognises the product, quotes your real price and records the order in your dashboard — name, phone and address included.",
    capBn: "পণ্য চিনে আপনার আসল দাম বলে, আর অর্ডারটা নাম, ফোন ও ঠিকানাসহ আপনার ড্যাশবোর্ডে তুলে রাখে।",
    inn: "এই বালাটা আছে? দাম কত?", inEn: "Do you have this bangle? How much?", photo: "/demo/bangle-gold.jpg",
    src: "Your product catalogue", srcBn: "আপনার পণ্যের তালিকা", srcIcon: "ti-package",
    say: "জি আছে — কারুকাজ বালা, ১,৮৫০৳। অর্ডার করে দিই?", sayEn: "Yes — carved bangle, 1,850৳. Shall I place the order?",
    product: { img: "/demo/bangle-gold.jpg", name: "কারুকাজ বালা", price: "১,৮৫০৳", nameEn: "Carved bangle", priceEn: "1,850৳" },
    did: "Order #TM2481 saved", didBn: "অর্ডার #TM2481 সেভ হলো" },
  { ch: "instagram", icon: "ti-photo",
    title: "Recognises photos", titleBn: "ছবি দেখে চেনে",
    cap: "Customers send pictures, not product codes. The bot matches the photo against your stock and answers with the right item.",
    capBn: "গ্রাহক ছবি পাঠান, পণ্যের কোড নয়। বট ছবিটা আপনার স্টকের সাথে মিলিয়ে সঠিক পণ্যটা বের করে দেয়।",
    inn: "Eta ki available?", inEn: "Is this available?", photo: "/demo/watch-steel.jpg",
    src: "Photo → your stock", srcBn: "ছবি → আপনার স্টক", srcIcon: "ti-scan",
    say: "জি, স্টকে আছে — স্টিল চেইন ঘড়ি, ৭,৯৫০৳।", sayEn: "Yes, in stock — steel chain watch, 7,950৳.",
    product: { img: "/demo/watch-steel.jpg", name: "স্টিল চেইন ঘড়ি", price: "৭,৯৫০৳", nameEn: "Steel chain watch", priceEn: "7,950৳" },
    did: "Matched to your stock", didBn: "স্টকের সাথে মিলেছে" },
  { ch: "whatsapp", icon: "ti-calendar-check",
    title: "Books appointments", titleBn: "সময় বুক করে",
    cap: "It checks your real Google Calendar, books the slot and sends the reminder — while you are busy or asleep.",
    capBn: "আপনার আসল গুগল ক্যালেন্ডার দেখে খালি সময় বুক করে, রিমাইন্ডারও পাঠায় — আপনি ব্যস্ত বা ঘুমিয়ে থাকলেও।",
    inn: "শনিবার টেস্ট রাইড দেওয়া যাবে?", inEn: "Can I take a test ride on Saturday?",
    src: "Your Google Calendar", srcBn: "আপনার গুগল ক্যালেন্ডার", srcIcon: "ti-calendar",
    say: "শনিবার বিকেল ৪টা খালি — বুক করলাম, রিমাইন্ডার পাঠাচ্ছি।", sayEn: "Saturday 4 PM is free — booked, reminder on its way.",
    did: "Test ride booked · Sat 4 PM", didBn: "টেস্ট রাইড বুক · শনিবার ৪টা" },
  { ch: "website", icon: "ti-language",
    title: "Answers in their language", titleBn: "গ্রাহকের ভাষায় উত্তর",
    cap: "Written in English, answered in English; written in Bangla or Banglish, answered in Bangla. On your website too.",
    capBn: "ইংরেজিতে লিখলে ইংরেজিতে, বাংলা বা বাংলিশে লিখলে বাংলায় উত্তর — আপনার ওয়েবসাইটেও।",
    inn: "How do I add this to my site?", inEn: "How do I add this to my site?",
    src: "Your documents", srcBn: "আপনার ডকুমেন্ট", srcIcon: "ti-file-text",
    say: "One line of code from your dashboard — it takes a minute.", sayEn: "One line of code from your dashboard — it takes a minute.",
    did: "Answered in English", didBn: "ইংরেজিতে উত্তর দিল" },
];

// Its look. The section sits on the dark band in both themes, so the colours
// are the band's own, not the page palette.
export const HOW_CSS = `
  .hw { display: grid; grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr); gap: clamp(18px, 3vw, 36px); align-items: center }
  .hw-tabs { display: flex; flex-direction: column; gap: 8px }
  .hw-tab { text-align: left; display: grid; grid-template-columns: 36px 1fr; gap: 4px 12px; align-items: center; width: 100%;
    padding: 14px 16px; border-radius: 14px; border: 1px solid rgba(255,255,255,.07); background: rgba(255,255,255,.025);
    color: #F2EEF1; cursor: pointer; font-family: inherit; position: relative; overflow: hidden;
    transition: background .2s ease-out, border-color .2s ease-out }
  .hw-tab:hover { border-color: rgba(255,255,255,.16) }
  .hw-tab.on { background: rgba(255,255,255,.06); border-color: rgba(224,139,166,.35) }
  .hw-tab:focus-visible { outline: 2px solid #E08BA6; outline-offset: 2px }
  .hw-ic { width: 36px; height: 36px; border-radius: 11px; display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,.06); color: #B5ADB4; font-size: 18px; transition: background .2s, color .2s }
  .hw-tab.on .hw-ic { background: #7B1C3E; color: #fff }
  .hw-t { font-size: 15px; font-weight: 700; display: flex; align-items: baseline; gap: 8px }
  .hw-t small { font-size: 11px; font-weight: 600; color: #857D86; letter-spacing: .06em }
  .hw-cap { grid-column: 2; font-size: 13.5px; line-height: 1.6; color: #B5ADB4; display: none }
  .hw-tab.on .hw-cap { display: block; animation: hw-fade .35s ease-out both }
  .hw-bar { position: absolute; left: 0; bottom: 0; height: 2px; background: #E08BA6; transform-origin: left }
  .hw-card { border-radius: 20px; border: 1px solid rgba(255,255,255,.09); background: linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02));
    padding: 20px 20px 18px; position: relative; box-shadow: 0 24px 60px rgba(0,0,0,.35) }
  .hw-head { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #B5ADB4; margin-bottom: 16px }
  .hw-head b { color: #F2EEF1; font-weight: 600 }
  .hw-steps { position: relative; display: flex; flex-direction: column; gap: 14px }
  .hw-steps::before { content: ""; position: absolute; left: 15px; top: 16px; bottom: 16px; width: 2px;
    background: linear-gradient(180deg, rgba(224,139,166,.55), rgba(224,139,166,.08)) }
  .hw-row { display: grid; grid-template-columns: 32px 1fr; gap: 12px; align-items: start; position: relative;
    animation: hw-in .45s cubic-bezier(.22,.61,.36,1) both }
  .hw-row:nth-child(2) { animation-delay: .45s } .hw-row:nth-child(3) { animation-delay: .9s } .hw-row:nth-child(4) { animation-delay: 1.35s }
  .hw-dot { width: 32px; height: 32px; border-radius: 50%; background: #1B1820; border: 1px solid rgba(255,255,255,.12);
    display: flex; align-items: center; justify-content: center; font-size: 15px; color: #E08BA6; position: relative; z-index: 1 }
  .hw-lbl { font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: #857D86; margin: 2px 0 6px }
  .hw-me { display: inline-flex; align-items: center; gap: 9px; max-width: 100%; padding: 7px 12px 7px 7px; border-radius: 14px 14px 4px 14px;
    background: #7B1C3E; color: #fff; font-size: 13.5px; line-height: 1.45 }
  .hw-me.noimg { padding-left: 12px }
  .hw-me img, .hw-prod img { width: 42px; height: 42px; border-radius: 9px; object-fit: contain; background: #fff; flex-shrink: 0 }
  .hw-src { display: inline-flex; align-items: center; gap: 7px; padding: 6px 11px; border-radius: 999px; font-size: 12.5px; font-weight: 600;
    color: #F2EEF1; background: rgba(224,139,166,.12); border: 1px solid rgba(224,139,166,.28) }
  .hw-bot { padding: 9px 12px; border-radius: 14px 14px 14px 4px; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.08);
    color: #F2EEF1; font-size: 13.5px; line-height: 1.5 }
  .hw-prod { display: flex; align-items: center; gap: 10px; margin-top: 8px; padding: 6px; border-radius: 11px; background: rgba(0,0,0,.25) }
  .hw-prod b { display: block; font-size: 12.5px; color: #F2EEF1 } .hw-prod span { font-size: 13px; font-weight: 800; color: #E08BA6 }
  .hw-did { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 11px; font-size: 13px; font-weight: 600;
    color: #D5F7EC; background: rgba(46,211,167,.1); border: 1px solid rgba(46,211,167,.3) }
  .hw-did i { color: #2ED3A7; font-size: 16px }
  @keyframes hw-in { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
  @keyframes hw-fade { from { opacity: 0 } to { opacity: 1 } }
  @media (max-width: 860px) {
    .hw { grid-template-columns: minmax(0, 1fr) }
    .hw > div { min-width: 0 }
    .hw-tabs { flex-direction: row; overflow-x: auto; gap: 8px; padding-bottom: 4px; scrollbar-width: none; margin: 0 -2px }
    .hw-tabs::-webkit-scrollbar { display: none }
    .hw-tab { width: auto; flex: 0 0 auto; grid-template-columns: 28px auto; padding: 9px 13px 9px 9px; border-radius: 12px }
    .hw-ic { width: 28px; height: 28px; border-radius: 9px; font-size: 15px }
    .hw-t { font-size: 13.5px; white-space: nowrap } .hw-t small { display: none }
    .hw-tab.on .hw-cap { display: none }
    .hw-mcap { display: block !important }
  }
  .hw-mcap { display: none; font-size: 14px; line-height: 1.6; color: #B5ADB4; margin: 14px 2px 0 }
  @media (prefers-reduced-motion: reduce) { .hw-row, .hw-tab.on .hw-cap { animation: none } }
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

