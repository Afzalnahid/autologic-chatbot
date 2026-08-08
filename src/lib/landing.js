// Everything the landing page says and shows. Kept out of the page file so the
// copy can be edited without touching layout, and so both languages sit side by
// side where a mismatch is obvious.

export const P = {
  paper: "#E9E0CC", paper2: "#F2EBDB", ink: "#14171F", inkSoft: "#4A4E5A",
  blue: "#2447C9", blueLite: "#5B8CFF", accent: "#E85A2A", line: "#14171F1F",
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

export const STAGES = [
  { ch: "messenger", icon: "ti-shopping-bag",
    inn: "এই শাড়িটার দাম কত? স্টকে আছে?", inEn: "How much is this saree? In stock?",
    src: "Product catalogue", srcBn: "পণ্যের তালিকা",
    say: "জামদানি শাড়ি — ৩,২০০৳, ফ্রি ডেলিভারি।", sayEn: "Jamdani saree — 3,200৳, free delivery.",
    did: "Order #AL2481 saved", didBn: "অর্ডার #AL2481 সেভ",
    cap: "Reads your own catalogue. No scripts, no keyword lists — it recognises the product and quotes your real price.",
    capBn: "আপনার নিজের পণ্যের তালিকা থেকে পড়ে। কোনো স্ক্রিপ্ট নেই — পণ্য চিনে আপনার আসল দামটাই বলে।" },
  { ch: "instagram", icon: "ti-photo",
    inn: "📷 এই ড্রেসটা আপনাদের আছে?", inEn: "📷 Do you have this dress?",
    src: "Photo → stock match", srcBn: "ছবি → স্টক মেলানো",
    say: "মিলে গেছে — কটন কুর্তি, ১,৪৫০৳। M ও L আছে।", sayEn: "Matched — cotton kurti, 1,450৳. M and L in stock.",
    did: "Product found, size M", didBn: "পণ্য পাওয়া গেল, সাইজ M",
    cap: "Customers send pictures, not product codes. The bot matches the photo against your inventory and answers with the item.",
    capBn: "গ্রাহক ছবি পাঠান, পণ্যের কোড নয়। বট ছবিটা আপনার স্টকের সাথে মিলিয়ে পণ্যটা বের করে দেয়।" },
  { ch: "whatsapp", icon: "ti-calendar-check",
    inn: "বৃহস্পতিবার একটা মিটিং হবে?", inEn: "Can we meet on Thursday?",
    src: "Google Calendar", srcBn: "গুগল ক্যালেন্ডার",
    say: "বিকেল ৪টা খালি আছে — বুক করে দিলাম, লিংক পাঠিয়েছি।", sayEn: "4 PM is free — booked, link sent.",
    did: "Meeting booked, 4 PM", didBn: "মিটিং বুক, বিকেল ৪টা",
    cap: "Checks your real availability, creates the meeting, generates the Meet link and sends it — while you are asleep.",
    capBn: "আপনার আসল খালি সময় দেখে মিটিং তৈরি করে, মিট লিংক বানিয়ে পাঠিয়ে দেয় — আপনি ঘুমিয়ে থাকলেও।" },
  { ch: "website", icon: "ti-language",
    inn: "How do I add this to my site?", inEn: "How do I add this to my site?",
    src: "Your documents", srcBn: "আপনার ডকুমেন্ট",
    say: "One line of code from your dashboard. Takes a minute.", sayEn: "One line of code from your dashboard. Takes a minute.",
    did: "Answered in English", didBn: "ইংরেজিতে উত্তর",
    cap: "Written in English, answered in English. Ask in Bangla and the reply comes back in Bangla — you choose, or let the customer decide.",
    capBn: "ইংরেজিতে প্রশ্ন, ইংরেজিতে উত্তর। বাংলায় লিখলে বাংলায়। আপনি ঠিক করবেন, নাকি গ্রাহক — দুটোই সম্ভব।" },
];

export function flowCss() {
  const N = STAGES.length, PER = 4.2, CY = (N * PER).toFixed(2);
  let out = `
    @keyframes fpulse { 0%,100% { transform: scale(1); opacity:.3 } 50% { transform: scale(1.55); opacity:0 } }
    .core-ring { position:absolute; inset:0; border-radius:50%; border:1px solid ${P.blue}; animation: fpulse 2.4s ease-out infinite }
    .core-ring:nth-child(2) { animation-delay: 1.2s }
    @keyframes spin { to { transform: rotate(360deg) } }
    .core-arc { position:absolute; inset:-6px; border-radius:50%; border:1.5px dashed ${P.blue}55;
      border-top-color: ${P.accent}; animation: spin 6s linear infinite }
    .fprog { height: 2px; background: ${P.line}; position: relative; overflow: hidden }
    .fprog i { position:absolute; inset:0; background: ${P.accent}; transform-origin: left; transform: scaleX(0);
      animation: fpr ${CY}s linear infinite }
    @keyframes fpr { from { transform: scaleX(0) } to { transform: scaleX(1) } }`;
  for (let k = 0; k < N; k++) {
    const at = (sec) => (((k * PER + sec) / (N * PER)) * 100).toFixed(2) + "%";
    out += `
      /* Rows sit side by side, so a dim inactive state reads as "later". Stacked
         items share one cell, so anything but 0 is two texts on top of each other. */
      .fch${k}, .fout${k} { opacity: .28 }
      .fsrc${k}, .fcap${k}, .fsay${k}, .fnum${k} { opacity: 0 }
      .fch${k} { animation: fa${k} ${CY}s linear infinite }
      .fsrc${k} { animation: fb${k} ${CY}s linear infinite }
      .fsay${k} { animation: fs${k} ${CY}s linear infinite }
      .fout${k} { animation: fc${k} ${CY}s linear infinite }
      .fcap${k}, .fnum${k} { animation: fd${k} ${CY}s linear infinite }
      .fdot${k} { animation: fe${k} ${CY}s ease-in-out infinite; opacity: 0 }
      @keyframes fa${k} { 0%,${at(0)} { opacity:.28 } ${at(.3)},${at(PER - .35)} { opacity:1 } ${at(PER)},100% { opacity:.28 } }
      @keyframes fb${k} { 0%,${at(1.1)} { opacity:0 } ${at(1.4)},${at(PER - .35)} { opacity:1 } ${at(PER)},100% { opacity:0 } }
      @keyframes fs${k} { 0%,${at(1.9)} { opacity:0; transform: translateY(5px) } ${at(2.2)},${at(PER - .35)} { opacity:1; transform:none } ${at(PER)},100% { opacity:0 } }
      @keyframes fc${k} { 0%,${at(2.7)} { opacity:.28 } ${at(3.0)},${at(PER - .35)} { opacity:1 } ${at(PER)},100% { opacity:.28 } }
      @keyframes fd${k} { 0%,${at(.05)} { opacity:0 } ${at(.4)},${at(PER - .3)} { opacity:1 } ${at(PER)},100% { opacity:0 } }
      @keyframes fe${k} { 0%,${at(.5)} { opacity:0; transform: translateX(0) } ${at(.7)} { opacity:1 }
        ${at(1.7)} { opacity:1; transform: translateX(var(--run)) } ${at(1.9)},100% { opacity:0; transform: translateX(var(--run)) } }`;
  }
  return out;
}


export const FLOW_CSS = flowCss();

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

