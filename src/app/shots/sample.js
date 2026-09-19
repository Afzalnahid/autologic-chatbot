// Invented data for documentation screenshots. Nothing here is real.
//
// Every name, number and message is made up on purpose: the manual is a public
// page, and a screenshot of the live dashboard would put real customers'
// names, phone numbers and messages on the open internet.
//
// Two exports:
//   SAMPLE — keyed by API path. The studio's fetch stub answers from this, so a
//            tab that fetches its own data gets it without touching Supabase.
//   PROPS  — for the tabs the dashboard hands data to as props (see the load()
//            in dashboard-client.js: products, conversations, orders, settings
//            and channels all come straight off those same endpoints).
//
// Shapes were read off the API routes and the components, not guessed. If a
// route's response changes, a screenshot retake will show it immediately.

const iso = (minsAgo) => new Date(Date.now() - minsAgo * 60000).toISOString();
const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

// ---------------------------------------------------------------- channels
const CHANNELS = [
  { id: "ch1", platform: "facebook", page_id: "102938475610293", name: "Nokshi Threads",
    status: "connected", connected_at: iso(60 * 24 * 46),
    comment_reply_enabled: true, comment_dm_enabled: true },
  { id: "ch2", platform: "facebook", page_id: "102938475610777", name: "Nokshi Threads — Wholesale",
    status: "paused", connected_at: iso(60 * 24 * 12),
    comment_reply_enabled: true, comment_dm_enabled: false },
  { id: "ch3", platform: "instagram", page_id: "17841400000000000", name: "@nokshithreads",
    status: "connected", connected_at: iso(60 * 24 * 9),
    comment_reply_enabled: true, comment_dm_enabled: true },
  { id: "ch4", platform: "whatsapp", page_id: "8801700000000", name: "+880 17XX-XXXXXX",
    status: "connected", connected_at: iso(60 * 24 * 3) },
  { id: "ch5", platform: "website", page_id: "wgt_9f2a7c", status: "connected",
    allowed_domains: ["nokshithreads.com", "shop.nokshithreads.com"] },
];

// ----------------------------------------------------------- conversations
const CONVOS = [
  { id: "u1", sender: "Tasnim Rahman", platform: "instagram", page_id: "17841400000000000",
    status: "active", lastMsg: "Ei design ta ki M size e ache?", time: iso(4),
    messages: [
      { role: "customer", text: "Ei design ta ki M size e ache?", attachments: [], time: iso(6) },
      { role: "bot", text: "Yes — the navy panjabi is in stock in M. It is 1,450 taka, and delivery inside Dhaka is 60 taka, one to two days.", attachments: [], time: iso(5) },
      { role: "customer", text: "Accha, ordr korte chai", attachments: [], time: iso(4) },
    ] },
  { id: "u2", sender: "Rahim Uddin", platform: "facebook", page_id: "102938475610293",
    status: "active", lastMsg: "Delivery charge koto Cumilla te?", time: iso(58),
    messages: [
      { role: "customer", text: "Delivery charge koto Cumilla te?", attachments: [], time: iso(62) },
      { role: "bot", text: "Outside Dhaka the delivery charge is 120 taka and it usually takes two to three days.", attachments: [], time: iso(58) },
    ] },
  { id: "u3", sender: "Farhana Akter", platform: "whatsapp", page_id: "8801700000000",
    status: "resolved", lastMsg: "Thank you! Order confirmed.", time: iso(220),
    messages: [
      { role: "customer", text: "amar order ta kobe pabo?", attachments: [], time: iso(240) },
      { role: "agent", text: "Sorry for the delay — it left our warehouse this morning and should reach you tomorrow.", attachments: [], time: iso(230) },
      { role: "customer", text: "Thank you! Order confirmed.", attachments: [], time: iso(220) },
    ] },
  { id: "u4", sender: "Website visitor", platform: "website", page_id: "wgt_9f2a7c",
    status: "resolved", lastMsg: "Do you ship to Sylhet?", time: iso(400),
    messages: [
      { role: "customer", text: "Do you ship to Sylhet?", attachments: [], time: iso(402) },
      { role: "bot", text: "Yes, we deliver all over the country. Sylhet takes two to three days and the charge is 120 taka.", attachments: [], time: iso(400) },
    ] },
];

// ---------------------------------------------------------------- products
const PRODUCTS = [
  { id: "p1", created_at: iso(60 * 30), product_name: "Cotton panjabi — navy", product_code: "PJ-NVY-01",
    brand: "Nokshi", category: "Men › Panjabi", tags: "cotton, summer, eid",
    regular_price: 1650, sale_price: 1450, stock_qty: 12, stock_status: "instock",
    description: "Soft cotton panjabi that does not shrink. Comfortable in summer heat.",
    variants: [{ name: "M" }, { name: "L" }, { name: "XL" }] },
  { id: "p2", created_at: iso(60 * 90), product_name: "Half-sleeve polo — olive", product_code: "PL-OLV-04",
    brand: "Nokshi", category: "Men › Polo", tags: "cotton, casual",
    regular_price: 850, stock_qty: 3, stock_status: "instock",
    description: "Everyday polo in breathable pique cotton." },
  { id: "p3", created_at: iso(60 * 200), product_name: "Kids' kurta set — mustard", product_code: "KD-MST-02",
    brand: "Nokshi", category: "Kids", tags: "eid, gift",
    regular_price: 1200, sale_price: 990, stock_qty: 0, stock_status: "outofstock",
    description: "Two-piece kurta and pyjama set for ages 4 to 8." },
  { id: "p4", created_at: iso(60 * 300), product_name: "Handloom shawl", product_code: "SH-HND-11",
    brand: "Nokshi", category: "Winter", tags: "handloom, winter, gift",
    regular_price: 2400, stock_qty: 7, stock_status: "instock",
    description: "Woven by hand in Tangail. Warm without being heavy." },
];

// ------------------------------------------------------------------ orders
const order = (o) => ({
  subtotal: 0, delivery_charge: null, discount: 0, items: [], qty_total: 0, ...o,
});
const ORDERS = [
  order({ id: "o1", order_code: "A-1042", sender_id: "u1", customer_name: "Tasnim Rahman", phone_number: "017XXXXXXXX",
    address: "House 12, Road 4, Dhanmondi, Dhaka", delivery_area: "inside Dhaka",
    status: "Pending", platform: "instagram", created_at: iso(20),
    items: [{ code: "PJ-NVY-01", name: "Cotton panjabi — navy", variant: "M", qty: 1, unit_price: 1450 }],
    subtotal: 1450, delivery_charge: 60, total: 1510, qty_total: 1, payment_method: "Cash on delivery" }),
  order({ id: "o2", order_code: "A-1041", sender_id: "u2", customer_name: "Rahim Uddin", phone_number: "018XXXXXXXX",
    address: "Kandirpar, Cumilla", delivery_area: "outside Dhaka",
    status: "Shipped", platform: "facebook", created_at: iso(60 * 26),
    items: [{ code: "PL-OLV-04", name: "Half-sleeve polo — olive", variant: "L", qty: 2, unit_price: 850 }],
    subtotal: 1700, delivery_charge: 120, total: 1820, qty_total: 2, payment_method: "bKash",
    owner_note: "Courier: Pathao, tracking 12345." }),
  order({ id: "o3", order_code: "A-1039", customer_name: "Farhana Akter", phone_number: "019XXXXXXXX",
    address: "Zindabazar, Sylhet", delivery_area: "outside Dhaka",
    status: "Delivered", platform: "whatsapp", created_at: iso(60 * 74),
    items: [{ code: "SH-HND-11", name: "Handloom shawl", variant: "", qty: 1, unit_price: 2400 }],
    subtotal: 2400, delivery_charge: 120, discount: 200, total: 2320, qty_total: 1,
    payment_method: "Cash on delivery", owner_note: "Gift wrap requested." }),
];

// --------------------------------------------------------------- analytics
const DAILY = Array.from({ length: 30 }, (_, i) => {
  const n = 29 - i;
  const wave = Math.round(18 + 11 * Math.sin(i / 3.1) + (i % 7 === 5 ? 9 : 0));
  return { date: day(n), customer: wave, bot: Math.round(wave * 1.35) };
});
const HOURS = Array.from({ length: 24 }, (_, h) => ({
  hour: h,
  count: h < 7 ? Math.round(2 + h) : Math.round(14 + 30 * Math.exp(-Math.pow(h - 21, 2) / 26)),
}));

const ANALYTICS = {
  generated_at: iso(1),
  kpi: {
    total_messages: 1834, messages_today: 62,
    unique_contacts: 412, new_contacts: 148, returning_contacts: 264,
    customer_messages: 781, bot_messages: 1053,
    image_messages: 96, voice_messages: 23, peak_hour: 21,
    revenue: 214500, orders: 137, avg_order_value: 1565,
    bookings: 0, conversion_pct: 33,
  },
  growth: {
    messages: 18, contacts: 12, conversations: 9, bot_handled_points: 6,
    revenue: 21, conversions: 14, previous: { conversions: 120 },
  },
  conversations: {
    total: 386, avg_messages: 4.7,
    bot_resolved: 313, bot_resolved_pct: 81, handoff: 71, unanswered: 2,
  },
  daily: DAILY,
  hours: HOURS,
  channels: [
    { platform: "facebook", total: 862, contacts: 201 },
    { platform: "instagram", total: 613, contacts: 148 },
    { platform: "whatsapp", total: 359, contacts: 63 },
  ],
  top_queries: [
    { name: "delivery", count: 164 }, { name: "price", count: 141 },
    { name: "size", count: 118 }, { name: "stock", count: 77 },
    { name: "cash on delivery", count: 52 },
  ],
  top_products: [
    { name: "Cotton panjabi — navy", count: 46 },
    { name: "Handloom shawl", count: 31 },
    { name: "Half-sleeve polo — olive", count: 24 },
    { name: "Kids' kurta set — mustard", count: 18 },
  ],
  top_services: [],
  conversions_daily: DAILY.map((d) => ({ date: d.date, orders: Math.max(1, Math.round(d.customer / 4)) })),
  order_status: [
    { status: "Pending", count: 11 }, { status: "Shipped", count: 24 },
    { status: "Delivered", count: 96 }, { status: "Cancelled", count: 6 },
  ],
};

// --------------------------------------------------------------- broadcast
const BROADCAST = {
  business_type: "ecommerce",
  max_message: 900,
  channels: [{ platform: "facebook" }, { platform: "instagram" }, { platform: "whatsapp" }],
  quota: { limit: 2000, remaining: 1642, period: "month", unlimited: false },
  available_tags: ["Order", "Product Inquiry", "Delivery", "Complaint", "Other"],
  broadcasts: [
    { id: "b1", created_at: iso(60 * 5), channel: "all", sent: 148, failed: 3, skipped: 22,
      message: "Eid collection is live — new panjabi designs in every size, and free delivery inside Dhaka until Friday." },
    { id: "b2", created_at: iso(60 * 52), channel: "instagram", sent: 61, failed: 0, skipped: 9,
      message: "Restocked: the navy panjabi is back in M, L and XL." },
  ],
};

// --------------------------------------------------------------- knowledge
// created_at and file_url are real columns on file_registry that the tab
// shows — the upload date, and a link to the stored original. They were
// missing here, so the screenshots quietly documented a thinner tab than the
// one a client actually gets.
const KNOWLEDGE = [
  { file_id: "k1", file_name: "Service list and pricing 2026.pdf", file_type: "application/pdf", chunks: 34,
    created_at: iso(60 * 24 * 5), file_url: "https://example.com/service-list.pdf" },
  { file_id: "k2", file_name: "Standard proposal template.docx", file_type: "docx", chunks: 22,
    created_at: iso(60 * 24 * 18), file_url: "https://example.com/proposal.docx" },
  { file_id: "k3", file_name: "Frequently asked questions.txt", file_type: "text/plain", chunks: 11,
    created_at: iso(60 * 24 * 31), file_url: "https://example.com/faq.txt" },
];

// ---------------------------------------------------------------- bookings
// meeting_datetime is the real timestamp the calendar and the sort both use;
// meeting_date and meeting_time are the looser strings the bot wrote down.
const at = (days, hour) => {
  const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hour, 0, 0, 0); return d;
};
const booking = (o, d) => ({
  ...o,
  meeting_datetime: d.toISOString(),
  meeting_date: d.toISOString().slice(0, 10),
  meeting_time: `${String(d.getHours()).padStart(2, "0")}:00`,
});
const BOOKINGS = [
  booking({ id: "bk1", customer_name: "Imran Hossain", email: "imran@example.com", phone: "017XXXXXXXX",
    service_want: "Facebook ads consultation", status: "Confirmed", platform: "facebook",
    meeting_link: "https://meet.google.com/abc-defg-hij", calendar_event_id: "evt_1" }, at(1, 15)),
  booking({ id: "bk2", customer_name: "Shirin Akhter", email: "shirin@example.com", phone: "018XXXXXXXX",
    service_want: "SEO strategy call", status: "Confirmed", platform: "instagram",
    meeting_link: "https://meet.google.com/klm-nopq-rst", calendar_event_id: "evt_2" }, at(3, 11)),
  booking({ id: "bk3", customer_name: "Nabil Chowdhury", email: "nabil@example.com", phone: "019XXXXXXXX",
    service_want: "Brand audit", status: "Completed", platform: "whatsapp" }, at(-2, 17)),
];

// ----------------------------------------------------------- bot training
const SETTINGS = {
  botName: "Nokshi Assistant", businessName: "Nokshi Threads",
  greeting: "Assalamu alaikum! Ki khujchen bolun, ami help korte pari.",
  tone: "friendly", languages: "auto",
  description: "We sell hand-finished cotton clothing for men, women and children. Prices run from 850 to 2,400 taka.",
  products: "Panjabi, polo shirts, kids' kurta sets and handloom shawls. Best sellers are the navy panjabi and the handloom shawl.",
  delivery: "Inside Dhaka 60 taka, one to two days. Outside Dhaka 120 taka, two to three days.",
  deliveryAreas: "All over the country. No delivery to the hill districts.",
  payment: "Cash on delivery, bKash and Nagad.",
  advancePay: "Advance of 100 taka for outside-Dhaka orders. None inside Dhaka.",
  returnPolicy: "Exchange within 7 days if there is a problem with the item.",
  stock: "Say it will be back in about a week and suggest a similar item.",
  warranty: "No warranty on clothing.",
  hours: "Every day, 10am to 10pm.",
  faq: "Q: Is it in stock?\nA: Most sizes are in stock; ask for the size you want.",
  complaints: "Apologise, ask for the order number and photos, promise a call within an hour.",
  systemPrompt: "You sell hand-finished cotton clothing…",
  offers: [
    { id: "of1", enabled: true, offer: "Buy any two panjabi and delivery is free anywhere in the country.",
      details: "Applies to full-price panjabi only. Cannot be combined with the Eid discount.",
      valid_until: day(-21), products: ["PJ-NVY-01"] },
  ],
  bargain: { enabled: true, mode: "limited", max_discount_pct: 8, custom: "" },
  followup: { enabled: true, hours: 6, message: "" },
};

const ME = { client: { id: "demo", business_type: "ecommerce", business_name: "Nokshi Threads" } };

// ---------------------------------------------------------------- ai engine
// provider is the PROVIDERS key in AIEngine.js ("google"), and model is the
// main and fallback ids in one comma-separated string — not an object.
const AI_KEY = {
  allowed: true, provider: "google", model: "gemini-2.5-flash,gemini-2.5-pro",
  key_mask: "AIza••••••••••••••••••••3f7Q", has_key: true, status: "ok",
  last_verified_at: iso(90), key_added_at: iso(60 * 24 * 5), last_error: null, last_error_at: null,
};

// ----------------------------------------------------------------- billing
const BILLING = {
  plan: "shop_growth", plan_name: "Shop Growth", active: true,
  // A shop, so the upgrade list must show the three Shop packages and none of
  // the Service ones. This is the whole point of the fixture carrying a type.
  business_type: "ecommerce",
  trial_end: null, plan_expires_at: new Date(Date.now() + 19 * 86400000).toISOString(),
  suspended: false,
  usage: { today: 62, month: 1834, daily_limit: null, monthly_limit: 5000, pct: 37 },
  methods: [
    { id: "bkash", label: "bKash", number: "01XXXXXXXXX", type: "Send Money" },
    { id: "nagad", label: "Nagad", number: "01XXXXXXXXX", type: "Send Money" },
  ],
  pending_request: null,
  requests: [
    { id: "r1", plan: "growth", cycle: "monthly", amount: 1500, status: "approved",
      txn_id: "9A7B2C1D5E", created_at: iso(60 * 24 * 11) },
    { id: "r2", plan: "starter", cycle: "monthly", amount: 800, status: "approved",
      txn_id: "4F8E1B6C2A", created_at: iso(60 * 24 * 42) },
  ],
};

// ----------------------------------------------------------------- profile
const PROFILE = {
  email: "owner@nokshithreads.com", client_id: "demo",
  business_name: "Nokshi Threads", phone: "+880 17XX-XXXXXX",
  address: "Kandirpar, Cumilla, Bangladesh", website: "https://nokshithreads.com",
  business_type: "ecommerce", item_label: "", logo_url: "",
  plan: "growth", trial_end: null, created_at: iso(60 * 24 * 96),
  // The Resources card reads these counts (products/orders for a shop, files
  // and bookings for an agency, plus channels either way).
  usage: { today: 62, month: 1834, monthly_limit: 5000,
    products: 4, orders: 137, channels: 5, files: 3, bookings: 0 },
};

// Answered by the studio's fetch stub, matched on the start of the URL.
// ── Admin: packages & API usage ─────────────────────────────────────────────
// Shaped exactly like /api/admin/packages so the admin console can be checked
// and photographed without a super-admin login.
//
// Only the raw counts below are written by hand — every cost, area total, model
// row and grand total is COMPUTED from them at the same rates the real price
// book holds. The panel has a "check the arithmetic" table, and a fixture whose
// arithmetic does not check out would be a poor thing to photograph.
const RATE = {
  "gemini-2.5-flash": { in: 0.3, out: 2.5, priced: true },
  "gemini-3-flash-preview": { in: 0.3, out: 2.5, priced: false }, // falls back to __default__
  "gemini-embedding-001": { in: 0.15, out: 0, priced: true },
};
const AREA_OF = {
  "bot.chat": "bot", "bot.embed": "bot", "bot.vision": "bot", "bot.voice": "bot",
  "bot.language": "bot", "bot.tag": "bot", "bot.comment": "bot",
  "product.embed": "catalogue", "product.vision": "catalogue", "product.scrape": "catalogue",
  "knowledge.embed": "catalogue",
  "platform.prompt": "platform", "platform.offer": "platform",
};
const costOf = (m, tin, tout) => (tin / 1e6) * RATE[m].in + (tout / 1e6) * RATE[m].out;

// [feature, model, calls, tokensIn, tokensOut, ownKey?]
function rollUp(lines) {
  const blank = () => ({ calls: 0, tokensIn: 0, tokensOut: 0, tokens: 0, cost: 0, ownKeyCost: 0 });
  const add = (b, [, , calls, tin, tout, own], c) => {
    b.calls += calls; b.tokensIn += tin; b.tokensOut += tout; b.tokens += tin + tout;
    if (own) b.ownKeyCost += c; else b.cost += c;
  };
  const by_feature = {}, by_area = {}, by_model = {}, by_kind = {};
  let calls = 0, tokens_in = 0, tokens_out = 0, cost_usd = 0, own_key_cost_usd = 0;
  for (const l of lines) {
    const [f, m, n, tin, tout, own] = l;
    const c = costOf(m, tin, tout);
    calls += n; tokens_in += tin; tokens_out += tout;
    if (own) own_key_cost_usd += c; else cost_usd += c;
    const kind = f.endsWith(".embed") ? "embed" : f.endsWith(".vision") ? "vision"
      : f.endsWith(".voice") ? "voice" : f.endsWith(".scrape") ? "scrape" : "chat";
    for (const [map, key] of [[by_feature, f], [by_area, AREA_OF[f]], [by_kind, kind]]) {
      map[key] = map[key] || blank();
      add(map[key], l, c);
    }
    const mk = `google/${m}`;
    by_model[mk] = by_model[mk] || { ...blank(), provider: "google", model: m, priced: RATE[m].priced, input_per_1m: RATE[m].in, output_per_1m: RATE[m].out };
    add(by_model[mk], l, c);
  }
  const unpriced = Object.values(by_model).filter((m) => !m.priced)
    .map((m) => ({ provider: "google", model: m.model, calls: m.calls, cost: m.cost }));
  return {
    calls, tokens_in, tokens_out, tokens: tokens_in + tokens_out,
    cost_usd, own_key_cost_usd, by_feature, by_area, by_model, by_kind, unpriced,
  };
}

const FLASH = "gemini-2.5-flash", PREVIEW = "gemini-3-flash-preview", EMB = "gemini-embedding-001";

// A busy shop on Pro: photos, voice notes, a catalogue import, and the language
// rewrite firing more often than the owner would guess.
const C1_LINES = [
  ["bot.chat", FLASH, 4820, 6952000, 421000],
  ["bot.chat", PREVIEW, 180, 262000, 15400],       // a few replies rode a model with no price set
  ["bot.embed", EMB, 4820, 578000, 0],
  ["bot.vision", FLASH, 612, 428000, 31400],
  ["bot.voice", FLASH, 184, 96000, 8600],
  ["bot.language", FLASH, 2890, 246000, 34200],
  ["bot.tag", FLASH, 374, 39000, 3200],
  ["bot.comment", FLASH, 40, 46000, 2800],
  ["product.embed", EMB, 302, 604000, 0],
  ["product.vision", FLASH, 48, 132000, 9200],
  ["product.scrape", FLASH, 8, 118000, 4400],
  ["platform.prompt", FLASH, 6, 11000, 2400],
  ["platform.offer", FLASH, 2, 3000, 600],
];
// An agency on their own key: chat is their money, embeddings are still ours.
const C2_LINES = [
  ["bot.chat", FLASH, 1240, 2104000, 138000, true],
  ["bot.embed", EMB, 1240, 496000, 0],
  ["bot.language", FLASH, 918, 214000, 22600, true],
  ["bot.tag", FLASH, 108, 32000, 2400, true],
  ["knowledge.embed", EMB, 102, 175000, 0],
];
// A quiet new shop on Starter — barely any traffic yet.
const C3_LINES = [
  ["bot.chat", FLASH, 96, 108000, 8800],
  ["bot.embed", EMB, 96, 11400, 0],
  ["bot.tag", FLASH, 6, 2000, 700],
  ["product.embed", EMB, 16, 37500, 0],
];

const C1 = rollUp(C1_LINES), C2 = rollUp(C2_LINES), C3 = rollUp(C3_LINES);
const ALL = rollUp([...C1_LINES, ...C2_LINES, ...C3_LINES]);

const ADMIN_PACKAGES = {
  role: "owner",
  days: 30,
  // The seven real packages, so the studio shows the ladder that is actually
  // sold rather than the three it replaced. The trial deliberately keeps a
  // per-channel cap and a monthly figure it should not have, because those are
  // what the limit warnings exist to catch.
  plans: [
    { id: "trial", biz: "both", name: "Free Trial", tagline: "Try everything for a few days", sort: 0, active: true, public: true, monthly: 0, yearly: 0, messages_per_day: 30, messages_per_month: 900, messages_per_channel: 10, channels: 1, max_products: 20, max_kb_files: 2, max_scrapes_per_month: 5, max_broadcasts_per_month: 2, features: { vision: true, voice: true, kb: true, calendar: true, widget: true, broadcast: true, followup: true }, feature_list: [] },

    { id: "shop_starter", biz: "ecommerce", name: "Shop Starter", tagline: "One channel, your catalogue answering for itself", sort: 1, active: true, public: true, monthly: 1500, yearly: 15000, messages_per_month: 3000, channels: 1, max_products: 300, max_kb_files: 0, max_scrapes_per_month: 20, max_broadcasts_per_month: 4, features: { widget: true, broadcast: true, followup: true }, feature_list: [] },
    { id: "shop_growth", biz: "ecommerce", name: "Shop Growth", tagline: "Every channel, and customers who send photos instead of names", sort: 2, active: true, public: true, monthly: 3500, yearly: 35000, messages_per_month: 15000, channels: 3, max_products: 3000, max_kb_files: 0, max_scrapes_per_month: 200, max_broadcasts_per_month: 20, highlight: true, features: { vision: true, voice: true, comments: true, widget: true, broadcast: true, followup: true }, feature_list: [] },
    { id: "shop_scale", biz: "ecommerce", name: "Shop Scale", tagline: "For a catalogue and a crowd that keep growing", sort: 3, active: true, public: true, monthly: 6000, yearly: 60000, messages_per_month: 50000, channels: 3, max_products: null, max_kb_files: 0, max_scrapes_per_month: null, max_broadcasts_per_month: null, features: { vision: true, voice: true, comments: true, widget: true, broadcast: true, followup: true, byok: true }, feature_list: [] },

    { id: "svc_starter", biz: "agency", name: "Service Starter", tagline: "One channel, answering from your own documents", sort: 4, active: true, public: true, monthly: 1500, yearly: 15000, messages_per_month: 3000, channels: 1, max_products: 0, max_kb_files: 10, max_scrapes_per_month: 20, max_broadcasts_per_month: 4, features: { kb: true, widget: true, broadcast: true, followup: true }, feature_list: [] },
    { id: "svc_growth", biz: "agency", name: "Service Growth", tagline: "Every channel, and meetings booked while you sleep", sort: 5, active: true, public: true, monthly: 3500, yearly: 35000, messages_per_month: 15000, channels: 3, max_products: 0, max_kb_files: 40, max_scrapes_per_month: 200, max_broadcasts_per_month: 20, highlight: true, features: { voice: true, kb: true, calendar: true, comments: true, widget: true, broadcast: true, followup: true }, feature_list: [] },
    { id: "svc_scale", biz: "agency", name: "Service Scale", tagline: "For a practice that answers all day", sort: 6, active: true, public: true, monthly: 6000, yearly: 60000, messages_per_month: 50000, channels: 3, max_products: 0, max_kb_files: null, max_scrapes_per_month: null, max_broadcasts_per_month: null, features: { voice: true, kb: true, calendar: true, comments: true, widget: true, broadcast: true, followup: true, byok: true }, feature_list: [] },

    // One of the three the split replaced. Kept inactive in the fixture as well
    // as in the database, so the panel's "Retired" group has something in it —
    // an empty group renders as nothing and proves nothing.
    { id: "pro", biz: "both", name: "Pro", tagline: "For growing businesses", sort: 90, active: false, public: false, monthly: 3500, yearly: 35000, messages_per_month: 15000, channels: 3, max_products: 3000, max_kb_files: 40, max_scrapes_per_month: 200, max_broadcasts_per_month: 20, features: {}, feature_list: [] },
  ],
  prices: [
    { provider: "google", model: "__default__", input_per_1m: 0.3, output_per_1m: 2.5 },
    { provider: "google", model: "gemini-2.5-flash", input_per_1m: 0.3, output_per_1m: 2.5 },
    { provider: "google", model: "gemini-2.5-pro", input_per_1m: 1.25, output_per_1m: 10 },
    { provider: "google", model: "gemini-embedding-001", input_per_1m: 0.15, output_per_1m: 0 },
  ],
  platform_costs: [
    { id: "vercel", label: "Vercel hosting", monthly_usd: 20 },
    { id: "supabase", label: "Supabase database", monthly_usd: 25 },
    { id: "resend", label: "Resend email", monthly_usd: 0 },
  ],
  // trial_days is deliberately NOT 3 here: every trial label is written in this
  // number, so a fixture that matched the built-in fallback could not tell a
  // value that was read from one that was assumed. The trial package's tagline
  // still says "3 days" for the same reason — that is the stale-copy warning
  // having something real to catch.
  settings: { usd_bdt: 120, usd_bdt_manual: false, usd_bdt_auto: 122.4, usd_bdt_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(), trial_days: 5 },
  // What the server decided the rate is, and where it came from — the panel
  // reads this rather than the raw setting, so the shot shows a market rate
  // with its age beside it.
  fx: { rate: 122.4, source: "market", at: new Date(Date.now() - 5 * 3600 * 1000).toISOString() },
  clients: [
    {
      client_id: "c1", business_name: "Nokshi Threads", owner_email: "owner@nokshithreads.com",
      plan: "pro", business_type: "ecommerce", suspended: false, limit_overrides: null, model_chain: null,
      messages: 4820, revenue_bdt: 3500, ...C1,
      // This one has had the page_id migration run: every call named its
      // channel, so the panel reads each channel's own spend instead of
      // splitting the client's by message share. Instagram costs more per
      // message here than Messenger — that is the whole reason the column
      // exists, and the shot should show it rather than two tidy shares.
      channel_measured: 1,
      channels: [
        { id: "ch1", client_id: "c1", platform: "facebook", page_id: "p1", name: "Nokshi Threads", status: "connected", msg_limit_monthly: null, messages: 3140,
          usage: { calls: 8940, tokens: 2_140_000, cost: 1.94, ownKeyCost: 0 } },
        { id: "ch2", client_id: "c1", platform: "instagram", page_id: "p2", name: "@nokshithreads", status: "connected", msg_limit_monthly: null, messages: 1680,
          usage: { calls: 6120, tokens: 1_880_000, cost: 1.71, ownKeyCost: 0 } },
      ],
    },
    {
      client_id: "c2", business_name: "Meridian Consulting", owner_email: "hello@meridian.consulting",
      plan: "agency", business_type: "agency", suspended: false, limit_overrides: null, model_chain: null,
      messages: 1240, revenue_bdt: 6000, ...C2,
      channels: [
        { id: "ch3", client_id: "c2", platform: "whatsapp", page_id: "p3", name: "Meridian", status: "connected", msg_limit_monthly: null, messages: 1240 },
      ],
    },
    {
      client_id: "c3", business_name: "Bengal Ceramics", owner_email: "shop@bengalceramics.com",
      // The per-channel cap here is an override, not the package's, so the
      // per-client grid has a conflict to report as well as the editor.
      plan: "starter", business_type: "ecommerce", suspended: false, limit_overrides: { max_products: 600, messages_per_channel: 500 }, model_chain: null,
      messages: 96, revenue_bdt: 1500, ...C3,
      channels: [
        { id: "ch4", client_id: "c3", platform: "facebook", page_id: "p4", name: "Bengal Ceramics", status: "connected", msg_limit_monthly: 3000, messages: 96 },
      ],
    },
  ],
  totals: {
    calls: ALL.calls, tokens: ALL.tokens, tokens_in: ALL.tokens_in, tokens_out: ALL.tokens_out,
    ai_cost_usd: ALL.cost_usd, own_key_cost_usd: ALL.own_key_cost_usd,
    by_kind: ALL.by_kind, by_area: ALL.by_area, by_feature: ALL.by_feature,
    by_model: ALL.by_model, unpriced: ALL.unpriced,
    fixed_monthly_usd: 45,
    fixed_window_usd: 45,
    messages: 4820 + 1240 + 96,
    // Where those messages arrived. Four channels, so the screenshot shows the
    // widget beside the three Meta ones rather than a single bar.
    messages_by_platform: { facebook: 3120, whatsapp: 1580, instagram: 980, website: 476 },
    messages_truncated: false,
    usage_truncated: false,
  },
};

export const SAMPLE = {
  "/api/comments": [
    // An Instagram row can only link to its post through the saved permalink;
    // the Facebook row below deliberately has none, so the screenshot also
    // exercises the {page_id}_{story_id} fallback.
    { id: "c1", platform: "instagram", page_id: "17841400000000000", post_id: "18000000000000000",
      permalink: "https://www.instagram.com/p/CxAmPlEp0sT/",
      commenter_name: "tasnim.rahman", created_at: iso(12),
      comment_text: "i want to know more details, please",
      reply_text: "Of course — I've sent you the full details in a message. Have a look and tell me what you think.",
      replied: true, dm_sent: true },
    { id: "c2", platform: "facebook", page_id: "102938475610293", post_id: "102938475610293_5550000",
      commenter_name: "Rahim Uddin", created_at: iso(96),
      comment_text: "Delivery ki Cumilla te ache? Price koto?",
      reply_text: "Yes, we deliver to Cumilla — usually within 2 days. The price is 1,450 BDT including delivery.",
      replied: true, dm_sent: false, dm_error: "This person cannot be messaged privately." },
  ],
  "/api/channels/website": { channel: CHANNELS[4] },
  "/api/channels": CHANNELS,
  "/api/conversations": CONVOS,
  "/api/contacts": {
    global_bot_enabled: true,
    contacts: [
      { sender_id: "u1", name: "Tasnim Rahman", bot_enabled: true },
      { sender_id: "u2", name: "Rahim Uddin", bot_enabled: true, needs_human: true },
      { sender_id: "u3", name: "Farhana Akter", bot_enabled: false },
      { sender_id: "u4", name: "Website visitor", bot_enabled: true },
    ],
  },
  "/api/tags": {
    available: ["Order", "Product Inquiry", "Delivery", "Complaint", "Other"],
    counts: { Order: 41, "Product Inquiry": 96, Delivery: 33, Complaint: 4, Other: 12 },
    complaint_tag: "Complaint",
    tags: { u1: [{ tag: "Order" }], u2: [{ tag: "Delivery" }], u3: [{ tag: "Complaint" }] },
  },
  "/api/analytics": ANALYTICS,
  "/api/broadcast": BROADCAST,
  "/api/knowledge": KNOWLEDGE,
  "/api/products": PRODUCTS,
  "/api/orders": ORDERS,
  "/api/bookings/list": { bookings: BOOKINGS },
  "/api/bookings": BOOKINGS,
  "/api/gcal/status": { connected: true, email: "owner@nokshithreads.com" },
  "/api/settings": SETTINGS,
  "/api/me": ME,
  "/api/ai-key/models": { models: [
    { id: "gemini-2.5-flash", tier: "fast", note: "Quick and cheap — good for most replies" },
    { id: "gemini-2.5-pro", tier: "smart", note: "Higher quality, costs more per message" },
    { id: "gemini-2.0-flash", tier: "fast", note: "Previous generation" },
  ] },
  "/api/ai-key": AI_KEY,
  "/api/billing": BILLING,
  // The same seven the admin panel edits, shaped as /api/plans returns them.
  // It used to be empty, which meant the Billing tab quietly fell back to the
  // static list in ui.js — so the screen under test was never the one shipped.
  "/api/plans": {
    plans: ADMIN_PACKAGES.plans.map((p) => ({
      id: p.id, biz: p.biz, name: p.name, tagline: p.tagline,
      monthly: p.monthly, yearly: p.yearly, highlight: !!p.highlight, features: [],
    })),
    meta: Object.fromEntries(ADMIN_PACKAGES.plans.map((p) => [p.id, { name: p.name }])),
  },
  "/api/profile": PROFILE,
  "/api/admin/packages": ADMIN_PACKAGES,
};

// The admin console's shell takes its data as a prop rather than fetching, so
// it can be mounted here without a super-admin login. Enough for every section
// to render — which is what makes the console's navigation checkable at all.
const series = (base) => Array.from({ length: 14 }, (_, i) => ({
  day: new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10),
  value: Math.round(base + Math.sin(i / 2) * base * 0.3),
}));

const ADMIN_CLIENTS = [
  { id: "c1", business_name: "Nokshi Threads", owner_email: "owner@nokshithreads.com", phone: "01711000111", plan: "pro", business_type: "ecommerce", suspended: false, pending_payment: false, trial_days_left: null, plan_days_left: 18, messages_7d: 1120, messages: 4820, created_at: new Date(Date.now() - 96 * 86400000).toISOString(), last_active: new Date(Date.now() - 3600000).toISOString(), gcal_connected: false, channels: [{ platform: "facebook", status: "connected" }, { platform: "instagram", status: "connected" }] },
  { id: "c2", business_name: "Meridian Consulting", owner_email: "hello@meridian.com.bd", phone: "01822000222", plan: "agency", business_type: "agency", suspended: false, pending_payment: true, trial_days_left: null, plan_days_left: 5, messages_7d: 310, messages: 1240, created_at: new Date(Date.now() - 61 * 86400000).toISOString(), last_active: new Date(Date.now() - 7200000).toISOString(), gcal_connected: true, channels: [{ platform: "whatsapp", status: "connected" }] },
  { id: "c3", business_name: "Bengal Ceramics", owner_email: "shop@bengalceramics.com", phone: "01933000333", plan: "starter", business_type: "ecommerce", suspended: false, pending_payment: false, trial_days_left: null, plan_days_left: 26, messages_7d: 24, messages: 96, created_at: new Date(Date.now() - 20 * 86400000).toISOString(), last_active: new Date(Date.now() - 86400000).toISOString(), gcal_connected: false, channels: [{ platform: "facebook", status: "connected" }] },
  { id: "c4", business_name: "Dhaka Dental", owner_email: "care@dhakadental.com", phone: "01644000444", plan: "trial", business_type: "agency", suspended: false, pending_payment: false, trial_days_left: 1, plan_days_left: null, messages_7d: 8, messages: 8, created_at: new Date(Date.now() - 2 * 86400000).toISOString(), last_active: new Date(Date.now() - 5400000).toISOString(), gcal_connected: false, channels: [] },
];

export const ADMIN = {
  email: "snowfix07@gmail.com",
  role: "super",
  // The catalogue /api/admin sends, so the plan dropdown in the client drawer
  // can be checked. It carries the retired package on purpose: a retired one
  // must be offered ONLY to a client already on it.
  plans: ADMIN_PACKAGES.plans.map((x) => ({
    id: x.id, name: x.name, biz: x.biz, active: x.active !== false, monthly: x.monthly,
  })),
  clients: ADMIN_CLIENTS,
  admins: [
    { email: "snowfix07@gmail.com", role: "super", added_at: new Date(Date.now() - 200 * 86400000).toISOString() },
    { email: "ops@autologic.com.bd", role: "editor", added_at: new Date(Date.now() - 30 * 86400000).toISOString() },
  ],
  payments: [
    { id: "r1", client_id: "c2", business_name: "Meridian Consulting", plan: "agency", cycle: "monthly", amount: 6000, status: "pending", method: "bkash", trx_id: "9F2K1LM4", created_at: new Date(Date.now() - 3 * 3600000).toISOString() },
    { id: "r2", client_id: "c1", business_name: "Nokshi Threads", plan: "pro", cycle: "monthly", amount: 3500, status: "approved", method: "nagad", trx_id: "7A1B2C3D", created_at: new Date(Date.now() - 9 * 86400000).toISOString() },
  ],
  attention: [
    { kind: "payment", level: "high", client_id: "c2", title: "Payment waiting for review", sub: "Meridian Consulting", at: new Date(Date.now() - 3 * 3600000).toISOString() },
    { kind: "trial", level: "mid", client_id: "c4", title: "Trial ends in 1 day", sub: "Dhaka Dental", at: new Date(Date.now() + 86400000).toISOString() },
    { kind: "nochannel", level: "low", client_id: "c4", title: "No channel connected", sub: "Dhaka Dental", at: new Date(Date.now() - 2 * 86400000).toISOString() },
  ],
  activity: [
    { kind: "signup", at: new Date(Date.now() - 2 * 86400000).toISOString(), client_id: "c4", title: "Dhaka Dental signed up", sub: "agency" },
    { kind: "channel", at: new Date(Date.now() - 5 * 86400000).toISOString(), client_id: "c1", title: "Nokshi Threads connected instagram", sub: "connected" },
  ],
  overview: {
    total_clients: 4, new_clients_7d: 1, new_clients_prev7: 2, paid_clients: 3,
    mrr: 11000, starter: 1, pro: 1, agency: 1,
    revenue_30d: 11000, revenue_prev30: 8500,
    messages_today: 218, messages_7d: 1462, messages_prev7: 1180, customer_messages_7d: 731,
    orders_7d: 34, orders_prev7: 28, total_orders: 412,
    bookings_7d: 6, bookings_prev7: 9, total_bookings: 77,
    connected_channels: 4,
    plan_mix: { trial: 1, starter: 1, pro: 1, agency: 1, none: 0 },
    platform_mix: { facebook: 2, instagram: 1, whatsapp: 1 },
    message_platform_30d: { facebook: 3140, instagram: 1680, whatsapp: 1240 },
    series: { messages: series(210), signups: series(1) },
  },
};

// Handed straight to the components that take props instead of fetching.
export const PROPS = {
  channels: CHANNELS, convos: CONVOS, products: PRODUCTS, orders: ORDERS, settings: SETTINGS,
};
