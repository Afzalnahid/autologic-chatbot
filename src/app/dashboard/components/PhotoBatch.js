"use client";
import { useState, useEffect, useRef } from "react";
import { T, Card, Btn, Inp } from "./ui.js";
import { apiJson } from "./session.js";
import { shrinkImage, fileSize } from "@/lib/shrink-image.js";
import { dropRepeats } from "@/lib/photo-fingerprint.js";
import { missingToSell } from "@/lib/readiness.js";
import { buildVariants } from "@/lib/variants.js";

// Turn a folder of photos into products.
//
// The shop this was written for photographs fifteen box t-shirts and then tries
// to add them. The only bulk route was a CSV, which nobody has, so the
// alternative was opening the drawer fifteen times — and the shape of the form
// quietly invited the wrong thing instead: dropping all fifteen shirts into ONE
// product's gallery, where they become fifteen pictures of a single item and
// the bot can only ever offer one of them.
//
// It began as one photo, one product. That is right for a rack of different
// shirts and wrong for the way shops actually photograph: a front, a back and a
// close-up of the print, of every shirt. Forty photos are not forty products.
//
// So the AI reads every photograph, proposes a name, a category and a sentence
// — and then says which photographs are the SAME thing. The owner sees products
// with their pictures already gathered, and moves anything that landed wrong:
// one photo out into its own product, or a whole product up into the one above.
// The grouping is told to be cautious, because leaving two pictures apart costs
// a click and merging two different shirts loses a product.
//
// That reading costs nothing extra: vision already ran on every new product at
// save time, so it runs HERE instead and the description travels back with the
// draft as `visual`, which the save skips over. One photo, one vision call — as
// it always was — plus two cheap text calls for the whole batch, one to name
// them and one to group them.
//
// Each product is then saved by its own request to /api/add-product, with its
// whole gallery. That is deliberate and it is what makes the batch reliable:
// the request-size limit cannot be reached by one product's photos, a failure
// names the row it belongs to instead of losing the lot, and the progress line
// is honest because it reflects work that has actually finished.

const CELL = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 10px", color: T.text, fontSize: 13, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box", minWidth: 0 };
const COLS = "76px minmax(0,1.7fr) 96px minmax(0,1.1fr) 74px 44px 44px";
// 44px is the smallest square a thumb reliably hits. The variant photo button
// shipped at 37px once and had to be fixed after the fact; these start there.
const ICON_BTN = { width: 44, height: 44, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", borderRadius: 11, cursor: "pointer", fontSize: 16, padding: 0, minHeight: 0 };

// What one request to /api/photo-draft may carry. Six is the server's cap; the
// byte budget is what actually matters, because the platform refuses anything
// over ~4.5 MB at the edge before our code ever runs.
const READ_MAX = 6;
const READ_BUDGET = 3_200_000;
// One product's gallery. resolveGallery on the server keeps twelve, so keeping
// more here would only lose them quietly at the far end.
const MAX_PER_PRODUCT = 12;
const MAX_PHOTOS = 90;

let seq = 0;
const nextId = () => `d${Date.now().toString(36)}${(seq++).toString(36)}`;
const splitList = (s) => String(s || "").split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

// "Size" and "Colour" are the two axes a shop in this market actually uses, so
// they are two plain boxes rather than the drawer's full option builder. Any
// other axis is still available by opening the product afterwards.
const optionsOf = (d) => [
  { name: "Size", values: splitList(d.sizes) },
  { name: "Colour", values: splitList(d.colours) },
].filter((o) => o.values.length);

// A product being built: one or more photographs, and the fields they will be
// saved with. The FIRST photo is the one the bot shows and the one the AI read.
const blank = (photos) => ({
  id: nextId(), photos,
  product_name: "", regular_price: "", category: "", stock_qty: "",
  description: "", visual: "", sizes: "", colours: "",
  // What the last read proposed, so a second read can replace its own words
  // without touching the owner's.
  ai: null,
  open: false, readErr: null,
});

export default function PhotoBatchSheet({ isMobile, categories = [], onClose, onDone }) {
  const [drafts, setDrafts] = useState([]);
  const [base, setBase] = useState("");
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkCat, setBulkCat] = useState("");
  const [bulkSizes, setBulkSizes] = useState("");
  const [bulkColours, setBulkColours] = useState("");
  const [prepping, setPrepping] = useState(false);
  const [reading, setReading] = useState(null); // {done, total}
  const [readNote, setReadNote] = useState("");
  // Things that happened while taking the photos in — repeats skipped, more
  // than fit. Kept apart from `err` because nothing went wrong, and because
  // reading clears `err` a moment later.
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  // Five boxes stacked one under another fill a phone screen completely, so the
  // owner scrolls past the whole thing before seeing a single product. On a
  // phone it starts folded; on a desktop it is three across and costs nothing.
  const [bulkOpen, setBulkOpen] = useState(!isMobile);
  const fileRef = useRef(null);
  // Every preview URL ever made, released together when the sheet goes away.
  // Deliberately not released when a photo is removed or a product is split:
  // the same file may still be on screen in another row.
  const blobs = useRef([]);
  const preview = (file) => { const u = URL.createObjectURL(file); blobs.current.push(u); return u; };
  // Fingerprints of every photo already taken, so the same folder chosen twice
  // does not produce the same product twice.
  const seenPhotos = useRef(new Set());
  // How many photos the last grouping moved onto another product. See group().
  const joinedRef = useRef(0);

  useEffect(() => { const k = (e) => { if (e.key === "Escape" && !busy) onClose(); }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [busy, onClose]);
  useEffect(() => () => blobs.current.forEach(URL.revokeObjectURL), []);

  const patch = (id, p) => setDrafts((s) => s.map((d) => d.id === id ? { ...d, ...p } : d));
  const drop = (id) => setDrafts((s) => s.filter((x) => x.id !== id));

  const photoCount = drafts.reduce((a, d) => a + d.photos.length, 0);
  const totalBytes = drafts.reduce((a, d) => a + d.photos.reduce((n, p) => n + p.file.size, 0), 0);

  const add = async (list) => {
    const picked = [...list].filter((x) => x.type?.startsWith("image/"));
    if (!picked.length) return;
    setErr(""); setNotice(""); setPrepping(true);
    // Each photo is shrunk on its own, at full quality: a product's gallery
    // leaves in its own request, so one large photo cannot push another over
    // the limit and there is nothing to be gained by shrinking them together.
    const ready = await Promise.all(picked.map((f) => shrinkImage(f)));
    // The same picture chosen twice is not two products. Caught before anything
    // is read or uploaded, so it costs nothing.
    const { fresh: unique, repeats } = await dropRepeats(ready, seenPhotos.current);
    setPrepping(false);

    const room = Math.max(0, MAX_PHOTOS - photoCount);
    const taken = unique.slice(0, room);
    const over = unique.length - taken.length;
    if (!taken.length) {
      setErr(repeats.length ? "Those photos are already here." : `That is more than ${MAX_PHOTOS} photos. Add them in two goes.`);
      return;
    }
    // Not an error — nothing went wrong and nothing was lost. It also cannot go
    // in `err`, because the read that starts on the next line clears that, and
    // the notice would vanish before anyone read it.
    setNotice([
      repeats.length ? `${repeats.length} photo${repeats.length === 1 ? " was" : "s were"} already here and ${repeats.length === 1 ? "was" : "were"} skipped.` : "",
      over ? `${over} did not fit — ${MAX_PHOTOS} photos is the most in one go.` : "",
    ].filter(Boolean).join(" "));

    // Every photo starts as its own product. The AI proposes the grouping after
    // it has read them, and starting apart is the safe direction: an owner sees
    // more rows than they expected, not fewer products than they have.
    const fresh = taken.map((file) => blank([{ id: nextId(), file, u: preview(file) }]));
    setDrafts((s) => [...s, ...fresh]);
    read(fresh, [...drafts, ...fresh]);
  };

  // ── Reading, then grouping ────────────────────────────────────────────────
  // Photos go up a few at a time, small enough that the platform lets the
  // request through. Only the FIRST photo of a product is read — it is the one
  // the bot shows and the one a customer's picture is matched against, so
  // reading the rest would be calls spent on descriptions nothing looks at.
  const read = async (targets, allDrafts) => {
    const list = targets.filter((d) => d.photos[0]?.file);
    if (!list.length) return;
    setReadNote(""); setErr("");
    let done = 0, failed = 0, nameErr = "";
    setReading({ done: 0, total: list.length });
    const readVisuals = new Map();

    for (let i = 0; i < list.length;) {
      const chunk = [];
      let bytes = 0;
      while (i < list.length && chunk.length < READ_MAX && bytes + list[i].photos[0].file.size <= READ_BUDGET) {
        bytes += list[i].photos[0].file.size; chunk.push(list[i]); i++;
      }
      // One photo bigger than the whole budget: send it alone rather than loop
      // forever refusing to fit it.
      if (!chunk.length) { chunk.push(list[i]); i++; }

      const fd = new FormData();
      for (const d of chunk) fd.append("images", d.photos[0].file);
      if (base.trim()) fd.append("hint", base.trim());
      if (categories.length) fd.append("categories", categories.join("\n"));

      const r = await apiJson("/api/photo-draft", { method: "POST", body: fd });
      if (r.error) {
        setReading(null);
        setErr(`${r.error} — the photos are still here, you can type the details yourself.`);
        return;
      }
      const answers = new Map(chunk.map((d, n) => [d.id, r.drafts?.[n] || {}]));
      for (const [id, got] of answers) {
        if (got.error) failed++; else done++;
        readVisuals.set(id, got.visual || "");
      }
      // The photos were read but the naming step failed. Saying "read 15
      // photos" over fifteen empty name boxes would be a lie.
      if (r.nameError) nameErr = r.nameError;
      // Written back by id — a slow chunk cannot land on the wrong row if the
      // owner has been deleting rows meanwhile — and never over a person's own
      // words. `ai` remembers what the last read proposed, so reading again
      // (after typing a base name, say) replaces what the machine wrote and
      // leaves what the owner typed exactly where it is.
      setDrafts((s) => s.map((x) => {
        const got = answers.get(x.id);
        if (!got) return x;
        const keep = (field) => {
          const next = got[field] || "";
          if (!next) return x[field];
          return (!x[field] || x[field] === x.ai?.[field]) ? next : x[field];
        };
        return {
          ...x, readErr: got.error || null, visual: got.visual || x.visual,
          product_name: keep("product_name"), category: keep("category"), description: keep("description"),
          ai: { product_name: got.product_name || "", category: got.category || "", description: got.description || "" },
        };
      }));
      setReading({ done: Math.min(i, list.length), total: list.length });
    }

    setReading(null);
    let joined = 0;
    if (done > 1) joined = await group(list, readVisuals, allDrafts);

    if (nameErr) setReadNote(`Read ${done} photo${done > 1 ? "s" : ""}, but naming them failed (${nameErr}). The photos are understood — type the names yourself, or use “Name all” above.`);
    else if (done && !failed) setReadNote(`Read ${done} photo${done > 1 ? "s" : ""}${joined ? `, and put ${joined} of them with photos of the same product` : ""}. Check everything below — move a photo out with ${"↗"} if it landed on the wrong product.`);
    else if (done && failed) setReadNote(`Read ${done}, but ${failed} could not be read. Type those in yourself.`);
    else if (failed) setErr(`None of the ${failed} photos could be read. You can still type the details in yourself.`);
  };

  // Asks which of the descriptions are the same product, then folds the rows
  // that agree into one. Returns how many photos were joined onto another
  // product, which is what the note reports.
  const group = async (list, readVisuals, allDrafts) => {
    const ids = list.map((d) => d.id);
    const r = await apiJson("/api/photo-group", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ visuals: ids.map((id) => readVisuals.get(id) || ""), hint: base.trim() }),
    });
    // Grouping is a convenience. If it fails, every photo stays its own product
    // — exactly where the owner already was.
    if (r.error || !Array.isArray(r.groups)) return 0;

    // Which draft each group's photos should end up on: the first one named in
    // that group, so the AI's own first choice keeps its name and description.
    const leaderOf = new Map();
    ids.forEach((id, i) => { const g = r.groups[i]; if (g != null && !leaderOf.has(g)) leaderOf.set(g, id); });
    const moveTo = new Map();
    ids.forEach((id, i) => {
      const lead = leaderOf.get(r.groups[i]);
      if (lead && lead !== id) moveTo.set(id, lead);
    });
    if (!moveTo.size) return 0;

    // How many photos actually moved is counted INSIDE the updater, because
    // only there is the current list of drafts known. It is assigned, never
    // added to, so React running the updater twice in development cannot
    // double it — and the caller waits a tick before reading it, because an
    // updater does not run at the moment it is handed over.
    joinedRef.current = 0;
    setDrafts((s) => {
      const byId = new Map(s.map((d) => [d.id, { ...d, photos: [...d.photos] }]));
      let joined = 0;
      for (const [from, to] of moveTo) {
        const src = byId.get(from), dst = byId.get(to);
        // A product holds twelve. Past that the photo stays where it is rather
        // than disappearing — the owner can see it and decide.
        if (!src || !dst || dst.photos.length + src.photos.length > MAX_PER_PRODUCT) continue;
        dst.photos.push(...src.photos);
        joined += src.photos.length;
        byId.delete(from);
      }
      joinedRef.current = joined;
      return s.filter((d) => byId.has(d.id)).map((d) => byId.get(d.id));
    });
    await new Promise((r) => setTimeout(r, 0));
    return joinedRef.current;
  };

  // ── Moving photos between products ────────────────────────────────────────
  // The AI groups cautiously, so what is left is the owner correcting it: a
  // photo that landed on the wrong product goes out on its own, and a product
  // that should have been part of the one above goes up.
  const splitOut = (draftId, photoId) => setDrafts((s) => {
    const at = s.findIndex((d) => d.id === draftId);
    if (at < 0) return s;
    const d = s[at];
    if (d.photos.length < 2) return s;
    const photo = d.photos.find((p) => p.id === photoId);
    const rest = d.photos.filter((p) => p.id !== photoId);
    // The new row inherits everything but the vision text: that description
    // belongs to the photo that was read, and this is a different picture.
    const made = { ...blank([photo]), product_name: d.product_name, regular_price: d.regular_price, category: d.category, sizes: d.sizes, colours: d.colours };
    return [...s.slice(0, at), { ...d, photos: rest }, made, ...s.slice(at + 1)];
  });

  const mergeUp = (draftId) => setDrafts((s) => {
    const at = s.findIndex((d) => d.id === draftId);
    if (at < 1) return s;
    const above = s[at - 1], me = s[at];
    if (above.photos.length + me.photos.length > MAX_PER_PRODUCT) return s;
    return [...s.slice(0, at - 1), { ...above, photos: [...above.photos, ...me.photos] }, ...s.slice(at + 1)];
  });

  const makeFirst = (draftId, photoId) => setDrafts((s) => s.map((d) => {
    if (d.id !== draftId) return d;
    const p = d.photos.find((x) => x.id === photoId);
    return p ? { ...d, photos: [p, ...d.photos.filter((x) => x.id !== photoId)] } : d;
  }));

  const dropPhoto = (draftId, photoId) => setDrafts((s) => s.flatMap((d) => {
    if (d.id !== draftId) return [d];
    const rest = d.photos.filter((p) => p.id !== photoId);
    // A product with no photos left is not a product.
    return rest.length ? [{ ...d, photos: rest }] : [];
  }));

  // Everything back to one photo per product, for a batch the AI grouped wrongly.
  const ungroupAll = () => setDrafts((s) => s.flatMap((d) =>
    d.photos.map((p, i) => i === 0 ? { ...d, photos: [p] }
      : { ...blank([p]), product_name: "", regular_price: d.regular_price, category: d.category, sizes: d.sizes, colours: d.colours })));

  // ── Filling them all at once ───────────────────────────────────────────────
  // "Box T-shirt" becomes "Box T-shirt 1 … 15". A photo straight off a phone is
  // called WhatsApp Image 2026-08-27 at 4.16.55 PM, which is not a product name
  // and never will be, so the filename is deliberately not used.
  const nameAll = () => {
    const b = base.trim();
    if (!b) { setErr("Type a name first — the products will be numbered from it."); return; }
    setErr("");
    setDrafts((s) => s.map((d, i) => ({ ...d, product_name: `${b} ${i + 1}` })));
  };
  const all = (p) => setDrafts((s) => s.map((d) => ({ ...d, ...p })));

  const unnamed = drafts.filter((d) => !d.product_name.trim()).length;
  // Every product here has a photo by definition — it was built from one — so
  // in practice this is the price. Checked before the run rather than letting
  // the server refuse fifteen times in a row.
  const unpriced = drafts.filter((d) => missingToSell({ product_name: d.product_name, regular_price: d.regular_price, image_url: "x" }).includes("price")).length;

  // ── Saving ─────────────────────────────────────────────────────────────────
  const run = async () => {
    if (!drafts.length || busy) return;
    if (unnamed) { setErr(`${unnamed} product${unnamed > 1 ? "s have" : " has"} no name yet. Name them, or use “Name all” above.`); return; }
    if (unpriced) { setErr(`${unpriced} product${unpriced > 1 ? "s have" : " has"} no price. A product without one leaves the bot unable to answer the first thing every customer asks — set one above and press Apply to price them all at once.`); setBulkOpen(true); return; }
    setErr(""); setBusy(true);
    let done = 0, fail = 0, unread = 0, dupes = 0, stop = "";

    for (const d of drafts) {
      setMsg(`Adding ${done + fail + dupes + 1} of ${drafts.length}: ${d.product_name}`);
      const opts = optionsOf(d);
      const fd = new FormData();
      fd.append("product_name", d.product_name.trim());
      fd.append("regular_price", d.regular_price || "");
      fd.append("category", d.category || "");
      fd.append("stock_qty", d.stock_qty || "");
      fd.append("stock_status", d.stock_qty === "0" ? "outofstock" : "instock");
      fd.append("description", d.description || "");
      // The description the AI already produced, so vision does not run a
      // second time on a photo that has just been read.
      if (d.visual) fd.append("visual", d.visual);
      fd.append("options", JSON.stringify(opts));
      fd.append("variants", JSON.stringify(buildVariants(opts, { regular_price: d.regular_price })));
      // The product's whole gallery, in the order shown. The first is primary.
      d.photos.forEach((p) => fd.append("images", p.file));
      fd.append("image_urls", JSON.stringify(d.photos.map((_, i) => `upload:${i}`)));
      const r = await apiJson("/api/add-product", { method: "POST", body: fd });
      // Something the shop already has — the same folder chosen twice is how
      // this happens. Counted and reported, never failed: stopping fifteen
      // products because the third was already there would be worse than the
      // duplicate. Checked before r.error, because a refusal carries both.
      if (r.duplicate) dupes++;
      else if (r.error) {
        fail++;
        // A plan limit or an expired session will fail identically for every
        // remaining product. Stopping says so once instead of fourteen times.
        if (/allow|limit|upgrade|expired|permission/i.test(r.error)) { stop = r.error; break; }
      } else {
        done++;
        if (r.analyzeError) unread++;
      }
    }

    setBusy(false); setMsg("");
    const parts = [`Added ${done}`];
    if (fail) parts.push(`${fail} failed`);
    if (dupes) parts.push(`${dupes} you already had`);
    const line = parts.join(", ");
    if (stop) onDone({ warn: true, text: `${line}. Stopped early: ${stop}` });
    else if (unread) onDone({ warn: true, text: `${line} — but ${unread} photo${unread > 1 ? "s" : ""} could not be analysed, so those products cannot be found by picture.` });
    else onDone(line);
    onClose();
  };

  const bulkBox = (value, set, place, apply, extra = {}) => <div style={{ display: "flex", gap: 6 }}>
    <Inp emb value={value} onChange={(e) => set(e.target.value)} placeholder={place} {...extra} style={{ marginBottom: 0, flex: 1 }} />
    <Btn small onClick={apply} disabled={busy} style={{ borderRadius: 10, whiteSpace: "nowrap" }}>Apply</Btn>
  </div>;

  // Bigger on a phone, where the strip has the full width to itself and the two
  // corner buttons need somewhere to sit that is not on top of the picture.
  const TH = isMobile ? 74 : 56;

  return <div onClick={() => !busy && onClose()} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(17,19,24,.45)", backdropFilter: "blur(3px)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 16 }}>
    <div onClick={(e) => e.stopPropagation()} className="ui-page" role="dialog" aria-modal="true" aria-label="Add many products from photos"
      style={{ width: "100%", maxWidth: 900, maxHeight: isMobile ? "94dvh" : "90vh", background: T.bg, borderRadius: isMobile ? "22px 22px 0 0" : 22, boxShadow: T.nmOut, border: `1px solid ${T.border}`, display: "flex", flexDirection: "column" }}>

      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 20px 12px", flexShrink: 0 }}>
        <div style={{ width: 42, height: 42, borderRadius: 13, background: T.card, boxShadow: T.nmSm, display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ti ti-photo-plus" style={{ fontSize: 20, color: T.gold }} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700 }}>Add many products from photos</div>
          <div style={{ fontSize: 12, color: T.textMuted }}>{drafts.length ? `${drafts.length} product${drafts.length > 1 ? "s" : ""} from ${photoCount} photo${photoCount > 1 ? "s" : ""}` : "Several photos of one product are gathered together."}</div>
        </div>
        <button onClick={onClose} disabled={busy} className="pbtn" aria-label="Close" style={{ width: 36, height: 36, borderRadius: 11 }}><i className="ti ti-x" style={{ fontSize: 17 }} /></button>
      </div>

      <div style={{ padding: "0 20px", overflowY: "auto", flex: 1, minHeight: 0 }}>
        {!drafts.length
          ? <>
              <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
                onClick={() => fileRef.current?.click()}
                style={{ padding: "40px 18px", textAlign: "center", borderRadius: 18, cursor: "pointer",
                  border: `1.5px dashed ${drag ? T.gold : T.borderStrong}`, background: drag ? T.goldBg : T.bgAlt }}>
                <i className={`ti ${prepping ? "ti-loader-2" : "ti-cloud-upload"}`} style={{ fontSize: 30, color: T.gold }} />
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 10 }}>{prepping ? "Preparing photos…" : "Choose photos, or drop them here"}</div>
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>All of them at once, up to {MAX_PHOTOS}. Front, back and close-ups of the same thing are fine — they get gathered together.</div>
              </div>
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 14, lineHeight: 1.65 }}>
                <strong style={{ color: T.text }}>The AI reads every photo, fills in the name, category and description, and works out which photos are the same product.</strong> You correct anything that landed wrong before a single thing is saved.
              </div>
            </>
          : <>
              {/* Everything they have in common, set once. */}
              <Card style={{ padding: 14, marginBottom: 12 }}>
                <button type="button" onClick={() => setBulkOpen((v) => !v)} aria-expanded={bulkOpen} className="ui-btn"
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "none", border: "none", padding: 0, minHeight: 44, marginBottom: bulkOpen ? 6 : 0, color: T.text, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer", textAlign: "left" }}>
                  <span style={{ flex: 1 }}>Fill them all at once</span>
                  {!isMobile && <span style={{ fontSize: 11.5, fontWeight: 500, color: T.textDim }}>name · price · category · sizes · colours</span>}
                  <i className={`ti ti-chevron-${bulkOpen ? "up" : "down"}`} style={{ fontSize: 15, color: T.textMuted }} />
                </button>
                <div style={{ display: bulkOpen ? "grid" : "none", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0,1fr))", gap: 10 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Inp emb value={base} onChange={(e) => setBase(e.target.value)} placeholder="Name, e.g. Box T-shirt" style={{ marginBottom: 0, flex: 1 }} />
                    <Btn small onClick={nameAll} disabled={busy} style={{ borderRadius: 10, whiteSpace: "nowrap" }}>Name all</Btn>
                  </div>
                  {bulkBox(bulkPrice, setBulkPrice, "Price", () => all({ regular_price: bulkPrice }), { inputMode: "decimal" })}
                  {bulkBox(bulkCat, setBulkCat, "Category, e.g. Men › T-shirt", () => all({ category: bulkCat }), { list: "inv-cats" })}
                  {bulkBox(bulkSizes, setBulkSizes, "Sizes, e.g. S, M, L, XL", () => all({ sizes: bulkSizes }))}
                  {bulkBox(bulkColours, setBulkColours, "Colours, e.g. Black, White", () => all({ colours: bulkColours }))}
                  <div style={{ display: "flex", gap: 6 }}>
                    <Btn small onClick={() => read(drafts, drafts)} disabled={busy || !!reading} style={{ borderRadius: 10, flex: 1 }}>
                      <i className="ti ti-sparkles" style={{ marginRight: 5 }} />Read again
                    </Btn>
                    <Btn small onClick={ungroupAll} disabled={busy || !!reading || photoCount === drafts.length} style={{ borderRadius: 10, whiteSpace: "nowrap" }}>
                      One each
                    </Btn>
                  </div>
                </div>
                <datalist id="inv-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
                <div style={{ display: bulkOpen ? "block" : "none", fontSize: 11.5, color: T.textDim, marginTop: 9, lineHeight: 1.6 }}>
                  “Name all” numbers them — Box T-shirt 1, 2, 3… “One each” undoes the grouping and makes every photo its own product again.
                </div>
              </Card>

              {(reading || readNote) && <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 12px", borderRadius: 12, background: T.goldBg, color: T.gold, fontSize: 12.5, marginBottom: 12, lineHeight: 1.55 }}>
                <i className={`ti ${reading ? "ti-loader-2" : "ti-sparkles"}`} style={{ fontSize: 16, flexShrink: 0 }} />
                <span>{reading ? `Reading photo ${Math.min(reading.done + 1, reading.total)} of ${reading.total}…` : readNote}</span>
              </div>}

              {notice && <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "9px 12px", borderRadius: 12, background: T.bgAlt, color: T.textMuted, fontSize: 12, marginBottom: 12, lineHeight: 1.55 }}>
                <i className="ti ti-info-circle" style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} />
                <span>{notice}</span>
              </div>}

              {!isMobile && <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, padding: "0 6px 6px", fontSize: 10.5, color: T.textDim, textTransform: "uppercase", letterSpacing: .7 }}>
                <span>Photos</span><span>Name</span><span>Price</span><span>Category</span><span>Qty</span><span /><span /></div>}

              <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 8 }}>
                {drafts.map((d, i) => <div key={d.id} style={{ borderRadius: 12, background: T.bgAlt, boxShadow: T.nmIn, padding: isMobile ? 10 : 6 }}>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : COLS, gap: 8, alignItems: "center" }}>
                    <div style={isMobile ? { gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 8 } : { display: "contents" }}>
                      {/* Every photo on this product, first one marked. On a
                          desktop they wrap inside their narrow column; on a
                          phone they get the full width above the name — a
                          sideways scroller here hid photos behind a scrollbar. */}
                      <div style={{ display: "flex", gap: isMobile ? 8 : 4, flexWrap: "wrap", maxWidth: isMobile ? "100%" : 76 }}>
                        {d.photos.map((p, n) => <div key={p.id} style={{ position: "relative", width: TH, height: TH, flexShrink: 0 }}>
                          <img src={p.u} alt="" onClick={() => makeFirst(d.id, p.id)}
                            title={n === 0 ? "Customers see this one" : "Make this the first one"}
                            style={{ width: TH, height: TH, objectFit: "cover", borderRadius: 9, cursor: "pointer", border: `2px solid ${n === 0 ? T.gold : T.border}` }} />
                          {n === 0 && d.photos.length > 1 && <span style={{ position: "absolute", left: 2, bottom: 2, fontSize: 8.5, fontWeight: 700, padding: "1px 4px", borderRadius: 5, background: T.gold, color: "#fff" }}>1st</span>}
                          {d.photos.length > 1 && <button type="button" onClick={() => splitOut(d.id, p.id)} aria-label={`Make photo ${n + 1} its own product`}
                            title="This is a different product — move it out" className="ui-btn"
                            style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, minHeight: 0, padding: 0, borderRadius: 11, background: T.card, border: `1px solid ${T.border}`, color: T.gold, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
                            <i className="ti ti-arrow-up-right" /></button>}
                          {d.photos.length > 1 && <button type="button" onClick={() => dropPhoto(d.id, p.id)} aria-label={`Remove photo ${n + 1}`} className="ui-btn"
                            style={{ position: "absolute", bottom: -6, right: -6, width: 22, height: 22, minHeight: 0, padding: 0, borderRadius: 11, background: T.card, border: `1px solid ${T.border}`, color: T.danger, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
                            <i className="ti ti-x" /></button>}
                        </div>)}
                      </div>
                      <input value={d.product_name} onChange={(e) => patch(d.id, { product_name: e.target.value })} placeholder={reading ? "Reading…" : `Product ${i + 1} name`} className="ui-inp" style={{ ...CELL, fontWeight: 600 }} />
                    </div>
                    <input value={d.regular_price} onChange={(e) => patch(d.id, { regular_price: e.target.value })} placeholder="Price" inputMode="decimal" className="ui-inp" style={CELL} />
                    <input value={d.category} onChange={(e) => patch(d.id, { category: e.target.value })} placeholder="Category" list="inv-cats" className="ui-inp" style={CELL} />
                    {/* On a phone the last three sit on one line together, so a
                        row does not spill down the screen — and both icons get
                        a 44px target, which a 24px one is not. */}
                    <div style={isMobile ? { gridColumn: "1 / -1", display: "flex", gap: 8, alignItems: "center" } : { display: "contents" }}>
                      <input value={d.stock_qty} onChange={(e) => patch(d.id, { stock_qty: e.target.value.replace(/[^\d]/g, "") })} placeholder="Qty" inputMode="numeric" className="ui-inp" style={{ ...CELL, ...(isMobile ? { flex: 1 } : {}) }} />
                      <button type="button" onClick={() => patch(d.id, { open: !d.open })} aria-expanded={d.open} aria-label={`More about product ${i + 1}`} className="ui-btn" style={{ ...ICON_BTN, color: T.textMuted }}><i className={`ti ti-chevron-${d.open ? "up" : "down"}`} /></button>
                      <button type="button" onClick={() => drop(d.id)} disabled={busy} aria-label={`Remove product ${i + 1}`} className="ui-btn" style={{ ...ICON_BTN, color: T.danger }}><i className="ti ti-trash" /></button>
                    </div>
                  </div>

                  {d.open && <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) minmax(0,1fr)", gap: 8, padding: "10px 2px 4px" }}>
                    <textarea value={d.description} onChange={(e) => patch(d.id, { description: e.target.value })} rows={3} placeholder="What a customer reads about this product" className="ui-inp" style={{ ...CELL, gridColumn: isMobile ? "auto" : "1 / -1", resize: "vertical", lineHeight: 1.55 }} />
                    <input value={d.sizes} onChange={(e) => patch(d.id, { sizes: e.target.value })} placeholder="Sizes, e.g. S, M, L" className="ui-inp" style={CELL} />
                    <input value={d.colours} onChange={(e) => patch(d.id, { colours: e.target.value })} placeholder="Colours, e.g. Black, White" className="ui-inp" style={CELL} />
                    <div style={{ gridColumn: isMobile ? "auto" : "1 / -1", fontSize: 11.5, color: T.textDim, lineHeight: 1.6 }}>
                      {(() => { const n = buildVariants(optionsOf(d), {}).length; return n ? `${n} combination${n > 1 ? "s" : ""} will be created — each one gets its own stock count and photo when you open the product.` : "Leave both empty if this product has no sizes or colours."; })()}
                      {i > 0 && <button type="button" onClick={() => mergeUp(d.id)} className="ui-btn"
                        style={{ display: "block", marginTop: 8, padding: "6px 10px", borderRadius: 9, fontSize: 11.5, background: T.card, border: `1px solid ${T.border}`, color: T.textMuted, cursor: "pointer", fontFamily: "inherit", minHeight: 34 }}>
                        <i className="ti ti-arrow-merge-alt-left" style={{ marginRight: 5 }} />These are photos of the product above — join them
                      </button>}
                      {d.readErr && <div style={{ color: T.warn, marginTop: 6 }}><i className="ti ti-alert-triangle" style={{ marginRight: 5 }} />This photo could not be read by the AI, so it cannot be found by picture. The product still saves.</div>}
                    </div>
                  </div>}
                </div>)}
              </div>

              <Btn small onClick={() => fileRef.current?.click()} disabled={prepping || busy || !!reading} style={{ borderRadius: 10, marginBottom: 12 }}>
                <i className="ti ti-plus" style={{ marginRight: 5 }} />{prepping ? "Preparing…" : "Add more photos"}
              </Btn>
            </>}
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      </div>

      <div style={{ padding: "12px 20px calc(16px + env(safe-area-inset-bottom))", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
        {err && <div style={{ fontSize: 12.5, color: T.danger, display: "flex", gap: 6, marginBottom: 8 }}><i className="ti ti-alert-circle" style={{ fontSize: 15, flexShrink: 0 }} /><span>{err}</span></div>}
        {msg && <div style={{ fontSize: 12.5, color: T.textMuted, marginBottom: 8 }}>{msg}</div>}
        {drafts.length > 0 && !busy && <div style={{ fontSize: 11.5, color: T.textDim, marginBottom: 10, lineHeight: 1.6 }}>
          {drafts.length} product{drafts.length > 1 ? "s" : ""} · {photoCount} photo{photoCount > 1 ? "s" : ""} · {fileSize(totalBytes)} after resizing. Reading them uses the same AI allowance saving them would have used anyway.
          {unpriced > 0 && <span style={{ color: T.warn }}> · {unpriced} still {unpriced > 1 ? "have" : "has"} no price.</span>}
        </div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <Btn onClick={onClose} disabled={busy} style={{ borderRadius: 12 }}>Cancel</Btn>
          <Btn gold onClick={run} disabled={busy || prepping || !!reading || !drafts.length} style={{ borderRadius: 12, padding: "9px 20px" }}>
            {busy ? "Adding…" : `Add ${drafts.length || ""} product${drafts.length === 1 ? "" : "s"}`}
          </Btn>
        </div>
      </div>
    </div>
  </div>;
}
