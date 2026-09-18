"use client";
import { useState, useEffect } from "react";
import { FOOTER_LINKS, solutionHref } from "@/lib/solutions/index.js";
import { PLANS, PLAN_ORDER, formatMoney, yearlySavingMonths } from "@/lib/plans.js";
import { THEME_CSS } from "@/lib/landing.js";
import { COPYRIGHT, ADDRESS_SHORT } from "@/lib/company.js";

// Reads the shared site palette, so pricing follows the same crimson-on-white
// theme (and the same light/dark switch) as the landing page and dashboard.
const T = {
  bg: "var(--lp-bg)", card: "var(--lp-card)", gold: "var(--lp-acc)", goldBg: "var(--lp-accSoft)",
  text: "var(--lp-ink)", muted: "var(--lp-soft)", dim: "var(--lp-soft)", border: "var(--lp-line)", green: "#0FA97C",
};

// The comparison table, keyed by TIER rather than by package id.
//
// It used to name trial/starter/pro/agency in every row, so the table went on
// describing the old ladder while the cards above it were already reading live
// packages from the database — two answers to the same question on one page.
// Reading the tier off the id means a re-priced or renamed package cannot leave
// the table behind, and the same rows serve both sides.
//
// `only` marks a row that belongs to one business type. A shop never sees the
// calendar row; a service never sees photo matching.
const tierOf = (id) => (id === "trial" ? "trial" : String(id).split("_")[1] || "");

// Every package carries every feature (the owner's rule, 2026-09-18) — a
// package is a SIZE, not a smaller product. So the numbers come first and
// carry the whole comparison, and the capability rows below them are all
// ticks: they are there to prove nothing is held back, which is the point.
//
// This table used to disagree with the database in three places at once —
// Analytics and comment automation were promised as absent from the trial
// while the trial had them, and "use your own AI key" was promised to Starter
// and Growth while the switch said Scale only. Keeping every row true is also
// what makes that impossible again; tests/t-packages-uniform.mjs checks it.
const COMPARE = [
  { label: "Bot replies", trial: "30 / day", starter: "3,000 / mo", growth: "15,000 / mo", scale: "50,000 / mo" },
  { label: "Channels", trial: "1", starter: "1", growth: "All 3", scale: "All 3" },
  { label: "Website imports / month", trial: "5", starter: "20", growth: "200", scale: "Unlimited" },
  { label: "Broadcasts / month", trial: "2", starter: "4", growth: "20", scale: "Unlimited" },

  { label: "AI replies (Bangla & English)", trial: true, starter: true, growth: true, scale: true },
  { label: "Live conversation inbox", trial: true, starter: true, growth: true, scale: true },
  { label: "Analytics dashboard", trial: true, starter: true, growth: true, scale: true },
  { label: "Website chat widget", trial: true, starter: true, growth: true, scale: true },
  { label: "Broadcasts & follow-ups", trial: true, starter: true, growth: true, scale: true },
  { label: "Voice message understanding", trial: true, starter: true, growth: true, scale: true },
  { label: "Comment automation", trial: true, starter: true, growth: true, scale: true },
  { label: "AI Assistant in your dashboard", trial: true, starter: true, growth: true, scale: true },
  { label: "Use your own AI key (lower price)", trial: true, starter: true, growth: true, scale: true },
  { label: "Priority support", trial: false, starter: false, growth: false, scale: true },

  { only: "ecommerce", label: "Product catalogue & orders", trial: true, starter: true, growth: true, scale: true },
  { only: "ecommerce", label: "Products", trial: "20", starter: "300", growth: "3,000", scale: "Unlimited" },
  { only: "ecommerce", label: "Photo product matching (Vision AI)", trial: true, starter: true, growth: true, scale: true },
  { only: "ecommerce", label: "Add products from photos", trial: true, starter: true, growth: true, scale: true },

  { only: "agency", label: "Knowledge Base (document upload)", trial: true, starter: true, growth: true, scale: true },
  { only: "agency", label: "Documents", trial: "2", starter: "10", growth: "40", scale: "Unlimited" },
  { only: "agency", label: "Google Calendar booking", trial: true, starter: true, growth: true, scale: true },
];

// A plain-language reach line per tier, so "3,000 replies" means something to a
// buyer. Rough on purpose (hence "≈" / "~"): assumes about 5 bot replies per
// conversation, and that one human agent handles on the order of 5,000 replies
// a month. Keyed by tier like the comparison table, so an admin re-pricing
// a package does not strand the copy.
//
// The trial line is per DAY on purpose: the trial's length is set in the admin
// panel and this copy is static, so a total here would go stale the moment the
// owner changed it. It read "~180 chats" until 2026-09-18 — from when the trial
// was costed as a month; three days at 30 replies is 90 replies, about 18 chats.
const REACH = {
  trial:   "≈ ~6 customer chats a day to try it out",
  starter: "≈ ~600 customers a month — like adding ~1 agent",
  growth:  "≈ ~3,000 customers a month — like ~3 agents",
  scale:   "≈ ~10,000 customers a month — like ~8+ agents",
};

const FAQ = [
  { q: "How does the free trial work?", a: "You get full access for a few days with 30 bot replies a day — about 5 or 6 customers, since one customer usually asks several questions. No payment details needed to start — just sign up and connect a channel." },
  { q: "How do I pay?", a: "Send the amount by bKash, Nagad or Rocket to the number shown in your dashboard, then submit the transaction ID. We verify it and your plan activates, usually within a few hours." },
  { q: "What counts against my limit?", a: "One bot reply to one customer counts as one, however many bubbles it takes to say it. Replies you type yourself are never counted, and nothing is counted while the bot is off. So a plan's number is how many customer questions the bot may answer for you — one customer asking five questions uses five." },
  { q: "Can I change plan later?", a: "Yes. Upgrade any time from your dashboard — the new plan starts as soon as your payment is verified." },
  { q: "What happens when my plan expires?", a: "The bot stops replying to new customers, but nothing is deleted. Your products, knowledge base and conversation history stay safe until you renew." },
  { q: "Do you offer a yearly discount?", a: "Yes — pay yearly and you get two months free on every paid plan." },
];

function Check({ on }) {
  return on
    ? <span style={{ color: T.green, fontSize: 15 }}>✓</span>
    : <span style={{ color: T.dim, fontSize: 15 }}>—</span>;
}

// The code catalogue, shaped like the /api/plans response, used for the first
// paint and as a fallback if the API is unreachable.
const FALLBACK_PLANS = PLAN_ORDER.map((id) => ({
  id, biz: PLANS[id].biz || "both", name: PLANS[id].name, tagline: PLANS[id].tagline,
  monthly: PLANS[id].monthly, yearly: PLANS[id].yearly,
  byok_monthly: PLANS[id].byokMonthly ?? null, byok_yearly: PLANS[id].byokYearly ?? null,
  highlight: !!PLANS[id].highlight, features: PLANS[id].features || [],
}));

export default function PricingClient() {
  const [cycle, setCycle] = useState("monthly");
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  // Shops first because most of them are. A package with no business type —
  // the trial, and any row written before the biz column — belongs to both
  // sides and appears whichever is chosen.
  const [biz, setBiz] = useState("ecommerce");
  const shown = plans.filter((p) => !p.biz || p.biz === "both" || p.biz === biz);
  const wrap = { maxWidth: 1120, margin: "0 auto", padding: "0 20px" };
  const yearly = cycle === "yearly";

  // Same boot as the landing page: saved choice first, then the machine's.
  useEffect(() => {
    try {
      const t = localStorage.getItem("al-theme")
        || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      document.documentElement.dataset.theme = t;
    } catch {}
    // Live packages from the admin panel — so a new or re-priced plan appears
    // here without a deploy. Falls back to the code catalogue on any error.
    fetch("/api/plans").then((r) => r.json()).then((d) => {
      if (Array.isArray(d?.plans) && d.plans.length) setPlans(d.plans);
    }).catch(() => {});
  }, []);

  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: "system-ui, sans-serif" }}>
      <style dangerouslySetInnerHTML={{__html:THEME_CSS}}/>
      <nav style={{ borderBottom: `1px solid ${T.border}` }}>
        <div style={{ ...wrap, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px" }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: T.text }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: T.goldBg, border: `1px solid color-mix(in srgb, ${T.gold} 27%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>🤖</div>
            <span style={{ fontSize: 18, fontWeight: 700 }}>TellMore AI</span>
          </a>
          <div style={{ display: "flex", gap: 9 }}>
            <a href="/dashboard?auth=signin" style={{ padding: "8px 16px", color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, fontWeight: 600, fontSize: 13.5, textDecoration: "none" }}>Log in</a>
            <a href="/dashboard?auth=signup" style={{ padding: "8px 18px", background: T.gold, color: "#fff", borderRadius: 8, fontWeight: 600, fontSize: 13.5, textDecoration: "none" }}>Sign up</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ ...wrap, textAlign: "center", padding: "56px 20px 32px" }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, margin: "0 0 14px", letterSpacing: -0.5 }}>Simple, honest pricing</h1>
        <p style={{ fontSize: 16, color: T.muted, maxWidth: 560, margin: "0 auto 28px", lineHeight: 1.7 }}>
          Start free. Upgrade when your customers start rolling in. No hidden fees, cancel any time.
        </p>

        <div style={{ display: "inline-flex", background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 4, gap: 4 }}>
          {[["monthly", "Monthly", null], ["yearly", "Yearly", "Save 17%"]].map(([id, label, badge]) => (
            <button key={id} onClick={() => setCycle(id)} style={{
              padding: "8px 20px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 600,
              background: cycle === id ? T.gold : "transparent", color: cycle === id ? "#fff" : T.muted,
              display: "inline-flex", alignItems: "center", gap: 7,
            }}>{label}{badge && <span style={{ background: T.green, color: "#fff", fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 20 }}>{badge}</span>}</button>
          ))}
        </div>
        {yearly && <div style={{ fontSize: 12.5, color: T.green, marginTop: 10 }}>2 months free on every paid plan</div>}
      </section>

      {/* Which business you are. A shop and a service buy different things —
          photo matching against a catalogue on one side, documents and calendar
          booking on the other — so showing one ladder to both meant every
          package advertised something half its readers would never use. */}
      <section style={{ ...wrap, padding: "0 20px 22px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 4, gap: 4 }}>
          {[["ecommerce", "I sell products"], ["agency", "I offer services"]].map(([id, label]) => (
            <button key={id} onClick={() => setBiz(id)} style={{
              padding: "8px 18px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 600,
              background: biz === id ? T.gold : "transparent", color: biz === id ? "#fff" : T.muted,
            }}>{label}</button>
          ))}
        </div>
      </section>

      {/* Plan cards */}
      <section style={{ ...wrap, padding: "0 20px 56px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, alignItems: "stretch" }}>
          {shown.map((p) => {
            const id = p.id;
            const price = yearly ? p.yearly : p.monthly;
            const free = price === 0;
            // Months saved by paying yearly, computed from this plan's own prices
            // so it works for any admin-created package, not just the built-in ones.
            const saving = p.monthly ? Math.round((p.monthly * 12 - p.yearly) / p.monthly) : 0;
            // The lower price for a client who brings their own AI key, shown as
            // an informational line (the public page has no client to check, so
            // the standard price stays the headline). Only when the package sets
            // a real BYOK price below the standard one.
            const byokPrice = yearly ? p.byok_yearly : p.byok_monthly;
            const hasByok = !free && byokPrice != null && Number(byokPrice) > 0 && Number(byokPrice) < price;
            return (
              <div key={id} style={{
                background: T.card, border: p.highlight ? `1.5px solid ${T.gold}` : `1px solid ${T.border}`,
                borderRadius: 14, padding: "26px 22px", display: "flex", flexDirection: "column", position: "relative",
              }}>
                {p.highlight && <div style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", background: T.gold, color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 12px", borderRadius: 20, whiteSpace: "nowrap" }}>MOST POPULAR</div>}
                <div style={{ fontSize: 17, fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 12.5, color: T.muted, marginTop: 4, minHeight: 34 }}>{p.tagline}</div>
                <div style={{ margin: "14px 0 4px", display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 30, fontWeight: 800 }}>{free ? "Free" : formatMoney(price)}</span>
                  {!free && <span style={{ fontSize: 13, color: T.muted }}>/{yearly ? "year" : "month"}</span>}
                </div>
                <div style={{ fontSize: 11.5, color: yearly && saving ? T.green : T.dim, minHeight: 18 }}>
                  {free ? "No card needed" : yearly && saving ? `${saving} months free` : `or ${formatMoney(p.yearly)}/year`}
                </div>
                {hasByok && (
                  <div style={{ fontSize: 11.5, color: T.muted, marginTop: 6, lineHeight: 1.5 }}>
                    🔑 {formatMoney(byokPrice)}/{yearly ? "year" : "month"} with your own AI key
                  </div>
                )}
                {REACH[tierOf(id)] && (
                  <div style={{ fontSize: 11.5, color: T.muted, marginTop: 10, padding: "8px 10px", background: T.goldBg, borderRadius: 8, lineHeight: 1.5 }}>
                    {REACH[tierOf(id)]}
                  </div>
                )}

                <a href={free ? "/dashboard?auth=signup" : `/dashboard?upgrade=${id}&cycle=${cycle}`} style={{
                  display: "block", textAlign: "center", marginTop: 18, padding: "11px 0", borderRadius: 9,
                  fontWeight: 700, fontSize: 14, textDecoration: "none",
                  background: p.highlight ? T.gold : "transparent",
                  color: p.highlight ? "#fff" : T.text,
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
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, textAlign: "center" }}>Compare plans</h2>
        <p style={{ fontSize: 14, color: T.muted, marginBottom: 18, textAlign: "center", maxWidth: 520, marginInline: "auto", lineHeight: 1.65 }}>
          Every plan has every feature. What you choose is the size: how many replies, how many channels, how big a catalogue.
        </p>
        <div style={{ overflowX: "auto", border: `1px solid ${T.border}`, borderRadius: 14, background: T.card }}>
          <table style={{ width: "100%", minWidth: 620, borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "14px 18px", color: T.muted, fontWeight: 500, fontSize: 12 }}>Feature</th>
                {shown.map((p) => (
                  <th key={p.id} style={{ padding: "14px 12px", fontWeight: 700, fontSize: 13, color: p.highlight ? T.gold : T.text }}>{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE.filter((r) => !r.only || r.only === biz).map((row, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={{ padding: "12px 18px", color: T.text }}>{row.label}</td>
                  {shown.map((p) => {
                    const v = row[tierOf(p.id)];
                    return <td key={p.id} style={{ padding: "12px", textAlign: "center", color: T.muted }}>
                      {typeof v === "boolean" ? <Check on={v} /> : (v ?? "—")}
                    </td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11.5, color: T.dim, marginTop: 10, textAlign: "center" }}>
          One bot reply counts as one, however many bubbles it takes. Replies you type yourself are free, and nothing counts while the bot is off. No feature is locked to a bigger plan.
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
          <a href="/dashboard?auth=signup" style={{ display: "inline-block", padding: "12px 28px", background: T.gold, color: "#fff", borderRadius: 10, fontWeight: 700, fontSize: 14.5, textDecoration: "none" }}>Start free trial</a>
        </div>
      </section>

      <footer style={{ borderTop: `1px solid ${T.border}` }}>
        <div style={{ ...wrap, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, padding: "24px 20px", fontSize: 13, color: T.muted }}>
          <div>{COPYRIGHT} · {ADDRESS_SHORT}</div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            {FOOTER_LINKS.en.map(([slug, label]) => (
              <a key={slug} href={solutionHref(slug, "en")} style={{ color: T.muted, textDecoration: "none" }}>{label}</a>
            ))}
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
