"use client";
import { useState } from "react";
import { T, Btn, OnboardFrame, taka, shortDate } from "./ui.js";
import { api } from "./session.js";

// The only screen an account sees while its first package is being checked
// (owner, 2026-10-04: "until approval, only the 'payment under review' page").
// Nothing else opens until the payment is approved — then the dashboard opens
// by itself (dashboard-client.js polls /api/me while this is showing).
//
// The one exception, also the owner's: the free trial is open to everyone, so
// an account that has not used it may start it here and use the dashboard while
// it waits. When the payment is approved the package takes the trial's place.

const KIND = { topup: "more on your package", plan: "your package" };

export default function PendingPayment({ me, planName, onTrial, onSignOut }) {
  const p = me?.pending_payment || {};
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const startTrial = async () => {
    setBusy(true); setErr("");
    try {
      const r = await api("/api/me", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start_trial" }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) setErr(j.error || "Could not start the trial. Please try again.");
      else await onTrial();
    } catch { setErr("Could not start the trial. Please try again."); }
    setBusy(false);
  };
  const row = (k, v) => <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, padding: "7px 0", borderTop: `1px solid ${T.border}` }}>
    <span style={{ color: T.textMuted }}>{k}</span><span style={{ fontWeight: 600, textAlign: "right", wordBreak: "break-all" }}>{v}</span>
  </div>;

  return <OnboardFrame icon="ti-clock-hour-4" title="Payment under review"
    sub="We are checking your payment. Everything opens as soon as it is approved — usually within a few hours.">
    <div style={{ padding: "6px 16px 8px", borderRadius: 14, background: T.bgAlt, marginBottom: 16 }}>
      {row("For", `${planName(p.plan)}${p.byok ? " · own AI key" : ""}${p.kind === "topup" ? ` (${KIND.topup})` : ""}`)}
      {row("Amount", taka(p.amount))}
      {row("Paid with", `${String(p.method || "").toUpperCase()}${p.txn_id ? ` · ${p.txn_id}` : ""}`)}
      {row("Sent", shortDate(p.created_at))}
    </div>
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12.5, color: T.textMuted, lineHeight: 1.6, marginBottom: 18 }}>
      <i className="ti ti-bell-ringing" style={{ fontSize: 16, color: T.gold, flexShrink: 0, marginTop: 2 }} />
      <span>You do not need to stay on this page. We tell you on your phone and by email the moment it is approved, and this page opens your dashboard by itself.</span>
    </div>
    {!me?.trial_used && <>
      <Btn gold onClick={startTrial} disabled={busy} style={{ width: "100%", padding: "12px 18px", fontSize: 14 }}>
        {busy ? "Starting…" : "Use the free trial while you wait"}
      </Btn>
      <div style={{ textAlign: "center", fontSize: 11.5, color: T.textDim, marginTop: 8, lineHeight: 1.5 }}>
        Set up your bot now. When the payment is approved, your package takes the trial's place.
      </div>
    </>}
    {err && <div role="alert" style={{ fontSize: 12.5, color: T.danger, marginTop: 10 }}>{err}</div>}
    <div style={{ textAlign: "center", marginTop: 18 }}>
      <button type="button" onClick={onSignOut} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: 12.5 }}>Sign out</button>
    </div>
  </OnboardFrame>;
}
