"use client";
import { useState, useRef, useEffect } from "react";
import { T, Card, Btn } from "./ui.js";
import { apiJson } from "./session.js";
import { describeAction } from "@/lib/inventory-actions.js";

// Look after the catalogue by talking to it.
//
// The owner is not a programmer and does not want to be. "How many box t-shirts
// are left", "the winter jackets are 1200 now", "we are out of the black polo" —
// each of those is one sentence, and each of them was a hunt through a grid, a
// drawer, a field and a save button.
//
// Nothing here changes anything on its own. The assistant answers, and where a
// change is implied it PROPOSES it: a card per product saying what would move
// and what it would move from, with a button under them. Untick the ones that
// are wrong. Nothing happens until the button is pressed, and the button says
// how many products it will touch.
//
// That is not caution for its own sake. A misheard sentence that silently
// becomes a wrong price is a price a customer gets quoted, and the owner finds
// out from the customer.

const CHIPS = [
  "What is running low?",
  "Which products have no price?",
  "How many products are out of stock?",
];

export default function InventoryAssistant({ products, refresh }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const endRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => { if (open) endRef.current?.scrollIntoView({ block: "nearest" }); }, [msgs, open, busy]);

  const ask = async (text) => {
    const q = String(text || "").trim();
    if (!q || busy) return;
    setErr(""); setInput("");
    // The question goes on screen before the request leaves, so the panel never
    // sits blank while a slow answer is on its way.
    const history = [...msgs, { role: "user", content: q }];
    setMsgs(history);
    setBusy(true);
    const r = await apiJson("/api/inventory-chat", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: history.map((m) => ({ role: m.role, content: m.content })) }),
    });
    setBusy(false);
    if (r.error) { setErr(r.error); return; }
    setMsgs((s) => [...s, {
      role: "assistant", content: r.reply,
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

  return <Card style={{ padding: 0, marginBottom: 14, overflow: "hidden" }}>
    <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="ui-btn"
      style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "13px 16px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", color: T.text, textAlign: "left", minHeight: 44 }}>
      <span style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 10, background: T.goldBg, display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ti ti-message-2-bolt" style={{ fontSize: 17, color: T.gold }} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>Ask about your inventory</span>
        <span style={{ display: "block", fontSize: 11.5, color: T.textMuted, marginTop: 1 }}>Prices, stock, adding and removing — in your own words. Nothing changes until you say so.</span>
      </span>
      <i className={`ti ti-chevron-${open ? "up" : "down"}`} style={{ fontSize: 16, color: T.textMuted, flexShrink: 0 }} />
    </button>

    {open && <div style={{ borderTop: `1px solid ${T.border}`, padding: "12px 16px 14px" }}>
      <div ref={boxRef} style={{ maxHeight: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
        {!msgs.length && <div style={{ padding: "6px 0 2px" }}>
          <div style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.65, marginBottom: 10 }}>
            Ask anything about the {products?.length || 0} product{products?.length === 1 ? "" : "s"} in this catalogue, or say what you want changed — “the winter jackets are 1200 now”, “we are out of the black polo”, “add a red cotton scarf at 350”.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {CHIPS.map((c) => <button key={c} type="button" onClick={() => ask(c)} className="ui-btn ob-chip"
              style={{ padding: "7px 12px", borderRadius: 20, fontSize: 12, background: T.bgAlt, border: `1px solid ${T.border}`, color: T.textMuted, cursor: "pointer", fontFamily: "inherit", minHeight: 34 }}>{c}</button>)}
          </div>
        </div>}

        {msgs.map((m, mi) => <div key={mi} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", gap: 8 }}>
          <div style={{ maxWidth: "88%", padding: "9px 13px", borderRadius: 14, fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap",
            background: m.role === "user" ? T.goldBg : T.bgAlt, color: m.role === "user" ? T.gold : T.text, boxShadow: m.role === "user" ? "none" : T.nmIn }}>{m.content}</div>

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

        {busy && <div style={{ fontSize: 12.5, color: T.textMuted, display: "flex", gap: 7, alignItems: "center" }}><i className="ti ti-loader-2" style={{ fontSize: 15 }} />Thinking…</div>}
        <div ref={endRef} />
      </div>

      {err && <div style={{ fontSize: 12.5, color: T.danger, display: "flex", gap: 6, marginBottom: 8 }}><i className="ti ti-alert-circle" style={{ fontSize: 15, flexShrink: 0 }} /><span>{err}</span></div>}

      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} style={{ display: "flex", gap: 8 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} disabled={busy} placeholder="Ask, or say what to change…" aria-label="Ask about your inventory"
          className="ui-inp" style={{ flex: 1, minWidth: 0, background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 12, padding: "11px 14px", color: T.text, fontSize: 13, outline: "none", fontFamily: "inherit", boxShadow: T.nmIn }} />
        <Btn gold type="submit" disabled={busy || !input.trim()} style={{ borderRadius: 12, padding: "9px 16px", minHeight: 44 }}><i className="ti ti-send" style={{ fontSize: 16 }} /></Btn>
      </form>
    </div>}
  </Card>;
}
