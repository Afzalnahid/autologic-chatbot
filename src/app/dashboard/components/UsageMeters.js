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

export default function UsageMeters({ meters, period }) {
  if (!Array.isArray(meters) || !meters.length) return null;
  const full = meters.filter((m) => !m.unlimited && (m.pct || 0) >= 100);
  return <div>
    <div style={{ fontSize: 12.5, fontWeight: 600, margin: "0 0 10px" }}>
      Usage this {period === "day" ? "day" : "month"}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(220px,100%),1fr))", gap: "14px 22px" }}>
      {meters.map((m) => <PlanMeter key={m.key} m={m} />)}
    </div>
    {full.length > 0 && <div style={{ fontSize: 11.5, color: T.warn, marginTop: 12 }}>
      <i className="ti ti-alert-triangle" style={{ marginRight: 5 }} />
      Used up: {full.map((m) => m.label).join(", ")}. It resets {period === "day" ? "tomorrow" : "on the 1st"}, or upgrade for more.
    </div>}
  </div>;
}
