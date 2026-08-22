"use client";
import { useState, useEffect } from "react";
import { T, Card, Btn, Select, Badge, useIsMobile } from "./ui.js";
import { api } from "./session.js";

// The AI Engine tab — the client's own API key (BYOK) lives here, on its own
// page instead of buried in Bot Training. The super admin grants permission
// (/api/ai-key answers allowed:false otherwise). With permission the owner:
//   1. picks a provider (Google AI Studio or OpenAI) and pastes their key,
//   2. we read the LIVE list of models that key can actually use — never a
//      hardcoded id, which is what produced the "gemini-2.5-flash is no longer
//      available" 404 — and
//   3. they choose a MAIN model and an optional FALLBACK. At runtime the bot
//      tries the main first, then the fallback, both on their own key
//      (src/lib/ai.js). The key is verified, stored encrypted, shown only masked.

const PROVIDERS = {
  google: { label: "Google AI Studio", icon: "ti-brand-google", color: "#4285F4", ph: "AIza…", help: "aistudio.google.com → Get API key" },
  openai: { label: "OpenAI", icon: "ti-brand-openai", color: "#10A37F", ph: "sk-…", help: "platform.openai.com → API keys" },
};

// A sensible default main model: prefer a cheap/fast one, else the first listed.
const guessMain = (provider, models) => {
  const pref = provider === "google" ? /flash/i : /mini|4o|4\.1/i;
  return models.find((m) => pref.test(m)) || models[0] || "";
};

export default function AIEngine() {
  const [st, setSt] = useState(null);          // /api/ai-key shape (null = loading)
  const isMobile = useIsMobile();

  const load = () => api("/api/ai-key", { cache: "no-store" }).then((r) => r.json()).then(setSt).catch(() => {});
  useEffect(() => {
    load();
    // The super admin can grant or revoke this while the tab is open.
    const onFocus = () => { if (!document.hidden) load(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => { window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, []);

  return (
    <div style={{ maxWidth: 700, paddingBottom: isMobile ? 90 : 40 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.01em" }}>AI Engine</div>
        <div style={{ fontSize: 12.5, color: T.textMuted, marginTop: 3, lineHeight: 1.55 }}>
          The brain behind your bot — which AI provider and models write its replies.
        </div>
      </div>
      {st === null
        ? <Card style={{ textAlign: "center", padding: "40px 20px", color: T.textDim, fontSize: 13 }}>
            <i className="ti ti-loader-2" style={{ fontSize: 22, animation: "spin 1s linear infinite" }} /><div style={{ marginTop: 8 }}>Loading…</div>
          </Card>
        : st.allowed
          ? <KeyManager st={st} setSt={setSt} isMobile={isMobile} />
          : <PlatformCard />}
    </div>
  );
}

// Shown when the account has NOT been granted its own key: it runs on the
// platform's shared AI, which is completely fine — this just explains that and
// how to change it, so the tab is never a dead end.
function PlatformCard() {
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <span style={{ width: 44, height: 44, borderRadius: 13, background: T.goldBg, color: T.gold, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
          <i className="ti ti-sparkles" /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Running on Autologic's AI</div>
          <div style={{ fontSize: 12.5, color: T.textMuted, marginTop: 2, lineHeight: 1.5 }}>Your bot uses the platform's AI — nothing to set up, and it is included in your plan.</div>
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.7, background: T.bgAlt, borderRadius: 12, padding: "12px 14px", boxShadow: T.nmIn }}>
        Want to run the bot on <b style={{ color: T.text }}>your own API key</b>, with your own AI billing and model choice? We can enable that for your account — just reach out to support and we'll switch this on for you.
      </div>
    </Card>
  );
}

function KeyManager({ st, setSt, isMobile }) {
  const hasKey = !!st.has_key;
  const savedModels = String(st.model || "").split(",").map((s) => s.trim()).filter(Boolean);
  const [editing, setEditing] = useState(false);
  const [confirmRm, setConfirmRm] = useState(false);
  const [msg, setMsg] = useState(null);        // {ok, text}

  const showForm = editing || !hasKey;
  const P = hasKey ? PROVIDERS[st.provider] : null;

  const removeKey = async () => {
    const r = await api("/api/ai-key", { method: "DELETE" }).then((x) => x.json()).catch(() => ({ error: "network" }));
    setConfirmRm(false);
    if (r.error) { setMsg({ ok: false, text: r.error }); return; }
    setSt(r); setEditing(false); setMsg({ ok: true, text: "Key removed — your bot is back on the platform's AI." });
  };

  return (
    <Card style={{ border: `1px solid color-mix(in srgb, ${T.gold} 25%, transparent)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <span style={{ width: 44, height: 44, borderRadius: 13, background: hasKey ? `${P.color}1a` : T.goldBg, color: hasKey ? P.color : T.gold, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 21, flexShrink: 0 }}>
          <i className={`ti ${hasKey ? P.icon : "ti-key"}`} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Your own API key</div>
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2, lineHeight: 1.5 }}>Your account is enabled to run the bot on your own key — the AI usage bills to you, not the platform.</div>
        </div>
      </div>

      {hasKey && !editing && (
        <div style={{ padding: "14px 16px", borderRadius: 14, background: T.bgAlt, boxShadow: T.nmIn }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 240px", minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{P.label}<span style={{ fontFamily: "monospace", fontWeight: 400, color: T.textMuted, marginLeft: 8 }}>{st.key_mask}</span></div>
              <div style={{ marginTop: 7, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                {st.status === "failing" ? <Badge color={T.danger}>Not working — bot paused</Badge> : <Badge color={T.success}>Active</Badge>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn small onClick={() => { setEditing(true); setMsg(null); }}>Replace / change models</Btn>
              {confirmRm
                ? <><Btn small danger onClick={removeKey}>Yes, remove</Btn><Btn small onClick={() => setConfirmRm(false)}>Cancel</Btn></>
                : <Btn small onClick={() => setConfirmRm(true)} style={{ color: T.danger, background: T.dangerBg }}>Remove</Btn>}
            </div>
          </div>

          {/* The model chain, in plain words. */}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}`, display: "flex", gap: 18, flexWrap: "wrap" }}>
            <div><div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, color: T.textDim, marginBottom: 3 }}>Main model</div><div style={{ fontSize: 13, fontFamily: "monospace", color: T.text }}>{savedModels[0] || "Platform default"}</div></div>
            <div><div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, color: T.textDim, marginBottom: 3 }}>Fallback</div><div style={{ fontSize: 13, fontFamily: "monospace", color: savedModels[1] ? T.text : T.textDim }}>{savedModels[1] || "None"}</div></div>
          </div>

          {st.status === "failing" && (
            <div style={{ fontSize: 11.5, color: T.warn, marginTop: 12, lineHeight: 1.55 }}>
              Your key hit its limit or was rejected, so the bot cannot answer right now. Top up / fix billing with the provider, or replace the key — replies resume automatically.
              {st.last_error ? <span style={{ display: "block", color: T.textDim, marginTop: 4 }} title={st.last_error}>Last error: {String(st.last_error).slice(0, 140)}</span> : null}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <KeyForm
          st={st} hasKey={hasKey} savedModels={savedModels} isMobile={isMobile}
          onCancel={hasKey ? () => { setEditing(false); setMsg(null); } : null}
          onSaved={(r) => { setSt(r); setEditing(false); setMsg({ ok: true, text: "Verified and saved. Your bot now runs on your own key." }); }}
          setMsg={setMsg}
        />
      )}

      {msg && (
        <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: msg.ok ? T.success : T.danger }}>
          <i className={`ti ${msg.ok ? "ti-check" : "ti-alert-circle"}`} style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} />
          <span style={{ lineHeight: 1.5 }}>{msg.text}</span>
        </div>
      )}
    </Card>
  );
}

// Provider + key → load the LIVE model list → choose main + fallback → activate.
function KeyForm({ st, hasKey, savedModels, isMobile, onCancel, onSaved, setMsg }) {
  const [provider, setProvider] = useState(hasKey ? st.provider : "google");
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [models, setModels] = useState(null);   // null = not loaded yet
  const [main, setMain] = useState(savedModels[0] || "");
  const [fallback, setFallback] = useState(savedModels[1] || "");
  const [busy, setBusy] = useState(false);       // "load" | "save" | false
  const P = PROVIDERS[provider];

  // Changing the provider or the key invalidates a previously loaded list.
  const resetList = () => { setModels(null); };

  const loadModels = async () => {
    if (!key.trim() || busy) return;
    setBusy("load"); setMsg(null);
    const r = await api("/api/ai-key/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, api_key: key.trim() }) }).then((x) => x.json()).catch(() => ({ error: "network" }));
    setBusy(false);
    if (r.error) { setModels(null); setMsg({ ok: false, text: r.error }); return; }
    const list = r.models || [];
    setModels(list);
    // Pre-select sensible choices the owner can override.
    const m = savedModels[0] && list.includes(savedModels[0]) ? savedModels[0] : guessMain(provider, list);
    setMain(m);
    setFallback(savedModels[1] && list.includes(savedModels[1]) && savedModels[1] !== m ? savedModels[1] : "");
    setMsg({ ok: true, text: `Key works — ${list.length} model${list.length === 1 ? "" : "s"} available. Choose your main and fallback.` });
  };

  const activate = async () => {
    if (!key.trim() || !main || busy) return;
    setBusy("save"); setMsg({ ok: true, text: "Verifying and saving…" });
    const chain = [main, fallback].filter((v, i, a) => v && a.indexOf(v) === i);
    const r = await api("/api/ai-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, api_key: key.trim(), models: chain }) }).then((x) => x.json()).catch(() => ({ error: "network" }));
    setBusy(false);
    if (r.error) { setMsg({ ok: false, text: r.error }); return; }
    onSaved(r);
  };

  const inpStyle = { width: "100%", background: T.bgAlt, boxShadow: T.nmIn, border: `1px solid ${T.border}`, borderRadius: 14, padding: "13px 56px 13px 16px", color: T.text, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

  return (
    <div style={{ marginTop: hasKey ? 4 : 0 }}>
      {/* Provider */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 12, color: T.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Provider</label>
        <Select wide value={provider} onChange={(v) => { setProvider(v); setKey(""); resetList(); setMain(""); setFallback(""); }}
          options={Object.entries(PROVIDERS).map(([v, p]) => ({ value: v, label: p.label, icon: p.icon }))} />
        <div style={{ fontSize: 11, color: T.textDim, marginTop: 5 }}>Get your key: {P.help}</div>
      </div>

      {/* Key */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <input type={show ? "text" : "password"} value={key} onChange={(e) => { setKey(e.target.value); resetList(); }} placeholder={`Paste your ${P.label} key — ${P.ph}`} className="ui-inp" style={inpStyle} inputMode="text" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        <button type="button" onClick={() => setShow((v) => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: 12, padding: 6 }}>{show ? "Hide" : "Show"}</button>
      </div>

      {models === null ? (
        <>
          <div style={{ fontSize: 11.5, color: T.textDim, marginBottom: 14, lineHeight: 1.6 }}>
            We check the key with {P.label}, read the models it can use, then store it encrypted — never shown again, only a masked form.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn gold onClick={loadModels} disabled={busy || !key.trim()} style={{ borderRadius: 12 }}>{busy === "load" ? "Checking…" : "Check key & load models"}</Btn>
            {onCancel && <Btn onClick={onCancel} disabled={!!busy} style={{ borderRadius: 12 }}>Cancel</Btn>}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, color: T.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Main model</label>
              <Select wide value={main} onChange={setMain} options={models} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: T.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Fallback <span style={{ textTransform: "none", letterSpacing: 0, color: T.textDim }}>· optional</span></label>
              <Select wide value={fallback} onChange={setFallback}
                options={[{ value: "", label: "None" }, ...models.filter((m) => m !== main).map((m) => ({ value: m, label: m }))]} />
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: T.textDim, marginBottom: 14, lineHeight: 1.6 }}>
            The bot uses your <b style={{ color: T.textMuted }}>main model</b> for every reply. If it is ever unavailable or out of quota, it falls back to your second choice — both on your own key.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn gold onClick={activate} disabled={busy || !main} style={{ borderRadius: 12 }}>{busy === "save" ? "Saving…" : "Verify & activate"}</Btn>
            <Btn onClick={() => setModels(null)} disabled={!!busy} style={{ borderRadius: 12 }}>Back</Btn>
            {onCancel && <Btn onClick={onCancel} disabled={!!busy} style={{ borderRadius: 12 }}>Cancel</Btn>}
          </div>
        </>
      )}
    </div>
  );
}
