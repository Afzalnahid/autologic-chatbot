// The commercial half of the product document: packages, the comparison,
// security and contact. Split from content.mjs only for length; the same rules
// at the top of that file apply here, and the fourth one hardest:
//
//   COMPETITOR FACTS ARE SOURCED AND DATED, OR THEY ARE NOT PRINTED.
//
// Chatfuel's and Tidio's numbers below were read from their own pricing pages
// on 25 September 2026. ManyChat's page refuses automated reading, so ManyChat
// is absent — a figure recalled from memory is exactly the false information
// this document must not contain.

// ── Packages ───────────────────────────────────────────────────────────────
// Copied from src/lib/plans.js on 2026-09-25. tests/t-brochure.mjs compares the
// two and fails if they drift, so a price change in the app cannot leave a
// wrong price in the brochure.
export const PLANS_TABLE = {
  trialDays: 3,
  trialPerDay: 30,
  rows: [
    { id: "shop_basic",      name: "Shop Basic",         biz: "shop", monthly: 2699,  yearly: 26990,  byok: 1999, perMonth: 2000 },
    { id: "shop_pro",        name: "Shop Pro",           biz: "shop", monthly: 5999,  yearly: 59990,  byok: 4499, perMonth: 5500 },
    { id: "shop_enterprise", name: "Shop Enterprise",    biz: "shop", monthly: 11999, yearly: 119990, byok: 8999, perMonth: 12000 },
    { id: "svc_basic",       name: "Service Basic",      biz: "svc",  monthly: 2299,  yearly: 22990,  byok: 1699, perMonth: 2000 },
    { id: "svc_pro",         name: "Service Pro",        biz: "svc",  monthly: 4999,  yearly: 49990,  byok: 3499, perMonth: 5500 },
    { id: "svc_enterprise",  name: "Service Enterprise", biz: "svc",  monthly: 9999,  yearly: 99990,  byok: 7499, perMonth: 12000 },
  ],
  en: {
    h: "Packages",
    lead: "Prices in Bangladeshi taka. Every package includes every channel and every feature — the only number that changes is how many replies the bot may send.",
    cols: ["Package", "Per month", "Per year", "With your own AI key", "Bot replies / month"],
    shopH: "For shops (e-commerce)",
    svcH: "For service businesses",
    notes: [
      "Free trial: 3 days, up to 30 bot replies a day. No card and no payment details are asked for.",
      "Paying yearly costs ten months instead of twelve.",
      "A “reply” is one message the bot sends to a customer. Replies you type yourself are never counted.",
      "Bring your own Google or OpenAI key and the package price drops to the fourth column; you then pay the AI provider directly for what you use.",
      "Payment by bKash, Nagad or Rocket.",
    ],
  },
  bn: {
    h: "প্যাকেজ",
    lead: "দাম বাংলাদেশি টাকায়। প্রতিটি প্যাকেজে সব চ্যানেল আর সব ফিচার থাকে — শুধু বট কতগুলো উত্তর দিতে পারবে, সেই সংখ্যাটাই বদলায়।",
    cols: ["প্যাকেজ", "মাসিক", "বাৎসরিক", "নিজের এআই কী দিলে", "বটের উত্তর / মাস"],
    shopH: "দোকানের জন্য (ই-কমার্স)",
    svcH: "সেবা-ভিত্তিক ব্যবসার জন্য",
    notes: [
      "ফ্রি ট্রায়াল: ৩ দিন, দিনে ৩০টি পর্যন্ত বটের উত্তর। কার্ড বা পেমেন্টের কোনো তথ্য চাওয়া হয় না।",
      "বছরে একসাথে দিলে বারো মাসের বদলে দশ মাসের দাম।",
      "“উত্তর” মানে বট গ্রাহককে পাঠানো একটি বার্তা। আপনি নিজে হাতে যা লিখবেন, তা কখনো গোনা হয় না।",
      "নিজের গুগল বা ওপেনএআই কী দিলে প্যাকেজের দাম চতুর্থ কলামের মতো কমে যাবে; তখন এআই-এর খরচ সরাসরি প্রোভাইডারকে দেবেন।",
      "পেমেন্ট বিকাশ, নগদ বা রকেটে।",
    ],
  },
};

// ── Comparison ─────────────────────────────────────────────────────────────
export const COMPARISON = {
  sources: [
    {
      name: "Chatfuel", url: "chatfuel.com/pricing", read: "25 Sep 2026",
      en: "Business US$20 a month (US$18 if billed yearly), including US$20 of AI credit a month. Agency S US$90 a month.",
      bn: "Business ২০ মার্কিন ডলার/মাস (বছরে দিলে ১৮), সাথে মাসে ২০ ডলারের এআই ক্রেডিট। Agency S ৯০ ডলার/মাস।",
    },
    {
      name: "Tidio", url: "tidio.com/pricing", read: "25 Sep 2026",
      en: "Free for 50 conversations. Starter US$29 a month for 100 billable conversations. Growth from US$59 a month for 250. The Lyro AI agent is a separate add-on from US$32.50 a month.",
      bn: "ফ্রিতে ৫০টি কথোপকথন। Starter ২৯ ডলার/মাস, ১০০টি বিলযোগ্য কথোপকথনের জন্য। Growth ৫৯ ডলার/মাস থেকে, ২৫০টির জন্য। Lyro AI আলাদা অ্যাড-অন, ৩২.৫০ ডলার/মাস থেকে।",
    },
  ],
  en: {
    h: "How TellMore AI compares",
    lead: "There are good chatbot platforms in the world. Most of them were not built for a business in Bangladesh. What follows is where TellMore AI differs, on points you can check for yourself — not a claim that one product beats another at everything.",
    cols: ["", "TellMore AI", "Typical global platform"],
    rows: [
      ["Language", "Answers in Bangla, in English, and in Banglish typed in English letters — because that is how customers here actually write.", "Built English-first. Bangla varies by provider, and Banglish is rarely handled at all."],
      ["Price and currency", "Priced in taka. Paid with bKash, Nagad or Rocket.", "Priced in US dollars and paid by international card, which many small businesses here do not have."],
      ["What you pay for", "Bot replies per month, stated plainly. Replies you type yourself are free.", "Often per “conversation” or per contact, counted in ways worth reading carefully. Check each provider's own definition."],
      ["AI cost", "Included — or bring your own Google or OpenAI key and pay less for the package.", "Frequently a separate add-on or a monthly credit balance on top of the plan."],
      ["Channels", "Messenger, Instagram, WhatsApp and a website widget — all four in every package, including the cheapest.", "Channels are commonly divided across price tiers."],
      ["Your catalogue", "The bot quotes only the prices and stock written in your catalogue, and is built so it cannot invent a price.", "Varies. Many are flow builders, where you write the answers and the branching yourself."],
      ["Support", "In Bangladesh, in Bangla, in your own working hours.", "Usually email, from another country and another working day."],
    ],
    honest_h: "Where we are the smaller company",
    honest: [
      "Autolinium is a young Bangladeshi company. The global platforms have run for years, have far larger teams, and have app-store integrations and marketplace listings that we do not.",
      "We publish no customer case studies, because we have not measured any yet. When we have, we will publish the measurement rather than the adjective.",
      "Competitor prices change. Everything quoted here was read from the companies' own pages on 25 September 2026 — please check for yourself before relying on it.",
    ],
    src_h: "Sources for the prices above",
  },
  bn: {
    h: "TellMore AI-এর সাথে অন্যদের তুলনা",
    lead: "পৃথিবীতে ভালো চ্যাটবট প্ল্যাটফর্ম আছে। কিন্তু বেশিরভাগই বাংলাদেশের ব্যবসার কথা ভেবে বানানো নয়। নিচে দেখানো হলো TellMore AI কোথায় আলাদা — এমন বিষয় যা আপনি নিজে যাচাই করতে পারবেন। “আমরাই সব দিকে সেরা” — এমন দাবি এটা নয়।",
    cols: ["", "TellMore AI", "সাধারণ বিদেশি প্ল্যাটফর্ম"],
    rows: [
      ["ভাষা", "বাংলা, ইংরেজি আর ইংরেজি অক্ষরে লেখা বাংলা (বাংলিশ) — কারণ এখানকার গ্রাহক আসলে এভাবেই লেখেন।", "মূলত ইংরেজির জন্য বানানো। বাংলা কতটা চলবে তা একেক প্রতিষ্ঠানে একেক রকম, আর বাংলিশ সাধারণত বোঝেই না।"],
      ["দাম ও মুদ্রা", "টাকায় দাম। বিকাশ, নগদ বা রকেটে পেমেন্ট।", "ডলারে দাম, আর আন্তর্জাতিক কার্ডে পেমেন্ট — যা এখানকার অনেক ছোট ব্যবসার নেই।"],
      ["কিসের জন্য টাকা", "মাসে বটের কতগুলো উত্তর, পরিষ্কার করে লেখা। আপনার নিজের লেখা উত্তর একদম ফ্রি।", "প্রায়ই “কথোপকথন” বা যোগাযোগের সংখ্যা ধরে — কীভাবে গোনা হয় তা ভালো করে পড়ে নেওয়ার মতো। প্রত্যেকের নিজস্ব সংজ্ঞা দেখে নেবেন।"],
      ["এআই-এর খরচ", "প্যাকেজেই ধরা — কিংবা নিজের গুগল বা ওপেনএআই কী দিয়ে প্যাকেজের দাম কমিয়ে নিন।", "প্রায়ই আলাদা অ্যাড-অন, কিংবা প্ল্যানের উপরে মাসিক আলাদা ক্রেডিট।"],
      ["চ্যানেল", "মেসেঞ্জার, ইনস্টাগ্রাম, হোয়াটসঅ্যাপ আর ওয়েবসাইট উইজেট — চারটাই প্রতিটি প্যাকেজে, সবচেয়ে সস্তাটিতেও।", "চ্যানেলগুলো সাধারণত দামের ধাপ অনুযায়ী ভাগ করা থাকে।"],
      ["আপনার ক্যাটালগ", "বট শুধু আপনার ক্যাটালগে লেখা দাম আর স্টকই বলে; দাম বানিয়ে বলা যাতে না পারে, সেভাবেই বানানো।", "একেক পণ্যে একেক রকম। অনেকগুলোই ফ্লো-বিল্ডার, যেখানে উত্তর আর শাখা-প্রশাখা আপনাকেই সাজাতে হয়।"],
      ["সাপোর্ট", "বাংলাদেশে, বাংলায়, আপনার কাজের সময়েই।", "সাধারণত ইমেইলে, অন্য দেশ থেকে, অন্য কর্মদিবসে।"],
    ],
    honest_h: "যেখানে আমরাই ছোট প্রতিষ্ঠান",
    honest: [
      "অটোলিনিয়াম একটি নতুন বাংলাদেশি কোম্পানি। বিদেশি প্ল্যাটফর্মগুলো বছরের পর বছর চলছে, তাদের দল অনেক বড়, আর অ্যাপ-স্টোর ইন্টিগ্রেশন ও মার্কেটপ্লেসে তালিকাভুক্তি আছে — যেগুলো আমাদের নেই।",
      "আমরা কোনো গ্রাহকের সাফল্যের গল্প প্রকাশ করি না, কারণ এখনো কিছুই মেপে দেখিনি। যেদিন মাপব, সেদিন বিশেষণ নয় — মাপটাই প্রকাশ করব।",
      "প্রতিযোগীদের দাম বদলায়। এখানে যা লেখা, সবই তাঁদের নিজের পাতা থেকে ২৫ সেপ্টেম্বর ২০২৬ তারিখে দেখা — ভরসা করার আগে নিজে একবার দেখে নেবেন।",
    ],
    src_h: "উপরের দামগুলোর সূত্র",
  },
};

// ── Security ───────────────────────────────────────────────────────────────
export const SECURITY = {
  en: {
    h: "Your data",
    items: [
      ["One business cannot see another", "The separation is enforced by the database itself, not by a rule a programmer has to remember. Every table is locked, and every row is tied to the account that owns it."],
      ["Your keys stay yours", "If you use your own AI key it is verified, encrypted and stored; no screen ever shows it again in full."],
      ["We follow the platforms' rules", "Messenger and WhatsApp allow a business to message a customer only within 24 hours of that customer's message. The product enforces this for you, so your Page is not put at risk."],
      ["You can delete everything", "Deleting your business deletes its products, chats, orders and uploaded files along with it."],
    ],
  },
  bn: {
    h: "আপনার তথ্য",
    items: [
      ["এক ব্যবসা আরেক ব্যবসার কিছু দেখতে পায় না", "এই আলাদা থাকাটা ডেটাবেস নিজেই বাধ্য করে — কোনো প্রোগ্রামারের মনে রাখার উপর নির্ভর করে না। প্রতিটি টেবিল তালাবদ্ধ, আর প্রতিটি সারি তার মালিক অ্যাকাউন্টের সাথে বাঁধা।"],
      ["আপনার কী আপনারই থাকে", "নিজের এআই কী ব্যবহার করলে সেটা যাচাই করে, এনক্রিপ্ট করে জমা রাখা হয়; কোনো পর্দায় আর কখনো পুরোটা দেখা যায় না।"],
      ["আমরা প্ল্যাটফর্মের নিয়ম মানি", "মেসেঞ্জার ও হোয়াটসঅ্যাপে গ্রাহকের মেসেজের ২৪ ঘণ্টার ভেতরেই কেবল ব্যবসা তাঁকে লিখতে পারে। সিস্টেম নিজেই এটা মেনে চলে, তাই আপনার পেজ ঝুঁকিতে পড়ে না।"],
      ["সব মুছে ফেলতে পারবেন", "ব্যবসা মুছে ফেললে তার পণ্য, চ্যাট, অর্ডার আর আপলোড করা ফাইলও সাথে মুছে যায়।"],
    ],
  },
};

// ── Contact ────────────────────────────────────────────────────────────────
export const CONTACT = {
  en: {
    h: "Contact",
    lead: "TellMore AI is built and run by Autolinium.",
    labels: { company: "Company", product: "Product", email: "Email", phone: "Phone", address: "Address", web: "Website" },
    cta: "Start the free trial at www.tellmoreai.com — three days, no card.",
  },
  bn: {
    h: "যোগাযোগ",
    lead: "TellMore AI তৈরি ও পরিচালনা করে অটোলিনিয়াম।",
    labels: { company: "কোম্পানি", product: "পণ্য", email: "ইমেইল", phone: "ফোন", address: "ঠিকানা", web: "ওয়েবসাইট" },
    cta: "ফ্রি ট্রায়াল শুরু করুন www.tellmoreai.com-এ — তিন দিন, কার্ড ছাড়াই।",
  },
};
