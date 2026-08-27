"use client";
import { useState, useEffect, useRef } from "react";
import { T, Card, Btn, Inp } from "./ui.js";
import { apiJson } from "./session.js";
import { shrinkImage, fileSize } from "@/lib/shrink-image.js";
import { buildVariants } from "@/lib/variants.js";

// Turn a folder of photos into one product each.
//
// The shop this was written for photographs fifteen different t-shirts and then
// tries to add them. The only bulk route was a CSV, which nobody has, so the
// alternative was opening the drawer fifteen times — and the shape of the form
// quietly invited the wrong thing instead: dropping all fifteen shirts into ONE
// product's gallery, where they become fifteen pictures of a single item and
// the bot can only ever offer one of them.
//
// Fifteen photos is fifteen products. This says so, and it fills them in.
//
// Choosing the photos is the whole first step. The AI then reads every one of
// them and proposes a name, a category and a sentence a customer can read; the
// owner corrects whatever is wrong, adds sizes or colours where they matter, and
// saves the lot. That reading costs nothing extra: vision already ran on every
// new product at save time, so it runs HERE instead and the description travels
// back with the draft as `visual`, which the save skips over. One photo, one
// vision call — as it always was.
//
// Each product is then saved by its own request to /api/add-product, one at a
// time. That is deliberate and it is what makes the batch reliable: the
// request-size limit that broke the old upload cannot be reached with a single
// photo in the body, a failure names the row it belongs to instead of losing
// the lot, and the progress line is honest because it reflects work that has
// actually finished.

const CELL = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 10px", color: T.text, fontSize: 13, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box", minWidth: 0 };
const COLS = "56px minmax(0,1.7fr) 96px minmax(0,1.1fr) 74px 44px 44px";
// 44px is the smallest square a thumb reliably hits. The variant photo button
// shipped at 37px once and had to be fixed after the fact; these start there.
const ICON_BTN = { width: 44, height: 44, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", borderRadius: 11, cursor: "pointer", fontSize: 16, padding: 0, minHeight: 0 };

// What one request to /api/photo-draft may carry. Six is the server's cap; the
// byte budget is what actually matters, because the platform refuses anything
// over ~4.5 MB at the edge before our code ever runs.
const READ_MAX = 6;
const READ_BUDGET = 3_200_000;

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

const blank = (file) => ({
  id: nextId(), file, u: URL.createObjectURL(file),
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
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  // Five boxes stacked one under another fill a phone screen completely, so the
  // owner scrolls past the whole thing before seeing a single product. On a
  // phone it starts folded; on a desktop it is three across and costs nothing.
  const [bulkOpen, setBulkOpen] = useState(!isMobile);
  const fileRef = useRef(null);
  // The cleanup effect runs once, on unmount, so it cannot see the latest
  // drafts through the closure. This ref is what it reads instead.
  const live = useRef([]);
  live.current = drafts;

  useEffect(() => { const k = (e) => { if (e.key === "Escape" && !busy) onClose(); }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [busy, onClose]);
  // Previews are object URLs; without this the tab holds every photo in memory
  // long after the sheet is gone.
  useEffect(() => () => live.current.forEach((d) => URL.revokeObjectURL(d.u)), []);

  const patch = (id, p) => setDrafts((s) => s.map((d) => d.id === id ? { ...d, ...p } : d));
  const drop = (id) => setDrafts((s) => { const d = s.find((x) => x.id === id); if (d) URL.revokeObjectURL(d.u); return s.filter((x) => x.id !== id); });

  const add = async (list) => {
    const picked = [...list].filter((x) => x.type?.startsWith("image/"));
    if (!picked.length) return;
    setErr(""); setPrepping(true);
    // Each photo is shrunk on its own, at full quality: they leave in separate
    // requests, so one large photo cannot push another over the limit and there
    // is nothing to be gained by making them all smaller together.
    const ready = await Promise.all(picked.map((f) => shrinkImage(f)));
    setPrepping(false);
    const fresh = ready.map(blank);
    setDrafts((s) => [...s, ...fresh].slice(0, 60));
    read(fresh);
  };

  // ── Reading ────────────────────────────────────────────────────────────────
  // Photos go up a few at a time, small enough that the platform lets the
  // request through. Each answer is written back to the row it came from by id,
  // so a slow chunk cannot land on the wrong product if the owner has been
  // deleting rows in the meantime.
  const read = async (targets) => {
    const list = targets.filter((d) => d.file);
    if (!list.length) return;
    setReadNote(""); setErr("");
    let done = 0, failed = 0, nameErr = "";
    setReading({ done: 0, total: list.length });

    for (let i = 0; i < list.length;) {
      const chunk = [];
      let bytes = 0;
      while (i < list.length && chunk.length < READ_MAX && bytes + list[i].file.size <= READ_BUDGET) {
        bytes += list[i].file.size; chunk.push(list[i]); i++;
      }
      // One photo bigger than the whole budget: send it alone rather than loop
      // forever refusing to fit it.
      if (!chunk.length) { chunk.push(list[i]); i++; }

      const fd = new FormData();
      for (const d of chunk) fd.append("images", d.file);
      if (base.trim()) fd.append("hint", base.trim());
      if (categories.length) fd.append("categories", categories.join("\n"));

      const r = await apiJson("/api/photo-draft", { method: "POST", body: fd });
      if (r.error) {
        setReading(null);
        setErr(`${r.error} — the photos are still here, you can type the details yourself.`);
        return;
      }
      const answers = new Map(chunk.map((d, n) => [d.id, r.drafts?.[n] || {}]));
      for (const got of answers.values()) { if (got.error) failed++; else done++; }
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
    if (nameErr) setReadNote(`Read ${done} photo${done > 1 ? "s" : ""}, but naming them failed (${nameErr}). The photos are understood — type the names yourself, or use “Name all” above.`);
    else if (done && !failed) setReadNote(`Read ${done} photo${done > 1 ? "s" : ""}. Check the names and prices below — change anything that is wrong.`);
    else if (done && failed) setReadNote(`Read ${done}, but ${failed} could not be read. Type those in yourself.`);
    else if (failed) setErr(`None of the ${failed} photos could be read. You can still type the details in yourself.`);
  };

  // ── Filling them all at once ───────────────────────────────────────────────
  // "Box T-shirt" becomes "Box T-shirt 1 … 15". A photo straight off a phone is
  // called WhatsApp Image 2026-08-27 at 4.16.55 PM, which is not a product name
  // and never will be, so the filename is deliberately not used.
  const nameAll = () => {
    const b = base.trim();
    if (!b) { setErr("Type a name first — the photos will be numbered from it."); return; }
    setErr("");
    setDrafts((s) => s.map((d, i) => ({ ...d, product_name: `${b} ${i + 1}` })));
  };
  const all = (p) => setDrafts((s) => s.map((d) => ({ ...d, ...p })));

  const unnamed = drafts.filter((d) => !d.product_name.trim()).length;
  const total = drafts.reduce((a, d) => a + d.file.size, 0);

  // ── Saving ─────────────────────────────────────────────────────────────────
  const run = async () => {
    if (!drafts.length || busy) return;
    if (unnamed) { setErr(`${unnamed} photo${unnamed > 1 ? "s have" : " has"} no name yet. Name them, or use “Name all” above.`); return; }
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
      fd.append("stock_status", "instock");
      fd.append("description", d.description || "");
      // The description the AI already produced, so vision does not run a
      // second time on a photo that has just been read.
      if (d.visual) fd.append("visual", d.visual);
      fd.append("options", JSON.stringify(opts));
      fd.append("variants", JSON.stringify(buildVariants(opts, { regular_price: d.regular_price })));
      fd.append("images", d.file);
      fd.append("image_urls", JSON.stringify(["upload:0"]));
      const r = await apiJson("/api/add-product", { method: "POST", body: fd });
      // Something the shop already has — the same folder chosen twice is how
      // this happens. Counted and reported, never failed: stopping fifteen
      // photos because the third one was already there would be worse than the
      // duplicate. Checked before r.error, because a refusal carries both.
      if (r.duplicate) dupes++;
      else if (r.error) {
        fail++;
        // A plan limit or an expired session will fail identically for every
        // remaining photo. Stopping says so once instead of fourteen times.
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

  return <div onClick={() => !busy && onClose()} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(17,19,24,.45)", backdropFilter: "blur(3px)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 16 }}>
    <div onClick={(e) => e.stopPropagation()} className="ui-page" role="dialog" aria-modal="true" aria-label="Add many products from photos"
      style={{ width: "100%", maxWidth: 900, maxHeight: isMobile ? "94dvh" : "90vh", background: T.bg, borderRadius: isMobile ? "22px 22px 0 0" : 22, boxShadow: T.nmOut, border: `1px solid ${T.border}`, display: "flex", flexDirection: "column" }}>

      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 20px 12px", flexShrink: 0 }}>
        <div style={{ width: 42, height: 42, borderRadius: 13, background: T.card, boxShadow: T.nmSm, display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ti ti-photo-plus" style={{ fontSize: 20, color: T.gold }} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700 }}>Add many products from photos</div>
          <div style={{ fontSize: 12, color: T.textMuted }}>One photo becomes one product. Fifteen shirts, fifteen products.</div>
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
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Select all of them at once. Up to 60. They are resized here, then read one by one.</div>
              </div>
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 14, lineHeight: 1.65 }}>
                <strong style={{ color: T.text }}>The AI reads every photo and fills in the name, category and description.</strong> You correct whatever is wrong before anything is saved. Use this when each photo is a different product — if instead you have one shirt photographed from several angles, close this and use <em>Add product</em>.
              </div>
            </>
          : <>
              {/* Everything the fifteen have in common, set once. */}
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
                  <Btn small onClick={() => read(drafts)} disabled={busy || !!reading} style={{ borderRadius: 10 }}>
                    <i className="ti ti-sparkles" style={{ marginRight: 5 }} />Read photos again
                  </Btn>
                </div>
                <datalist id="inv-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
                <div style={{ display: bulkOpen ? "block" : "none", fontSize: 11.5, color: T.textDim, marginTop: 9, lineHeight: 1.6 }}>
                  “Name all” numbers them — Box T-shirt 1, 2, 3… Sizes and colours become the choices a customer picks from; open a row with <i className="ti ti-chevron-down" /> to set them for one product only.
                </div>
              </Card>

              {(reading || readNote) && <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 12px", borderRadius: 12, background: T.goldBg, color: T.gold, fontSize: 12.5, marginBottom: 12, lineHeight: 1.55 }}>
                <i className={`ti ${reading ? "ti-loader-2" : "ti-sparkles"}`} style={{ fontSize: 16, flexShrink: 0 }} />
                <span>{reading ? `Reading photo ${Math.min(reading.done + 1, reading.total)} of ${reading.total}…` : readNote}</span>
              </div>}

              {!isMobile && <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, padding: "0 6px 6px", fontSize: 10.5, color: T.textDim, textTransform: "uppercase", letterSpacing: .7 }}>
                <span>Photo</span><span>Name</span><span>Price</span><span>Category</span><span>Qty</span><span /><span /></div>}

              <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 8 }}>
                {drafts.map((d, i) => <div key={d.id} style={{ borderRadius: 12, background: T.bgAlt, boxShadow: T.nmIn, padding: isMobile ? 10 : 6 }}>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : COLS, gap: 8, alignItems: "center" }}>
                    <div style={isMobile ? { gridColumn: "1 / -1", display: "flex", gap: 10, alignItems: "center" } : { display: "contents" }}>
                      <img src={d.u} alt="" style={{ width: 56, height: 56, flexShrink: 0, objectFit: "cover", borderRadius: 10, border: `1px solid ${T.border}` }} />
                      <input value={d.product_name} onChange={(e) => patch(d.id, { product_name: e.target.value })} placeholder={reading ? "Reading…" : `Product ${i + 1} name`} className="ui-inp" style={{ ...CELL, fontWeight: 600 }} />
                    </div>
                    <input value={d.regular_price} onChange={(e) => patch(d.id, { regular_price: e.target.value })} placeholder="Price" inputMode="decimal" className="ui-inp" style={CELL} />
                    <input value={d.category} onChange={(e) => patch(d.id, { category: e.target.value })} placeholder="Category" list="inv-cats" className="ui-inp" style={CELL} />
                    {/* On a phone the last three sit on one line together, so a
                        row does not spill down the screen — and both icons get
                        a 44px target, which a 24px one is not. */}
                    <div style={isMobile ? { gridColumn: "1 / -1", display: "flex", gap: 8, alignItems: "center" } : { display: "contents" }}>
                      <input value={d.stock_qty} onChange={(e) => patch(d.id, { stock_qty: e.target.value.replace(/[^\d]/g, "") })} placeholder="Qty" inputMode="numeric" className="ui-inp" style={{ ...CELL, ...(isMobile ? { flex: 1 } : {}) }} />
                      <button type="button" onClick={() => patch(d.id, { open: !d.open })} aria-expanded={d.open} aria-label={`More about photo ${i + 1}`} className="ui-btn" style={{ ...ICON_BTN, color: T.textMuted }}><i className={`ti ti-chevron-${d.open ? "up" : "down"}`} /></button>
                      <button type="button" onClick={() => drop(d.id)} disabled={busy} aria-label={`Remove photo ${i + 1}`} className="ui-btn" style={{ ...ICON_BTN, color: T.danger }}><i className="ti ti-trash" /></button>
                    </div>
                  </div>

                  {d.open && <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) minmax(0,1fr)", gap: 8, padding: "10px 2px 4px" }}>
                    <textarea value={d.description} onChange={(e) => patch(d.id, { description: e.target.value })} rows={3} placeholder="What a customer reads about this product" className="ui-inp" style={{ ...CELL, gridColumn: isMobile ? "auto" : "1 / -1", resize: "vertical", lineHeight: 1.55 }} />
                    <input value={d.sizes} onChange={(e) => patch(d.id, { sizes: e.target.value })} placeholder="Sizes, e.g. S, M, L" className="ui-inp" style={CELL} />
                    <input value={d.colours} onChange={(e) => patch(d.id, { colours: e.target.value })} placeholder="Colours, e.g. Black, White" className="ui-inp" style={CELL} />
                    <div style={{ gridColumn: isMobile ? "auto" : "1 / -1", fontSize: 11.5, color: T.textDim, lineHeight: 1.6 }}>
                      {(() => { const n = buildVariants(optionsOf(d), {}).length; return n ? `${n} combination${n > 1 ? "s" : ""} will be created — each one gets its own stock count and photo when you open the product.` : "Leave both empty if this product has no sizes or colours."; })()}
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
          {drafts.length} photo{drafts.length > 1 ? "s" : ""} · {fileSize(total)} after resizing. Reading them uses the same AI allowance saving them would have used anyway.
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
