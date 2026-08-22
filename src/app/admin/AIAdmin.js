"use client";
import { useState, useEffect, useCallback } from "react";
import { T, Card, Btn, Badge, Select } from "../dashboard/components/ui.js";

// The platform's own AI engine — the key and models that answer for every client
// who is NOT on their own key. Same shape as the client's AI Engine tab so the
// two feel like one product.
//
// Guarded twice: full-access admin, plus the secret admin key on save. This key
// is what every reply is billed to, so changing it is not a casual edit.

const PROVIDERS = {
  google: { label: "Google AI Studio", icon: "ti-brand-google", color: "#4285F4", ph: "AIza…", help: "aistudio.google.com → Get API key" },
  openai: { label: "OpenAI", icon: "ti-brand-openai", color: "#10A37F", ph: "sk-…", help: "platform.openai.com → API keys" },
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

export default function AIAdmin({ token, superKey, setSuperKey }) {
  const [st, setSt] = useState(null);
  const [provider, setProvider] = useState("google");
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
      .then((x) => x.json()).catch(() => ({ error: "network" }));
    if (r.error) { setMsg({ ok: false, text: r.error }); return; }
    setSt(r);
    setProvider(r.provider || "google");
    const saved = String(r.model_chain || "").split(",").map((s) => s.trim()).filter(Boolean);
    setMain(saved[0] || ""); setFallback(saved[1] || "");
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const post = async (body, withKey) => {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/admin/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(withKey ? { "x-admin-key": superKey || "" } : {}) },
      body: JSON.stringify(body),
    }).then((x) => x.json()).catch(() => ({ error: "network" }));
    setBusy(false);
    if (r.error) { setMsg({ ok: false, text: r.error }); return null; }
    return r;
  };

  const loadModels = async () => {
    const r = await post({ action: "list_models", provider, api_key: key.trim() }, false);
    if (!r) return;
    const list = r.models || [];
    setModels(list);
    const savedChain = String(st?.model_chain || "").split(",").map((s) => s.trim()).filter(Boolean);
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
    const r = await post({ action: "save", provider, api_key: key.trim(), models: chain }, true);
    if (!r) return;
    setSt(r); setKey(""); setModels(null);
    setMsg({ ok: true, text: "Saved. Every client on the platform key now uses this." });
  };

  const removeKey = async () => {
    if (!superKey) { setMsg({ ok: false, text: "Enter the secret admin key to remove." }); return; }
    const r = await post({ action: "remove_key" }, true);
    if (!r) return;
    setSt(r); setMsg({ ok: true, text: "Saved key removed — the platform is back on the environment variable." });
  };

  if (!st) return <Card style={{ textAlign: "center", padding: "44px 20px", color: T.textDim }}>Loading…</Card>;

  const P = PROVIDERS[provider];
  const inp = { width: "100%", background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", color: T.text, fontSize: 13.5, fontFamily: "inherit", boxSizing: "border-box" };

  return <div style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 12 }}>
    {/* What is live right now */}
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <span style={{ width: 44, height: 44, borderRadius: 13, background: `${P.color}1a`, color: P.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 21 }}>
          <i className={`ti ${P.icon}`} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>The platform's AI key</div>
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2, lineHeight: 1.5 }}>
            This key answers for every client who is not on their own key — you pay for it.
          </div>
        </div>
      </div>
      <div style={{ padding: "12px 14px", borderRadius: 12, background: T.bgAlt, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          {st.has_key ? <>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{PROVIDERS[st.provider]?.label || st.provider}
              <span style={{ fontFamily: "monospace", fontWeight: 400, color: T.textMuted, marginLeft: 8 }}>{st.key_mask}</span></div>
            <div style={{ marginTop: 6 }}><Badge color={T.success}>Saved here</Badge></div>
          </> : <>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{st.env_present ? "Using the server's environment key" : "No key anywhere"}</div>
            <div style={{ marginTop: 6 }}><Badge color={st.env_present ? T.warn : T.danger}>{st.env_present ? "GEMINI_API_KEY" : "Bot cannot reply"}</Badge></div>
          </>}
          <div style={{ fontSize: 11.5, color: T.textDim, marginTop: 6, lineHeight: 1.55 }}>
            {st.has_key
              ? "Saving a key here overrides the environment variable. Remove it to fall back."
              : "Paste a key below to manage it from here instead of Vercel. Leave it empty to keep using the environment key and only change the models."}
          </div>
        </div>
        {st.has_key && <Btn small disabled={busy} onClick={removeKey} style={{ color: T.danger, background: T.dangerBg }}>Remove</Btn>}
      </div>

      {/* Which models are live */}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}`, display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div><div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, color: T.textDim, marginBottom: 3 }}>Main model</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{String(st.model_chain || "").split(",")[0] || "Built-in default"}</div></div>
        <div><div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, color: T.textDim, marginBottom: 3 }}>Fallback</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: String(st.model_chain || "").split(",")[1] ? T.text : T.textDim }}>
            {String(st.model_chain || "").split(",")[1] || "None"}</div></div>
      </div>
    </Card>

    {/* Change it */}
    <Card>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Change the key or models</div>

      <label style={{ display: "block", fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Provider</label>
      <Select wide value={provider} onChange={(v) => { setProvider(v); setModels(null); setKey(""); }}
        options={Object.entries(PROVIDERS).map(([v, p]) => ({ value: v, label: p.label, icon: p.icon }))} />
      <div style={{ fontSize: 11, color: T.textDim, margin: "5px 0 12px" }}>Get a key: {P.help}</div>

      <div style={{ position: "relative", marginBottom: 10 }}>
        <input type={show ? "text" : "password"} value={key} onChange={(e) => { setKey(e.target.value); setModels(null); }}
          placeholder={st.has_key ? `Paste a new ${P.label} key — or leave empty to keep the current one` : `Paste your ${P.label} key — ${P.ph}`}
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

        <label style={{ display: "block", fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Secret admin key</label>
        <input type="password" value={superKey || ""} onChange={(e) => setSuperKey(e.target.value)} placeholder="Required to save" style={{ ...inp, marginBottom: 12 }} />

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn gold disabled={busy || !main} onClick={save} style={{ borderRadius: 12 }}>{busy ? "Saving…" : "Save"}</Btn>
          <Btn onClick={() => setModels(null)} disabled={busy} style={{ borderRadius: 12 }}>Back</Btn>
        </div>
      </>}

      {msg && <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: msg.ok ? T.success : T.danger }}>
        <i className={`ti ${msg.ok ? "ti-check" : "ti-alert-circle"}`} style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} />
        <span style={{ lineHeight: 1.5 }}>{msg.text}</span>
      </div>}
    </Card>
  </div>;
}
