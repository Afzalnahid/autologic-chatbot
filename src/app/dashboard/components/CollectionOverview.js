"use client";
import { useState, useEffect, useRef } from "react";
import { T, Card, Btn } from "./ui.js";
import { api, apiJson } from "./session.js";

// Category overviews. A shop can sell one thing (a power bank) as three separate
// products — 10k, 20k, 30k mAh. When a customer asks the broad question
// ("powerbank ache?"), the owner wants ONE overview image + a line of intro, not
// three product cards. This card lets them set that per category: an image and a
// short intro. It is saved into app_settings.settings.collections and the bot
// sends it on a broad question (bot.js rule 16b / activeCollections).
//
// This is opt-in and collapsed by default: a shop that never sets one is
// unchanged, and the bot simply shows products as before.

const rid = () => "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function Row({ c, catNames, busy, onPatch, onRemove, onPick }) {
  const fileRef = useRef(null);
  return <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 0", borderTop: `1px solid ${T.border}`, flexWrap: "wrap" }}>
    {/* Cover */}
    <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
      style={{ width: 80, height: 80, borderRadius: 14, background: T.bgAlt, boxShadow: T.nmIn, border: `1px dashed ${T.border}`, flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
      title="Upload the overview image">
      {busy ? <i className="ti ti-loader-2" style={{ fontSize: 22, color: T.textDim }} />
        : c.cover_url ? <img src={c.cover_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ textAlign: "center", color: T.textDim }}><i className="ti ti-photo-plus" style={{ fontSize: 22 }} /><div style={{ fontSize: 9.5, marginTop: 2 }}>Image</div></div>}
    </button>
    <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPick(f); }} />

    {/* Category + intro */}
    <div style={{ flex: "1 1 260px", minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      <input list="al-cat-list" value={c.category} onChange={(e) => onPatch({ category: e.target.value })} placeholder="Category (e.g. Power Bank)" className="ui-inp"
        style={{ width: "100%", background: T.bgAlt, boxShadow: T.nmIn, border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 12px", color: T.text, fontSize: 13.5, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
      <textarea value={c.intro} onChange={(e) => onPatch({ intro: e.target.value })} placeholder="Short intro the bot sends with the image (optional)" className="ui-inp" rows={2}
        style={{ width: "100%", background: T.bgAlt, boxShadow: T.nmIn, border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 12px", color: T.text, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" }} />
    </div>

    <button type="button" onClick={onRemove} aria-label="Remove" title="Remove"
      style={{ background: "none", border: "none", color: T.textDim, cursor: "pointer", fontSize: 17, padding: 6, flexShrink: 0 }}><i className="ti ti-trash" /></button>
  </div>;
}

export default function CollectionOverview({ catNames = [] }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [cols, setCols] = useState([]);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [toast, setToast] = useState("");

  // Load the saved collections the first time the card is opened — no fetch for
  // a shop that never touches this.
  useEffect(() => {
    if (!open || loaded) return;
    api("/api/settings").then((r) => r.json()).then((d) => {
      const list = Array.isArray(d?.collections) ? d.collections : [];
      setCols(list.map((c) => ({ id: c.id || rid(), category: c.category || "", cover_url: c.cover_url || "", intro: c.intro || "" })));
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [open, loaded]);

  useEffect(() => { if (!toast) return; const tm = setTimeout(() => setToast(""), 3600); return () => clearTimeout(tm); }, [toast]);

  const add = () => setCols((c) => [...c, { id: rid(), category: catNames[0] || "", cover_url: "", intro: "" }]);
  const patch = (id, p) => setCols((c) => c.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const remove = (id) => setCols((c) => c.filter((x) => x.id !== id));

  const pick = async (id, file) => {
    setBusyId(id);
    const fd = new FormData(); fd.append("cover", file);
    const r = await apiJson("/api/collection-cover", { method: "POST", body: fd });
    setBusyId("");
    if (r.error || !r.cover_url) { setToast("Upload failed: " + (r.error || "unknown")); return; }
    patch(id, { cover_url: r.cover_url });
  };

  const save = async () => {
    setSaving(true);
    // Only rows with a category AND a cover image are worth saving — the bot
    // drops the rest anyway (activeCollections in bot.js).
    const clean = cols
      .map((c) => ({ id: c.id, category: (c.category || "").trim(), cover_url: (c.cover_url || "").trim(), intro: (c.intro || "").trim() }))
      .filter((c) => c.category && c.cover_url);
    const r = await apiJson("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ collections: clean }) });
    setSaving(false);
    if (r.error) { setToast("Save failed: " + r.error); return; }
    setCols(clean);
    setToast(clean.length ? "Saved — the bot sends these on a general question" : "Saved");
  };

  const count = cols.filter((c) => (c.category || "").trim() && (c.cover_url || "").trim()).length;

  return <Card style={{ padding: 0, overflow: "hidden" }}>
    <button type="button" onClick={() => setOpen((v) => !v)}
      style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "13px 16px", background: "none", border: "none", cursor: "pointer", color: T.text, textAlign: "left", fontFamily: "inherit" }}>
      <div style={{ width: 34, height: 34, borderRadius: 11, background: `color-mix(in srgb, ${T.info} 12%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <i className="ti ti-photo-star" style={{ fontSize: 17, color: T.info }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>Overview image for a category{count > 0 && <span style={{ color: T.textDim, fontWeight: 600 }}> · {count}</span>}</div>
        <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 1 }}>When a customer asks broadly (“do you have power banks?”), the bot sends one image + intro, then narrows down.</div>
      </div>
      <i className={`ti ti-chevron-${open ? "up" : "down"}`} style={{ fontSize: 18, color: T.textDim, flexShrink: 0 }} />
    </button>

    {open && <div style={{ padding: "0 16px 16px" }}>
      <datalist id="al-cat-list">{catNames.map((c) => <option key={c} value={c} />)}</datalist>

      {!loaded ? <div style={{ padding: "14px 0", color: T.textDim, fontSize: 12.5 }}>Loading…</div>
        : <>
          {cols.length === 0 && <div style={{ padding: "16px 0", color: T.textMuted, fontSize: 12.5, lineHeight: 1.6 }}>
            No overview set. Add one, upload the image you want the bot to send for that category, and write a short intro.
          </div>}
          {cols.map((c) => <Row key={c.id} c={c} catNames={catNames} busy={busyId === c.id}
            onPatch={(p) => patch(c.id, p)} onRemove={() => remove(c.id)} onPick={(f) => pick(c.id, f)} />)}

          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <Btn small onClick={add} style={{ borderRadius: 11 }}><i className="ti ti-plus" style={{ marginRight: 5 }} />Add a category overview</Btn>
            <Btn small gold onClick={save} disabled={saving} style={{ borderRadius: 11, marginLeft: "auto" }}>{saving ? "Saving…" : "Save"}</Btn>
          </div>
        </>}

      {toast && <div style={{ marginTop: 12, fontSize: 12, color: T.textMuted, background: T.bgAlt, boxShadow: T.nmIn, borderRadius: 10, padding: "8px 12px" }}>{toast}</div>}
    </div>}
  </Card>;
}
