"use client";
import { useState, useEffect, useCallback } from "react";
import { T, Card, Btn, Badge } from "../dashboard/components/ui.js";
import { readJson, offlineError } from "@/lib/api-error.js";

// Meta webhook health (super admin). One card per webhook object — Facebook
// Pages, WhatsApp, Instagram — showing the fields the Meta APP is subscribed
// to, with a repair button when one is missing. The 2026-09-11 case was
// `message_echoes` (a reply the owner types in Business Suite / Messenger
// never reached the inbox or the bot); WhatsApp's twin is
// `smb_message_echoes` (a reply typed on the owner's own phone).
// Everything runs server-side (/api/admin/webhooks); app secrets and the
// verify token stay on the server.

const WHY = {
  messages: "Customer messages reach the bot",
  messaging_postbacks: "Button taps in Messenger",
  message_echoes: "Replies YOU type in Business Suite / Messenger reach the inbox and the bot's memory",
  feed: "Comments on your posts",
  smb_message_echoes: "Replies you type in the WhatsApp Business app on your phone reach the inbox and the bot's memory",
  comments: "Comments on your Instagram posts",
};

export default function Webhooks({ token, superKey, setSuperKey }) {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    const r = await fetch(`/api/admin/webhooks?t=${Date.now()}`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } })
      .then(readJson).catch(offlineError);
    setBusy(false);
    if (r.error) { setMsg({ ok: false, text: r.error }); return; }
    setRows(r.objects || []); setMsg(null);
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const repair = async (object, label) => {
    if (!superKey) { setMsg({ ok: false, text: "Enter the secret admin key to repair." }); return; }
    setBusy(true); setMsg(null);
    const r = await fetch("/api/admin/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-admin-key": superKey },
      body: JSON.stringify({ object }),
    }).then(readJson).catch(offlineError);
    setBusy(false);
    if (r.error) { setMsg({ ok: false, text: r.error }); return; }
    setRows(r.objects || []);
    const row = (r.objects || []).find((o) => o.object === object);
    setMsg(row?.missing?.length
      ? { ok: false, text: `Meta accepted the change for ${label} but still reports missing: ${row.missing.join(", ")}` }
      : { ok: true, text: `${label} repaired. Every required field is on.` });
  };

  const inp = { width: "100%", background: T.bgAlt, boxShadow: T.nmIn, border: `1px solid ${T.border}`, borderRadius: 14, padding: "12px 14px", color: T.text, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  const anyMissing = !!rows?.some((o) => o.missing?.length);

  return <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 760 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <div style={{ fontSize: 12.5, color: T.textMuted, flex: "1 1 260px", lineHeight: 1.55 }}>
        What the Meta apps are subscribed to send this platform. A field missing here is never delivered, even when every connected Page, number or account asks for it.
      </div>
      <Btn onClick={load} disabled={busy} style={{ padding: "8px 14px", fontSize: 13 }}><i className="ti ti-refresh" style={{ marginRight: 6 }} />Check again</Btn>
    </div>

    {!rows && <Card style={{ color: T.textDim, fontSize: 13 }}>Checking Meta…</Card>}

    {rows?.map((o) => {
      const ok = !o.error && !o.missing?.length;
      return <Card key={o.object}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ width: 44, height: 44, borderRadius: 14, background: ok ? `color-mix(in srgb, ${T.success} 15%, transparent)` : T.goldBg, color: ok ? T.success : T.gold, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
            <i className={`ti ${o.object === "whatsapp_business_account" ? "ti-brand-whatsapp" : o.object === "instagram" ? "ti-brand-instagram" : "ti-brand-messenger"}`} /></span>
          <div style={{ flex: "1 1 220px", minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700 }}>
              {o.label} — {o.error ? "could not check" : ok ? "all required fields are on" : o.subscribed ? `missing: ${o.missing.join(", ")}` : "not subscribed at the app level"}
            </div>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 3, lineHeight: 1.55, overflowWrap: "anywhere" }}>
              {o.error ? o.error : o.callback_url ? <>callback <span style={{ fontFamily: "monospace" }}>{o.callback_url}</span></> : "Meta has no callback for this object yet."}
            </div>
          </div>
        </div>
        {!o.error && <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 7 }}>
          {o.required.map((f) => {
            const on = o.fields.includes(f);
            return <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 11, background: T.bgAlt, border: `0.5px solid ${T.border}`, flexWrap: "wrap" }}>
              <Badge color={on ? T.success : T.danger}>{on ? "on" : "missing"}</Badge>
              <span style={{ fontFamily: "monospace", fontSize: 12.5, flexShrink: 0 }}>{f}</span>
              <span style={{ fontSize: 12.5, color: T.textMuted, minWidth: 0 }}>{WHY[f] || ""}</span>
            </div>;
          })}
          {!!o.fields.filter((f) => !o.required.includes(f)).length &&
            <div style={{ fontSize: 12, color: T.textDim }}>Also on: {o.fields.filter((f) => !o.required.includes(f)).join(", ")}</div>}
        </div>}
        {!o.error && !ok && <div style={{ marginTop: 12 }}>
          <Btn onClick={() => repair(o.object, o.label)} disabled={busy} style={{ fontSize: 13 }}><i className="ti ti-tool" style={{ marginRight: 6 }} />{busy ? "Working…" : `Repair ${o.label}`}</Btn>
        </div>}
      </Card>;
    })}

    {anyMissing && <Card>
      <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 6 }}>Secret admin key</div>
      <div style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.6, marginBottom: 10 }}>
        A repair re-subscribes that object with its current fields plus the missing ones; nothing already on is removed. Meta verifies the callback URL during the change.
      </div>
      <input type="password" value={superKey || ""} onChange={(e) => setSuperKey(e.target.value)} placeholder="Required to repair" style={inp} />
    </Card>}

    {msg && <Card style={{ padding: "10px 14px", borderColor: `color-mix(in srgb, ${msg.ok ? T.success : T.danger} 40%, transparent)`, display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
      <i className={`ti ${msg.ok ? "ti-circle-check" : "ti-alert-circle"}`} style={{ color: msg.ok ? T.success : T.danger, fontSize: 18 }} /><span>{msg.text}</span>
    </Card>}
  </div>;
}
