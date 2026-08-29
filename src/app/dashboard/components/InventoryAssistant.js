"use client";
import { useState, useRef, useEffect } from "react";
import { T, Card, Btn, useIsMobile } from "./ui.js";
import { apiJson } from "./session.js";
import { getLang, useT } from "./i18n.js";
import { describeAction, draftGaps } from "@/lib/inventory-actions.js";
import { shrinkBatch, fileSize, GALLERY_BUDGET } from "@/lib/shrink-image.js";
import { dropRepeats, fingerprint } from "@/lib/photo-fingerprint.js";
import { buildVariants, parseAxes } from "@/lib/variants.js";

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
// TAKING YOU THERE. "Show me the orders" opens the Orders tab. The chat is a
// front door to the whole dashboard, not a box bolted onto one page of it.
//
// The way in is always the same three steps, in this order, and the order
// matters because each step changes what the next one should say:
//
//   1. WHERE ARE THEY COMING FROM — being asked, photos, a spreadsheet, a
//      link, WooCommerce.
//   2. ONE, OR SEVERAL — asked before anything else, because interviewing
//      somebody about the first of fifteen shirts is the single mistake here
//      that costs a whole evening.
//   3. WHAT IS ABOUT TO HAPPEN — four lines of it, before it happens. Somebody
//      who has never done this cannot tell an assistant that is collecting
//      from one that is saving, and that difference is the whole design.
//
// The draft is held here and sent with every turn, not remembered by the model.
// What can be saved is decided by draftGaps, not by the assistant saying it
// thinks it is finished. And every word the panel says for itself goes through
// the translator: the owner picks a language once, and a chat answering in
// English under a Bangla screen was the last place that rule was broken.

const CHIP_KEYS = ["asst.chip.low", "asst.chip.noPrice", "asst.chip.oos"];

// Every way into the catalogue, offered from the one place the owner is already
// talking. The panel used to offer only the interview, so someone sitting in the
// chat with a spreadsheet in front of them had to close it, find the Import
// menu and start again — the chat looked like it could only do one product at a
// time, which is exactly what it looked like to the owner.
//
// The three imports open the sheets that already do that work rather than a
// second copy of them living in here. One implementation, two doors to it.
const WAYS = ["ask", "photos", "csv", "url", "woo"];
const WAY_ICON = { ask: "ti-messages", photos: "ti-photo-plus", csv: "ti-table", url: "ti-link", woo: "ti-brand-wordpress" };

// Where the assistant can put somebody down without them going looking for a
// tab. "Bot Training" leads and wears the accent colour: teaching the bot is
// the other half of what this tab is for, and it is the page owners looked
// straight past for as long as it was called Settings.
const JUMPS = ["settings", "conversations", "orders", "analytics", "broadcast"];
const JUMP_ICON = { settings: "ti-wand", conversations: "ti-messages", orders: "ti-shopping-cart", analytics: "ti-chart-bar", broadcast: "ti-speakerphone" };

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

function destinationFor(text) {
  const s = String(text || "").toLowerCase();
  if (!GO_WORDS.test(s)) return null;
  for (const d of DESTINATIONS) {
    if (d.words.some((w) => s.includes(w))) return d.page;
  }
  return null;
}

export default function InventoryAssistant({ products, refresh, startSignal = 0, onImport, shopAxes = [], fullPage = false, onGo }) {
  const isMobile = useIsMobile();
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
  // The three questions asked once before a batch of photos. null when not in
  // one. See startBatch().
  const [batch, setBatch] = useState(null);

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
  // It lands on step 2, not straight into an interview: somebody who pressed
  // "Add by chat" has told us the method and nothing else.
  useEffect(() => { if (startSignal > 0) { setOpen(true); askHowMany(); } }, [startSignal]);

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
  const say = (m) => setMsgs((s) => [...s, { role: "assistant", phase: "chat", actions: [], ...m }]);
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
    if (batch) return answerBatch(q);

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
    say({
      content: r.reply, actions: r.actions || [], before: r.before || {},
      // Every proposal starts ticked: the owner reads them and unticks what is
      // wrong, rather than having to tick things one at a time to get anywhere.
      picked: (r.actions || []).map(() => true),
    });
  };

  const toggle = (mi, ai) => setMsgs((s) => s.map((m, i) => i !== mi ? m : { ...m, picked: m.picked.map((p, j) => j === ai ? !p : p) }));

  const apply = async (mi) => {
    const m = msgs[mi];
    const chosen = m.actions.filter((_, i) => m.picked[i]);
    if (!chosen.length || busy) return;
    setBusy(true); setErr("");
    const r = await apiJson("/api/inventory-apply", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ actions: chosen }),
    });
    setBusy(false);
    if (r.error) { setErr(r.error); return; }
    const failed = (r.results || []).filter((x) => !x.ok);
    setMsgs((s) => s.map((x, i) => i !== mi ? x : { ...x, done: { ok: r.done, failed } }));
    refresh?.();
  };

  const discard = (mi) => setMsgs((s) => s.map((m, i) => i !== mi ? m : { ...m, actions: [], picked: [], dropped: true }));

  // ── Step 1: where are they coming from ─────────────────────────────────────
  // "I'll ask you the questions" and "From photos" are this panel's own job;
  // the other three open the sheet that already does that import. An interview
  // in progress is left exactly as it is — the sheet sits on top and the draft
  // is still here underneath when it closes.
  const pickWay = (id) => {
    setErr("");
    if (id === "ask") return askHowMany();
    if (id === "photos") { heard("asst.way.photos"); return beginMany(); }
    // A spreadsheet, a link and WooCommerce each open a sheet that covers this
    // panel, so their rule gets a button rather than being shown and hidden in
    // the same breath. A rule nobody had time to read is not a rule.
    heard(`asst.way.${id}`);
    say({ key: `asst.rule.${id}`, go: id });
  };

  // ── Step 2: one, or several ────────────────────────────────────────────────
  // Between "how do you want to add them" and the first question about a
  // product there is one more thing worth knowing, and getting it wrong is
  // expensive: an owner with fifteen shirts should not be interviewed about the
  // first one. Asked as two buttons rather than a sentence, because it has
  // exactly two answers.
  const askHowMany = () => {
    setErr("");
    heard("asst.start");
    say({ choice: "count", key: "asst.count.ask" });
  };

  const answerHowMany = (several) => {
    setMsgs((s) => s.map((m) => m.choice === "count" ? { ...m, choice: null } : m));
    heard(several ? "asst.count.saidMany" : "asst.count.saidOne");
    if (several) beginMany(); else beginOne();
  };

  // ── Step 3: the rule, and then the work ────────────────────────────────────
  // Four lines saying what is about to happen and, most of all, that nothing is
  // saved until a button is pressed. The interview and the batch both keep
  // going straight after: their next question appears under the rule, so it
  // stays on screen to be read.
  const beginOne = () => { say({ key: "asst.rule.one" }); startInterview(); };
  const beginMany = () => { say({ key: "asst.rule.many" }); startBatch(); };

  const startInterview = () => {
    setMode("interview"); setDraft(emptyDraft()); setPhotos([]); setVisual(""); setSaved(""); setErr(""); setDup(null); setRefused(false); seenPhotos.current = new Set();
    // The seed is the whole history this turn needs — turn() keeps only the
    // interview-phase lines anyway. Built from `msgs` it would be built from a
    // STALE `msgs` and then written back over the real one, which is how the
    // two lines the owner had just read — "one or several?", "just one" —
    // vanished off the transcript the instant the interview began.
    //
    // `hidden` because it is addressed to the model, not to the owner: it is
    // the sentence that opens the conversation on the server's side, and it
    // was appearing in the transcript as an English line the owner had
    // supposedly just said, directly under the Bangla one they actually did.
    const seed = { role: "user", content: "I want to add a product.", phase: "interview", hidden: true };
    setMsgs((s) => [...s, seed]);
    turn([seed], {}, 0, "");
  };

  // ── Many at once: ask what they have in common, once ───────────────────────
  // Fifteen shirts off one rail share a kind, a price and a set of sizes. Asked
  // once here, they are on every product before the owner sees a single row —
  // instead of being typed fifteen times, or set with a bulk bar the owner has
  // to find. These three questions are scripted, not put to the model: they are
  // always the same three, and an AI call to ask "what are these?" would be a
  // cost and a wait for nothing.
  // The third question is asked in this shop's own words. A clothing shop that
  // has ever used "Size" is asked about sizes; a phone shop that uses
  // "Capacity" is asked about capacities. Only a shop with no products yet gets
  // the general wording — and even then the photos will propose something.
  // Every one of them carries a real example of the answer, because "what
  // sizes?" and "what sizes? (for example: S, M, L)" are not the same question
  // to somebody who has never been asked it before.
  // Keys, not sentences, for the same reason the transcript holds keys: these
  // three questions are re-read on every render, so a language switch mid-batch
  // changes the question the owner is looking at as well as the ones above it.
  const axisWord = shopAxes[0] || "";
  const axis = { axis: axisWord };
  const BATCH_STEPS = [
    { key: "kind", askKey: "asst.batch.kind", phKey: "asst.batch.kindPh" },
    { key: "price", askKey: "asst.batch.price", phKey: "asst.batch.pricePh", skipKey: "asst.batch.priceSkip" },
    { key: "options",
      askKey: axisWord ? "asst.batch.optionsNamed" : "asst.batch.options",
      phKey: axisWord ? "asst.batch.optionsPhNamed" : "asst.batch.optionsPh",
      skipKey: axisWord ? "asst.batch.optionsSkipNamed" : "asst.batch.optionsSkip" },
  ];

  const startBatch = () => {
    setBatch({ step: 0, kind: "", price: "", options: "" });
    say({ phase: "batch", key: BATCH_STEPS[0].askKey, vars: axis, step: 0 });
  };

  const answerBatch = (raw) => {
    const b = batch;
    if (!b) return;
    const step = BATCH_STEPS[b.step];
    const value = String(raw ?? "").trim();
    const next = { ...b, [step.key]: value, step: b.step + 1 };
    setBatch(next);
    // A typed answer is the owner's own words and stays as they wrote them; a
    // skipped one is the panel speaking for them, so it follows the language.
    if (value) typed(value, "batch");
    else setMsgs((s) => [...s, { role: "user", phase: "batch", key: step.skipKey || "asst.skipped", vars: axis, paren: true }]);

    if (next.step < BATCH_STEPS.length) {
      say({ phase: "batch", key: BATCH_STEPS[next.step].askKey, vars: axis, step: next.step });
      return;
    }
    // Everything they share is known. Now the photos, in the sheet that groups
    // them — carrying the answers, so nothing is asked twice.
    const price = /^[\d.,\s]+$/.test(next.price) ? next.price.replace(/[^\d.]/g, "") : "";
    say({ phase: "batch", key: "asst.batch.done",
      ...(next.kind ? { vars: { kind: next.kind } } : { varKeys: { kind: "asst.way.photos" } }) });
    setBatch(null);
    // "S, M, L" becomes one axis named the way this shop names it;
    // "Size: S, M; Colour: Black" becomes two. Either is a thing a person types
    // when asked that question, so both are read.
    onImport?.("photos", { kind: next.kind, price, category: next.kind, axes: parseAxes(next.options, axisWord || "Size") });
  };

  const stopInterview = () => {
    setMode("chat"); setDraft(emptyDraft()); setPhotos([]); setVisual("");
    say({ key: "asst.stopped" });
  };

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
    if (overflow) setMsgs((s) => [...s, { role: "assistant", phase: "interview", actions: [],
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
  const save = async (force = false) => {
    if (!gaps.ready || busy) return;
    setBusy(true); setErr(""); setRefused(false);
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
    const vis = photos.map((p) => p.visual || "");
    if (vis[0] || visual) fd.append("visual", vis[0] || visual);
    if (vis.some(Boolean)) fd.append("visuals", JSON.stringify(vis));
    photos.forEach((p) => fd.append("images", p.file));
    fd.append("image_urls", JSON.stringify(photos.map((_, i) => `upload:${i}`)));

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
      setMsgs((s) => [...s, { role: "assistant", phase: "interview", actions: [], key: "asst.dupRefused", vars: { message: r.error } }]);
      return;
    }
    if (r.error) { setErr(r.error); return; }
    const name = draft.product_name;
    setMode("chat"); setDraft(emptyDraft()); setPhotos([]); setVisual("");
    setSaved(name);
    say({ key: r.analyzeError ? "asst.addedBlind" : "asst.added", vars: { name } });
    refresh?.();
  };

  // ── Rendering ──────────────────────────────────────────────────────────────
  const interviewing = mode === "interview";
  const batchStep = batch ? BATCH_STEPS[batch.step] : null;
  const filledRows = Object.entries(draft).filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length));

  return <Card style={{ padding: 0, marginBottom: fullPage ? 0 : 14, overflow: "hidden", ...(fullPage ? { display: "flex", flexDirection: "column", height: isMobile ? "calc(100dvh - 190px)" : "calc(100vh - 150px)" } : {}) }}>
    {/* On its own page there is nothing to collapse into — the header is a
        title, not a switch. */}
    {fullPage
      ? <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 16px", flexShrink: 0 }}>
          <span style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 10, background: T.goldBg, display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ti ti-sparkles" style={{ fontSize: 17, color: T.gold }} /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>{t("inv.assistantTitle")}</span>
            <span style={{ display: "block", fontSize: 11.5, color: T.textMuted, marginTop: 1 }}>{t("inv.assistantSub")}</span>
          </span>
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
    {(open || fullPage) && <div style={{ borderTop: `1px solid ${T.border}`, padding: "12px 16px 14px", display: "flex", flexDirection: "column",
      ...(fullPage ? { flex: 1, minHeight: 0 } : { height: isMobile ? "min(70dvh, calc(100dvh - 240px))" : "min(560px, calc(100dvh - 300px))" }) }}>
      {/* The transcript is what gives way. The product being built and the box
          you type in keep their room; older messages scroll. */}
      <div style={{ flex: "1 1 auto", minHeight: 84, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
        {!msgs.length && <div style={{ padding: "6px 0 2px" }}>
          <div style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.65, marginBottom: 10 }}>
            {t("asst.intro", { n: products?.length || 0 })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(190px, 1fr))", gap: 8, marginBottom: 12 }}>
            {WAYS.map((w) => <button key={w} type="button" onClick={() => pickWay(w)} className="ui-btn ob-row"
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 13, textAlign: "left", cursor: "pointer", fontFamily: "inherit", minHeight: 52,
                background: w === "ask" ? T.goldBg : T.bgAlt, border: `1px solid ${w === "ask" ? T.gold : T.border}`, color: T.text }}>
              <i className={`ti ${WAY_ICON[w]}`} style={{ fontSize: 19, flexShrink: 0, color: T.gold }} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 600 }}>{t(`asst.way.${w}`)}</span>
                <span style={{ display: "block", fontSize: 11, color: T.textMuted, marginTop: 1 }}>{t(`asst.way.${w}Sub`)}</span>
              </span>
            </button>)}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {CHIP_KEYS.map((c) => <button key={c} type="button" onClick={() => ask(t(c))} className="ui-btn ob-chip"
              style={{ padding: "8px 12px", borderRadius: 20, fontSize: 12, background: T.bgAlt, border: `1px solid ${T.border}`, color: T.textMuted, cursor: "pointer", fontFamily: "inherit", minHeight: 36 }}>{t(c)}</button>)}
          </div>

          {/* The rest of the dashboard, from inside the conversation. Only on
              the assistant's own page — in the panel inside Inventory there is
              a sidebar two inches away and this would be clutter. */}
          {onGo && <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: .7, marginBottom: 8 }}>{t("asst.jump")}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {JUMPS.map((p) => <button key={p} type="button" onClick={() => onGo(p)} className="ui-btn ob-chip"
                /* 44px, not the 36 the other chips use: these are navigation,
                   and a mis-tap here throws the owner onto the wrong page. */
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 20, fontSize: 12, cursor: "pointer", fontFamily: "inherit", minHeight: 44,
                  fontWeight: p === "settings" ? 600 : 500,
                  background: p === "settings" ? T.goldBg : T.bgAlt, border: `1px solid ${p === "settings" ? T.gold : T.border}`, color: p === "settings" ? T.gold : T.textMuted }}>
                <i className={`ti ${JUMP_ICON[p]}`} style={{ fontSize: 15 }} />{t(`nav.${p}`)}
              </button>)}
            </div>
          </div>}
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
          {m.go && <Btn gold onClick={() => onImport?.(m.go)} disabled={busy} style={{ borderRadius: 20, minHeight: 40 }}>
            <i className={`ti ${WAY_ICON[m.go]}`} style={{ marginRight: 6 }} />{t("asst.rule.open")}
          </Btn>}

          {/* A question that can be skipped offers it under the question, not
              beside the message box: on a phone a button in that row squeezed
              the box you type in down to ninety-seven pixels. */}
          {/* Matched on WHICH step this message is, not on its wording —
              comparing the two sentences meant the chip disappeared the moment
              the language changed underneath it. */}
          {m.step !== undefined && batch?.step === m.step && BATCH_STEPS[m.step]?.skipKey && <button type="button" onClick={() => answerBatch("")} disabled={busy} className="ui-btn ob-chip"
            style={{ padding: "8px 13px", borderRadius: 20, fontSize: 12, background: T.bgAlt, border: `1px solid ${T.border}`, color: T.textMuted, cursor: "pointer", fontFamily: "inherit", minHeight: 40 }}>{t(BATCH_STEPS[m.step].skipKey, axis)}</button>}

          {m.choice === "count" && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn gold onClick={() => answerHowMany(false)} disabled={busy} style={{ borderRadius: 20, minHeight: 40 }}>
              <i className="ti ti-package" style={{ marginRight: 6 }} />{t("asst.count.one")}
            </Btn>
            <Btn onClick={() => answerHowMany(true)} disabled={busy} style={{ borderRadius: 20, minHeight: 40 }}>
              <i className="ti ti-photo-plus" style={{ marginRight: 6 }} />{t("asst.count.many")}
            </Btn>
          </div>}

          {m.photoUrls?.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: "88%" }}>
            {m.photoUrls.map((u) => <img key={u} src={u} alt="" style={{ width: 46, height: 46, objectFit: "cover", borderRadius: 9, border: `1px solid ${T.border}` }} />)}
          </div>}

          {m.actions?.length > 0 && <div style={{ width: "100%", borderRadius: 14, border: `1px solid ${T.border}`, background: T.card, padding: 12 }}>
            <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: .7, marginBottom: 9 }}>
              {t("asst.proposed")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {m.actions.map((a, ai) => {
                const d = describeAction(a, m.before?.[a.id]);
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
          {photos.length > 0 && <> · {t("asst.photoCount", { n: photos.length, size: fileSize(photos.reduce((a, p) => a + p.file.size, 0)), budget: fileSize(GALLERY_BUDGET) })}</>}
        </div>

        {/* The ref is on the wrapper, not the button: Btn is a plain function
            component and does not forward one. */}
        {gaps.ready && <div ref={saveRef} style={{ marginTop: 11, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn gold onClick={() => save()} disabled={busy || prepping} style={{ borderRadius: 11 }}>
            <i className="ti ti-check" style={{ marginRight: 6 }} />{t("asst.save", { name: draft.product_name })}
          </Btn>
          {/* Only after a save has actually been turned away. */}
          {refused && <Btn onClick={() => save(true)} disabled={busy || prepping} style={{ borderRadius: 11, background: T.warnBg, color: T.warn }}>{t("asst.addAnyway")}</Btn>}
        </div>}
      </div>}

      {err && <div style={{ fontSize: 12.5, color: T.danger, display: "flex", gap: 6, marginBottom: 8, flexShrink: 0 }}><i className="ti ti-alert-circle" style={{ fontSize: 15, flexShrink: 0 }} /><span>{err}</span></div>}

      <form ref={formRef} onSubmit={(e) => { e.preventDefault(); ask(input); }} style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        {interviewing && <>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy || prepping || photos.length >= MAX_PHOTOS}
            aria-label={t("asst.photo.attach")} title={photos.length >= MAX_PHOTOS ? t("asst.photo.full", { max: MAX_PHOTOS }) : t("asst.photo.attach")} className="ui-btn"
            style={{ width: 44, height: 44, flexShrink: 0, minHeight: 0, padding: 0, borderRadius: 12, background: T.bgAlt, border: `1px solid ${T.border}`, color: T.gold, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="ti ti-camera-plus" style={{ fontSize: 18 }} />
          </button>
        </>}
        <input value={input} onChange={(e) => setInput(e.target.value)} disabled={busy}
          placeholder={batchStep ? t(batchStep.phKey, axis) : t(interviewing ? "asst.ph.answer" : "asst.ph.chat")} aria-label={t("asst.aria")}
          className="ui-inp" style={{ flex: 1, minWidth: 0, background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 12, padding: "11px 14px", color: T.text, fontSize: 13, outline: "none", fontFamily: "inherit", boxShadow: T.nmIn }} />
        <Btn gold type="submit" disabled={busy || !input.trim()} aria-label={t("common.send")} style={{ borderRadius: 12, padding: "9px 16px", minHeight: 44 }}><i className="ti ti-send" style={{ fontSize: 16 }} /></Btn>
      </form>

      {/* Still reachable once the conversation has started, as a compact row —
          the full cards belong to the empty state, where there is room. */}
      {!interviewing && msgs.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9, flexShrink: 0 }}>
        {WAYS.map((w) => <button key={w} type="button" onClick={() => pickWay(w)} disabled={busy} className="ui-btn ob-chip"
          title={t(`asst.way.${w}Sub`)}
          style={{ padding: "7px 12px", borderRadius: 20, fontSize: 12, fontWeight: w === "ask" ? 600 : 500, cursor: "pointer", fontFamily: "inherit", minHeight: 36,
            background: w === "ask" ? T.goldBg : "none", border: `1px solid ${w === "ask" ? T.gold : T.border}`, color: w === "ask" ? T.gold : T.textMuted }}>
          <i className={`ti ${WAY_ICON[w]}`} style={{ marginRight: 5 }} />{t(w === "ask" ? "asst.way.askShort" : `asst.way.${w}`)}
        </button>)}
      </div>}
    </div>}
  </Card>;
}
