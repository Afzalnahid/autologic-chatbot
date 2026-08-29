"use client";
import { useState, useEffect, useRef } from "react";
import { T, Card, Btn, Badge, Select, useIsMobile, shortDate } from "./ui.js";
import { api, apiJson } from "./session.js";
import { useBackClose } from "./back.js";

// The Knowledge Base tab: the documents the bot answers from.
//
// Built to the same shape as Inventory, which is the tab that reads best — a
// row of counts, one toolbar holding search and sort, then the list — because
// a business with thirty price lists and policy PDFs needs to find one, not
// scroll a flat stack. It used to be a bare list with no search, no dates and
// no confirmation before deleting.

const ICON = (f) => {
  const s = `${f.file_type || ""} ${f.file_name || ""}`;
  if (/pdf/i.test(s)) return { i: "ti-file-type-pdf", c: T.danger };
  if (/word|docx?/i.test(s)) return { i: "ti-file-type-docx", c: T.info };
  if (/csv|sheet|excel|xlsx?/i.test(s)) return { i: "ti-file-type-csv", c: T.success };
  if (/\.md$|markdown/i.test(s)) return { i: "ti-markdown", c: T.purple };
  return { i: "ti-file-text", c: T.gold };
};
const KIND = (f) => {
  const s = `${f.file_type || ""} ${f.file_name || ""}`;
  if (/pdf/i.test(s)) return "PDF";
  if (/word|docx?/i.test(s)) return "Word";
  if (/csv/i.test(s)) return "CSV";
  if (/\.md$|markdown/i.test(s)) return "Markdown";
  return "Text";
};

export default function KnowledgeBase() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");            // the name being uploaded
  const [queue, setQueue] = useState({ done: 0, total: 0 });
  const [msg, setMsg] = useState(null);            // { text, bad }
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [confirm, setConfirm] = useState(null);    // the file awaiting a yes
  // "Are you sure" answers the back press: pressing back at a confirmation
  // means no, and it must never fall through and leave the tab instead.
  useBackClose(!!confirm, () => setConfirm(null));
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);
  const isMobile = useIsMobile();

  const load = async () => {
    setLoading(true);
    const d = await api("/api/knowledge").then((r) => r.json()).catch(() => []);
    if (Array.isArray(d)) setFiles(d);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Several files at once, one request at a time. The server embeds every
  // chunk of a document, so firing ten uploads in parallel would stall them
  // all and time some out; in a queue each one finishes and the owner watches
  // a count go up.
  const upload = async (list) => {
    const picked = [...(list || [])].filter(Boolean);
    if (!picked.length) return;
    setMsg(null);
    setQueue({ done: 0, total: picked.length });
    let ok = 0; const failed = [];
    for (const file of picked) {
      setBusy(file.name);
      const fd = new FormData(); fd.append("file", file);
      const r = await apiJson("/api/knowledge", { method: "POST", body: fd });
      if (r.error) failed.push(`${file.name} (${r.error})`); else ok++;
      setQueue((q) => ({ ...q, done: q.done + 1 }));
    }
    setBusy(""); setQueue({ done: 0, total: 0 });
    setMsg(failed.length
      ? { text: `${ok} added. Could not read: ${failed.join(", ")}`, bad: true }
      : { text: `${ok} document${ok === 1 ? "" : "s"} added and indexed.`, bad: false });
    if (fileRef.current) fileRef.current.value = "";
    load();
  };

  // Deleting removes the file, every chunk indexed from it and the stored
  // original — there is no undo, so it asks first. It used to delete on a
  // single tap, which on a phone is one mis-touch away from losing a document
  // the owner may not have a copy of.
  const del = async (f) => {
    setConfirm(null);
    await api("/api/knowledge", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_id: f.file_id }) });
    setMsg({ text: `Removed ${f.file_name}.`, bad: false });
    load();
  };

  const totalChunks = files.reduce((n, f) => n + (Number(f.chunks) || 0), 0);
  const q = search.trim().toLowerCase();
  const shown = files
    .filter((f) => !q || `${f.file_name || ""} ${KIND(f)}`.toLowerCase().includes(q))
    .sort((a, b) => sort === "name" ? String(a.file_name || "").localeCompare(String(b.file_name || ""))
      : sort === "chunks" ? (Number(b.chunks) || 0) - (Number(a.chunks) || 0)
      : new Date(b.created_at || 0) - new Date(a.created_at || 0));

  const empty = !loading && files.length === 0;

  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.doc,.txt,.md,.csv" hidden
      onChange={(e) => upload(e.target.files)} />

    {!empty && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
      {[["ti-files", "Documents", files.length, T.gold],
        ["ti-layout-grid", "Indexed pieces", totalChunks, T.info],
        ["ti-file-type-pdf", "PDFs", files.filter((f) => KIND(f) === "PDF").length, T.danger]].map(([ic, l, v, c]) =>
        <Card key={l} style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 34, height: 34, borderRadius: 11, background: `color-mix(in srgb, ${c} 11%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><i className={`ti ${ic}`} style={{ fontSize: 17, color: c }} /></div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1 }}>{v}</div>
            <div style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: .7, whiteSpace: "nowrap" }}>{l}</div>
          </div>
        </Card>)}
    </div>}

    {!empty && <Card style={{ padding: isMobile ? "10px 10px" : "10px 12px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <div style={{ position: "relative", flex: "1 1 200px", minWidth: 0 }}>
        <i className="ti ti-search" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textDim, fontSize: 16 }} />
        <input placeholder="Search documents…" value={search} onChange={(e) => setSearch(e.target.value)} className="ui-inp"
          style={{ width: "100%", background: T.bgAlt, boxShadow: T.nmIn, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 12px 10px 36px", color: T.text, fontSize: 13.5, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
        {search && <button onClick={() => setSearch("")} aria-label="Clear" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: T.textDim, cursor: "pointer", fontSize: 15, minHeight: 0, padding: 4 }}><i className="ti ti-x" /></button>}
      </div>
      <Select value={sort} onChange={setSort} options={[
        { value: "newest", label: "Newest first", icon: "ti-clock" },
        { value: "name", label: "Name A–Z", icon: "ti-sort-ascending-letters" },
        { value: "chunks", label: "Most content", icon: "ti-layout-grid" }]} />
      <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
        <Btn onClick={load} disabled={loading || !!busy} style={{ padding: "9px 14px", borderRadius: 12, whiteSpace: "nowrap" }}><i className="ti ti-refresh" style={{ marginRight: 6 }} />Refresh</Btn>
        <Btn gold onClick={() => fileRef.current?.click()} disabled={!!busy} style={{ padding: "9px 16px", borderRadius: 12, whiteSpace: "nowrap" }}><i className="ti ti-upload" style={{ marginRight: 6 }} />{busy ? "Uploading…" : "Upload"}</Btn>
      </div>
    </Card>}

    {/* Progress is a real count, not a spinner: reading a long PDF takes a
        while and "3 of 7 · price-list.pdf" is the difference between waiting
        and assuming it has hung. */}
    {!!busy && <Card style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 14px" }}>
      <i className="ti ti-loader-2" style={{ fontSize: 18, color: T.gold, animation: "spin .9s linear infinite", flexShrink: 0 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {queue.total > 1 ? `${queue.done + 1} of ${queue.total} · ` : ""}{busy}
        </div>
        <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 2 }}>Reading the document and indexing it for the bot…</div>
      </div>
    </Card>}

    {msg && <Card style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px",
      background: `color-mix(in srgb, ${msg.bad ? T.danger : T.success} 6%, transparent)`,
      border: `1px solid color-mix(in srgb, ${msg.bad ? T.danger : T.success} 22%, transparent)` }}>
      <i className={`ti ${msg.bad ? "ti-alert-triangle" : "ti-circle-check"}`} style={{ fontSize: 17, color: msg.bad ? T.danger : T.success, flexShrink: 0, marginTop: 1 }} />
      <div style={{ fontSize: 12.5, lineHeight: 1.6, flex: 1 }}>{msg.text}</div>
      <button onClick={() => setMsg(null)} aria-label="Dismiss" style={{ background: "none", border: "none", color: T.textDim, cursor: "pointer", fontSize: 15, padding: 2, flexShrink: 0, minHeight: 0 }}><i className="ti ti-x" /></button>
    </Card>}

    {loading
      ? <Card style={{ textAlign: "center", color: T.textDim, padding: 30 }}>Loading…</Card>
      : empty
      ? <Card
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
          style={{ padding: "clamp(24px,5vw,44px) 20px", textAlign: "center", border: `1.5px dashed ${drag ? T.gold : T.border}`, background: drag ? T.goldBg : T.card }}>
          <div style={{ width: 66, height: 66, borderRadius: 20, background: T.card, boxShadow: T.nmSm, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}><i className="ti ti-books" style={{ fontSize: 30, color: T.gold }} /></div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.02em" }}>Teach the bot from your own documents</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6, maxWidth: 460, margin: "6px auto 20px", lineHeight: 1.6 }}>
            Upload what you already have and the bot answers customers from it — word for word, never invented.
          </div>
          {/* Named examples, not "upload a file": an owner staring at an empty
              tab needs to know what is worth uploading, and these are the four
              documents that most change what the bot can answer. */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, maxWidth: 620, margin: "0 auto 22px" }}>
            {[["ti-receipt", "Price list", "Packages and rates"],
              ["ti-truck-delivery", "Delivery & returns", "Charges, areas, policy"],
              ["ti-help-circle", "Common questions", "What customers keep asking"],
              ["ti-file-description", "Service details", "What each service includes"]].map(([ic, t, s]) =>
              <div key={t} style={{ padding: "13px 12px", borderRadius: 14, background: T.bgAlt, boxShadow: T.nmIn, textAlign: "left" }}>
                <i className={`ti ${ic}`} style={{ fontSize: 19, color: T.gold }} />
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>{t}</div>
                <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 2 }}>{s}</div>
              </div>)}
          </div>
          <Btn gold onClick={() => fileRef.current?.click()} style={{ padding: "12px 22px", borderRadius: 14, fontSize: 14 }}><i className="ti ti-upload" style={{ marginRight: 7 }} />Upload your first document</Btn>
          <div style={{ fontSize: 11.5, color: T.textDim, marginTop: 12 }}>PDF, Word, text, Markdown or CSV{isMobile ? "" : " · or drag files onto this box"}</div>
        </Card>
      : shown.length === 0
      ? <Card style={{ textAlign: "center", padding: "34px 20px" }}>
          <i className="ti ti-search-off" style={{ fontSize: 26, color: T.textDim }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 10 }}>Nothing matches “{search}”</div>
          <button onClick={() => setSearch("")} className="ui-btn" style={{ marginTop: 12, padding: "9px 16px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Clear search</button>
        </Card>
      : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {shown.map((f) => {
            const ic = ICON(f);
            return <Card key={f.file_id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
              <div style={{ width: 40, height: 40, borderRadius: 13, background: `color-mix(in srgb, ${ic.c} 10%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <i className={`ti ${ic.i}`} style={{ fontSize: 20, color: ic.c }} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.file_name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginTop: 4, fontSize: 11.5, color: T.textMuted }}>
                  <Badge color={ic.c}>{KIND(f)}</Badge>
                  <span>{f.chunks || 0} piece{f.chunks === 1 ? "" : "s"} indexed</span>
                  {f.created_at && <><span style={{ color: T.textDim }}>·</span><span>{shortDate(f.created_at)}</span></>}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                {/* The original is already stored; linking it lets the owner
                    check what the bot is actually reading from. */}
                {f.file_url && <a href={f.file_url} target="_blank" rel="noreferrer" title="Open the original" aria-label="Open the original"
                  className="ui-sq" style={{ width: 36, height: 36, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, textDecoration: "none" }}><i className="ti ti-external-link" style={{ fontSize: 17 }} /></a>}
                <button onClick={() => setConfirm(f)} title="Remove" aria-label="Remove" className="ui-sq"
                  style={{ width: 36, height: 36, borderRadius: 11, background: "none", border: "none", cursor: "pointer", color: T.danger, display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ti ti-trash" style={{ fontSize: 17 }} /></button>
              </div>
            </Card>;
          })}
        </div>}

    {confirm && <div onClick={() => setConfirm(null)} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(17,19,24,.45)", backdropFilter: "blur(3px)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="ui-page" role="dialog" aria-modal="true"
        style={{ width: "100%", maxWidth: 420, background: T.card, borderRadius: isMobile ? "22px 22px 0 0" : 22, boxShadow: T.nmOut, border: `1px solid ${T.border}`, padding: "22px 20px calc(20px + env(safe-area-inset-bottom))" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, background: T.dangerBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><i className="ti ti-trash" style={{ fontSize: 20, color: T.danger }} /></div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700 }}>Remove this document?</div>
            <div style={{ fontSize: 12.5, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{confirm.file_name}</div>
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.65, marginBottom: 16 }}>
          The bot stops answering from it straight away, and all {confirm.chunks || 0} indexed pieces are deleted. This cannot be undone — keep your own copy of the file.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn onClick={() => setConfirm(null)} style={{ flex: 1, padding: "12px 20px", borderRadius: 14, fontSize: 14 }}>Keep it</Btn>
          <Btn danger onClick={() => del(confirm)} style={{ flex: 1, padding: "12px 20px", borderRadius: 14, fontSize: 14 }}>Remove</Btn>
        </div>
      </div>
    </div>}
  </div>;
}
