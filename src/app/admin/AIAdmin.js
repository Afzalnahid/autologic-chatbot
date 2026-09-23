"use client";
import { useState, useEffect, useCallback } from "react";
import { T, Card, Btn, Badge, Select, Switch } from "../dashboard/components/ui.js";
import { readJson, offlineError } from "@/lib/api-error.js";

// The platform's own AI engine — the keys and models that answer for every
// client who is NOT on their own key.
//
// Two providers, one switch (owner, 2026-09-24): turning one on turns the other
// off, both may be off, both on is impossible. With both off the platform falls
// back to the server's GEMINI_API_KEY, which is how it ran before this existed —
// so "off, off" is a safe state, not a broken one.
//
// Guarded twice: full-access admin, plus the secret admin key on anything that
// changes a key, a model or the switch. These keys are what every reply is
// billed to, so none of it is a casual edit.

const LOOK = {
  google: { icon: "ti-brand-google", color: "#4285F4", ph: "AIza…", help: "aistudio.google.com → Get API key" },
  openai: { icon: "ti-brand-openai", color: "#10A37F", ph: "sk-…", help: "platform.openai.com → API keys" },
};

const optLabel = (m) => `${m.name || m.id}${m.tier === "fast" ? "  (Low cost · Fast)" : m.tier === "smart" ? "  (More powerful · Higher cost)" : ""}`;
const nameOf = (models, id) => models.find((m) => m.id === id)?.name || id;

const chip = (models, id) => {
  const m = models.find((x) => x.id === id);
  if (!m) return null;
  const fast = m.tier === "fast";
  return <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: .4, padding: "2px 7px", borderRadius: 20, background: fast ? `color-mix(in srgb, ${T.success} 15%, transparent)` : T.goldBg, color: fast ? T.success : T.gold }}>
    {fast ? "FAST" : "QUALITY"}
  </span>;
};

const chainOf = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);

export default function AIAdmin({ token, superKey, setSuperKey }) {
  const [st, setSt] = useState(null);
  const [edit, setEdit] = useState("google");
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [models, setModels] = useState(null);
  const [main, setMain] = useState("");
  const [fallback, setFallback] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    const r = await fetch(`/api/admin/ai?t=${Date.now()}`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } })
      .then(readJson).catch(offlineError);
    if (r.error) { setMsg({ ok: false, text: r.error }); return; }
    setSt(r);
    // Open on whichever one is live, so the screen shows what matters first.
    setEdit((cur) => cur || r.active || "google");
  }, [token]);
  useEffect(() => { load(); }, [load]);

  // When the provider being edited changes, the key box and the model list
  // belong to the other provider and must not be carried across.
  useEffect(() => {
    setKey(""); setModels(null); setMsg(null);
    const row = st?.providers?.find((p) => p.id === edit);
    const saved = chainOf(row?.model_chain);
    setMain(saved[0] || ""); setFallback(saved[1] || "");
  }, [edit, st]);

  const post = async (body, withKey) => {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/admin/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(withKey ? { "x-admin-key": superKey || "" } : {}) },
      body: JSON.stringify(body),
    }).then(readJson).catch(offlineError);
    setBusy(false);
    if (r.error) { setMsg({ ok: false, text: r.error }); return null; }
    return r;
  };

  const labelOf = (state, id) => state.providers.find((p) => p.id === id)?.label || id;

  // The switch. Pressing the one that is already on turns it off, which puts
  // the platform back on the environment key.
  const toggle = async (id) => {
    if (!superKey) { setMsg({ ok: false, text: "Enter the secret admin key below to change the switch." }); return; }
    const wanted = st.active === id ? null : id;
    const r = await post({ action: "set_active", active: wanted }, true);
    if (!r) return;
    setSt(r);
    setMsg({
      ok: true,
      text: wanted
        ? `${labelOf(r, wanted)} is now answering for every client on the platform key. Products and documents are being re-indexed in the background — search may find fewer items for a few minutes, never the wrong ones.`
        : "Both providers are off — the platform is back on the server's GEMINI_API_KEY.",
    });
  };

  const loadModels = async () => {
    const r = await post({ action: "list_models", provider: edit, api_key: key.trim() }, false);
    if (!r) return;
    const list = r.models || [];
    setModels(list);
    const row = st.providers.find((p) => p.id === edit);
    const savedChain = chainOf(row?.model_chain);
    const ids = list.map((m) => m.id);
    const m = savedChain[0] && ids.includes(savedChain[0]) ? savedChain[0] : (list.find((x) => x.tier === "fast") || list[0])?.id || "";
    setMain(m);
    setFallback(savedChain[1] && ids.includes(savedChain[1]) && savedChain[1] !== m
      ? savedChain[1]
      : (list.find((x) => x.tier === "smart" && x.id !== m) || {}).id || "");
    setMsg({ ok: true, text: `Key works — ${list.length} models available. Pick your main and fallback, then save.` });
  };

  const save = async () => {
    if (!superKey) { setMsg({ ok: false, text: "Enter the secret admin key to save." }); return; }
    const chain = [main, fallback].filter((v, i, a) => v && a.indexOf(v) === i);
    const r = await post({ action: "save", provider: edit, api_key: key.trim(), models: chain }, true);
    if (!r) return;
    setSt(r); setKey(""); setModels(null);
    let extra = "";
    if (r.vercel?.ok) extra = " Also updated the Vercel env variable (takes effect on the next deploy — the live key already changed here).";
    else if (r.vercel && r.vercel.skipped) extra = " (Vercel env not synced — add a VERCEL_TOKEN to enable that.)";
    else if (r.vercel && r.vercel.reason) extra = ` (Vercel env sync failed: ${r.vercel.reason})`;
    const on = r.active === edit;
    setMsg({ ok: true, text: `Saved.${on ? " Every client on the platform key now uses this." : " Switch it on above to make it live."}${extra}` });
  };

  const removeKey = async (id) => {
    if (!superKey) { setMsg({ ok: false, text: "Enter the secret admin key to remove." }); return; }
    const r = await post({ action: "remove_key", provider: id }, true);
    if (!r) return;
    setSt(r);
    setMsg({ ok: true, text: "Key removed. That provider is switched off; the platform uses whatever else is on, or the environment key." });
  };

  if (!st) return <Card style={{ textAlign: "center", padding: "44px 20px", color: T.textDim }}>Loading…</Card>;

  const row = st.providers.find((p) => p.id === edit) || st.providers[0];
  const L = LOOK[edit] || LOOK.google;
  const inp = { width: "100%", background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", color: T.text, fontSize: 13.5, fontFamily: "inherit", boxSizing: "border-box" };

  return <div style={{ maxWidth: 680, display: "flex", flexDirection: "column", gap: 12 }}>
    {/* ── which one is answering ─────────────────────────────────────────── */}
    <Card>
      <div style={{ fontSize: 15, fontWeight: 700 }}>Which AI runs the platform</div>
      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 3, lineHeight: 1.55, marginBottom: 12 }}>
        One at a time. Switching one on switches the other off — chats, photographs, voice notes and product search all run on the same key.
      </div>

      {st.providers.map((p) => {
        const look = LOOK[p.id] || LOOK.google;
        const live = st.active === p.id;
        return <div key={p.id} style={{
          display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, marginBottom: 8,
          background: live ? `color-mix(in srgb, ${T.success} 8%, ${T.bgAlt})` : T.bgAlt,
          border: `1px solid ${live ? `color-mix(in srgb, ${T.success} 35%, transparent)` : "transparent"}`,
        }}>
          <span style={{ width: 38, height: 38, borderRadius: 11, background: `${look.color}1a`, color: look.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 19, flexShrink: 0 }}>
            <i className={`ti ${look.icon}`} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {p.label}
              {live && <Badge color={T.success}>Answering now</Badge>}
              {!p.has_key && <Badge color={T.textDim}>No key</Badge>}
            </div>
            <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 3, fontFamily: p.has_key ? "monospace" : "inherit" }}>
              {p.has_key ? p.key_mask : `Save a ${p.key_label} to use this one`}
            </div>
            {p.model_chain && <div style={{ fontSize: 11, color: T.textDim, marginTop: 3 }}>
              {chainOf(p.model_chain)[0]}{chainOf(p.model_chain)[1] ? ` → ${chainOf(p.model_chain)[1]}` : ""}
            </div>}
          </div>
          <Switch on={live} tone="live" disabled={busy || (!p.has_key && !p.env_present)}
            onClick={() => toggle(p.id)} title={live ? `Switch ${p.label} off` : `Switch ${p.label} on`} />
        </div>;
      })}

      {!st.active && <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, padding: "10px 12px", borderRadius: 12, background: st.env_present ? T.warnBg : T.dangerBg, color: st.env_present ? T.warn : T.danger }}>
        <i className="ti ti-alert-circle" style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} />
        <span style={{ lineHeight: 1.5 }}>
          {st.env_present
            ? "Both switched off — the platform is running on the server's GEMINI_API_KEY. That works, but the models below are not in use."
            : "Both switched off and there is no GEMINI_API_KEY on the server. No client on the platform key can get a reply."}
        </span>
      </div>}
    </Card>

    {/* ── edit one of them ───────────────────────────────────────────────── */}
    <Card>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {st.providers.map((p) => (
          <button key={p.id} type="button" onClick={() => setEdit(p.id)} style={{
            padding: "8px 14px", borderRadius: 10, cursor: "pointer", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit",
            border: `1px solid ${edit === p.id ? T.gold : T.border}`,
            background: edit === p.id ? T.goldBg : "transparent", color: edit === p.id ? T.gold : T.textMuted,
          }}>{p.label}</button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12, padding: "10px 12px", borderRadius: 12, background: T.bgAlt }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, background: `${L.color}1a`, color: L.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}><i className={`ti ${L.icon}`} /></span>
        <div style={{ minWidth: 0, fontSize: 12.5, flex: 1 }}>
          <b>{row.label}</b>
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 1 }}>Get a key: {L.help}</div>
        </div>
        {row.has_key && <Btn small disabled={busy} onClick={() => removeKey(row.id)} style={{ color: T.danger, background: T.dangerBg }}>Remove key</Btn>}
      </div>

      <div style={{ fontSize: 11.5, color: T.textDim, marginBottom: 10, lineHeight: 1.6 }}>
        Search vectors are made by <b>{row.embed_model}</b> on this provider. Changing which provider is live changes that space, so every product and document is re-indexed automatically in the background — nothing to press.
      </div>

      <div style={{ position: "relative", marginBottom: 10 }}>
        <input type={show ? "text" : "password"} value={key} onChange={(e) => { setKey(e.target.value); setModels(null); }}
          placeholder={row.has_key ? `Paste a new ${row.key_label} — or leave empty to keep the current one` : `Paste your ${row.key_label} — ${L.ph}`}
          style={{ ...inp, paddingRight: 56 }} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        <button type="button" onClick={() => setShow((v) => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: 12 }}>{show ? "Hide" : "Show"}</button>
      </div>

      {models === null ? (
        <Btn gold disabled={busy} onClick={loadModels} style={{ borderRadius: 12 }}>
          {busy ? "Checking…" : "Check key & load models"}
        </Btn>
      ) : <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Main model</label>
            <Select wide value={main} onChange={setMain} options={models.map((m) => ({ value: m.id, label: optLabel(m) }))} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Fallback <span style={{ textTransform: "none", letterSpacing: 0, color: T.textDim }}>· optional</span></label>
            <Select wide value={fallback} onChange={setFallback}
              options={[{ value: "", label: "None" }, ...models.filter((m) => m.id !== main).map((m) => ({ value: m.id, label: optLabel(m) }))]} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", fontSize: 12.5, background: T.bgAlt, borderRadius: 12, padding: "11px 13px", marginBottom: 12 }}>
          <span style={{ fontWeight: 600 }}>{main ? nameOf(models, main) : "—"}</span>{chip(models, main)}
          <i className="ti ti-arrow-right" style={{ color: T.textDim, fontSize: 14 }} />
          {fallback ? <><span style={{ fontWeight: 600 }}>{nameOf(models, fallback)}</span>{chip(models, fallback)}</> : <span style={{ color: T.textDim }}>no fallback</span>}
        </div>
        <div style={{ fontSize: 11.5, color: T.textDim, marginBottom: 12, lineHeight: 1.6 }}>
          Every reply uses the main model. If it is out of quota or retired, the bot falls back to the second one automatically. A package or a single client can still override this.
        </div>
      </>}

      <label style={{ display: "block", fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1, margin: "12px 0 6px" }}>Secret admin key</label>
      <input type="password" value={superKey || ""} onChange={(e) => setSuperKey(e.target.value)} placeholder="Required to save or to change the switch" style={{ ...inp, marginBottom: 12 }} />

      {models !== null && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Btn gold disabled={busy || !main} onClick={save} style={{ borderRadius: 12 }}>{busy ? "Saving…" : "Save"}</Btn>
        <Btn onClick={() => setModels(null)} disabled={busy} style={{ borderRadius: 12 }}>Back</Btn>
      </div>}

      <div style={{ fontSize: 11, color: st.vercel_sync ? T.success : T.textDim, marginTop: 12, display: "flex", alignItems: "center", gap: 5, lineHeight: 1.5 }}>
        <i className={`ti ${st.vercel_sync ? "ti-cloud-check" : "ti-cloud-off"}`} />
        {st.vercel_sync
          ? "Vercel env sync is ON — a new Google key here also updates GEMINI_API_KEY in Vercel (live after the next deploy)."
          : "Vercel env sync is off. Add a VERCEL_TOKEN in Vercel to also mirror a Google key into the env variable."}
      </div>

      {msg && <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: msg.ok ? T.success : T.danger }}>
        <i className={`ti ${msg.ok ? "ti-check" : "ti-alert-circle"}`} style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} />
        <span style={{ lineHeight: 1.5 }}>{msg.text}</span>
      </div>}
    </Card>
  </div>;
}
