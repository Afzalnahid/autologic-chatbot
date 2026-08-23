"use client";
import { useState, useEffect } from "react";
import { T } from "./ui.js";

// Dashboard language (English / Bangla). The public site already had its own
// ?lang= switch; this is the same idea for the app, so no Bangla is ever
// hardcoded into an English screen — the owner picks a language and every
// translated string follows it.
//
// The choice lives in localStorage under "al-dash-lang" and is broadcast with
// an "al-lang" event, so every mounted component re-renders together.
// Rendering starts in English on the server and switches on mount, which keeps
// hydration clean.

export const LANGS = [
  { id: "en", label: "English", short: "EN" },
  { id: "bn", label: "বাংলা", short: "বাং" },
];

const KEY = "al-dash-lang";
let _lang = null;

export function getLang() {
  if (_lang) return _lang;
  try { _lang = localStorage.getItem(KEY) === "bn" ? "bn" : "en"; } catch { _lang = "en"; }
  return _lang;
}

export function setLang(v) {
  _lang = v === "bn" ? "bn" : "en";
  try { localStorage.setItem(KEY, _lang); } catch {}
  if (typeof window !== "undefined") window.dispatchEvent(new Event("al-lang"));
}

export function useLang() {
  const [lang, setL] = useState("en");
  useEffect(() => {
    setL(getLang());
    const h = () => setL(getLang());
    window.addEventListener("al-lang", h);
    return () => window.removeEventListener("al-lang", h);
  }, []);
  return lang;
}

// t("some.key") — falls back to English, then to the key itself, so a missing
// translation degrades to readable English instead of blanking the screen.
export function useT() {
  const lang = useLang();
  return (key, vars) => {
    let s = (DICT[lang] && DICT[lang][key]) ?? DICT.en[key] ?? key;
    if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
    return s;
  };
}

// The switch itself: two small pills, so the current language is visible at a
// glance rather than hidden behind a menu.
export function LangToggle({ compact }) {
  const lang = useLang();
  return (
    <div style={{ display: "inline-flex", background: T.bgAlt, borderRadius: 11, padding: 3, gap: 3, flexShrink: 0 }} title="Language / ভাষা">
      {LANGS.map((l) => (
        <button key={l.id} onClick={() => setLang(l.id)} aria-pressed={lang === l.id}
          style={{ padding: compact ? "6px 9px" : "7px 11px", borderRadius: 8, border: "none", cursor: "pointer",
            fontSize: 11.5, fontWeight: 700, lineHeight: 1, fontFamily: "inherit",
            background: lang === l.id ? T.accGrad : "transparent", color: lang === l.id ? "#fff" : T.textMuted }}>
          {l.short}
        </button>
      ))}
    </div>
  );
}

const DICT = {
  en: {
    // ---- navigation & shell ----
    "nav.analytics": "Analytics", "nav.conversations": "Conversations", "nav.comments": "Comments",
    "nav.broadcast": "Broadcast", "nav.channels": "Channels", "nav.billing": "Billing",
    "nav.settings": "Bot Training", "nav.profile": "Profile", "nav.ai": "AI Engine",
    "nav.inventory": "Inventory", "nav.knowledge": "Knowledge Base",
    "nav.orders": "Orders", "nav.bookings": "Bookings",
    "group.Overview": "Overview", "group.Outreach": "Outreach", "group.Business": "Business", "group.Account": "Account",
    "shell.logout": "Log out", "shell.sync": "Sync", "shell.language": "Language",

    // ---- shared ----
    "common.save": "Save", "common.saved": "Saved", "common.unsaved": "Unsaved changes",
    "common.optional": "optional", "common.skip": "Skip", "common.back": "Back", "common.send": "Send",
    "common.delete": "Delete", "common.close": "Close", "common.on": "On", "common.off": "Off",
    "common.loading": "Loading…", "common.search": "Search",

    // ---- Bot Training: header & checklist ----
    "bt.title": "Train your bot",
    "bt.progress": "{done} of {total} steps done. The more you give it, the better it sells.",
    "bt.allDone": "Core training done — offers and bargaining make it sell even better.",
    "bt.chk.identity": "Identity", "bt.chk.business": "Business", "bt.chk.policies": "Policies",
    "bt.chk.services": "Services", "bt.chk.qa": "Q&A", "bt.chk.offers": "Offers", "bt.chk.bargain": "Bargaining",
    "bt.tab.train": "Train", "bt.tab.offers": "Offers", "bt.tab.bargain": "Bargaining", "bt.tab.behavior": "Behavior",

    // ---- Train ----
    "bt.train.title": "Teach it your business",
    "bt.train.sub": "Answer the bot's questions — it writes its own training from them",
    "bt.train.viewChat": "Chat", "bt.train.viewForm": "Form",
    "bt.train.intro": "Hi! I'm your bot. Answer a few questions and I'll learn your business. Write in whichever language you like — skip anything, change anything later.",
    "bt.train.done": "That's everything — thank you! Press the button below and I'll turn your answers into my business profile. You can redo this chat anytime; your answers stay.",
    "bt.train.generate": "Generate my bot's profile",
    "bt.train.generating": "Generating…",
    "bt.train.redo": "Redo the chat",
    "bt.train.regen": "Regenerate with AI",
    "bt.train.skipped": "(skipped)",
    "bt.train.genOk": "Generated. Review it in Behavior → Advanced, then Save.",
    "bt.train.genNeedDesc": "Please describe your business first",
    "bt.train.genFail": "Could not generate — please try again.",
    "bt.train.samples": "Start from an example and edit it:",

    // Interview questions & placeholders — a shop and an agency are asked
    // different things, in a different order, in their own words.
    "q.ecom.description": "Tell me about your business — what do you sell, and at what kind of prices?",
    "ph.ecom.description": "e.g. We sell men's t-shirts, 350 to 600 each. Write in any language.",
    "q.ecom.delivery": "How do you deliver? Time and charge?",
    "ph.ecom.delivery": "e.g. Inside the city 60 (1-2 days), outside 120 (2-3 days)",
    "q.ecom.payment": "How do customers pay you?",
    "ph.ecom.payment": "e.g. Cash on delivery, bKash, Nagad",
    "q.ecom.returnPolicy": "What is your return or exchange policy?",
    "ph.ecom.returnPolicy": "e.g. Exchange within 7 days if there is a problem",
    "q.ecom.hours": "When are you open?",
    "ph.ecom.hours": "e.g. Every day, 10am to 10pm",
    "q.ecom.catalogLink": "Any catalog or website link customers can browse?",
    "ph.ecom.catalogLink": "e.g. https://yourshop.com — skip if you don't have one",
    "q.ecom.faq": "What do customers ask most? Write the questions with your answers.",
    "ph.ecom.faq": "Q: Is it in stock?\nA: Yes, most sizes are in stock.",
    "q.ecom.special": "Anything else the bot should know? Brand rules, things it must never say…",
    "ph.ecom.special": "e.g. Always address customers politely, never mention competitors — skip if none",

    "q.agency.description": "Tell me about your business — what do you do, and for whom?",
    "ph.agency.description": "e.g. We are a digital marketing agency for small businesses. Write in any language.",
    "q.agency.services": "What services do you offer, and at what prices?",
    "ph.agency.services": "e.g. Facebook ads management — from 10,000 per month. SEO — from 15,000.",
    "q.agency.meetingInfo": "How do clients book a meeting or consultation with you?",
    "ph.agency.meetingInfo": "e.g. Free 30-minute consultation, online",
    "q.agency.hours": "When are you available?",
    "ph.agency.hours": "e.g. Sunday to Thursday, 10am to 7pm",
    "q.agency.catalogLink": "Any website or portfolio link to share?",
    "ph.agency.catalogLink": "e.g. https://youragency.com — skip if you don't have one",
    "q.agency.faq": "What do clients ask most? Write the questions with your answers.",
    "ph.agency.faq": "Q: How soon do results come?\nA: Usually within 2 to 3 months.",
    "q.agency.special": "Anything else the bot should know? Special rules, tone…",
    "ph.agency.special": "skip if none",

    "lbl.description": "Describe your business", "lbl.delivery": "Delivery (time & charge)",
    "lbl.payment": "Payment methods", "lbl.returnPolicy": "Return / exchange policy",
    "lbl.services": "Services you offer", "lbl.meetingInfo": "Meeting / booking info",
    "lbl.catalogLink": "Catalog / website link", "lbl.hours": "Working hours",
    "lbl.faq": "Common questions & answers", "lbl.special": "Anything else (special rules)",

    // ---- Offers ----
    "bt.off.title": "Running offers",
    "bt.off.sub": "Pick what it applies to, write the deal — the bot quotes it exactly",
    "bt.off.add": "Add offer", "bt.off.addFirst": "Add your first offer",
    "bt.off.none": "No offers yet",
    "bt.off.noneHelpEcom": "Bundle deals, seasonal discounts, free delivery — add them here and the bot brings the right one up whenever a customer asks about those products.",
    "bt.off.noneHelpAgency": "Package deals, launch discounts, free consultations — add them here and the bot brings the right one up whenever a client asks about those services.",
    "bt.off.productsLabel": "Products in this offer",
    "bt.off.servicesLabel": "Services in this offer",
    "bt.off.select": "Select products", "bt.off.selectServices": "Add a service",
    "bt.off.searchProducts": "Search your products…",
    "bt.off.serviceName": "Type a service name and press Enter",
    "bt.off.noProducts": "No products found.",
    "bt.off.goInventory": "Add products in Inventory",
    "bt.off.offerLabel": "Offer (what the customer hears)",
    "bt.off.detailsLabel": "Details (conditions, what's included)",
    "bt.off.validUntil": "Valid until",
    "bt.off.organise": "Organise with AI", "bt.off.organising": "Organising…",
    "bt.off.live": "Live", "bt.off.offState": "Off", "bt.off.n": "Offer {n}",
    "bt.off.hint": "Write the offer roughly, press Organise with AI to tidy it, then Save. Offers stop automatically on their end date.",

    // ---- Bargaining ----
    "bt.bar.title": "Bargaining",
    "bt.bar.subEcom": "Customers will ask for a lower price — choose how your bot answers",
    "bt.bar.subAgency": "Clients will ask for a better rate — choose how your bot answers",
    "bt.bar.fixed": "Never discount",
    "bt.bar.fixedDesc": "The bot politely holds your listed price. It highlights value and any running offer instead.",
    "bt.bar.limited": "Discount up to a limit",
    "bt.bar.limitedDesc": "The bot negotiates in small steps and never goes below the limit you set.",
    "bt.bar.custom": "My own rule",
    "bt.bar.customDesc": "Write your negotiating rule in your own words and the bot follows it.",
    "bt.bar.maxLabel": "Maximum discount (%)",
    "bt.bar.example": "Example: on a {price} price the bot can go down to {floor} — never lower.",
    "bt.bar.secret": "The bot never reveals this limit, and never offers a discount before the customer asks.",
    "bt.bar.customLabel": "Your bargaining rule",
    "bt.bar.customPh": "e.g. No discount under 500. Above that, at most 50 off. Buying 3 or more: free delivery may be offered. Write in any language.",
    "bt.bar.pickOne": "Pick one — this is what the bot does when someone asks for a lower price.",

    // ---- Behavior ----
    "bt.beh.identity": "Bot identity",
    "bt.beh.identitySub": "Who answers your customers, and how it sounds",
    "bt.beh.botName": "Bot name", "bt.beh.businessName": "Business name", "bt.beh.greeting": "Greeting",
    "bt.beh.tone": "Bot tone", "bt.beh.languages": "Customer languages",
    "bt.beh.tone1": "Friendly and helpful", "bt.beh.tone2": "Professional and formal", "bt.beh.tone3": "Casual and fun",
    "bt.beh.lang1": "Follow the customer's language", "bt.beh.lang2": "Bangla only", "bt.beh.lang3": "English only",
    "bt.beh.automation": "Automation", "bt.beh.automationSub": "What the bot does without being asked",
    "bt.beh.followupTitle": "Follow-up message.",
    "bt.beh.followupEcom": "Someone asked about a product but never ordered — send them one reminder.",
    "bt.beh.followupAgency": "Someone asked about a service but never booked — send them one reminder.",
    "bt.beh.followupTail": "They get it once, and it stops immediately if they reply.",
    "bt.beh.delay": "Send after (hours)",
    "bt.beh.delayHelp": "Maximum 23. Facebook, Instagram and WhatsApp close the messaging window 24 hours after the customer's last message, so anything later cannot be delivered.",
    "bt.beh.message": "Message",
    "bt.beh.messageHelp": "Leave empty to use the default message.",
    "bt.beh.guardrails": "Guardrails",
    "bt.beh.guardrailsSub": "Platform rules that keep every bot safe — always on, cannot be changed",
    "bt.beh.seeRules": "See the rules",
    "bt.beh.rulesEcom": "E-commerce rules active", "bt.beh.rulesAgency": "Agency rules active",
    "bt.beh.advanced": "Advanced — the bot's business profile",
    "bt.beh.advancedSub": "The exact text the bot works from; edit only if you know why",
    "bt.beh.advancedHelp": "The Train tab writes this for you. Edit freely — the guardrails above are added automatically on top.",
  },

  bn: {
    "nav.analytics": "অ্যানালিটিক্স", "nav.conversations": "কথোপকথন", "nav.comments": "কমেন্ট",
    "nav.broadcast": "ব্রডকাস্ট", "nav.channels": "চ্যানেল", "nav.billing": "বিলিং",
    "nav.settings": "বট ট্রেনিং", "nav.profile": "প্রোফাইল", "nav.ai": "এআই ইঞ্জিন",
    "nav.inventory": "ইনভেন্টরি", "nav.knowledge": "নলেজ বেজ",
    "nav.orders": "অর্ডার", "nav.bookings": "বুকিং",
    "group.Overview": "সারসংক্ষেপ", "group.Outreach": "যোগাযোগ", "group.Business": "ব্যবসা", "group.Account": "অ্যাকাউন্ট",
    "shell.logout": "লগ আউট", "shell.sync": "রিফ্রেশ", "shell.language": "ভাষা",

    "common.save": "সেভ", "common.saved": "সেভ হয়েছে", "common.unsaved": "সেভ করা হয়নি",
    "common.optional": "ঐচ্ছিক", "common.skip": "বাদ দিন", "common.back": "আগেরটা", "common.send": "পাঠান",
    "common.delete": "মুছুন", "common.close": "বন্ধ", "common.on": "চালু", "common.off": "বন্ধ",
    "common.loading": "লোড হচ্ছে…", "common.search": "খুঁজুন",

    "bt.title": "আপনার বট শেখান",
    "bt.progress": "{total}টির মধ্যে {done}টি ধাপ শেষ। যত বেশি শেখাবেন, তত ভালো বিক্রি করবে।",
    "bt.allDone": "মূল প্রশিক্ষণ শেষ — অফার আর দরদাম যোগ করলে আরও ভালো বিক্রি হবে।",
    "bt.chk.identity": "পরিচয়", "bt.chk.business": "ব্যবসা", "bt.chk.policies": "নিয়মনীতি",
    "bt.chk.services": "সার্ভিস", "bt.chk.qa": "প্রশ্নোত্তর", "bt.chk.offers": "অফার", "bt.chk.bargain": "দরদাম",
    "bt.tab.train": "শেখান", "bt.tab.offers": "অফার", "bt.tab.bargain": "দরদাম", "bt.tab.behavior": "আচরণ",

    "bt.train.title": "ব্যবসার কথা শেখান",
    "bt.train.sub": "বটের প্রশ্নের উত্তর দিন — সে নিজেই নিজের প্রশিক্ষণ লিখে নেবে",
    "bt.train.viewChat": "চ্যাট", "bt.train.viewForm": "ফর্ম",
    "bt.train.intro": "হ্যালো! আমি আপনার বট। কয়েকটা প্রশ্নের উত্তর দিন, আমি আপনার ব্যবসা শিখে নেব। যে ভাষায় খুশি লিখুন — যেকোনো প্রশ্ন বাদ দিতে পারেন, পরে বদলানোও যাবে।",
    "bt.train.done": "সব হয়ে গেছে — ধন্যবাদ! নিচের বোতামে চাপ দিন, আমি আপনার উত্তরগুলো দিয়ে আমার ব্যবসায়িক প্রোফাইল তৈরি করব। চাইলে যেকোনো সময় আবার এই চ্যাট করতে পারবেন; উত্তরগুলো থেকে যাবে।",
    "bt.train.generate": "আমার প্রোফাইল তৈরি করুন",
    "bt.train.generating": "তৈরি হচ্ছে…",
    "bt.train.redo": "আবার শুরু করুন",
    "bt.train.regen": "এআই দিয়ে আবার লিখুন",
    "bt.train.skipped": "(বাদ দেওয়া হয়েছে)",
    "bt.train.genOk": "তৈরি হয়েছে। আচরণ → অ্যাডভান্সড-এ দেখে নিয়ে সেভ করুন।",
    "bt.train.genNeedDesc": "আগে আপনার ব্যবসার কথা লিখুন",
    "bt.train.genFail": "তৈরি করা যায়নি — আবার চেষ্টা করুন।",
    "bt.train.samples": "উদাহরণ থেকে শুরু করে নিজের মতো বদলে নিন:",

    "q.ecom.description": "আপনার ব্যবসার কথা বলুন — কী বিক্রি করেন, দাম কেমন?",
    "ph.ecom.description": "যেমন: আমরা ছেলেদের টি-শার্ট বিক্রি করি, দাম ৩৫০ থেকে ৬০০ টাকা। যেকোনো ভাষায় লিখতে পারেন।",
    "q.ecom.delivery": "ডেলিভারি কীভাবে দেন? কত সময় আর কত চার্জ?",
    "ph.ecom.delivery": "যেমন: শহরের ভেতরে ৬০ টাকা (১-২ দিন), বাইরে ১২০ টাকা (২-৩ দিন)",
    "q.ecom.payment": "কাস্টমার কীভাবে টাকা দেয়?",
    "ph.ecom.payment": "যেমন: ক্যাশ অন ডেলিভারি, বিকাশ, নগদ",
    "q.ecom.returnPolicy": "রিটার্ন বা বদলানোর নিয়ম কী?",
    "ph.ecom.returnPolicy": "যেমন: সমস্যা থাকলে ৭ দিনের মধ্যে বদলে দেওয়া হয়",
    "q.ecom.hours": "কখন খোলা থাকে?",
    "ph.ecom.hours": "যেমন: প্রতিদিন সকাল ১০টা থেকে রাত ১০টা",
    "q.ecom.catalogLink": "কাস্টমার দেখতে পারে এমন কোনো ক্যাটালগ বা ওয়েবসাইট লিংক আছে?",
    "ph.ecom.catalogLink": "যেমন: https://yourshop.com — না থাকলে বাদ দিন",
    "q.ecom.faq": "কাস্টমাররা সবচেয়ে বেশি কী জিজ্ঞেস করে? প্রশ্নগুলো উত্তরসহ লিখুন।",
    "ph.ecom.faq": "প্রশ্ন: স্টকে আছে?\nউত্তর: হ্যাঁ, বেশিরভাগ সাইজ স্টকে আছে।",
    "q.ecom.special": "বটের আর কী জানা দরকার? ব্র্যান্ডের নিয়ম, যা কখনো বলা যাবে না…",
    "ph.ecom.special": "যেমন: সবসময় ভদ্রভাবে সম্বোধন করবে, প্রতিযোগীদের নাম নেবে না — না থাকলে বাদ দিন",

    "q.agency.description": "আপনার ব্যবসার কথা বলুন — কী করেন, কাদের জন্য?",
    "ph.agency.description": "যেমন: আমরা ছোট ব্যবসার জন্য ডিজিটাল মার্কেটিং এজেন্সি। যেকোনো ভাষায় লিখতে পারেন।",
    "q.agency.services": "কী কী সার্ভিস দেন, আর দাম কত?",
    "ph.agency.services": "যেমন: ফেসবুক বিজ্ঞাপন ব্যবস্থাপনা — মাসে ১০,০০০ টাকা থেকে। এসইও — ১৫,০০০ থেকে।",
    "q.agency.meetingInfo": "ক্লায়েন্টরা কীভাবে মিটিং বা কনসালটেশন বুক করে?",
    "ph.agency.meetingInfo": "যেমন: ৩০ মিনিটের ফ্রি কনসালটেশন, অনলাইনে",
    "q.agency.hours": "কখন পাওয়া যায় আপনাদের?",
    "ph.agency.hours": "যেমন: রবিবার থেকে বৃহস্পতিবার, সকাল ১০টা থেকে সন্ধ্যা ৭টা",
    "q.agency.catalogLink": "শেয়ার করার মতো কোনো ওয়েবসাইট বা পোর্টফোলিও লিংক আছে?",
    "ph.agency.catalogLink": "যেমন: https://youragency.com — না থাকলে বাদ দিন",
    "q.agency.faq": "ক্লায়েন্টরা সবচেয়ে বেশি কী জিজ্ঞেস করে? প্রশ্নগুলো উত্তরসহ লিখুন।",
    "ph.agency.faq": "প্রশ্ন: কতদিনে ফল পাওয়া যায়?\nউত্তর: সাধারণত ২ থেকে ৩ মাসের মধ্যে।",
    "q.agency.special": "বটের আর কী জানা দরকার? বিশেষ নিয়ম, কথা বলার ধরন…",
    "ph.agency.special": "না থাকলে বাদ দিন",

    "lbl.description": "আপনার ব্যবসার বর্ণনা", "lbl.delivery": "ডেলিভারি (সময় ও চার্জ)",
    "lbl.payment": "পেমেন্টের মাধ্যম", "lbl.returnPolicy": "রিটার্ন / বদলানোর নিয়ম",
    "lbl.services": "আপনার সার্ভিসসমূহ", "lbl.meetingInfo": "মিটিং / বুকিংয়ের তথ্য",
    "lbl.catalogLink": "ক্যাটালগ / ওয়েবসাইট লিংক", "lbl.hours": "কাজের সময়",
    "lbl.faq": "সাধারণ প্রশ্ন ও উত্তর", "lbl.special": "অন্য কিছু (বিশেষ নিয়ম)",

    "bt.off.title": "চলমান অফার",
    "bt.off.sub": "কীসের ওপর অফার বেছে নিন, শর্ত লিখুন — বট হুবহু সেটাই বলবে",
    "bt.off.add": "অফার যোগ করুন", "bt.off.addFirst": "প্রথম অফারটি যোগ করুন",
    "bt.off.none": "এখনো কোনো অফার নেই",
    "bt.off.noneHelpEcom": "কম্বো অফার, মৌসুমি ছাড়, ফ্রি ডেলিভারি — এখানে যোগ করুন। কাস্টমার ঐ পণ্যের কথা জিজ্ঞেস করলেই বট অফারটি জানাবে।",
    "bt.off.noneHelpAgency": "প্যাকেজ ডিল, লঞ্চ ছাড়, ফ্রি কনসালটেশন — এখানে যোগ করুন। ক্লায়েন্ট ঐ সার্ভিসের কথা জিজ্ঞেস করলেই বট অফারটি জানাবে।",
    "bt.off.productsLabel": "এই অফারের পণ্যসমূহ",
    "bt.off.servicesLabel": "এই অফারের সার্ভিসসমূহ",
    "bt.off.select": "পণ্য বেছে নিন", "bt.off.selectServices": "সার্ভিস যোগ করুন",
    "bt.off.searchProducts": "আপনার পণ্য খুঁজুন…",
    "bt.off.serviceName": "সার্ভিসের নাম লিখে Enter চাপুন",
    "bt.off.noProducts": "কোনো পণ্য পাওয়া যায়নি।",
    "bt.off.goInventory": "ইনভেন্টরিতে পণ্য যোগ করুন",
    "bt.off.offerLabel": "অফার (কাস্টমার যা শুনবে)",
    "bt.off.detailsLabel": "বিস্তারিত (শর্ত, কী কী থাকছে)",
    "bt.off.validUntil": "মেয়াদ",
    "bt.off.organise": "এআই দিয়ে গুছিয়ে নিন", "bt.off.organising": "গোছানো হচ্ছে…",
    "bt.off.live": "চালু", "bt.off.offState": "বন্ধ", "bt.off.n": "অফার {n}",
    "bt.off.hint": "যেভাবে খুশি লিখুন, তারপর 'এআই দিয়ে গুছিয়ে নিন' চাপুন এবং সেভ করুন। মেয়াদ শেষ হলে অফার নিজে থেকেই বন্ধ হয়ে যাবে।",

    "bt.bar.title": "দরদাম",
    "bt.bar.subEcom": "কাস্টমার দাম কমাতে বলবেই — বট কী করবে ঠিক করুন",
    "bt.bar.subAgency": "ক্লায়েন্ট রেট কমাতে বলবেই — বট কী করবে ঠিক করুন",
    "bt.bar.fixed": "কোনো ছাড় নয়",
    "bt.bar.fixedDesc": "বট ভদ্রভাবে আপনার দামেই থাকবে। বদলে পণ্যের মান আর চলমান অফারের কথা বলবে।",
    "bt.bar.limited": "নির্দিষ্ট সীমা পর্যন্ত ছাড়",
    "bt.bar.limitedDesc": "বট অল্প অল্প করে দাম কমাবে, কিন্তু আপনার বেঁধে দেওয়া সীমার নিচে কখনো যাবে না।",
    "bt.bar.custom": "আমার নিজের নিয়ম",
    "bt.bar.customDesc": "নিজের ভাষায় দরদামের নিয়ম লিখে দিন, বট সেটাই মানবে।",
    "bt.bar.maxLabel": "সর্বোচ্চ ছাড় (%)",
    "bt.bar.example": "উদাহরণ: {price} দামের পণ্যে বট সর্বোচ্চ {floor} পর্যন্ত নামতে পারবে — এর নিচে নয়।",
    "bt.bar.secret": "বট এই সীমার কথা কখনো কাস্টমারকে বলবে না, আর কাস্টমার না চাইলে নিজে থেকে ছাড় দেবে না।",
    "bt.bar.customLabel": "আপনার দরদামের নিয়ম",
    "bt.bar.customPh": "যেমন: ৫০০ টাকার নিচে কোনো ছাড় নেই। এর উপরে সর্বোচ্চ ৫০ টাকা ছাড়। ৩টি বা তার বেশি নিলে ফ্রি ডেলিভারি দেওয়া যাবে।",
    "bt.bar.pickOne": "যেকোনো একটি বেছে নিন — কেউ দাম কমাতে বললে বট এটাই করবে।",

    "bt.beh.identity": "বটের পরিচয়",
    "bt.beh.identitySub": "কে আপনার কাস্টমারদের উত্তর দেবে, আর কেমন করে বলবে",
    "bt.beh.botName": "বটের নাম", "bt.beh.businessName": "ব্যবসার নাম", "bt.beh.greeting": "শুভেচ্ছা বার্তা",
    "bt.beh.tone": "বটের ধরন", "bt.beh.languages": "কাস্টমারের ভাষা",
    "bt.beh.tone1": "বন্ধুত্বপূর্ণ ও সহায়ক", "bt.beh.tone2": "পেশাদার ও আনুষ্ঠানিক", "bt.beh.tone3": "সহজ ও প্রাণবন্ত",
    "bt.beh.lang1": "কাস্টমার যে ভাষায় লিখবে", "bt.beh.lang2": "শুধু বাংলা", "bt.beh.lang3": "শুধু ইংরেজি",
    "bt.beh.automation": "স্বয়ংক্রিয় কাজ", "bt.beh.automationSub": "না বললেও বট যা করবে",
    "bt.beh.followupTitle": "ফলো-আপ বার্তা।",
    "bt.beh.followupEcom": "কেউ পণ্যের কথা জিজ্ঞেস করেছিল কিন্তু অর্ডার করেনি — তাকে একটি মনে করিয়ে দেওয়া বার্তা যাবে।",
    "bt.beh.followupAgency": "কেউ সার্ভিসের কথা জিজ্ঞেস করেছিল কিন্তু বুক করেনি — তাকে একটি মনে করিয়ে দেওয়া বার্তা যাবে।",
    "bt.beh.followupTail": "বার্তাটি একবারই যায়, আর উত্তর দিলে সাথে সাথে বন্ধ হয়ে যায়।",
    "bt.beh.delay": "কত ঘণ্টা পর পাঠাবে",
    "bt.beh.delayHelp": "সর্বোচ্চ ২৩। কাস্টমারের শেষ বার্তার ২৪ ঘণ্টা পর ফেসবুক, ইনস্টাগ্রাম ও হোয়াটসঅ্যাপ বার্তা পাঠানোর সুযোগ বন্ধ করে দেয়, তাই এর পরে আর পৌঁছাবে না।",
    "bt.beh.message": "বার্তা",
    "bt.beh.messageHelp": "খালি রাখলে ডিফল্ট বার্তা যাবে।",
    "bt.beh.guardrails": "নিরাপত্তা নিয়ম",
    "bt.beh.guardrailsSub": "প্ল্যাটফর্মের নিয়ম যা প্রতিটি বটকে নিরাপদ রাখে — সবসময় চালু, বদলানো যায় না",
    "bt.beh.seeRules": "নিয়মগুলো দেখুন",
    "bt.beh.rulesEcom": "ই-কমার্স নিয়ম চালু আছে", "bt.beh.rulesAgency": "এজেন্সি নিয়ম চালু আছে",
    "bt.beh.advanced": "অ্যাডভান্সড — বটের ব্যবসায়িক প্রোফাইল",
    "bt.beh.advancedSub": "বট ঠিক যে লেখাটি অনুসরণ করে; বুঝে থাকলে তবেই বদলান",
    "bt.beh.advancedHelp": "'শেখান' ট্যাব এটি আপনার হয়ে লিখে দেয়। ইচ্ছেমতো বদলাতে পারেন — উপরের নিরাপত্তা নিয়ম নিজে থেকেই যুক্ত হয়।",
  },
};
