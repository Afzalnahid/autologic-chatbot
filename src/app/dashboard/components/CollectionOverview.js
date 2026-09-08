"use client";
import { useState, useEffect, useRef } from "react";
import { T, Card, Btn, Select } from "./ui.js";
import { api, apiJson } from "./session.js";
import { useBackClose } from "./back.js";

// Category overview. A shop can sell one thing (a power bank) as several products
// — 10k, 20k, 30k mAh. When a customer first asks broadly ("power bank ache?",
// "price koto?"), the owner wants ONE overview image + a short intro, not three
// product cards. This sets that PER CATEGORY, and it lives under the category the
// owner has selected in the rail: pick "Powerbank" and you set Powerbank's
// overview right there. It is saved into app_settings.settings.collections and
// the bot sends it on a broad first question (bot.js rule 16b / activeCollections).

const rid = () => "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const norm = (s) => String(s || "").trim().toLowerCase();

export default function CollectionOverview({ selectedCat, catNames = [], onGotoCategory }) {
  // The overview is a category idea; "All products" and "Uncategorized" are not
  // categories a customer names, so there it becomes a gentle pointer instead.
  const specific = selectedCat && selectedCat !== "all" && selectedCat !== "Uncategorized" ? selectedCat : null;

  const [loaded, setLoaded] = useState(false);
  const [allCols, setAllCols] = useState([]);   // the full saved list, so saving one keeps the rest
  const [cover, setCover] = useState("");
  const [intro, setIntro] = useState("");
  const [busy, setBusy] = useState(false);       // cover uploading
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const fileRef = useRef(null);

  // Load the saved list once. The component only renders when there is a
  // catalogue, so this is one light GET when the tab opens.
  useEffect(() => {
    api("/api/settings").then((r) => r.json()).then((d) => {
      setAllCols(Array.isArray(d?.collections) ? d.collections : []);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  // When the selected category changes, show ITS saved values.
  useEffect(() => {
    const found = allCols.find((c) => norm(c.category) === norm(specific));
    setCover(found?.cover_url || "");
    setIntro(found?.intro || "");
    setToast("");
  }, [specific, allCols]);

  useEffect(() => { if (!toast) return; const tm = setTimeout(() => setToast(""), 3600); return () => clearTimeout(tm); }, [toast]);

  const pick = async (file) => {
    if (!file) return;
    setBusy(true);
    const fd = new FormData(); fd.append("cover", file);
    const r = await apiJson("/api/collection-cover", { method: "POST", body: fd });
    setBusy(false);
    if (r.error || !r.cover_url) { setToast("Upload failed: " + (r.error || "unknown")); return; }
    setCover(r.cover_url);
  };

  const persist = async (nextCover, nextIntro) => {
    setSaving(true);
    const others = allCols.filter((c) => norm(c.category) !== norm(specific));
    // A row is only worth keeping when it has a cover image (the bot needs one);
    // clearing the image and saving therefore removes the overview.
    const mine = String(nextCover || "").trim()
      ? [{ id: allCols.find((c) => norm(c.category) === norm(specific))?.id || rid(), category: specific, cover_url: nextCover.trim(), intro: String(nextIntro || "").trim() }]
      : [];
    const next = [...others, ...mine];
    const res = await apiJson("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ collections: next }) });
    setSaving(false);
    if (res.error) { setToast("Save failed: " + res.error); return false; }
    setAllCols(next);
    return true;
  };

  const save = async () => { if (await persist(cover, intro)) setToast(cover.trim() ? `Saved — the bot sends this when a customer asks about ${specific}` : "Overview removed"); };
  const removeIt = async () => { setCover(""); setIntro(""); if (await persist("", "")) setToast("Overview removed"); };

  // ── "All products" (or Uncategorized): a quiet pointer to pick a category ──
  if (!specific) {
    const has = new Set(allCols.filter((c) => String(c.cover_url || "").trim()).map((c) => norm(c.category)));
    return <Card style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap", background: T.bgAlt }}>
      <div style={{ width: 34, height: 34, borderRadius: 11, background: `color-mix(in srgb, ${T.info} 12%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <i className="ti ti-photo-star" style={{ fontSize: 17, color: T.info }} />
      </div>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Overview image for a category</div>
        <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 1, lineHeight: 1.5 }}>Pick a category to set the image + intro the bot sends when a customer asks broadly about it.</div>
      </div>
      {catNames.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {catNames.slice(0, 6).map((c) => <button key={c} type="button" onClick={() => onGotoCategory?.(c)}
          style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 20, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          {has.has(norm(c)) && <i className="ti ti-check" style={{ fontSize: 13, color: T.success }} />}{c}
        </button>)}
      </div>}
    </Card>;
  }

  // ── A specific category: its own overview editor ──
  return <Card style={{ padding: "13px 15px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 11 }}>
      <i className="ti ti-photo-star" style={{ fontSize: 17, color: T.info, flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>Overview for {specific}</div>
        <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 1, lineHeight: 1.5 }}>The bot sends this image + intro when a customer first asks broadly about {specific}, then narrows to a model.</div>
      </div>
    </div>

    {!loaded ? <div style={{ color: T.textDim, fontSize: 12.5, padding: "6px 0" }}>Loading…</div>
      : <div style={{ display: "flex", gap: 13, alignItems: "flex-start", flexWrap: "wrap" }}>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
          style={{ width: 92, height: 92, borderRadius: 14, background: T.bgAlt, boxShadow: T.nmIn, border: `1px dashed ${T.border}`, flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
          title="Upload the overview image">
          {busy ? <i className="ti ti-loader-2" style={{ fontSize: 22, color: T.textDim }} />
            : cover ? <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <div style={{ textAlign: "center", color: T.textDim }}><i className="ti ti-photo-plus" style={{ fontSize: 24 }} /><div style={{ fontSize: 9.5, marginTop: 3 }}>Add image</div></div>}
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) pick(f); }} />

        <div style={{ flex: "1 1 260px", minWidth: 0, display: "flex", flexDirection: "column", gap: 9 }}>
          <textarea value={intro} onChange={(e) => setIntro(e.target.value)} placeholder={`Short intro the bot sends with the image (optional)`} className="ui-inp" rows={3}
            style={{ width: "100%", background: T.bgAlt, boxShadow: T.nmIn, border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 12px", color: T.text, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" }} />
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Btn small gold onClick={save} disabled={saving || busy} style={{ borderRadius: 11 }}>{saving ? "Saving…" : "Save"}</Btn>
            {cover && <button type="button" onClick={removeIt} disabled={saving} style={{ background: "none", border: "none", color: T.textDim, cursor: "pointer", fontSize: 12, fontWeight: 600, padding: "6px 4px", fontFamily: "inherit" }}>Remove</button>}
            {toast && <span style={{ fontSize: 11.5, color: T.textMuted, marginLeft: "auto" }}>{toast}</span>}
          </div>
        </div>
      </div>}
  </Card>;
}

// The same editor as a standalone overlay, so the AI Assistant can open it on
// its own tab (an image cannot be set by typing, so the owner drops it here).
// A category picker sits on top; everything below is the card above, unchanged.
export function CategoryOverviewSheet({ catNames = [], initialCat, onClose }) {
  const [cat, setCat] = useState(initialCat || catNames[0] || "");
  useBackClose(true, onClose);
  const opts = (catNames.length ? catNames : []).map((c) => ({ value: c, label: c, icon: "ti-folder" }));
  return <div onClick={onClose} style={{ position: "fixed", inset: 0, height: "100dvh", zIndex: 82, background: "rgba(17,19,24,.45)", backdropFilter: "blur(3px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0 }}>
    <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{ width: "100%", maxWidth: 560, maxHeight: "94dvh", overflowY: "auto", background: T.bg, borderRadius: "22px 22px 0 0", boxShadow: T.nmOut, border: `1px solid ${T.border}`, padding: "18px 16px calc(18px + env(safe-area-inset-bottom))" }} className="ui-page">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 34, height: 34, borderRadius: 11, background: `color-mix(in srgb, ${T.info} 12%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <i className="ti ti-photo-star" style={{ fontSize: 17, color: T.info }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Overview image for a category</div>
          <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 1 }}>The image + intro the bot sends when a customer asks broadly about it.</div>
        </div>
        <button onClick={onClose} aria-label="Close" className="pbtn" style={{ width: 36, height: 36, borderRadius: 11 }}><i className="ti ti-x" style={{ fontSize: 17 }} /></button>
      </div>
      {catNames.length > 1 && <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: T.textDim, marginBottom: 6 }}>Category</div>
        <Select value={cat} onChange={setCat} options={opts} wide />
      </div>}
      {catNames.length === 0
        ? <div style={{ fontSize: 12.5, color: T.textMuted, padding: "10px 2px", lineHeight: 1.6 }}>Add a product first — the overview is set per category, and there are no categories yet.</div>
        : <CollectionOverview selectedCat={cat || "all"} catNames={catNames} onGotoCategory={setCat} />}
    </div>
  </div>;
}
