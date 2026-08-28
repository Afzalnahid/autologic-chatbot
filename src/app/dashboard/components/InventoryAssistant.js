"use client";
import { useState, useRef, useEffect } from "react";
import { T, Card, Btn, useIsMobile } from "./ui.js";
import { apiJson } from "./session.js";
import { describeAction, draftGaps, LABELS } from "@/lib/inventory-actions.js";
import { shrinkBatch, fileSize, GALLERY_BUDGET } from "@/lib/shrink-image.js";
import { dropRepeats, fingerprint } from "@/lib/photo-fingerprint.js";
import { buildVariants } from "@/lib/variants.js";

// Look after the catalogue by talking to it — and add to it the same way.
//
// The owner is not a programmer and does not want to be. "How many box t-shirts
// are left", "the winter jackets are 1200 now", "we are out of the black polo" —
// each of those is one sentence, and each of them was a hunt through a grid, a
// drawer, a field and a save button.
//
// The panel does two jobs.
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
// The draft is held here and sent with every turn, not remembered by the model.
// What can be saved is decided by draftGaps, not by the assistant saying it
// thinks it is finished.

const CHIPS = [
  "What is running low?",
  "Which products have no price?",
  "How many products are out of stock?",
];

// Every way into the catalogue, offered from the one place the owner is already
// talking. The panel used to offer only the interview, so someone sitting in the
// chat with a spreadsheet in front of them had to close it, find the Import
// menu and start again — the chat looked like it could only do one product at a
// time, which is exactly what it looked like to the owner.
//
// The four imports open the sheets that already do that work rather than a
// second copy of them living in here. One implementation, two doors to it.
const WAYS = [
  { id: "ask", icon: "ti-messages", label: "I’ll ask you the questions", sub: "One product, in your own words" },
  { id: "photos", icon: "ti-photo-plus", label: "Many at once, from photos", sub: "Front and back of the same one are gathered" },
  { id: "csv", icon: "ti-table", label: "A spreadsheet", sub: "Hundreds at once, from a CSV" },
  { id: "url", icon: "ti-link", label: "A product link", sub: "We read the page for you" },
  { id: "woo", icon: "ti-brand-wordpress", label: "WooCommerce", sub: "Bring your whole shop over" },
];

const MAX_PHOTOS = 12;
const emptyDraft = () => ({});

export default function InventoryAssistant({ products, refresh, startSignal = 0, onImport }) {
  const isMobile = useIsMobile();
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
    // and scrolling the page the moment somebody lands on Inventory is movement
    // for nothing. A count rather than a "first run" flag on purpose: React runs
    // effects twice on mount in development, and a flag gets used up by the
    // first of those and lets the second one jump the page anyway.
    if (!msgs.length) return;
    const t = setTimeout(() => {
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
    return () => clearTimeout(t);
  }, [open, mode, msgs.length, photos.length]);
  useEffect(() => () => blobs.current.forEach(URL.revokeObjectURL), []);
  // Started from outside the panel — the toolbar button, or the empty state.
  useEffect(() => { if (startSignal > 0) { setOpen(true); startInterview(); } }, [startSignal]);

  const gaps = draftGaps(draft, photos.length);
  // The moment the product becomes saveable, put the button where the owner can
  // see it. The panel is tall by then, and a Save button that appears below the
  // fold is a Save button nobody presses.
  useEffect(() => { if (gaps.ready) saveRef.current?.scrollIntoView({ block: "nearest" }); }, [gaps.ready]);

  // ── Asking ─────────────────────────────────────────────────────────────────
  const ask = async (text) => {
    const q = String(text || "").trim();
    if (!q || busy) return;
    setErr(""); setInput("");
    // Mid-batch the answers are the wizard's, not the model's. No request goes
    // anywhere: these three questions have fixed answers and asking an AI what
    // "box t-shirt" means would be a cost and a wait for nothing.
    if (batch) return answerBatch(q);
    // The question goes on screen before the request leaves, so the panel never
    // sits blank while a slow answer is on its way.
    const history = [...msgs, { role: "user", content: q, phase: mode }];
    setMsgs(history);
    if (mode === "interview") return turn(history);

    setBusy(true);
    const r = await apiJson("/api/inventory-chat", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: history.filter((m) => m.phase === "chat").map((m) => ({ role: m.role, content: m.content })) }),
    });
    setBusy(false);
    if (r.error) { setErr(r.error); return; }
    setMsgs((s) => [...s, {
      role: "assistant", phase: "chat", content: r.reply,
      actions: r.actions || [], before: r.before || {},
      // Every proposal starts ticked: the owner reads them and unticks what is
      // wrong, rather than having to tick things one at a time to get anywhere.
      picked: (r.actions || []).map(() => true),
    }]);
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

  // ── Being asked ────────────────────────────────────────────────────────────
  const startInterview = () => {
    setMode("interview"); setDraft(emptyDraft()); setPhotos([]); setVisual(""); setSaved(""); setErr(""); setDup(null); setRefused(false); seenPhotos.current = new Set();
    const start = [...msgs, { role: "user", content: "I want to add a product.", phase: "interview" }];
    setMsgs(start);
    turn(start, {}, 0, "");
  };

  // "I'll ask you the questions" is this panel's own job; the other four open
  // the sheet that already does that import. An interview in progress is left
  // exactly as it is — the sheet sits on top and the draft is still here
  // underneath when it closes.
  const pickWay = (id) => {
    if (id === "ask") { askHowMany(); return; }
    // Many photos is a batch, so it goes through the same three questions —
    // the chat's job is to ask them. Advanced → "Many photos at once" is the
    // way straight into the sheet for somebody who does not want to be asked.
    if (id === "photos") { startBatch(); return; }
    onImport?.(id);
  };

  // Between "how do you want to add them" and the first question about a
  // product there is one more thing worth knowing, and getting it wrong is
  // expensive: an owner with fifteen shirts should not be interviewed about the
  // first one. Asked as two buttons rather than a sentence, because it has
  // exactly two answers.
  const askHowMany = () => {
    setErr("");
    setMsgs((s) => [...s,
      { role: "user", phase: "chat", content: "I want to add products." },
      { role: "assistant", phase: "chat", actions: [], choice: "count",
        content: "Is it one product, or several at once?" },
    ]);
  };

  const answerHowMany = (many) => {
    setMsgs((s) => s.map((m) => m.choice === "count" ? { ...m, choice: null } : m));
    setMsgs((s) => [...s, { role: "user", phase: "chat", content: many ? "Several." : "Just one." }]);
    if (many) startBatch();
    else startInterview();
  };

  // ── Many at once: ask what they have in common, once ───────────────────────
  // Fifteen shirts off one rail share a kind, a price and a set of sizes. Asked
  // once here, they are on every product before the owner sees a single row —
  // instead of being typed fifteen times, or set with a bulk bar the owner has
  // to find. These three questions are scripted, not put to the model: they are
  // always the same three, and an AI call to ask "what are these?" would be a
  // cost and a wait for nothing.
  const BATCH_STEPS = [
    { key: "kind", ask: "What kind of thing are these? One answer for all of them — “box t-shirt”, “panjabi”, “phone case”.", placeholder: "e.g. Box T-shirt" },
    { key: "price", ask: "Same price for all of them? Type the price, or say “different”.", placeholder: "e.g. 500", skip: "They are different" },
    { key: "options", ask: "What sizes or colours do they come in? Type them separated by commas, or skip.", placeholder: "e.g. M, L, XL", skip: "No sizes or colours" },
  ];

  const startBatch = () => {
    setBatch({ step: 0, kind: "", price: "", options: "" });
    setMsgs((s) => [...s, { role: "assistant", phase: "batch", actions: [], content: BATCH_STEPS[0].ask, skip: BATCH_STEPS[0].skip }]);
  };

  const answerBatch = (raw) => {
    const b = batch;
    if (!b) return;
    const step = BATCH_STEPS[b.step];
    const value = String(raw ?? "").trim();
    const next = { ...b, [step.key]: value, step: b.step + 1 };
    setBatch(next);
    setMsgs((s) => [...s, { role: "user", phase: "batch", content: value || `(${step.skip || "skipped"})` }]);

    if (next.step < BATCH_STEPS.length) {
      setMsgs((s) => [...s, { role: "assistant", phase: "batch", actions: [], content: BATCH_STEPS[next.step].ask, skip: BATCH_STEPS[next.step].skip }]);
      return;
    }
    // Everything they share is known. Now the photos, in the sheet that groups
    // them — carrying the answers, so nothing is asked twice.
    const price = /^[\d.,\s]+$/.test(next.price) ? next.price.replace(/[^\d.]/g, "") : "";
    setMsgs((s) => [...s, { role: "assistant", phase: "batch", actions: [],
      content: `Good. Now add every photo of your ${next.kind || "products"} — front, back, close-ups, all of them together. I will work out which pictures belong to the same one and name each by what makes it different.` }]);
    setBatch(null);
    onImport?.("photos", { kind: next.kind, price, category: next.kind, sizes: next.options });
  };

  const stopInterview = () => {
    setMode("chat"); setDraft(emptyDraft()); setPhotos([]); setVisual("");
    setMsgs((s) => [...s, { role: "assistant", phase: "chat", content: "Stopped. Nothing was added.", actions: [] }]);
  };

  // One turn of the interview. The draft, the photo count and the vision text
  // are passed explicitly rather than read from state, because a turn is often
  // fired in the same tick as the setState that produced them.
  const turn = async (history, d = draft, n = photos.length, v = visual) => {
    setBusy(true); setErr("");
    const r = await apiJson("/api/product-interview", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: history.filter((m) => m.phase === "interview").map((m) => ({ role: m.role, content: m.content })),
        draft: d, photos: n, visual: v,
      }),
    });
    setBusy(false);
    if (r.error) { setErr(r.error); return; }
    setDraft(r.draft || d);
    // Surfaced as soon as the name is known, so the owner is not told at the
    // last moment that the thing they just described is already in the shop.
    setDup(r.duplicate ? { ...r.duplicate, message: r.duplicateMessage } : null);
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

    const said = [`Added ${fresh.length} photo${fresh.length === 1 ? "" : "s"}.`];
    if (repeats.length) said.push(`${repeats.length} ${repeats.length === 1 ? "was the same picture" : "were pictures already here"} — skipped.`);
    if (overflow) said.push(`${overflow} did not fit: one product holds ${MAX_PHOTOS}.`);
    const line = { role: "user", content: said.join(" "), phase: "interview", photoUrls: fresh.map((p) => p.u) };
    const history = [...msgs, line];
    setMsgs(history);

    // Photos that would not fit usually means these are not all one product.
    // Saying so is more use than a silent truncation.
    if (overflow) setMsgs((s) => [...s, { role: "assistant", phase: "interview", actions: [],
      content: `${overflow} photo${overflow === 1 ? "" : "s"} could not go on this product — twelve is the most one product can have. If those are different products, press “Many photos” below and add them together instead.` }]);

    // Only the first photo is read. It is the one the bot shows and the one a
    // customer's picture is matched against — the same rule /api/add-product
    // has always followed — so reading the other five would be five calls
    // spent on descriptions nothing ever looks at.
    let v = visual, d = draft;
    if (!visual && next.length) {
      const fd = new FormData();
      fd.append("images", next[0].file);
      const rr = await apiJson("/api/photo-draft", { method: "POST", body: fd });
      const got = rr.drafts?.[0];
      if (got?.visual) {
        v = got.visual; setVisual(v);
        // Suggestions fill only what is still blank. The owner may already have
        // typed the name, and a machine must not talk over them.
        d = { ...draft };
        for (const k of ["product_name", "category", "description"]) if (!d[k] && got[k]) d[k] = got[k];
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
    // The description the AI already produced from the first photo, so vision
    // does not run a second time on a picture it has read.
    if (visual) fd.append("visual", visual);
    photos.forEach((p) => fd.append("images", p.file));
    fd.append("image_urls", JSON.stringify(photos.map((_, i) => `upload:${i}`)));

    const r = await apiJson("/api/add-product", { method: "POST", body: fd });
    setBusy(false);
    // A duplicate is a question, not a failure. It is said in the conversation
    // rather than as a red line under the box, because the whole point of this
    // panel is that it talks — and the draft stays exactly where it was.
    if (r.duplicate) {
      setDup({ ...r.duplicate, message: r.error });
      setRefused(true);
      setMsgs((s) => [...s, { role: "assistant", phase: "interview", content: `${r.error} Press “Add anyway” if this really is a different one.`, actions: [] }]);
      return;
    }
    if (r.error) { setErr(r.error); return; }
    const name = draft.product_name;
    setMode("chat"); setDraft(emptyDraft()); setPhotos([]); setVisual("");
    setSaved(name);
    setMsgs((s) => [...s, { role: "assistant", phase: "chat", content: `Added “${name}”${r.analyzeError ? " — but the photo could not be read, so customers cannot find it by sending a picture." : "."} Say “add another” whenever you are ready.`, actions: [] }]);
    refresh?.();
  };

  // ── Rendering ──────────────────────────────────────────────────────────────
  const interviewing = mode === "interview";
  const batchStep = batch ? BATCH_STEPS[batch.step] : null;
  const filledRows = Object.entries(draft).filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length));

  return <Card style={{ padding: 0, marginBottom: 14, overflow: "hidden" }}>
    <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="ui-btn"
      style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "13px 16px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", color: T.text, textAlign: "left", minHeight: 44 }}>
      <span style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 10, background: T.goldBg, display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ti ti-message-2-bolt" style={{ fontSize: 17, color: T.gold }} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>Add and manage products by chatting</span>
        <span style={{ display: "block", fontSize: 11.5, color: T.textMuted, marginTop: 1 }}>Answer a few questions to add one, or just say what to change. Nothing happens until you press the button.</span>
      </span>
      <i className={`ti ti-chevron-${open ? "up" : "down"}`} style={{ fontSize: 16, color: T.textMuted, flexShrink: 0 }} />
    </button>

    {/* Laid out like the Inbox: the panel is a fixed height, the transcript is
        the only part that grows, and the box you type in is pinned to the
        bottom of it. It used to be an ordinary stack in the page, so every
        answer pushed the input further down and it ended up below the fold —
        the owner was typing into something they could not see. */}
    {open && <div style={{ borderTop: `1px solid ${T.border}`, padding: "12px 16px 14px", display: "flex", flexDirection: "column",
      height: isMobile ? "min(70dvh, calc(100dvh - 240px))" : "min(560px, calc(100dvh - 300px))" }}>
      {/* The transcript is what gives way. The product being built and the box
          you type in keep their room; older messages scroll. */}
      <div style={{ flex: "1 1 auto", minHeight: 84, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
        {!msgs.length && <div style={{ padding: "6px 0 2px" }}>
          <div style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.65, marginBottom: 10 }}>
            Add products any of these ways, or ask about the {products?.length || 0} already here — “the winter jackets are 1200 now”, “we are out of the black polo”.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(190px, 1fr))", gap: 8, marginBottom: 12 }}>
            {WAYS.map((w) => <button key={w.id} type="button" onClick={() => pickWay(w.id)} className="ui-btn ob-row"
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 13, textAlign: "left", cursor: "pointer", fontFamily: "inherit", minHeight: 52,
                background: w.id === "ask" ? T.goldBg : T.bgAlt, border: `1px solid ${w.id === "ask" ? T.gold : T.border}`, color: T.text }}>
              <i className={`ti ${w.icon}`} style={{ fontSize: 19, flexShrink: 0, color: T.gold }} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 600 }}>{w.label}</span>
                <span style={{ display: "block", fontSize: 11, color: T.textMuted, marginTop: 1 }}>{w.sub}</span>
              </span>
            </button>)}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {CHIPS.map((c) => <button key={c} type="button" onClick={() => ask(c)} className="ui-btn ob-chip"
              style={{ padding: "8px 12px", borderRadius: 20, fontSize: 12, background: T.bgAlt, border: `1px solid ${T.border}`, color: T.textMuted, cursor: "pointer", fontFamily: "inherit", minHeight: 36 }}>{c}</button>)}
          </div>
        </div>}

        {msgs.map((m, mi) => <div key={mi} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", gap: 8 }}>
          <div style={{ maxWidth: "88%", padding: "9px 13px", borderRadius: 14, fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap",
            background: m.role === "user" ? T.goldBg : T.bgAlt, color: m.role === "user" ? T.gold : T.text, boxShadow: m.role === "user" ? "none" : T.nmIn }}>{m.content}</div>

          {/* A question that can be skipped offers it under the question, not
              beside the message box: on a phone a button in that row squeezed
              the box you type in down to ninety-seven pixels. */}
          {m.skip && batchStep?.skip === m.skip && <button type="button" onClick={() => answerBatch("")} disabled={busy} className="ui-btn ob-chip"
            style={{ padding: "8px 13px", borderRadius: 20, fontSize: 12, background: T.bgAlt, border: `1px solid ${T.border}`, color: T.textMuted, cursor: "pointer", fontFamily: "inherit", minHeight: 40 }}>{m.skip}</button>}

          {m.choice === "count" && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn gold onClick={() => answerHowMany(false)} disabled={busy} style={{ borderRadius: 20, minHeight: 40 }}>
              <i className="ti ti-package" style={{ marginRight: 6 }} />Just one
            </Btn>
            <Btn onClick={() => answerHowMany(true)} disabled={busy} style={{ borderRadius: 20, minHeight: 40 }}>
              <i className="ti ti-photo-plus" style={{ marginRight: 6 }} />Several — I have their photos
            </Btn>
          </div>}

          {m.photoUrls?.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: "88%" }}>
            {m.photoUrls.map((u) => <img key={u} src={u} alt="" style={{ width: 46, height: 46, objectFit: "cover", borderRadius: 9, border: `1px solid ${T.border}` }} />)}
          </div>}

          {m.actions?.length > 0 && <div style={{ width: "100%", borderRadius: 14, border: `1px solid ${T.border}`, background: T.card, padding: 12 }}>
            <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: .7, marginBottom: 9 }}>
              Proposed — nothing has changed yet
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
                  <span>{m.done.ok} change{m.done.ok === 1 ? "" : "s"} saved{m.done.failed.length ? `, ${m.done.failed.length} could not be: ${m.done.failed.map((f) => f.error).join(", ")}` : ""}.</span>
                </div>
              : <div style={{ display: "flex", gap: 8, marginTop: 11, flexWrap: "wrap" }}>
                  <Btn gold onClick={() => apply(mi)} disabled={busy || !m.picked.some(Boolean)} style={{ borderRadius: 11 }}>
                    Apply {m.picked.filter(Boolean).length} change{m.picked.filter(Boolean).length === 1 ? "" : "s"}
                  </Btn>
                  <Btn small onClick={() => discard(mi)} disabled={busy} style={{ borderRadius: 11 }}>Discard</Btn>
                </div>}
          </div>}

          {m.dropped && <div style={{ fontSize: 12, color: T.textDim }}>Discarded — nothing was changed.</div>}
        </div>)}

        {busy && <div style={{ fontSize: 12.5, color: T.textMuted, display: "flex", gap: 7, alignItems: "center" }}><i className="ti ti-loader-2" style={{ fontSize: 15 }} />{interviewing ? "Writing it down…" : "Thinking…"}</div>}
        {prepping && <div style={{ fontSize: 12.5, color: T.textMuted, display: "flex", gap: 7, alignItems: "center" }}><i className="ti ti-loader-2" style={{ fontSize: 15 }} />Preparing photos…</div>}
        {saved && !interviewing && <div style={{ fontSize: 12.5, color: T.success, display: "flex", gap: 6 }}><i className="ti ti-check" style={{ fontSize: 15 }} />“{saved}” is in your catalogue.</div>}
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
          <span style={{ flex: 1, fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: .7 }}>New product — not saved yet</span>
          <button type="button" onClick={stopInterview} disabled={busy} className="ui-btn" style={{ background: "none", border: "none", color: T.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "inherit", minHeight: 44, minWidth: 60, padding: "0 6px" }}>Cancel</button>
        </div>

        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: photos.length ? 11 : 0 }}>
          {photos.map((p, i) => <div key={p.id} style={{ position: "relative", width: TH, height: TH }}>
            <img src={p.u} alt="" onClick={() => makeFirst(p.id)} title={i === 0 ? "Customers see this one" : "Make this the first one"}
              style={{ width: TH, height: TH, objectFit: "cover", borderRadius: 12, cursor: "pointer", border: `2px solid ${i === 0 ? T.gold : T.border}` }} />
            {i === 0 && <span style={{ position: "absolute", left: 4, bottom: 4, fontSize: 9.5, fontWeight: 700, padding: "2px 6px", borderRadius: 6, background: T.gold, color: "#fff" }}>1st</span>}
            {/* On a phone the target is 44px and sits wholly inside the tile;
                on a desktop it is a small cross overhanging the corner. */}
            <button type="button" onClick={() => dropPhoto(p.id)} aria-label={`Remove photo ${i + 1}`} className="ui-btn"
              style={{ position: "absolute", top: isMobile ? 0 : -7, right: isMobile ? 0 : -7, width: X, height: X, minHeight: 0, padding: 0,
                background: "none", border: "none", color: T.danger, cursor: "pointer",
                display: "flex", alignItems: "flex-start", justifyContent: "flex-end", fontSize: 12 }}>
              <span style={{ width: 22, height: 22, margin: isMobile ? 6 : 0, borderRadius: 11, background: T.card, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ti ti-x" /></span>
            </button>
          </div>)}
        </div>

        {filledRows.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {filledRows.map(([k, v]) => <span key={k} style={{ fontSize: 11.5, padding: "5px 10px", borderRadius: 9, background: T.bgAlt, color: T.text, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <span style={{ color: T.textDim }}>{LABELS[k] || k}: </span>
            {k === "options" ? v.map((o) => `${o.name} (${o.values.join(", ")})`).join("; ") : Array.isArray(v) ? v.join(", ") : String(v)}
          </span>)}
        </div>}

        {dup?.message && <div style={{ display: "flex", gap: 7, alignItems: "flex-start", padding: "9px 11px", borderRadius: 11, background: T.warnBg, color: T.warn, fontSize: 12, lineHeight: 1.55, marginBottom: 10 }}>
          <i className="ti ti-alert-triangle" style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} />
          <span>{dup.message}</span>
        </div>}

        <div style={{ fontSize: 11.5, color: gaps.blocking.length ? T.textMuted : T.textDim, lineHeight: 1.6 }}>
          {gaps.blocking.length
            ? <>Still needed before this can be saved: <strong style={{ color: T.text }}>{gaps.blocking.map((k) => LABELS[k]).join(", ")}</strong>.</>
            : gaps.wanted.length
              ? <>Ready to save. <strong style={{ color: T.warn }}>{gaps.wanted.map((k) => LABELS[k]).join(" and ")}</strong> {gaps.wanted.length > 1 ? "are" : "is"} not set — you can add {gaps.wanted.length > 1 ? "them" : "it"} now or save without.</>
              : "Everything is filled in."}
          {photos.length > 0 && <> · {photos.length} photo{photos.length > 1 ? "s" : ""}, {fileSize(photos.reduce((a, p) => a + p.file.size, 0))} of {fileSize(GALLERY_BUDGET)}</>}
        </div>

        {/* The ref is on the wrapper, not the button: Btn is a plain function
            component and does not forward one. */}
        {gaps.ready && <div ref={saveRef} style={{ marginTop: 11, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn gold onClick={() => save()} disabled={busy || prepping} style={{ borderRadius: 11 }}>
            <i className="ti ti-check" style={{ marginRight: 6 }} />Save “{draft.product_name}”
          </Btn>
          {/* Only after a save has actually been turned away. */}
          {refused && <Btn onClick={() => save(true)} disabled={busy || prepping} style={{ borderRadius: 11, background: T.warnBg, color: T.warn }}>Add anyway</Btn>}
        </div>}
      </div>}

      {err && <div style={{ fontSize: 12.5, color: T.danger, display: "flex", gap: 6, marginBottom: 8, flexShrink: 0 }}><i className="ti ti-alert-circle" style={{ fontSize: 15, flexShrink: 0 }} /><span>{err}</span></div>}

      <form ref={formRef} onSubmit={(e) => { e.preventDefault(); ask(input); }} style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        {interviewing && <>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy || prepping || photos.length >= MAX_PHOTOS}
            aria-label="Attach photos" title={photos.length >= MAX_PHOTOS ? `${MAX_PHOTOS} photos is the most one product can have` : "Attach photos of this product"} className="ui-btn"
            style={{ width: 44, height: 44, flexShrink: 0, minHeight: 0, padding: 0, borderRadius: 12, background: T.bgAlt, border: `1px solid ${T.border}`, color: T.gold, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="ti ti-camera-plus" style={{ fontSize: 18 }} />
          </button>
        </>}
        <input value={input} onChange={(e) => setInput(e.target.value)} disabled={busy}
          placeholder={batchStep ? batchStep.placeholder : interviewing ? "Type your answer…" : "Ask, or say what to change…"} aria-label="Message the assistant"
          className="ui-inp" style={{ flex: 1, minWidth: 0, background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 12, padding: "11px 14px", color: T.text, fontSize: 13, outline: "none", fontFamily: "inherit", boxShadow: T.nmIn }} />
        <Btn gold type="submit" disabled={busy || !input.trim()} aria-label="Send" style={{ borderRadius: 12, padding: "9px 16px", minHeight: 44 }}><i className="ti ti-send" style={{ fontSize: 16 }} /></Btn>
      </form>

      {/* Still reachable once the conversation has started, as a compact row —
          the full cards belong to the empty state, where there is room. */}
      {!interviewing && msgs.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9, flexShrink: 0 }}>
        {WAYS.map((w) => <button key={w.id} type="button" onClick={() => pickWay(w.id)} disabled={busy} className="ui-btn ob-chip"
          title={w.sub}
          style={{ padding: "7px 12px", borderRadius: 20, fontSize: 12, fontWeight: w.id === "ask" ? 600 : 500, cursor: "pointer", fontFamily: "inherit", minHeight: 36,
            background: w.id === "ask" ? T.goldBg : "none", border: `1px solid ${w.id === "ask" ? T.gold : T.border}`, color: w.id === "ask" ? T.gold : T.textMuted }}>
          <i className={`ti ${w.icon}`} style={{ marginRight: 5 }} />{w.id === "ask" ? "Add — I’ll ask" : w.label}
        </button>)}
      </div>}
    </div>}
  </Card>;
}
