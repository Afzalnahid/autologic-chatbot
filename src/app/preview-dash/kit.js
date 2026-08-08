// PREVIEW ONLY — nothing here touches the live dashboard. If this design is
// approved, these tokens move into src/app/dashboard/components/ui.js and the real
// tabs adopt them one at a time.
//
// Dark rail, light workspace: the reference's arrangement, in the product's own
// colours. Periwinkle and mint carry over unchanged so the app and the marketing
// site still read as one company.

export const D = {
  rail: "#0D111A", railHover: "#161C2A", railText: "#98A3BA", railTextOn: "#FFFFFF",
  canvas: "#F5F6F8", surface: "#FFFFFF", line: "#E4E8EF", lineSoft: "#EFF1F5",
  ink: "#131722", inkSoft: "#5A6478", inkFaint: "#8A93A6",
  blue: "#5B8CFF", blueSoft: "#EEF3FF", mint: "#2ED3A7", mintSoft: "#E7F9F3",
  amber: "#E9A23B", amberSoft: "#FDF3E3", rose: "#E8556D", roseSoft: "#FDEDEF",
};

export const FONT = {
  ui: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
};

export const mono = { fontFamily: FONT.mono, fontSize: 10, letterSpacing: "0.11em", textTransform: "uppercase" };

// Grouped the way the work actually splits, not the way the files are named.
export const NAV = [
  { group: "Overview", items: [
    { id: "overview", icon: "ti-layout-dashboard", label: "Dashboard" },
    { id: "conversations", icon: "ti-messages", label: "Conversations", badge: 3 },
    { id: "analytics", icon: "ti-chart-histogram", label: "Analytics" },
  ]},
  { group: "Channels", items: [
    { id: "channels", icon: "ti-plug-connected", label: "Channels" },
    { id: "broadcast", icon: "ti-send", label: "Broadcast" },
    { id: "comments", icon: "ti-message-circle", label: "Comments" },
    { id: "widget", icon: "ti-world", label: "Website widget" },
  ]},
  { group: "Business", items: [
    { id: "orders", icon: "ti-shopping-bag", label: "Orders" },
    { id: "inventory", icon: "ti-box", label: "Inventory" },
    { id: "bookings", icon: "ti-calendar-check", label: "Bookings" },
    { id: "knowledge", icon: "ti-books", label: "Knowledge base" },
  ]},
  { group: "Account", items: [
    { id: "settings", icon: "ti-settings", label: "Settings" },
    { id: "billing", icon: "ti-credit-card", label: "Billing" },
    { id: "profile", icon: "ti-user", label: "Profile" },
  ]},
];

// Sample data. Shaped like the real thing so the layout is tested against
// realistic lengths — Bangla names, long product titles, four-digit prices.
export const SAMPLE = {
  business: "Autologic Systems",
  plan: "Pro", planDays: 19,
  kpis: [
    { label: "Conversations", value: "1,284", delta: +12.4, spark: [8,12,9,14,11,17,15,19,16,22] },
    { label: "Handled by bot", value: "91%", delta: +3.1, spark: [70,74,72,78,80,79,84,86,88,91] },
    { label: "Orders placed", value: "218", delta: +8.7, spark: [4,6,5,9,7,11,10,13,12,16] },
    { label: "Needed a human", value: "9%", delta: -3.1, spark: [30,26,28,22,20,21,16,14,12,9] },
  ],
  series: {
    labels: ["Feb 2","Feb 3","Feb 4","Feb 5","Feb 6","Feb 7","Feb 8"],
    bot:   [96, 118, 104, 142, 131, 168, 184],
    human: [18, 14, 21, 12, 16, 11, 9],
  },
  channels: [
    { id: "messenger", icon: "ti-brand-messenger", name: "Facebook Messenger", handle: "Autologic Systems", state: "live", share: 42 },
    { id: "instagram", icon: "ti-brand-instagram", name: "Instagram Direct", handle: "@autologic.bd", state: "live", share: 26 },
    { id: "whatsapp", icon: "ti-brand-whatsapp", name: "WhatsApp Business", handle: "+880 1690 000732", state: "live", share: 24 },
    { id: "website", icon: "ti-world", name: "Website widget", handle: "autologic.com.bd", state: "paused", share: 8 },
  ],
  convos: [
    { name: "রাহেলা আক্তার", ch: "messenger", tag: "Order", last: "লাল রঙটাই নেব। ঠিকানা কুমিল্লা।", at: "2m", unread: 2 },
    { name: "Tanvir Hasan", ch: "whatsapp", tag: "Booking", last: "Thursday 4 PM works for me.", at: "18m", unread: 0 },
    { name: "শারমিন সুলতানা", ch: "instagram", tag: "Product Inquiry", last: "কুর্তিটার সাইজ M আছে?", at: "1h", unread: 1 },
    { name: "Imran Kabir", ch: "website", tag: "Service Inquiry", last: "How do I add the widget to my site?", at: "3h", unread: 0 },
    { name: "নুসরাত জাহান", ch: "messenger", tag: "Complaint", last: "তিনবার ফোন দিলাম, কেউ ধরে না।", at: "5h", unread: 0 },
  ],
  hours: [2,1,0,0,0,1,3,6,9,14,18,22,26,24,19,21,25,31,28,20,13,8,5,3],
  countries: [
    { name: "Dhaka", pct: 46 }, { name: "Chattogram", pct: 21 },
    { name: "Cumilla", pct: 14 }, { name: "Sylhet", pct: 11 }, { name: "Others", pct: 8 },
  ],
  orders: [
    { code: "AL2481", name: "রাহেলা আক্তার", item: "জামদানি শাড়ি — লাল", total: "৩,২০০৳", status: "Confirmed", at: "Today" },
    { code: "AL2480", name: "Sabbir Rahman", item: "Cotton kurti — M", total: "১,৪৫০৳", status: "Packed", at: "Today" },
    { code: "AL2478", name: "মেহেদী হাসান", item: "Panjabi — XL", total: "২,১০০৳", status: "Shipped", at: "Yesterday" },
    { code: "AL2477", name: "Farhana Islam", item: "Three piece — blue", total: "৪,৬৫০৳", status: "Delivered", at: "2 days ago" },
    { code: "AL2475", name: "জাহিদ হোসেন", item: "Kids set — 4y", total: "৯৮০৳", status: "Cancelled", at: "3 days ago" },
  ],
  products: [
    { name: "জামদানি শাড়ি", code: "SR-114", price: "৩,২০০৳", stock: 12 },
    { name: "Cotton kurti", code: "KT-208", price: "১,৪৫০৳", stock: 34 },
    { name: "Panjabi (cotton)", code: "PJ-051", price: "২,১০০৳", stock: 7 },
    { name: "Three piece set", code: "TP-330", price: "৪,৬৫০৳", stock: 0 },
    { name: "Kids set", code: "KD-019", price: "৯৮০৳", stock: 21 },
  ],
  bookings: [
    { name: "Tanvir Hasan", topic: "Free consultation", when: "Thu, 4:00 PM", state: "Confirmed" },
    { name: "Imran Kabir", topic: "Website widget setup", when: "Fri, 11:30 AM", state: "Confirmed" },
    { name: "নাফিসা রহমান", topic: "Package walkthrough", when: "Mon, 2:00 PM", state: "Pending" },
  ],
  docs: [
    { name: "service-packages-2026.pdf", size: "412 KB", chunks: 38, at: "6 Aug" },
    { name: "delivery-and-returns.docx", size: "88 KB", chunks: 11, at: "2 Aug" },
    { name: "faq-bangla.txt", size: "24 KB", chunks: 9, at: "28 Jul" },
  ],
  comments: [
    { name: "Rakib Uddin", ch: "messenger", text: "দাম কত ভাই?", reply: "ইনবক্সে দাম পাঠিয়ে দিয়েছি 🙂", at: "12m" },
    { name: "Priya Das", ch: "instagram", text: "Is this available?", reply: "Yes — sent you the details in DM.", at: "40m" },
  ],
  invoices: [
    { id: "INV-0031", date: "1 Aug 2026", amount: "৩,৫০০৳", state: "Paid" },
    { id: "INV-0027", date: "1 Jul 2026", amount: "৩,৫০০৳", state: "Paid" },
    { id: "INV-0022", date: "1 Jun 2026", amount: "১,৫০০৳", state: "Paid" },
  ],
};

export const TAG_TONE = {
  Order: "blue", Booking: "mint", "Product Inquiry": "blue",
  "Service Inquiry": "blue", Complaint: "rose", Delivery: "amber",
  "Follow-up": "amber", Other: "grey",
};

export const STATUS_TONE = {
  Confirmed: "blue", Packed: "amber", Shipped: "blue",
  Delivered: "mint", Cancelled: "rose", Pending: "amber", Paid: "mint",
};
