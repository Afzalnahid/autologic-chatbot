"use client";
import { useState, useEffect, useCallback } from "react";
import { T, Card, Btn, Badge, Inp, Select, Switch, useIsMobile, fmtNum } from "../dashboard/components/ui.js";
// Aliased: this file already has its own FEATURES (the package capability
// switches), which is a different list entirely.
import { AREAS, FEATURES as USAGE_FEATURES, featureLabel } from "@/lib/usage-features.js";
import { limitConflicts, limitMeaning, trialTotal, trialTextMismatch } from "@/lib/limit-conflicts.js";
import { clampTrialDays, MIN_TRIAL_DAYS, MAX_TRIAL_DAYS } from "@/lib/plans.js";
import { FEATURE_DEFS, AREA_LABELS } from "@/lib/features.js";
import { perCallRates, packageCost, floorPrice, marginAt } from "@/lib/package-cost.js";

// The package list, in two parts. A shop and a service buy different things, so
// reading them as one list means holding both in your head at once.
const BIZ_GROUPS = [
  ["both", "Everyone", "Shown to both, whichever business they are"],
  ["ecommerce", "Shops", "Catalogue, orders, photo matching"],
  ["agency", "Services", "Documents, bookings, calendar"],
];

// Retired packages keep their row so an account still pointing at one reads as
// its own name rather than "no plan". They are shown, because a hidden thing
// that still exists is worse than a visible one — but last, and apart, so they
// cannot be mistaken for something on sale.
const RETIRED = ["retired", "Retired", "Not on sale. Kept so an account still on one keeps working"];
import { readJson, offlineError } from "@/lib/api-error.js";

// Packages & Costs — the business side of the admin console.
//
// Four questions this page exists to answer:
//   1. What does each client actually cost us in AI? (metered, not guessed —
//      every AI call records its tokens; see src/lib/usage.js)
//   2. Are we making money on them, after AI and fixed hosting?
//   3. What is each package allowed to do, and what does it sell for?
//   4. Where do we cap a single client or a single channel?
//
// Everything here is stored in the database, so the owner re-prices or re-limits
// without a deploy.

const usd = (n) => "$" + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const bdt = (n) => "৳" + Math.round(Number(n) || 0).toLocaleString("en-IN");
const pct = (n) => (Number.isFinite(n) ? `${Math.round(n)}%` : "—");
const num = (n) => (Number(n) || 0).toLocaleString("en-US");
// How old a number is, in words. An exchange rate with no age beside it is a
// rate nobody can decide whether to trust.
const ago = (iso) => {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return null;
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 2) return "just now";
  if (m < 60) return `${m} minutes ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
};
// Sub-cent amounts are the norm here — a per-call cost rounded to two decimals
// reads as "$0.00", which looks broken. Show enough digits to see the number.
const usdFine = (n) => {
  const v = Number(n) || 0;
  if (v === 0) return "$0";
  if (v >= 1) return usd(v);
  return "$" + v.toFixed(v >= 0.01 ? 4 : 6);
};
// Same problem in taka: a per-message cost is a few poisha, and bdt() rounds it
// to "৳0", which reads as free rather than as small.
const bdtFine = (n) => {
  const v = Number(n) || 0;
  if (v === 0) return "৳0";
  if (v >= 10) return bdt(v);
  if (v >= 1) return "৳" + v.toFixed(1);
  return "৳" + v.toFixed(v >= 0.01 ? 2 : 4);
};

// The three parts of a client's AI bill, in the order the owner reads them:
// what the owner spent by pressing a button, what setting up the catalogue
// cost, and what the bot spends by itself. Mint is not used — on this platform
// it means "bot is live" and nothing else.
const AREA_ORDER = ["platform", "catalogue", "bot", "unattributed"];
const AREA_COLOR = { platform: T.warn, catalogue: T.purple, bot: T.gold, unattributed: T.textDim };
const AREA_ICON = { platform: "ti-adjustments", catalogue: "ti-package", bot: "ti-message-2", unattributed: "ti-help-circle" };
const AREA_INFO = {
  ...AREAS,
  unattributed: { label: "Not attributed", hint: "Recorded before each call started naming itself. Real money, but it cannot be split after the fact — it stops growing from today." },
};

// The capability switches a package can turn on or off — the SAME labelled list
// the client dashboard and the admin drawer show (src/lib/features.js), so the
// three can never drift. Adding a capability there teaches the whole product to
// honour it; here it is just the toggle list, in the same order.
// Every switch the product enforces, grouped the way the gates are grouped in
// src/lib/features.js. Rendered from the registry so a feature cannot exist in
// the code without appearing here, and cannot appear here without a gate
// (tests/t-feature-gates.mjs holds the second half).
const FEATURE_AREAS = Object.keys(AREA_LABELS).map((area) => ({
  area, label: AREA_LABELS[area], items: FEATURE_DEFS.filter((d) => d.area === area),
}));

const LIMITS = [
  ["messages_per_day", "Messages / day"],
  ["messages_per_month", "Messages / month"],
  ["messages_per_channel", "Messages / channel / month"],
  ["channels", "Channels allowed"],
  ["max_products", "Products"],
  ["max_kb_files", "Knowledge files"],
  ["max_scrapes_per_month", "Website scrapes / month"],
  ["max_broadcasts_per_month", "Broadcasts / month"],
];

// Five message boxes, and not all five are live at once — see limit-conflicts.js.
// Said under the boxes rather than left to be discovered by a client whose bot
// stopped early. It is a note, not a block: the owner may well mean it, so
// nothing here refuses to save.
function LimitWarnings({ limits, planId, days }) {
  const notes = limitConflicts(limits, planId, days);
  const total = trialTotal(limits, planId, days);
  if (!notes.length && !total) return null;
  const box = (color) => ({ display: "flex", gap: 7, alignItems: "flex-start",
    background: `color-mix(in srgb, ${color} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
    borderRadius: 9, padding: "7px 9px", fontSize: 11.5, lineHeight: 1.55, color: T.textMuted });
  return <div style={{ marginTop: 9, display: "grid", gap: 6 }}>
    {/* The number an owner is actually deciding when they price a trial, which
        no single box could show. */}
    {total && <div style={box(T.success)}>
      <i className="ti ti-sum" style={{ fontSize: 14, color: T.success, flexShrink: 0, marginTop: 1 }} />
      <span>{total.text}</span>
    </div>}
    {notes.map((n, i) => <div key={i} style={box(T.warn)}>
      <i className="ti ti-alert-triangle" style={{ fontSize: 14, color: T.warn, flexShrink: 0, marginTop: 1 }} />
      <span>{n}</span>
    </div>)}
  </div>;
}

// `tab`/`onTab` are optional: the console passes them so the open tab lives in
// the address bar and survives a refresh, and the screenshot studio mounts this
// on its own with neither, where the internal state is all it needs.
export default function Packages({ token, isSuper, tab: tabProp, onTab }) {
  const [d, setD] = useState(null);
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [tabOwn, setTabOwn] = useState("money");
  const isMobile = useIsMobile();

  const load = useCallback(async () => {
    if (!token) return;
    const r = await fetch(`/api/admin/packages?days=${days}&t=${Date.now()}`, {
      cache: "no-store", headers: { Authorization: `Bearer ${token}` },
    }).then(readJson).catch(offlineError);
    if (r.error) { setMsg({ ok: false, text: r.error }); return; }
    setD(r);
  }, [token, days]);
  useEffect(() => { load(); }, [load]);

  // `quiet` is for the actions that only ASK something — reading the model list
  // off the provider is not a save, so it must not print "Saved." or reload the
  // whole screen underneath the answer. It returns the reply either way, so a
  // caller can use what came back instead of guessing from true/false.
  const post = async (body, { quiet = false } = {}) => {
    setBusy(true); if (!quiet) setMsg(null);
    const r = await fetch("/api/admin/packages", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }).then(readJson).catch(offlineError);
    setBusy(false);
    if (r.error) { if (!quiet) setMsg({ ok: false, text: r.error }); return r; }
    if (quiet) return r;
    setMsg({ ok: true, text: "Saved." });
    await load();
    return r;
  };

  if (!d) return <Card style={{ textAlign: "center", padding: "44px 20px", color: T.textDim }}>Loading…</Card>;

  // The server decides which rate applies — market, the owner's own, or the
  // house default — because the same decision has to hold on the server side of
  // any future report. Reading `settings.usd_bdt` directly here would quietly
  // ignore the market rate the moment one existed.
  const rate = Number(d.fx?.rate) || Number(d.settings?.usd_bdt) || 120;
  const t = d.totals || {};
  const revenue = (d.clients || []).reduce((n, c) => n + Number(c.revenue_bdt || 0), 0);
  const aiCostBdt = Number(t.ai_cost_usd || 0) * rate;
  const fixedBdt = Number(t.fixed_window_usd || 0) * rate;
  const profit = revenue - aiCostBdt - fixedBdt;
  const margin = revenue > 0 ? (profit / revenue) * 100 : NaN;

  const TABS = [
    { id: "money", label: "Money", icon: "ti-report-money" },
    { id: "usage", label: "API usage", icon: "ti-chart-donut" },
    { id: "clients", label: "Per client", icon: "ti-users" },
    { id: "packages", label: "Packages", icon: "ti-box" },
    { id: "rates", label: "Rates & costs", icon: "ti-adjustments" },
  ];
  // A tab id out of the address bar is not to be trusted — an unknown one would
  // render nothing at all and read as a broken page, so it falls back.
  const tab = TABS.some((x) => x.id === tabProp) ? tabProp : (onTab ? "money" : tabOwn);
  const setTab = onTab || setTabOwn;

  return <div style={{ maxWidth: 1000 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: "1 1 300px", minWidth: 0 }}>
        {TABS.map((x) => <button key={x.id} onClick={() => setTab(x.id)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 11, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
            border: `1px solid ${tab === x.id ? "transparent" : T.border}`, background: tab === x.id ? T.accGrad || T.gold : T.card, color: tab === x.id ? "#fff" : T.textMuted }}>
          <i className={`ti ${x.icon}`} />{x.label}
        </button>)}
      </div>
      <Select value={String(days)} onChange={(v) => setDays(Number(v))}
        options={[{ value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }]} />
    </div>

    {msg && <Card style={{ marginBottom: 12, padding: "10px 14px", fontSize: 13, color: msg.ok ? T.success : T.danger, display: "flex", gap: 8, alignItems: "center" }}>
      <i className={`ti ${msg.ok ? "ti-check" : "ti-alert-circle"}`} />{msg.text}
    </Card>}

    {tab === "money" && <Money d={d} rate={rate} revenue={revenue} aiCostBdt={aiCostBdt} fixedBdt={fixedBdt} profit={profit} margin={margin} isMobile={isMobile} />}
    {tab === "usage" && <ApiUsage d={d} rate={rate} isMobile={isMobile} />}
    {tab === "clients" && <PerClient d={d} rate={rate} post={post} busy={busy} isMobile={isMobile} />}
    {tab === "packages" && <PlanEditor d={d} post={post} busy={busy} isSuper={isSuper} rate={rate} />}
    {tab === "rates" && <Rates d={d} post={post} busy={busy} rate={rate} />}
  </div>;
}

// ── Money ───────────────────────────────────────────────────────────────────
function Money({ d, rate, revenue, aiCostBdt, fixedBdt, profit, margin, isMobile }) {
  const t = d.totals || {};
  const Stat = ({ label, value, sub, color }) => <Card style={{ flex: "1 1 170px", minWidth: 0 }}>
    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: T.textDim, marginBottom: 5 }}>{label}</div>
    <div style={{ fontSize: 21, fontWeight: 700, color: color || T.text, letterSpacing: "-.02em" }}>{value}</div>
    {sub && <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 3 }}>{sub}</div>}
  </Card>;

  const kinds = Object.entries(t.by_kind || {});
  const KIND_LABEL = { chat: "Replies", vision: "Photo matching", voice: "Voice notes", embed: "Search & indexing", scrape: "Website scraping" };

  return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <Stat label={`Revenue · ${d.days}d`} value={bdt(revenue)} sub="Active packages, pro-rated" />
      <Stat label="AI cost" value={bdt(aiCostBdt)} sub={`${usd(t.ai_cost_usd)} · metered`} color={T.warn} />
      <Stat label="Fixed cost" value={bdt(fixedBdt)} sub="Hosting, database, email" color={T.warn} />
      <Stat label="Profit" value={bdt(profit)} sub={`Margin ${pct(margin)}`} color={profit >= 0 ? T.success : T.danger} />
    </div>

    <Card>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>Where the AI money goes</div>
      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 12 }}>
        {fmtNum ? fmtNum(t.tokens || 0) : (t.tokens || 0).toLocaleString()} tokens across {(t.calls || 0).toLocaleString()} AI calls · {(t.messages || 0).toLocaleString()} customer messages
      </div>
      {kinds.length ? kinds.sort((a, b) => b[1].cost - a[1].cost).map(([k, v], i) => {
        const share = t.ai_cost_usd > 0 ? (v.cost / t.ai_cost_usd) * 100 : 0;
        return <div key={k} style={{ padding: "9px 0", borderTop: i ? `1px solid ${T.border}` : "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, marginBottom: 5 }}>
            <span style={{ fontWeight: 600 }}>{KIND_LABEL[k] || k}</span>
            <span style={{ color: T.textMuted }}>{bdt(v.cost * rate)} <span style={{ color: T.textDim, fontSize: 11.5 }}>({usd(v.cost)})</span></span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: T.bgAlt, overflow: "hidden" }}>
            <div style={{ width: `${Math.max(1, share)}%`, height: "100%", background: T.gold, borderRadius: 3 }} />
          </div>
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 3 }}>{(v.calls || 0).toLocaleString()} calls · {(v.tokens || 0).toLocaleString()} tokens</div>
        </div>;
      }) : <div style={{ fontSize: 13, color: T.textDim, padding: "14px 0" }}>
        No AI usage recorded yet in this window. Metering started when this feature went live — numbers fill in as customers message the bots.
      </div>}
      {Number(t.own_key_cost_usd) > 0 && <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}`, fontSize: 12, color: T.textMuted }}>
        <i className="ti ti-key" style={{ marginRight: 6, color: T.success }} />
        {usd(t.own_key_cost_usd)} of AI ran on clients' <b style={{ color: T.text }}>own keys</b> — billed to them, not to you. It is excluded from the cost above.
      </div>}
    </Card>

    <Card>
      <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 6 }}>What one customer message costs you</div>
      <div style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.7 }}>
        {t.messages > 0 && t.ai_cost_usd > 0
          ? <>Across the last {d.days} days, blended across every message type actually sent: <b style={{ color: T.text }}>{bdt((t.ai_cost_usd * rate) / t.messages)}</b> per customer message
              ({usd(t.ai_cost_usd / t.messages)}). This already includes the image and voice messages in the mix.</>
          : <>Not enough metered usage yet to work this out. Once customers have messaged the bots for a few days, this line shows the real per-message cost — automatically blended across text, image and voice.</>}
      </div>
    </Card>

    <CostPlanner d={d} rate={rate} />
  </div>;
}

// A "what if" planner: enter a volume and a message mix, get the estimated
// monthly AI cost and the minimum price to keep a healthy margin. It uses the
// REAL measured cost of each message kind where there is data, and sensible
// defaults (from the price book) where there is not — so the estimate is
// grounded, not a guess, and gets more accurate as real usage accumulates.
function CostPlanner({ d, rate }) {
  const [vol, setVol] = useState(3000);
  const [mix, setMix] = useState({ text: 80, image: 15, voice: 5 });
  const t = d.totals || {};

  // Measured average USD cost of one call of a kind, or null if never used yet.
  const perCall = (k) => { const b = t.by_kind?.[k]; return b && b.calls ? b.cost / b.calls : null; };

  // Default text-reply cost from the price book (a typical reply: ~3,000 tokens
  // in, ~250 out) when there is no measured data yet.
  const flash = (d.prices || []).find((p) => p.provider === "google" && /flash/i.test(p.model)) || { input_per_1m: 0.3, output_per_1m: 2.5 };
  const textDefault = (3000 / 1e6) * Number(flash.input_per_1m) + (250 / 1e6) * Number(flash.output_per_1m);

  const chat = perCall("chat") ?? textDefault;
  const vision = perCall("vision") ?? textDefault * 0.9;   // an image call, on top of the reply
  const voice = perCall("voice") ?? textDefault * 0.6;     // a transcription, on top of the reply

  // One customer message of each type, in USD. Image and voice each trigger an
  // extra AI call (describe / transcribe) plus the reply itself.
  const costText = chat;
  const costImage = vision + chat;
  const costVoice = voice + chat;

  const sum = Math.max(1, Number(mix.text) + Number(mix.image) + Number(mix.voice));
  const w = { text: Number(mix.text) / sum, image: Number(mix.image) / sum, voice: Number(mix.voice) / sum };
  const perMsgUsd = w.text * costText + w.image * costImage + w.voice * costVoice;
  const monthlyBdt = perMsgUsd * Number(vol || 0) * rate;

  const measured = ["chat", "vision", "voice"].some((k) => perCall(k) !== null);
  const setM = (k, v) => setMix((m) => ({ ...m, [k]: Math.max(0, Number(v) || 0) }));
  const box = { width: 70, background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 9, padding: "7px 9px", color: T.text, fontSize: 13, fontFamily: "inherit" };
  const row = (k, label, hint) => <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.textMuted }}>
    <input type="number" min="0" value={mix[k]} onChange={(e) => setM(k, e.target.value)} style={box} />
    <span>% {label} <span style={{ color: T.textDim, fontSize: 11 }}>{hint}</span></span>
  </label>;

  const Line = ({ label, value, strong, color }) => <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0", fontSize: strong ? 14 : 12.5 }}>
    <span style={{ color: strong ? T.text : T.textMuted, fontWeight: strong ? 700 : 400 }}>{label}</span>
    <span style={{ fontWeight: strong ? 700 : 600, color: color || T.text }}>{value}</span>
  </div>;

  return <Card>
    <div style={{ fontSize: 14, fontWeight: 700 }}>Cost &amp; price planner</div>
    <div style={{ fontSize: 12, color: T.textMuted, margin: "3px 0 12px", lineHeight: 1.6 }}>
      Try a package before you sell it. {measured
        ? "Using your real measured cost for each message type."
        : "Using estimates from the price book — the numbers sharpen as real usage builds up."}
    </div>

    <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <label style={{ display: "block", fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Messages / month</label>
        <input type="number" min="0" value={vol} onChange={(e) => setVol(Math.max(0, Number(e.target.value) || 0))} style={{ ...box, width: 140, fontSize: 15 }} />
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Message mix</div>
          {row("text", "text", "1 reply")}
          {row("image", "image", "~2× — match + reply")}
          {row("voice", "voice", "~1.8× — transcribe + reply")}
        </div>
      </div>

      <div style={{ flex: "1 1 240px", minWidth: 0, background: T.bgAlt, borderRadius: 14, padding: "14px 16px" }}>
        <Line label={`Per message (blended)`} value={bdt(perMsgUsd * rate)} />
        <Line label={`AI cost for ${Number(vol).toLocaleString()} msgs`} value={bdt(monthlyBdt)} strong color={T.warn} />
        <div style={{ height: 1, background: T.border, margin: "8px 0" }} />
        <div style={{ fontSize: 11, color: T.textDim, marginBottom: 4 }}>Suggested minimum price — to keep AI at…</div>
        <Line label="30% of the price" value={bdt(monthlyBdt / 0.30)} />
        <Line label="20% of the price" value={bdt(monthlyBdt / 0.20)} />
        <div style={{ fontSize: 11, color: T.textDim, marginTop: 8, lineHeight: 1.55 }}>
          The rest covers hosting, support and profit. A healthy SaaS keeps the raw AI cost well under a third of the price.
        </div>
      </div>
    </div>
  </Card>;
}

// ── API usage ───────────────────────────────────────────────────────────────
//
// The audit view. "Per client" answers whether a client is profitable; this
// answers WHY, down to the individual model and rate, because a cost number you
// cannot take apart is a number you cannot trust.
//
// Every AI call now records which part of the product asked for it, so a
// client's bill splits three ways:
//   Platform tools       — the owner pressed a button (bot profile, offer polish)
//   Products & Knowledge — indexing the catalogue or the uploaded documents
//   Bot                  — the automatic per-message work, the part that scales
//
// The first two are one-off; the third grows with traffic. Telling them apart
// is the whole point: a big import month is not a big bot month.
function ApiUsage({ d, rate, isMobile }) {
  const [open, setOpen] = useState(null);
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("cost");
  const t = d.totals || {};
  const areas = t.by_area || {};
  const totalCost = Number(t.ai_cost_usd || 0);

  const term = q.trim().toLowerCase();
  const rows = (d.clients || [])
    .filter((c) => !term || `${c.business_name || ""} ${c.owner_email || ""} ${c.plan || ""}`.toLowerCase().includes(term))
    .sort((a, b) => (sortBy === "cost" ? b.cost_usd - a.cost_usd
      : sortBy === "calls" ? (b.calls || 0) - (a.calls || 0)
      : sortBy === "tokens" ? (b.tokens || 0) - (a.tokens || 0)
      : String(a.business_name || "").localeCompare(String(b.business_name || ""))));

  const withUsage = rows.filter((c) => (c.calls || 0) > 0).length;

  return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <Accuracy d={d} rate={rate} />

    {/* The three-way split, whole platform */}
    <Card>
      <div style={{ fontSize: 14, fontWeight: 700 }}>Where every AI call came from</div>
      <div style={{ fontSize: 12, color: T.textMuted, margin: "3px 0 12px" }}>
        {num(t.calls || 0)} calls · {num(t.tokens || 0)} tokens · last {d.days} days
      </div>
      <AreaBar areas={areas} />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
        {AREA_ORDER.filter((a) => areas[a]).map((a) => {
          const v = areas[a];
          const share = totalCost > 0 ? (v.cost / totalCost) * 100 : 0;
          return <div key={a} style={{ flex: "1 1 200px", minWidth: 0, background: T.bgAlt, borderRadius: 13, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: AREA_COLOR[a], flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, fontWeight: 700, minWidth: 0 }}>{AREA_INFO[a]?.label || a}</span>
              <span style={{ marginLeft: "auto", fontSize: 11.5, color: T.textDim, fontVariantNumeric: "tabular-nums" }}>{pct(share)}</span>
            </div>
            <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums" }}>{bdtFine(v.cost * rate)}</div>
            <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
              {usdFine(v.cost)} · {num(v.calls)} calls · {num(v.tokens)} tokens
            </div>
            <div style={{ fontSize: 11, color: T.textDim, marginTop: 6, lineHeight: 1.55 }}>{AREA_INFO[a]?.hint}</div>
          </div>;
        })}
        {!AREA_ORDER.some((a) => areas[a]) && <div style={{ fontSize: 13, color: T.textDim, padding: "10px 0" }}>
          No AI usage recorded in this window yet.
        </div>}
      </div>
    </Card>

    <CostShape d={d} rate={rate} />

    <ChannelMessages d={d} rate={rate} />

    <FeatureCosts byFeature={t.by_feature || {}} totalCost={totalCost} rate={rate} days={d.days} />

    {/* Per client */}
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ position: "relative", flex: "1 1 200px", minWidth: 0 }}>
        <i className="ti ti-search" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: T.textDim, fontSize: 15, pointerEvents: "none" }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a client…"
          style={{ width: "100%", boxSizing: "border-box", background: T.card, border: `1px solid ${T.border}`, borderRadius: 11, padding: "10px 12px 10px 33px", color: T.text, fontSize: 13, fontFamily: "inherit" }} />
      </div>
      <Select value={sortBy} onChange={setSortBy} options={[
        { value: "cost", label: "Most cost" }, { value: "calls", label: "Most calls" },
        { value: "tokens", label: "Most tokens" }, { value: "name", label: "By name" },
      ]} />
    </div>
    <div style={{ fontSize: 11.5, color: T.textDim, marginTop: -4 }}>
      {withUsage} of {rows.length} client{rows.length === 1 ? "" : "s"} used AI in this window. Open one for its full call sheet.
    </div>

    {rows.map((c) => <ClientUsage key={c.client_id} c={c} rate={rate} isMobile={isMobile}
      isOpen={open === c.client_id} onToggle={() => setOpen(open === c.client_id ? null : c.client_id)} />)}
    {!rows.length && <Card style={{ textAlign: "center", padding: 30, color: T.textDim }}>No client matches that.</Card>}
  </div>;
}

// The shape of the bill: what runs BY ITSELF, and what somebody pressed.
//
// The three-part split further up answers "which area", and the feature list
// below answers "which call". Neither answers the question a price list is
// actually built from, which is: of every taka spent, how much is the bot
// answering customers — the part that grows with a client's traffic and has to
// be covered by the monthly price — and how much is the owner using the
// dashboard, which is a one-off with each product or offer.
//
// The two sides are read differently and that is the point. The bot's cost is
// divided by MESSAGES, because messages are what packages are sold on. The
// owner's side is divided by nothing: it is work they chose to do.
const BOT_AREA = "bot";
function CostShape({ d, rate }) {
  const t = d.totals || {};
  const areas = t.by_area || {};
  const byFeature = t.by_feature || {};
  const messages = Number(t.messages || 0);
  const money = (v) => Number(v?.cost || 0) + Number(v?.ownKeyCost || 0);

  const bot = money(areas[BOT_AREA]);
  const owner = money(areas.platform) + money(areas.catalogue);
  const total = bot + owner + money(areas.unattributed);
  if (!total) return null;

  // A photo costs its own vision call, so the average message and the average
  // PHOTO message are different numbers — and the gap between them is what a
  // package has to survive when a shop's customers start sending pictures.
  const vision = byFeature["bot.vision"] || {};
  const images = Number(vision.calls || 0);
  const perMsg = messages > 0 ? bot / messages : null;
  // What one photo adds ON TOP of an ordinary message: the vision call itself.
  const perImage = images > 0 ? money(vision) / images : null;

  const clients = (d.clients || []).filter((c) => (c.calls || 0) > 0);
  const perClient = clients.length ? total / clients.length : null;

  const Side = ({ title, hint, amount, share, colour, lines }) =>
    <div style={{ flex: "1 1 260px", minWidth: 0, background: T.bgAlt, borderRadius: 13, padding: "13px 15px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ width: 9, height: 9, borderRadius: 3, background: colour, flexShrink: 0 }} />
        <span style={{ fontSize: 12.5, fontWeight: 700 }}>{title}</span>
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: T.textDim, fontVariantNumeric: "tabular-nums" }}>{pct(share)}</span>
      </div>
      <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums" }}>{bdtFine(amount * rate)}</div>
      <div style={{ fontSize: 11, color: T.textDim, margin: "5px 0 9px", lineHeight: 1.55 }}>{hint}</div>
      {lines.map(([label, value, note]) => <div key={label} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "5px 0", borderTop: `1px solid ${T.border}` }}>
        <span style={{ fontSize: 11.5, color: T.textMuted, flex: "1 1 auto", minWidth: 0 }}>{label}
          {note && <span style={{ display: "block", fontSize: 10.5, color: T.textDim, marginTop: 1 }}>{note}</span>}
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{value}</span>
      </div>)}
    </div>;

  const feat = (id) => money(byFeature[id]);
  const sum = (...ids) => ids.reduce((n, id) => n + feat(id), 0);

  return <Card>
    <div style={{ fontSize: 14, fontWeight: 700 }}>Where the money actually goes</div>
    <div style={{ fontSize: 12, color: T.textMuted, margin: "3px 0 13px" }}>
      The bot answering customers is the cost that grows with traffic and has to be covered by the monthly price. The rest is the owner using the dashboard — real money, but paid once per product or per offer.
    </div>

    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <Side title="Bot — answering customers" colour={AREA_COLOR.bot}
        hint="Runs by itself on every customer message. This is what a package has to pay for."
        amount={bot} share={total > 0 ? (bot / total) * 100 : 0}
        lines={[
          ["Per message", perMsg === null ? "—" : bdtFine(perMsg * rate), `${num(messages)} messages`],
          ["A photo message costs extra", perImage === null ? "—" : `+ ${bdtFine(perImage * rate)}`, `${num(images)} photos read`],
          ["Reading the answer out of the catalogue", bdtFine(feat("bot.embed") * rate), "every message searches"],
          ["Voice notes", bdtFine(feat("bot.voice") * rate), null],
        ]} />

      <Side title="Owner using the dashboard" colour={AREA_COLOR.platform}
        hint="Work somebody pressed a button for. Paid once, not per message."
        amount={owner} share={total > 0 ? (owner / total) * 100 : 0}
        lines={[
          ["AI Assistant", bdtFine(sum("product.assistant") * rate), "answering the owner and proposing changes"],
          ["Adding products", bdtFine(sum("product.vision", "product.embed", "product.interview", "product.catalog", "product.group", "product.chat", "product.scrape") * rate), "photos read, indexed, named"],
          ["Knowledge documents", bdtFine(feat("knowledge.embed") * rate), null],
          ["Writing profiles and offers", bdtFine(sum("platform.prompt", "platform.offer") * rate), null],
        ]} />
    </div>

    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
      <MiniStat label="Average client" value={perClient === null ? "—" : bdtFine(perClient * rate)} />
      <MiniStat label="Clients using AI" value={num(clients.length)} />
      <MiniStat label="On their own key" value={num((d.clients || []).filter((c) => Number(c.own_key_cost_usd) > 0).length)} />
      <MiniStat label="Everything, this window" value={bdtFine(total * rate)} />
    </div>
  </Card>;
}

// Customer messages, and where they arrive.
//
// Packages are sold on messages, not on AI calls, so this is the number the
// business runs on — and it was only reachable by opening every client in turn
// and adding up in your head. Four things it answers that nothing else did:
// how many messages the whole platform took, which channels they came in
// through, what one message costs on average, and which connected channels are
// close to the monthly limit set on them.
const CH_ICON = { facebook: "ti-brand-messenger", instagram: "ti-brand-instagram", whatsapp: "ti-brand-whatsapp", website: "ti-world", unknown: "ti-help-circle" };
const CH_COLOR = { facebook: "#0084FF", instagram: "#E1306C", whatsapp: "#25D366", website: T.gold, unknown: T.textDim };
const CH_LABEL = { facebook: "Messenger", instagram: "Instagram", whatsapp: "WhatsApp", website: "Website widget", unknown: "Channel not recorded" };

function ChannelMessages({ d, rate }) {
  const [open, setOpen] = useState(false);
  const t = d.totals || {};
  const total = Number(t.messages || 0);
  const byPlatform = t.messages_by_platform || {};
  const cost = Number(t.ai_cost_usd || 0);

  // Every connected channel across every client, so a channel running hot is
  // visible without opening the client it belongs to.
  const chans = (d.clients || []).flatMap((c) => (c.channels || []).map((ch) => ({
    ...ch, business: c.business_name || c.owner_email || "—",
  }))).sort((a, b) => (b.messages || 0) - (a.messages || 0));

  const order = Object.keys(byPlatform).sort((a, b) => byPlatform[b] - byPlatform[a]);
  const shown = open ? chans : chans.slice(0, 6);

  return <Card>
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
      <div style={{ fontSize: 14, fontWeight: 700, flex: "1 1 200px" }}>Customer messages by channel</div>
      <div style={{ fontSize: 11.5, color: T.textDim }}>last {d.days} days</div>
    </div>
    <div style={{ fontSize: 12, color: T.textMuted, margin: "3px 0 12px" }}>
      What packages are actually sold on. One message can cost several AI calls — transcribing it, reading its photo, then answering.
    </div>

    {/* Two different kinds of "do not trust this number", and they are not the
        same warning: a ceiling means the figure is a floor; an error means the
        rows are simply missing and nothing else on the page knows it. */}
    {t.read_error && <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "9px 11px", borderRadius: 11, background: T.dangerBg, color: T.danger, fontSize: 12, lineHeight: 1.55, marginBottom: 12 }}>
      <i className="ti ti-alert-circle" style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} />
      <span>A read failed part-way through: <b>{t.read_error}</b>. Figures on this screen are missing rows — do not price anything from them until it loads cleanly.</span>
    </div>}

    {t.messages_truncated && <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "9px 11px", borderRadius: 11, background: T.warnBg, color: T.warn, fontSize: 12, lineHeight: 1.55, marginBottom: 12 }}>
      <i className="ti ti-alert-triangle" style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} />
      <span>More messages than this read can carry. <b>Every figure below is a floor, not a total.</b> Narrow the window to get an exact count.</span>
    </div>}

    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 13 }}>
      <MiniStat label="Messages" value={`${num(total)}${t.messages_truncated ? "+" : ""}`} />
      <MiniStat label="AI calls per message" value={total > 0 ? ((t.calls || 0) / total).toFixed(1) : "—"} />
      <MiniStat label="AI cost per message" value={total > 0 ? bdtFine((cost / total) * rate) : "—"} />
      <MiniStat label="Connected channels" value={num(chans.length)} />
    </div>

    {!order.length
      ? <div style={{ fontSize: 13, color: T.textDim, padding: "6px 0" }}>No customer messages in this window.</div>
      : <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {order.map((p) => {
            const n = byPlatform[p] || 0;
            const share = total > 0 ? (n / total) * 100 : 0;
            return <div key={p} style={{ flex: "1 1 170px", minWidth: 0, background: T.bgAlt, borderRadius: 13, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                <i className={`ti ${CH_ICON[p] || CH_ICON.unknown}`} style={{ fontSize: 15, color: CH_COLOR[p] || T.textDim, flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, fontWeight: 700, minWidth: 0 }}>{CH_LABEL[p] || p}</span>
                <span style={{ marginLeft: "auto", fontSize: 11.5, color: T.textDim, fontVariantNumeric: "tabular-nums" }}>{pct(share)}</span>
              </div>
              <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums" }}>{num(n)}</div>
              <div style={{ height: 4, borderRadius: 2, background: T.card, marginTop: 8, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.max(2, share)}%`, background: CH_COLOR[p] || T.textDim, opacity: .8 }} />
              </div>
            </div>;
          })}
        </div>}

    {chans.length > 0 && <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: .7, marginBottom: 7 }}>Busiest channels</div>
      {shown.map((ch, i) => {
        // A channel can carry its own monthly cap. Worth seeing before the
        // client discovers it by being cut off.
        const cap = Number(ch.msg_limit_monthly || 0);
        const used = Number(ch.messages || 0);
        const near = cap > 0 && used >= cap * 0.8;
        return <div key={`${ch.client_id}-${ch.id}`} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 0", borderTop: i ? `1px solid ${T.border}` : "none" }}>
          <i className={`ti ${CH_ICON[ch.platform] || CH_ICON.unknown}`} style={{ fontSize: 15, color: CH_COLOR[ch.platform] || T.textDim, flexShrink: 0 }} />
          <span style={{ minWidth: 0, flex: "1 1 140px" }}>
            <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.name || ch.page_id || "—"}</span>
            <span style={{ display: "block", fontSize: 11, color: T.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.business}</span>
          </span>
          {ch.status && ch.status !== "connected" && <Badge color={T.textDim}>{ch.status}</Badge>}
          {cap > 0 && <span style={{ fontSize: 11.5, color: near ? T.warn : T.textDim, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            {near && <i className="ti ti-alert-triangle" style={{ marginRight: 4 }} />}{num(used)} / {num(cap)}
          </span>}
          <span style={{ fontSize: 13.5, fontWeight: 700, fontVariantNumeric: "tabular-nums", minWidth: 60, textAlign: "right" }}>{num(used)}</span>
        </div>;
      })}
      {chans.length > 6 && <button type="button" onClick={() => setOpen((v) => !v)} className="ui-btn"
        style={{ marginTop: 9, background: "none", border: "none", padding: 0, color: T.gold, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
        {open ? "Show fewer" : `Show all ${chans.length}`}
      </button>}
    </div>}
  </Card>;
}

// Every FEATURE across the whole platform, most expensive first.
//
// The three-way split above answers "is the money going on customer chats or on
// indexing?". This answers the next question, which is the one that changes what
// gets built: WHICH feature, by name, and what one call of it costs. A feature
// whose cost per call is ten times its neighbour's is a feature worth looking
// at, and until now that number existed in the API and was never shown.
//
// "Not attributed" is deliberately kept on the list rather than hidden. It means
// a call site did not name itself, and a line that says so is how it gets fixed.
function FeatureCosts({ byFeature, totalCost, rate, days }) {
  const [open, setOpen] = useState(false);
  const rows = Object.entries(byFeature)
    .map(([id, v]) => ({
      id, ...v,
      area: USAGE_FEATURES[id]?.area || (String(id).split(".")[0] in AREA_INFO ? String(id).split(".")[0] : "unattributed"),
      label: USAGE_FEATURES[id]?.label || id,
      note: USAGE_FEATURES[id]?.note || "",
      // What one call of this feature costs. The number that says whether a
      // feature is expensive per USE, as opposed to merely used a lot.
      each: (v.calls || 0) > 0 ? (Number(v.cost || 0) + Number(v.ownKeyCost || 0)) / v.calls : 0,
    }))
    .sort((a, b) => (b.cost + b.ownKeyCost) - (a.cost + a.ownKeyCost));

  if (!rows.length) return null;
  const shown = open ? rows : rows.slice(0, 6);
  const worst = Math.max(...rows.map((r) => r.each), 0) || 1;

  return <Card>
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
      <div style={{ fontSize: 14, fontWeight: 700, flex: "1 1 200px" }}>What each feature costs</div>
      <div style={{ fontSize: 11.5, color: T.textDim }}>{rows.length} features · last {days} days</div>
    </div>
    <div style={{ fontSize: 12, color: T.textMuted, margin: "3px 0 12px" }}>
      Sorted by total spend. <b style={{ color: T.text }}>Each</b> is what one call of that feature costs on average — a feature that is expensive per use is a different problem from one that is merely used a lot.
    </div>

    <div style={{ display: "flex", flexDirection: "column" }}>
      {shown.map((r, i) => {
        const total = Number(r.cost || 0) + Number(r.ownKeyCost || 0);
        const share = totalCost > 0 ? (r.cost / totalCost) * 100 : 0;
        return <div key={r.id} style={{ padding: "10px 0", borderTop: i ? `1px solid ${T.border}` : "none" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: AREA_COLOR[r.area] || T.textDim, flexShrink: 0, alignSelf: "center" }} />
            <span style={{ fontSize: 13, fontWeight: 600, flex: "1 1 150px", minWidth: 0 }}>{r.label}</span>
            <span style={{ fontSize: 11.5, color: T.textDim, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{num(r.calls || 0)} calls</span>
            <span style={{ fontSize: 11.5, color: T.textDim, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>each {bdtFine(r.each * rate)}</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", minWidth: 74, textAlign: "right" }}>{bdtFine(total * rate)}</span>
            <span style={{ fontSize: 11.5, color: T.textDim, fontVariantNumeric: "tabular-nums", minWidth: 42, textAlign: "right" }}>{pct(share)}</span>
          </div>
          {/* Bar by cost PER CALL, not by total — the totals are already the
              column above, and this is the only place the expensive-per-use
              ones stand out. */}
          <div style={{ height: 4, borderRadius: 2, background: T.bgAlt, marginTop: 7, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.max(2, (r.each / worst) * 100)}%`, background: AREA_COLOR[r.area] || T.textDim, opacity: .75 }} />
          </div>
          {r.note && <div style={{ fontSize: 11, color: T.textDim, marginTop: 5, lineHeight: 1.5 }}>{r.note}</div>}
          {r.area === "unattributed" && <div style={{ fontSize: 11, color: T.warn, marginTop: 5, lineHeight: 1.5 }}>
            <i className="ti ti-alert-triangle" style={{ marginRight: 5 }} />This call site did not name itself. Real money, no feature — worth tracing.
          </div>}
        </div>;
      })}
    </div>

    {rows.length > 6 && <button type="button" onClick={() => setOpen((v) => !v)} className="ui-btn"
      style={{ marginTop: 10, background: "none", border: "none", padding: 0, color: T.gold, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
      {open ? "Show fewer" : `Show all ${rows.length}`}
    </button>}
  </Card>;
}

// How much of the total is measured and how much is a house guess. A cost report
// that does not say which is which is worse than no report.
function Accuracy({ d, rate }) {
  const t = d.totals || {};
  const total = Number(t.ai_cost_usd || 0);
  const unpriced = t.unpriced || [];
  const guessed = unpriced.reduce((n, m) => n + Number(m.cost || 0), 0);
  const legacy = Number(t.by_area?.unattributed?.cost || 0);
  const exact = Math.max(0, total - guessed);
  const exactPct = total > 0 ? (exact / total) * 100 : 100;
  const clean = !unpriced.length && !legacy;

  return <Card style={{ borderColor: clean ? T.border : `color-mix(in srgb, ${T.warn} 40%, transparent)` }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <i className={`ti ${clean ? "ti-shield-check" : "ti-alert-triangle"}`} style={{ fontSize: 17, color: clean ? T.success : T.warn }} />
      <div style={{ fontSize: 14, fontWeight: 700 }}>How exact are these numbers?</div>
    </div>
    <div style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.7 }}>
      {clean
        ? <>Every call in this window was priced from a rate you set yourself, and every call named which part of the product made it. Nothing here is estimated.</>
        : <><b style={{ color: T.text }}>{pct(exactPct)}</b> of the cost is priced from a rate you set. The rest falls back to the house default rate, so it is an estimate.</>}
    </div>

    {!!unpriced.length && <div style={{ marginTop: 11, padding: "10px 12px", background: T.warnBg, borderRadius: 11 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: T.warn, marginBottom: 5 }}>
        {unpriced.length} model{unpriced.length === 1 ? " has" : "s have"} no price set — {bdtFine(guessed * rate)} of the total is guessed
      </div>
      {unpriced.map((m) => <div key={`${m.provider}/${m.model}`} style={{ fontSize: 12, color: T.textMuted, padding: "2px 0" }}>
        <code style={{ fontFamily: "monospace", color: T.text }}>{m.provider}/{m.model}</code> · {num(m.calls)} calls · {usdFine(m.cost)}
      </div>)}
      <div style={{ fontSize: 11.5, color: T.textDim, marginTop: 6, lineHeight: 1.6 }}>
        Add each one in <b style={{ color: T.textMuted }}>Rates &amp; costs</b>. Cost is worked out when this page loads, not when the call happened — so setting the right rate corrects the history too, not just from today.
      </div>
    </div>}

    {legacy > 0 && <div style={{ marginTop: 9, fontSize: 11.5, color: T.textDim, lineHeight: 1.6 }}>
      <i className="ti ti-clock-hour-4" style={{ marginRight: 5 }} />
      {bdtFine(legacy * rate)} was recorded before calls started naming themselves, so it sits under <b style={{ color: T.textMuted }}>Not attributed</b>. That figure stops growing from today.
    </div>}
  </Card>;
}

// One stacked bar, three parts. Reading the split as a shape is faster than
// reading three numbers.
function AreaBar({ areas }) {
  const parts = AREA_ORDER.map((a) => ({ a, cost: Number(areas[a]?.cost || 0) })).filter((x) => x.cost > 0);
  const sum = parts.reduce((n, x) => n + x.cost, 0) || 1;
  if (!parts.length) return <div style={{ height: 9, borderRadius: 5, background: T.bgAlt }} />;
  return <div style={{ display: "flex", height: 9, borderRadius: 5, overflow: "hidden", background: T.bgAlt }}>
    {parts.map((x) => <div key={x.a} title={`${AREA_INFO[x.a]?.label}: ${pct((x.cost / sum) * 100)}`}
      style={{ width: `${(x.cost / sum) * 100}%`, background: AREA_COLOR[x.a] }} />)}
  </div>;
}

// One client's full call sheet.
function ClientUsage({ c, rate, isOpen, onToggle }) {
  const areas = c.by_area || {};
  const costBdt = Number(c.cost_usd || 0) * rate;
  const perMsg = c.messages > 0 ? costBdt / c.messages : null;
  const isAgency = c.business_type === "agency";

  return <Card style={{ padding: 0, overflow: "hidden" }}>
    <div role="button" tabIndex={0} onClick={onToggle}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
      style={{ padding: "13px 15px", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 170px", minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.business_name || "—"}</div>
          <div style={{ fontSize: 11.5, color: T.textDim, marginTop: 2 }}>
            {c.plan} plan · {isAgency ? "services" : "shop"}{c.suspended ? " · suspended" : ""}
            {Number(c.own_key_cost_usd) > 0 && <span style={{ color: T.success, fontWeight: 600 }}> · own key</span>}
          </div>
        </div>
        <div style={{ textAlign: "right", minWidth: 66 }}>
          <div style={{ fontSize: 10.5, color: T.textDim, textTransform: "uppercase", letterSpacing: .6 }}>Calls</div>
          <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{num(c.calls || 0)}</div>
        </div>
        <div style={{ textAlign: "right", minWidth: 74 }}>
          <div style={{ fontSize: 10.5, color: T.textDim, textTransform: "uppercase", letterSpacing: .6 }}>Tokens</div>
          <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{num(c.tokens || 0)}</div>
        </div>
        <div style={{ textAlign: "right", minWidth: 74 }}>
          <div style={{ fontSize: 10.5, color: T.textDim, textTransform: "uppercase", letterSpacing: .6 }}>AI cost</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.warn, fontVariantNumeric: "tabular-nums" }}>{bdtFine(costBdt)}</div>
        </div>
        <i className={`ti ti-chevron-${isOpen ? "up" : "down"}`} style={{ color: T.textDim, fontSize: 16 }} />
      </div>
      {(c.calls || 0) > 0 && <div style={{ marginTop: 10 }}><AreaBar areas={areas} /></div>}
    </div>

    {isOpen && <div style={{ borderTop: `1px solid ${T.border}`, background: T.bgAlt, padding: "13px 15px" }}>
      {(c.calls || 0) === 0
        ? <div style={{ fontSize: 12.5, color: T.textDim }}>No AI calls from this client in this window.</div>
        : <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 13 }}>
            <MiniStat label="Customer messages" value={num(c.messages || 0)} />
            <MiniStat label="Calls per message" value={c.messages > 0 ? (c.calls / c.messages).toFixed(1) : "—"} />
            <MiniStat label="Cost per message" value={perMsg === null ? "—" : bdtFine(perMsg)} />
            <MiniStat label="In / out tokens" value={`${num(c.tokens_in || 0)} / ${num(c.tokens_out || 0)}`} />
          </div>

          <ClientChannels c={c} rate={rate} />

          {AREA_ORDER.filter((a) => areas[a]).map((a) =>
            <AreaSection key={a} area={a} v={areas[a]} byFeature={c.by_feature || {}} rate={rate} isAgency={isAgency} />)}

          <ModelAudit byModel={c.by_model || {}} />

          {Number(c.own_key_cost_usd) > 0 && <div style={{ marginTop: 11, fontSize: 12, color: T.textMuted, lineHeight: 1.6 }}>
            <i className="ti ti-key" style={{ marginRight: 6, color: T.success }} />
            {usdFine(c.own_key_cost_usd)} ({bdtFine(c.own_key_cost_usd * rate)}) of this ran on <b style={{ color: T.text }}>their own key</b> — their bill, not yours. It is counted in the calls and tokens above but left out of every cost figure.
          </div>}
        </>}
    </div>}
  </Card>;
}

// This client's channels, with what the bot cost on each.
//
// The cost is APPORTIONED, not measured, and the panel says so rather than
// quietly presenting a share as a reading. Usage is recorded per client, per
// kind and per model — there is no channel on the row — so the honest thing is
// to split the bot's cost by each channel's share of that client's messages.
//
// That is right whenever a message costs about the same wherever it arrives,
// which is the normal case: the same prompt, the same model. It is wrong when
// one channel's customers send far more photos than another's, and the way to
// make it MEASURED is a `page_id` column on usage_daily — one migration, and
// then this reads instead of divides.
function ClientChannels({ c, rate }) {
  const chans = (c.channels || []).slice().sort((a, b) => (b.messages || 0) - (a.messages || 0));
  if (!chans.length) return null;
  const botCost = Number(c.by_area?.bot?.cost || 0) + Number(c.by_area?.bot?.ownKeyCost || 0);
  const counted = chans.reduce((n, ch) => n + Number(ch.messages || 0), 0);
  // Once the page_id migration has run and calls carry their channel, the cost
  // is READ. Before that — and for the history written before it — there is
  // nothing to read and the bot's spend is split by message share instead.
  // Half a threshold either way would be a figure that is part one and part the
  // other with no way to tell, so it is one or the other and it is labelled.
  const measured = Number(c.channel_measured || 0) >= 0.9;

  return <div style={{ marginBottom: 12, background: T.card, borderRadius: 13, padding: "11px 13px" }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
      <span style={{ fontSize: 13, fontWeight: 700, flex: "1 1 140px" }}>Their channels</span>
      <Badge color={measured ? T.success : T.textDim}>{measured ? "measured" : "apportioned"}</Badge>
      <span style={{ fontSize: 11, color: T.textDim }}>{num(counted)} of their {num(c.messages || 0)} messages named a channel</span>
    </div>
    <div style={{ fontSize: 11.5, color: T.textDim, margin: "0 0 6px", lineHeight: 1.55 }}>
      {measured
        ? "Each channel's own spend, recorded against it."
        : <>The bot's spend split by each channel's share of their messages — a fair split, not a separate reading. It becomes a real reading once <code style={{ fontFamily: "monospace" }}>docs/sql/2026-08-30-usage-page-id.sql</code> has been run.</>}
    </div>
    {chans.map((ch, i) => {
      const share = counted > 0 ? Number(ch.messages || 0) / counted : 0;
      const own = ch.usage ? Number(ch.usage.cost || 0) + Number(ch.usage.ownKeyCost || 0) : null;
      const cost = measured && own !== null ? own : botCost * share;
      const cap = Number(ch.msg_limit_monthly || 0);
      const near = cap > 0 && Number(ch.messages || 0) >= cap * 0.8;
      return <div key={ch.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 0", borderTop: i ? `1px solid ${T.border}` : `1px solid ${T.border}` }}>
        <i className={`ti ${CH_ICON[ch.platform] || CH_ICON.unknown}`} style={{ fontSize: 15, color: CH_COLOR[ch.platform] || T.textDim, flexShrink: 0 }} />
        <span style={{ flex: "1 1 120px", minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.name || ch.page_id || CH_LABEL[ch.platform] || "—"}</span>
          <span style={{ display: "block", fontSize: 10.5, color: T.textDim }}>{CH_LABEL[ch.platform] || ch.platform}{ch.status && ch.status !== "connected" ? ` · ${ch.status}` : ""}</span>
        </span>
        {cap > 0 && <span style={{ fontSize: 11, color: near ? T.warn : T.textDim, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
          {near && <i className="ti ti-alert-triangle" style={{ marginRight: 4 }} />}{num(ch.messages || 0)} / {num(cap)}
        </span>}
        <span style={{ fontSize: 11.5, color: T.textDim, fontVariantNumeric: "tabular-nums", minWidth: 54, textAlign: "right" }}>{num(ch.messages || 0)} msg</span>
        {/* The tilde is the whole difference between a reading and a share, so
            it appears on one and not the other. */}
        <span style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: "tabular-nums", minWidth: 64, textAlign: "right" }}>{measured ? "" : "≈ "}{bdtFine(cost * rate)}</span>
      </div>;
    })}
  </div>;
}

// Cost, with whose money it was. A BYOK client's rows have real tokens and zero
// cost TO YOU — printed as a bare "৳0" that reads as free, which is wrong in a
// way that matters when you are deciding what to charge.
function CostCell({ cost, ownKeyCost, rate, size = 12.5 }) {
  const own = Number(ownKeyCost || 0);
  const mine = Number(cost || 0);
  if (own > 0 && mine === 0) return <span style={{ fontSize: size, fontWeight: 600, color: T.textMuted, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
    {bdtFine(own * rate)} <span style={{ fontSize: size - 2, color: T.success, fontWeight: 700 }}>their key</span>
  </span>;
  return <span style={{ fontSize: size, fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
    {bdtFine(mine * rate)}
    {own > 0 && <span style={{ fontSize: size - 2, color: T.textDim, fontWeight: 400 }}> + {bdtFine(own * rate)} theirs</span>}
  </span>;
}

function MiniStat({ label, value }) {
  return <div style={{ flex: "1 1 120px", minWidth: 0, background: T.card, borderRadius: 11, padding: "9px 11px" }}>
    <div style={{ fontSize: 10.5, color: T.textDim, textTransform: "uppercase", letterSpacing: .6 }}>{label}</div>
    <div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{value}</div>
  </div>;
}

// One of the three parts, with every feature inside it on its own line.
function AreaSection({ area, v, byFeature, rate, isAgency }) {
  const lines = Object.entries(byFeature)
    .filter(([f]) => (USAGE_FEATURES[f]?.area || String(f).split(".")[0]) === area)
    .sort((a, b) => b[1].cost - a[1].cost);
  const sum = Number(v.cost || 0) + Number(v.ownKeyCost || 0) || 1;
  const subtitle = area === "catalogue"
    ? (isAgency ? "Their knowledge base — paid once per document, not per message." : "Their product catalogue — paid once per product, not per message.")
    : AREA_INFO[area]?.hint;

  return <div style={{ marginBottom: 12, background: T.card, borderRadius: 13, padding: "11px 13px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ width: 26, height: 26, borderRadius: 8, background: `color-mix(in srgb, ${AREA_COLOR[area]} 13%, transparent)`, color: AREA_COLOR[area], display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <i className={`ti ${AREA_ICON[area]}`} style={{ fontSize: 15 }} />
      </span>
      <div style={{ flex: "1 1 110px", minWidth: 0, fontSize: 13, fontWeight: 700 }}>{AREA_INFO[area]?.label || area}</div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontWeight: 700 }}><CostCell cost={v.cost} ownKeyCost={v.ownKeyCost} rate={rate} size={13.5} /></div>
        <div style={{ fontSize: 11, color: T.textDim, fontVariantNumeric: "tabular-nums" }}>{num(v.calls)} calls</div>
      </div>
    </div>
    {subtitle && <div style={{ fontSize: 11.5, color: T.textDim, margin: "6px 0 2px", lineHeight: 1.55 }}>{subtitle}</div>}

    {lines.map(([f, x], i) => <div key={f} style={{ padding: "8px 0", borderTop: `1px solid ${T.border}`, marginTop: i ? 0 : 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, minWidth: 0 }}>{featureLabel(f)}</span>
        <CostCell cost={x.cost} ownKeyCost={x.ownKeyCost} rate={rate} />
      </div>
      <div style={{ height: 4, borderRadius: 2, background: T.bgAlt, overflow: "hidden", margin: "5px 0 4px" }}>
        <div style={{ width: `${Math.max(1, ((x.cost + (x.ownKeyCost || 0)) / sum) * 100)}%`, height: "100%",
          background: AREA_COLOR[area], opacity: x.cost === 0 && x.ownKeyCost > 0 ? .35 : 1, borderRadius: 2 }} />
      </div>
      <div style={{ fontSize: 11, color: T.textDim, fontVariantNumeric: "tabular-nums" }}>
        {num(x.calls)} calls · {num(x.tokensIn)} in / {num(x.tokensOut)} out · {usdFine(x.cost + (x.ownKeyCost || 0))}
        {x.calls > 0 && <> · {usdFine((x.cost + (x.ownKeyCost || 0)) / x.calls)} each</>}
      </div>
      {USAGE_FEATURES[f]?.note && <div style={{ fontSize: 11, color: T.textDim, marginTop: 2, opacity: .85 }}>{USAGE_FEATURES[f].note}</div>}
    </div>)}
  </div>;
}

// The arithmetic, shown. Tokens × rate = cost, per model, so the total can be
// checked by hand against the provider's own bill.
function ModelAudit({ byModel }) {
  const rows = Object.entries(byModel).sort((a, b) => b[1].cost - a[1].cost);
  if (!rows.length) return null;
  const th = { textAlign: "right", fontSize: 10.5, color: T.textDim, textTransform: "uppercase", letterSpacing: .6, fontWeight: 600, padding: "0 0 6px 12px", whiteSpace: "nowrap" };
  const td = { textAlign: "right", fontSize: 12, padding: "7px 0 7px 12px", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", borderTop: `1px solid ${T.border}` };

  return <div style={{ background: T.card, borderRadius: 13, padding: "11px 13px" }}>
    <div style={{ fontSize: 13, fontWeight: 700 }}>Check the arithmetic</div>
    <div style={{ fontSize: 11.5, color: T.textDim, margin: "3px 0 8px", lineHeight: 1.55 }}>
      Tokens × the rate you set = the cost. Every model this client ran on, so the total can be checked against the provider&apos;s own bill.
    </div>
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", minWidth: 470, borderCollapse: "collapse" }}>
        <thead><tr>
          <th style={{ ...th, textAlign: "left", padding: "0 0 6px 0" }}>Model</th>
          <th style={th}>Calls</th><th style={th}>In</th><th style={th}>Out</th>
          <th style={th}>Rate / 1M</th><th style={th}>Cost</th>
        </tr></thead>
        <tbody>
          {rows.map(([k, m]) => <tr key={k}>
            <td style={{ ...td, textAlign: "left", padding: "7px 0", whiteSpace: "normal" }}>
              <span style={{ fontFamily: "monospace", fontSize: 11.5 }}>{m.model}</span>
              {m.ownKeyCost > 0 && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: T.success, whiteSpace: "nowrap" }}>their key</span>}
              {!m.priced && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: T.warn, background: T.warnBg, borderRadius: 6, padding: "2px 6px", whiteSpace: "nowrap" }}>no price set</span>}
            </td>
            <td style={td}>{num(m.calls)}</td>
            <td style={td}>{num(m.tokensIn)}</td>
            <td style={td}>{num(m.tokensOut)}</td>
            <td style={{ ...td, color: m.priced ? T.textMuted : T.warn }}>${Number(m.input_per_1m).toFixed(2)} / ${Number(m.output_per_1m).toFixed(2)}</td>
            <td style={{ ...td, fontWeight: 700 }}>{usdFine(m.cost + (m.ownKeyCost || 0))}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </div>;
}

// ── Per client ──────────────────────────────────────────────────────────────
function PerClient({ d, rate, post, busy, isMobile }) {
  const [open, setOpen] = useState(null);
  const rows = [...(d.clients || [])].sort((a, b) => b.cost_usd - a.cost_usd);

  return <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    {rows.map((c) => {
      const costBdt = c.cost_usd * rate;
      const profit = c.revenue_bdt - costBdt;
      const isOpen = open === c.client_id;
      return <Card key={c.client_id} style={{ padding: 0, overflow: "hidden" }}>
        <div onClick={() => setOpen(isOpen ? null : c.client_id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", cursor: "pointer", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 180px", minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.business_name || "—"}</div>
            <div style={{ fontSize: 11.5, color: T.textDim, marginTop: 2 }}>{c.plan}{c.limit_overrides ? " · custom limits" : ""}{c.suspended ? " · suspended" : ""}</div>
          </div>
          <div style={{ textAlign: "right", minWidth: 78 }}>
            <div style={{ fontSize: 10.5, color: T.textDim, textTransform: "uppercase", letterSpacing: .6 }}>Messages</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{(c.messages || 0).toLocaleString()}</div>
          </div>
          <div style={{ textAlign: "right", minWidth: 78 }}>
            <div style={{ fontSize: 10.5, color: T.textDim, textTransform: "uppercase", letterSpacing: .6 }}>AI cost</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.warn }}>{bdt(costBdt)}</div>
          </div>
          <div style={{ textAlign: "right", minWidth: 78 }}>
            <div style={{ fontSize: 10.5, color: T.textDim, textTransform: "uppercase", letterSpacing: .6 }}>Profit</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: profit >= 0 ? T.success : T.danger }}>{bdt(profit)}</div>
          </div>
          <i className={`ti ti-chevron-${isOpen ? "up" : "down"}`} style={{ color: T.textDim, fontSize: 16 }} />
        </div>
        {isOpen && <ClientPanel c={c} rate={rate} post={post} busy={busy} d={d} />}
      </Card>;
    })}
    {!rows.length && <Card style={{ textAlign: "center", padding: 30, color: T.textDim }}>No clients yet.</Card>}
  </div>;
}

function ClientPanel({ c, rate, post, busy, d }) {
  // What the package itself gives. Every box starts filled in with this, so the
  // panel answers "what is this client actually allowed to do?" instead of
  // showing eight empty boxes and leaving the owner to go and look it up.
  const plan = (d?.plans || []).find((p) => p.id === c.plan) || null;
  const fromPlan = (k) => (plan ? plan[k] : undefined);
  const asBox = (v) => (v === null || v === undefined ? "" : String(v));

  const [ov, setOv] = useState(() => {
    const o = {};
    for (const [k] of LIMITS) {
      const own = c.limit_overrides ? c.limit_overrides[k] : undefined;
      o[k] = own === null || own === undefined ? asBox(fromPlan(k)) : String(own);
    }
    return o;
  });
  const [chain, setChain] = useState(c.model_chain || "");
  const [chLimits, setChLimits] = useState(() => Object.fromEntries((c.channels || []).map((x) => [x.id, x.msg_limit_monthly ?? ""])));

  // Feature exceptions: the switches that mean something for this client's
  // kind of business, each following the package unless the owner has said
  // otherwise. "package" is the resting state; true/false is an exception.
  const relevantFeatures = FEATURE_DEFS.filter((f) => f.biz === "both" || f.biz === (c.business_type || "ecommerce"));
  const planFeatureOn = (k) => (plan?.features?.[k] !== false);
  const [fx, setFx] = useState(() => {
    const o = {};
    const own = (c.limit_overrides && c.limit_overrides.features) || {};
    for (const f of relevantFeatures) o[f.key] = own[f.key] === true || own[f.key] === false ? own[f.key] : "package";
    return o;
  });
  const fxExceptions = relevantFeatures.filter((f) => fx[f.key] !== "package" && fx[f.key] !== planFeatureOn(f.key)).length;
  // Only true/false travel to the server; "package" means "nothing to store".
  const fxToSend = Object.fromEntries(Object.entries(fx).filter(([, v]) => v === true || v === false));

  const set = (k, v) => setOv((o) => ({ ...o, [k]: v }));
  // A box counts as an exception only while it differs from the package. The
  // server applies the same test before storing, so what is marked here and
  // what is saved cannot disagree.
  const isCustom = (k) => {
    const box = String(ov[k] ?? "").trim();
    const pv = fromPlan(k);
    if (box === "") return false;
    return pv === null || pv === undefined || Number(pv) !== Number(box);
  };
  const customCount = LIMITS.filter(([k]) => isCustom(k)).length;
  const planLabel = plan?.name || c.plan;
  const chainFromPlan = plan?.model_chain || d?.platform_model_chain || null;
  // A trial client's boxes are described in trial days, so they need the length
  // the owner has set — not the built-in fallback.
  const tDays = clampTrialDays(d?.settings?.trial_days);

  return <div style={{ borderTop: `1px solid ${T.border}`, padding: "14px 15px", background: T.bgAlt }}>
    <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 10, lineHeight: 1.6 }}>
      {(c.tokens || 0).toLocaleString()} tokens · {(c.calls || 0).toLocaleString()} AI calls
      {c.own_key_cost_usd > 0 && <> · <b style={{ color: T.success }}>{usd(c.own_key_cost_usd)}</b> on their own key (not your cost)</>}
    </div>

    {/* Per-channel messages and caps */}
    <div style={{ fontSize: 12.5, fontWeight: 700, margin: "4px 0 8px" }}>Channels</div>
    {(c.channels || []).length ? (c.channels || []).map((ch) => <div key={ch.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "7px 0", borderTop: `1px solid ${T.border}` }}>
      <div style={{ flex: "1 1 150px", minWidth: 0, fontSize: 12.5 }}>
        <b>{ch.name || ch.platform}</b>
        <span style={{ color: T.textDim }}> · {(ch.messages || 0).toLocaleString()} msgs</span>
      </div>
      <input type="number" min="0" placeholder="No cap" value={chLimits[ch.id] ?? ""}
        onChange={(e) => setChLimits((s) => ({ ...s, [ch.id]: e.target.value }))}
        style={{ width: 110, background: T.card, border: `1px solid ${T.border}`, borderRadius: 9, padding: "7px 10px", color: T.text, fontSize: 12.5, fontFamily: "inherit" }} />
      <Btn small disabled={busy} onClick={() => post({ action: "save_channel_limit", channel_id: ch.id, msg_limit_monthly: chLimits[ch.id] })}>Set cap</Btn>
    </div>) : <div style={{ fontSize: 12, color: T.textDim, paddingBottom: 6 }}>No channels connected.</div>}

    {/* Per-client limits, pre-filled from the package */}
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", margin: "16px 0 4px" }}>
      <div style={{ fontSize: 12.5, fontWeight: 700 }}>Limits for this client</div>
      {customCount > 0 && <Badge color={T.gold}>{customCount} changed from {planLabel}</Badge>}
    </div>
    <div style={{ fontSize: 11.5, color: T.textDim, marginBottom: 9, lineHeight: 1.6 }}>
      Every box already holds what the <b style={{ color: T.textMuted }}>{planLabel}</b> package gives. Change one only where this client needs an exception — the rest keep following the package, so raising the package later raises them too. Clear a box to hand that limit back.
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 9 }}>
      {LIMITS.map(([k, fallbackLabel]) => {
        const custom = isCustom(k);
        const pv = fromPlan(k);
        const planText = pv === null || pv === undefined ? "unlimited" : Number(pv).toLocaleString("en-IN");
        // A trial does not have months, and two of these boxes are read by
        // nothing. The label says which, per package.
        const mean = limitMeaning(k, c.plan, tDays);
        const label = mean.label || fallbackLabel;
        return <div key={k}>
          <label style={{ display: "block", fontSize: 11, color: T.textMuted }}>
            {label}
            <input type="number" min="0"
              placeholder={pv === null || pv === undefined ? "Unlimited" : `From ${planLabel}`}
              value={ov[k] ?? ""} onChange={(e) => set(k, e.target.value)}
              style={{ width: "100%", marginTop: 4, background: T.card, borderRadius: 9, padding: "8px 10px", color: T.text, fontSize: 12.5, fontFamily: "inherit",
                border: `1px solid ${custom ? T.gold : T.border}`,
                boxShadow: custom ? `0 0 0 3px color-mix(in srgb, ${T.gold} 12%, transparent)` : "none" }} />
          </label>
          {/* The hint IS the undo. A separate little "reset" beside the label
              would have needed minHeight:0 to sit on one line, and that cancels
              the 44px touch floor — the exact trap the booking drawer's copy
              icons fell into. A full-width control on its own line can grow to
              44 on a phone without fighting the layout. */}
          {custom
            ? <button type="button" onClick={() => set(k, asBox(pv))}
                style={{ display: "block", width: "100%", textAlign: "left", marginTop: 3, padding: "3px 0",
                  background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
                  fontSize: 10.5, fontWeight: 600, color: T.gold }}>
                {planLabel} gives {planText} — undo
              </button>
            : <span style={{ display: "block", fontSize: 10.5, color: T.textDim, marginTop: 3, padding: "3px 0" }}>from {planLabel}</span>}
          {mean.note && <span style={{ display: "block", fontSize: 10.5, color: T.warn, marginTop: 1 }}>{mean.note}</span>}
        </div>;
      })}
    </div>
    <LimitWarnings limits={ov} planId={c.plan} days={tDays} />

    {/* Feature exceptions, pre-set to the package */}
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", margin: "16px 0 4px" }}>
      <div style={{ fontSize: 12.5, fontWeight: 700 }}>Features for this client</div>
      {fxExceptions > 0 && <Badge color={T.gold}>{fxExceptions} changed from {planLabel}</Badge>}
    </div>
    <div style={{ fontSize: 11.5, color: T.textDim, marginBottom: 9, lineHeight: 1.6 }}>
      Each one follows the <b style={{ color: T.textMuted }}>{planLabel}</b> package unless you set it here. An exception is enforced the same way the package switch is — the bot and the dashboard read the merged result.
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 8 }}>
      {relevantFeatures.map((f) => {
        const inPlan = planFeatureOn(f.key);
        const v = fx[f.key];
        const custom = v !== "package" && v !== inPlan;
        return <div key={f.key} style={{ padding: "8px 10px", borderRadius: 11, background: T.card, border: `1px solid ${custom ? T.gold : T.border}`,
          boxShadow: custom ? `0 0 0 3px color-mix(in srgb, ${T.gold} 12%, transparent)` : "none" }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>{f.label}</div>
          <select value={v === true ? "on" : v === false ? "off" : "package"}
            onChange={(e) => setFx((s) => ({ ...s, [f.key]: e.target.value === "on" ? true : e.target.value === "off" ? false : "package" }))}
            style={{ width: "100%", marginTop: 6, background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 9, padding: "7px 9px", color: T.text, fontSize: 12, fontFamily: "inherit" }}>
            <option value="package">Follow {planLabel} — {inPlan ? "on" : "off"}</option>
            <option value="on">On for this client</option>
            <option value="off">Off for this client</option>
          </select>
          <span style={{ display: "block", fontSize: 10.5, color: custom ? T.gold : T.textDim, marginTop: 4, lineHeight: 1.45 }}>
            {custom ? `Exception — ${planLabel} says ${inPlan ? "on" : "off"}.` : f.what}
          </span>
        </div>;
      })}
    </div>

    <label style={{ display: "block", fontSize: 11, color: T.textMuted, marginTop: 10 }}>
      AI models for this client <span style={{ color: T.textDim }}>(main,fallback — empty follows the package)</span>
      <input value={chain} onChange={(e) => setChain(e.target.value)} placeholder={chainFromPlan || "gemini-2.5-flash,gemini-3-flash-preview"}
        style={{ width: "100%", marginTop: 4, background: T.card, border: `1px solid ${chain ? T.gold : T.border}`, borderRadius: 9, padding: "8px 10px", color: T.text, fontSize: 12.5, fontFamily: "monospace" }} />
      <span style={{ display: "block", fontSize: 10.5, color: T.textDim, marginTop: 3 }}>
        {chain ? `Only this client. Everyone else on ${planLabel} runs ${chainFromPlan || "the built-in chain"}.` : `Following ${plan?.model_chain ? planLabel : "the platform default"} — ${chainFromPlan || "the built-in chain"}.`}
      </span>
    </label>
    <div style={{ marginTop: 11 }}>
      <Btn gold small disabled={busy} onClick={() => post({ action: "save_overrides", client_id: c.client_id, overrides: ov, model_chain: chain, features: fxToSend })}>Save limits &amp; features</Btn>
    </div>
  </div>;
}

// ── Packages ────────────────────────────────────────────────────────────────
function PlanEditor({ d, post, busy, isSuper, rate }) {
  const [editing, setEditing] = useState(null);
  const blank = { id: "", name: "", tagline: "", monthly: 0, yearly: 0, channels: 1, features: {}, feature_list: [], active: true, public: true, sort: (d.plans?.length || 0) + 1 };

  return <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <div style={{ fontSize: 12.5, color: T.textMuted, flex: 1 }}>What each package sells for and allows. Saved to the database — no deploy needed.</div>
      <Btn gold small onClick={() => setEditing(blank)}><i className="ti ti-plus" style={{ marginRight: 5 }} />New package</Btn>
    </div>

    {/* `post` returns the reply now, not a boolean, so "did it work?" is the
        absence of an error rather than a truthy object. */}
    {editing && <PlanForm plan={editing} onCancel={() => setEditing(null)} busy={busy} trialDays={d.settings?.trial_days}
      onSave={async (p, days) => {
        // Two stores, so two writes: the trial's length lives in app_settings
        // and the rest of the package in the plans table. The length goes
        // first — if it fails the owner is told and the package is left alone,
        // rather than saved next to a length that did not take.
        if (days !== null && days !== clampTrialDays(d.settings?.trial_days)) {
          // Quiet only so it does not print "Saved." and reload the screen out
          // from under the package write that follows. A failure still speaks.
          const s = await post({ action: "save_settings", settings: { trial_days: days } }, { quiet: true });
          if (s?.error) { setMsg({ ok: false, text: s.error }); return; }
        }
        const r = await post({ action: "save_plan", plan: p });
        if (!r?.error) setEditing(null);
      }} />}

    {/* This panel reads the plans table DIRECTLY — no fallback to the code
        catalogue, unlike loadPlans(). So until the migration runs it shows the
        packages that are actually there, which is right, but leaves the owner
        looking at the old ladder wondering where the new one went. Say it. */}
    {(d.plans || []).length > 0 && !(d.plans || []).some((p) => p.biz) &&
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: `color-mix(in srgb, ${T.warn} 10%, transparent)`,
        border: `1px solid color-mix(in srgb, ${T.warn} 30%, transparent)`, borderRadius: 10, padding: "9px 11px", fontSize: 12, lineHeight: 1.6, color: T.textMuted }}>
        <i className="ti ti-database-import" style={{ fontSize: 15, color: T.warn, flexShrink: 0, marginTop: 1 }} />
        <span>These are the packages before the split by business type — no package here has one yet.
          The seven new ones live in <b style={{ color: T.text }}>docs/sql/2026-08-31-plans-biz.sql</b>; run it in
          Supabase → SQL Editor and this list becomes Shops and Services. Safe to run twice.</span>
      </div>}

    {[...BIZ_GROUPS, RETIRED].map(([bizId, heading, hint]) => {
      // Retired takes precedence over business type: an inactive shop package
      // belongs at the bottom with the other retired ones, not among the
      // packages a shop can buy.
      const rows = (d.plans || []).filter((p) => (bizId === "retired"
        ? p.active === false
        : p.active !== false && (p.biz || "both") === bizId));
      if (!rows.length) return null;
      return <div key={bizId} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap", marginTop: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{heading}</div>
          <div style={{ fontSize: 11.5, color: T.textDim }}>{hint}</div>
        </div>
        {rows.map((p) => <PlanCard key={p.id} p={p} d={d} rate={rate} onEdit={() => setEditing(p)} />)}
      </div>;
    })}
  </div>;
}

// What this package costs to run, and what is left of its price.
//
// Every figure here comes from metered calls — see package-cost.js. Nothing is
// shown until something has actually been measured, because a cost invented
// from an empty book is worse than an empty space: it would be believed.
function PlanEconomics({ p, d, rate }) {
  // Platform-wide, not one client's: a package's cost is what it costs to run
  // for anybody, and one client's month is too small a sample to price from.
  const rates = perCallRates(d?.totals?.by_feature || {});
  const c = packageCost(p, rates, {});
  if (c.total.atTypical === null) {
    return <div style={{ fontSize: 11.5, color: T.textDim, marginTop: 9 }}>
      Cost not worked out yet — no AI calls have been metered for {c.unmeasured.join(", ") || "this"}. It appears once the bots have run for a day or two.
    </div>;
  }
  const price = Number(p.monthly) || 0;
  const margin = marginAt(price, c.total.atTypical, rate);
  const worst = marginAt(price, c.total.atFull, rate);
  const floor = floorPrice(c.total.atTypical, rate, 0.3);
  // A margin that is fine on average and negative on a heavy client is the one
  // worth seeing, so both are shown and the worse one decides the colour.
  const tone = worst === null ? T.textDim : worst < 0 ? T.danger : worst < 0.3 ? T.warn : T.success;
  const pc = (x) => (x === null ? "—" : `${Math.round(x * 100)}%`);
  const Cell = ({ k, v, c: col }) => <span style={{ fontSize: 11, color: T.textMuted, background: T.bgAlt, borderRadius: 7, padding: "4px 9px" }}>
    {k}: <b style={{ color: col || T.text }}>{v}</b>
  </span>;
  return <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
    <Cell k="AI cost" v={`${bdt(c.total.atTypical * rate)} typical · ${bdt(c.total.atFull * rate)} full`} />
    <Cell k="Margin" v={`${pc(margin)} typical · ${pc(worst)} full`} c={tone} />
    <Cell k="Price floor" v={floor === null ? "—" : `${bdt(floor)} at 30% AI`} />
    {c.conversations !== null && <Cell k="Conversations" v={Number(c.conversations).toLocaleString("en-IN")} />}
    {c.moderators !== null && <Cell k="Replaces" v={`${c.moderators.toFixed(1)} moderators`} />}
    {!!c.unmeasured.length && <Cell k="Not measured" v={c.unmeasured.join(", ")} c={T.warn} />}
  </div>;
}

// One package in the list, with what it costs to run underneath it.
function PlanCard({ p, d, rate, onEdit }) {
  return <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 180px", minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>{p.name} {p.highlight && <Badge color={T.gold}>Popular</Badge>} {!p.active && <Badge color={T.textDim}>Off</Badge>}</div>
          <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 2 }}>{p.tagline || p.id}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{bdt(p.monthly)}<span style={{ fontSize: 11.5, color: T.textDim, fontWeight: 400 }}>/mo</span></div>
          <div style={{ fontSize: 11.5, color: T.textDim }}>{bdt(p.yearly)}/yr</div>
        </div>
        <Btn small onClick={onEdit}>Edit</Btn>
      </div>
      <PlanEconomics p={p} d={d} rate={rate} />
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
        {LIMITS.map(([k, label]) => <span key={k} style={{ fontSize: 11, color: T.textMuted, background: T.bgAlt, borderRadius: 7, padding: "4px 9px" }}>
          {label}: <b style={{ color: T.text }}>{p[k] === null || p[k] === undefined ? "∞" : Number(p[k]).toLocaleString()}</b>
        </span>)}
      </div>
      {p.model_chain && <div style={{ fontSize: 11.5, color: T.textDim, marginTop: 8, fontFamily: "monospace" }}><i className="ti ti-cpu" style={{ marginRight: 5 }} />{p.model_chain}</div>}
    </Card>;
}

function PlanForm({ plan, onSave, onCancel, busy, trialDays }) {
  const [p, setP] = useState(() => ({ ...plan, features: { ...(plan.features || {}) } }));
  // How long the trial runs is not a column on this package — see trialDays()
  // in plan-limits.js for why — so it is held apart and saved apart. It is
  // edited here because this is where a reader looks for it.
  const [days, setDays] = useState(() => String(clampTrialDays(trialDays)));
  const isTrial = String(p.id || "").trim().toLowerCase() === "trial";
  // Every label on a trial is written in its length, so the boxes follow the
  // box above them as it is typed rather than after a save and a reload.
  const shownDays = isTrial ? clampTrialDays(days) : clampTrialDays(trialDays);
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const setF = (k, v) => setP((x) => ({ ...x, features: { ...x.features, [k]: v } }));
  const num = (k, label, hint) => {
    // Limit boxes carry the period this package actually uses, and say when
    // nothing reads them; the price and id boxes pass through unchanged.
    const mean = limitMeaning(k, p.id, shownDays);
    return <label key={k} style={{ fontSize: 11, color: T.textMuted }}>
      {mean.label || label}
      <input type="number" min="0" placeholder={hint || "Unlimited"} value={p[k] ?? ""} onChange={(e) => set(k, e.target.value)}
        style={{ width: "100%", marginTop: 4, background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 10px", color: T.text, fontSize: 12.5, fontFamily: "inherit" }} />
      {mean.note && <span style={{ display: "block", fontSize: 10.5, color: T.warn, marginTop: 3 }}>{mean.note}</span>}
    </label>;
  };

  return <Card style={{ borderColor: `color-mix(in srgb, ${T.gold} 40%, transparent)` }}>
    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{plan.id ? `Edit ${plan.name}` : "New package"}</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
      <label style={{ fontSize: 11, color: T.textMuted }}>Id <span style={{ color: T.textDim }}>(cannot change later)</span>
        <input value={p.id || ""} disabled={!!plan.id} onChange={(e) => set("id", e.target.value)} placeholder="growth"
          style={{ width: "100%", marginTop: 4, background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 10px", color: plan.id ? T.textDim : T.text, fontSize: 12.5, fontFamily: "monospace" }} />
      </label>
      <label style={{ fontSize: 11, color: T.textMuted }}>Name
        <input value={p.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="Growth"
          style={{ width: "100%", marginTop: 4, background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 10px", color: T.text, fontSize: 12.5, fontFamily: "inherit" }} />
      </label>
      {num("monthly", "Price / month (৳)", "0")}
      {num("yearly", "Price / year (৳)", "0")}
    </div>
    {/* The lower price for a client running on their OWN AI key — they cover
        their AI cost, so the platform fee drops. Charged only while they have a
        saved key (priceForClient decides); blank means this package has no
        own-key discount. Not offered on the trial, which is already free. */}
    {!isTrial && <>
      <div style={{ fontSize: 12.5, fontWeight: 700, margin: "16px 0 4px" }}>Own-key price (BYOK)</div>
      <div style={{ fontSize: 11.5, color: T.textDim, marginBottom: 8 }}>Charged only to a client running on their own AI key. Leave blank for no own-key discount.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        {num("byok_monthly", "Own-key / month (৳)", "none")}
        {num("byok_yearly", "Own-key / year (৳)", "none")}
      </div>
    </>}
    {/* Which business may buy this. It decides what the package is allowed to
        promise as much as what it is shown to: a shop has no calendar to book
        into, a service has no catalogue to match a photo against. */}
    <label style={{ display: "block", fontSize: 11, color: T.textMuted, marginTop: 10 }}>Sold to
      <Select value={p.biz || "both"} onChange={(v) => set("biz", v)}
        options={[{ value: "both", label: "Everyone (the free trial)" }, { value: "ecommerce", label: "Shops — catalogue, orders, photo matching" }, { value: "agency", label: "Services — documents, bookings, calendar" }]}
        style={{ marginTop: 4 }} />
    </label>
    <label style={{ display: "block", fontSize: 11, color: T.textMuted, marginTop: 10 }}>Tagline
      <input value={p.tagline || ""} onChange={(e) => set("tagline", e.target.value)} placeholder="For growing businesses"
        style={{ width: "100%", marginTop: 4, background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 10px", color: T.text, fontSize: 12.5, fontFamily: "inherit" }} />
    </label>

    {/* Only the trial has a length, and every limit below is described in it,
        so it is asked for first. */}
    {isTrial && <label style={{ display: "block", fontSize: 11, color: T.textMuted, marginTop: 10 }}>
      How long the trial runs (days)
      <input type="number" min={MIN_TRIAL_DAYS} max={MAX_TRIAL_DAYS} value={days}
        onChange={(e) => setDays(e.target.value)} onBlur={() => setDays(String(clampTrialDays(days)))}
        style={{ display: "block", width: "100%", maxWidth: 220, marginTop: 4, background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 10px", color: T.text, fontSize: 12.5, fontFamily: "inherit" }} />
      <span style={{ display: "block", fontSize: 10.5, color: T.textDim, marginTop: 3 }}>
        Applies to trials started from now on — {MIN_TRIAL_DAYS} to {MAX_TRIAL_DAYS} days. Anyone already on a trial keeps the end date they were given.
      </span>
      {/* The number is also written in the owner's own words, twice, and
          changing the box does not change those. */}
      {[["Tagline", p.tagline], ["Pricing-page bullets", (p.feature_list || []).join(" ")]]
        .map(([where, text]) => [where, trialTextMismatch(text, shownDays)])
        .filter(([, note]) => note)
        .map(([where, note]) => <span key={where} style={{ display: "block", fontSize: 10.5, color: T.warn, marginTop: 3 }}>{where}: {note}</span>)}
    </label>}

    <div style={{ fontSize: 12.5, fontWeight: 700, margin: "16px 0 4px" }}>Limits</div>
    <div style={{ fontSize: 11.5, color: T.textDim, marginBottom: 8 }}>Empty means unlimited.</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
      {LIMITS.map(([k, label]) => num(k, label))}
    </div>
    <LimitWarnings limits={p} planId={p.id} days={shownDays} />

    <div style={{ fontSize: 12.5, fontWeight: 700, margin: "16px 0 2px" }}>What is included</div>
    <div style={{ fontSize: 11.5, color: T.textDim, marginBottom: 10, lineHeight: 1.55 }}>
      Every switch here is enforced: a feature that is off refuses in the dashboard with a message naming this package, and the bot skips it for every client on the package. "Shops" and "services" mark the switches that only mean anything for one kind of business.
    </div>
    {FEATURE_AREAS.map((g) => <div key={g.area} style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: ".04em", textTransform: "uppercase", marginBottom: 6 }}>{g.label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 8 }}>
        {g.items.map((d) => {
          const on = p.features?.[d.key] !== false;
          return <div key={d.key} style={{ padding: "9px 11px", borderRadius: 11, background: T.bgAlt, border: `0.5px solid ${T.border}`, opacity: on ? 1 : .72 }}>
            <Switch size="sm" label={d.label} on={on} onClick={() => setF(d.key, !on)} />
            <div style={{ fontSize: 11, color: T.textDim, lineHeight: 1.5, marginTop: 5 }}>
              {d.biz !== "both" && <span style={{ fontWeight: 700, color: T.textMuted }}>{d.biz === "ecommerce" ? "Shops · " : "Services · "}</span>}{d.what}
            </div>
          </div>;
        })}
      </div>
    </div>)}

    <label style={{ display: "block", fontSize: 11, color: T.textMuted, marginTop: 14 }}>
      AI models for this package <span style={{ color: T.textDim }}>(main,fallback — empty = platform default)</span>
      <input value={p.model_chain || ""} onChange={(e) => set("model_chain", e.target.value)} placeholder="gemini-2.5-flash,gemini-2.5-pro"
        style={{ width: "100%", marginTop: 4, background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 10px", color: T.text, fontSize: 12.5, fontFamily: "monospace" }} />
    </label>
    <label style={{ display: "block", fontSize: 11, color: T.textMuted, marginTop: 10 }}>
      Pricing-page bullets <span style={{ color: T.textDim }}>(one per line)</span>
      <textarea rows={5} value={(p.feature_list || []).join("\n")} onChange={(e) => set("feature_list", e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
        style={{ width: "100%", marginTop: 4, background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 10px", color: T.text, fontSize: 12.5, fontFamily: "inherit", resize: "vertical" }} />
    </label>

    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12 }}>
      <Switch size="sm" label="Active" on={p.active !== false} onClick={() => set("active", p.active === false)} />
      <Switch size="sm" label="Show on pricing page" on={p.public !== false} onClick={() => set("public", p.public === false)} />
      <Switch size="sm" label="Mark as popular" tone="accent" on={!!p.highlight} onClick={() => set("highlight", !p.highlight)} />
    </div>

    <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
      <Btn gold disabled={busy} onClick={() => onSave(p, isTrial ? clampTrialDays(days) : null)}>{busy ? "Saving…" : "Save package"}</Btn>
      <Btn onClick={onCancel} disabled={busy}>Cancel</Btn>
    </div>
  </Card>;
}

// ── Rates & fixed costs ─────────────────────────────────────────────────────
// The dollar rate, which now looks after itself.
//
// It used to be one number typed in once. Every cost on this screen is measured
// in dollars and read in taka, so a rate that drifts makes every margin wrong at
// the same time and in the same direction — and a page whose numbers all move
// together still looks right. It follows the market unless the owner says
// otherwise, and it always says which of the two it is doing and how old the
// number is.
function ExchangeRate({ d, post, busy, rate }) {
  const fx = d.fx || {};
  const [manual, setManual] = useState(!!d.settings?.usd_bdt_manual);
  const [typed, setTyped] = useState(String(d.settings?.usd_bdt ?? rate));
  const box = { background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 9, padding: "7px 10px", color: T.text, fontSize: 12.5, fontFamily: "inherit", width: 100 };
  const age = fx.at ? ago(fx.at) : null;

  return <Card>
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
      <div style={{ fontSize: 14, fontWeight: 700, flex: "1 1 180px" }}>Exchange rate</div>
      <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>৳{Number(rate).toFixed(2)}<span style={{ fontSize: 12, color: T.textDim, fontWeight: 400 }}> / $1</span></div>
    </div>
    <div style={{ fontSize: 12, color: T.textMuted, margin: "3px 0 10px" }}>
      AI providers bill in US dollars; your packages sell in taka. Everything on this page converts with this rate.
    </div>

    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
      <Badge color={fx.source === "market" ? T.success : fx.source === "manual" ? T.gold : T.warn}>
        {fx.source === "market" ? "From the market" : fx.source === "manual" ? "Set by you" : "House default"}
      </Badge>
      {age && <span style={{ fontSize: 11.5, color: T.textDim }}>updated {age}</span>}
      {fx.source === "fallback" && <span style={{ fontSize: 11.5, color: T.warn }}>no market rate yet — press Update</span>}
      <Btn small disabled={busy} onClick={() => post({ action: "refresh_fx" })} style={{ marginLeft: "auto" }}>
        <i className="ti ti-refresh" style={{ marginRight: 5 }} />Update now
      </Btn>
    </div>

    <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
      <Switch size="sm" on={manual} onClick={() => setManual(!manual)}
        label="Use my own rate instead of the market's" />
      {manual && <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 9 }}>
        <span style={{ fontSize: 12.5, color: T.textMuted }}>1 USD =</span>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} style={box} />
        <span style={{ fontSize: 12.5, color: T.textMuted }}>৳</span>
      </div>}
      <Btn small gold disabled={busy} style={{ marginTop: 10 }}
        onClick={() => post({ action: "save_settings", settings: { ...(d.settings || {}), usd_bdt_manual: manual, usd_bdt: Number(typed) || 120 } })}>
        Save
      </Btn>
    </div>
  </Card>;
}

// Every model the platform key can actually see, and what we charge ourselves
// for it.
//
// The book used to be whatever had been typed into it. A model the platform
// runs on but nobody priced falls through to "any other model", and every
// figure under it is a house guess wearing a real number's clothes — so the
// list now asks the provider what exists and says which ones have no rate.
function ModelPrices({ d, post, busy }) {
  const [models, setModels] = useState(null);   // null = not asked yet
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true); setErr("");
    const r = await post({ action: "list_models" }, { quiet: true });
    setLoading(false);
    if (!r || r.error) { setErr(r?.error || "Could not read the model list."); return; }
    setModels(r.models || []);
  };

  const missing = (models || []).filter((m) => !m.priced);

  return <Card>
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
      <div style={{ fontSize: 14, fontWeight: 700, flex: "1 1 200px" }}>Models on your key</div>
      <Btn small disabled={busy || loading} onClick={load}>
        <i className={`ti ti-${loading ? "loader-2" : "list-search"}`} style={{ marginRight: 5 }} />
        {loading ? "Asking Google…" : models ? "Check again" : "Show what my key can use"}
      </Btn>
    </div>
    <div style={{ fontSize: 12, color: T.textMuted, margin: "3px 0 0" }}>
      Read live from the provider. Anything without a rate below is billed at the “any other model” fallback, which is a guess.
    </div>

    {err && <div style={{ fontSize: 12.5, color: T.danger, marginTop: 10 }}><i className="ti ti-alert-circle" style={{ marginRight: 6 }} />{err}</div>}

    {models && <div style={{ marginTop: 12 }}>
      {!missing.length
        ? <div style={{ fontSize: 12.5, color: T.success }}><i className="ti ti-check" style={{ marginRight: 6 }} />All {models.length} models on this key have a rate.</div>
        : <>
            <div style={{ fontSize: 11, color: T.warn, textTransform: "uppercase", letterSpacing: .7, marginBottom: 7 }}>
              {missing.length} with no rate yet
            </div>
            {missing.map((m) => <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 0", borderTop: `1px solid ${T.border}` }}>
              <span style={{ flex: "1 1 160px", minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.id}</span>
                <span style={{ display: "block", fontSize: 11, color: T.textDim }}>{m.name}</span>
              </span>
              <Badge color={T.textDim}>{m.kind}</Badge>
              <Btn small disabled={busy} onClick={() => post({ action: "save_price", price: { provider: "google", model: m.id, input_per_1m: 0, output_per_1m: 0 } })}>
                Add to the book
              </Btn>
            </div>)}
            <div style={{ fontSize: 11.5, color: T.textDim, marginTop: 9, lineHeight: 1.6 }}>
              Adding one puts it in the list below at zero — set the real per-million-token price there, from the provider's pricing page.
            </div>
          </>}
      <div style={{ fontSize: 11.5, color: T.textDim, marginTop: 10 }}>
        {models.length} model{models.length === 1 ? "" : "s"} visible to this key.
      </div>
    </div>}
  </Card>;
}

function Rates({ d, post, busy, rate }) {
  const [prices, setPrices] = useState(() => d.prices || []);
  const [costs, setCosts] = useState(() => d.platform_costs || []);
  const [editing, setEditing] = useState(null);   // which rate row is open

  const upd = (arr, set, i, k, v) => { const n = [...arr]; n[i] = { ...n[i], [k]: v }; set(n); };
  const box = { background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 9, padding: "7px 10px", color: T.text, fontSize: 12.5, fontFamily: "inherit", width: 100 };

  return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <ExchangeRate d={d} post={post} busy={busy} rate={rate} />

    <ModelPrices d={d} post={post} busy={busy} />

    <Card>
      <div style={{ fontSize: 14, fontWeight: 700 }}>What each AI model costs you</div>
      <div style={{ fontSize: 12.5, color: T.textMuted, margin: "5px 0 12px", lineHeight: 1.7 }}>
        The price of running the bot, per model. Use it to choose which model your packages
        run on — cheaper model, bigger margin.
      </div>
      {prices.map((p, i) => {
        // The rates themselves are per-million-token prices from the provider,
        // which mean nothing to a business owner. So the headline is what those
        // rates work out to in taka for 1,000 replies (a typical reply is about
        // 3,000 tokens of question + product context in, 250 tokens out), and
        // the raw numbers hide behind "Edit rate".
        const per1000 = ((3000 / 1e6) * (Number(p.input_per_1m) || 0) + (250 / 1e6) * (Number(p.output_per_1m) || 0)) * 1000 * rate;
        const isDefault = p.model === "__default__";
        const open = editing === `${p.provider}/${p.model}`;
        return <div key={`${p.provider}/${p.model}`} style={{ padding: "11px 0", borderTop: i ? `1px solid ${T.border}` : "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 190px", minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>
                {isDefault ? "Any other model" : p.model}
              </div>
              <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>
                {isDefault ? "Used when a model is not listed here, so nothing ever looks free by mistake" : p.provider}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{bdt(per1000)}</div>
              <div style={{ fontSize: 10.5, color: T.textDim }}>per 1,000 replies</div>
            </div>
            <button onClick={() => setEditing(open ? null : `${p.provider}/${p.model}`)}
              style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 9, padding: "6px 11px", color: T.textMuted, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>
              {open ? "Close" : "Edit rate"}
            </button>
          </div>
          {open && <div style={{ marginTop: 10, padding: "11px 13px", background: T.bgAlt, borderRadius: 11 }}>
            <div style={{ fontSize: 11.5, color: T.textMuted, marginBottom: 9, lineHeight: 1.65 }}>
              These are the provider's own prices in US dollars for 1 million <b style={{ color: T.text }}>tokens</b> (a token is about 4 letters).
              Copy them from ai.google.dev/pricing whenever Google changes them —
              nothing else needs updating.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              <label style={{ fontSize: 10.5, color: T.textDim, display: "inline-flex", flexDirection: "column", gap: 3 }}>
                Text you send it
                <input value={p.input_per_1m} onChange={(e) => upd(prices, setPrices, i, "input_per_1m", e.target.value)} style={{ ...box, width: 90 }} />
              </label>
              <label style={{ fontSize: 10.5, color: T.textDim, display: "inline-flex", flexDirection: "column", gap: 3 }}>
                Text it writes back
                <input value={p.output_per_1m} onChange={(e) => upd(prices, setPrices, i, "output_per_1m", e.target.value)} style={{ ...box, width: 90 }} />
              </label>
              <Btn small gold disabled={busy} onClick={() => post({ action: "save_price", provider: p.provider, model: p.model, input_per_1m: p.input_per_1m, output_per_1m: p.output_per_1m })}>Save rate</Btn>
            </div>
          </div>}
        </div>;
      })}
      <div style={{ fontSize: 11.5, color: T.textDim, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.border}`, lineHeight: 1.6 }}>
        <i className="ti ti-info-circle" style={{ marginRight: 6 }} />
        These prices are already filled in from the providers' published rates — you only need to touch them if a provider changes its pricing.
      </div>
    </Card>

    <Card>
      <div style={{ fontSize: 14, fontWeight: 700 }}>Fixed monthly costs</div>
      <div style={{ fontSize: 12, color: T.textMuted, margin: "3px 0 10px" }}>What you pay every month regardless of usage, in USD. These are subtracted from profit.</div>
      {costs.map((c, i) => <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "8px 0", borderTop: i ? `1px solid ${T.border}` : "none" }}>
        <span style={{ flex: "1 1 150px", minWidth: 0, fontSize: 12.5 }}>{c.label}</span>
        <input value={c.monthly_usd} onChange={(e) => upd(costs, setCosts, i, "monthly_usd", e.target.value)} style={box} />
        <span style={{ fontSize: 11.5, color: T.textDim }}>USD/mo</span>
        <Btn small disabled={busy} onClick={() => post({ action: "save_platform_cost", id: c.id, label: c.label, monthly_usd: c.monthly_usd })}>Save</Btn>
      </div>)}
    </Card>
  </div>;
}
