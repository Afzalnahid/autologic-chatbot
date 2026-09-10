"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { T, Card, Btn, useIsMobile } from "./ui.js";
import { apiJson } from "./session.js";
import { getLang, useT } from "./i18n.js";
import { describeAction, draftGaps } from "@/lib/inventory-actions.js";
import { describeSetting, trainingKeys } from "@/lib/assistant-actions.js";
import { useBackClose } from "./back.js";
import { shrinkBatch, shrinkImage, fileSize } from "@/lib/shrink-image.js";
import { uploadPhotos, tooLargePhotos, PHOTO_MAX_BYTES } from "./photo-upload.js";
import { dropRepeats, fingerprint } from "@/lib/photo-fingerprint.js";
import { buildVariants, parseAxes } from "@/lib/variants.js";
import PhotoBatchSheet from "./PhotoBatch.js";
import { ImportSheet } from "./Inventory.js";
import { CategoryOverviewSheet } from "./CollectionOverview.js";

// Look after the catalogue by talking to it — and add to it the same way.
//
// The owner is not a programmer and does not want to be. "How many box t-shirts
// are left", "the winter jackets are 1200 now", "we are out of the black polo" —
// each of those is one sentence, and each of them was a hunt through a grid, a
// drawer, a field and a save button.
//
// The panel does three jobs.
//
// ASKING. The assistant answers, and where a change is implied it PROPOSES it:
// a card per product saying what would move and what it would move from, with a
// button under them. Untick the ones that are wrong. Nothing happens until the
// button is pressed. A misheard sentence that silently becomes a wrong price is
// a price a customer gets quoted, and the owner finds out from the customer.
//
// BEING ASKED. "Add a product" the other way round: the assistant asks for one
// thing at a time, the owner answers in a sentence, and the answer lands in the
// right field. A product can carry several photos — the first is the one
// customers see — and they are attached from the message box like any chat.
//
// NO MENU. It is a plain conversation, the way Claude is: the owner just says
// what they want and the model works it out — no intent buttons, no "one or
// several", no rows of ways. `/api/inventory-chat` reads the sentence and either
// answers, asks back, or proposes a change. The few things text cannot do — a
// photo, a file, connecting a shop, an image — the model asks the panel to open
// by returning a `ui` value (add_photo, import:*, overview); the panel opens
// that screen as an OVERLAY on this tab. "Show me the orders" still navigates,
// because that is the owner asking to go and look, not to configure.
//
// A guided add (the photo interview) and the short offer/training wizards still
// exist as the ENGINE behind "add_photo" and a couple of proposals — but they
// are entered by conversation now, not by pressing a button.
//
// The draft is held here and sent with every turn, not remembered by the model.
// What can be saved is decided by draftGaps, not by the assistant saying it
// thinks it is finished. And every word the panel says for itself goes through
// the translator: the owner picks a language once, and a chat answering in
// English under a Bangla screen was the last place that rule was broken.

// A few example prompts, the way Claude opens — one from each corner of what a
// plain sentence can now do here (add a product, set an offer, query the
// catalogue, teach the bot), so the owner sees the range without a menu.
const EXAMPLE_KEYS = ["asst.chip.add", "asst.chip.offer", "asst.chip.noPrice", "asst.chip.teach"];
// A service business is driven differently: teach a fact, fill in a profile
// answer, upload a document, set the bot's tone — no catalogue.
const EXAMPLE_KEYS_AGENCY = ["asst.chip.teachAgency", "asst.chip.trainAgency", "asst.chip.docsAgency", "asst.chip.identityAgency"];

// The first question, and the only one that is not about products: what does
// the owner want to do at all.
//
// This tab used to open on "how would you like to add products", which is the
// right SECOND question and the wrong first one — it made a tab that can set an
// offer and teach the bot look like a product importer with a chat bolted on.
//
// IN ORDER, and the order is not decoration. A bot that has not been told what
// the business is answers badly about products it does have; a product with no
// catalogue behind it cannot be put in an offer. Doing them the other way round
// is not forbidden — the owner presses whichever they like — but the numbers
// say which one pays off first, and the tick says which are already done.
const INTENTS = [
  { id: "train", icon: "ti-wand", done: (p, s) => !!String(s?.questionnaire?.description || "").trim() },
  { id: "add", icon: "ti-package", done: (p) => (p?.length || 0) > 0 },
  { id: "offer", icon: "ti-discount-2", done: (p, s) => (Array.isArray(s?.offers) ? s.offers : []).some((o) => o?.active !== false && String(o?.title || o?.details || "").trim()) },
];

// Every fork in the road, as buttons. A question with a known, small set of
// answers is a row of buttons, not a sentence somebody has to phrase correctly
// — and the panel then knows exactly what was chosen instead of guessing at it.
//
// `count` is asked before anything else about a product, because interviewing
// somebody about the first of fifteen shirts is the single mistake here that
// costs a whole evening.
const CHOICES = {
  count: [
    { id: "one", icon: "ti-package", key: "asst.count.one" },
    { id: "many", icon: "ti-stack-2", key: "asst.count.many" },
  ],
  // One product, two ways in — and both of them start from the picture.
  one: [
    { id: "photo", icon: "ti-camera-plus", key: "asst.one.photo" },
    { id: "url", icon: "ti-link", key: "asst.one.url" },
  ],
  // Several at once. The last three open the sheet that already does that
  // import rather than a second copy of it living in here.
  many: [
    { id: "photos", icon: "ti-photo-plus", key: "asst.way.photos" },
    { id: "csv", icon: "ti-table", key: "asst.way.csv" },
    { id: "woo", icon: "ti-brand-wordpress", key: "asst.way.woo" },
    { id: "shopify", icon: "ti-brand-shopee", key: "asst.way.shopify" },
  ],
};

// The compact row under the message box once a conversation has started.
const WAYS = ["photos", "csv", "url", "woo", "shopify"];
const WAY_ICON = { ask: "ti-messages", photo: "ti-camera-plus", photos: "ti-photo-plus", csv: "ti-table", url: "ti-link", woo: "ti-brand-wordpress", shopify: "ti-brand-shopee" };
// Which of them opens a sheet on top of this panel, so its rule needs a button
// rather than being shown and hidden in the same breath.
const SHEETS = new Set(["csv", "url", "woo", "shopify"]);

// EVERY tab, reachable from here without going to look for it. Not a shortlist
// of the popular ones: the owner asked for one page from which the whole
// dashboard is driven, and a list that quietly stops at five is a list that
// sends them back to the sidebar for the sixth.
//
// "Bot Training" leads and wears the accent colour — teaching the bot is the
// other half of what this tab is for, and it is the page owners looked straight
// past for as long as it was called Settings.
const JUMPS = ["settings", "inventory", "orders", "conversations", "comments", "broadcast", "analytics", "channels", "billing", "ai", "profile"];
const JUMP_ICON = {
  settings: "ti-wand", inventory: "ti-package", orders: "ti-shopping-cart",
  conversations: "ti-messages", comments: "ti-message-circle-2", broadcast: "ti-speakerphone",
  analytics: "ti-chart-bar", channels: "ti-plug", billing: "ti-credit-card",
  ai: "ti-cpu", profile: "ti-user",
};

const MAX_PHOTOS = 12;
// How many photos one trip to /api/photo-draft may carry. Six is the server's
// cap; the byte budget is what actually decides, because the platform refuses
// anything over ~4.5 MB at the edge before our code ever runs.
const READ_PER_CALL = 6;
const READ_BUDGET = 3_200_000;
const emptyDraft = () => ({});

// Where "take me to X" can go, in both languages the dashboard speaks. Matched
// on the page rather than asked of a model: these are twelve fixed words, the
// answer is never ambiguous, and an AI call to look one up would be a cost and
// a wait for nothing — it also keeps working when the AI does not.
const DESTINATIONS = [
  { page: "orders", words: ["order", "orders", "booking", "bookings", "অর্ডার", "বুকিং"] },
  { page: "inventory", words: ["inventory", "catalogue", "catalog", "product", "products", "ইনভেন্টরি", "প্রোডাক্ট"] },
  { page: "conversations", words: ["inbox", "message", "messages", "chat with customer", "ইনবক্স", "মেসেজ"] },
  { page: "analytics", words: ["analytics", "report", "reports", "stats", "অ্যানালিটিক্স", "রিপোর্ট"] },
  { page: "broadcast", words: ["broadcast", "ব্রডকাস্ট"] },
  { page: "comments", words: ["comment", "comments", "কমেন্ট"] },
  { page: "channels", words: ["channel", "channels", "facebook", "instagram", "whatsapp", "চ্যানেল"] },
  { page: "settings", words: ["bot training", "training", "teach the bot", "বট ট্রেনিং", "ট্রেনিং"] },
  { page: "billing", words: ["billing", "plan", "payment", "বিলিং", "প্যাকেজ"] },
  { page: "ai", words: ["ai engine", "api key", "এআই ইঞ্জিন"] },
  { page: "profile", words: ["profile", "প্রোফাইল"] },
];

// Only when they are ASKING to be taken somewhere. "How many orders today" is a
// question about orders, not a request to open the tab, and answering it by
// navigating away would be maddening.
const GO_WORDS = /\b(go to|open|show me|take me to|switch to)\b|দেখাও|খোলো|নিয়ে যাও|যাও/i;

// The category OVERVIEW image (bot.js rule 16b) — the cover the bot sends on a
// broad "power bank ache?". Set in an editor, not by typing, so these phrases
// open it instead of going to the model.
const OVERVIEW_WORDS = /overview (image|photo|picture)|category (image|photo|picture|cover)|cover (image|photo|picture)|ওভারভিউ|ক্যাটাগরি(র)? ছবি|প্রধান ছবি|কভার ছবি/i;

function destinationFor(text) {
  const s = String(text || "").toLowerCase();
  if (!GO_WORDS.test(s)) return null;
  for (const d of DESTINATIONS) {
    if (d.words.some((w) => s.includes(w))) return d.page;
  }
  return null;
}

export default function InventoryAssistant({ products, refresh, startSignal = 0, onImport, shopAxes = [], fullPage = false, onGo, businessType = "ecommerce", settings = null, onMenu = null }) {
  const isMobile = useIsMobile();
  // A service business drives its bot through the KNOWLEDGE it uploads and the
  // Bot Training answers, not a catalogue of photographed products — so the
  // assistant attaches DOCUMENTS, not product photos, and its example prompts
  // are about teaching and training rather than adding stock.
  const isAgency = businessType === "agency";
  // The categories this shop already uses, offered under the question that asks
  // for one. Read from the catalogue rather than kept anywhere: it is always
  // right, and a category stops existing the moment its last product does.
  const categories = useMemo(() => [...new Set((products || [])
    .map((p) => String(p?.category || "").trim()).filter(Boolean))], [products]);
  // useT subscribes to the language itself, so the whole panel re-renders when
  // it changes — which is what redraws the transcript in the new language.
  const t = useT();
  // The product's fields, named the way the owner reads them rather than the
  // way the server prompt needs them. inventory-actions.js keeps the English
  // labels because the prompt is written in English; these are the ones a
  // person sees.
  const fld = (k) => t(`fld.${k}`);
  // One string for one, another for the rest. Bangla does not inflect a plural
  // the way English does, so a pair of keys is both cheaper and more honest
  // than a plural rule that only ever serves one of the two languages.
  const many = (n, key) => t(n === 1 ? `${key}1` : key, { n });
  // A thumbnail on a phone is big enough to hold a 44px remove button INSIDE
  // it, so the button never overhangs the photo beside it and steals its tap.
  // On a mouse a small corner cross is fine, and 58px keeps more of them in view.
  const TH = isMobile ? 92 : 58;
  const X = isMobile ? 44 : 22;
  // Open on arrival. This is the main way into the catalogue now, not a thing
  // to go and find: an owner who has to press something before they can start
  // talking will use the buttons instead, which is what was happening.
  const [open, setOpen] = useState(true);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // {done,total} while the photos are being sent one at a time on save.
  const [uploading, setUploading] = useState(null);
  // Every way of adding products stays on THIS tab. The many-from-photos sheet
  // and the CSV/URL/WooCommerce/Shopify importers used to switch to Inventory
  // (onImport → setPage) — now they open as an overlay right over the chat, so
  // the owner never leaves the assistant.
  const [importer, setImporter] = useState(null);     // null | photos|csv|url|woo|shopify
  const [importPrefill, setImportPrefill] = useState(null);
  const openImporter = (kind, prefill = null) => { setImportPrefill(prefill || null); setImporter(kind); };
  const closeImporter = () => { setImporter(null); setImportPrefill(null); };
  useBackClose(!!importer, closeImporter);
  // The category OVERVIEW image (the one the bot sends on a broad "power bank
  // ache?") can't be set by typing, so the assistant opens its editor as an
  // overlay here — same "stay on this tab" idea as the importers.
  const [overviewOpen, setOverviewOpen] = useState(false);

  // Interview state. `mode` is what the composer and the send button are for.
  const [mode, setMode] = useState("chat");
  const [draft, setDraft] = useState(emptyDraft);
  const [photos, setPhotos] = useState([]);
  const [visual, setVisual] = useState("");
  const [prepping, setPrepping] = useState(false);
  // Reading the attached photos, one chunk at a time. Twelve of them is a real
  // wait, and a panel that sits silent through it looks broken.
  const [reading, setReading] = useState(null); // {done, total}
  const [saved, setSaved] = useState("");
  // Two different things, deliberately kept apart. `dup` is the warning shown
  // as soon as the name is known — "you already have one of these" — which is
  // information. `refused` is the server having actually turned a save away,
  // and only that puts "Add anyway" on screen: offering an override before
  // anyone has tried to save invites pressing it out of habit.
  const [dup, setDup] = useState(null);
  const [refused, setRefused] = useState(false);
  // A scripted interview in progress — { id, step, answers } — or null.
  // See WIZARDS.
  const [wiz, setWiz] = useState(null);

  const endRef = useRef(null);
  const fileRef = useRef(null);
  const saveRef = useRef(null);
  const formRef = useRef(null);
  // Every preview URL ever made, released together when the panel goes away.
  // They are deliberately NOT released when a photo is removed from the draft
  // or when the product is saved: the thumbnails stay in the transcript above,
  // and a revoked URL there would leave a row of broken images behind.
  const blobs = useRef([]);
  const preview = (file) => { const u = URL.createObjectURL(file); blobs.current.push(u); return u; };
  // Fingerprints of every photo attached to the product being built, so the
  // same one chosen twice is recognised across separate trips to the picker.
  const seenPhotos = useRef(new Set());

  // Only once there is a conversation to follow. Scrolling to the bottom of an
  // empty panel pushed the ways-in list up and hid the first and best of them,
  // which on a phone is the whole screen the owner is looking at.
  useEffect(() => { if (open && msgs.length) endRef.current?.scrollIntoView({ block: "nearest" }); }, [msgs, open, busy, draft]);
  // The panel is a fixed height with the composer pinned to its bottom, so what
  // pushes the box off screen is not the panel growing — it is where the PAGE
  // happens to be scrolled to, and scrolling the transcript moves that too.
  //
  // So the rule is simply: if the box has ended up below the fold, bring it
  // back, and otherwise do nothing at all. Checked after every message rather
  // than at fixed moments — the earlier version measured before the layout had
  // settled and kept missing — but it only ever MOVES the page when the box is
  // actually out of sight, so it cannot shuffle the page under someone who can
  // already see what they are typing into.
  //
  // Measured rather than left to scrollIntoView, which counts an element flush
  // against the bottom edge as already visible and does nothing. The 24px is
  // air: sitting exactly on the fold reads as cut off.
  useEffect(() => {
    if (!open) return;
    // Nothing to keep in view until there is a conversation. Before anyone has
    // said anything the box is not what they are looking at — the ways in are —
    // and scrolling the page the moment somebody lands on the tab is movement
    // for nothing. A count rather than a "first run" flag on purpose: React runs
    // effects twice on mount in development, and a flag gets used up by the
    // first of those and lets the second one jump the page anyway.
    if (!msgs.length) return;
    // `timer`, not `t` — `t` is the translator in this component now, and a
    // shadow that harmless is exactly the one that bites later.
    const timer = setTimeout(() => {
      const r = formRef.current?.getBoundingClientRect();
      if (!r) return;
      const past = r.bottom - (window.innerHeight - 24);
      // Instant, not smooth. A smooth scroll is an animation, and an animation
      // does not run when the page is not painting — which is how this was
      // silently doing nothing while reporting the right number. It is an
      // eighty-pixel correction; nobody sees the difference, and this one can
      // actually be proved to work.
      if (past > 1) window.scrollBy({ top: past });
    }, 120);
    return () => clearTimeout(timer);
  }, [open, mode, msgs.length, photos.length]);
  useEffect(() => () => blobs.current.forEach(URL.revokeObjectURL), []);
  // Started from outside the panel — the toolbar button, or the empty state.
  // "Add by chat" from Inventory starts the guided add straight away — the one
  // product interview, photo first — rather than a menu of choices.
  useEffect(() => { if (startSignal > 0) { setOpen(true); startInterview(); } }, [startSignal]);

  const gaps = draftGaps(draft, photos.length);
  // The moment the product becomes saveable, put the button where the owner can
  // see it. The panel is tall by then, and a Save button that appears below the
  // fold is a Save button nobody presses.
  useEffect(() => { if (gaps.ready) saveRef.current?.scrollIntoView({ block: "nearest" }); }, [gaps.ready]);

  // A line the panel wrote ITSELF stores the key it came from, never the
  // finished sentence.
  //
  // Stored as a sentence it is frozen in whatever language was selected the
  // second it was written, so pressing বাং left the rule card and every
  // question above it sitting in English while the rest of the screen changed
  // around them. Storing the key means the whole transcript is rebuilt in the
  // new language on the next render, which is what the owner expects from a
  // language switch and what they were promised.
  //
  // Only two kinds of line keep literal text, because neither can be
  // translated after the fact: what the model wrote, and what the owner typed.
  // `vars` are values that stand as they are — a name, a count. `varKeys` are
  // values that are themselves keys, so a tab's name inside a sentence follows
  // the language too rather than being the one English word left in a Bangla
  // line.
  const line = (m) => {
    // A report made of several sentences — "3 added. 1 was the same picture." —
    // keeps one key per sentence rather than being stitched into a string,
    // which is the only way the whole of it can change language later.
    if (m.parts) return m.parts.map(line).join(" ");
    if (!m.key) return m.content;
    const vars = { ...m.vars };
    for (const [k, v] of Object.entries(m.varKeys || {})) vars[k] = t(v);
    return t(m.key, vars);
  };

  // All three append through the updater rather than rebuilding from `msgs`,
  // which is the only shape that survives two of them firing in one handler.
  const say = (m) => setMsgs((s) => [...s, { role: "assistant", phase: "chat", cards: [], ...m }]);
  const heard = (key, vars) => setMsgs((s) => [...s, { role: "user", phase: "chat", key, vars }]);
  const typed = (content, phase = "chat") => setMsgs((s) => [...s, { role: "user", phase, content }]);

  // ── Asking ─────────────────────────────────────────────────────────────────
  const ask = async (text) => {
    const q = String(text || "").trim();
    if (!q || busy) return;
    setErr(""); setInput("");
    // Mid-batch the answers are the wizard's, not the model's. No request goes
    // anywhere: these three questions have fixed answers and asking an AI what
    // "box t-shirt" means would be a cost and a wait for nothing.
    if (wiz) return answerWiz(q);

    // "Set the category overview image" opens its editor, because a picture can't
    // be typed. Matched here so it is instant and never reaches the model.
    if (mode === "chat" && OVERVIEW_WORDS.test(q)) {
      typed(q);
      say({ key: "asst.overview.open" });
      setOverviewOpen(true);
      return;
    }

    // "Show me the orders" — take them there rather than describing it. Matched
    // here, before any request, so it is instant and free.
    const to = onGo && mode === "chat" ? destinationFor(q) : null;
    if (to) {
      typed(q);
      say({ key: "inv.takingYou", varKeys: { tab: `nav.${to}` } });
      setTimeout(() => onGo(to), 400);
      return;
    }
    // The question goes on screen before the request leaves, so the panel never
    // sits blank while a slow answer is on its way.
    const history = [...msgs, { role: "user", content: q, phase: mode }];
    setMsgs(history);
    if (mode === "interview") return turn(history);

    setBusy(true);
    const r = await apiJson("/api/inventory-chat", {
      method: "POST", headers: { "content-type": "application/json" },
      // Only the real conversation: what the owner typed and what the model
      // said. The panel's own lines — a rule card, "Just one." — are the way
      // in working, not something anybody said, and feeding them back would
      // have the model answering its own furniture.
      body: JSON.stringify({ messages: history.filter((m) => m.phase === "chat" && m.content).map((m) => ({ role: m.role, content: m.content })) }),
    });
    setBusy(false);
    if (r.error) { setErr(r.error); return; }
    // The model decided this needs a screen it cannot fill by text — a photo
    // interview, an importer, the overview editor. It says which; the panel
    // opens it. This is what lets the whole thing run by conversation: the owner
    // types "add a power bank", the model opens the guided add.
    if (r.ui) {
      if (r.reply) say({ content: r.reply });
      if (r.ui === "import:docs") { fileRef.current?.click(); return; }
      if (r.ui === "add_photo") return startInterview();
      if (r.ui === "overview") { setOverviewOpen(true); return; }
      const im = /^import:(photos|csv|url|woo|shopify)$/.exec(r.ui);
      if (im) { openImporter(im[1]); return; }
      return;
    }
    // One list, whichever half of the dashboard each proposal is about — a
    // price and an offer are the same thing to the owner: something that will
    // happen if they leave it ticked. The `kind` is only there so the card
    // knows which describer to read it with.
    const cards = [
      ...(r.actions || []).map((a) => ({ kind: "product", a })),
      ...(r.settingActions || []).map((a) => ({ kind: "setting", a })),
    ];
    say({
      content: r.reply, cards, before: r.before || {}, settingsBefore: r.settingsBefore || null,
      // Every proposal starts ticked: the owner reads them and unticks what is
      // wrong, rather than having to tick things one at a time to get anywhere.
      picked: cards.map(() => true),
    });
  };

  const toggle = (mi, ai) => setMsgs((s) => s.map((m, i) => i !== mi ? m : { ...m, picked: m.picked.map((p, j) => j === ai ? !p : p) }));

  const apply = async (mi) => {
    const m = msgs[mi];
    const chosen = m.cards.filter((_, i) => m.picked[i]);
    if (!chosen.length || busy) return;
    setBusy(true); setErr("");
    const r = await apiJson("/api/inventory-apply", {
      method: "POST", headers: { "content-type": "application/json" },
      // Split apart again at the door, because the two halves are written to
      // two different places and only the server may decide what a proposal is
      // allowed to touch.
      body: JSON.stringify({
        actions: chosen.filter((c) => c.kind === "product").map((c) => c.a),
        settingActions: chosen.filter((c) => c.kind === "setting").map((c) => c.a),
      }),
    });
    setBusy(false);
    if (r.error) { setErr(r.error); return; }
    const failed = (r.results || []).filter((x) => !x.ok);
    setMsgs((s) => s.map((x, i) => i !== mi ? x : { ...x, done: { ok: r.done, failed } }));
    // The job is finished, so the way back to the other two is offered without
    // being asked for.
    if (r.done) say({ key: "asst.whatNext" });
    refresh?.();
  };

  const discard = (mi) => setMsgs((s) => s.map((m, i) => i !== mi ? m : { ...m, cards: [], picked: [], dropped: true }));

  // ── Step 1: what do you want to do at all ──────────────────────────────────
  const pickIntent = (id) => {
    setErr("");
    heard(`asst.intent.${id}`);
    if (id === "add") return say({ choice: "count", key: "asst.count.ask" });
    if (id === "offer") { say({ key: "asst.rule.offer" }); return startWiz("offer"); }
    if (id === "train") { say({ key: "asst.rule.train" }); return startWiz("train"); }
  };

  // ── Step 2 and 3: one or several, and then how ─────────────────────────────
  // Each answer takes its own buttons away as it is given, so the transcript
  // reads as a conversation that happened rather than a form still waiting.
  const answerChoice = (kind, id) => {
    setErr("");
    setMsgs((s) => s.map((m) => m.choice === kind ? { ...m, choice: null } : m));
    const label = CHOICES[kind].find((c) => c.id === id)?.key;
    if (label) heard(label);

    if (kind === "count") return say({ choice: id, key: id === "one" ? "asst.one.ask" : "asst.many.ask" });

    // One product. Both ways start from the picture — the owner is holding
    // their phone, and a photograph is the one thing they certainly have.
    if (kind === "one") {
      if (id === "photo") { say({ key: "asst.rule.one" }); return startInterview(); }
      say({ key: "asst.rule.url", go: "url" });
      return;
    }
    // Several. The photo batch is this panel's own job; the rest open a sheet
    // on top of it, so their rule gets a button rather than being shown and
    // hidden in the same breath. A rule nobody had time to read is not a rule.
    if (id === "photos") { say({ key: "asst.rule.many" }); return startWiz("photos"); }
    say({ key: `asst.rule.${id}`, go: id });
  };

  // Straight from the compact row under the message box, which skips the two
  // questions because pressing "A spreadsheet" has already answered both.
  const pickWay = (id) => {
    setErr("");
    heard(`asst.way.${id}`);
    if (id === "photos") { say({ key: "asst.rule.many" }); return startWiz("photos"); }
    say({ key: `asst.rule.${id}`, go: id });
  };

  const startInterview = () => {
    setMode("interview"); setDraft(emptyDraft()); setPhotos([]); setVisual(""); setSaved(""); setErr(""); setDup(null); setRefused(false); seenPhotos.current = new Set();
    // The PHOTO first, and no question until it is here.
    //
    // The questions used to come first and the photograph last, which is the
    // order somebody describes a thing in — but not the order they have it in.
    // The owner is standing over the shirt with their phone; the picture is the
    // one thing they certainly have, and once it is attached the AI has already
    // proposed a name, a category and a sentence, so the questions that follow
    // are corrections rather than blank boxes.
    //
    // No turn() here: addPhotos() fires the first one once there is something
    // to talk about. Typing instead of attaching also starts it, so nobody is
    // stuck behind a camera they did not want.
    say({ phase: "interview", key: "asst.photoFirst" });
  };

  // ── Scripted interviews ────────────────────────────────────────────────────
  // A fixed list of questions, asked one at a time, with the answers kept until
  // the end. No model is involved: these questions are always the same and
  // their answers always the same shape, so an AI call to ask them would be a
  // cost and a wait for nothing — and they keep working when the AI does not.
  //
  // Three share this runner. `photos` collects what a rail of shirts has in
  // common before the photo sheet opens; `offer` writes a deal the bot will
  // quote; `train` walks the questions the Bot Training tab asks on its form.
  //
  // Every step holds KEYS rather than sentences, for the same reason the
  // transcript does: a language switch mid-interview has to change the question
  // the owner is looking at, not only the ones above it.
  const axisWord = shopAxes[0] || "";
  const axis = { axis: axisWord };
  const bk = businessType === "agency" ? "agency" : "ecom";
  const WIZARDS = {
    photos: {
      done: "asst.batch.done",
      steps: [
        { key: "kind", askKey: "asst.batch.kind", phKey: "asst.batch.kindPh" },
        { key: "price", askKey: "asst.batch.price", phKey: "asst.batch.pricePh", skipKey: "asst.batch.priceSkip" },
        { key: "options",
          askKey: axisWord ? "asst.batch.optionsNamed" : "asst.batch.options",
          phKey: axisWord ? "asst.batch.optionsPhNamed" : "asst.batch.optionsPh",
          skipKey: axisWord ? "asst.batch.optionsSkipNamed" : "asst.batch.optionsSkip" },
      ],
    },
    offer: {
      steps: [
        { key: "title", askKey: "asst.offer.name", phKey: "asst.offer.namePh" },
        { key: "details", askKey: "asst.offer.what", phKey: "asst.offer.whatPh" },
        { key: "valid_until", askKey: "asst.offer.until", phKey: "asst.offer.untilPh", skipKey: "asst.offer.untilSkip" },
      ],
    },
    // One question per thing the bot should know about this business, in the
    // order the Bot Training form asks them, worded the same way. Fourteen is a
    // lot to sit through, so every one can be skipped and the whole thing can
    // be finished early with what has been said so far.
    train: {
      finishKey: "asst.train.finish",
      steps: trainingKeys(businessType).map((k) => ({
        key: k, askKey: `q.${bk}.${k}`, phKey: `ph.${bk}.${k}`, skipKey: "common.skip", long: true,
      })),
    },
  };
  const wizSteps = wiz ? WIZARDS[wiz.id].steps : null;
  const wizStep = wiz && wizSteps[wiz.step] ? wizSteps[wiz.step] : null;

  const startWiz = (id) => {
    const first = WIZARDS[id].steps[0];
    setWiz({ id, step: 0, answers: {} });
    say({ phase: "wiz", key: first.askKey, vars: axis, step: 0, wiz: id });
  };

  const answerWiz = (raw, finish = false) => {
    if (!wiz) return;
    const steps = WIZARDS[wiz.id].steps;
    const step = steps[wiz.step];
    const value = String(raw ?? "").trim();
    const answers = { ...wiz.answers, ...(value ? { [step.key]: value } : {}) };

    // A typed answer is the owner's own words and stays as they wrote them; a
    // skipped one is the panel speaking for them, so it follows the language.
    if (value) typed(value, "wiz");
    else if (!finish) setMsgs((s) => [...s, { role: "user", phase: "wiz", key: step.skipKey || "asst.skipped", vars: axis, paren: true }]);

    const next = wiz.step + 1;
    if (!finish && next < steps.length) {
      setWiz({ ...wiz, step: next, answers });
      say({ phase: "wiz", key: steps[next].askKey, vars: axis, step: next, wiz: wiz.id });
      return;
    }
    setWiz(null);
    finishWiz(wiz.id, answers);
  };

  const finishWiz = (id, answers) => {
    if (id === "photos") {
      const price = /^[\d.,\s]+$/.test(answers.price || "") ? answers.price.replace(/[^\d.]/g, "") : "";
      say({ phase: "wiz", key: "asst.batch.done",
        ...(answers.kind ? { vars: { kind: answers.kind } } : { varKeys: { kind: "asst.way.photos" } }) });
      // "S, M, L" becomes one axis named the way this shop names it;
      // "Size: S, M; Colour: Black" becomes two. Either is a thing a person
      // types when asked that question, so both are read.
      openImporter("photos", { kind: answers.kind, price, category: answers.kind, axes: parseAxes(answers.options, axisWord || "Size") });
      return;
    }
    // The other two end where every change in this panel ends: as a card the
    // owner reads and confirms. Built here rather than asked of the model —
    // the answers are already in the right shape, and a round trip could only
    // reword what the owner just typed.
    const a = id === "offer"
      ? { do: "offer.create", set: { title: answers.title || "", details: answers.details || "", ...(answers.valid_until ? { valid_until: answers.valid_until } : {}), active: true } }
      : { do: "training.set", set: answers };
    if (!Object.keys(a.set).filter((k) => a.set[k] && k !== "active").length) {
      say({ key: "asst.nothingSaid" });
      return;
    }
    const cards = [{ kind: "setting", a }];
    say({ key: id === "offer" ? "asst.offer.ready" : "asst.train.ready", cards, settingsBefore: settings || {}, picked: [true] });
  };

  // Back to the three things this tab does — from a finished job, from a
  // half-finished one the owner has changed their mind about, or from the
  // header button. It APPENDS rather than resetting: the conversation above is
  // what the owner just did, and throwing it away to show a menu would be a
  // strange way to offer them a menu.
  // Return to plain chat — the conversation continues, no menu of buttons. Used
  // after a change is applied, when a guided add is cancelled, and by the back
  // button while one is in progress.
  const backToChat = (key = "asst.whatNext") => {
    setWiz(null);
    if (mode === "interview") { setMode("chat"); setDraft(emptyDraft()); setPhotos([]); setVisual(""); setDup(null); setRefused(false); }
    setErr("");
    say({ key });
  };
  const backToMenu = backToChat;

  const stopInterview = () => backToMenu("asst.stopped");

  // One turn of the interview. The draft, the photo count and the vision text
  // are passed explicitly rather than read from state, because a turn is often
  // fired in the same tick as the setState that produced them.
  const turn = async (history, d = draft, n = photos.length, v = visual) => {
    setBusy(true); setErr("");
    const r = await apiJson("/api/product-interview", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: history.filter((m) => m.phase === "interview").map((m) => ({ role: m.role, content: line(m) })),
        draft: d, photos: n, visual: v,
        // The dashboard's language, so the questions come back in it. The owner
        // picked it once; nothing should ask them again.
        //
        // Read at the moment the request is made, not off the last render.
        // useLang() starts every mount in English and only corrects itself in
        // an effect, so a turn fired on arrival — the toolbar's "Add by chat" —
        // would ask the server for English questions on a Bangla dashboard.
        lang: getLang(),
      }),
    });
    setBusy(false);
    if (r.error) { setErr(r.error); return; }
    setDraft(r.draft || d);
    // A name the shop already uses is not a mistake — fifteen box t-shirts are
    // all called box t-shirts. Said as a nudge towards what to add to the name,
    // not as a refusal, and in the owner's own language.
    // The key, not the sentence — the warning is ours, so it follows the
    // language like everything else the panel says.
    setDup(r.duplicate ? { ...r.duplicate, key: "inv.dupSameName" } : null);
    setMsgs((s) => [...s, { role: "assistant", phase: "interview", content: r.reply }]);
  };

  // The attach button, from anywhere. Attaching a photo in plain chat means "add
  // this product" — the commonest reason to hand the assistant a picture — so it
  // starts the guided add with that photo. Mid-interview it just adds the photo.
  // For a service business a document is what the bot learns from, so attaching
  // one uploads it to the knowledge base and reports back in the chat.
  const uploadDocs = async (list) => {
    if (busy) return;
    const ok = /\.(pdf|docx?|txt|md|csv)$/i;
    const files = [...(list || [])].filter((f) => ok.test(f.name || ""));
    if (!files.length) { say({ key: "asst.kb.badType" }); return; }
    setBusy(true);
    for (const file of files) {
      say({ content: t("asst.kb.reading", { name: file.name }) });
      try {
        const fd = new FormData();
        fd.append("file", file);
        const r = await apiJson("/api/knowledge", { method: "POST", body: fd });
        if (r.error) say({ content: t("asst.kb.failed", { name: file.name }) });
        else { say({ content: t("asst.kb.learned", { name: file.name, n: r.chunks ?? 0 }) }); refresh?.(); }
      } catch { say({ content: t("asst.kb.failed", { name: file.name }) }); }
    }
    setBusy(false);
  };

  const attach = (list) => {
    const files = [...(list || [])];
    if (!files.length) return;
    if (isAgency) { uploadDocs(files); return; }
    if (interviewing) { addPhotos(files); return; }
    setMode("interview"); setDraft(emptyDraft()); setVisual(""); setSaved(""); setDup(null); setRefused(false); setErr(""); seenPhotos.current = new Set();
    setPhotos([]);       // chat-mode photos is already empty; make sure of it
    addPhotos(files);    // appends to [] and reads them, then asks the next thing
  };

  const addPhotos = async (list) => {
    const picked = [...list].filter((x) => x.type?.startsWith("image/"));
    if (!picked.length || busy) return;
    setErr(""); setPrepping(true);
    // All of these travel in ONE request to /api/add-product, so the whole
    // gallery has to fit the platform's ~4.5 MB limit together — which is
    // exactly what shrinkBatch measures, counting what is already attached.
    const keep = photos.reduce((a, p) => a + p.file.size, 0);
    const ready = await shrinkBatch(picked, keep);
    // The same picture chosen twice is not two pictures. Caught here, before
    // anything is uploaded or read, so it costs nothing and is never stored.
    const { fresh: unique, repeats } = await dropRepeats(ready, seenPhotos.current);
    setPrepping(false);

    // One product holds twelve. Anything past that used to be dropped by a
    // silent .slice() while the transcript still said "Added 15 photos" — the
    // owner was told a number that was not true. It says what it kept now, and
    // what it could not, and what to do with the rest.
    const room = Math.max(0, MAX_PHOTOS - photos.length);
    const taken = unique.slice(0, room);
    const overflow = unique.length - taken.length;

    const fresh = taken.map((file) => ({ id: `${Date.now()}${Math.random().toString(36).slice(2, 6)}`, file, u: preview(file) }));
    const next = [...photos, ...fresh];
    setPhotos(next);

    // Three separate lines rather than one sentence stitched together, so each
    // keeps its own key and the whole report follows the language later.
    const parts = [{ key: fresh.length === 1 ? "asst.photo.added1" : "asst.photo.added", vars: { n: fresh.length } }];
    if (repeats.length) parts.push({ key: repeats.length === 1 ? "asst.photo.repeats1" : "asst.photo.repeats", vars: { n: repeats.length } });
    if (overflow) parts.push({ key: "asst.photo.overflow", vars: { n: overflow, max: MAX_PHOTOS } });
    const said = { role: "user", phase: "interview", parts, photoUrls: fresh.map((p) => p.u) };
    const history = [...msgs, said];
    setMsgs(history);

    // Photos that would not fit usually means these are not all one product.
    // Saying so is more use than a silent truncation.
    if (overflow) setMsgs((s) => [...s, { role: "assistant", phase: "interview", cards: [],
      key: "asst.photo.overflowTip", vars: { n: overflow, max: MAX_PHOTOS } }]);

    // EVERY photo is read now, not only the first.
    //
    // The first one is read WITH a name proposal: it is the picture the
    // assistant suggests a name, a category and a sentence from. The rest are
    // described only — the back of a shirt needs words a search can match, not
    // a name of its own — which is a cheaper call and a shorter wait.
    //
    // Reading them is the whole point: a customer who photographs the BACK of
    // a shirt used to be told the shop did not have it, because the only thing
    // the catalogue knew about that shirt was what its front looked like.
    //
    // Sent a few at a time, because the platform refuses any request over
    // ~4.5 MB before our code runs. A chunk always carries at least one photo,
    // so a single large picture cannot loop forever failing to fit.
    let v = visual, d = draft;
    const unread = fresh;
    if (unread.length) {
      const got = new Map();
      let read = 0;
      for (let i = 0; i < unread.length;) {
        const chunk = [];
        let bytes = 0;
        while (i < unread.length && chunk.length < READ_PER_CALL && (!chunk.length || bytes + unread[i].file.size <= READ_BUDGET)) {
          bytes += unread[i].file.size; chunk.push(unread[i]); i++;
        }
        setReading({ done: read, total: unread.length });
        const naming = !visual && chunk.some((p) => p.id === next[0]?.id);
        const fd = new FormData();
        chunk.forEach((p) => fd.append("images", p.file));
        if (!naming) fd.append("describe_only", "1");
        const rr = await apiJson("/api/photo-draft", { method: "POST", body: fd });
        (rr.drafts || []).forEach((one, n) => { if (chunk[n]) got.set(chunk[n].id, one); });
        read += chunk.length;
      }
      setReading(null);

      // Onto the photograph itself, so a description leaves with the picture it
      // describes when the owner removes one or makes another the first.
      setPhotos((s) => s.map((p) => got.has(p.id) ? { ...p, visual: got.get(p.id).visual || "" } : p));

      const first = got.get(next[0]?.id);
      if (!visual && first?.visual) {
        v = first.visual; setVisual(v);
        // Suggestions fill only what is still blank. The owner may already have
        // typed the name, and a machine must not talk over them.
        d = { ...draft };
        for (const k of ["product_name", "category", "description"]) if (!d[k] && first[k]) d[k] = first[k];
        setDraft(d);
      }
    }
    turn(history, d, next.length, v);
  };

  // Removing a photo also forgets its fingerprint, so an owner who takes one
  // off and changes their mind can put the same one back. The fingerprint is
  // cached against the file, so asking for it again costs nothing.
  const dropPhoto = async (id) => {
    const gone = photos.find((x) => x.id === id);
    setPhotos((s) => s.filter((x) => x.id !== id));
    if (gone) { try { seenPhotos.current.delete(await fingerprint(gone.file)); } catch {} }
  };
  const makeFirst = (id) => setPhotos((s) => { const p = s.find((x) => x.id === id); return p ? [p, ...s.filter((x) => x.id !== id)] : s; });

  // `force` is the owner having read that this looks like something they
  // already have, and saying they meant it.
  // A photo the browser could not shrink can never be sent — the platform
  // refuses it before our code runs. Last resort: shrink it hard, from the
  // file we hold, at the smallest rung.
  const reshrink = async () => {
    if (busy || prepping) return;
    setPrepping(true); setErr("");
    const again = await Promise.all(photos.map(async (p) =>
      p.file.size > PHOTO_MAX_BYTES ? { ...p, file: await shrinkImage(p.file, { maxSide: 640, quality: 0.75, skipUnder: 0 }) } : p));
    setPhotos(again);
    setPrepping(false);
    if (tooLargePhotos(again).length) setErr(t("asst.photoTooLarge", { n: tooLargePhotos(again).length, max: fileSize(PHOTO_MAX_BYTES) }));
  };

  const save = async (force = false) => {
    if (!gaps.ready || busy) return;
    // Refuse to fire a request the platform is certain to reject; say what is
    // wrong instead of letting it come back as "check your internet".
    const big = tooLargePhotos(photos);
    if (big.length) { setErr(t("asst.photoTooLarge", { n: big.length, max: fileSize(PHOTO_MAX_BYTES) })); return; }
    setBusy(true); setErr(""); setRefused(false);

    // Photos 2..N go up one at a time (each request small), and the product is
    // then created from their URLs. The first stays as bytes so the server's
    // photo-based duplicate check keeps working. A dropped connection keeps the
    // URLs already won, so pressing Save again only sends what is missing.
    let list = photos;
    if (photos.length > 1) {
      const up = await uploadPhotos(photos, { from: 1, onProgress: (done, total) => setUploading({ done, total }) });
      setUploading(null);
      setPhotos(up.photos);
      if (!up.ok) { setBusy(false); setErr(up.error); return; }
      list = up.photos;
    }

    const opts = draft.options || [];
    const fd = new FormData();
    if (force) fd.append("allow_duplicate", "1");
    for (const k of ["product_name", "product_code", "category", "brand", "regular_price", "sale_price", "description"]) fd.append(k, draft[k] || "");
    fd.append("tags", (draft.tags || []).join(", "));
    fd.append("stock_qty", draft.stock_qty === undefined || draft.stock_qty === null ? "" : String(draft.stock_qty));
    fd.append("stock_status", draft.stock_status || (draft.stock_qty === 0 ? "outofstock" : "instock"));
    fd.append("options", JSON.stringify(opts));
    fd.append("variants", JSON.stringify(buildVariants(opts, { regular_price: draft.regular_price || "", sale_price: draft.sale_price || "" })));
    // Every description the AI already produced, one per photo and in the order
    // shown — so vision does not run again on pictures already read, and so the
    // catalogue knows every side of this product rather than only its front.
    // `vis[0]` rather than the stored `visual`, because making another photo the
    // first one changes which description belongs to the primary.
    const vis = list.map((p) => p.visual || "");
    if (vis[0] || visual) fd.append("visual", vis[0] || visual);
    if (vis.some(Boolean)) fd.append("visuals", JSON.stringify(vis));
    // Only the primary travels as a file now; the rest are the URLs just won.
    fd.append("images", list[0].file);
    fd.append("image_urls", JSON.stringify(list.map((p, i) => (i === 0 ? "upload:0" : p.url))));

    const r = await apiJson("/api/add-product", { method: "POST", body: fd });
    setBusy(false);
    // A duplicate is a question, not a failure. It is said in the conversation
    // rather than as a red line under the box, because the whole point of this
    // panel is that it talks — and the draft stays exactly where it was.
    if (r.duplicate) {
      // The server's sentence, in whatever language it wrote it — it is not
      // ours to re-translate — with our own instruction keyed around it.
      setDup({ ...r.duplicate, message: r.error });
      setRefused(true);
      setMsgs((s) => [...s, { role: "assistant", phase: "interview", cards: [], key: "asst.dupRefused", vars: { message: r.error } }]);
      return;
    }
    if (r.error) { setErr(r.error); return; }
    const name = draft.product_name;
    setMode("chat"); setDraft(emptyDraft()); setPhotos([]); setVisual("");
    setSaved(name);
    // Saved, and then straight back to the three things — because "I have
    // added the shirt, now let me set the offer" was a road with no way back
    // along it short of reloading the page.
    say({ key: r.analyzeError ? "asst.addedBlind" : "asst.added", vars: { name }, menu: true });
    refresh?.();
  };

  // ── Rendering ──────────────────────────────────────────────────────────────
  const interviewing = mode === "interview";

  // The three things this tab does, IN ORDER, with a tick on the ones already
  // done and the first undone one leading. Rendered from one place because it
  // appears twice: at the top of an empty panel, and again every time a job
  // finishes — which is how the owner gets BACK here without losing the
  // conversation. A "start over" that wiped the transcript would be a worse
  // answer to the same question.
  const menu = <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(190px, 1fr))", gap: 8, marginBottom: 12 }}>
    {INTENTS.map((w, n) => {
      const done = w.done(products, settings);
      // The one to do next: the first that is not done. Everything is
      // pressable — this only says where to start.
      const next = !done && INTENTS.slice(0, n).every((x) => x.done(products, settings));
      return <button key={w.id} type="button" onClick={() => pickIntent(w.id)} disabled={busy} className="ui-btn ob-row"
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 13px", borderRadius: 13, textAlign: "left", cursor: "pointer", fontFamily: "inherit", minHeight: 56,
          background: next ? T.goldBg : T.bgAlt, border: `1px solid ${next ? T.gold : T.border}`, color: T.text, opacity: done ? .82 : 1 }}>
        <span style={{ width: 26, height: 26, flexShrink: 0, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
          background: done ? `color-mix(in srgb, ${T.success} 14%, transparent)` : T.card, color: done ? T.success : T.gold, fontSize: 12.5, fontWeight: 700 }}>
          {done ? <i className="ti ti-check" style={{ fontSize: 14 }} /> : n + 1}
        </span>
        <i className={`ti ${w.icon}`} style={{ fontSize: 19, flexShrink: 0, color: T.gold }} />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{t(`asst.intent.${w.id}`)}</span>
          <span style={{ display: "block", fontSize: 11, color: T.textMuted, marginTop: 1 }}>{t(`asst.intent.${w.id}Sub`)}</span>
        </span>
      </button>;
    })}
  </div>;

  // On a phone, back out of a half-finished product or a wizard to the three
  // things — not out of the tab. The draft is thrown away either way, but
  // landing on the menu says so; landing on Analytics looks like a crash.
  useBackClose(interviewing || !!wiz, () => backToMenu());
  const filledRows = Object.entries(draft).filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length));

  return <>
  {/* Adding products from photos, a spreadsheet or another shop opens its sheet
      HERE, over the chat — the owner never leaves the assistant. onDone posts the
      result back into the conversation and refreshes the catalogue behind it. */}
  {importer === "photos" && <PhotoBatchSheet isMobile={isMobile} categories={categories} shopAxes={shopAxes} prefill={importPrefill}
    onClose={closeImporter} onDone={(msg) => { closeImporter(); refresh?.(); if (msg) setMsgs((s) => [...s, { role: "assistant", content: String(msg) }]); }} />}
  {importer && importer !== "photos" && <ImportSheet kind={importer} isMobile={isMobile}
    onClose={closeImporter} onDone={(msg) => { closeImporter(); refresh?.(); if (msg) setMsgs((s) => [...s, { role: "assistant", content: String(msg) }]); }} />}
  {overviewOpen && <CategoryOverviewSheet catNames={categories} onClose={() => { setOverviewOpen(false); refresh?.(); }} />}
  <Card style={{ padding: 0, marginBottom: fullPage ? 0 : 14, overflow: "hidden", ...(fullPage ? { display: "flex", flexDirection: "column", height: isMobile ? "100%" : "calc(100vh - 150px)" } : {}) }}>
    {/* On its own page there is nothing to collapse into — the header is a
        title, not a switch. */}
    {fullPage
      ? <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 16px", flexShrink: 0 }}>
          {/* On a phone this screen fills the display and the shell's own header
              is hidden, so this is the only way back to the menu. */}
          {onMenu && <button type="button" onClick={onMenu} aria-label="Menu" className="ui-sq"
            style={{ width: 36, height: 36, flexShrink: 0, minHeight: 0, padding: 0, borderRadius: 11, background: T.bgAlt, border: `1px solid ${T.border}`, color: T.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ti ti-menu-2" style={{ fontSize: 18 }} /></button>}
          <span style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 10, background: T.goldBg, display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ti ti-sparkles" style={{ fontSize: 17, color: T.gold }} /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>{t("inv.assistantTitle")}</span>
            <span style={{ display: "block", fontSize: 11.5, color: T.textMuted, marginTop: 1 }}>{t("inv.assistantSub")}</span>
          </span>
          {/* A way OUT of a guided add — nothing else has buttons, so this only
              shows while an interview or a short wizard is in progress. */}
          {(interviewing || !!wiz) && <Btn small onClick={() => backToChat("asst.stopped")} disabled={busy} style={{ flexShrink: 0, borderRadius: 11, whiteSpace: "nowrap" }}>
            <i className="ti ti-x" style={{ marginRight: 5 }} />{t("common.cancel")}
          </Btn>}
        </div>
      : <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="ui-btn"
      style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "13px 16px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", color: T.text, textAlign: "left", minHeight: 44 }}>
      <span style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 10, background: T.goldBg, display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ti ti-message-2-bolt" style={{ fontSize: 17, color: T.gold }} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>{t("inv.assistantTitle")}</span>
        <span style={{ display: "block", fontSize: 11.5, color: T.textMuted, marginTop: 1 }}>{t("inv.assistantSub")}</span>
      </span>
      <i className={`ti ti-chevron-${open ? "up" : "down"}`} style={{ fontSize: 16, color: T.textMuted, flexShrink: 0 }} />
    </button>}

    {/* Laid out like the Inbox: the panel is a fixed height, the transcript is
        the only part that grows, and the box you type in is pinned to the
        bottom of it. It used to be an ordinary stack in the page, so every
        answer pushed the input further down and it ended up below the fold —
        the owner was typing into something they could not see. */}
    {(open || fullPage) && <div style={{ borderTop: `1px solid ${T.border}`, padding: fullPage ? "12px 16px calc(14px + env(safe-area-inset-bottom))" : "12px 16px 14px", display: "flex", flexDirection: "column",
      ...(fullPage ? { flex: 1, minHeight: 0 } : { height: isMobile ? "min(70dvh, calc(100dvh - 240px))" : "min(560px, calc(100dvh - 300px))" }) }}>
      {/* The transcript is what gives way. The product being built and the box
          you type in keep their room; older messages scroll. */}
      <div style={{ flex: "1 1 auto", minHeight: 84, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
        {!msgs.length && <div style={{ padding: "6px 0 2px" }}>
          <div style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.65, marginBottom: 10 }}>
            {t(isAgency ? "asst.introAgency" : "asst.intro", { n: products?.length || 0 })}
          </div>
          {/* No menu of buttons — this is a conversation. A few example prompts,
              the way Claude opens, so the owner knows the sort of thing they can
              just say; clicking one only fills the box's first message. */}
          {/* Example prompts, the way Claude opens — clicking one just sends it.
              No "or open" row of tabs: every tab is in the sidebar already, so a
              second copy here was exactly the clutter the owner asked to remove. */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {(isAgency ? EXAMPLE_KEYS_AGENCY : EXAMPLE_KEYS).map((c) => <button key={c} type="button" onClick={() => ask(t(c))} className="ui-btn ob-chip"
              style={{ padding: "8px 12px", borderRadius: 20, fontSize: 12, background: T.bgAlt, border: `1px solid ${T.border}`, color: T.textMuted, cursor: "pointer", fontFamily: "inherit", minHeight: 36 }}>{t(c)}</button>)}
          </div>
        </div>}

        {/* Nothing is dropped from the array — a hidden line renders as null so
            that every later index still points at the message it did before.
            The proposal cards are addressed by index. */}
        {msgs.map((m, mi) => m.hidden ? null : <div key={mi} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", gap: 8 }}>
          <div style={{ maxWidth: "88%", padding: "9px 13px", borderRadius: 14, fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap",
            background: m.role === "user" ? T.goldBg : T.bgAlt, color: m.role === "user" ? T.gold : T.text, boxShadow: m.role === "user" ? "none" : T.nmIn }}>{m.paren ? `(${line(m)})` : line(m)}</div>

          {/* The rule for an import that opens its own sheet. The button is
              what opens it, so the four lines above stay readable for as long
              as the owner wants them there. */}
          {m.go && <Btn gold onClick={() => openImporter(m.go)} disabled={busy} style={{ borderRadius: 20, minHeight: 40 }}>
            <i className={`ti ${WAY_ICON[m.go]}`} style={{ marginRight: 6 }} />{t("asst.rule.open")}
          </Btn>}

          {/* The shop's own categories, under the question that asks for one.
              Only under the LAST message and only while that is what is being
              asked, so old questions do not keep a row of buttons under them.
              Typing a new one still works — this is a shortcut, not a fence —
              and it is what stops one shop ending up with "T-shirt", "T shirt"
              and "tshirt" as three categories the bot cannot tell apart. */}
          {interviewing && mi === msgs.length - 1 && m.role === "assistant" && gaps.queue?.[0] === "category" && categories.length > 0 &&
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {categories.slice(0, 12).map((c) => <button key={c} type="button" onClick={() => ask(c)} disabled={busy} className="ui-btn ob-chip"
                style={{ padding: "8px 13px", borderRadius: 20, fontSize: 12, background: T.bgAlt, border: `1px solid ${T.border}`, color: T.text, cursor: "pointer", fontFamily: "inherit", minHeight: 40 }}>{c}</button>)}
              <span style={{ alignSelf: "center", fontSize: 11.5, color: T.textDim }}>{t("asst.orNewCat")}</span>
            </div>}

          {/* The question being asked right now can be skipped, and a long one
              can be left early with whatever has been said. Both sit UNDER the
              question rather than beside the message box: on a phone a button
              in that row squeezed the box you type in down to ninety-seven
              pixels. Matched on WHICH step the message is, not on its wording —
              comparing the sentences meant the chips vanished the moment the
              language changed underneath them. */}
          {m.step !== undefined && m.wiz === wiz?.id && wiz?.step === m.step && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {wizSteps[m.step]?.skipKey && <button type="button" onClick={() => answerWiz("")} disabled={busy} className="ui-btn ob-chip"
              style={{ padding: "8px 13px", borderRadius: 20, fontSize: 12, background: T.bgAlt, border: `1px solid ${T.border}`, color: T.textMuted, cursor: "pointer", fontFamily: "inherit", minHeight: 40 }}>{t(wizSteps[m.step].skipKey, axis)}</button>}
            {WIZARDS[wiz.id].finishKey && <button type="button" onClick={() => answerWiz("", true)} disabled={busy} className="ui-btn ob-chip"
              style={{ padding: "8px 13px", borderRadius: 20, fontSize: 12, background: T.goldBg, border: `1px solid ${T.gold}`, color: T.gold, cursor: "pointer", fontFamily: "inherit", minHeight: 40, fontWeight: 600 }}>{t(WIZARDS[wiz.id].finishKey)}</button>}
            <span style={{ alignSelf: "center", fontSize: 11.5, color: T.textDim }}>{m.step + 1} / {wizSteps.length}</span>
          </div>}

          {/* The three things again, under whatever just finished. This is the
              way back to the main interface, and it is offered rather than
              hunted for. */}
          {m.menu && <div style={{ width: "100%" }}>{menu}</div>}

          {/* A fork in the road, as buttons. They go away once answered. */}
          {m.choice && CHOICES[m.choice] && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {CHOICES[m.choice].map((c, n) => <Btn key={c.id} gold={n === 0} onClick={() => answerChoice(m.choice, c.id)} disabled={busy} style={{ borderRadius: 20, minHeight: 40 }}>
              <i className={`ti ${c.icon}`} style={{ marginRight: 6 }} />{t(c.key)}
            </Btn>)}
          </div>}

          {m.photoUrls?.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: "88%" }}>
            {m.photoUrls.map((u) => <img key={u} src={u} alt="" style={{ width: 46, height: 46, objectFit: "cover", borderRadius: 9, border: `1px solid ${T.border}` }} />)}
          </div>}

          {m.cards?.length > 0 && <div style={{ width: "100%", borderRadius: 14, border: `1px solid ${T.border}`, background: T.card, padding: 12 }}>
            <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: .7, marginBottom: 9 }}>
              {t("asst.proposed")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {m.cards.map((c, ai) => {
                // Two describers, one card. A price and an offer read the same
                // way to the owner; only the half of the dashboard they land in
                // differs, and that is the server's business, not theirs.
                const d = c.kind === "setting" ? describeSetting(c.a, m.settingsBefore, t) : describeAction(c.a, m.before?.[c.a.id], t);
                return <label key={ai} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 10, borderRadius: 11, background: T.bgAlt, cursor: m.done ? "default" : "pointer" }}>
                  <input type="checkbox" checked={!!m.picked[ai]} disabled={!!m.done || busy} onChange={() => toggle(mi, ai)}
                    style={{ width: 17, height: 17, flexShrink: 0, marginTop: 1, accentColor: T.gold }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: d.danger ? T.danger : T.text }}>
                      {d.danger && <i className="ti ti-alert-triangle" style={{ marginRight: 6 }} />}{d.title}
                    </span>
                    {d.lines.map((l, i) => <span key={i} style={{ display: "block", fontSize: 12, color: T.textMuted, marginTop: 3, lineHeight: 1.5 }}>{l}</span>)}
                  </span>
                </label>;
              })}
            </div>

            {m.done
              ? <div style={{ fontSize: 12.5, color: m.done.failed.length ? T.warn : T.success, marginTop: 10, display: "flex", gap: 6 }}>
                  <i className={`ti ti-${m.done.failed.length ? "alert-triangle" : "check"}`} style={{ fontSize: 15, flexShrink: 0 }} />
                  <span>{m.done.failed.length
                    ? t("asst.appliedSome", { n: m.done.ok, m: m.done.failed.length, errors: m.done.failed.map((f) => f.error).join(", ") })
                    : many(m.done.ok, "asst.applied")}</span>
                </div>
              : <div style={{ display: "flex", gap: 8, marginTop: 11, flexWrap: "wrap" }}>
                  <Btn gold onClick={() => apply(mi)} disabled={busy || !m.picked.some(Boolean)} style={{ borderRadius: 11 }}>
                    {many(m.picked.filter(Boolean).length, "asst.apply")}
                  </Btn>
                  <Btn small onClick={() => discard(mi)} disabled={busy} style={{ borderRadius: 11 }}>{t("asst.discard")}</Btn>
                </div>}
          </div>}

          {m.dropped && <div style={{ fontSize: 12, color: T.textDim }}>{t("asst.discarded")}</div>}
        </div>)}

        {busy && <div style={{ fontSize: 12.5, color: T.textMuted, display: "flex", gap: 7, alignItems: "center" }}><i className="ti ti-loader-2" style={{ fontSize: 15 }} />{t(interviewing ? "asst.writing" : "asst.thinking")}</div>}
        {prepping && <div style={{ fontSize: 12.5, color: T.textMuted, display: "flex", gap: 7, alignItems: "center" }}><i className="ti ti-loader-2" style={{ fontSize: 15 }} />{t("asst.prepping")}</div>}
        {reading && <div style={{ fontSize: 12.5, color: T.textMuted, display: "flex", gap: 7, alignItems: "center" }}><i className="ti ti-loader-2" style={{ fontSize: 15 }} />{t("asst.reading", { n: Math.min(reading.done + 1, reading.total), total: reading.total })}</div>}
        {saved && !interviewing && <div style={{ fontSize: 12.5, color: T.success, display: "flex", gap: 6 }}><i className="ti ti-check" style={{ fontSize: 15 }} />{t("asst.savedLine", { name: saved })}</div>}
        <div ref={endRef} />
      </div>

      {/* The product being built, always visible while it is being built, so
          the owner can see what the assistant has understood rather than
          having to trust it. */}
      {/* The product being built never takes the whole panel: it is capped and
          scrolls on its own, so a long draft cannot push the transcript away
          or the Save button off the bottom. */}
      {interviewing && <div style={{ flex: "0 0 auto", overflowY: "auto", maxHeight: "55%", borderRadius: 14, border: `1px solid ${T.border}`, background: T.card, padding: 12, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ flex: 1, fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: .7 }}>{t("asst.draftTitle")}</span>
          <button type="button" onClick={stopInterview} disabled={busy} className="ui-btn" style={{ background: "none", border: "none", color: T.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "inherit", minHeight: 44, minWidth: 60, padding: "0 6px" }}>{t("asst.cancel")}</button>
        </div>

        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: photos.length ? 11 : 0 }}>
          {photos.map((p, i) => <div key={p.id} style={{ position: "relative", width: TH, height: TH }}>
            <img src={p.u} alt="" onClick={() => makeFirst(p.id)} title={t(i === 0 ? "asst.photo.first" : "asst.photo.makeFirst")}
              style={{ width: TH, height: TH, objectFit: "cover", borderRadius: 12, cursor: "pointer", border: `2px solid ${i === 0 ? T.gold : T.border}` }} />
            {i === 0 && <span style={{ position: "absolute", left: 4, bottom: 4, fontSize: 9.5, fontWeight: 700, padding: "2px 6px", borderRadius: 6, background: T.gold, color: "#fff" }}>{t("asst.photo.firstBadge")}</span>}
            {/* On a phone the target is 44px and sits wholly inside the tile;
                on a desktop it is a small cross overhanging the corner. */}
            <button type="button" onClick={() => dropPhoto(p.id)} aria-label={t("asst.photo.remove", { n: i + 1 })} className="ui-btn"
              style={{ position: "absolute", top: isMobile ? 0 : -7, right: isMobile ? 0 : -7, width: X, height: X, minHeight: 0, padding: 0,
                background: "none", border: "none", color: T.danger, cursor: "pointer",
                display: "flex", alignItems: "flex-start", justifyContent: "flex-end", fontSize: 12 }}>
              <span style={{ width: 22, height: 22, margin: isMobile ? 6 : 0, borderRadius: 11, background: T.card, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ti ti-x" /></span>
            </button>
          </div>)}
        </div>

        {filledRows.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {filledRows.map(([k, v]) => <span key={k} style={{ fontSize: 11.5, padding: "5px 10px", borderRadius: 9, background: T.bgAlt, color: T.text, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <span style={{ color: T.textDim }}>{fld(k)}: </span>
            {k === "options" ? v.map((o) => `${o.name} (${o.values.join(", ")})`).join("; ") : Array.isArray(v) ? v.join(", ") : String(v)}
          </span>)}
        </div>}

        {/* Ours is keyed and follows the language; the server's refusal is its
            own sentence and is shown as it was written. */}
        {dup && <div style={{ display: "flex", gap: 7, alignItems: "flex-start", padding: "9px 11px", borderRadius: 11, background: T.warnBg, color: T.warn, fontSize: 12, lineHeight: 1.55, marginBottom: 10 }}>
          <i className="ti ti-alert-triangle" style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} />
          <span>{dup.key ? t(dup.key, { name: dup.product_name }) : dup.message}</span>
        </div>}

        <div style={{ fontSize: 11.5, color: gaps.blocking.length ? T.textMuted : T.textDim, lineHeight: 1.6 }}>
          {gaps.blocking.length
            ? <>{t("asst.needed")}<strong style={{ color: T.text }}>{gaps.blocking.map(fld).join(", ")}</strong>{t("asst.neededEnd")}</>
            : gaps.wanted.length
              ? <>{t("asst.readyPrefix")}<strong style={{ color: T.warn }}>{gaps.wanted.map(fld).join(" · ")}</strong>{t(gaps.wanted.length > 1 ? "asst.readyMany" : "asst.readyOne")}</>
              : t("asst.allFilled")}
          {photos.length > 0 && <> · {t("asst.photoCount", { n: photos.length, size: fileSize(photos.reduce((a, p) => a + p.file.size, 0)) })}</>}
        </div>
        {/* Shrinking failed for some photos: they can never be sent as they are.
            Said here, with the fix, before the owner ever presses Save. */}
        {tooLargePhotos(photos).length > 0 && <div style={{ fontSize: 12, color: T.danger, marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span>{t("asst.photoTooLarge", { n: tooLargePhotos(photos).length, max: fileSize(PHOTO_MAX_BYTES) })}</span>
          <button onClick={reshrink} disabled={busy || prepping} className="ui-btn" style={{ background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 9, color: T.text, fontSize: 12, fontWeight: 600, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>
            {prepping ? "…" : t("asst.shrinkAgain")}
          </button>
        </div>}
        {uploading && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>{t("asst.uploading", { done: uploading.done, total: uploading.total })}</div>}

        {/* The ref is on the wrapper, not the button: Btn is a plain function
            component and does not forward one. */}
        {gaps.ready && <div ref={saveRef} style={{ marginTop: 11, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn gold onClick={() => save()} disabled={busy || prepping || tooLargePhotos(photos).length > 0} style={{ borderRadius: 11 }}>
            <i className="ti ti-check" style={{ marginRight: 6 }} />{t("asst.save", { name: draft.product_name })}
          </Btn>
          {/* Only after a save has actually been turned away. */}
          {refused && <Btn onClick={() => save(true)} disabled={busy || prepping} style={{ borderRadius: 11, background: T.warnBg, color: T.warn }}>{t("asst.addAnyway")}</Btn>}
        </div>}
      </div>}

      {err && <div style={{ fontSize: 12.5, color: T.danger, display: "flex", gap: 6, marginBottom: 8, flexShrink: 0 }}><i className="ti ti-alert-circle" style={{ fontSize: 15, flexShrink: 0 }} /><span>{err}</span></div>}

      <form ref={formRef} onSubmit={(e) => { e.preventDefault(); ask(input); }} style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        {/* Always here, like Claude's attach — a photo can be dropped in at any
            point, not only mid-add. */}
        <input ref={fileRef} type="file" accept={isAgency ? ".pdf,.doc,.docx,.txt,.md,.csv" : "image/*"} multiple hidden onChange={(e) => { attach(e.target.files); e.target.value = ""; }} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy || prepping || (!isAgency && interviewing && photos.length >= MAX_PHOTOS)}
          aria-label={isAgency ? t("asst.doc.attach") : t("asst.photo.attach")} title={isAgency ? t("asst.doc.attach") : (interviewing && photos.length >= MAX_PHOTOS ? t("asst.photo.full", { max: MAX_PHOTOS }) : t("asst.photo.attach"))} className="ui-btn"
          style={{ width: 44, height: 44, flexShrink: 0, minHeight: 0, padding: 0, borderRadius: 12, background: T.bgAlt, border: `1px solid ${T.border}`, color: T.gold, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <i className="ti ti-paperclip" style={{ fontSize: 18 }} />
        </button>
        <input value={input} onChange={(e) => setInput(e.target.value)} disabled={busy}
          placeholder={wizStep ? t(wizStep.phKey, axis) : t(interviewing ? "asst.ph.answer" : "asst.ph.chat")} aria-label={t("asst.aria")}
          className="ui-inp" style={{ flex: 1, minWidth: 0, background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 12, padding: "11px 14px", color: T.text, fontSize: 13, outline: "none", fontFamily: "inherit", boxShadow: T.nmIn }} />
        <Btn gold type="submit" disabled={busy || !input.trim()} aria-label={t("common.send")} style={{ borderRadius: 12, padding: "9px 16px", minHeight: 44 }}><i className="ti ti-send" style={{ fontSize: 16 }} /></Btn>
      </form>

      {/* No row of buttons once the conversation is going: everything — add a
          product, an offer, an import, the overview image — is reached by just
          saying it. The model opens the right screen (the `ui` signal). */}
    </div>}
  </Card>
  </>;
}
