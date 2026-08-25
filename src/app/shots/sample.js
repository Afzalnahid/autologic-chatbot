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
  order({ id: "o1", order_code: "A-1042", customer_name: "Tasnim Rahman", phone_number: "017XXXXXXXX",
    address: "House 12, Road 4, Dhanmondi, Dhaka", delivery_area: "inside Dhaka",
    status: "Pending", platform: "instagram", created_at: iso(20),
    items: [{ code: "PJ-NVY-01", name: "Cotton panjabi — navy", variant: "M", qty: 1, unit_price: 1450 }],
    subtotal: 1450, delivery_charge: 60, total: 1510, qty_total: 1, payment_method: "Cash on delivery" }),
  order({ id: "o2", order_code: "A-1041", customer_name: "Rahim Uddin", phone_number: "018XXXXXXXX",
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
  plan: "growth", plan_name: "Growth", active: true,
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
      { sender_id: "u2", name: "Rahim Uddin", bot_enabled: true },
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
  "/api/plans": { plans: [] },
  "/api/profile": PROFILE,
};

// Handed straight to the components that take props instead of fetching.
export const PROPS = {
  channels: CHANNELS, convos: CONVOS, products: PRODUCTS, orders: ORDERS, settings: SETTINGS,
};
