"use client";
import { useState } from "react";
import { PLANS, PLAN_ORDER, formatMoney, yearlySavingMonths } from "@/lib/plans.js";

const T = {
  bg: "#05080f", card: "#0d1529", gold: "#f0c040", goldBg: "rgba(240,192,64,0.08)",
  text: "#e8e8ec", muted: "#8b9cbd", dim: "#64748b", border: "#1a2744", green: "#22c55e",
};

const COMPARE = [
  { label: "Customer messages", trial: "30 / day", starter: "3,000 / mo", pro: "15,000 / mo", agency: "Unlimited" },
  { label: "Channels", trial: "1", starter: "1", pro: "All 3", agency: "Unlimited" },
  { label: "AI replies (Bangla & English)", trial: true, starter: true, pro: true, agency: true },
  { label: "Live conversation inbox", trial: true, starter: true, pro: true, agency: true },
  { label: "Product catalogue & orders", trial: true, starter: true, pro: true, agency: true },
  { label: "Analytics dashboard", trial: false, starter: true, pro: true, agency: true },
  { label: "Photo product matching (Vision AI)", trial: true, starter: false, pro: true, agency: true },
  { label: "Knowledge Base (document upload)", trial: true, starter: false, pro: true, agency: true },
  { label: "Voice message understanding", trial: true, starter: false, pro: true, agency: true },
  { label: "Google Calendar booking", trial: true, starter: false, pro: false, agency: true },
  { label: "Priority support", trial: false, starter: false, pro: false, agency: true },
];

const FAQ = [
  { q: "How does the free trial work?", a: "You get 3 days of full access with 30 customer messages per day. No payment details needed to start — just sign up and connect a channel." },
  { q: "How do I pay?", a: "Send the amount by bKash, Nagad or Rocket to the number shown in your dashboard, then submit the transaction ID. We verify it and your plan activates, usually within a few hours." },
  { q: "What counts as a message?", a: "Only messages your customers send. The bot's own replies are never counted against your limit." },
  { q: "Can I change plan later?", a: "Yes. Upgrade any time from your dashboard — the new plan starts as soon as your payment is verified." },
  { q: "What happens when my plan expires?", a: "The bot stops replying to new customers, but nothing is deleted. Your products, knowledge base and conversation history stay safe until you renew." },
  { q: "Do you offer a yearly discount?", a: "Yes — pay yearly and you get two months free on every paid plan." },
];

function Check({ on }) {
  return on
    ? <span style={{ color: T.green, fontSize: 15 }}>✓</span>
    : <span style={{ color: T.dim, fontSize: 15 }}>—</span>;
}

export default function PricingClient() {
  const [cycle, setCycle] = useState("monthly");
  const wrap = { maxWidth: 1120, margin: "0 auto", padding: "0 20px" };
  const yearly = cycle === "yearly";

  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: "system-ui, sans-serif" }}>
      <nav style={{ borderBottom: `1px solid ${T.border}` }}>
        <div style={{ ...wrap, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px" }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: T.text }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: T.goldBg, border: `1px solid ${T.gold}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>🤖</div>
            <span style={{ fontSize: 18, fontWeight: 700 }}>Autologic</span>
          </a>
          <div style={{ display: "flex", gap: 9 }}>
            <a href="/dashboard?auth=signin" style={{ padding: "8px 16px", color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, fontWeight: 600, fontSize: 13.5, textDecoration: "none" }}>Log in</a>
            <a href="/dashboard?auth=signup" style={{ padding: "8px 18px", background: T.gold, color: "#0a0a0a", borderRadius: 8, fontWeight: 600, fontSize: 13.5, textDecoration: "none" }}>Sign up</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ ...wrap, textAlign: "center", padding: "56px 20px 32px" }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, margin: "0 0 14px", letterSpacing: -0.5 }}>Simple, honest pricing</h1>
        <p style={{ fontSize: 16, color: T.muted, maxWidth: 560, margin: "0 auto 28px", lineHeight: 1.7 }}>
          Start free for 3 days. Upgrade when your customers start rolling in. No hidden fees, cancel any time.
        </p>

        <div style={{ display: "inline-flex", background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 4, gap: 4 }}>
          {[["monthly", "Monthly"], ["yearly", "Yearly"]].map(([id, label]) => (
            <button key={id} onClick={() => setCycle(id)} style={{
              padding: "8px 20px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 600,
              background: cycle === id ? T.gold : "transparent", color: cycle === id ? "#0a0a0a" : T.muted,
            }}>{label}</button>
          ))}
        </div>
        {yearly && <div style={{ fontSize: 12.5, color: T.green, marginTop: 10 }}>2 months free on every paid plan</div>}
      </section>

      {/* Plan cards */}
      <section style={{ ...wrap, padding: "0 20px 56px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, alignItems: "stretch" }}>
          {PLAN_ORDER.map((id) => {
            const p = PLANS[id];
            const price = yearly ? p.yearly : p.monthly;
            const free = price === 0;
            const saving = yearlySavingMonths(id);
            return (
              <div key={id} style={{
                background: T.card, border: p.highlight ? `1.5px solid ${T.gold}` : `1px solid ${T.border}`,
                borderRadius: 14, padding: "26px 22px", display: "flex", flexDirection: "column", position: "relative",
              }}>
                {p.highlight && <div style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", background: T.gold, color: "#0a0a0a", fontSize: 11, fontWeight: 700, padding: "3px 12px", borderRadius: 20, whiteSpace: "nowrap" }}>MOST POPULAR</div>}
                <div style={{ fontSize: 17, fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 12.5, color: T.muted, marginTop: 4, minHeight: 34 }}>{p.tagline}</div>
                <div style={{ margin: "14px 0 4px", display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 30, fontWeight: 800 }}>{free ? "Free" : formatMoney(price)}</span>
                  {!free && <span style={{ fontSize: 13, color: T.muted }}>/{yearly ? "year" : "month"}</span>}
                </div>
                <div style={{ fontSize: 11.5, color: yearly && saving ? T.green : T.dim, minHeight: 18 }}>
                  {free ? "3 days, no card needed" : yearly && saving ? `${saving} months free` : `or ${formatMoney(p.yearly)}/year`}
                </div>

                <a href={free ? "/dashboard?auth=signup" : `/dashboard?upgrade=${id}&cycle=${cycle}`} style={{
                  display: "block", textAlign: "center", marginTop: 18, padding: "11px 0", borderRadius: 9,
                  fontWeight: 700, fontSize: 14, textDecoration: "none",
                  background: p.highlight ? T.gold : "transparent",
                  color: p.highlight ? "#0a0a0a" : T.text,
                  border: p.highlight ? "none" : `1px solid ${T.border}`,
                }}>{free ? "Start free trial" : "Choose " + p.name}</a>

                <ul style={{ listStyle: "none", padding: 0, margin: "20px 0 0", display: "flex", flexDirection: "column", gap: 9 }}>
                  {p.features.map((f, i) => (
                    <li key={i} style={{ fontSize: 12.8, color: T.muted, display: "flex", gap: 8, lineHeight: 1.55 }}>
                      <span style={{ color: T.green, flexShrink: 0 }}>✓</span><span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Comparison */}
      <section style={{ ...wrap, padding: "0 20px 56px" }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 18, textAlign: "center" }}>Compare plans</h2>
        <div style={{ overflowX: "auto", border: `1px solid ${T.border}`, borderRadius: 14, background: T.card }}>
          <table style={{ width: "100%", minWidth: 620, borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "14px 18px", color: T.muted, fontWeight: 500, fontSize: 12 }}>Feature</th>
                {PLAN_ORDER.map((id) => (
                  <th key={id} style={{ padding: "14px 12px", fontWeight: 700, fontSize: 13, color: PLANS[id].highlight ? T.gold : T.text }}>{PLANS[id].name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={{ padding: "12px 18px", color: T.text }}>{row.label}</td>
                  {PLAN_ORDER.map((id) => (
                    <td key={id} style={{ padding: "12px", textAlign: "center", color: T.muted }}>
                      {typeof row[id] === "boolean" ? <Check on={row[id]} /> : row[id]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11.5, color: T.dim, marginTop: 10, textAlign: "center" }}>
          Only messages sent by your customers count towards the limit — the bot's replies are free.
        </div>
      </section>

      {/* FAQ */}
      <section style={{ ...wrap, padding: "0 20px 56px" }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 18, textAlign: "center" }}>Questions people ask</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 14 }}>
          {FAQ.map((f, i) => (
            <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "18px 20px" }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 7 }}>{f.q}</div>
              <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.7 }}>{f.a}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ ...wrap, padding: "0 20px 64px", textAlign: "center" }}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "36px 24px" }}>
          <div style={{ fontSize: 21, fontWeight: 700, marginBottom: 8 }}>Still deciding?</div>
          <div style={{ fontSize: 14, color: T.muted, marginBottom: 20 }}>Start the 3-day trial — it takes two minutes and costs nothing.</div>
          <a href="/dashboard?auth=signup" style={{ display: "inline-block", padding: "12px 28px", background: T.gold, color: "#0a0a0a", borderRadius: 10, fontWeight: 700, fontSize: 14.5, textDecoration: "none" }}>Start free trial</a>
        </div>
      </section>

      <footer style={{ borderTop: `1px solid ${T.border}` }}>
        <div style={{ ...wrap, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, padding: "24px 20px", fontSize: 13, color: T.muted }}>
          <div>© 2026 Autologic · Kandirpar, Cumilla, Bangladesh</div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <a href="/google-calendar" style={{ color: T.muted, textDecoration: "none" }}>Google Calendar</a>
            <a href="/privacy" style={{ color: T.muted, textDecoration: "none" }}>Privacy Policy</a>
            <a href="/terms" style={{ color: T.muted, textDecoration: "none" }}>Terms of Service</a>
            <a href="/contact" style={{ color: T.muted, textDecoration: "none" }}>Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
