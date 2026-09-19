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
            background: lang === l.id ? T.accGrad : "transparent", color: lang === l.id ? T.onGold : T.textMuted }}>
          {l.short}
        </button>
      ))}
    </div>
  );
}

const DICT = {
  en: {
    // ---- the assistant ----
    // A name the shop already uses is not a mistake. Fifteen box t-shirts are
    // all called box t-shirts, so this points at what to ADD to the name rather
    // than telling the owner to stop.
    "nav.assistant": "AI Assistant",
    "inv.takingYou": "Taking you to {tab}.",
    "inv.assistantTitle": "Run the whole dashboard by talking to it",
    "inv.assistantSub": "Products, offers, what the bot knows, how far it bargains. It shows you every change before anything happens.",
    "inv.dupSameName": "You already have one called “{name}”. If this is a different design, say what makes it different — the print, the colour — and I will add that to the name so a customer asking for it finds the right one.",
    "inv.add.placeholder": "Add products",
    "inv.add.grp.byhand": "Add by hand",
    "inv.add.grp.import": "Import from elsewhere",
    "inv.add.single": "Add a single product",
    "inv.add.single.desc": "One product — photos, price, sizes & colours",
    "inv.add.many": "Add many products from photos",
    "inv.add.many.desc": "Each photo becomes one product",
    "inv.add.url": "From a product link",
    "inv.add.url.desc": "Paste a URL and we fetch it",
    "inv.add.csv": "From a spreadsheet",
    "inv.add.csv.desc": "A CSV from Excel or Google Sheets",
    "inv.add.woo": "From WooCommerce",
    "inv.add.woo.desc": "Bring your whole WooCommerce shop over",
    "inv.add.shopify": "From Shopify",
    "inv.add.shopify.desc": "Bring your whole Shopify shop over",
    "inv.offers": "Offers",

    // ---- the assistant's own conversation ----
    // Every line the panel says for itself, as opposed to the ones the model
    // writes. They are here rather than in the component for the same reason
    // as everything else on this list: the owner picks a language once, and
    // then the whole dashboard is in it — a chat that answers in English under
    // a Bangla screen is the one place that rule was still being broken.
    "asst.intro": "Just tell me what you want — add a product (attach its photo with 📎), set an offer, change a price, or teach the bot something. I'll ask if I need more, and show you every change before it happens. You have {n} products.",
    "asst.introAgency": "Just tell me what you want — teach the bot a fact, fill in what your service is, set its tone, or attach a document (📎) for it to learn from. I'll ask if I need more, and show you every change before it happens.",
    "asst.chip.add": "Add a new product",
    "asst.chip.noPrice": "Which products have no price?",
    "asst.chip.offer": "Make an Eid offer — 20% off everything",
    "asst.chip.teach": "Tell the bot we are closed on Fridays",
    "asst.chip.teachAgency": "Tell the bot we are closed on Fridays",
    "asst.chip.trainAgency": "Set our services and how pricing works",
    "asst.chip.docsAgency": "Add our rate card document",
    "asst.chip.identityAgency": "Set the bot's tone to friendly",
    "asst.doc.attach": "Attach a document for the bot to learn from",
    "asst.kb.reading": "Reading “{name}” and teaching it to the bot…",
    "asst.kb.learned": "Learned from “{name}” — the bot can now answer from it.",
    "asst.kb.failed": "Could not read “{name}”. Use a PDF, Word or text file.",
    "asst.kb.badType": "Attach a PDF, Word (.docx) or text file for the bot to learn from.",

    // Step 1: what do you want to do at all. Not "how would you like to add
    // products" — that is the right SECOND question and the wrong first one.
    // In order: a bot that has not been told what the business is answers
    // badly about products it does have, and an offer needs a catalogue behind
    // it. The numbers say where to start; nothing is locked.
    "asst.intent.train": "Teach the bot",
    "asst.intent.trainSub": "What it should know about your business",
    "asst.intent.add": "Add products",
    "asst.intent.addSub": "One, or your whole shop at once",
    "asst.intent.offer": "Set up an offer",
    "asst.intent.offerSub": "A deal the bot quotes to customers",
    "asst.whatNext": "Done. What next?",

    // Step 2 and 3: one or several, and then how.
    "asst.one.ask": "How would you like to add it?",
    "asst.one.photo": "Take a photo of it",
    "asst.one.url": "From a product link",
    "asst.many.ask": "Where are they coming from?",
    "asst.orNewCat": "or type a new one",

    // Step 1 of the way in: where the products are coming from.
    "asst.way.shopify": "Shopify",
    "asst.way.shopifySub": "Bring your Shopify catalogue over",
    "asst.way.photos": "From photos",
    "asst.way.photosSub": "Front and back of the same one are gathered",
    "asst.way.csv": "A spreadsheet",
    "asst.way.csvSub": "Hundreds at once, from a CSV",
    "asst.way.url": "A product link",
    "asst.way.urlSub": "We read the page for you",
    "asst.way.woo": "WooCommerce",
    "asst.way.wooSub": "Bring your whole shop over",

    // Step 2: one, or a rail of them. Asked before anything else, because
    // interviewing somebody about the first of fifteen shirts is the one
    // mistake here that costs a whole evening.
    "asst.count.ask": "One product, or several together?",
    "asst.count.one": "Just one",
    "asst.count.many": "Several at once",

    // Step 3: what is about to happen, before it happens. Four lines, so
    // nobody is halfway through wondering whether it has already saved.
    "asst.rule.one": "Here is how it goes:\n1. Photo first — attach one or more with the camera button, and I will read them.\n2. Then I ask one thing at a time: name, category, price, details, choices.\n3. Every question shows you what an answer looks like. Say “skip” to anything you do not have.\n4. Nothing is saved until you press Save at the end.",
    "asst.photoFirst": "Start with the picture — tap the camera button beside the message box. Front, back, close-ups: attach them all at once, and the first one is what customers see. I will read them and fill in what I can, then ask you the rest.",
    "asst.rule.shopify": "Here is how it goes:\n1. In your Shopify admin: Settings → Apps and sales channels → Develop apps → Create an app.\n2. Configure Admin API scopes, tick read_products, then Install and reveal the token.\n3. Give me your shop address (the one ending in myshopify.com) and that token.\n4. You check the list before anything is added. Your Shopify shop is not changed.",
    "asst.rule.offer": "Here is how it goes:\n1. Three questions: what the offer is called, what the customer gets, and when it ends.\n2. The bot quotes an offer word for word, so write it the way a customer should read it.\n3. You see it as a card and press the button. Nothing is saved before that.\n4. Which products it covers is picked on the Offers tab, where the real list is.",
    "asst.rule.train": "Here is how it goes:\n1. I ask what the bot should know — delivery, payment, returns, hours, and so on.\n2. Answer in your own words, skip anything that does not apply, and stop whenever you like.\n3. You see everything you said as one card and press the button.\n4. Then press “Regenerate with AI” on Bot Training so it writes this into how it answers.",
    "asst.rule.many": "Here is how it goes:\n1. First, three things they all share — what they are, the price, the choices customers pick between.\n2. Then you attach every photo at once: front, back, close-ups, all together.\n3. I work out which pictures belong to the same one, and name each by what makes it different.\n4. You check the list and press Add. Nothing is saved before that.",
    "asst.rule.csv": "Here is how it goes:\n1. Download the sample sheet so the column names match.\n2. Fill in one row per product. A row can hold several photo links.\n3. Upload it, and check what I read before anything is added.\n4. Hundreds at a time is fine.",
    "asst.rule.url": "Here is how it goes:\n1. Paste the address of one product page.\n2. I read the page — the name, the price, the photos.\n3. You check what I found and correct anything wrong.\n4. Nothing is saved until you press Add.",
    "asst.rule.woo": "Here is how it goes:\n1. Give me your WooCommerce address and its two keys, from WooCommerce → Settings → Advanced → REST API.\n2. I bring across every product with its photos.\n3. You check the list before anything is added.\n4. Your shop stays exactly as it is — nothing is changed there.",
    "asst.rule.open": "Open it",
    "asst.overview.open": "Opening the overview image editor — pick the category, drop the image the bot should send, and add a short intro.",

    // The three questions asked once for a whole rail.
    "asst.batch.kind": "What kind of thing are these? One answer for all of them. (for example: Box T-shirt)",
    "asst.batch.kindPh": "e.g. Box T-shirt",
    "asst.batch.price": "Same price for all of them? Type the price, or press the button below. (for example: 500)",
    "asst.batch.pricePh": "e.g. 500",
    "asst.batch.priceSkip": "They are different",
    "asst.batch.options": "Do customers pick between anything — sizes, colours, capacities, weights? (for example: Size: S, M, L)",
    "asst.batch.optionsNamed": "What {axis} do they come in? Separated by commas. (for example: {axis}: A, B; Colour: Black)",
    "asst.batch.optionsPh": "e.g. Size: S, M, L",
    "asst.batch.optionsPhNamed": "{axis} options",
    "asst.batch.optionsSkip": "No choices",
    "asst.batch.optionsSkipNamed": "No {axis}",
    "asst.batch.done": "Good. Now add every photo of your {kind} — front, back, close-ups, all of them together. I will work out which pictures belong to the same one and name each by what makes it different.",
    "asst.skipped": "skipped",

    // Setting up an offer, and teaching the bot. Both end as a card the owner
    // confirms, the same as every other change this panel makes.
    "asst.offer.name": "What should the offer be called? (for example: Eid sale)",
    "asst.offer.namePh": "e.g. Eid sale",
    "asst.offer.what": "What does the customer get? Write it the way they should read it. (for example: 20% off everything, free delivery over 2000)",
    "asst.offer.whatPh": "e.g. 20% off everything",
    "asst.offer.until": "When does it end? (for example: 15 April)",
    "asst.offer.untilPh": "e.g. 15 April",
    "asst.offer.untilSkip": "No end date",
    "asst.offer.ready": "Here is the offer. Read it as a customer would, then press the button — nothing is saved until you do. Which products it covers is picked on the Offers tab.",
    "asst.train.finish": "That is enough for now",
    "asst.train.ready": "Here is everything you told me. Press the button to save it, then press “Regenerate with AI” on Bot Training so it writes this into how it answers.",
    "asst.nothingSaid": "You skipped all of them, so there is nothing to save. Start again whenever you like.",

    // The product being built.
    "asst.stopped": "Stopped. Nothing was added.",
    "asst.cancel": "Cancel",
    "asst.draftTitle": "New product — not saved yet",
    "asst.needed": "Still needed before this can be saved: ",
    // The field names go between these two, in bold, so the sentence has to be
    // ended separately — and the two languages do not end a sentence with the
    // same mark.
    "asst.neededEnd": ".",
    "asst.readyOne": " is not set — you can add it now, or save without it.",
    "asst.readyMany": " are not set — you can add them now, or save without them.",
    "asst.readyPrefix": "Ready to save. ",
    "asst.allFilled": "Everything is filled in.",
    "asst.photoCount": "{n} photos, {size}",
    "asst.photoTooLarge": "{n} photo(s) could not be shrunk and are over {max} each — they cannot be sent as they are. Press “Shrink photos” or remove them.",
    "asst.shrinkAgain": "Shrink photos",
    "asst.uploading": "Uploading photo {done} of {total}…",
    "asst.save": "Save “{name}”",
    "asst.addAnyway": "Add anyway",
    "asst.savedLine": "“{name}” is in your catalogue.",
    "asst.added": "Added “{name}”. Say “add another” whenever you are ready.",
    "asst.addedBlind": "Added “{name}” — but the photo could not be read, so customers cannot find it by sending a picture. Say “add another” whenever you are ready.",
    "asst.dupRefused": "{message} Press “Add anyway” if this really is a different one.",

    // Photos.
    "asst.photo.added": "Added {n} photos.",
    "asst.photo.added1": "Added 1 photo.",
    "asst.photo.repeats": "{n} were already here — skipped.",
    "asst.photo.repeats1": "1 was the same picture — skipped.",
    "asst.photo.overflow": "{n} did not fit: one product holds {max}.",
    "asst.photo.overflowTip": "{n} photos could not go on this product — {max} is the most one product can have. If those are different products, press “From photos” below and add them together instead.",
    "asst.photo.attach": "Attach photos of this product",
    "asst.photo.full": "{max} photos is the most one product can have",
    "asst.photo.first": "Customers see this one",
    "asst.photo.makeFirst": "Make this the first one",
    "asst.photo.remove": "Remove photo {n}",
    "asst.photo.firstBadge": "1st",

    // Proposals — the assistant never changes anything on its own.
    "asst.proposed": "Proposed — nothing has changed yet",
    "asst.apply": "Apply {n} changes",
    "asst.apply1": "Apply 1 change",
    "asst.discard": "Discard",
    "asst.discarded": "Discarded — nothing was changed.",
    "asst.applied": "{n} changes saved.",
    "asst.applied1": "1 change saved.",
    "asst.appliedSome": "{n} saved, {m} could not be: {errors}.",

    // The message box.
    "asst.ph.answer": "Type your answer…",
    "asst.ph.chat": "Ask, or say what to change…",
    "asst.thinking": "Thinking…",
    "asst.writing": "Writing it down…",
    "asst.prepping": "Preparing photos…",
    "asst.reading": "Reading photo {n} of {total}…",
    "asst.aria": "Message the assistant",

    // Going somewhere else without leaving the conversation.

    // ---- the confirmation cards ----
    // What the owner reads on a proposal before pressing the button. The two
    // describers are browser-only, so they take the translator and every word
    // on a card follows the dashboard's language like everything else.
    "card.deleteProduct": "Delete {name}",
    "card.deleteProductWhy": "The product and its photos are removed from the catalogue. The bot stops offering it.",
    "card.addProduct": "Add {name}",
    "card.noPhotoYet": "No photo yet — open the product to add one, or the bot cannot match it to a customer's picture.",
    "card.changeProduct": "Change {name}",
    "card.thisProduct": "this product", "card.aProduct": "product",
    "card.inStock": "in stock", "card.outOfStock": "out of stock",
    "card.on": "on", "card.off": "off", "card.notSet": "not set",
    "card.addOffer": "Add the offer “{name}”",
    "card.changeOffer": "Change the offer “{name}”",
    "card.removeOffer": "Remove the offer “{name}”",
    "card.removeOfferWhy": "The bot stops mentioning it to customers. Switching it off instead keeps it for later.",
    "card.offerQuoted": "The bot quotes an offer exactly as written, so read it as a customer would.",
    "card.bargain": "Set how far the bot may bargain",
    "card.bargainMode": "How it bargains",
    "card.bargainPct": "Most it may take off",
    "card.bargainCustom": "Your own rule",
    "card.mode.fixed": "never moves on price",
    "card.mode.limited": "may take a little off",
    "card.mode.custom": "your own rule",
    "card.teach": "Teach the bot this",
    "card.forget": "Make the bot forget this",
    "card.training": "Update what the bot knows about the business",
    "card.trainingThen": "Press “Regenerate with AI” on Bot Training afterwards, so the bot writes this into how it answers.",
    "card.identity": "Change who the bot says it is",
    "card.followOn": "Turn follow-up messages on",
    "card.followOnWhy": "The bot messages customers who went quiet, inside Meta's 24-hour window.",
    "card.followOff": "Turn follow-up messages off",
    "card.followOffWhy": "The bot stops messaging customers who went quiet.",
    "card.setting": "Change a setting",

    // The offer's and the bot's own fields. The PROFILE questions are not here:
    // they are labelled on the Bot Training form already, and a card reads the
    // same `lbl.*` key so a label is translated once.
    "sfld.title": "Name", "sfld.details": "What the customer gets",
    "sfld.valid_until": "Runs until", "sfld.active": "Live",
    "sfld.botName": "Bot's name", "sfld.businessName": "Business name",
    "sfld.greeting": "Opening line", "sfld.tone": "Tone", "sfld.languages": "Languages",

    // The product's own fields, wherever the assistant names one to the owner.
    // `inventory-actions.js` holds the English labels because the server prompt
    // needs them; these are the ones a person reads.
    "fld.product_name": "Name", "fld.category": "Category", "fld.regular_price": "Price",
    "fld.description": "Description", "fld.options": "Sizes / colours", "fld.photo": "Photos",
    "fld.stock_qty": "Stock", "fld.brand": "Brand", "fld.sale_price": "Sale price",
    "fld.product_code": "Code", "fld.tags": "Tags", "fld.stock_status": "Availability",

    // ---- navigation & shell ----
    "nav.analytics": "Analytics", "nav.conversations": "Inbox", "nav.comments": "Comments",
    "nav.broadcast": "Broadcast", "nav.channels": "Channels", "nav.billing": "Billing",
    "nav.settings": "Bot Training", "nav.profile": "Profile", "nav.ai": "AI Engine",
    "nav.inventory": "Inventory", "nav.knowledge": "Knowledge Base",
    "nav.orders": "Orders", "nav.bookings": "Bookings",
    "nav.overview": "Overview", "nav.more": "More",
    "ov.morning": "Good morning", "ov.afternoon": "Good afternoon", "ov.evening": "Good evening",
    "ov.lead": "The last 7 days at a glance",
    "ov.live": "Bot is live on {n} channel(s)", "ov.notLive": "No channel connected yet",
    "ov.expired": "{n} channel connection(s) expired — the bot cannot answer there until you reconnect.", "ov.fix": "Reconnect",
    "ov.kpi.messages": "Messages", "ov.kpi.customers": "Customers", "ov.kpi.bot": "Answered by AI", "ov.kpi.revenue": "Revenue", "ov.kpi.bookings": "Bookings",
    "ov.today": "{n} today", "ov.new": "{n} new", "ov.needed": "{n} needed you", "ov.orders": "{n} orders", "ov.ofCustomers": "{n}% of customers",
    "ov.week": "Messages this week", "ov.all": "All messages", "ov.byAI": "Answered by AI", "ov.weekEmpty": "No messages yet this week.",
    "ov.needs": "Needs you", "ov.openInbox": "Open Inbox", "ov.needsEmpty": "Nothing is waiting for you. The bot has it covered.",
    "ov.why.human": "Asked for a person", "ov.why.complaint": "Complaint", "ov.why.unread": "Unread", "ov.more": "and {n} more in the Inbox",
    "ov.recentOrders": "Recent orders", "ov.ordersEmpty": "No orders yet. They appear here the moment the bot takes one.", "ov.items": "{n} item(s)",
    "ov.meetings": "Next meetings", "ov.meetingsEmpty": "No upcoming meetings.", "ov.join": "Join",
    "ov.channels": "Channels", "ov.manage": "Manage", "ov.channelsEmpty": "Connect Facebook, Instagram or WhatsApp to start.",
    "ov.ch.live": "Live — the bot is answering", "ov.ch.paused": "Paused — messages wait for you", "ov.ch.expired": "Expired — reconnect to resume",
    "ov.customer": "Customer", "ov.now": "just now", "ov.min": "{n} min ago", "ov.hr": "{n} h ago", "ov.day": "{n} d ago",
    "shell.logout": "Log out", "shell.sync": "Sync", "shell.language": "Language",
    "shell.train": "Train your bot", "shell.managePlan": "Manage plan",
    "shell.needYou": "{n} chats need you", "shell.repliesMonth": "Replies this month", "shell.repliesToday": "Replies today",
    "shell.business": "Business", "shell.service": "Service",
    "group.Workspace": "Workspace", "group.Grow": "Grow", "group.Train": "Train", "group.Account": "Account",
    "ov.todayTitle": "Today",
    "shell.usedMonth": "{used} of {limit} replies used this month", "shell.usedDay": "{used} of {limit} replies used today",
    "shell.usedFree": "{used} replies this month",
    "shell.search": "Search customers, orders…", "shell.searchAgency": "Search customers…", "shell.searchAria": "Search",
    "search.customers": "Customers", "search.orders": "Orders", "search.products": "Products", "search.none": "Nothing matches “{q}”",
    "inbox.title": "Conversations", "inbox.all": "All", "inbox.needs": "Needs you", "inbox.manual": "Manual",
    "inbox.botReplying": "Bot replying", "inbox.youReplying": "You are replying", "inbox.takeOver": "Take over", "inbox.handBack": "Hand back to bot",
    "inbox.placeholder": "Write a reply or let the bot answer…", "inbox.answeredIn": "answered in {s} s",
    "inbox.today": "Today", "inbox.yesterday": "Yesterday",
    "inbox.inStock": "In stock · {n} left", "inbox.inStockNoQty": "In stock", "inbox.outOfStock": "Out of stock",
    "inbox.kpi.today": "Conversations today", "inbox.kpi.bot": "Answered by the bot, 7 days", "inbox.kpi.value": "Orders value, 7 days",
    "inbox.kpi.bookings": "Bookings, 7 days", "inbox.kpi.reply": "Avg. first reply, 7 days",

    // ---- shared ----
    "common.save": "Save", "common.saved": "Saved", "common.unsaved": "Unsaved changes",
    "common.optional": "optional", "common.skip": "Skip", "common.back": "Back", "common.send": "Send", "common.cancel": "Cancel",
    "common.delete": "Delete", "common.close": "Close", "common.on": "On", "common.off": "Off",
    "common.loading": "Loading…", "common.search": "Search",
    "docs.learn": "Read docs", "docs.learnHint": "Read the guide for this tab",

    // ---- Bot Training: header & checklist ----
    "bt.title": "Train your bot",
    "bt.progress": "{done} of {total} steps done. The more you give it, the better it sells.",
    "bt.allDone": "Core training done — offers and bargaining make it sell even better.",
    "bt.chk.identity": "Identity", "bt.chk.business": "Business", "bt.chk.policies": "Policies",
    "bt.chk.services": "Services", "bt.chk.qa": "Q&A", "bt.chk.offers": "Offers", "bt.chk.bargain": "Bargaining",
    "bt.tab.train": "Train", "bt.tab.offers": "Offers", "bt.tab.bargain": "Bargaining", "bt.tab.behavior": "Behavior",

    // ---- Train ----
    "bt.train.title": "Teach it your business",
    "bt.train.sub": "Fill in what it should know — it writes its own training from this",
    "bt.train.answered": "{n} of {total} answered",
    // The one-at-a-time version of these questions lives on the AI Assistant
    // tab now. The keys the chat used are gone with it; the `q.*` block below
    // is what phrased those questions and is kept, because it is the wording a
    // person recognises and the assistant will want it.
    "bt.train.askThere": "Prefer to be asked? The AI Assistant can fill any of this in from a conversation, and shows you the change before it saves.",
    "bt.train.generating": "Generating…",
    "bt.train.regen": "Regenerate with AI",
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
    "lbl.products": "Main products / categories", "lbl.deliveryAreas": "Delivery areas",
    "lbl.advancePay": "Advance payment rule", "lbl.stock": "When something is out of stock",
    "lbl.warranty": "Warranty / guarantee", "lbl.complaints": "Handling complaints",
    "lbl.pricing": "How pricing works", "lbl.process": "How you work with a client",
    "lbl.timeline": "Timeline / results", "lbl.clients": "Who you work with",
    "lbl.contract": "Contract & payment terms", "lbl.objections": "Common objections",

    // Deeper interview — a shop and an agency get their own question sets.
    "q.ecom.products": "What are your main products or categories, and which sell best?",
    "ph.ecom.products": "e.g. T-shirts, polo shirts, panjabi. Best sellers are plain t-shirts and panjabi.",
    "q.ecom.deliveryAreas": "Where do you deliver? Anywhere you do not?",
    "ph.ecom.deliveryAreas": "e.g. All over the country. No delivery to hill districts.",
    "q.ecom.advancePay": "Do you need any advance payment before shipping?",
    "ph.ecom.advancePay": "e.g. Advance of 100 for outside-city orders, none inside the city",
    "q.ecom.stock": "If something is out of stock, what should the bot say?",
    "ph.ecom.stock": "e.g. Say it will be back in about a week and suggest a similar item",
    "q.ecom.warranty": "Any warranty or guarantee on your products?",
    "ph.ecom.warranty": "e.g. No warranty on clothing. Watches have a 6-month warranty. Skip if none.",
    "q.ecom.complaints": "If a customer is angry or complains, what should the bot do?",
    "ph.ecom.complaints": "e.g. Apologise, ask for the order number and photos, promise a team member will call within an hour",

    "q.agency.pricing": "How does your pricing work — fixed packages, hourly, or custom quotes?",
    "ph.agency.pricing": "e.g. Monthly retainer packages. Custom projects are quoted after a call.",
    "q.agency.process": "How do you work with a client, step by step?",
    "ph.agency.process": "e.g. Free consultation, then proposal, then a 2-week setup, then monthly reporting",
    "q.agency.timeline": "How long before a client sees results?",
    "ph.agency.timeline": "e.g. First results in 4 to 6 weeks, strong results by month 3",
    "q.agency.clients": "Who do you usually work with? Any industries or clients to mention?",
    "ph.agency.clients": "e.g. Small shops, restaurants and clinics. We have worked with 40+ local brands.",
    "q.agency.contract": "Any contract length or payment terms clients should know?",
    "ph.agency.contract": "e.g. Minimum 3 months, 50% in advance, rest at month end",
    "q.agency.objections": "What do clients hesitate about, and how do you answer them?",
    "ph.agency.objections": "e.g. \"Too expensive\" — we explain the return on ad spend and offer a smaller starter package",

    // ---- Teach more (ongoing training chat) ----
    "bt.more.title": "Teach it more",
    "bt.more.sub": "Add anything new anytime — a rule, a price change, something a customer asked",
    "bt.more.ph": "Type anything the bot should know from now on…",
    "bt.more.add": "Teach the bot",
    "bt.more.empty": "Nothing extra taught yet. Everything you add here is remembered on top of the answers above.",
    "bt.more.saveHint": "Added. Press Save below to make it live.",
    "bt.more.count": "{n} things taught",
    "bt.more.remove": "Remove",

    // ---- Expandable prompt editor ----
    "bt.beh.expand": "Expand", "bt.beh.collapse": "Collapse", "bt.beh.fullscreen": "Open full editor",
    "bt.beh.editorTitle": "The bot's business profile",
    "bt.beh.chars": "{n} characters",
    "bt.beh.done": "Done",

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
    "nav.assistant": "এআই সহকারী",
    "inv.takingYou": "{tab} খুলে দিচ্ছি।",
    "inv.assistantTitle": "কথা বলেই পুরো ড্যাশবোর্ড চালান",
    "inv.assistantSub": "প্রোডাক্ট, অফার, বট কী জানে, কতদূর দরদাম করবে। কিছু হওয়ার আগে কী বদলাচ্ছে দেখিয়ে দেয়।",
    "inv.dupSameName": "“{name}” নামে একটা আপনার আগেই আছে। এটা যদি আলাদা ডিজাইন হয়, বলুন কীসে আলাদা — প্রিন্ট, রং — নামের সাথে সেটা জুড়ে দেব, যাতে কাস্টমার চাইলে ঠিকটাই পায়।",
    "inv.add.placeholder": "প্রোডাক্ট যোগ করুন",
    "inv.add.grp.byhand": "নিজে হাতে যোগ করুন",
    "inv.add.grp.import": "অন্য জায়গা থেকে আনুন",
    "inv.add.single": "একটি প্রোডাক্ট যোগ করুন",
    "inv.add.single.desc": "একটি প্রোডাক্ট — ছবি, দাম, সাইজ ও রং",
    "inv.add.many": "ছবি থেকে অনেক প্রোডাক্ট যোগ করুন",
    "inv.add.many.desc": "প্রতিটি ছবি একটি করে প্রোডাক্ট হবে",
    "inv.add.url": "প্রোডাক্ট লিংক থেকে",
    "inv.add.url.desc": "একটি URL দিন, আমরা এনে দিচ্ছি",
    "inv.add.csv": "স্প্রেডশিট থেকে",
    "inv.add.csv.desc": "Excel বা Google Sheets-এর CSV",
    "inv.add.woo": "WooCommerce থেকে",
    "inv.add.woo.desc": "আপনার পুরো WooCommerce দোকান নিয়ে আসুন",
    "inv.add.shopify": "Shopify থেকে",
    "inv.add.shopify.desc": "আপনার পুরো Shopify দোকান নিয়ে আসুন",
    "inv.offers": "অফার",

    // ---- the assistant's own conversation ----
    "asst.intro": "শুধু বলুন কী চান — প্রোডাক্ট যোগ করুন (📎 দিয়ে ছবি দিন), অফার দিন, দাম বদলান, বা বটকে কিছু শেখান। দরকার হলে জিজ্ঞেস করব, আর কিছু হওয়ার আগে দেখিয়ে দেব। আপনার {n}টা প্রোডাক্ট আছে।",
    "asst.introAgency": "শুধু বলুন কী চান — বটকে একটা তথ্য শেখান, আপনার সার্ভিস কী তা লিখুন, বটের টোন ঠিক করুন, বা শেখার জন্য একটা ডকুমেন্ট দিন (📎)। দরকার হলে জিজ্ঞেস করব, আর কিছু হওয়ার আগে দেখিয়ে দেব।",
    "asst.chip.add": "একটা নতুন প্রোডাক্ট যোগ করুন",
    "asst.chip.noPrice": "কোন প্রোডাক্টের দাম দেওয়া নেই?",
    "asst.chip.offer": "ঈদের অফার দিন — সবকিছুতে ২০% ছাড়",
    "asst.chip.teach": "বটকে বলুন শুক্রবার আমরা বন্ধ",
    "asst.chip.teachAgency": "বটকে বলুন শুক্রবার আমরা বন্ধ",
    "asst.chip.trainAgency": "আমাদের সার্ভিস আর দাম কীভাবে হয় সেট করুন",
    "asst.chip.docsAgency": "আমাদের রেট কার্ড ডকুমেন্ট যোগ করুন",
    "asst.chip.identityAgency": "বটের টোন বন্ধুত্বপূর্ণ করুন",
    "asst.doc.attach": "বট যা থেকে শিখবে সেই ডকুমেন্ট দিন",
    "asst.kb.reading": "“{name}” পড়ে বটকে শেখানো হচ্ছে…",
    "asst.kb.learned": "“{name}” থেকে শেখা হলো — বট এখন এটা থেকে উত্তর দিতে পারবে।",
    "asst.kb.failed": "“{name}” পড়া গেল না। PDF, Word বা টেক্সট ফাইল দিন।",
    "asst.kb.badType": "বট শেখার জন্য PDF, Word (.docx) বা টেক্সট ফাইল দিন।",

    "asst.intent.train": "বটকে শেখান",
    "asst.intent.trainSub": "আপনার ব্যবসার কী কী জানা দরকার",
    "asst.intent.add": "প্রোডাক্ট যোগ করুন",
    "asst.intent.addSub": "একটা, বা পুরো দোকান একসাথে",
    "asst.intent.offer": "অফার সেট করুন",
    "asst.intent.offerSub": "বট কাস্টমারকে যে ডিলটা বলবে",
    "asst.whatNext": "হয়ে গেছে। এবার কী?",

    "asst.one.ask": "কীভাবে যোগ করতে চান?",
    "asst.one.photo": "ছবি তুলে দিন",
    "asst.one.url": "প্রোডাক্টের লিংক থেকে",
    "asst.many.ask": "কোথা থেকে আনব?",
    "asst.orNewCat": "অথবা নতুন একটা লিখুন",

    "asst.way.shopify": "Shopify",
    "asst.way.shopifySub": "Shopify-এর ক্যাটালগ নিয়ে আসুন",
    "asst.way.photos": "ছবি থেকে",
    "asst.way.photosSub": "একই জিনিসের সামনে-পেছনে এক করে নেওয়া হবে",
    "asst.way.csv": "স্প্রেডশিট",
    "asst.way.csvSub": "CSV থেকে একসাথে শত শত",
    "asst.way.url": "প্রোডাক্টের লিংক",
    "asst.way.urlSub": "পেজটা আমরা পড়ে নেব",
    "asst.way.woo": "WooCommerce",
    "asst.way.wooSub": "পুরো দোকান নিয়ে আসুন",

    "asst.count.ask": "একটা প্রোডাক্ট, নাকি একসাথে কয়েকটা?",
    "asst.count.one": "একটাই",
    "asst.count.many": "একসাথে কয়েকটা",

    "asst.rule.one": "নিয়মটা এরকম:\n১. আগে ছবি — মেসেজ বাক্সের পাশের ক্যামেরা বোতাম দিয়ে এক বা একাধিক ছবি দিন, আমি পড়ে নেব।\n২. তারপর একবারে একটা করে জিজ্ঞেস করব: নাম, ক্যাটাগরি, দাম, বিবরণ, ভ্যারিয়েন্ট।\n৩. প্রতিটা প্রশ্নের সাথে উত্তরের নমুনা থাকবে। যেটা নেই সেটায় “skip” লিখে দিন।\n৪. শেষে Save না চাপা পর্যন্ত কিছুই সেভ হবে না।",
    "asst.photoFirst": "ছবি দিয়েই শুরু করুন — মেসেজ বাক্সের পাশের ক্যামেরা বোতামে চাপ দিন। সামনে, পেছনে, ক্লোজ-আপ: সব একসাথে দিন, প্রথমটাই কাস্টমার দেখবে। আমি পড়ে যা পারি ভরে দেব, বাকিটা জিজ্ঞেস করব।",
    "asst.rule.shopify": "নিয়মটা এরকম:\n১. Shopify অ্যাডমিনে: Settings → Apps and sales channels → Develop apps → Create an app।\n২. Configure Admin API scopes-এ read_products টিক দিন, তারপর Install করে টোকেনটা দেখুন।\n৩. আপনার শপ ঠিকানা (myshopify.com দিয়ে শেষ হয় যেটা) আর ওই টোকেনটা দিন।\n৪. কিছু যোগ হওয়ার আগে তালিকাটা দেখে নিন। আপনার Shopify দোকানে কিছু বদলাবে না।",
    "asst.rule.offer": "নিয়মটা এরকম:\n১. তিনটা প্রশ্ন: অফারের নাম কী, কাস্টমার কী পাবে, আর কবে শেষ হবে।\n২. বট অফারটা হুবহু বলে, তাই কাস্টমার যেভাবে পড়বে সেভাবেই লিখুন।\n৩. একটা কার্ড হিসেবে দেখবেন, তারপর বোতাম চাপবেন। তার আগে কিছুই সেভ হবে না।\n৪. কোন প্রোডাক্টে অফারটা লাগবে সেটা Offers ট্যাবে বাছবেন, ওখানে আসল তালিকা আছে।",
    "asst.rule.train": "নিয়মটা এরকম:\n১. বটের কী কী জানা দরকার জিজ্ঞেস করব — ডেলিভারি, পেমেন্ট, রিটার্ন, খোলার সময়, এসব।\n২. নিজের ভাষায় উত্তর দিন, যেটা খাটে না বাদ দিন, যখন খুশি থামুন।\n৩. আপনি যা যা বলেছেন সব একটা কার্ডে দেখে বোতাম চাপবেন।\n৪. তারপর Bot Training-এ “এআই দিয়ে আবার লিখুন” চাপবেন, যাতে বট এগুলো নিজের উত্তরে কাজে লাগায়।",
    "asst.rule.many": "নিয়মটা এরকম:\n১. প্রথমে তিনটা প্রশ্ন — সবগুলো কী জিনিস, দাম, আর কাস্টমার কী কী থেকে বেছে নেয়।\n২. তারপর সব ছবি একসাথে দিন: সামনে, পেছনে, ক্লোজ-আপ, সব।\n৩. কোন ছবিগুলো একই জিনিসের, আমি সেটা বের করব আর প্রত্যেকটার নাম দেব কীসে আলাদা তা দিয়ে।\n৪. আপনি তালিকাটা দেখে Add চাপবেন। তার আগে কিছুই সেভ হবে না।",
    "asst.rule.csv": "নিয়মটা এরকম:\n১. নমুনা শিটটা নামিয়ে নিন, যাতে কলামের নাম মিলে যায়।\n২. প্রতি প্রোডাক্টের জন্য এক লাইন। এক লাইনে কয়েকটা ছবির লিংক দেওয়া যায়।\n৩. আপলোড করুন, আর কিছু যোগ হওয়ার আগে আমি কী পড়লাম দেখে নিন।\n৪. একসাথে শত শত দিলেও সমস্যা নেই।",
    "asst.rule.url": "নিয়মটা এরকম:\n১. একটা প্রোডাক্ট পেজের ঠিকানা পেস্ট করুন।\n২. আমি পেজটা পড়ব — নাম, দাম, ছবি।\n৩. আমি কী পেলাম দেখে নিন, ভুল থাকলে ঠিক করে দিন।\n৪. Add না চাপা পর্যন্ত কিছুই সেভ হবে না।",
    "asst.rule.woo": "নিয়মটা এরকম:\n১. আপনার WooCommerce ঠিকানা আর দুইটা কী দিন — WooCommerce → Settings → Advanced → REST API থেকে পাবেন।\n২. আমি সব প্রোডাক্ট ছবিসহ নিয়ে আসব।\n৩. কিছু যোগ হওয়ার আগে তালিকাটা দেখে নিন।\n৪. আপনার দোকান যেমন আছে তেমনই থাকবে — সেখানে কিছু বদলাবে না।",
    "asst.rule.open": "খুলুন",
    "asst.overview.open": "ওভারভিউ ছবির এডিটর খুলছি — ক্যাটাগরি বাছুন, বট যে ছবিটা পাঠাবে সেটা দিন, আর ছোট একটা বর্ণনা লিখুন।",

    "asst.batch.kind": "এগুলো কী জিনিস? সবগুলোর জন্য একটাই উত্তর। (যেমন: বক্স টি-শার্ট)",
    "asst.batch.kindPh": "যেমন: বক্স টি-শার্ট",
    "asst.batch.price": "সবগুলোর দাম কি একই? দামটা লিখুন, বা নিচের বোতামটা চাপুন। (যেমন: 500)",
    "asst.batch.pricePh": "যেমন: 500",
    "asst.batch.priceSkip": "দাম আলাদা আলাদা",
    "asst.batch.options": "কাস্টমার কি কিছু থেকে বেছে নেয় — সাইজ, রং, ক্যাপাসিটি, ওজন? (যেমন: সাইজ: S, M, L)",
    "asst.batch.optionsNamed": "এগুলোতে কী কী {axis} আছে? কমা দিয়ে আলাদা করুন। (যেমন: {axis}: A, B; রং: কালো)",
    "asst.batch.optionsPh": "যেমন: সাইজ: S, M, L",
    "asst.batch.optionsPhNamed": "{axis} কী কী",
    "asst.batch.optionsSkip": "বেছে নেওয়ার কিছু নেই",
    "asst.batch.optionsSkipNamed": "{axis} নেই",
    "asst.batch.done": "ঠিক আছে। এবার আপনার {kind}-এর সব ছবি দিন — সামনে, পেছনে, ক্লোজ-আপ, সব একসাথে। কোন ছবিগুলো একই জিনিসের আমি বের করব, আর প্রত্যেকটার নাম দেব কীসে আলাদা তা দিয়ে।",
    "asst.skipped": "বাদ দেওয়া হলো",

    "asst.offer.name": "অফারটার নাম কী দেবেন? (যেমন: ঈদ সেল)",
    "asst.offer.namePh": "যেমন: ঈদ সেল",
    "asst.offer.what": "কাস্টমার কী পাবে? কাস্টমার যেভাবে পড়বে সেভাবেই লিখুন। (যেমন: সবকিছুতে ২০% ছাড়, ২০০০ টাকার উপরে ফ্রি ডেলিভারি)",
    "asst.offer.whatPh": "যেমন: সবকিছুতে ২০% ছাড়",
    "asst.offer.until": "কবে শেষ হবে? (যেমন: ১৫ এপ্রিল)",
    "asst.offer.untilPh": "যেমন: ১৫ এপ্রিল",
    "asst.offer.untilSkip": "শেষ তারিখ নেই",
    "asst.offer.ready": "এই হলো অফারটা। কাস্টমার যেভাবে পড়বে সেভাবে একবার পড়ে নিয়ে বোতাম চাপুন — তার আগে কিছুই সেভ হবে না। কোন প্রোডাক্টে লাগবে সেটা Offers ট্যাবে বাছবেন।",
    "asst.train.finish": "আপাতত এটুকুই",
    "asst.train.ready": "আপনি যা যা বললেন সব এখানে। সেভ করতে বোতাম চাপুন, তারপর Bot Training-এ “এআই দিয়ে আবার লিখুন” চাপুন যাতে বট এগুলো নিজের উত্তরে কাজে লাগায়।",
    "asst.nothingSaid": "সবগুলোই বাদ দিয়েছেন, তাই সেভ করার মতো কিছু নেই। যখন খুশি আবার শুরু করুন।",

    "asst.stopped": "বন্ধ করা হলো। কিছুই যোগ হয়নি।",
    "asst.cancel": "বাতিল",
    "asst.draftTitle": "নতুন প্রোডাক্ট — এখনো সেভ হয়নি",
    "asst.needed": "সেভ করার আগে যা লাগবে: ",
    "asst.neededEnd": "।",
    "asst.readyOne": " দেওয়া নেই — এখন দিতে পারেন, বা ছাড়াই সেভ করতে পারেন।",
    "asst.readyMany": " দেওয়া নেই — এখন দিতে পারেন, বা ছাড়াই সেভ করতে পারেন।",
    "asst.readyPrefix": "সেভ করার মতো হয়ে গেছে। ",
    "asst.allFilled": "সব দেওয়া হয়ে গেছে।",
    "asst.photoCount": "{n}টা ছবি, {size}",
    "asst.photoTooLarge": "{n}টা ছবি ছোট করা যায়নি, প্রতিটি {max}-এর বেশি — এভাবে পাঠানো যাবে না। “ছবি ছোট করুন” চাপুন বা ওগুলো সরান।",
    "asst.shrinkAgain": "ছবি ছোট করুন",
    "asst.uploading": "ছবি পাঠানো হচ্ছে {done}/{total}…",
    "asst.save": "“{name}” সেভ করুন",
    "asst.addAnyway": "তবুও যোগ করুন",
    "asst.savedLine": "“{name}” আপনার ক্যাটালগে যোগ হয়েছে।",
    "asst.added": "“{name}” যোগ হয়েছে। আরেকটা যোগ করতে চাইলে “add another” বলুন।",
    "asst.addedBlind": "“{name}” যোগ হয়েছে — তবে ছবিটা পড়া যায়নি, তাই কাস্টমার ছবি পাঠিয়ে এটা খুঁজে পাবে না। আরেকটা যোগ করতে চাইলে “add another” বলুন।",
    "asst.dupRefused": "{message} সত্যিই যদি এটা আলাদা হয়, “তবুও যোগ করুন” চাপুন।",

    "asst.photo.added": "{n}টা ছবি যোগ হয়েছে।",
    "asst.photo.added1": "১টা ছবি যোগ হয়েছে।",
    "asst.photo.repeats": "{n}টা আগেই ছিল — বাদ দেওয়া হয়েছে।",
    "asst.photo.repeats1": "১টা একই ছবি ছিল — বাদ দেওয়া হয়েছে।",
    "asst.photo.overflow": "{n}টা আঁটেনি: একটা প্রোডাক্টে {max}টা পর্যন্ত ছবি রাখা যায়।",
    "asst.photo.overflowTip": "{n}টা ছবি এই প্রোডাক্টে রাখা গেল না — একটা প্রোডাক্টে বেশি হলে {max}টা ছবি হয়। ওগুলো যদি আলাদা প্রোডাক্ট হয়, নিচের “ছবি থেকে” চেপে একসাথে যোগ করুন।",
    "asst.photo.attach": "এই প্রোডাক্টের ছবি দিন",
    "asst.photo.full": "একটা প্রোডাক্টে বেশি হলে {max}টা ছবি হয়",
    "asst.photo.first": "কাস্টমার এই ছবিটাই দেখে",
    "asst.photo.makeFirst": "এটাকে প্রথম ছবি বানান",
    "asst.photo.remove": "{n} নম্বর ছবি সরান",
    "asst.photo.firstBadge": "১ম",

    "asst.proposed": "প্রস্তাব — এখনো কিছুই বদলায়নি",
    "asst.apply": "{n}টা পরিবর্তন প্রয়োগ করুন",
    "asst.apply1": "১টা পরিবর্তন প্রয়োগ করুন",
    "asst.discard": "বাদ দিন",
    "asst.discarded": "বাদ দেওয়া হলো — কিছুই বদলায়নি।",
    "asst.applied": "{n}টা পরিবর্তন সেভ হয়েছে।",
    "asst.applied1": "১টা পরিবর্তন সেভ হয়েছে।",
    "asst.appliedSome": "{n}টা সেভ হয়েছে, {m}টা হয়নি: {errors}।",

    "asst.ph.answer": "উত্তর লিখুন…",
    "asst.ph.chat": "জিজ্ঞেস করুন, বা কী বদলাতে চান বলুন…",
    "asst.thinking": "ভাবছি…",
    "asst.writing": "লিখে রাখছি…",
    "asst.prepping": "ছবি তৈরি করছি…",
    "asst.reading": "{total}টার মধ্যে {n} নম্বর ছবি পড়ছি…",
    "asst.aria": "সহকারীকে বার্তা",


    "card.deleteProduct": "{name} মুছে ফেলুন",
    "card.deleteProductWhy": "প্রোডাক্ট আর তার ছবিগুলো ক্যাটালগ থেকে চলে যাবে। বট আর এটা কাউকে দেখাবে না।",
    "card.addProduct": "{name} যোগ করুন",
    "card.noPhotoYet": "এখনো ছবি নেই — প্রোডাক্টটা খুলে একটা দিন, নইলে কাস্টমারের পাঠানো ছবির সাথে বট এটা মেলাতে পারবে না।",
    "card.changeProduct": "{name} বদলান",
    "card.thisProduct": "এই প্রোডাক্ট", "card.aProduct": "প্রোডাক্ট",
    "card.inStock": "স্টকে আছে", "card.outOfStock": "স্টকে নেই",
    "card.on": "চালু", "card.off": "বন্ধ", "card.notSet": "ঠিক করা নেই",
    "card.addOffer": "“{name}” অফারটা যোগ করুন",
    "card.changeOffer": "“{name}” অফারটা বদলান",
    "card.removeOffer": "“{name}” অফারটা মুছে ফেলুন",
    "card.removeOfferWhy": "বট আর কাস্টমারকে এটার কথা বলবে না। মুছে না ফেলে বন্ধ করে রাখলে পরে আবার চালু করা যাবে।",
    "card.offerQuoted": "বট অফারটা হুবহু যেভাবে লেখা সেভাবেই বলে, তাই কাস্টমার যেভাবে পড়বে সেভাবে একবার পড়ে নিন।",
    "card.bargain": "বট কতদূর দরদাম করতে পারবে ঠিক করুন",
    "card.bargainMode": "কীভাবে দরদাম করবে",
    "card.bargainPct": "সর্বোচ্চ যত ছাড় দিতে পারবে",
    "card.bargainCustom": "আপনার নিজের নিয়ম",
    "card.mode.fixed": "দামে কখনো নড়বে না",
    "card.mode.limited": "একটু ছাড় দিতে পারবে",
    "card.mode.custom": "আপনার নিজের নিয়ম",
    "card.teach": "বটকে এটা শেখান",
    "card.forget": "বটকে এটা ভুলিয়ে দিন",
    "card.training": "ব্যবসা নিয়ে বট যা জানে তা বদলান",
    "card.trainingThen": "এরপর Bot Training-এ “এআই দিয়ে আবার লিখুন” চাপুন, যাতে বট এগুলো নিজের উত্তরে কাজে লাগায়।",
    "card.identity": "বট নিজেকে কী বলে পরিচয় দেবে বদলান",
    "card.followOn": "ফলো-আপ মেসেজ চালু করুন",
    "card.followOnWhy": "যে কাস্টমাররা চুপ হয়ে গেছে বট তাদের মেসেজ দেবে, Meta-র ২৪ ঘণ্টার মধ্যে।",
    "card.followOff": "ফলো-আপ মেসেজ বন্ধ করুন",
    "card.followOffWhy": "চুপ হয়ে যাওয়া কাস্টমারদের বট আর মেসেজ দেবে না।",
    "card.setting": "একটা সেটিং বদলান",

    "sfld.title": "নাম", "sfld.details": "কাস্টমার কী পাবে",
    // "অবস্থা", not "চালু" — the value beside it is already চালু or বন্ধ, and
    // "চালু: চালু" is not a sentence anybody reads.
    "sfld.valid_until": "কবে পর্যন্ত", "sfld.active": "অবস্থা",
    "sfld.botName": "বটের নাম", "sfld.businessName": "ব্যবসার নাম",
    "sfld.greeting": "শুরুর কথা", "sfld.tone": "ধরন", "sfld.languages": "ভাষা",

    "fld.product_name": "নাম", "fld.category": "ক্যাটাগরি", "fld.regular_price": "দাম",
    "fld.description": "বিবরণ", "fld.options": "সাইজ / রং", "fld.photo": "ছবি",
    "fld.stock_qty": "স্টক", "fld.brand": "ব্র্যান্ড", "fld.sale_price": "অফার দাম",
    "fld.product_code": "কোড", "fld.tags": "ট্যাগ", "fld.stock_status": "স্টক অবস্থা",

    "nav.analytics": "অ্যানালিটিক্স", "nav.conversations": "ইনবক্স", "nav.comments": "কমেন্ট",
    "nav.broadcast": "ব্রডকাস্ট", "nav.channels": "চ্যানেল", "nav.billing": "বিলিং",
    "nav.settings": "বট ট্রেনিং", "nav.profile": "প্রোফাইল", "nav.ai": "এআই ইঞ্জিন",
    "nav.inventory": "ইনভেন্টরি", "nav.knowledge": "নলেজ বেজ",
    "nav.orders": "অর্ডার", "nav.bookings": "বুকিং",
    "nav.overview": "ওভারভিউ", "nav.more": "আরও",
    "ov.morning": "সুপ্রভাত", "ov.afternoon": "শুভ অপরাহ্ন", "ov.evening": "শুভ সন্ধ্যা",
    "ov.lead": "শেষ ৭ দিন এক নজরে",
    "ov.live": "{n}টা চ্যানেলে বট চালু", "ov.notLive": "এখনো কোনো চ্যানেল যুক্ত হয়নি",
    "ov.expired": "{n}টা চ্যানেলের সংযোগের মেয়াদ শেষ — আবার যুক্ত না করা পর্যন্ত বট সেখানে উত্তর দিতে পারবে না।", "ov.fix": "আবার যুক্ত করুন",
    "ov.kpi.messages": "মেসেজ", "ov.kpi.customers": "কাস্টমার", "ov.kpi.bot": "AI-এর উত্তর", "ov.kpi.revenue": "আয়", "ov.kpi.bookings": "বুকিং",
    "ov.today": "আজ {n}টা", "ov.new": "{n} জন নতুন", "ov.needed": "{n}টায় আপনাকে লেগেছে", "ov.orders": "{n}টা অর্ডার", "ov.ofCustomers": "কাস্টমারের {n}%",
    "ov.week": "এই সপ্তাহের মেসেজ", "ov.all": "সব মেসেজ", "ov.byAI": "AI-এর উত্তর", "ov.weekEmpty": "এই সপ্তাহে এখনো কোনো মেসেজ নেই।",
    "ov.needs": "আপনাকে দরকার", "ov.openInbox": "ইনবক্স খুলুন", "ov.needsEmpty": "কিছুই অপেক্ষায় নেই। বট সামলে নিচ্ছে।",
    "ov.why.human": "মানুষ চেয়েছেন", "ov.why.complaint": "অভিযোগ", "ov.why.unread": "অপঠিত", "ov.more": "ইনবক্সে আরও {n}টা",
    "ov.recentOrders": "সাম্প্রতিক অর্ডার", "ov.ordersEmpty": "এখনো অর্ডার নেই। বট অর্ডার নিলেই এখানে দেখাবে।", "ov.items": "{n}টা আইটেম",
    "ov.meetings": "পরের মিটিং", "ov.meetingsEmpty": "সামনে কোনো মিটিং নেই।", "ov.join": "যোগ দিন",
    "ov.channels": "চ্যানেল", "ov.manage": "সামলান", "ov.channelsEmpty": "শুরু করতে Facebook, Instagram বা WhatsApp যুক্ত করুন।",
    "ov.ch.live": "চালু — বট উত্তর দিচ্ছে", "ov.ch.paused": "থেমে আছে — মেসেজ আপনার জন্য অপেক্ষা করছে", "ov.ch.expired": "মেয়াদ শেষ — চালু করতে আবার যুক্ত করুন",
    "ov.customer": "কাস্টমার", "ov.now": "এইমাত্র", "ov.min": "{n} মিনিট আগে", "ov.hr": "{n} ঘণ্টা আগে", "ov.day": "{n} দিন আগে",
    "shell.logout": "লগ আউট", "shell.sync": "রিফ্রেশ", "shell.language": "ভাষা",
    "shell.train": "বটকে শেখান", "shell.managePlan": "প্যাকেজ দেখুন",
    "shell.needYou": "{n}টা চ্যাটে আপনাকে দরকার", "shell.repliesMonth": "এই মাসের উত্তর", "shell.repliesToday": "আজকের উত্তর",
    "shell.business": "ব্যবসা", "shell.service": "সার্ভিস",
    "group.Workspace": "কাজের জায়গা", "group.Grow": "বাড়ান", "group.Train": "শেখান", "group.Account": "অ্যাকাউন্ট",
    "ov.todayTitle": "আজ",
    "shell.usedMonth": "এই মাসে {limit}টার মধ্যে {used}টা উত্তর ব্যবহার হয়েছে", "shell.usedDay": "আজ {limit}টার মধ্যে {used}টা উত্তর ব্যবহার হয়েছে",
    "shell.usedFree": "এই মাসে {used}টা উত্তর",
    "shell.search": "কাস্টমার, অর্ডার খুঁজুন…", "shell.searchAgency": "কাস্টমার খুঁজুন…", "shell.searchAria": "খুঁজুন",
    "search.customers": "কাস্টমার", "search.orders": "অর্ডার", "search.products": "পণ্য", "search.none": "“{q}”-এর সাথে কিছু মেলেনি",
    "inbox.title": "কথোপকথন", "inbox.all": "সব", "inbox.needs": "আপনাকে দরকার", "inbox.manual": "ম্যানুয়াল",
    "inbox.botReplying": "বট উত্তর দিচ্ছে", "inbox.youReplying": "আপনি উত্তর দিচ্ছেন", "inbox.takeOver": "দায়িত্ব নিন", "inbox.handBack": "বটকে ফেরত দিন",
    "inbox.placeholder": "উত্তর লিখুন, বা বটকে দিতে দিন…", "inbox.answeredIn": "{s} সেকেন্ডে উত্তর",
    "inbox.today": "আজ", "inbox.yesterday": "গতকাল",
    "inbox.inStock": "স্টকে আছে · {n}টা বাকি", "inbox.inStockNoQty": "স্টকে আছে", "inbox.outOfStock": "স্টকে নেই",
    "inbox.kpi.today": "আজকের কথোপকথন", "inbox.kpi.bot": "বটের উত্তর, ৭ দিন", "inbox.kpi.value": "অর্ডারের টাকা, ৭ দিন",
    "inbox.kpi.bookings": "বুকিং, ৭ দিন", "inbox.kpi.reply": "গড় প্রথম উত্তর, ৭ দিন",

    "common.save": "সেভ", "common.saved": "সেভ হয়েছে", "common.unsaved": "সেভ করা হয়নি",
    "common.optional": "ঐচ্ছিক", "common.skip": "বাদ দিন", "common.back": "আগেরটা", "common.send": "পাঠান", "common.cancel": "বাতিল",
    "common.delete": "মুছুন", "common.close": "বন্ধ", "common.on": "চালু", "common.off": "বন্ধ",
    "common.loading": "লোড হচ্ছে…", "common.search": "খুঁজুন",
    "docs.learn": "ডকস পড়ুন", "docs.learnHint": "এই ট্যাবের গাইডটা পড়ুন",

    "bt.title": "আপনার বট শেখান",
    "bt.progress": "{total}টির মধ্যে {done}টি ধাপ শেষ। যত বেশি শেখাবেন, তত ভালো বিক্রি করবে।",
    "bt.allDone": "মূল প্রশিক্ষণ শেষ — অফার আর দরদাম যোগ করলে আরও ভালো বিক্রি হবে।",
    "bt.chk.identity": "পরিচয়", "bt.chk.business": "ব্যবসা", "bt.chk.policies": "নিয়মনীতি",
    "bt.chk.services": "সার্ভিস", "bt.chk.qa": "প্রশ্নোত্তর", "bt.chk.offers": "অফার", "bt.chk.bargain": "দরদাম",
    "bt.tab.train": "শেখান", "bt.tab.offers": "অফার", "bt.tab.bargain": "দরদাম", "bt.tab.behavior": "আচরণ",

    "bt.train.title": "ব্যবসার কথা শেখান",
    "bt.train.sub": "বট কী কী জানবে তা লিখে দিন — সে নিজেই নিজের প্রশিক্ষণ লিখে নেবে",
    "bt.train.answered": "{total}টার মধ্যে {n}টার উত্তর দেওয়া",
    "bt.train.askThere": "প্রশ্ন করে নিলে সুবিধা হয়? এআই সহকারী কথা বলেই এর যেকোনোটা পূরণ করে দিতে পারে, আর সেভ করার আগে কী বদলাচ্ছে দেখিয়ে দেয়।",
    "bt.train.generating": "তৈরি হচ্ছে…",
    "bt.train.regen": "এআই দিয়ে আবার লিখুন",
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
    "lbl.products": "প্রধান পণ্য / ক্যাটাগরি", "lbl.deliveryAreas": "ডেলিভারি এলাকা",
    "lbl.advancePay": "অগ্রিম পেমেন্টের নিয়ম", "lbl.stock": "স্টক শেষ হলে",
    "lbl.warranty": "ওয়ারেন্টি / গ্যারান্টি", "lbl.complaints": "অভিযোগ সামলানো",
    "lbl.pricing": "দাম কীভাবে ঠিক হয়", "lbl.process": "ক্লায়েন্টের সাথে কাজের ধাপ",
    "lbl.timeline": "সময় / ফলাফল", "lbl.clients": "কাদের সাথে কাজ করেন",
    "lbl.contract": "চুক্তি ও পেমেন্টের শর্ত", "lbl.objections": "সাধারণ আপত্তি",

    "q.ecom.products": "আপনার প্রধান পণ্য বা ক্যাটাগরি কী কী, আর কোনটা সবচেয়ে বেশি বিক্রি হয়?",
    "ph.ecom.products": "যেমন: টি-শার্ট, পোলো শার্ট, পাঞ্জাবি। সবচেয়ে বেশি চলে প্লেইন টি-শার্ট আর পাঞ্জাবি।",
    "q.ecom.deliveryAreas": "কোথায় কোথায় ডেলিভারি দেন? কোথাও কি দেন না?",
    "ph.ecom.deliveryAreas": "যেমন: সারা দেশে দেই। পাহাড়ি জেলাগুলোতে দেই না।",
    "q.ecom.advancePay": "পাঠানোর আগে কোনো অগ্রিম টাকা লাগে?",
    "ph.ecom.advancePay": "যেমন: শহরের বাইরের অর্ডারে ১০০ টাকা অগ্রিম, শহরের ভেতরে লাগে না",
    "q.ecom.stock": "কোনো পণ্য স্টকে না থাকলে বট কী বলবে?",
    "ph.ecom.stock": "যেমন: এক সপ্তাহের মধ্যে আসবে বলবে এবং কাছাকাছি আরেকটি পণ্য দেখাবে",
    "q.ecom.warranty": "আপনার পণ্যে কোনো ওয়ারেন্টি বা গ্যারান্টি আছে?",
    "ph.ecom.warranty": "যেমন: কাপড়ে ওয়ারেন্টি নেই। ঘড়িতে ৬ মাসের ওয়ারেন্টি। না থাকলে বাদ দিন।",
    "q.ecom.complaints": "কাস্টমার রেগে গেলে বা অভিযোগ করলে বট কী করবে?",
    "ph.ecom.complaints": "যেমন: দুঃখ প্রকাশ করবে, অর্ডার নম্বর ও ছবি চাইবে, এক ঘণ্টার মধ্যে কল করার কথা বলবে",

    "q.agency.pricing": "আপনার দাম কীভাবে ঠিক হয় — নির্দিষ্ট প্যাকেজ, ঘণ্টাভিত্তিক, নাকি আলাদা কোটেশন?",
    "ph.agency.pricing": "যেমন: মাসিক প্যাকেজ। বড় প্রজেক্টে কথা বলার পর আলাদা কোটেশন দেওয়া হয়।",
    "q.agency.process": "একজন ক্লায়েন্টের সাথে ধাপে ধাপে কীভাবে কাজ করেন?",
    "ph.agency.process": "যেমন: ফ্রি কনসালটেশন, তারপর প্রস্তাব, ২ সপ্তাহে সেটআপ, এরপর মাসিক রিপোর্ট",
    "q.agency.timeline": "ক্লায়েন্ট কতদিনে ফলাফল দেখতে পায়?",
    "ph.agency.timeline": "যেমন: ৪-৬ সপ্তাহে প্রথম ফল, ৩ মাসে ভালো ফল",
    "q.agency.clients": "সাধারণত কাদের সাথে কাজ করেন? কোনো খাত বা ক্লায়েন্টের নাম বলা যাবে?",
    "ph.agency.clients": "যেমন: ছোট দোকান, রেস্টুরেন্ট ও ক্লিনিক। ৪০+ লোকাল ব্র্যান্ডের সাথে কাজ করেছি।",
    "q.agency.contract": "চুক্তির মেয়াদ বা পেমেন্টের শর্ত কী, যা ক্লায়েন্টের জানা দরকার?",
    "ph.agency.contract": "যেমন: সর্বনিম্ন ৩ মাস, ৫০% অগ্রিম, বাকিটা মাস শেষে",
    "q.agency.objections": "ক্লায়েন্টরা কী নিয়ে দ্বিধা করে, আর আপনি কী উত্তর দেন?",
    "ph.agency.objections": "যেমন: \"দাম বেশি\" — আমরা বিজ্ঞাপনের রিটার্ন বুঝিয়ে বলি এবং ছোট প্যাকেজ দেখাই",

    "bt.more.title": "আরও শেখান",
    "bt.more.sub": "যেকোনো সময় নতুন কিছু যোগ করুন — নতুন নিয়ম, দামের পরিবর্তন, কাস্টমারের নতুন প্রশ্ন",
    "bt.more.ph": "এখন থেকে বটের যা জানা দরকার তা লিখুন…",
    "bt.more.add": "বটকে শেখান",
    "bt.more.empty": "এখনো বাড়তি কিছু শেখানো হয়নি। এখানে যা যোগ করবেন, উপরের উত্তরগুলোর সাথে সেটাও বট মনে রাখবে।",
    "bt.more.saveHint": "যোগ হয়েছে। কার্যকর করতে নিচে সেভ চাপুন।",
    "bt.more.count": "{n}টি বিষয় শেখানো হয়েছে",
    "bt.more.remove": "সরান",

    "bt.beh.expand": "বড় করুন", "bt.beh.collapse": "ছোট করুন", "bt.beh.fullscreen": "পূর্ণ এডিটর খুলুন",
    "bt.beh.editorTitle": "বটের ব্যবসায়িক প্রোফাইল",
    "bt.beh.chars": "{n} অক্ষর",
    "bt.beh.done": "হয়ে গেছে",

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
