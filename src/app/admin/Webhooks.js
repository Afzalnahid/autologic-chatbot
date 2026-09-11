"use client";
import { useState, useEffect, useCallback } from "react";
import { T, Card, Btn, Badge } from "../dashboard/components/ui.js";
import { readJson, offlineError } from "@/lib/api-error.js";

// Meta webhook health (super admin). Shows the fields the Facebook APP is
// subscribed to for Pages and repairs the list when one is missing — the
// 2026-09-11 case was `message_echoes`, without which a reply the owner types
// in Business Suite / the Messenger app never reaches the inbox or the bot.
// Everything runs server-side (/api/admin/webhooks); the app secret and the
// verify token stay on the server.

const WHY = {
  messages: "Customer messages reach the bot",
  messaging_postbacks: "Button taps in Messenger",
  message_echoes: "Replies YOU type in Business Suite / Messenger reach the inbox and the bot's memory",
  feed: "Comments on your posts",
};

export default function Webhooks({ token, superKey, setSuperKey }) {
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    const r = await fetch(`/api/admin/webhooks?t=${Date.now()}`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } })
      .then(readJson).catch(offlineError);
    setBusy(false);
    if (r.error) { setMsg({ ok: false, text: r.error }); return; }
    setSt(r); setMsg(null);
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const repair = async () => {
    if (!superKey) { setMsg({ ok: false, text: "Enter the secret admin key to repair." }); return; }
    setBusy(true); setMsg(null);
    const r = await fetch("/api/admin/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-admin-key": superKey },
      body: "{}",
    }).then(readJson).catch(offlineError);
    setBusy(false);
    if (r.error) { setMsg({ ok: false, text: r.error }); return; }
    setSt(r);
    setMsg(r.missing?.length
      ? { ok: false, text: "Meta accepted the change but still reports missing: " + r.missing.join(", ") }
      : { ok: true, text: "Repaired. Every required field is on. Reply to a customer from Business Suite once — it should appear in that chat within seconds." });
  };

  const inp = { width: "100%", background: T.bgAlt, boxShadow: T.nmIn, border: `1px solid ${T.border}`, borderRadius: 14, padding: "12px 14px", color: T.text, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  const ok = st && !st.missing?.length;

  return <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 720 }}>
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ width: 46, height: 46, borderRadius: 15, background: ok ? `color-mix(in srgb, ${T.success} 15%, transparent)` : T.goldBg, color: ok ? T.success : T.gold, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 23, flexShrink: 0 }}>
          <i className={`ti ${ok ? "ti-plug-connected" : "ti-plug-connected-x"}`} /></span>
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>
            {!st ? "Checking Meta…" : ok ? "Meta webhooks — all required fields are on" : `Meta webhooks — missing: ${st.missing.join(", ")}`}
          </div>
          <div style={{ fontSize: 12.5, color: T.textMuted, marginTop: 3, lineHeight: 1.55 }}>
            The Facebook app's Page subscription. A field missing here is never delivered, even when every connected Page asks for it.
            {st?.page?.callback_url ? <> · callback <span style={{ fontFamily: "monospace" }}>{st.page.callback_url}</span></> : null}
          </div>
        </div>
        <Btn onClick={load} disabled={busy} style={{ padding: "8px 14px", fontSize: 13 }}><i className="ti ti-refresh" style={{ marginRight: 6 }} />Check again</Btn>
      </div>
      {st && <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        {st.required.map((f) => {
          const on = st.page?.fields?.includes(f);
          return <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 11, background: T.bgAlt, border: `0.5px solid ${T.border}` }}>
            <Badge color={on ? T.success : T.danger}>{on ? "on" : "missing"}</Badge>
            <span style={{ fontFamily: "monospace", fontSize: 12.5, flexShrink: 0 }}>{f}</span>
            <span style={{ fontSize: 12.5, color: T.textMuted, minWidth: 0 }}>{WHY[f]}</span>
          </div>;
        })}
        {!!st.page?.fields?.filter((f) => !st.required.includes(f)).length &&
          <div style={{ fontSize: 12, color: T.textDim }}>Also on: {st.page.fields.filter((f) => !st.required.includes(f)).join(", ")}</div>}
      </div>}
    </Card>

    {st && !ok && <Card>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Repair</div>
      <div style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.6, marginBottom: 12 }}>
        Re-subscribes the app's Page webhook with the current fields plus the missing ones. Nothing already on is removed. Meta verifies the callback URL during the change.
      </div>
      <input type="password" value={superKey || ""} onChange={(e) => setSuperKey(e.target.value)} placeholder="Secret admin key — required to repair" style={{ ...inp, marginBottom: 12 }} />
      <Btn onClick={repair} disabled={busy} style={{ fontSize: 13.5 }}><i className="ti ti-tool" style={{ marginRight: 6 }} />{busy ? "Working…" : "Repair now"}</Btn>
    </Card>}

    {msg && <Card style={{ padding: "10px 14px", borderColor: `color-mix(in srgb, ${msg.ok ? T.success : T.danger} 40%, transparent)`, display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
      <i className={`ti ${msg.ok ? "ti-circle-check" : "ti-alert-circle"}`} style={{ color: msg.ok ? T.success : T.danger, fontSize: 18 }} /><span>{msg.text}</span>
    </Card>}
  </div>;
}
