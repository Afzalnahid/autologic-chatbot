"use client";
import { useState, useEffect, useCallback } from "react";
import { T, Card, Btn, Badge, Select, Segmented } from "../dashboard/components/ui.js";
import { readJson, offlineError } from "@/lib/api-error.js";
import { renderMarkdown } from "@/lib/blog-md.js";
import { MAX_TITLE, MAX_META, wordCount } from "@/lib/blog.js";

// The admin Blog tab (owner, 2026-10-04).
//
//   1. The owner's own OpenAI key (once) — checked with OpenAI, kept encrypted.
//   2. A keyword, a language (English, Bangla or both) and optional notes →
//      "Write draft". The draft is NOT public.
//   3. The owner reads it, edits anything, and presses "Approve & publish".
//      Only then is it on tellmoreai.com/blog. "Unpublish" takes it down.

const STATUS = { draft: ["Draft", "warn"], published: ["Published", "success"], unpublished: ["Unpublished", "textDim"] };
const LANG = { en: "English", bn: "বাংলা" };
const date = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const box = { width: "100%", boxSizing: "border-box", background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", color: T.text, fontSize: 13.5, fontFamily: "inherit" };
const lbl = { display: "block", fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1, margin: "12px 0 6px" };
const count = (n, max) => <span style={{ float: "right", color: n > max ? T.danger : T.textDim, textTransform: "none", letterSpacing: 0 }}>{n}/{max}</span>;

export default function Blog({ token, superKey, setSuperKey }) {
  const [st, setSt] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState("");
  const [filter, setFilter] = useState("draft");
  const [open, setOpen] = useState(null);        // the post in the editor
  // new draft
  const [keyword, setKeyword] = useState("");
  const [lang, setLang] = useState("en");
  const [notes, setNotes] = useState("");
  // key
  const [keyBox, setKeyBox] = useState("");
  const [models, setModels] = useState(null);
  const [showKey, setShowKey] = useState(false);

  const call = useCallback(async (body, withKey) => fetch("/api/admin/blog", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(withKey ? { "x-admin-key": superKey || "" } : {}) },
    body: JSON.stringify(body),
  }).then(readJson).catch(offlineError), [token, superKey]);

  const load = useCallback(async () => {
    if (!token) return;
    const r = await fetch(`/api/admin/blog?t=${Date.now()}`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } }).then(readJson).catch(offlineError);
    if (r.error) { setMsg({ ok: false, text: r.error }); return; }
    setSt(r);
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const openPost = async (id) => {
    setBusy("open:" + id);
    const r = await fetch(`/api/admin/blog?id=${id}&t=${Date.now()}`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } }).then(readJson).catch(offlineError);
    setBusy("");
    if (r.error) { setMsg({ ok: false, text: r.error }); return; }
    setOpen({ ...r.post, faq: Array.isArray(r.post.faq) ? r.post.faq : [] });
    window.scrollTo?.({ top: 0, behavior: "smooth" });
  };

  // ── the key ──
  const checkKey = async () => {
    setBusy("models"); setMsg(null);
    const r = await call({ action: "list_models", api_key: keyBox.trim() || undefined });
    setBusy("");
    if (r.error) { setMsg({ ok: false, text: r.error }); return; }
    setModels(r.models);
  };
  const saveKey = async () => {
    if (!superKey) { setMsg({ ok: false, text: "Enter the secret admin key below to save the key." }); return; }
    setBusy("key"); setMsg(null);
    const r = await call({ action: "save_key", api_key: keyBox.trim(), model: st?.settings?.model }, true);
    setBusy("");
    if (r.error) { setMsg({ ok: false, text: r.error }); return; }
    setKeyBox(""); setShowKey(false); setModels(r.models || null);
    setMsg({ ok: true, text: `Key saved (${r.key_mask}). Drafts will be written with ${r.model}.` });
    load();
  };
  const removeKey = async () => {
    if (!superKey) { setMsg({ ok: false, text: "Enter the secret admin key below to remove the key." }); return; }
    setBusy("key"); const r = await call({ action: "remove_key" }, true); setBusy("");
    if (r.error) { setMsg({ ok: false, text: r.error }); return; }
    setMsg({ ok: true, text: "Key removed. No drafts can be written until a new one is added." }); load();
  };
  const setModel = async (model) => {
    setBusy("model"); const r = await call({ action: "set_model", model }); setBusy("");
    if (r.error) { setMsg({ ok: false, text: r.error }); return; }
    setMsg({ ok: true, text: `Drafts will now be written with ${model}.` }); load();
  };

  // ── drafts ──
  const write = async () => {
    const k = keyword.trim();
    if (k.length < 3) { setMsg({ ok: false, text: "Write a keyword first." }); return; }
    setMsg(null);
    const langs = lang === "both" ? ["en", "bn"] : [lang];
    let first = null, last = null;
    for (const l of langs) {
      setBusy(`write:${l}`);
      const r = await call({ action: "generate", keyword: k, lang: l, notes, pair_of: first?.id });
      if (r.error) { setBusy(""); setMsg({ ok: false, text: `${LANG[l]} draft: ${r.error}` }); load(); return; }
      if (!first) first = r.post;
      last = r.post;
    }
    setBusy(""); setKeyword(""); setNotes("");
    setMsg({ ok: true, text: langs.length > 1 ? "Both drafts are ready. Read them, edit anything, then approve each one." : "The draft is ready. Read it, edit anything, then approve it." });
    setFilter("draft"); await load();
    setOpen({ ...first, faq: first.faq || [] });
    void last;
  };

  const save = async (andPublish) => {
    if (!open) return;
    setBusy(andPublish ? "publish" : "save"); setMsg(null);
    const r = await call({ action: "save", id: open.id, post: { title: open.title, slug: open.slug, meta_description: open.meta_description, excerpt: open.excerpt, body_md: open.body_md, faq: open.faq } });
    if (r.error) { setBusy(""); setMsg({ ok: false, text: r.error }); return; }
    let p = r.post;
    if (andPublish) {
      const r2 = await call({ action: "publish", id: open.id });
      if (r2.error) { setBusy(""); setMsg({ ok: false, text: r2.error }); return; }
      p = r2.post;
    }
    setBusy(""); setOpen({ ...p, faq: p.faq || [] });
    setMsg({ ok: true, text: andPublish ? `Published — live at tellmoreai.com/blog/${p.slug}` : "Saved." });
    load();
  };
  const act = async (action, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(action); setMsg(null);
    const r = await call({ action, id: open.id, notes: open.notes || "" });
    setBusy("");
    if (r.error) { setMsg({ ok: false, text: r.error }); return; }
    if (action === "discard") { setOpen(null); setMsg({ ok: true, text: "Draft discarded." }); }
    else { setOpen({ ...r.post, faq: r.post.faq || [] }); setMsg({ ok: true, text: action === "unpublish" ? "Taken off the site. It is kept here; publish it again any time." : action === "rewrite" ? "Rewritten. Read the new draft." : "Done." }); }
    load();
  };

  if (!st) return <Card style={{ textAlign: "center", padding: 40, color: T.textDim }}>{msg?.text || "Loading…"}</Card>;
  const s = st.settings || {};
  const posts = (st.posts || []).filter((p) => filter === "all" || p.status === filter);
  const counts = (st.posts || []).reduce((m, p) => ({ ...m, [p.status]: (m[p.status] || 0) + 1 }), {});
  const set = (k, v) => setOpen((o) => ({ ...o, [k]: v }));
  const writing = busy.startsWith("write:");

  return <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 980 }}>
    {msg && <Card style={{ padding: "10px 14px", fontSize: 13, color: msg.ok ? T.success : T.danger, display: "flex", gap: 8, alignItems: "center" }}>
      <i className={`ti ${msg.ok ? "ti-check" : "ti-alert-circle"}`} />{msg.text}
    </Card>}

    {/* ── The editor ── */}
    {open && <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 700, flex: 1, minWidth: 200 }}>{open.status === "published" ? "Published post" : "Draft"} · {LANG[open.lang]}</div>
        <Badge color={T[STATUS[open.status]?.[1]] || T.textDim}>{STATUS[open.status]?.[0]}</Badge>
        <button onClick={() => setOpen(null)} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: 18 }}><i className="ti ti-x" /></button>
      </div>
      <div style={{ fontSize: 12, color: T.textDim }}>Keyword: <b style={{ color: T.text }}>{open.keyword}</b>{open.model ? ` · written by ${open.model}` : ""}{open.tokens_out ? ` · ${(open.tokens_in || 0) + open.tokens_out} tokens` : ""}</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: 18 }}>
        <div>
          <label style={lbl}>Title {count((open.title || "").length, MAX_TITLE)}</label>
          <input value={open.title || ""} onChange={(e) => set("title", e.target.value)} style={box} />
          <label style={lbl}>Address</label>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12.5, color: T.textDim, whiteSpace: "nowrap" }}>/blog/</span>
            <input value={open.slug || ""} onChange={(e) => set("slug", e.target.value)} style={box} />
          </div>
          <label style={lbl}>Google description {count((open.meta_description || "").length, MAX_META)}</label>
          <textarea value={open.meta_description || ""} onChange={(e) => set("meta_description", e.target.value)} rows={2} style={{ ...box, resize: "vertical" }} />
          <label style={lbl}>Summary on the blog list</label>
          <textarea value={open.excerpt || ""} onChange={(e) => set("excerpt", e.target.value)} rows={2} style={{ ...box, resize: "vertical" }} />
          <label style={lbl}>Article (Markdown) <span style={{ float: "right", textTransform: "none", letterSpacing: 0, color: T.textDim }}>{wordCount(open.body_md)} words</span></label>
          <textarea value={open.body_md || ""} onChange={(e) => set("body_md", e.target.value)} rows={22} style={{ ...box, resize: "vertical", fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 12.5, lineHeight: 1.6 }} />
          <div style={{ fontSize: 11.5, color: T.textDim, marginTop: 5 }}>## Heading · ### Smaller heading · - list · 1. list · **bold** · *italic* · [text](/pricing)</div>
          <label style={lbl}>FAQ</label>
          {(open.faq || []).map((f, i) => <div key={i} style={{ display: "grid", gap: 6, marginBottom: 10, padding: 10, borderRadius: 10, border: `1px solid ${T.border}` }}>
            <input value={f.q} placeholder="Question" onChange={(e) => set("faq", open.faq.map((x, j) => j === i ? { ...x, q: e.target.value } : x))} style={box} />
            <textarea value={f.a} placeholder="Answer" rows={2} onChange={(e) => set("faq", open.faq.map((x, j) => j === i ? { ...x, a: e.target.value } : x))} style={{ ...box, resize: "vertical" }} />
            <button onClick={() => set("faq", open.faq.filter((_, j) => j !== i))} style={{ justifySelf: "start", background: "none", border: "none", color: T.danger, cursor: "pointer", fontSize: 12 }}><i className="ti ti-trash" /> Remove</button>
          </div>)}
          <Btn small onClick={() => set("faq", [...(open.faq || []), { q: "", a: "" }])}><i className="ti ti-plus" style={{ marginRight: 5 }} />Add a question</Btn>
        </div>

        {/* What a reader will see. */}
        <div>
          <label style={lbl}>Preview</label>
          <div lang={open.lang} style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 18px", maxHeight: 900, overflowY: "auto", background: T.card }}>
            <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.25, marginBottom: 10 }}>{open.title}</div>
            <div className="blog-preview" style={{ fontSize: 14, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: renderMarkdown(open.body_md).html }} />
            {(open.faq || []).filter((f) => f.q && f.a).length > 0 && <div style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 17, margin: "10px 0" }}>{open.lang === "bn" ? "সাধারণ প্রশ্ন" : "Frequently asked questions"}</div>
              {open.faq.filter((f) => f.q && f.a).map((f, i) => <div key={i} style={{ marginBottom: 8 }}><b>{f.q}</b><div style={{ fontSize: 13.5, color: T.textMuted }}>{f.a}</div></div>)}
            </div>}
          </div>
          <style>{`.blog-preview h2{font-size:18px;margin:18px 0 8px}.blog-preview h3{font-size:15.5px;margin:14px 0 6px}.blog-preview p{margin:0 0 10px}.blog-preview ul,.blog-preview ol{padding-left:20px;margin:0 0 10px}.blog-preview a{color:${T.gold}}.blog-preview blockquote{margin:10px 0;padding:8px 12px;border-left:3px solid ${T.gold};background:${T.bgAlt}}`}</style>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
        {st.can_edit && <>
          <Btn gold onClick={() => save(true)} disabled={!!busy}><i className="ti ti-world-upload" style={{ marginRight: 6 }} />{busy === "publish" ? "Publishing…" : open.status === "published" ? "Save & update live post" : "Approve & publish"}</Btn>
          <Btn onClick={() => save(false)} disabled={!!busy}>{busy === "save" ? "Saving…" : "Save draft"}</Btn>
          {open.status !== "published" && <Btn onClick={() => act("rewrite", "Write this draft again from the same keyword? Your edits to it will be replaced.")} disabled={!!busy}><i className="ti ti-refresh" style={{ marginRight: 5 }} />{busy === "rewrite" ? "Rewriting… (up to a minute)" : "Rewrite"}</Btn>}
          {open.status === "published" && <Btn onClick={() => act("unpublish", "Take this post off the site?")} disabled={!!busy}>Unpublish</Btn>}
          {open.status !== "published" && <Btn danger onClick={() => act("discard", "Discard this draft for good?")} disabled={!!busy}>Discard</Btn>}
        </>}
        {open.status === "published" && <a href={`/blog/${open.slug}`} target="_blank" rel="noopener" style={{ alignSelf: "center", fontSize: 13, color: T.gold, fontWeight: 600 }}>View on the site ↗</a>}
      </div>
    </Card>}

    {/* ── New draft ── */}
    {st.can_edit && <Card>
      <div style={{ fontSize: 15, fontWeight: 700 }}>Write a new post</div>
      <div style={{ fontSize: 12.5, color: T.textMuted, marginTop: 3, lineHeight: 1.6 }}>
        Give the keyword people search for. GPT writes a draft using TellMore's real prices and features — nothing goes on the site until you approve it.
      </div>
      {!s.has_key && <div style={{ fontSize: 12.5, color: T.warn, marginTop: 10 }}><i className="ti ti-key" style={{ marginRight: 6 }} />Add the OpenAI key below first.</div>}
      <label style={lbl}>Keyword</label>
      <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. facebook page auto reply bangladesh" style={box} disabled={writing} />
      <label style={lbl}>Language</label>
      <Segmented value={lang} onChange={setLang} items={[{ value: "en", label: "English" }, { value: "bn", label: "বাংলা" }, { value: "both", label: "Both" }]} />
      <label style={lbl}>Notes for the writer (optional)</label>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="e.g. for clothing shops on Facebook; mention cash on delivery orders" style={{ ...box, resize: "vertical" }} disabled={writing} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
        <Btn gold onClick={write} disabled={!!busy || !s.has_key}><i className="ti ti-pencil" style={{ marginRight: 6 }} />{writing ? `Writing the ${LANG[busy.slice(6)]} draft…` : "Write draft"}</Btn>
        {writing && <span style={{ fontSize: 12, color: T.textDim }}>This takes 20–60 seconds a language. Keep this page open.</span>}
      </div>
    </Card>}

    {/* ── Posts ── */}
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "14px 16px 8px" }}>
        <div style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>Posts</div>
        <Segmented size="sm" value={filter} onChange={setFilter} items={[
          { value: "draft", label: `Drafts${counts.draft ? ` · ${counts.draft}` : ""}` },
          { value: "published", label: `Published${counts.published ? ` · ${counts.published}` : ""}` },
          { value: "unpublished", label: "Unpublished" },
          { value: "all", label: "All" },
        ]} />
      </div>
      {posts.length === 0
        ? <div style={{ padding: "18px 16px 22px", fontSize: 13, color: T.textDim }}>{filter === "draft" ? "No drafts. Write one above." : "Nothing here yet."}</div>
        : posts.map((p, i) => <button key={p.id} onClick={() => openPost(p.id)} style={{ display: "flex", width: "100%", textAlign: "left", gap: 12, alignItems: "center", padding: "12px 16px", border: "none", borderTop: `1px solid ${T.border}`, background: open?.id === p.id ? T.bgAlt : "transparent", color: T.text, cursor: "pointer", fontFamily: "inherit", flexWrap: "wrap" }}>
          <span style={{ flex: "1 1 260px", minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} lang={p.lang}>{p.title}</span>
            <span style={{ display: "block", fontSize: 11.5, color: T.textDim, marginTop: 2 }}>{p.keyword} · /blog/{p.slug}</span>
          </span>
          <Badge color={T.textMuted}>{LANG[p.lang]}</Badge>
          <Badge color={T[STATUS[p.status]?.[1]] || T.textDim}>{STATUS[p.status]?.[0]}</Badge>
          <span style={{ fontSize: 11.5, color: T.textDim, minWidth: 86, textAlign: "right" }}>{date(p.published_at || p.created_at)}</span>
        </button>)}
    </Card>

    {/* ── The writer's key ── */}
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <i className="ti ti-brand-openai" style={{ fontSize: 20, color: T.gold }} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>Writer's OpenAI key</div>
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
            {s.has_key ? <>Saved: <b style={{ color: T.text, fontFamily: "monospace" }}>{s.key_mask}</b> · model <b style={{ color: T.text }}>{s.model}</b></> : "None yet."} Used only for blog drafts — separate from the bot's AI.
          </div>
        </div>
        {st.can_key && <Btn small onClick={() => setShowKey(!showKey)}>{s.has_key ? "Change" : "Add key"}</Btn>}
      </div>
      {st.can_key && s.has_key && <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
        <span style={{ fontSize: 12.5, color: T.textMuted }}>Model:</span>
        {models ? <Select value={s.model} onChange={(v) => setModel(v)} options={models.map((m) => ({ value: m.id, label: `${m.id}${m.note ? ` · ${m.note}` : ""}` }))} />
          : <Btn small onClick={checkKey} disabled={!!busy}>{busy === "models" ? "Asking OpenAI…" : "Choose a model"}</Btn>}
      </div>}
      {st.can_key && showKey && <div style={{ marginTop: 12 }}>
        <label style={lbl}>OpenAI API key</label>
        <input type="password" value={keyBox} onChange={(e) => setKeyBox(e.target.value)} placeholder="sk-…" style={box} autoComplete="off" />
        <label style={lbl}>Secret admin key</label>
        <input type="password" value={superKey || ""} onChange={(e) => setSuperKey(e.target.value)} placeholder="Required to save or remove the key" style={box} autoComplete="off" />
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <Btn gold onClick={saveKey} disabled={!!busy || !keyBox.trim()}>{busy === "key" ? "Checking with OpenAI…" : "Check & save"}</Btn>
          {s.has_key && <Btn danger onClick={removeKey} disabled={!!busy}>Remove key</Btn>}
        </div>
      </div>}
    </Card>
  </div>;
}
