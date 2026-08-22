"use client";
import { useState, useEffect, useCallback } from "react";
import { T, Card, Btn, Badge, Inp, Select, useIsMobile, fmtNum } from "../dashboard/components/ui.js";

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

// The capability switches a package can turn on or off. Kept here (not in the
// database) so the list is code-reviewed: adding one means teaching the product
// to honour it.
const FEATURES = [
  ["vision", "Photo product matching"],
  ["voice", "Voice message understanding"],
  ["kb", "Knowledge Base uploads"],
  ["calendar", "Google Calendar booking"],
  ["comments", "Comment automation"],
  ["widget", "Website chat widget"],
  ["broadcast", "Broadcasts"],
  ["followup", "Follow-up messages"],
  ["byok", "Can use their own AI key"],
];

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

export default function Packages({ token, isSuper }) {
  const [d, setD] = useState(null);
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [tab, setTab] = useState("money");
  const isMobile = useIsMobile();

  const load = useCallback(async () => {
    if (!token) return;
    const r = await fetch(`/api/admin/packages?days=${days}&t=${Date.now()}`, {
      cache: "no-store", headers: { Authorization: `Bearer ${token}` },
    }).then((x) => x.json()).catch(() => ({ error: "network" }));
    if (r.error) { setMsg({ ok: false, text: r.error }); return; }
    setD(r);
  }, [token, days]);
  useEffect(() => { load(); }, [load]);

  const post = async (body) => {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/admin/packages", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }).then((x) => x.json()).catch(() => ({ error: "network" }));
    setBusy(false);
    if (r.error) { setMsg({ ok: false, text: r.error }); return false; }
    setMsg({ ok: true, text: "Saved." });
    await load();
    return true;
  };

  if (!d) return <Card style={{ textAlign: "center", padding: "44px 20px", color: T.textDim }}>Loading…</Card>;

  const rate = Number(d.settings?.usd_bdt) || 120;
  const t = d.totals || {};
  const revenue = (d.clients || []).reduce((n, c) => n + Number(c.revenue_bdt || 0), 0);
  const aiCostBdt = Number(t.ai_cost_usd || 0) * rate;
  const fixedBdt = Number(t.fixed_window_usd || 0) * rate;
  const profit = revenue - aiCostBdt - fixedBdt;
  const margin = revenue > 0 ? (profit / revenue) * 100 : NaN;

  const TABS = [
    { id: "money", label: "Money", icon: "ti-report-money" },
    { id: "clients", label: "Per client", icon: "ti-users" },
    { id: "packages", label: "Packages", icon: "ti-box" },
    { id: "rates", label: "Rates & costs", icon: "ti-adjustments" },
  ];

  return <div style={{ maxWidth: 1000 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
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
    {tab === "clients" && <PerClient d={d} rate={rate} post={post} busy={busy} isMobile={isMobile} />}
    {tab === "packages" && <PlanEditor d={d} post={post} busy={busy} isSuper={isSuper} />}
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
  const KIND_LABEL = { chat: "Replies", vision: "Photo matching", voice: "Voice notes", embed: "Catalogue / knowledge indexing", scrape: "Website scraping" };

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
          ? <>Across the last {d.days} days: <b style={{ color: T.text }}>{bdt((t.ai_cost_usd * rate) / t.messages)}</b> per customer message
              ({usd(t.ai_cost_usd / t.messages)}). Use this to price a package: a 3,000-message plan costs you about{" "}
              <b style={{ color: T.text }}>{bdt(((t.ai_cost_usd * rate) / t.messages) * 3000)}</b> in AI.</>
          : <>Not enough metered usage yet to work this out. Once customers have messaged the bots for a few days, this line shows the real per-message cost — the number your package prices should be built on.</>}
      </div>
    </Card>
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
        {isOpen && <ClientPanel c={c} rate={rate} post={post} busy={busy} />}
      </Card>;
    })}
    {!rows.length && <Card style={{ textAlign: "center", padding: 30, color: T.textDim }}>No clients yet.</Card>}
  </div>;
}

function ClientPanel({ c, rate, post, busy }) {
  const [ov, setOv] = useState(() => ({ ...(c.limit_overrides || {}) }));
  const [chain, setChain] = useState(c.model_chain || "");
  const [chLimits, setChLimits] = useState(() => Object.fromEntries((c.channels || []).map((x) => [x.id, x.msg_limit_monthly ?? ""])));

  const set = (k, v) => setOv((o) => ({ ...o, [k]: v }));

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

    {/* Per-client overrides */}
    <div style={{ fontSize: 12.5, fontWeight: 700, margin: "16px 0 4px" }}>Custom limits for this client</div>
    <div style={{ fontSize: 11.5, color: T.textDim, marginBottom: 9 }}>Leave a box empty to use the package's value. These beat the package.</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 9 }}>
      {LIMITS.map(([k, label]) => <label key={k} style={{ fontSize: 11, color: T.textMuted }}>
        {label}
        <input type="number" min="0" placeholder="From package" value={ov[k] ?? ""} onChange={(e) => set(k, e.target.value)}
          style={{ width: "100%", marginTop: 4, background: T.card, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 10px", color: T.text, fontSize: 12.5, fontFamily: "inherit" }} />
      </label>)}
    </div>
    <label style={{ display: "block", fontSize: 11, color: T.textMuted, marginTop: 10 }}>
      AI models for this client <span style={{ color: T.textDim }}>(main,fallback — empty = package default)</span>
      <input value={chain} onChange={(e) => setChain(e.target.value)} placeholder="gemini-2.5-flash,gemini-2.5-pro"
        style={{ width: "100%", marginTop: 4, background: T.card, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 10px", color: T.text, fontSize: 12.5, fontFamily: "monospace" }} />
    </label>
    <div style={{ marginTop: 11 }}>
      <Btn gold small disabled={busy} onClick={() => post({ action: "save_overrides", client_id: c.client_id, overrides: ov, model_chain: chain })}>Save custom limits</Btn>
    </div>
  </div>;
}

// ── Packages ────────────────────────────────────────────────────────────────
function PlanEditor({ d, post, busy, isSuper }) {
  const [editing, setEditing] = useState(null);
  const blank = { id: "", name: "", tagline: "", monthly: 0, yearly: 0, channels: 1, features: {}, feature_list: [], active: true, public: true, sort: (d.plans?.length || 0) + 1 };

  return <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <div style={{ fontSize: 12.5, color: T.textMuted, flex: 1 }}>What each package sells for and allows. Saved to the database — no deploy needed.</div>
      <Btn gold small onClick={() => setEditing(blank)}><i className="ti ti-plus" style={{ marginRight: 5 }} />New package</Btn>
    </div>

    {editing && <PlanForm plan={editing} onCancel={() => setEditing(null)} busy={busy}
      onSave={async (p) => { if (await post({ action: "save_plan", plan: p })) setEditing(null); }} />}

    {(d.plans || []).map((p) => <Card key={p.id}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 180px", minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>{p.name} {p.highlight && <Badge color={T.gold}>Popular</Badge>} {!p.active && <Badge color={T.textDim}>Off</Badge>}</div>
          <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 2 }}>{p.tagline || p.id}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{bdt(p.monthly)}<span style={{ fontSize: 11.5, color: T.textDim, fontWeight: 400 }}>/mo</span></div>
          <div style={{ fontSize: 11.5, color: T.textDim }}>{bdt(p.yearly)}/yr</div>
        </div>
        <Btn small onClick={() => setEditing(p)}>Edit</Btn>
      </div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
        {LIMITS.map(([k, label]) => <span key={k} style={{ fontSize: 11, color: T.textMuted, background: T.bgAlt, borderRadius: 7, padding: "4px 9px" }}>
          {label}: <b style={{ color: T.text }}>{p[k] === null || p[k] === undefined ? "∞" : Number(p[k]).toLocaleString()}</b>
        </span>)}
      </div>
      {p.model_chain && <div style={{ fontSize: 11.5, color: T.textDim, marginTop: 8, fontFamily: "monospace" }}><i className="ti ti-cpu" style={{ marginRight: 5 }} />{p.model_chain}</div>}
    </Card>)}
  </div>;
}

function PlanForm({ plan, onSave, onCancel, busy }) {
  const [p, setP] = useState(() => ({ ...plan, features: { ...(plan.features || {}) } }));
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const setF = (k, v) => setP((x) => ({ ...x, features: { ...x.features, [k]: v } }));
  const num = (k, label, hint) => <label key={k} style={{ fontSize: 11, color: T.textMuted }}>
    {label}
    <input type="number" min="0" placeholder={hint || "Unlimited"} value={p[k] ?? ""} onChange={(e) => set(k, e.target.value)}
      style={{ width: "100%", marginTop: 4, background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 10px", color: T.text, fontSize: 12.5, fontFamily: "inherit" }} />
  </label>;

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
    <label style={{ display: "block", fontSize: 11, color: T.textMuted, marginTop: 10 }}>Tagline
      <input value={p.tagline || ""} onChange={(e) => set("tagline", e.target.value)} placeholder="For growing businesses"
        style={{ width: "100%", marginTop: 4, background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 10px", color: T.text, fontSize: 12.5, fontFamily: "inherit" }} />
    </label>

    <div style={{ fontSize: 12.5, fontWeight: 700, margin: "16px 0 4px" }}>Limits</div>
    <div style={{ fontSize: 11.5, color: T.textDim, marginBottom: 8 }}>Empty means unlimited.</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
      {LIMITS.map(([k, label]) => num(k, label))}
    </div>

    <div style={{ fontSize: 12.5, fontWeight: 700, margin: "16px 0 8px" }}>What is included</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 7 }}>
      {FEATURES.map(([k, label]) => <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.textMuted, cursor: "pointer" }}>
        <input type="checkbox" checked={p.features?.[k] !== false} onChange={(e) => setF(k, e.target.checked)} />{label}
      </label>)}
    </div>

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
      <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: T.textMuted }}>
        <input type="checkbox" checked={p.active !== false} onChange={(e) => set("active", e.target.checked)} />Active
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: T.textMuted }}>
        <input type="checkbox" checked={p.public !== false} onChange={(e) => set("public", e.target.checked)} />Show on pricing page
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: T.textMuted }}>
        <input type="checkbox" checked={!!p.highlight} onChange={(e) => set("highlight", e.target.checked)} />Mark as popular
      </label>
    </div>

    <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
      <Btn gold disabled={busy} onClick={() => onSave(p)}>{busy ? "Saving…" : "Save package"}</Btn>
      <Btn onClick={onCancel} disabled={busy}>Cancel</Btn>
    </div>
  </Card>;
}

// ── Rates & fixed costs ─────────────────────────────────────────────────────
function Rates({ d, post, busy, rate }) {
  const [prices, setPrices] = useState(() => d.prices || []);
  const [costs, setCosts] = useState(() => d.platform_costs || []);
  const [fx, setFx] = useState(String(rate));

  const upd = (arr, set, i, k, v) => { const n = [...arr]; n[i] = { ...n[i], [k]: v }; set(n); };
  const box = { background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 9, padding: "7px 10px", color: T.text, fontSize: 12.5, fontFamily: "inherit", width: 100 };

  return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <Card>
      <div style={{ fontSize: 14, fontWeight: 700 }}>Exchange rate</div>
      <div style={{ fontSize: 12, color: T.textMuted, margin: "3px 0 10px" }}>AI providers bill in US dollars; your packages sell in taka. Everything on this page converts with this rate.</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, color: T.textMuted }}>1 USD =</span>
        <input value={fx} onChange={(e) => setFx(e.target.value)} style={box} />
        <span style={{ fontSize: 12.5, color: T.textMuted }}>৳</span>
        <Btn small gold disabled={busy} onClick={() => post({ action: "save_settings", settings: { usd_bdt: Number(fx) || 120 } })}>Save</Btn>
      </div>
    </Card>

    <Card>
      <div style={{ fontSize: 14, fontWeight: 700 }}>What each AI model charges you</div>
      <div style={{ fontSize: 12.5, color: T.textMuted, margin: "5px 0 12px", lineHeight: 1.75 }}>
        AI companies bill by the <b style={{ color: T.text }}>token</b> — about 4 letters of text. They charge two
        separate rates: one for the text you <b style={{ color: T.text }}>send them</b> (the customer's question plus
        your product data and the bot's instructions), and a higher one for the text the bot
        <b style={{ color: T.text }}> writes back</b>. Both are prices in US dollars for 1 million tokens, copied
        straight from the provider's pricing page — that is all the two boxes below hold.
        Every cost figure on this page is worked out from them, so if a provider changes its
        prices, change them here too.
      </div>
      <div style={{ fontSize: 11.5, color: T.textDim, background: T.bgAlt, borderRadius: 10, padding: "9px 12px", marginBottom: 12, lineHeight: 1.65 }}>
        <i className="ti ti-info-circle" style={{ marginRight: 6 }} />
        Google's prices: <b style={{ color: T.textMuted }}>ai.google.dev/pricing</b> · OpenAI's: <b style={{ color: T.textMuted }}>openai.com/api/pricing</b>.
        The row named <b style={{ color: T.textMuted }}>__default__</b> is used for any model that is not listed here, so a new model never looks free by mistake.
      </div>
      {prices.map((p, i) => {
        // A concrete number instead of an abstract rate: what 1,000 bot replies
        // would cost at these rates, on a typical reply (about 3,000 tokens of
        // question + product context in, 250 tokens of answer out).
        const per1000 = ((3000 / 1e6) * (Number(p.input_per_1m) || 0) + (250 / 1e6) * (Number(p.output_per_1m) || 0)) * 1000 * rate;
        return <div key={`${p.provider}/${p.model}`} style={{ padding: "10px 0", borderTop: i ? `1px solid ${T.border}` : "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ flex: "1 1 160px", minWidth: 0, fontSize: 12.5, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis" }}>
              <span style={{ color: T.textDim }}>{p.provider}/</span>{p.model}
            </span>
            <label style={{ fontSize: 10.5, color: T.textDim, display: "inline-flex", flexDirection: "column", gap: 3 }} title="Price for the text you send the AI">
              You send
              <input value={p.input_per_1m} onChange={(e) => upd(prices, setPrices, i, "input_per_1m", e.target.value)} style={{ ...box, width: 82 }} />
            </label>
            <label style={{ fontSize: 10.5, color: T.textDim, display: "inline-flex", flexDirection: "column", gap: 3 }} title="Price for the reply the AI writes back — usually the expensive one">
              Bot replies
              <input value={p.output_per_1m} onChange={(e) => upd(prices, setPrices, i, "output_per_1m", e.target.value)} style={{ ...box, width: 82 }} />
            </label>
            <Btn small disabled={busy} onClick={() => post({ action: "save_price", provider: p.provider, model: p.model, input_per_1m: p.input_per_1m, output_per_1m: p.output_per_1m })}>Save</Btn>
          </div>
          <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 6 }}>
            At these rates, 1,000 bot replies cost you about <b style={{ color: T.text }}>{bdt(per1000)}</b>
            <span style={{ color: T.textDim }}> — a typical reply, USD per 1M tokens</span>
          </div>
        </div>;
      })}
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
