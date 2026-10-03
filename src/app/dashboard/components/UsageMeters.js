"use client";
import { T } from "./ui.js";

// Every metered allowance in the client's package, with how much is used and how
// much is left — the rows come from entitlementsFor() (src/lib/entitlements.js),
// the same assembler the admin panel reads, so the owner and the client always
// see the same numbers. Shared by Billing (under the package) and Profile.
//
// A meter whose count could not be read shows "—", never 0: 0 would tell an
// owner at their limit that they had used nothing.

const tone = (pct) => (pct === null || pct === undefined ? T.textDim : pct >= 90 ? T.danger : pct >= 70 ? T.warn : T.success);
const n = (v) => Number(v).toLocaleString("en-IN");

export function PlanMeter({ m }) {
  const unread = m.used === null || m.used === undefined;
  return <div style={{ minWidth: 0 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, marginBottom: 4 }}>
      <span style={{ color: T.textMuted, minWidth: 0 }}>{m.label}</span>
      <span style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
        <b>{unread ? "—" : n(m.used)}</b><span style={{ color: T.textDim }}> / {m.unlimited ? "∞" : n(m.limit)}</span>
      </span>
    </div>
    <div style={{ height: 5, background: T.bgAlt, borderRadius: 3, overflow: "hidden" }}>
      <div style={{ height: "100%", width: m.pct === null || m.pct === undefined ? 0 : `${Math.min(100, m.pct)}%`, background: tone(m.pct), borderRadius: 3 }} />
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 10.5, color: T.textDim, marginTop: 3 }}>
      <span>{!m.unlimited && !unread ? `${n(m.remaining)} left` : ""}</span>
      {m.stored !== undefined && m.stored !== null && <span>{n(m.stored)} in your catalogue</span>}
    </div>
  </div>;
}

// Which meters the customer can raise themselves with Add more (lib/pricing.js).
export const RAISABLE = { messages: "replies", products: "products", documents: "docs", assistant: "assistant" };

// 90% or more used, and not unlimited: time to warn (owner, 2026-10-04).
export const nearLimit = (m) => !m.unlimited && m.pct !== null && m.pct !== undefined && m.pct >= 90;

export default function UsageMeters({ meters, period, onAddMore, skip = [] }) {
  if (!Array.isArray(meters) || !meters.length) return null;
  const shown = meters.filter((m) => !skip.includes(m.key));
  // Everything at 90% or more, the ones that can be raised first. Monthly ones
  // reset; total ones (products, documents) never do, so the sentence differs.
  const near = shown.filter(nearLimit);
  return <div>
    <div style={{ fontSize: 12.5, fontWeight: 600, margin: "0 0 10px" }}>
      Usage
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(220px,100%),1fr))", gap: "14px 22px" }}>
      {shown.map((m) => <PlanMeter key={m.key} m={m} />)}
    </div>
    {near.map((m) => {
      const full = (m.pct || 0) >= 100;
      const canRaise = !!RAISABLE[m.key] && !!onAddMore;
      return <div key={m.key} role="alert" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12, color: full ? T.danger : T.warn, marginTop: 10,
        padding: "8px 11px", borderRadius: 9, background: `color-mix(in srgb, ${full ? T.danger : T.warn} 8%, transparent)` }}>
        <i className="ti ti-alert-triangle" />
        <span style={{ flex: 1, minWidth: 180 }}>
          <b>{m.label}</b>: {full ? "used up" : `${m.pct}% used`} — {n(m.remaining || 0)} left.
          {" "}{m.total ? "This is your package's total and does not reset." : `It resets ${period === "day" ? "tomorrow" : "on the 1st"}.`}
        </span>
        {canRaise && <button type="button" onClick={() => onAddMore(RAISABLE[m.key])} style={{ border: "none", cursor: "pointer", borderRadius: 7, padding: "5px 11px", fontSize: 12, fontWeight: 700, background: T.gold, color: T.onGold }}>Add more</button>}
      </div>;
    })}
  </div>;
}
