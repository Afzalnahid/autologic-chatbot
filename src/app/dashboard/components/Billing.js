"use client";
import { useState, useEffect, useCallback } from "react";
import { T, Card, Btn, Inp, Badge, PLAN_META, PLAN_LIST, taka, shortDate } from "./ui.js";
import { api } from "./session.js";
import { quotePlan, quoteTopUp, planPrice, hasByokPrice, UNIT_DEFAULTS } from "@/lib/pricing.js";
import { featureList } from "@/lib/features.js";
import UsageMeters from "./UsageMeters.js";

// The Billing tab (owner, 2026-10-04).
//
// It opens on the customer's OWN package — what they have, how much is used,
// when it ends — and nothing else. Three doors lead from there:
//   · Renew          the same package, the same numbers, straight to payment;
//   · Update package every package of their business type: pick one, Standard
//                    or own AI key (half price), monthly or yearly, and move its
//                    countable numbers with a slider — the price follows;
//   · Add more       raise the numbers on the running package; only the days
//                    left are charged.
//
// Every package has every feature, so the features are simply listed; only the
// countable allowances (bot replies, products or knowledge files, AI Assistant
// questions) have sliders. The screen totals the basket with lib/pricing.js —
// the same code the server charges with (lib/billing-basket.js) — and never
// sends an amount.

const fmt = (n) => Number(n || 0).toLocaleString("en-IN");
const UNIT_WORD = { replies: "replies", products: "products", docs: "files", assistant: "questions" };

// One countable allowance: the number, − / + buttons (a phone finger cannot
// land on one of 70 notches) and the slider itself. `value` is the RAISE over
// the package (never below it); `floor` stops a top-up from going below what
// is already bought.
function NumberSlider({ s, value, onChange, floor, cost }) {
  const lo = floor ?? s.min, to = s.base + value;
  const b = { width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.border}`, background: T.card, color: T.text, cursor: "pointer", fontSize: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 };
  const set = (v) => onChange(Math.max(lo, Math.min(s.max, v)));
  return <div style={{ padding: "12px 0", borderTop: `1px solid ${T.border}` }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
      <span style={{ fontSize: 13, color: T.textMuted }}>{s.name}</span>
      <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
        {fmt(to)} <span style={{ fontWeight: 400, fontSize: 12, color: T.textMuted }}>{UNIT_WORD[s.kind] || ""}</span>
        {value !== 0 && <span style={{ fontWeight: 600, fontSize: 12, color: value > 0 ? T.gold : T.textMuted, marginLeft: 6 }}>{value > 0 ? "+" : "−"}{taka(Math.abs(cost || 0))}</span>}
      </span>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <button type="button" aria-label={`Fewer ${UNIT_WORD[s.kind] || ""}`} disabled={value <= lo} onClick={() => set(value - s.step)} style={{ ...b, opacity: value <= lo ? .4 : 1 }}>−</button>
      <input type="range" aria-label={s.name} min={s.base + lo} max={s.base + s.max} step={s.step} value={to}
        onChange={(e) => set(Number(e.target.value) - s.base)} style={{ flex: 1, minWidth: 0, accentColor: T.gold, cursor: "pointer" }} />
      <button type="button" aria-label={`More ${UNIT_WORD[s.kind] || ""}`} disabled={value >= s.max} onClick={() => set(value + s.step)} style={{ ...b, opacity: value >= s.max ? .4 : 1 }}>+</button>
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textDim, marginTop: 4, padding: "0 40px", fontVariantNumeric: "tabular-nums" }}>
      <span>{lo > 0 ? `now ${fmt(s.base + lo)}` : `package ${fmt(s.base)}`}</span><span>up to {fmt(s.base + s.max)}</span>
    </div>
  </div>;
}

// The lines of a quote, then the total.
function Summary({ lines, total, note, per }) {
  return <div style={{ background: T.bgAlt, border: `0.5px solid ${T.border}`, borderRadius: 11, padding: "12px 14px", marginBottom: 16 }}>
    {lines.map((l, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, padding: "3px 0", color: l.type === "plan" ? T.text : T.textMuted }}>
      <span>{l.type === "plan" ? l.name : `${l.name}: ${fmt(l.to)} (${l.change > 0 ? "+" : "−"}${fmt(Math.abs(l.change))})`}</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{l.amount < 0 ? "−" : ""}{taka(Math.abs(l.amount))}</span>
    </div>)}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, borderTop: `1px solid ${T.border}`, marginTop: 8, paddingTop: 8 }}>
      <span style={{ fontSize: 13, color: T.textMuted }}>Total</span>
      <span style={{ fontSize: 22, fontWeight: 800, color: T.gold, fontVariantNumeric: "tabular-nums" }}>{taka(total)}<span style={{ fontSize: 12, fontWeight: 400, color: T.textMuted }}>{per}</span></span>
    </div>
    {note && <div style={{ fontSize: 11.5, color: T.textDim, marginTop: 6, lineHeight: 1.6 }}>{note}</div>}
  </div>;
}

// "Everything in every package" — the capabilities, which no package rations.
function Included({ biz }) {
  const list = featureList({}, biz).filter((f) => f.key !== "byok");
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
    <span style={{ fontSize: 12, color: T.textMuted, display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, background: T.bgAlt }}><i className="ti ti-check" style={{ color: T.success }} />Every channel: Messenger, Instagram, WhatsApp, website</span>
    {list.map((f) => <span key={f.key} style={{ fontSize: 12, color: T.textMuted, display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, background: T.bgAlt }}><i className="ti ti-check" style={{ color: T.success }} />{f.label}</span>)}
  </div>;
}

export default function Billing({ initialPlan, initialCycle, initialByok, initialCustom }) {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  // "home" (my package), "change" (choose / renew / update), "topup" (add more)
  const [view, setView] = useState(initialPlan ? "change" : "home");
  const [sel, setSel] = useState(initialPlan || null);
  const [cycle, setCycle] = useState(initialCycle === "yearly" ? "yearly" : "monthly");
  const [byok, setByok] = useState(false);
  const [custom, setCustom] = useState({});
  const [method, setMethod] = useState("");
  const [senderNo, setSenderNo] = useState("");
  const [txn, setTxn] = useState("");
  const [busy, setBusy] = useState(false);
  const [onlineBusy, setOnlineBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");

  // Packages come live from the admin panel (/api/plans), so a new or re-priced
  // package shows up without a deploy. PLAN_LIST is the fallback.
  const [plans, setPlans] = useState(PLAN_LIST);
  const [planMeta, setPlanMeta] = useState(PLAN_META);
  const load = useCallback(async () => {
    try {
      const r = await api(`/api/billing?t=${Date.now()}`, { cache: "no-store" });
      const j = await r.json();
      if (!j.error) { setD(j); if (j.methods?.length) setMethod((m) => m || j.methods[0].id); }
    } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api("/api/plans").then((r) => r.json()).then((x) => {
      if (Array.isArray(x?.plans) && x.plans.length) setPlans(x.plans);
      if (x?.meta) setPlanMeta({ ...PLAN_META, ...x.meta });
    }).catch(() => {});
  }, []);
  // While a payment is under review, look again every 20 seconds: the moment it
  // is approved, this screen shows the new package without a reload.
  useEffect(() => {
    if (!d?.pending_request) return;
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [d?.pending_request, load]);
  // A renewal starts from the package as it is today: own key or not, and its
  // numbers. A link from the pricing page's own-key price (?byok=1) starts on
  // own key instead. Once, on the first load — a reload must not undo a choice.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (!d || seeded) return;
    setByok(initialByok ? true : !!d.byok_plan);
    // The numbers raised on the public card come along; otherwise a renewal of
    // the same package starts from what the customer has now.
    if (initialCustom && Object.keys(initialCustom).length) setCustom({ ...initialCustom });
    else if (initialPlan && initialPlan === d.plan) setCustom({ ...(d.custom_limits || {}) });
    setSeeded(true);
  }, [d, seeded, initialByok, initialPlan, initialCustom]);

  const copy = async (t, id) => {
    try { await navigator.clipboard.writeText(t); setCopied(id); setTimeout(() => setCopied(""), 1500); } catch {}
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: T.textMuted, fontSize: 13 }}>Loading billing...</div>;
  if (!d) return <Card style={{ textAlign: "center", color: T.textDim, padding: 40 }}>Could not load billing information.</Card>;

  const biz = d.business_type || "ecommerce";
  const units = d.units?.length ? d.units : UNIT_DEFAULTS;
  const expiry = d.plan === "trial" ? d.trial_end : d.plan_expires_at;
  const daysLeft = expiry ? Math.ceil((new Date(expiry) - new Date()) / 86400000) : null;
  // Only the packages this business may buy; a package with no type (old rows)
  // belongs to both sides. The trial is not for sale.
  const buyable = plans.filter((p) => Number(p.monthly) > 0 && (!p.biz || p.biz === "both" || p.biz === biz));
  const selPlan = buyable.find((p) => p.id === sel);
  const currentPlan = plans.find((p) => p.id === d.plan);
  const paid = !!(currentPlan && Number(currentPlan.monthly) > 0);
  const paidAndActive = paid && d.active;
  const pending = d.pending_request;
  const lastRejected = d.requests?.[0]?.status === "rejected" ? d.requests[0] : null;
  const ctx = { units, plans };
  const per = cycle === "yearly" ? "/year" : "/month";

  // What the customer pays now for what they have — the package, own key or
  // not, with their own numbers.
  const myQuote = paid ? quotePlan({ plan: currentPlan, cycle: d.billing_cycle || "monthly", byok: !!d.byok_plan, custom: d.custom_limits || {}, ...ctx }) : null;

  // The basket being bought, priced exactly as the server will price it.
  const byokOn = byok && !!selPlan && hasByokPrice(selPlan);
  const planQuote = selPlan ? quotePlan({ plan: selPlan, cycle, byok: byokOn, custom, ...ctx }) : null;
  const topUpQuote = view === "topup" && paidAndActive ? quoteTopUp({
    client: { plan: d.plan, plan_expires_at: d.plan_expires_at, byok_plan: d.byok_plan, billing_cycle: d.billing_cycle, custom_limits: d.custom_limits },
    plan: currentPlan, custom, ...ctx }) : null;
  const quote = view === "topup" ? topUpQuote : planQuote;
  const amount = quote?.ok ? quote.total : 0;
  const basketBody = view === "topup" ? { kind: "topup", custom } : { kind: "plan", plan: sel, cycle, byok: byokOn, custom };
  const costOf = (q, kind) => q?.ok ? (q.lines.find((l) => l.kind === kind)?.[view === "topup" ? "full" : "amount"] || 0) : 0;

  const openChange = (planId, keep) => {
    setSel(planId); setErr("");
    // Renewing the same package keeps its numbers; another package starts from its own.
    setCustom(keep && planId === d.plan ? { ...(d.custom_limits || {}) } : {});
    if (keep) { setByok(!!d.byok_plan); setCycle(d.billing_cycle === "yearly" ? "yearly" : "monthly"); }
    setView("change");
  };
  const pickPlan = (id) => { setSel(id); setCustom(id === d.plan ? { ...(d.custom_limits || {}) } : {}); setErr(""); };
  const openTopUp = () => { setCustom({ ...(d.custom_limits || {}) }); setErr(""); setView("topup"); };
  const back = () => { setView("home"); setErr(""); };

  // Start a hosted SSLCommerz checkout and hand the browser to the gateway. On
  // success the gateway redirects back to /api/billing/callback, which verifies
  // and applies the purchase — nothing to submit here.
  const payOnline = async () => {
    if (onlineBusy) return;
    if (!quote?.ok) { setErr(quote?.error || "Choose a package first"); return; }
    setOnlineBusy(true); setErr("");
    try {
      const r = await api("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(basketBody) });
      const j = await r.json();
      if (j.error) { setErr(j.error); setOnlineBusy(false); }
      else if (j.url) { window.location.href = j.url; }
      else { setErr("Could not start the payment. Please try again."); setOnlineBusy(false); }
    } catch { setErr("Could not start the payment. Please try again."); setOnlineBusy(false); }
  };

  const submit = async () => {
    if (busy) return;
    if (!quote?.ok) { setErr(quote?.error || "Choose a package first"); return; }
    if (!txn.trim()) { setErr("Enter the transaction ID from your payment receipt"); return; }
    setBusy(true); setErr("");
    try {
      const r = await api("/api/billing", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...basketBody, method, sender_number: senderNo, txn_id: txn }) });
      const j = await r.json();
      if (j.error) { setErr(j.error); }
      else {
        setTxn(""); setSenderNo(""); setCustom({}); setView("home"); await load();
        // The dashboard shell re-reads the account, so a customer with no
        // running package moves to the "payment under review" screen.
        window.dispatchEvent(new Event("al-billing-changed"));
      }
    } catch { setErr("Could not submit. Please try again."); }
    setBusy(false);
  };

  // How to pay — the same for a package and for a top-up.
  const paySection = <>
    {err && <div role="alert" style={{ fontSize: 12.5, color: T.danger, marginBottom: 12 }}>{err}</div>}
    {d.online && <>
      <Btn gold onClick={payOnline} disabled={onlineBusy || !quote?.ok} style={{ width: "100%", marginBottom: 12 }}>
        <i className="ti ti-credit-card" style={{ marginRight: 6 }} />{onlineBusy ? "Starting secure checkout…" : `Pay online (card / mobile banking) · ${taka(amount)}`}
      </Btn>
      {d.methods.length > 0 && <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0 16px", color: T.textDim, fontSize: 11.5 }}>
        <div style={{ flex: 1, height: 1, background: T.border }} />or pay manually with bKash / Nagad<div style={{ flex: 1, height: 1, background: T.border }} />
      </div>}
    </>}
    {d.methods.length === 0
      ? <div style={{ fontSize: 13, color: T.warn, background: `color-mix(in srgb, ${T.warn} 7%, transparent)`, border: `1px solid color-mix(in srgb, ${T.warn} 20%, transparent)`, borderRadius: 10, padding: "14px 16px" }}>
          <i className="ti ti-alert-circle" style={{ marginRight: 6 }} />Payment numbers are not configured yet. Please contact support at nahidafzal97@gmail.com to complete your purchase.
        </div>
      : <>
        <div style={{ background: T.bgAlt, border: `0.5px solid ${T.border}`, borderRadius: 11, padding: "16px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>Send exactly</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: T.gold, marginBottom: 14 }}>{taka(amount)}</div>
          <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 9 }}>to any of these numbers (Send Money)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 9 }}>
            {d.methods.map((m) => <div key={m.id} onClick={() => setMethod(m.id)} style={{
              cursor: "pointer", padding: "11px 13px", borderRadius: 9, background: T.card,
              border: `1px solid ${method === m.id ? T.gold : T.border}`, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: T.textMuted }}>{m.label} · {m.type}</div>
                <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: .3 }}>{m.number}</div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); copy(m.number, m.id); }} title="Copy number"
                style={{ background: "none", border: "none", cursor: "pointer", color: copied === m.id ? T.success : T.textMuted, fontSize: 16, flexShrink: 0 }}>
                <i className={`ti ${copied === m.id ? "ti-check" : "ti-copy"}`} />
              </button>
            </div>)}
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: T.textMuted, marginBottom: 14, lineHeight: 1.7 }}>
          After sending the money, enter the transaction ID from your payment app below. We check it and switch your purchase on — usually within a few hours — and tell you on your phone and by email.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
          <Inp label="The number you paid from" value={senderNo} onChange={(e) => setSenderNo(e.target.value)} placeholder="01XXXXXXXXX" />
          <Inp label="Transaction ID *" value={txn} onChange={(e) => setTxn(e.target.value)} placeholder="e.g. 9A7B2C1D5E" />
        </div>
        <Btn gold onClick={submit} disabled={busy || !quote?.ok} style={{ width: "100%" }}>
          {busy ? "Submitting..." : `Submit payment · ${taka(amount)}`}
        </Btn>
      </>}
  </>;

  const segBtn = (on) => ({ padding: "7px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600, background: on ? T.gold : "transparent", color: on ? T.onGold : T.textMuted });
  const closeBtn = <button onClick={back} aria-label="Back to my package" style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: 18 }}><i className="ti ti-x" /></button>;
  const planName = (id) => planMeta[id]?.name || PLAN_META[id]?.name || id;

  return <div style={{ maxWidth: 900, margin: "0 auto" }}>

    {/* A payment waiting for us. */}
    {pending && <Card style={{ marginBottom: 16, border: `1px solid color-mix(in srgb, ${T.warn} 27%, transparent)` }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <i className="ti ti-clock-hour-4" style={{ fontSize: 20, color: T.warn, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Payment under review</div>
          <div style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.7 }}>
            We received your {taka(pending.amount)} payment for {pending.kind === "topup" ? "more on" : "the"} <strong style={{ color: T.text }}>{planName(pending.plan)}</strong>{pending.byok ? " (own AI key)" : ""}
            {" "}(transaction <strong style={{ color: T.text }}>{pending.txn_id}</strong>, {shortDate(pending.created_at)}).
            We usually check within a few hours. This page updates by itself when it is approved, and we tell you on your phone and by email.
          </div>
        </div>
      </div>
    </Card>}

    {/* The last payment was turned down: say why, and offer the way back. */}
    {!pending && lastRejected && <Card style={{ marginBottom: 16, border: `1px solid color-mix(in srgb, ${T.danger} 27%, transparent)` }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <i className="ti ti-alert-circle" style={{ fontSize: 20, color: T.danger, marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Your last payment was not approved</div>
          <div style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.7 }}>
            {taka(lastRejected.amount)} · transaction {lastRejected.txn_id}. {lastRejected.admin_note ? <>Reason: <strong style={{ color: T.text }}>{lastRejected.admin_note}</strong></> : "Please check the transaction ID and try again."}
          </div>
        </div>
        {view === "home" && <Btn small onClick={() => openChange(lastRejected.plan, true)}>Try again</Btn>}
      </div>
    </Card>}

    {/* An own-key package with no key saved: the bot is waiting. Neutral
        styling on purpose — mint means "bot is live" and nothing else. */}
    {d.byok_plan && !d.own_key && d.active && <Card style={{ marginBottom: 16, border: `1px solid color-mix(in srgb, ${T.warn} 27%, transparent)` }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <i className="ti ti-key" style={{ fontSize: 18, color: T.warn, marginTop: 2 }} />
        <div style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.7 }}>
          <strong style={{ color: T.text }}>Add your AI key to start the bot.</strong> Your package runs on your own AI key, and none is saved yet, so the bot is waiting. Customers' messages are still saved in your inbox.
          {" "}<a href="#ai" style={{ color: T.gold, fontWeight: 600 }}>Open AI Engine →</a>
        </div>
      </div>
    </Card>}

    {/* ── My package ── */}
    {view === "home" && <Card style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11.5, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>My package</div>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <span style={{ fontSize: 22, fontWeight: 700 }}>{d.plan === "none" ? "No package yet" : d.plan === "trial" ? "Free trial" : d.plan_name}</span>
            {d.plan !== "none" && <Badge color={d.suspended ? T.danger : d.active ? T.success : T.danger}>{d.suspended ? "Suspended" : d.active ? "Active" : "Ended"}</Badge>}
            {paid && d.byok_plan && <Badge color={T.textMuted}><i className="ti ti-key" style={{ marginRight: 4 }} />Own AI key</Badge>}
            {paid && <Badge color={T.textMuted}>{d.billing_cycle === "yearly" ? "Yearly" : "Monthly"}</Badge>}
          </div>
          {myQuote?.ok && <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6 }}>{taka(myQuote.total)} {d.billing_cycle === "yearly" ? "a year" : "a month"}</div>}
          {expiry && <div style={{ fontSize: 12.5, color: daysLeft !== null && daysLeft <= 3 ? T.warn : T.textMuted, marginTop: 4 }}>
            {d.active ? `Valid until ${shortDate(expiry)}${daysLeft !== null ? ` · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : ""}` : `Ended on ${shortDate(expiry)}`}
          </div>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {paid && <Btn gold onClick={() => openChange(d.plan, true)} disabled={!!pending}><i className="ti ti-refresh" style={{ marginRight: 6 }} />Renew</Btn>}
          <Btn gold={!paid} onClick={() => openChange(paid ? d.plan : (buyable.find((p) => p.highlight)?.id || buyable[0]?.id || null), paid)} disabled={!!pending}>
            <i className="ti ti-arrows-exchange" style={{ marginRight: 6 }} />{paid ? "Update package" : "Choose a package"}
          </Btn>
          {paidAndActive && myQuote?.sliders?.length > 0 && <Btn onClick={openTopUp} disabled={!!pending}><i className="ti ti-plus" style={{ marginRight: 6 }} />Add more</Btn>}
        </div>
      </div>

      {/* Everything the package counts — bot replies, products or documents,
          AI Assistant questions, channels, broadcasts, imports — used and left.
          At 90% a meter warns, with Add more for what can be raised (owner,
          2026-10-04). */}
      {d.entitlements?.meters?.length > 0 && <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
        <UsageMeters meters={d.entitlements.meters} period={d.entitlements.period}
          onAddMore={paidAndActive && !pending && myQuote?.sliders?.length ? () => openTopUp() : null} />
        {!paidAndActive && d.entitlements.meters.some((m) => !m.unlimited && (m.pct || 0) >= 90) && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 8 }}>
          Choose a package to get more.
        </div>}
      </div>}
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>{paid ? "Included in your package" : "Included in every package"}</div>
        <Included biz={biz} />
      </div>
    </Card>}

    {/* ── Choose, renew or update a package ── */}
    {view === "change" && <Card style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{paid ? (sel === d.plan ? "Renew or update your package" : "Update your package") : "Choose your package"}</div>
        {closeBtn}
      </div>

      {/* 1. which package */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 14 }}>
        {buyable.map((p) => {
          const on = byok && hasByokPrice(p);
          const price = planPrice(p, { cycle, byok: on });
          return <button type="button" key={p.id} onClick={() => pickPlan(p.id)} style={{
            textAlign: "left", cursor: "pointer", padding: "12px 14px", borderRadius: 11, background: T.bgAlt, color: T.text, font: "inherit",
            border: `1.5px solid ${sel === p.id ? T.gold : T.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{p.name}</span>
              {d.plan === p.id ? <Badge color={T.success}>Current</Badge> : p.highlight && <Badge>Popular</Badge>}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{taka(price)}<span style={{ fontSize: 11.5, color: T.textMuted, fontWeight: 400 }}>{per}</span></div>
          </button>;
        })}
      </div>

      {/* 2. our AI or own key, and the cycle */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <div role="group" aria-label="AI" style={{ display: "inline-flex", background: T.bgAlt, border: `0.5px solid ${T.border}`, borderRadius: 9, padding: 3, gap: 3 }}>
          <button onClick={() => setByok(false)} style={segBtn(!byok)}>Standard (our AI)</button>
          <button onClick={() => setByok(true)} disabled={!!selPlan && !hasByokPrice(selPlan)} style={{ ...segBtn(byok), opacity: selPlan && !hasByokPrice(selPlan) ? .4 : 1 }}><i className="ti ti-key" style={{ marginRight: 5 }} />Own AI key · half price</button>
        </div>
        <div role="group" aria-label="Billing cycle" style={{ display: "inline-flex", background: T.bgAlt, border: `0.5px solid ${T.border}`, borderRadius: 9, padding: 3, gap: 3 }}>
          {[["monthly", "Monthly"], ["yearly", "Yearly · 2 months free"]].map(([id, l]) =>
            <button key={id} onClick={() => setCycle(id)} style={segBtn(cycle === id)}>{l}</button>)}
        </div>
      </div>
      <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.65, marginBottom: 6 }}>
        {byok
          ? <>With your own AI key, every AI reply runs on your own <strong style={{ color: T.text }}>Google Gemini or OpenAI</strong> key and you pay the AI provider directly, so the package is half price. After approval, AI Engine opens: paste your key and choose a model. The bot starts as soon as the key is saved.</>
          : <>Standard includes the AI: nothing else to set up or pay for.{d.byok_plan ? " Switching to Standard closes AI Engine and removes your saved key." : ""}</>}
      </div>

      {/* 3. the numbers, like a phone pack */}
      {planQuote?.ok && planQuote.sliders.length > 0 && <div style={{ margin: "14px 0 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Need more? Set your numbers <span style={{ fontWeight: 400, color: T.textMuted, fontSize: 12 }}>· the price follows</span></div>
          {Object.keys(planQuote.custom).length > 0 && <button type="button" onClick={() => setCustom({})} style={{ background: "none", border: "none", cursor: "pointer", color: T.gold, fontSize: 12.5, fontWeight: 600 }}><i className="ti ti-refresh" style={{ marginRight: 4 }} />Reset</button>}
        </div>
        {planQuote.sliders.map((s) => <NumberSlider key={s.kind} s={s} value={Number(custom[s.kind]) || 0} cost={costOf(planQuote, s.kind)}
          onChange={(v) => setCustom({ ...custom, [s.kind]: v })} />)}
      </div>}

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>Included in every package</div>
        <Included biz={biz} />
      </div>

      {/* 4. what it comes to */}
      {planQuote?.ok
        ? <>
          {planQuote.better && <div style={{ fontSize: 12.5, color: T.textMuted, background: T.goldBg, borderRadius: 10, padding: "10px 12px", marginBottom: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <i className="ti ti-bulb" style={{ color: T.gold, fontSize: 16 }} />
            <span style={{ flex: 1, minWidth: 180 }}><strong style={{ color: T.text }}>{planQuote.better.name}</strong> is only {taka(planQuote.better.more)} more — and gives you much more.</span>
            <Btn small onClick={() => pickPlan(planQuote.better.id)}>Switch</Btn>
          </div>}
          <Summary lines={planQuote.lines} total={planQuote.total} per={per} />
        </>
        : selPlan && <div style={{ fontSize: 12.5, color: T.danger, marginBottom: 12 }}>{planQuote?.error}</div>}

      {paySection}
    </Card>}

    {/* ── Add more to a running package ── */}
    {view === "topup" && myQuote?.ok && <Card style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Add more to {d.plan_name}</div>
        {closeBtn}
      </div>
      <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.65, marginBottom: 6 }}>
        Raise any number. It applies as soon as the payment is approved, and you pay only for the {daysLeft} day{daysLeft === 1 ? "" : "s"} left this {d.billing_cycle === "yearly" ? "year" : "month"}. From your next renewal the new numbers are part of your package.
      </div>
      {myQuote.sliders.map((s) => <NumberSlider key={s.kind} s={s} value={Number(custom[s.kind]) || 0} floor={Number(d.custom_limits?.[s.kind]) || 0} cost={costOf(topUpQuote, s.kind)}
        onChange={(v) => setCustom({ ...custom, [s.kind]: v })} />)}
      <div style={{ height: 12 }} />
      {topUpQuote?.ok
        ? <><Summary lines={topUpQuote.lines} total={topUpQuote.total} note={`For the ${topUpQuote.daysLeft} day${topUpQuote.daysLeft === 1 ? "" : "s"} left on your package.`} />{paySection}</>
        : <div style={{ fontSize: 12.5, color: T.textMuted, marginBottom: 4 }}>{topUpQuote?.error || "Raise at least one number."}</div>}
    </Card>}

    {/* History */}
    {d.requests.length > 0 && <Card>
      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>Payment history</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 460, borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead><tr style={{ color: T.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: .6 }}>
            <th style={{ textAlign: "left", padding: "0 0 9px" }}>Date</th>
            <th style={{ textAlign: "left", padding: "0 0 9px" }}>Package</th>
            <th style={{ textAlign: "left", padding: "0 0 9px" }}>Amount</th>
            <th style={{ textAlign: "left", padding: "0 0 9px" }}>Transaction</th>
            <th style={{ textAlign: "right", padding: "0 0 9px" }}>Status</th>
          </tr></thead>
          <tbody>{d.requests.map((r) => <tr key={r.id} style={{ borderTop: `0.5px solid ${T.border}` }}>
            <td style={{ padding: "10px 0", color: T.textMuted }}>{shortDate(r.created_at)}</td>
            <td style={{ padding: "10px 0" }}>{r.kind === "topup" || r.kind === "addon" ? "More on · " : ""}{planName(r.plan)}{r.byok ? " (own key)" : ""}<span style={{ color: T.textDim, fontSize: 11 }}> · {r.billing_cycle}</span></td>
            <td style={{ padding: "10px 0" }}>{taka(r.amount)}</td>
            <td style={{ padding: "10px 0", color: T.textMuted, fontFamily: "monospace", fontSize: 11.5 }}>{r.txn_id}</td>
            <td style={{ padding: "10px 0", textAlign: "right" }}>
              {/* "expired" = an online checkout that was cancelled or never finished (billing-rules.js) */}
              <Badge color={r.status === "approved" ? T.success : r.status === "rejected" ? T.danger : r.status === "expired" ? T.textDim : T.warn}>{r.status === "expired" ? "not completed" : r.status === "pending" ? "under review" : r.status}</Badge>
            </td>
          </tr>)}</tbody>
        </table>
      </div>
    </Card>}
  </div>;
}
