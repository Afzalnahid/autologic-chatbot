// Every word of the product document, in both languages, in one file.
//
// Owner, 2026-09-25: "I need a full documentation... full product description,
// full product feature, every feature with a screenshot and instruction, that
// this is an Autolinium product, the contact details, and a comparison...
// professional, and don't put any false information."
//
// RULES THIS FILE IS WRITTEN UNDER — read before editing:
//
// 1. NOTHING HERE IS INVENTED. Every price, limit and capability is copied from
//    src/lib/plans.js and src/lib/features.js; the contact details from
//    src/lib/company.js; the screenshots are real renders of the real screens
//    (docs/shots, taken from /shots, the screenshot studio). Where a number
//    would have to be guessed, it is not stated.
// 2. NO CUSTOMER RESULTS ARE CLAIMED. The screenshots use demo businesses
//    ("Nokshi Threads", "Pixel Studio"); nothing in this document presents a
//    figure on them as a real customer's result, and there are no testimonials,
//    no "x% more sales", no case studies, because none have been measured.
// 3. COMPETITOR FACTS ARE SOURCED AND DATED. Chatfuel's and Tidio's prices were
//    read off their own pricing pages on 25 September 2026 and are quoted with
//    that date and the url. ManyChat's page refuses automated reading, so
//    ManyChat is not quoted at all rather than quoted from memory. Prices move:
//    the document says so, in both languages.
// 4. THE COMPARISON COMPARES, IT DOES NOT BOAST. "Best" is an opinion. What is
//    written instead is what each product does and does not do, on points that
//    can be checked, and where TellMore AI is genuinely weaker that is said.
//
// The Bangla is the friendly, spoken register the owner asked for — "আপনি",
// short sentences, no unexplained English jargon — not a literal translation of
// the English.

export const META = {
  product: "TellMore AI",
  tagline: { en: "Conversations that convert", bn: "কথা থেকে বিক্রি" },
  company: "Autolinium",
  site: "www.tellmoreai.com",
  parent: "www.autolinium.com",
  email: "office@autolinium.com",
  phone: "+880 1533 633084",
  address: "Chattogram Software Technology Park, Agrabad, Chattogram 4200, Bangladesh",
  docDate: { en: "25 September 2026", bn: "২৫ সেপ্টেম্বর ২০২৬" },
  version: "1.0",
};

export const COVER = {
  en: {
    kicker: "Product Documentation",
    title: "TellMore AI",
    sub: "The AI chatbot that answers your customers on Messenger, Instagram, WhatsApp and your website — in Bangla and in English, day and night.",
    badge: "An Autolinium product",
    foot: `Version ${META.version} · ${META.docDate.en}`,
  },
  bn: {
    kicker: "প্রোডাক্ট ডকুমেন্টেশন",
    title: "TellMore AI",
    sub: "যে এআই চ্যাটবট আপনার গ্রাহকের প্রশ্নের উত্তর দেয় — মেসেঞ্জার, ইনস্টাগ্রাম, হোয়াটসঅ্যাপ আর আপনার ওয়েবসাইটে। বাংলায় ও ইংরেজিতে, দিনে-রাতে।",
    badge: "অটোলিনিয়াম-এর একটি পণ্য",
    foot: `সংস্করণ ${META.version} · ${META.docDate.bn}`,
  },
};

export const INTRO = {
  en: {
    h: "What TellMore AI is",
    body: [
      "TellMore AI is a chatbot for Bangladeshi businesses. You connect your Facebook Page, your Instagram account, your WhatsApp number and your website. After that, when a customer writes, the bot answers — about your products, your prices, your delivery charge, your opening hours — and it does it in whatever language the customer wrote in, including Banglish typed in English letters.",
      "It is not a menu of buttons. The customer writes the way they normally write, and the bot understands. It can read a photo the customer sends and find that product in your catalogue. It can listen to a voice note. It can take an order and write it down for you.",
      "When the bot cannot answer, or when a customer asks for a person, it stops and hands the chat to you. Every conversation stays in one inbox, whichever app it came from.",
    ],
    points: [
      ["Four channels, one inbox", "Messenger, Instagram, WhatsApp and a chat bubble on your own website — all in the same screen."],
      ["Bangla, Banglish and English", "The bot replies in the language the customer used."],
      ["It knows your shop", "Your products, prices, stock, delivery charges and your own written answers."],
      ["You stay in control", "Take over any chat with one tap. Turn the bot off for one customer or for everybody."],
    ],
  },
  bn: {
    h: "TellMore AI আসলে কী",
    body: [
      "TellMore AI হলো বাংলাদেশি ব্যবসার জন্য বানানো একটি এআই চ্যাটবট। আপনি আপনার ফেসবুক পেজ, ইনস্টাগ্রাম অ্যাকাউন্ট, হোয়াটসঅ্যাপ নম্বর আর ওয়েবসাইট যুক্ত করে দেবেন। এরপর গ্রাহক যখনই কিছু জিজ্ঞেস করবেন — পণ্য, দাম, ডেলিভারি চার্জ, দোকান খোলার সময় — বট নিজেই উত্তর দেবে। গ্রাহক যে ভাষায় লিখবেন, সেই ভাষাতেই উত্তর পাবেন; ইংরেজি অক্ষরে লেখা বাংলা (Banglish) হলেও বুঝবে।",
      "এটা বোতাম টেপার মেনু নয়। গ্রাহক যেভাবে স্বাভাবিকভাবে লেখেন, সেভাবেই লিখবেন — বট বুঝে নেবে। গ্রাহক ছবি পাঠালে সেই ছবি দেখে আপনার ক্যাটালগ থেকে পণ্যটা খুঁজে বের করতে পারে। ভয়েস মেসেজ শুনতে পারে। অর্ডার নিয়ে আপনার জন্য লিখে রাখতে পারে।",
      "যেটা বট পারবে না, কিংবা গ্রাহক যখন বলবেন “মানুষের সাথে কথা বলব” — তখন বট থেমে যায় আর চ্যাটটা আপনার হাতে তুলে দেয়। সব কথোপকথন এক জায়গায় জমা থাকে, যে অ্যাপ থেকেই আসুক না কেন।",
    ],
    points: [
      ["চারটি চ্যানেল, একটি ইনবক্স", "মেসেঞ্জার, ইনস্টাগ্রাম, হোয়াটসঅ্যাপ আর আপনার ওয়েবসাইটের চ্যাট — সব এক পর্দায়।"],
      ["বাংলা, বাংলিশ আর ইংরেজি", "গ্রাহক যে ভাষায় লিখবেন, বট সেই ভাষাতেই উত্তর দেবে।"],
      ["আপনার দোকান চেনে", "আপনার পণ্য, দাম, স্টক, ডেলিভারি চার্জ আর আপনার নিজের লেখা উত্তর।"],
      ["নিয়ন্ত্রণ আপনার হাতেই", "এক চাপে যেকোনো চ্যাট নিজে ধরতে পারবেন। এক গ্রাহকের জন্য বা সবার জন্য বট বন্ধ করে দিতে পারবেন।"],
    ],
  },
};

export const HOWITWORKS = {
  en: {
    h: "How it works",
    steps: [
      ["Connect", "Sign in, press Connect, and choose your Page or account. No IDs to find, no tokens to copy. One click."],
      ["Teach", "Add products — type them, drop a folder of photos and let the AI name them, or paste your shop's web address and let it pull them in. Upload price lists or policy documents if you have them."],
      ["Answer", "The bot starts answering. Every reply uses your catalogue and your own written rules, never a guess."],
      ["Watch", "Read every chat in the Inbox, take over when you want, and see in Analytics what customers keep asking."],
    ],
  },
  bn: {
    h: "কীভাবে কাজ করে",
    steps: [
      ["যুক্ত করুন", "লগইন করে Connect চাপুন, তারপর আপনার পেজ বা অ্যাকাউন্ট বেছে নিন। কোনো আইডি খুঁজতে হবে না, কোনো টোকেন কপি করতে হবে না। এক ক্লিক।"],
      ["শেখান", "পণ্য যোগ করুন — হাতে লিখে, কিংবা ছবির ফোল্ডার ছেড়ে দিয়ে এআইকে নাম দিতে দিন, কিংবা আপনার দোকানের ওয়েবসাইটের ঠিকানা দিলে নিজেই টেনে আনবে। দামের তালিকা বা নিয়মের কাগজ থাকলে আপলোড করুন।"],
      ["উত্তর দেওয়া শুরু", "বট উত্তর দেওয়া শুরু করবে। প্রতিটা উত্তর আসবে আপনার ক্যাটালগ আর আপনার লেখা নিয়ম থেকে — অনুমান করে নয়।"],
      ["নজর রাখুন", "ইনবক্সে সব চ্যাট পড়ুন, ইচ্ছেমতো নিজে ধরুন, আর Analytics-এ দেখুন গ্রাহকেরা বারবার কী জানতে চাইছেন।"],
    ],
  },
};

// ── Every screen, with its real screenshot ─────────────────────────────────
// `shot` is the file name in docs/shots. `biz` marks a screen that only one
// kind of business sees, exactly as src/lib/features.js marks it.
export const SECTIONS = [
  {
    shot: "overview",
    en: { h: "Overview", lead: "The first screen after you sign in.",
      body: "Conversations today, how many of them the bot answered without you, orders and revenue for the day, and the messages that are still waiting for a person. The Channels panel on the right shows each connected account and how many chats it took today.",
      how: "Open the dashboard. Anything marked “Needs you” is a customer the bot could not finish with — press Open to read it." },
    bn: { h: "ওভারভিউ", lead: "লগইন করার পর প্রথম যে পর্দা দেখবেন।",
      body: "আজ কতজন গ্রাহক কথা বলেছেন, তার কতটা বট নিজে সামলেছে, আজকের অর্ডার আর বিক্রি, আর কোন মেসেজগুলো এখনো মানুষের অপেক্ষায়। ডান পাশে প্রতিটি যুক্ত চ্যানেল আর আজ সেখানে কতগুলো চ্যাট এসেছে।",
      how: "ড্যাশবোর্ড খুলুন। “Needs you” লেখা যেগুলো, সেগুলো এমন গ্রাহক যাদের সাথে বট শেষ করতে পারেনি — Open চেপে পড়ে নিন।" },
  },
  {
    shot: "overview-agency",
    en: { h: "Overview — service business", lead: "The same screen for an agency, clinic or service business.", biz: "Service businesses",
      body: "Instead of orders and stock it shows bookings and enquiries. The product is built for two kinds of business and every screen knows which one you are.",
      how: "Your business type is chosen during setup and can be changed in Profile." },
    bn: { h: "ওভারভিউ — সেবা-ভিত্তিক ব্যবসা", lead: "এজেন্সি, ক্লিনিক বা সেবামূলক ব্যবসার জন্য একই পর্দা।", biz: "সেবা-ভিত্তিক ব্যবসা",
      body: "অর্ডার আর স্টকের বদলে এখানে দেখায় বুকিং আর অনুসন্ধান। পুরো সিস্টেমটাই দুই রকম ব্যবসার কথা ভেবে বানানো, আর প্রতিটা পর্দা জানে আপনি কোনটা।",
      how: "শুরুতে সেট আপ করার সময় ব্যবসার ধরন বেছে নেবেন; পরে Profile থেকে বদলাতে পারবেন।" },
  },
  {
    shot: "conversations",
    en: { h: "Inbox", lead: "Every chat from every channel, in one list.",
      body: "Messenger, Instagram, WhatsApp and website chats sit together. Each one shows which channel it came from, what the customer last said, and a tag the AI added — Order, Delivery, Complaint. The right panel shows that customer's history and their orders. The green switch turns the bot on or off for that one customer.",
      how: "Press a name to open the chat. Press “Take over” to answer yourself — the bot stops for that customer until you switch it back on. You can send a photo, a picture from your gallery, or a voice note." },
    bn: { h: "ইনবক্স", lead: "সব চ্যানেলের সব চ্যাট, এক তালিকায়।",
      body: "মেসেঞ্জার, ইনস্টাগ্রাম, হোয়াটসঅ্যাপ আর ওয়েবসাইটের চ্যাট একসাথে থাকে। প্রতিটাতে দেখা যায় কোন চ্যানেল থেকে এসেছে, গ্রাহক শেষ কী বলেছেন, আর এআই কী ট্যাগ দিয়েছে — Order, Delivery, Complaint। ডান পাশে ওই গ্রাহকের আগের কথা আর তার অর্ডার। সবুজ সুইচটা দিয়ে শুধু ওই গ্রাহকের জন্য বট চালু বা বন্ধ করতে পারবেন।",
      how: "নাম চাপলে চ্যাট খুলবে। নিজে উত্তর দিতে চাইলে “Take over” চাপুন — তখন ওই গ্রাহকের জন্য বট থেমে যাবে, যতক্ষণ না আপনি আবার চালু করছেন। ছবি, গ্যালারির ছবি বা ভয়েস মেসেজও পাঠাতে পারবেন।" },
  },
  {
    shot: "comments",
    en: { h: "Comments", lead: "Replies under your posts, handled for you.", feature: "Comment automation",
      body: "When someone comments on a Facebook or Instagram post, the bot can reply publicly under the comment and send the same person a private message. Every comment it handled is listed here so you can see what was said.",
      how: "Turn it on in Bot Training. Meta allows one private reply per comment, within seven days — the product follows that rule for you." },
    bn: { h: "কমেন্ট", lead: "আপনার পোস্টের নিচের মন্তব্য নিজে থেকেই সামলানো।", feature: "কমেন্ট অটোমেশন",
      body: "কেউ ফেসবুক বা ইনস্টাগ্রাম পোস্টে মন্তব্য করলে বট মন্তব্যের নিচে প্রকাশ্যে উত্তর দিতে পারে, আর একই মানুষকে ব্যক্তিগত মেসেজও পাঠাতে পারে। কোন মন্তব্যে কী হয়েছে, সব এখানে তালিকা করা থাকে।",
      how: "Bot Training থেকে চালু করুন। মেটার নিয়ম — এক মন্তব্যে একবারই ব্যক্তিগত উত্তর, সাত দিনের ভেতর। নিয়মটা সিস্টেম নিজেই মেনে চলে।" },
  },
  {
    shot: "inventory",
    en: { h: "Products", lead: "Your catalogue — what the bot answers from.", biz: "Shops",
      body: "Name, code, category, price, offer price, stock and photos. The bot only ever quotes what is written here, so a price on this screen is the price a customer is told. Out-of-stock items are said to be out of stock rather than sold.",
      how: "Add a product by hand, or use the two faster ways on the next pages. Edit a price here and the next customer hears the new one." },
    bn: { h: "পণ্য", lead: "আপনার ক্যাটালগ — বট এখান থেকেই উত্তর দেয়।", biz: "দোকান",
      body: "নাম, কোড, ক্যাটাগরি, দাম, অফারের দাম, স্টক আর ছবি। বট শুধু এখানে যা লেখা আছে সেটাই বলে — তাই এই পর্দার দাম মানেই গ্রাহকের শোনা দাম। স্টক শেষ হলে বট “নেই” বলে, বিক্রি করে ফেলে না।",
      how: "হাতে পণ্য যোগ করতে পারেন, কিংবা পরের পাতার দুটো দ্রুত উপায় ব্যবহার করতে পারেন। এখানে দাম বদলালে পরের গ্রাহক নতুন দামই শুনবেন।" },
  },
  {
    shot: "assistant",
    en: { h: "AI Assistant", lead: "Tell it what you want; it does the work.", feature: "AI Assistant",
      body: "A chat inside your dashboard. Ask it to add a product, set an offer, change a price or explain a setting, and it prepares the change and shows it to you before anything is saved.",
      how: "Type what you want in plain words — “put 20% off on all panjabi until Friday”. Read what it proposes, then approve or cancel. Nothing changes until you approve." },
    bn: { h: "এআই অ্যাসিস্ট্যান্ট", lead: "আপনি বলবেন, সে কাজটা করে দেবে।", feature: "এআই অ্যাসিস্ট্যান্ট",
      body: "আপনার ড্যাশবোর্ডের ভেতরেই একটা চ্যাট। পণ্য যোগ করতে, অফার দিতে, দাম বদলাতে বা কোনো সেটিং বুঝতে বলুন — সে কাজটা তৈরি করে আপনাকে দেখাবে, সেভ করার আগেই।",
      how: "সহজ ভাষায় লিখুন — “সব পাঞ্জাবিতে শুক্রবার পর্যন্ত ২০% ছাড় দাও”। সে কী করতে চায় পড়ে নিন, তারপর অনুমোদন করুন বা বাতিল করুন। আপনি অনুমোদন না করা পর্যন্ত কিছুই বদলাবে না।" },
  },
  {
    shot: "knowledge",
    en: { h: "Knowledge Base", lead: "Your documents, as answers.", feature: "Knowledge Base uploads",
      body: "Upload a price list, a service description, a warranty policy or a set of frequently asked questions. The bot reads them and answers from them, quoting your own wording rather than inventing something.",
      how: "Upload the file and wait for it to finish processing. Ask the bot a question from that document to check it." },
    bn: { h: "নলেজ বেজ", lead: "আপনার কাগজপত্রই হয়ে যাবে উত্তর।", feature: "নলেজ বেজ আপলোড",
      body: "দামের তালিকা, সেবার বিবরণ, ওয়ারেন্টির নিয়ম বা সাধারণ প্রশ্নোত্তর আপলোড করুন। বট সেগুলো পড়ে সেখান থেকেই উত্তর দেবে — আপনার নিজের লেখা ভাষায়, বানিয়ে নয়।",
      how: "ফাইল আপলোড করে প্রক্রিয়া শেষ হওয়া পর্যন্ত অপেক্ষা করুন। তারপর ওই কাগজ থেকে একটা প্রশ্ন বটকে করে যাচাই করে নিন।" },
  },
  {
    shot: "orders",
    en: { h: "Orders", lead: "What the bot wrote down while you were away.", biz: "Shops",
      body: "When a customer agrees to buy, the bot records the order — who, what, how much, where to deliver — and it appears here. You move it through Pending, Confirmed, Shipped and Delivered.",
      how: "Open an order to see the exact chat it came from. Change its status as it moves." },
    bn: { h: "অর্ডার", lead: "আপনি না থাকলেও বট যা লিখে রেখেছে।", biz: "দোকান",
      body: "গ্রাহক কিনতে রাজি হলে বট অর্ডারটা লিখে রাখে — কে, কী, কত, কোথায় পাঠাতে হবে — আর সেটা এখানে চলে আসে। আপনি Pending, Confirmed, Shipped, Delivered ধাপে এগিয়ে নেবেন।",
      how: "অর্ডারে চাপ দিলে কোন কথোপকথন থেকে এসেছে সেটাও দেখতে পাবেন। অবস্থা বদলালে এখানে বদলে দিন।" },
  },
  {
    shot: "bookings",
    en: { h: "Bookings", lead: "Appointments, with a Google Meet link.", biz: "Service businesses", feature: "Google Calendar booking",
      body: "Connect your Google Calendar and the bot can offer the times you are actually free, book the one the customer picks, and send both of you a Meet link.",
      how: "Connect the calendar once from this screen. After that the bot checks it before offering any time, so it cannot double-book you." },
    bn: { h: "বুকিং", lead: "অ্যাপয়েন্টমেন্ট, সাথে গুগল মিট লিংক।", biz: "সেবা-ভিত্তিক ব্যবসা", feature: "গুগল ক্যালেন্ডার বুকিং",
      body: "গুগল ক্যালেন্ডার যুক্ত করলে বট আপনার সত্যিকারের খালি সময়গুলো দেখাতে পারবে, গ্রাহক যেটা বাছবেন সেটা বুক করবে, আর দুজনকেই মিট লিংক পাঠিয়ে দেবে।",
      how: "এই পর্দা থেকে একবার ক্যালেন্ডার যুক্ত করুন। এরপর বট সময় বলার আগে ক্যালেন্ডার দেখে নেয়, তাই এক সময়ে দুটো বুকিং হবে না।" },
  },
  {
    shot: "broadcast",
    en: { h: "Broadcasts", lead: "One message to many customers.", feature: "Broadcasts",
      body: "Send an offer or an announcement to customers who have written to you recently. You choose who by tag — everyone who asked about delivery, everyone who ordered, and so on.",
      how: "Write the message, pick who it goes to, and send. Messenger and WhatsApp only allow a business to message someone within 24 hours of their last message; the product enforces that rule, so a broadcast only reaches people it is allowed to reach." },
    bn: { h: "ব্রডকাস্ট", lead: "একটা বার্তা, অনেক গ্রাহকের কাছে।", feature: "ব্রডকাস্ট",
      body: "সম্প্রতি যারা আপনাকে লিখেছেন, তাঁদের কাছে অফার বা ঘোষণা পাঠান। ট্যাগ দেখে বেছে নিতে পারবেন — যাঁরা ডেলিভারি নিয়ে জিজ্ঞেস করেছেন, যাঁরা অর্ডার করেছেন, ইত্যাদি।",
      how: "বার্তা লিখুন, কাদের যাবে বেছে নিন, পাঠান। মেসেঞ্জার ও হোয়াটসঅ্যাপের নিয়ম — গ্রাহকের শেষ মেসেজের ২৪ ঘণ্টার ভেতরেই কেবল ব্যবসা তাঁকে লিখতে পারে। সিস্টেম নিজেই এই নিয়ম মেনে চলে, তাই যাঁদের কাছে পাঠানো বৈধ শুধু তাঁদের কাছেই যাবে।" },
  },
  {
    shot: "channels",
    en: { h: "Channels", lead: "Connect Messenger, Instagram, WhatsApp and your website.",
      body: "Each channel is one button. You sign in with Facebook, pick the Page or account, and it is done. No App ID, no access token, nothing to copy from a developer console.",
      how: "Press Connect on the channel you want. If a connection ever expires, this screen says so and the Reconnect button puts it right." },
    bn: { h: "চ্যানেল", lead: "মেসেঞ্জার, ইনস্টাগ্রাম, হোয়াটসঅ্যাপ আর ওয়েবসাইট যুক্ত করুন।",
      body: "প্রতিটা চ্যানেলের জন্য একটাই বোতাম। ফেসবুক দিয়ে লগইন করে পেজ বা অ্যাকাউন্ট বেছে নিলেই শেষ। কোনো App ID নয়, কোনো টোকেন নয়, ডেভেলপার কনসোল থেকে কিছু কপি করতে হবে না।",
      how: "যে চ্যানেল চান তার Connect চাপুন। কোনো সংযোগের মেয়াদ শেষ হলে এই পর্দাই জানিয়ে দেবে, আর Reconnect চাপলেই ঠিক হয়ে যাবে।" },
  },
  {
    shot: "website-widget",
    en: { h: "Website widget", lead: "The same bot, on your own site.", feature: "Website chat widget",
      body: "A chat bubble for your website. You choose the colour, the greeting and which pages it appears on, then copy one line of code into your site.",
      how: "Set it up here, copy the code, and paste it before the closing </body> tag of your website. Only the web addresses you list are allowed to use it." },
    bn: { h: "ওয়েবসাইট উইজেট", lead: "একই বট, আপনার নিজের সাইটে।", feature: "ওয়েবসাইট চ্যাট উইজেট",
      body: "আপনার ওয়েবসাইটের জন্য একটা চ্যাট বাবল। রং, শুরুর কথা আর কোন পাতায় দেখাবে — সব আপনি ঠিক করবেন, তারপর এক লাইন কোড সাইটে বসিয়ে দেবেন।",
      how: "এখানে সাজিয়ে নিয়ে কোডটা কপি করুন, আর আপনার ওয়েবসাইটের </body> ট্যাগের ঠিক আগে বসিয়ে দিন। আপনি যে ঠিকানাগুলো লিখে দেবেন, শুধু সেগুলোই এটা ব্যবহার করতে পারবে।" },
  },
  {
    shot: "bot-training",
    en: { h: "Bot Training", lead: "How the bot speaks, and what it is allowed to say.",
      body: "Your business name, what you sell, your opening hours, your delivery charges, your tone, and the languages to answer in. This is also where you switch individual abilities on and off — photo matching, voice notes, comment replies, follow-ups.",
      how: "Fill in what is true for your business and save. Some rules are fixed by the platform and cannot be removed — the bot will not invent a price, and it will not promise what your catalogue does not have." },
    bn: { h: "বট ট্রেনিং", lead: "বট কীভাবে কথা বলবে, আর কী বলার অনুমতি আছে।",
      body: "আপনার ব্যবসার নাম, কী বিক্রি করেন, খোলার সময়, ডেলিভারি চার্জ, কথার ধরন, আর কোন ভাষায় উত্তর দেবে। এখান থেকেই আলাদা আলাদা ক্ষমতা চালু-বন্ধ করা যায় — ছবি মেলানো, ভয়েস মেসেজ, কমেন্টের উত্তর, ফলো-আপ।",
      how: "আপনার ব্যবসার সত্যি তথ্যগুলো লিখে সেভ করুন। কিছু নিয়ম প্ল্যাটফর্মে স্থায়ীভাবে বসানো, মুছে ফেলা যায় না — বট কখনো দাম বানিয়ে বলবে না, আর ক্যাটালগে যা নেই তার প্রতিশ্রুতি দেবে না।" },
  },
  {
    shot: "analytics",
    en: { h: "Analytics", lead: "What customers actually ask.", feature: "Analytics dashboard",
      body: "Messages over time, how many the bot handled alone, which products are asked about most, and which questions it could not answer. That last list is the useful one — it tells you exactly what to add to your catalogue or your documents.",
      how: "Read the unanswered questions each week and fix the gaps. The bot gets better because you fed it, not by itself." },
    bn: { h: "অ্যানালিটিক্স", lead: "গ্রাহকেরা আসলে কী জানতে চান।", feature: "অ্যানালিটিক্স ড্যাশবোর্ড",
      body: "সময়ের সাথে মেসেজের সংখ্যা, বট একা কতটা সামলেছে, কোন পণ্য নিয়ে সবচেয়ে বেশি প্রশ্ন, আর কোন প্রশ্নের উত্তর সে দিতে পারেনি। শেষেরটাই সবচেয়ে কাজের — এটা দেখেই বুঝবেন ক্যাটালগে বা কাগজে কী যোগ করতে হবে।",
      how: "প্রতি সপ্তাহে উত্তরহীন প্রশ্নগুলো পড়ে ঘাটতিগুলো পূরণ করুন। বট নিজে থেকে ভালো হয় না — আপনি শেখালেই ভালো হয়।" },
  },
  {
    shot: "ai-engine",
    en: { h: "Your own AI key", lead: "Run the bot on your own account, at a lower price.", feature: "Use your own AI key",
      body: "If you would rather pay Google or OpenAI directly for the AI, you can paste your own key here. The package price drops, and the AI usage is billed to you by the provider instead of by us.",
      how: "Ask us to allow it for your account, then paste your key. The key is checked before it is saved and stored encrypted; no screen ever shows it again in full." },
    bn: { h: "নিজের এআই কী", lead: "নিজের অ্যাকাউন্টে বট চালান, কম দামে।", feature: "নিজের এআই কী ব্যবহার",
      body: "আপনি যদি এআই-এর খরচ সরাসরি গুগল বা ওপেনএআই-কে দিতে চান, তাহলে নিজের কী এখানে বসাতে পারেন। তখন প্যাকেজের দাম কমে যায়, আর এআই-এর বিল আমাদের বদলে সরাসরি প্রোভাইডার আপনাকে পাঠাবে।",
      how: "আমাদের বলুন আপনার অ্যাকাউন্টে এটা চালু করে দিতে, তারপর কী বসান। সেভ করার আগে কী-টা যাচাই করা হয় এবং এনক্রিপ্ট করে রাখা হয়; কোনো পর্দায় আর কখনো পুরোটা দেখা যায় না।" },
  },
  {
    shot: "billing",
    en: { h: "Billing", lead: "Your package, your usage, your payments.",
      body: "How many replies you have used this month, how many are left, when your package ends, and every payment you have made. Payment is by bKash, Nagad or Rocket — you send the money and enter the transaction number.",
      how: "Pick a package, pay to the number shown, and type the transaction ID. We verify it and your package starts. Paying yearly costs ten months instead of twelve." },
    bn: { h: "বিলিং", lead: "আপনার প্যাকেজ, ব্যবহার আর পেমেন্ট।",
      body: "এই মাসে কতগুলো উত্তর ব্যবহার হয়েছে, কতগুলো বাকি, প্যাকেজ কবে শেষ হবে, আর আপনার সব পেমেন্টের হিসাব। টাকা দেওয়া যায় বিকাশ, নগদ বা রকেটে — টাকা পাঠিয়ে ট্রানজ্যাকশন নম্বরটা লিখে দেবেন।",
      how: "প্যাকেজ বেছে নিন, দেখানো নম্বরে টাকা পাঠান, আর ট্রানজ্যাকশন আইডি লিখুন। আমরা যাচাই করলেই প্যাকেজ চালু। বছরে একসাথে দিলে বারো মাসের বদলে দশ মাসের দাম।" },
  },
  {
    shot: "profile",
    en: { h: "Profile & settings", lead: "Your business details, language and notifications.",
      body: "Your business name and logo, your business type, the dashboard language (English or Bangla), light or dark appearance, and notifications on your phone when a customer needs you.",
      how: "Turn notifications on so you are told when a chat needs a person, even with the dashboard closed." },
    bn: { h: "প্রোফাইল ও সেটিংস", lead: "আপনার ব্যবসার তথ্য, ভাষা আর নোটিফিকেশন।",
      body: "ব্যবসার নাম ও লোগো, ব্যবসার ধরন, ড্যাশবোর্ডের ভাষা (ইংরেজি বা বাংলা), আলো বা অন্ধকার চেহারা, আর গ্রাহকের দরকার হলে ফোনে নোটিফিকেশন।",
      how: "নোটিফিকেশন চালু করে রাখুন — ড্যাশবোর্ড বন্ধ থাকলেও কোনো চ্যাটে মানুষ লাগলে জানতে পারবেন।" },
  },
];

// Features from src/lib/features.js that do not have a screen of their own.
export const EXTRA_FEATURES = {
  en: {
    h: "Also included",
    items: [
      ["Photo product matching", "A customer sends a photo; the bot finds that product in your catalogue and answers about it. Shops only."],
      ["Voice message understanding", "A voice note is listened to and answered like any other message."],
      ["Follow-up messages", "A customer who asked and went quiet gets one polite nudge — inside the 24-hour window the platforms allow."],
      ["Add products from photos", "Drop a folder of product photos; the AI names them, groups them and writes the descriptions for you to check."],
      ["Import from a website", "Paste the address of your existing online shop and the products are pulled in."],
      ["The native Android app", "The same dashboard as an app on your phone, with notifications."],
    ],
  },
  bn: {
    h: "আরও যা আছে",
    items: [
      ["ছবি দেখে পণ্য মেলানো", "গ্রাহক ছবি পাঠালে বট ক্যাটালগ থেকে সেই পণ্যটা খুঁজে বের করে উত্তর দেয়। শুধু দোকানের জন্য।"],
      ["ভয়েস মেসেজ বোঝা", "ভয়েস মেসেজ শুনে অন্য যেকোনো মেসেজের মতোই উত্তর দেয়।"],
      ["ফলো-আপ মেসেজ", "যে গ্রাহক জিজ্ঞেস করে চুপ হয়ে গেছেন, তাঁকে একবার ভদ্রভাবে মনে করিয়ে দেয় — প্ল্যাটফর্মের অনুমোদিত ২৪ ঘণ্টার ভেতরেই।"],
      ["ছবি থেকে পণ্য যোগ", "পণ্যের ছবির ফোল্ডার ছেড়ে দিন; এআই নাম দেবে, ভাগ করবে আর বিবরণ লিখে দেবে — আপনি শুধু দেখে নেবেন।"],
      ["ওয়েবসাইট থেকে আনা", "আপনার চালু অনলাইন দোকানের ঠিকানা দিলে পণ্যগুলো নিজে থেকেই চলে আসবে।"],
      ["অ্যান্ড্রয়েড অ্যাপ", "একই ড্যাশবোর্ড আপনার ফোনের অ্যাপে, নোটিফিকেশনসহ।"],
    ],
  },
};
