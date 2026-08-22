"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { createAdminClient as createSb } from "@/utils/supabase/client";
import Packages from "./Packages.js";
import { T, Theme, Motion, useTheme, ThemeToggle, Card, Btn, Badge, Segmented, Select, Inp, KStat, Spark, BarList, OnboardFrame, useIsMobile, taka, shortDate, fmtNum, PLAN_META } from "../dashboard/components/ui.js";

// The super-admin console. Same design system as the customer dashboard —
// crimson on soft white, neumorphic depth, dark mode — arranged as a command
// centre: what needs a human today, how the platform is moving, every client
// one click away, payments to verify, and (super only) who else may be here.

let sb = null;
function getSb() { if (!sb) sb = createSb(); return sb; }

const ROLE = {
  super: { label: "Super Admin", color: T.purple, icon: "ti-crown" }, full: { label: "Full access", color: T.success, icon: "ti-shield-check" },
  editor: { label: "Editor", color: T.gold, icon: "ti-pencil" }, viewer: { label: "Viewer", color: T.textMuted, icon: "ti-eye" },
  pending: { label: "Pending", color: T.warn, icon: "ti-clock" }, blocked: { label: "Blocked", color: T.danger, icon: "ti-ban" },
};
const PLAT = {
  facebook: { label: "Facebook", icon: "ti-brand-facebook", color: "#1877F2" }, instagram: { label: "Instagram", icon: "ti-brand-instagram", color: "#E1306C" },
  whatsapp: { label: "WhatsApp", icon: "ti-brand-whatsapp", color: "#25D366" }, website: { label: "Website", icon: "ti-world", color: "#6D3FD9" }, unknown: { label: "Other", icon: "ti-message", color: "#8A91A3" },
};
const KIND = {
  payment: { icon: "ti-cash", color: T.warn }, trial: { icon: "ti-hourglass", color: T.warn }, expiry: { icon: "ti-calendar-x", color: T.danger },
  suspended: { icon: "ti-player-pause", color: T.danger }, nochannel: { icon: "ti-plug-x", color: T.textDim }, quiet: { icon: "ti-zzz", color: T.textDim },
  signup: { icon: "ti-user-plus", color: T.success }, order: { icon: "ti-shopping-bag", color: T.gold }, booking: { icon: "ti-calendar-event", color: T.purple }, channel: { icon: "ti-plug-connected", color: T.info },
};
const planColor = (p) => (PLAN_META[p] || PLAN_META.none).color;
const planName = (p) => (PLAN_META[p] || PLAN_META.none).name;
const pct = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 100) : (cur ? null : 0));
const ago = (iso) => {
  if (!iso) return "never";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now"; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 30 * 86400) return `${Math.floor(s / 86400)}d ago`; return shortDate(iso);
};
const initialsOf = (s) => (s || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

function Avatar({ c, size = 38 }) {
  return <div style={{ width: size, height: size, borderRadius: size * 0.32, background: c?.logo_url ? T.bgAlt : T.accGrad, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 700, flexShrink: 0, overflow: "hidden", boxShadow: T.nmSm }}>
    {c?.logo_url ? <img src={c.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initialsOf(c?.business_name || c?.owner_email)}
  </div>;
}
function ChannelDots({ channels }) {
  if (!channels?.length) return <span style={{ fontSize: 11.5, color: T.textDim }}>No channel</span>;
  return <span style={{ display: "inline-flex", gap: 5 }}>{channels.map((ch, i) => { const p = PLAT[ch.platform] || PLAT.unknown; const on = ch.status === "connected"; return <span key={i} title={`${p.label} · ${ch.status}`} style={{ width: 24, height: 24, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", background: on ? `${p.color}1f` : T.bgAlt, color: on ? p.color : T.textDim, fontSize: 14 }}><i className={`ti ${p.icon}`} /></span>; })}</span>;
}
function PlanPill({ c }) {
  const left = c.plan === "trial" ? c.trial_days_left : c.plan_days_left;
  const sub = left === null || left === undefined ? "" : left <= 0 ? " · expired" : ` · ${left}d`;
  return <Badge color={planColor(c.plan)}>{planName(c.plan)}{sub}</Badge>;
}
function SectionTitle({ icon, children, right }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
    <span style={{ width: 30, height: 30, borderRadius: 10, background: T.goldBg, color: T.gold, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}><i className={`ti ${icon}`} /></span>
    <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-.01em", flex: 1 }}>{children}</span>{right}
  </div>;
}
function Empty({ icon, text }) { return <div style={{ padding: "22px 10px", textAlign: "center", color: T.textDim, fontSize: 12.5 }}><i className={`ti ${icon}`} style={{ fontSize: 22, display: "block", marginBottom: 6 }} />{text}</div>; }
function PwInput({ value, onChange, placeholder, onEnter, style }) {
  const [show, setShow] = useState(false);
  return <div style={{ position: "relative", ...style }}>
    <input type={show ? "text" : "password"} value={value} onChange={onChange} placeholder={placeholder} onKeyDown={(e) => e.key === "Enter" && onEnter && onEnter()} className="ui-inp"
      style={{ width: "100%", background: T.bgAlt, boxShadow: T.nmIn, border: `1px solid ${T.border}`, borderRadius: 14, padding: "13px 56px 13px 16px", color: T.text, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
    <button type="button" onClick={() => setShow((s) => !s)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: 12, padding: 6, minHeight: 0 }}>{show ? "Hide" : "Show"}</button>
  </div>;
}

// ── Root: session, data, actions ─────────────────────────────────────────────
export default function AdminClient() {
  const [session, setSession] = useState(undefined);
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [authMsg, setAuthMsg] = useState(""); const [authBusy, setAuthBusy] = useState(false);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(""); const [err, setErr] = useState("");
  const [superKey, setSuperKey] = useState("");
  const [detail, setDetail] = useState(null); const [detailLoading, setDetailLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    getSb().auth.getSession().then(({ data: { session: s } }) => setSession(s || null));
    const { data: sub } = getSb().auth.onAuthStateChange((_e, s) => setSession(s || null));
    return () => sub.subscription.unsubscribe();
  }, []);
  const api = useCallback(async (method, body, extraHeaders) => {
    const token = session?.access_token || "";
    const url = method === "GET" ? `/api/admin?t=${Date.now()}` : "/api/admin";
    return fetch(url, { method, cache: "no-store", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(extraHeaders || {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  }, [session]);
  const load = useCallback(async (silent) => {
    if (!silent) { setErr(""); setRefreshing(true); }
    const res = await api("GET");
    if (res.status === 401) { if (!silent) { setData(null); setRefreshing(false); } return; }
    const d = await res.json().catch(() => null);
    if (d) setData(d);
    if (!silent) setRefreshing(false);
  }, [api]);
  useEffect(() => { if (session) load(); }, [session, load]);
  useEffect(() => { if (!session) return; const t = setInterval(() => load(true), 15000); return () => clearInterval(t); }, [session, load]);

  const auth = async () => {
    if (authBusy) return; setAuthMsg(""); setAuthBusy(true);
    const fn = mode === "signup" ? "signUp" : "signInWithPassword";
    const { error } = await getSb().auth[fn]({ email, password });
    setAuthBusy(false);
    if (error) setAuthMsg(error.message);
    else if (mode === "signup") setAuthMsg("Account created. If email confirmation is on, verify then sign in.");
  };
  // scope:"local" ends only THIS console's session. The default (global)
  // revokes every session of the same user server-side — which used to log
  // the owner out of their client dashboard as a side effect.
  const logout = async () => { await getSb().auth.signOut({ scope: "local" }); setData(null); setSuperKey(""); };
  const run = async (label, fn) => { setBusy(label); setErr(""); const res = await fn(); if (res && !res.ok) { const d = await res.json().catch(() => ({})); setErr(d.error || "That did not work — please try again."); } await load(true); setBusy(""); return res?.ok; };
  const act = (id, action, value) => run(id + action, () => api("PUT", { id, action, value }));
  const reviewPayment = (req, decision, note) => run(req.id + decision, () => api("PUT", { type: "payment", request_id: req.id, decision, note: note || null }));
  const del = (c) => run(c.id + "del", () => api("DELETE", { id: c.id, confirm: "DELETE" }));
  const setRole = (target_email, new_role) => run(target_email + new_role, () => api("PUT", { type: "set_role", target_email, new_role }, { "x-admin-key": superKey }));
  const removeAdmin = (target_email) => run(target_email + "remove", () => api("PUT", { type: "remove_admin", target_email }, { "x-admin-key": superKey }));
  // BYOK: grant or revoke a client's permission to use their own AI key.
  // Errors come back to the drawer (the global banner sits underneath it),
  // so these return {ok, error}.
  const aiPermission = (action) => async (client_id) => {
    setBusy(client_id + "aikey");
    const res = await api("PUT", { type: "ai_key", action, client_id }, { "x-admin-key": superKey });
    const d = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) return { ok: false, error: d.error || "That did not work" };
    await openDetail(client_id);
    return { ok: true };
  };
  const allowAiKey = aiPermission("allow");
  const revokeAiKey = aiPermission("revoke");
  const openDetail = async (id) => {
    setDetailLoading(true); setDetail({ id, loading: true });
    const res = await fetch(`/api/admin/client-detail?id=${id}&t=${Date.now()}`, { cache: "no-store", headers: { Authorization: `Bearer ${session?.access_token || ""}` } });
    const d = await res.json().catch(() => null);
    setDetail(d && !d.error ? { id, ...d } : null); setDetailLoading(false);
  };
  // Keep the open drawer fresh after an action on that client.
  useEffect(() => { if (detail?.id && !detail.loading && data) { const row = data.clients?.find((c) => c.id === detail.id); if (row) setDetail((d) => d ? { ...d, client: { ...d.client, plan: row.plan, plan_expires_at: row.plan_expires_at, trial_end: row.trial_end, suspended: row.suspended } } : d); } }, [data]); // eslint-disable-line

  if (session === undefined) return <><Theme /><Motion /><div style={{ minHeight: "100vh", background: T.bg }} /></>;
  if (!session) return <><Theme /><Motion />
    <OnboardFrame icon="ti-shield-lock" title={<>Autologic <span style={{ color: T.gold }}>Admin</span></>} sub={mode === "signup" ? "Create an admin account — the super admin approves it" : "Sign in to the platform console. This login is separate from any client dashboard."} width={420}>
      <Inp emb type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" />
      <PwInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" onEnter={auth} style={{ marginBottom: 14 }} />
      {authMsg && <div style={{ fontSize: 12.5, color: authMsg.includes("created") ? T.success : T.danger, marginBottom: 12, display: "flex", gap: 6 }}><i className={`ti ${authMsg.includes("created") ? "ti-check" : "ti-alert-circle"}`} />{authMsg}</div>}
      <Btn gold onClick={auth} disabled={authBusy || !email || !password} style={{ width: "100%", padding: "13px 20px", fontSize: 14.5, borderRadius: 14 }}>{authBusy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}</Btn>
      <div style={{ textAlign: "center", marginTop: 16, fontSize: 12.5, color: T.textMuted }}>
        {mode === "signup" ? "Already have an account? " : "New admin? "}
        <span onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setAuthMsg(""); }} style={{ color: T.gold, cursor: "pointer", fontWeight: 600 }}>{mode === "signup" ? "Sign in" : "Request access"}</span>
      </div>
    </OnboardFrame></>;
  if (!data) return <><Theme /><Motion /><div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: T.textMuted, fontSize: 13 }}><i className="ti ti-loader-2" style={{ fontSize: 20, color: T.gold }} />Loading the console…</div></>;
  if (data.role === "pending" || data.role === "blocked") {
    const blocked = data.role === "blocked";
    return <><Theme /><Motion />
      <OnboardFrame icon={blocked ? "ti-ban" : "ti-hourglass"} title={blocked ? "Access blocked" : "Awaiting approval"} width={440}
        sub={blocked ? "The super admin has blocked this account. Contact them if you think this is a mistake." : "Your account is registered. The super admin has been notified and will assign you a role."}>
        <div style={{ padding: "12px 14px", borderRadius: 14, background: T.bgAlt, boxShadow: T.nmIn, fontSize: 13, textAlign: "center", marginBottom: 16 }}><i className="ti ti-mail" style={{ marginRight: 7, color: T.gold }} />{data.email}</div>
        <div style={{ display: "flex", gap: 8 }}>
          {!blocked && <Btn gold onClick={() => load()} style={{ flex: 1, padding: "12px 18px", borderRadius: 14 }}>Check again</Btn>}
          <Btn onClick={logout} style={{ flex: 1, padding: "12px 18px", borderRadius: 14 }}>Log out</Btn>
        </div>
      </OnboardFrame></>;
  }
  return <AdminApp data={data} refreshing={refreshing} onRefresh={() => load()} busy={busy} err={err} clearErr={() => setErr("")}
    act={act} reviewPayment={reviewPayment} del={del} setRole={setRole} removeAdmin={removeAdmin} superKey={superKey} setSuperKey={setSuperKey}
    allowAiKey={allowAiKey} revokeAiKey={revokeAiKey} token={session?.access_token || ""}
    openDetail={openDetail} detail={detail} detailLoading={detailLoading} closeDetail={() => setDetail(null)} logout={logout} />;
}

// ── The console ──────────────────────────────────────────────────────────────
const NAV = [
  { group: "Console", items: [{ id: "overview", label: "Overview", icon: "ti-layout-dashboard" }, { id: "clients", label: "Clients", icon: "ti-users" }] },
  { group: "Money", items: [{ id: "payments", label: "Payments", icon: "ti-cash" }, { id: "packages", label: "Packages & Costs", icon: "ti-report-money" }] },
  { group: "Access", items: [{ id: "admins", label: "Admins", icon: "ti-shield-check", superOnly: true }] },
];

export function AdminApp(props) {
  const { data, refreshing, onRefresh, busy, err, clearErr, act, reviewPayment, del, setRole, removeAdmin, superKey, setSuperKey, allowAiKey, revokeAiKey, openDetail, detail, detailLoading, closeDetail, logout } = props;
  const isMobile = useIsMobile();
  const [mode, toggleTheme] = useTheme();
  const [page, setPage] = useState("overview");
  const [nav, setNav] = useState(false);
  const [q, setQ] = useState("");
  useEffect(() => { setNav(!isMobile); }, [isMobile]);
  const { overview: o, clients, role, admins, payments = [], attention = [], activity = [] } = data;
  const canEdit = ["super", "full", "editor"].includes(role), canDelete = ["super", "full"].includes(role), isSuper = role === "super";
  const pendingPay = payments.filter((p) => p.status === "pending").length;
  const go = (p) => { setPage(p); if (isMobile) setNav(false); };
  const searchHits = useMemo(() => { const s = q.trim().toLowerCase(); if (!s) return []; return clients.filter((c) => [c.business_name, c.owner_email, c.phone, c.id].join(" ").toLowerCase().includes(s)).slice(0, 6); }, [q, clients]);
  const titles = { overview: ["Overview", "How the platform is doing right now"], clients: ["Clients", `${clients.length} businesses on Autologic`], payments: ["Payments", pendingPay ? `${pendingPay} waiting for review` : "Nothing waiting for review"], packages: ["Packages & Costs", "What each package sells for, and what each client costs you"], admins: ["Admins", "Who can open this console"] };
  const badgeFor = { payments: pendingPay || undefined, overview: attention.filter((a) => a.level === "high").length || undefined };

  return <div style={{ display: "flex", height: isMobile ? "100dvh" : "100vh", overflow: "hidden", background: T.bg, color: T.text }}>
    <Theme /><Motion />
    {nav && isMobile && <div onClick={() => setNav(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 40 }} />}
    {/* Sidebar — the same floating slab as the customer dashboard, wearing an admin crest. */}
    <div style={{ position: "fixed", zIndex: 50, top: isMobile ? 10 : 14, bottom: isMobile ? 10 : 14, left: isMobile ? 10 : 14, width: isMobile ? "min(272px, calc(100vw - 20px))" : 248, background: T.rail, borderRadius: 24, boxShadow: nav ? T.nmOut : "none", display: "flex", flexDirection: "column",
      transform: nav ? "translateX(0)" : "translateX(calc(-100% - 60px))", visibility: nav ? "visible" : "hidden", transition: nav ? "transform .28s cubic-bezier(.22,.61,.36,1), visibility 0s" : "transform .28s cubic-bezier(.22,.61,.36,1), visibility 0s .28s" }}>
      <div style={{ padding: "20px 18px 14px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: T.accGrad, boxShadow: T.accGlow, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21 }}><i className="ti ti-shield-lock" /></div>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.01em" }}>Autologic Admin</div><div style={{ fontSize: 9.5, color: T.textDim, textTransform: "uppercase", letterSpacing: ".16em", marginTop: 2 }}>platform console</div></div>
        {isMobile && <button onClick={() => setNav(false)} aria-label="Close menu" style={{ background: "none", border: "none", color: T.textDim, cursor: "pointer", fontSize: 18 }}><i className="ti ti-x" /></button>}
      </div>
      <nav style={{ flex: 1, padding: "4px 12px", overflowY: "auto" }}>
        {NAV.map((g, gi) => { const items = g.items.filter((it) => !it.superOnly || isSuper); if (!items.length) return null; return <div key={g.group} style={{ marginBottom: 6, paddingTop: gi ? 10 : 0, borderTop: gi ? `1px solid ${T.border}` : "none" }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: T.textDim, padding: "0 12px", marginBottom: 6 }}>{g.group}</div>
          <Segmented vertical value={page} onChange={go} items={items.map((it) => ({ value: it.id, label: it.label, icon: it.icon, badge: badgeFor[it.id] }))} />
        </div>; })}
      </nav>
      <div style={{ padding: "12px 14px 16px", borderTop: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 6px", marginBottom: 6 }}>
          <div style={{ width: 34, height: 34, borderRadius: 11, background: `color-mix(in srgb, ${ROLE[role].color} 14%, transparent)`, color: ROLE[role].color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}><i className={`ti ${ROLE[role].icon}`} /></div>
          <div style={{ minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.email}</div><div style={{ fontSize: 11, color: ROLE[role].color, fontWeight: 600 }}>{ROLE[role].label}</div></div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={logout} className="ui-btn seg-item" style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, border: "none", background: "transparent", color: T.textMuted, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 500 }}><i className="ti ti-logout" style={{ fontSize: 16 }} />Log out</button>
          {isMobile && <ThemeToggle mode={mode} toggle={toggleTheme} style={{ width: 38, height: 38, borderRadius: 12 }} />}
        </div>
      </div>
    </div>

    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, marginLeft: (!isMobile && nav) ? 276 : 0, transition: "margin-left .28s cubic-bezier(.22,.61,.36,1)" }}>
      {/* Header bar: menu, title, global search, sync, theme, avatar. */}
      <div style={{ margin: isMobile ? "10px 10px 0" : "14px 18px 0", padding: isMobile ? "8px 10px" : "9px 12px", background: T.card, borderRadius: isMobile ? 16 : 20, boxShadow: T.nmSm, display: "flex", alignItems: "center", gap: isMobile ? 8 : 12, flexShrink: 0, position: "relative", zIndex: 30 }}>
        {!nav && <button onClick={() => setNav(true)} className="pbtn" aria-label="Menu" style={isMobile ? { width: 36, height: 36, borderRadius: 11 } : undefined}><i className="ti ti-menu-2" /></button>}
        <div style={{ minWidth: 0, flex: "0 1 auto" }}>
          <div style={{ fontSize: isMobile ? 15.5 : 17.5, fontWeight: 700, letterSpacing: "-.02em", whiteSpace: "nowrap" }}>{titles[page][0]}</div>
          {!isMobile && <div style={{ fontSize: 11.5, color: T.textDim, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{titles[page][1]}</div>}
        </div>
        {!isMobile && <div style={{ position: "relative", flex: 1, maxWidth: 420, marginLeft: 8 }}>
          <i className="ti ti-search" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textDim, fontSize: 15 }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a client — name, email, phone" className="ui-inp"
            style={{ width: "100%", background: T.bgAlt, boxShadow: T.nmIn, border: `1px solid ${T.border}`, borderRadius: 12, padding: "9px 12px 9px 34px", color: T.text, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
          {searchHits.length > 0 && <div className="ui-menu" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 5, boxShadow: T.nmOut, zIndex: 60 }}>
            {searchHits.map((c) => <button key={c.id} className="ui-opt" onClick={() => { setQ(""); openDetail(c.id); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 10px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: T.text }}>
              <Avatar c={c} size={28} /><span style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.business_name || "—"}</span><span style={{ display: "block", fontSize: 11, color: T.textDim }}>{c.owner_email}</span></span><PlanPill c={c} />
            </button>)}
          </div>}
        </div>}
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 7 : 10, marginLeft: "auto", flexShrink: 0 }}>
          {!isMobile && <span style={{ fontSize: 11, color: T.textDim, display: "inline-flex", alignItems: "center", gap: 6 }}><span className="ui-live" style={{ width: 8, height: 8, borderRadius: "50%", background: T.live, display: "inline-block" }} />synced {ago(data.server_time)}</span>}
          <button onClick={onRefresh} disabled={refreshing} className={`pbtn${refreshing ? " is-busy" : ""}`} title="Refresh" aria-label="Refresh" style={isMobile ? { width: 36, height: 36, borderRadius: 11 } : undefined}><i className="ti ti-refresh" /></button>
          {!isMobile && <ThemeToggle mode={mode} toggle={toggleTheme} />}
          <div title={ROLE[role].label} style={{ width: isMobile ? 36 : 42, height: isMobile ? 36 : 42, borderRadius: "50%", background: T.accGrad, boxShadow: T.accGlow, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isMobile ? 13 : 15, fontWeight: 700 }}>{initialsOf(data.email.split("@")[0].replace(/[._-]/g, " "))}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: isMobile ? "12px 10px" : 20, minHeight: 0 }}>
        {err && <Card style={{ marginBottom: 14, padding: "10px 14px", borderColor: `color-mix(in srgb, ${T.danger} 40%, transparent)`, display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}><i className="ti ti-alert-circle" style={{ color: T.danger, fontSize: 18 }} /><span style={{ flex: 1 }}>{err}</span><button onClick={clearErr} style={{ background: "none", border: "none", color: T.textDim, cursor: "pointer" }}><i className="ti ti-x" /></button></Card>}
        <div key={page} className="ui-page">
          {page === "overview" && <Overview o={o} clients={clients} attention={attention} activity={activity} openDetail={openDetail} go={go} isMobile={isMobile} />}
          {page === "clients" && <Clients clients={clients} openDetail={openDetail} isMobile={isMobile} />}
          {page === "payments" && <Payments payments={payments} canEdit={canEdit} busy={busy} review={reviewPayment} openDetail={openDetail} isMobile={isMobile} />}
          {page === "packages" && <Packages token={props.token} isSuper={isSuper} />}
          {page === "admins" && isSuper && <Admins admins={admins || []} superKey={superKey} setSuperKey={setSuperKey} setRole={setRole} removeAdmin={removeAdmin} busy={busy} />}
        </div>
      </div>
    </div>

    {detail && <ClientDrawer detail={detail} loading={detailLoading} onClose={closeDetail} canEdit={canEdit} canDelete={canDelete} busy={busy} act={act} del={del} isMobile={isMobile} row={clients.find((c) => c.id === detail.id)}
      isSuper={isSuper} superKey={superKey} setSuperKey={setSuperKey} allowAiKey={allowAiKey} revokeAiKey={revokeAiKey} />}
  </div>;
}

// ── Overview ─────────────────────────────────────────────────────────────────
function Overview({ o, clients, attention, activity, openDetail, go, isMobile }) {
  const s = (k) => (o.series?.[k] || []).map((d) => ({ v: d.value }));
  const lbl = (k) => { const arr = o.series?.[k] || []; return arr.length ? [shortDate(arr[0].day), "today"] : []; };
  const top = [...clients].sort((a, b) => b.messages_7d - a.messages_7d).slice(0, 6);
  const planItems = ["trial", "starter", "pro", "agency", "none"].map((p) => ({ name: planName(p), count: o.plan_mix?.[p] || 0 })).filter((x) => x.count);
  const platItems = Object.entries(o.platform_mix || {}).map(([k, v]) => ({ name: (PLAT[k] || PLAT.unknown).label, count: v })).sort((a, b) => b.count - a.count);
  const msgPlat = Object.entries(o.message_platform_30d || {}).map(([k, v]) => ({ name: (PLAT[k] || PLAT.unknown).label, count: v })).sort((a, b) => b.count - a.count);
  const two = { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 };
  const three = { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0,1fr))", gap: 14 };
  const high = attention.filter((a) => a.level === "high").length;
  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
      <KStat icon="ti-users" label="Clients" value={fmtNum(o.total_clients)} trend={pct(o.new_clients_7d, o.new_clients_prev7)} sub={`${o.new_clients_7d} new this week · ${o.paid_clients} paying`} />
      <KStat icon="ti-coin-taka" label="MRR" value={taka(o.mrr)} color={T.success} sub={`${o.starter} starter · ${o.pro} pro · ${o.agency} agency`} />
      <KStat icon="ti-cash" label="Revenue 30d" value={taka(o.revenue_30d)} color={T.success} trend={pct(o.revenue_30d, o.revenue_prev30)} sub="approved payments" />
      <KStat icon="ti-messages" label="Messages 7d" value={fmtNum(o.messages_7d)} trend={pct(o.messages_7d, o.messages_prev7)} sub={`${fmtNum(o.messages_today)} today · ${fmtNum(o.customer_messages_7d)} from customers`} />
      <KStat icon="ti-shopping-bag" label="Orders 7d" value={fmtNum(o.orders_7d)} color={T.gold} trend={pct(o.orders_7d, o.orders_prev7)} sub={`${fmtNum(o.total_orders)} all time`} />
      <KStat icon="ti-calendar-event" label="Bookings 7d" value={fmtNum(o.bookings_7d)} color={T.purple} trend={pct(o.bookings_7d, o.bookings_prev7)} sub={`${fmtNum(o.total_bookings)} all time`} />
      <KStat icon="ti-plug-connected" label="Live channels" value={o.connected_channels} color={T.live} sub={Object.entries(o.platform_mix || {}).map(([k, v]) => `${v} ${(PLAT[k] || PLAT.unknown).label}`).join(" · ") || "none yet"} />
      <KStat icon="ti-alert-triangle" label="Attention" value={attention.length} color={high ? T.danger : T.warn} sub={high ? `${high} urgent` : "nothing urgent"} />
    </div>

    <div style={two}>
      <Card><SectionTitle icon="ti-chart-line" right={<span style={{ fontSize: 11.5, color: T.textDim }}>last 14 days</span>}>Messages</SectionTitle><Spark data={s("messages")} keys={["v"]} colors={[T.gold]} labels={lbl("messages")} height={110} /></Card>
      <Card><SectionTitle icon="ti-user-plus" right={<span style={{ fontSize: 11.5, color: T.textDim }}>last 14 days</span>}>Signups</SectionTitle><Spark data={s("signups")} keys={["v"]} colors={[T.success]} labels={lbl("signups")} height={110} /></Card>
    </div>

    <div style={two}>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 18px 6px" }}><SectionTitle icon="ti-alert-triangle" right={attention.length ? <Badge color={high ? T.danger : T.warn}>{attention.length}</Badge> : null}>Needs attention</SectionTitle></div>
        <div style={{ maxHeight: 360, overflowY: "auto", padding: "0 10px 10px" }}>
          {attention.length === 0 ? <Empty icon="ti-mood-smile" text="All quiet — nothing needs a human right now." /> : attention.slice(0, 30).map((a, i) => { const k = KIND[a.kind] || KIND.quiet; const lv = a.level === "high" ? T.danger : a.level === "mid" ? T.warn : T.textDim; return <button key={i} onClick={() => a.client_id && openDetail(a.client_id)} className="ui-btn ui-row" style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "9px 10px", borderRadius: 12, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: T.text, minHeight: 0 }}>
            <span style={{ width: 32, height: 32, borderRadius: 10, background: `color-mix(in srgb, ${k.color} 12%, transparent)`, color: k.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}><i className={`ti ${k.icon}`} /></span>
            <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</span><span style={{ display: "block", fontSize: 11.5, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.sub}</span></span>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: lv, flexShrink: 0 }} />
          </button>; })}
        </div>
      </Card>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 18px 6px" }}><SectionTitle icon="ti-activity">Activity</SectionTitle></div>
        <div style={{ maxHeight: 360, overflowY: "auto", padding: "0 18px 14px" }}>
          {activity.length === 0 ? <Empty icon="ti-activity" text="No activity yet." /> : activity.map((a, i) => { const k = KIND[a.kind] || KIND.quiet; return <div key={i} style={{ display: "flex", gap: 11, padding: "8px 0", borderTop: i ? `1px solid ${T.border}` : "none", cursor: a.client_id ? "pointer" : "default" }} onClick={() => a.client_id && openDetail(a.client_id)}>
            <span style={{ width: 28, height: 28, borderRadius: 9, background: `color-mix(in srgb, ${k.color} 12%, transparent)`, color: k.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, marginTop: 1 }}><i className={`ti ${k.icon}`} /></span>
            <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block", fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</span><span style={{ display: "block", fontSize: 11.5, color: T.textMuted }}>{a.sub}</span></span>
            <span style={{ fontSize: 11, color: T.textDim, flexShrink: 0, whiteSpace: "nowrap" }}>{ago(a.at)}</span>
          </div>; })}
        </div>
      </Card>
    </div>

    <div style={three}>
      <Card><SectionTitle icon="ti-chart-pie">Plan mix</SectionTitle><BarList items={planItems} color={T.gold} empty="No clients yet." /></Card>
      <Card><SectionTitle icon="ti-plug-connected">Connected channels</SectionTitle><BarList items={platItems} color={T.live} empty="No channels connected yet." /></Card>
      <Card><SectionTitle icon="ti-message-2">Messages by channel · 30d</SectionTitle><BarList items={msgPlat} color={T.purple} empty="No messages in the last 30 days." /></Card>
    </div>

    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "16px 18px 4px" }}><SectionTitle icon="ti-flame" right={<button onClick={() => go("clients")} style={{ background: "none", border: "none", color: T.gold, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>All clients →</button>}>Most active this week</SectionTitle></div>
      <ClientTable rows={top} openDetail={openDetail} isMobile={isMobile} compact />
    </Card>
  </div>;
}

// ── Clients ──────────────────────────────────────────────────────────────────
function ClientTable({ rows, openDetail, isMobile, compact }) {
  if (!rows.length) return <Empty icon="ti-users" text="No clients match." />;
  if (isMobile) return <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: compact ? "0 10px 10px" : 0 }}>
    {rows.map((c) => <button key={c.id} onClick={() => openDetail(c.id)} className="ui-btn ob-row" style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 12px", borderRadius: 16, background: T.card, boxShadow: T.nmSm, border: `1px solid ${T.border}`, cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: T.text, width: "100%" }}>
      <Avatar c={c} size={40} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}><span style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.business_name || "—"}</span>{c.suspended && <i className="ti ti-player-pause" style={{ color: T.danger, fontSize: 13 }} />}</span>
        <span style={{ display: "block", fontSize: 11.5, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.owner_email}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5, flexWrap: "wrap" }}><PlanPill c={c} /><ChannelDots channels={c.channels} /><span style={{ fontSize: 11, color: T.textDim }}>{fmtNum(c.messages_7d)} msgs · 7d</span></span>
      </span>
      <i className="ti ti-chevron-right" style={{ color: T.textDim }} />
    </button>)}
  </div>;
  const th = { padding: "10px 14px", textAlign: "left", color: T.textMuted, fontWeight: 600, fontSize: 10.5, textTransform: "uppercase", letterSpacing: .8, whiteSpace: "nowrap" };
  const td = { padding: "10px 14px", fontSize: 13, verticalAlign: "middle" };
  return <div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse" }}>
    <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>{["Business", "Plan", "Channels", "Msgs 7d", compact ? "Today" : "Orders / Bookings", "Last active", ""].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((c) => { const t = pct(c.messages_7d, c.messages_prev7); return <tr key={c.id} className="ui-row" onClick={() => openDetail(c.id)} style={{ borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}>
      <td style={td}><div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}><Avatar c={c} size={36} /><div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>{c.business_name || "—"}<Badge color={c.business_type === "agency" ? T.purple : T.gold}>{c.business_type === "agency" ? "Agency" : "Shop"}</Badge>{c.suspended && <Badge color={T.danger}>Suspended</Badge>}{c.pending_payment && <Badge color={T.warn}>Payment</Badge>}</div><div style={{ fontSize: 11.5, color: T.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>{c.owner_email}</div></div></div></td>
      <td style={td}><PlanPill c={c} /></td>
      <td style={td}><ChannelDots channels={c.channels} /></td>
      <td style={{ ...td, fontWeight: 600 }}>{fmtNum(c.messages_7d)} {t !== null && t !== 0 && <span style={{ fontSize: 11, color: t > 0 ? T.success : T.danger, marginLeft: 4 }}>{t > 0 ? "↑" : "↓"}{Math.abs(t)}%</span>}</td>
      <td style={{ ...td, color: T.textMuted }}>{compact ? fmtNum(c.messages_today) : (c.business_type === "agency" ? `${c.bookings} bookings · ${c.kb_files} files` : `${c.orders} orders · ${c.products} products`)}</td>
      <td style={{ ...td, color: T.textMuted, whiteSpace: "nowrap" }}>{ago(c.last_active)}</td>
      <td style={{ ...td, textAlign: "right" }}><i className="ti ti-chevron-right" style={{ color: T.textDim }} /></td>
    </tr>; })}</tbody>
  </table></div>;
}

function Clients({ clients, openDetail, isMobile }) {
  const [q, setQ] = useState(""); const [plan, setPlan] = useState("all"); const [type, setType] = useState("all"); const [sort, setSort] = useState("active");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    let l = clients.filter((c) => (plan === "all" || (plan === "paid" ? ["starter", "pro", "agency"].includes(c.plan) : plan === "issues" ? (c.suspended || c.pending_payment || (c.trial_days_left !== null && c.trial_days_left <= 2) || (c.plan_days_left !== null && c.plan_days_left <= 7)) : c.plan === plan)) && (type === "all" || (c.business_type || "ecommerce") === type) && (!s || [c.business_name, c.owner_email, c.phone].join(" ").toLowerCase().includes(s)));
    const by = { active: (a, b) => b.messages_7d - a.messages_7d, newest: (a, b) => new Date(b.created_at) - new Date(a.created_at), name: (a, b) => (a.business_name || "").localeCompare(b.business_name || ""), messages: (a, b) => b.messages - a.messages, recent: (a, b) => new Date(b.last_active || 0) - new Date(a.last_active || 0) };
    return [...l].sort(by[sort] || by.active);
  }, [clients, q, plan, type, sort]);
  const counts = { all: clients.length, trial: clients.filter((c) => c.plan === "trial").length, paid: clients.filter((c) => ["starter", "pro", "agency"].includes(c.plan)).length, issues: clients.filter((c) => c.suspended || c.pending_payment || (c.trial_days_left !== null && c.trial_days_left <= 2) || (c.plan_days_left !== null && c.plan_days_left <= 7)).length };
  return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <Card style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <div style={{ position: "relative", flex: "1 1 200px", minWidth: 0 }}>
        <i className="ti ti-search" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textDim, fontSize: 16 }} />
        <input placeholder="Search business, email, phone" value={q} onChange={(e) => setQ(e.target.value)} className="ui-inp" style={{ width: "100%", background: T.bgAlt, boxShadow: T.nmIn, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 12px 10px 36px", color: T.text, fontSize: 13.5, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
      </div>
      <Segmented size="sm" value={plan} onChange={setPlan} items={[{ value: "all", label: "All", badge: counts.all }, { value: "trial", label: "Trial", badge: counts.trial || undefined }, { value: "paid", label: "Paying", badge: counts.paid || undefined }, { value: "issues", label: "Issues", badge: counts.issues || undefined }]} />
      <Select value={type} onChange={setType} options={[{ value: "all", label: "All types", icon: "ti-building" }, { value: "ecommerce", label: "E-commerce", icon: "ti-shopping-bag" }, { value: "agency", label: "Agency", icon: "ti-briefcase" }]} />
      <Select value={sort} onChange={setSort} options={[{ value: "active", label: "Most active (7d)", icon: "ti-flame" }, { value: "recent", label: "Recently active", icon: "ti-clock" }, { value: "newest", label: "Newest", icon: "ti-user-plus" }, { value: "messages", label: "Most messages", icon: "ti-messages" }, { value: "name", label: "Name A–Z", icon: "ti-sort-ascending-letters" }]} />
    </Card>
    <div style={{ fontSize: 12.5, color: T.textMuted }}>{list.length} of {clients.length} clients</div>
    {isMobile ? <ClientTable rows={list} openDetail={openDetail} isMobile /> : <Card style={{ padding: 0, overflow: "hidden" }}><ClientTable rows={list} openDetail={openDetail} /></Card>}
  </div>;
}

// ── Client drawer ────────────────────────────────────────────────────────────
function ClientDrawer({ detail, loading, onClose, canEdit, canDelete, busy, act, del, isMobile, row, isSuper, superKey, setSuperKey, allowAiKey, revokeAiKey }) {
  const [tab, setTab] = useState("overview");
  const [confirmDel, setConfirmDel] = useState("");
  useEffect(() => { const k = (e) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", k); document.body.style.overflow = "hidden"; return () => { document.removeEventListener("keydown", k); document.body.style.overflow = ""; }; }, []);
  const c = detail.client, r = row || {};
  const isAgency = c?.business_type === "agency";
  const tabs = [{ value: "overview", label: "Overview", icon: "ti-id" }, { value: "channels", label: "Channels", icon: "ti-plug", badge: detail.channels?.length || undefined }, isAgency ? { value: "knowledge", label: "Knowledge", icon: "ti-database", badge: detail.files?.length || undefined } : { value: "catalogue", label: "Catalogue", icon: "ti-package", badge: detail.products?.length || undefined }, isAgency ? { value: "bookings", label: "Bookings", icon: "ti-calendar-event", badge: detail.bookings?.length || undefined } : { value: "orders", label: "Orders", icon: "ti-shopping-bag", badge: detail.orders?.length || undefined }, { value: "payments", label: "Payments", icon: "ti-cash", badge: detail.payments?.length || undefined },
    ...(isSuper ? [{ value: "ai", label: "AI key", icon: "ti-key" }] : [])];
  const Row = ({ k, v }) => <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}><span style={{ color: T.textMuted }}>{k}</span><span style={{ textAlign: "right", wordBreak: "break-word", fontWeight: 500 }}>{v || "—"}</span></div>;
  const Mini = ({ icon, label, value, color = T.gold }) => <div style={{ padding: "12px 12px", borderRadius: 14, background: T.bgAlt, boxShadow: T.nmIn }}><div style={{ fontSize: 10.5, color: T.textMuted, textTransform: "uppercase", letterSpacing: .7, display: "flex", alignItems: "center", gap: 6 }}><i className={`ti ${icon}`} style={{ color }} />{label}</div><div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{value}</div></div>;
  const m = detail.messages || {};
  return <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(17,19,24,.45)", backdropFilter: "blur(3px)", display: "flex", justifyContent: "flex-end" }}>
    <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{ width: isMobile ? "100%" : "min(680px, 100%)", height: "100%", background: T.bg, display: "flex", flexDirection: "column", boxShadow: "-12px 0 40px rgba(0,0,0,.25)", animation: "adm-slide .28s cubic-bezier(.16,1,.3,1) both" }}>
      {loading || detail.loading || !c ? <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: T.textMuted, fontSize: 13 }}><i className="ti ti-loader-2" style={{ fontSize: 20, color: T.gold }} />Loading client…<button onClick={onClose} className="pbtn" style={{ position: "absolute", top: 14, right: 14, width: 36, height: 36, borderRadius: 11 }}><i className="ti ti-x" /></button></div> : <>
        <div style={{ padding: isMobile ? "12px 14px" : "16px 22px", display: "flex", alignItems: "center", gap: 12, background: T.card, boxShadow: T.nmSm, flexShrink: 0, position: "relative", zIndex: 1 }}>
          <Avatar c={c} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: "-.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.business_name || "—"}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}><Badge color={isAgency ? T.purple : T.gold}>{isAgency ? "Agency" : "E-commerce"}</Badge><PlanPill c={{ ...c, trial_days_left: r.trial_days_left, plan_days_left: r.plan_days_left }} />{c.suspended && <Badge color={T.danger}>Suspended</Badge>}{c.gcal_connected && <Badge color={T.success}>Calendar</Badge>}<span style={{ fontSize: 11.5, color: T.textDim }}>· joined {shortDate(c.created_at)}</span></div>
          </div>
          <button onClick={onClose} className="pbtn" aria-label="Close" style={{ width: 36, height: 36, borderRadius: 11 }}><i className="ti ti-x" style={{ fontSize: 17 }} /></button>
        </div>
        <div style={{ padding: isMobile ? "10px 12px 0" : "12px 22px 0", flexShrink: 0, overflowX: isMobile ? "auto" : "visible", scrollbarWidth: "none" }}><Segmented size="sm" value={tab} onChange={setTab} items={tabs} style={{ background: T.card, boxShadow: T.nmSm, borderRadius: 13, padding: 4, flexWrap: isMobile ? "nowrap" : "wrap", width: isMobile ? "max-content" : "auto" }} /></div>
        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "14px 12px 24px" : "18px 22px 30px", minHeight: 0 }}>
          {tab === "overview" && <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 14 }}>
              <Mini icon="ti-messages" label="Messages 7d" value={fmtNum(m.week || 0)} /><Mini icon="ti-sun" label="Today" value={fmtNum(m.today || 0)} /><Mini icon="ti-users" label="Contacts" value={fmtNum(detail.contacts || 0)} color={T.purple} />
              {isAgency ? <Mini icon="ti-calendar-event" label="Bookings" value={detail.bookings?.length || 0} color={T.purple} /> : <Mini icon="ti-shopping-bag" label="Orders" value={detail.orders?.length || 0} color={T.success} />}
            </div>
            <Card style={{ marginBottom: 14 }}><SectionTitle icon="ti-chart-line" right={<span style={{ fontSize: 11.5, color: T.textDim }}>14 days · last message {ago(m.last_at)}</span>}>Messages</SectionTitle><Spark data={(m.series || []).map((d) => ({ v: d.value }))} keys={["v"]} colors={[T.gold]} labels={m.series?.length ? [shortDate(m.series[0].day), "today"] : []} height={90} />
              <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 12, color: T.textMuted, flexWrap: "wrap" }}><span><b style={{ color: T.text }}>{fmtNum(m.customer || 0)}</b> from customers</span><span><b style={{ color: T.text }}>{fmtNum(m.bot || 0)}</b> from bot</span><span><b style={{ color: T.text }}>{fmtNum(m.agent || 0)}</b> from agent</span>{Object.entries(m.by_platform || {}).map(([k, v]) => <span key={k}><b style={{ color: T.text }}>{fmtNum(v)}</b> {(PLAT[k] || PLAT.unknown).label}</span>)}</div></Card>
            <Card style={{ marginBottom: 14 }}><SectionTitle icon="ti-building-store">Business</SectionTitle>
              <Row k="Owner email" v={c.owner_email} /><Row k="Phone" v={c.phone} /><Row k="Address" v={c.address} /><Row k="Website" v={c.website} /><Row k="Bot name" v={detail.settings?.botName} /><Row k="Bot trained" v={detail.settings?.hasPrompt ? "Yes — business profile saved" : "No — bot uses defaults"} />
              {c.gcal_connected && <Row k="Calendar" v={c.gcal_email} />}<Row k="Trial" v={c.trial_end ? `${shortDate(c.trial_start)} → ${shortDate(c.trial_end)}` : "—"} /><Row k="Plan expires" v={c.plan_expires_at ? shortDate(c.plan_expires_at) : "—"} /><Row k="Client ID" v={<span style={{ fontFamily: "monospace", fontSize: 11.5 }}>{c.id}</span>} />
            </Card>
            {canEdit && <Card><SectionTitle icon="ti-adjustments">Manage</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, alignItems: "end" }}>
                <div><label style={{ display: "block", fontSize: 11.5, color: T.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Plan</label>
                  <Select wide value={c.plan} onChange={(v) => v !== c.plan && act(c.id, "plan", v)} options={["trial", "starter", "pro", "agency"].map((p) => ({ value: p, label: planName(p), icon: p === "trial" ? "ti-hourglass" : "ti-crown" }))} /></div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {c.plan === "trial" ? <><Btn small onClick={() => act(c.id, "extend_trial", 7)} disabled={busy === c.id + "extend_trial"}>+7d trial</Btn><Btn small onClick={() => act(c.id, "extend_trial", 30)} disabled={busy === c.id + "extend_trial"}>+30d trial</Btn></>
                    : <><Btn small onClick={() => act(c.id, "extend_plan", 30)} disabled={busy === c.id + "extend_plan"}>+30 days</Btn><Btn small onClick={() => act(c.id, "extend_plan", 365)} disabled={busy === c.id + "extend_plan"}>+1 year</Btn></>}
                  <Btn small onClick={() => act(c.id, "suspend", !c.suspended)} disabled={busy === c.id + "suspend"} style={{ color: c.suspended ? T.success : T.warn, background: `color-mix(in srgb, ${c.suspended ? T.success : T.warn} 10%, transparent)` }}><i className={`ti ${c.suspended ? "ti-player-play" : "ti-player-pause"}`} style={{ marginRight: 5 }} />{c.suspended ? "Resume" : "Suspend"}</Btn>
                </div>
              </div>
              {canDelete && <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 12.5, color: T.textMuted, marginBottom: 8 }}>Danger zone — deleting removes this business and all of its data. Type <b>DELETE</b> to enable.</div>
                <div style={{ display: "flex", gap: 8 }}><Inp emb value={confirmDel} onChange={(e) => setConfirmDel(e.target.value)} placeholder="DELETE" style={{ flex: 1, marginBottom: 0 }} inputStyle={{ padding: "10px 14px" }} /><Btn danger disabled={confirmDel !== "DELETE" || busy === c.id + "del"} onClick={async () => { const ok = await del(c); if (ok) onClose(); }} style={{ borderRadius: 14 }}><i className="ti ti-trash" style={{ marginRight: 5 }} />Delete</Btn></div>
              </div>}
            </Card>}
          </>}
          {tab === "channels" && <Card>{detail.channels?.length ? detail.channels.map((ch, i) => { const p = PLAT[ch.platform] || PLAT.unknown; return <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i ? `1px solid ${T.border}` : "none" }}><span style={{ width: 38, height: 38, borderRadius: 12, background: `${p.color}1f`, color: p.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 19 }}><i className={`ti ${p.icon}`} /></span><span style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>{p.label}</span><span style={{ display: "block", fontSize: 11.5, color: T.textDim, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis" }}>{ch.page_id || "—"}</span></span><Badge color={ch.status === "connected" ? T.success : T.textDim}>{ch.status}</Badge><span style={{ fontSize: 11.5, color: T.textDim, whiteSpace: "nowrap" }}>{shortDate(ch.connected_at)}</span></div>; }) : <Empty icon="ti-plug-x" text="No channels connected." />}</Card>}
          {tab === "catalogue" && <Card>{detail.products?.length ? detail.products.map((p, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: i ? `1px solid ${T.border}` : "none", fontSize: 13 }}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span><span style={{ color: T.textMuted, flexShrink: 0 }}>{p.price ? taka(p.price) : ""}{p.code ? ` · ${p.code}` : ""}</span></div>) : <Empty icon="ti-package" text="No products yet." />}</Card>}
          {tab === "knowledge" && <Card>{detail.files?.length ? detail.files.map((f, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: i ? `1px solid ${T.border}` : "none", fontSize: 13 }}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><i className="ti ti-file-text" style={{ marginRight: 6, color: T.gold }} />{f.file_name}</span><span style={{ color: T.textMuted, flexShrink: 0, fontSize: 12 }}>{f.chunks} chunks · {shortDate(f.created_at)}</span></div>) : <Empty icon="ti-database" text="No documents uploaded." />}</Card>}
          {tab === "orders" && <Card>{detail.orders?.length ? detail.orders.map((o, i) => <div key={i} style={{ padding: "9px 0", borderTop: i ? `1px solid ${T.border}` : "none", fontSize: 13 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span style={{ fontWeight: 600 }}>{o.customer_name || "—"} <span style={{ color: T.textDim, fontWeight: 400, fontFamily: "monospace", fontSize: 11.5 }}>#{o.order_code}</span></span><Badge color={o.status === "Pending" ? T.warn : T.success}>{o.status}</Badge></div><div style={{ color: T.textMuted, fontSize: 12, marginTop: 2 }}>{o.total_price ? `${taka(o.total_price)} · ` : ""}{shortDate(o.created_at)}</div></div>) : <Empty icon="ti-shopping-bag" text="No orders yet." />}</Card>}
          {tab === "bookings" && <Card>{detail.bookings?.length ? detail.bookings.map((b, i) => <div key={i} style={{ padding: "9px 0", borderTop: i ? `1px solid ${T.border}` : "none", fontSize: 13 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span style={{ fontWeight: 600 }}>{b.customer_name || "—"}</span><Badge color={b.status === "Confirmed" ? T.success : T.textDim}>{b.status}</Badge></div><div style={{ color: T.textMuted, fontSize: 12, marginTop: 2 }}>{b.service_want} · {b.meeting_date} {b.meeting_time}</div></div>) : <Empty icon="ti-calendar-event" text="No bookings yet." />}</Card>}
          {tab === "ai" && isSuper && <AITab ai={detail.ai || null} clientId={c.id} superKey={superKey} setSuperKey={setSuperKey} allow={allowAiKey} revoke={revokeAiKey} busy={busy === c.id + "aikey"} />}
          {tab === "payments" && <Card>{detail.payments?.length ? detail.payments.map((p, i) => <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "9px 0", borderTop: i ? `1px solid ${T.border}` : "none", fontSize: 13, flexWrap: "wrap" }}><span><b>{taka(p.amount)}</b> <span style={{ color: T.textMuted }}>· {planName(p.plan)} · {p.billing_cycle} · {p.method}</span><div style={{ fontSize: 11.5, color: T.textDim, fontFamily: "monospace" }}>{p.txn_id}</div></span><span style={{ textAlign: "right" }}><Badge color={p.status === "approved" ? T.success : p.status === "rejected" ? T.danger : T.warn}>{p.status}</Badge><div style={{ fontSize: 11.5, color: T.textDim, marginTop: 3 }}>{shortDate(p.created_at)}{p.reviewed_by ? ` · by ${p.reviewed_by}` : ""}</div></span></div>) : <Empty icon="ti-cash" text="No payment requests." />}</Card>}
        </div>
      </>}
    </div>
    <style dangerouslySetInnerHTML={{ __html: `@keyframes adm-slide { from { transform: translateX(40px); opacity: 0 } to { transform: none; opacity: 1 } }` }} />
  </div>;
}

// ── Payments ─────────────────────────────────────────────────────────────────
function Payments({ payments, canEdit, busy, review, openDetail, isMobile }) {
  const [confirm, setConfirm] = useState(null); // {id, decision, note}
  const [filter, setFilter] = useState("all");
  const pending = payments.filter((p) => p.status === "pending");
  const history = payments.filter((p) => p.status !== "pending").filter((p) => filter === "all" || p.status === filter);
  const total30 = payments.filter((p) => p.status === "approved" && Date.now() - new Date(p.reviewed_at || p.created_at).getTime() < 30 * 86400000).reduce((n, p) => n + Number(p.amount || 0), 0);
  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
      <KStat icon="ti-clock" label="Waiting" value={pending.length} color={pending.length ? T.warn : T.textDim} sub={pending.length ? taka(pending.reduce((n, p) => n + Number(p.amount || 0), 0)) + " to verify" : "nothing to verify"} />
      <KStat icon="ti-check" label="Approved 30d" value={taka(total30)} color={T.success} sub={`${payments.filter((p) => p.status === "approved").length} approved all time`} />
      <KStat icon="ti-x" label="Rejected" value={payments.filter((p) => p.status === "rejected").length} color={T.danger} sub="all time" />
    </div>
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "16px 18px 6px" }}><SectionTitle icon="ti-cash" right={<span style={{ fontSize: 11.5, color: T.textDim }}>check the transaction in bKash / Nagad first</span>}>Waiting for review</SectionTitle></div>
      <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {pending.length === 0 ? <Empty icon="ti-mood-smile" text="No payments waiting." /> : pending.map((p) => { const mine = confirm?.id === p.id; return <div key={p.id} style={{ padding: "14px 16px", borderRadius: 16, background: T.bgAlt, boxShadow: T.nmIn }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
            <div style={{ minWidth: 200, flex: "1 1 240px" }}><div style={{ fontSize: 14.5, fontWeight: 700, cursor: "pointer" }} onClick={() => openDetail(p.client_id)}>{p.business_name} <i className="ti ti-external-link" style={{ fontSize: 12, color: T.textDim }} /></div><div style={{ fontSize: 12.5, color: T.textMuted, marginTop: 2 }}>{p.owner_email}</div><div style={{ fontSize: 12, color: T.textDim, marginTop: 6 }}>{new Date(p.created_at).toLocaleString("en-GB")} · {ago(p.created_at)}</div></div>
            <div style={{ minWidth: 200 }}><div style={{ fontSize: 22, fontWeight: 700, color: T.gold, letterSpacing: "-.02em" }}>{taka(p.amount)}</div><div style={{ fontSize: 12.5, color: T.textMuted, marginTop: 2 }}><Badge color={planColor(p.plan)}>{planName(p.plan)}</Badge> <span style={{ marginLeft: 6 }}>{p.billing_cycle} · {p.method}</span></div><div style={{ fontSize: 12.5, marginTop: 6 }}><span style={{ color: T.textMuted }}>Txn </span><span style={{ fontFamily: "monospace", fontWeight: 600 }}>{p.txn_id}</span></div>{p.sender_number && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>From {p.sender_number}</div>}</div>
          </div>
          {canEdit && (!mine ? <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <Btn small onClick={() => setConfirm({ id: p.id, decision: "approve", note: "" })} style={{ background: T.success, color: "#fff" }}><i className="ti ti-check" style={{ marginRight: 5 }} />Approve & activate</Btn>
            <Btn small onClick={() => setConfirm({ id: p.id, decision: "reject", note: "" })} style={{ background: T.dangerBg, color: T.danger }}><i className="ti ti-x" style={{ marginRight: 5 }} />Reject</Btn>
          </div> : <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12, background: T.card, boxShadow: T.nmSm }}>
            {confirm.decision === "approve" ? <div style={{ fontSize: 13, marginBottom: 10 }}>Confirm you received <b>{taka(p.amount)}</b> via <b>{p.method}</b> (txn <span style={{ fontFamily: "monospace" }}>{p.txn_id}</span>). This activates <b>{planName(p.plan)}</b> for {p.billing_cycle === "yearly" ? "365" : "30"} days and emails the owner.</div>
              : <><div style={{ fontSize: 13, marginBottom: 8 }}>Reason shown to the owner:</div><Inp emb textarea value={confirm.note} onChange={(e) => setConfirm({ ...confirm, note: e.target.value })} placeholder="e.g. We could not find this transaction ID. Please check and send again." inputStyle={{ minHeight: 70 }} style={{ marginBottom: 10 }} /></>}
            <div style={{ display: "flex", gap: 8 }}>
              <Btn small gold={confirm.decision === "approve"} danger={confirm.decision === "reject"} disabled={busy === p.id + confirm.decision || (confirm.decision === "reject" && !confirm.note.trim())} onClick={async () => { await review(p, confirm.decision, confirm.note); setConfirm(null); }}>{busy === p.id + confirm.decision ? "Working…" : confirm.decision === "approve" ? "Yes, activate plan" : "Reject payment"}</Btn>
              <Btn small onClick={() => setConfirm(null)}>Cancel</Btn>
            </div>
          </div>)}
        </div>; })}
      </div>
    </Card>
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "16px 18px 6px" }}><SectionTitle icon="ti-history" right={<Segmented size="sm" value={filter} onChange={setFilter} items={[{ value: "all", label: "All" }, { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" }]} />}>History</SectionTitle></div>
      {history.length === 0 ? <Empty icon="ti-history" text="Nothing reviewed yet." /> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: isMobile ? 560 : 700, borderCollapse: "collapse", fontSize: 13 }}>
        <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>{["Business", "Amount", "Plan", "Method · Txn", "Status", "Reviewed"].map((h) => <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: T.textMuted, fontWeight: 600, fontSize: 10.5, textTransform: "uppercase", letterSpacing: .8 }}>{h}</th>)}</tr></thead>
        <tbody>{history.slice(0, 60).map((p) => <tr key={p.id} className="ui-row" style={{ borderBottom: `1px solid ${T.border}`, cursor: "pointer" }} onClick={() => openDetail(p.client_id)}>
          <td style={{ padding: "10px 14px", fontWeight: 600 }}>{p.business_name}<div style={{ fontSize: 11.5, color: T.textDim, fontWeight: 400 }}>{p.owner_email}</div></td>
          <td style={{ padding: "10px 14px", fontWeight: 700, color: T.gold }}>{taka(p.amount)}</td>
          <td style={{ padding: "10px 14px" }}><Badge color={planColor(p.plan)}>{planName(p.plan)}</Badge> <span style={{ color: T.textDim, fontSize: 11.5 }}>{p.billing_cycle}</span></td>
          <td style={{ padding: "10px 14px", color: T.textMuted }}>{p.method} <span style={{ fontFamily: "monospace", fontSize: 11.5 }}>· {p.txn_id}</span></td>
          <td style={{ padding: "10px 14px" }}><Badge color={p.status === "approved" ? T.success : T.danger}>{p.status}</Badge>{p.admin_note && <div style={{ fontSize: 11, color: T.textDim, marginTop: 3, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.admin_note}</div>}</td>
          <td style={{ padding: "10px 14px", color: T.textMuted, whiteSpace: "nowrap" }}>{shortDate(p.reviewed_at)}<div style={{ fontSize: 11, color: T.textDim }}>{p.reviewed_by}</div></td>
        </tr>)}</tbody></table></div>}
    </Card>
  </div>;
}

// ── Admins (super only) ──────────────────────────────────────────────────────
function Admins({ admins, superKey, setSuperKey, setRole, removeAdmin, busy }) {
  const [confirmRemove, setConfirmRemove] = useState(null);
  const locked = !superKey;
  const roles = ["viewer", "editor", "full"];
  return <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 900 }}>
    <Card style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", borderColor: locked ? T.border : `color-mix(in srgb, ${T.success} 40%, transparent)` }}>
      <span style={{ width: 44, height: 44, borderRadius: 14, background: locked ? T.goldBg : `color-mix(in srgb, ${T.success} 12%, transparent)`, color: locked ? T.gold : T.success, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 21 }}><i className={`ti ${locked ? "ti-lock" : "ti-lock-open"}`} /></span>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 700 }}>{locked ? "Enter your secret admin key" : "Key entered — changes are enabled"}</div><div style={{ fontSize: 12.5, color: T.textMuted, marginTop: 2 }}>Role changes and removals need the key. It is never stored.</div></div>
      <PwInput value={superKey} onChange={(e) => setSuperKey(e.target.value)} placeholder="Secret admin key" style={{ flex: "1 1 260px" }} />
    </Card>
    <Card>
      <SectionTitle icon="ti-shield-check" right={<span style={{ fontSize: 11.5, color: T.textDim }}>{admins.length} accounts</span>}>Admin accounts</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 8, marginBottom: 14 }}>
        {[["viewer", "Sees everything, changes nothing"], ["editor", "Plans, trials, suspensions, payments"], ["full", "Editor + can delete clients"]].map(([r, d]) => <div key={r} style={{ padding: "10px 12px", borderRadius: 12, background: T.bgAlt, boxShadow: T.nmIn, fontSize: 12 }}><Badge color={ROLE[r].color}>{ROLE[r].label}</Badge><div style={{ color: T.textMuted, marginTop: 6 }}>{d}</div></div>)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {admins.map((a) => { const isS = a.role === "super"; const rm = confirmRemove === a.email; return <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "11px 13px", borderRadius: 14, background: T.bgAlt, boxShadow: T.nmIn }}>
          <span style={{ width: 36, height: 36, borderRadius: 11, background: `color-mix(in srgb, ${ROLE[a.role].color} 14%, transparent)`, color: ROLE[a.role].color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}><i className={`ti ${ROLE[a.role].icon}`} /></span>
          <div style={{ flex: "1 1 200px", minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.email}</div><div style={{ fontSize: 11.5, color: T.textDim }}><Badge color={ROLE[a.role].color}>{ROLE[a.role].label}</Badge> <span style={{ marginLeft: 6 }}>since {shortDate(a.created_at)}</span></div></div>
          {!isS && (rm ? <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}><span style={{ fontSize: 12.5 }}>Remove {a.email}?</span><Btn small danger onClick={async () => { await removeAdmin(a.email); setConfirmRemove(null); }} disabled={busy === a.email + "remove"}>Yes, remove</Btn><Btn small onClick={() => setConfirmRemove(null)}>Cancel</Btn></div>
            : <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <Segmented size="sm" value={a.role} onChange={(r) => !locked && r !== a.role && setRole(a.email, r)} items={roles.map((r) => ({ value: r, label: ROLE[r].label }))} style={{ background: T.card, boxShadow: T.nmSm, borderRadius: 11, padding: 3, opacity: locked ? .55 : 1, pointerEvents: locked ? "none" : "auto" }} />
              {a.role === "blocked" ? <Btn small onClick={() => setRole(a.email, "pending")} disabled={locked || busy === a.email + "pending"} style={{ color: T.success }}>Unblock</Btn> : <Btn small onClick={() => setRole(a.email, "blocked")} disabled={locked || busy === a.email + "blocked"} style={{ color: T.danger, background: T.dangerBg }}>Block</Btn>}
              <button onClick={() => !locked && setConfirmRemove(a.email)} disabled={locked} title="Remove admin" className="ui-btn" style={{ background: "none", border: "none", color: T.danger, cursor: locked ? "default" : "pointer", fontSize: 17, opacity: locked ? .4 : 1, padding: 6, minHeight: 0 }}><i className="ti ti-trash" /></button>
            </div>)}
        </div>; })}
      </div>
    </Card>
  </div>;
}

// ── AI key permission (BYOK, super admin only) ──────────────────────────────
// The super admin grants PERMISSION here; the client pastes their own key in
// their dashboard (Settings → Your AI API key). Once their key is in, their
// chat, photos and voice run — and bill — exclusively on it: an exhausted or
// broken key never falls back to the platform key. Product-search embeddings
// are the one exception (always the platform's Gemini key — the catalogue's
// vector space).
const AI_PROVIDERS = {
  google: { label: "Google AI Studio", icon: "ti-brand-google", color: "#4285F4" },
  openai: { label: "OpenAI", icon: "ti-brand-openai", color: "#10A37F" },
};

function AITab({ ai, clientId, superKey, setSuperKey, allow, revoke, busy }) {
  const [msg, setMsg] = useState(null);        // {ok, text}
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const locked = !superKey;
  const permitted = !!ai;
  const hasKey = !!(ai && ai.key_mask && ai.status !== "no_key");
  const P = hasKey ? AI_PROVIDERS[ai.provider] : null;

  const doAllow = async () => {
    const r = await allow(clientId);
    setMsg(r.ok ? { ok: true, text: "Permission granted. The client now sees an API key box in their dashboard (Settings)." } : { ok: false, text: r.error });
  };
  const doRevoke = async () => {
    const r = await revoke(clientId);
    setMsg(r.ok ? { ok: true, text: "API key access removed. The box is gone from their dashboard, any saved key was deleted, and their bot is back on the platform key." } : { ok: false, text: r.error });
    setConfirmRevoke(false);
  };

  return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    {/* Where this client's AI runs today */}
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 13, flexWrap: "wrap" }}>
        <span style={{ width: 46, height: 46, borderRadius: 15, background: hasKey ? `${P.color}1a` : T.goldBg, color: hasKey ? P.color : T.gold, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 23, flexShrink: 0 }}>
          <i className={`ti ${hasKey ? P.icon : permitted ? "ti-key" : "ti-server"}`} /></span>
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>
            {hasKey ? `${P.label} — running on the client's own key` : permitted ? "Permitted — waiting for their key" : "Platform key (default)"}
          </div>
          <div style={{ fontSize: 12.5, color: T.textMuted, marginTop: 3, lineHeight: 1.55 }}>
            {hasKey
              ? <>All AI bills to this key.<span style={{ fontFamily: "monospace", marginLeft: 6 }}>{ai.key_mask}</span>{ai.model ? <> · model <b>{ai.model}</b></> : " · default models"} · added {shortDate(ai.key_added_at)}</>
              : permitted
                ? "The API key box is visible in their dashboard (Settings). Until they paste a key, they run on the platform key."
                : "This client runs on your platform key. Grant permission and an API key box appears in their dashboard — their usage then bills to their own key."}
          </div>
          {hasKey && <div style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {ai.status === "failing"
              ? <Badge color={T.danger}>Failing — their bot is paused, NOT using your key</Badge>
              : <Badge color={T.success}>Verified {shortDate(ai.last_verified_at)}</Badge>}
            {ai.status === "failing" && ai.last_error && <span style={{ fontSize: 11.5, color: T.textDim, maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={ai.last_error}>{ai.last_error}</span>}
          </div>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!permitted && <Btn gold small onClick={doAllow} disabled={locked || busy}>{busy ? "Saving…" : "Give API key access"}</Btn>}
          {permitted && !confirmRevoke &&
            <Btn small onClick={() => setConfirmRevoke(true)} disabled={locked || busy} style={{ color: T.danger, background: T.dangerBg }}>Remove API key access</Btn>}
        </div>
      </div>
      {confirmRevoke && <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12, background: T.bgAlt, boxShadow: T.nmIn, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, flex: "1 1 240px", lineHeight: 1.55 }}>Remove this client's API key access? The box disappears from their dashboard, any saved key is deleted, and their bot goes back to your platform key.</span>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn small danger onClick={doRevoke} disabled={busy}>{busy ? "Removing…" : "Yes, remove access"}</Btn>
          <Btn small onClick={() => setConfirmRevoke(false)}>Cancel</Btn>
        </div>
      </div>}
    </Card>

    {/* The secret key gate, inline so the super admin never has to leave.
        It stays mounted once a key is typed: rendering it only while locked
        unmounted the field on the FIRST keystroke, so only one character ever
        reached the server and every action came back "wrong key". */}
    <Card style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", borderColor: locked ? T.border : `color-mix(in srgb, ${T.success} 40%, transparent)` }}>
      <span style={{ width: 38, height: 38, borderRadius: 12, background: locked ? T.goldBg : `color-mix(in srgb, ${T.success} 12%, transparent)`, color: locked ? T.gold : T.success, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
        <i className={`ti ${locked ? "ti-lock" : "ti-lock-open"}`} /></span>
      <div style={{ flex: "1 1 200px", fontSize: 12.5, color: T.textMuted }}>
        {locked
          ? <>Giving or removing API key access needs your <b style={{ color: T.text }}>secret admin key</b> — the same one role changes use. It is never stored.</>
          : <>Key entered — the buttons above are enabled. It is never stored.</>}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flex: "1 1 240px" }}>
        <PwInput value={superKey} onChange={(e) => setSuperKey(e.target.value)} placeholder="Secret admin key" style={{ flex: 1 }} />
        {!locked && <button type="button" onClick={() => setSuperKey("")} title="Clear" className="ui-btn"
          style={{ background: "none", border: "none", color: T.textDim, cursor: "pointer", fontSize: 16, padding: 6, minHeight: 0 }}><i className="ti ti-x" /></button>}
      </div>
    </Card>

    {msg && <Card style={{ padding: "10px 14px", display: "flex", gap: 9, alignItems: "center", borderColor: `color-mix(in srgb, ${msg.ok ? T.success : T.danger} 35%, transparent)` }}>
      <i className={`ti ${msg.ok ? "ti-check" : "ti-alert-circle"}`} style={{ color: msg.ok ? T.success : T.danger, fontSize: 17, flexShrink: 0 }} />
      <span style={{ fontSize: 12.5 }}>{msg.text}</span>
    </Card>}

    {/* How the separation works — so a support question never needs the code */}
    <Card>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10, color: T.textMuted, textTransform: "uppercase", letterSpacing: .8 }}>How it works</div>
      {[["ti-key", "You grant permission here; the client pastes their own Google AI Studio or OpenAI key in their dashboard."],
        ["ti-messages", "Chat, photo matching, voice, bot training and auto-tags then run — and bill — on their key only."],
        ["ti-scissors", "Hard separation: if their key hits its limit or breaks, their bot pauses politely. It NEVER uses your platform key."],
        ["ti-database", "Only product-search embeddings stay on the platform key (the catalogue's vector space; costs a fraction of a taka)."]].map(([ic, t]) =>
        <div key={ic} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "7px 0", borderTop: `1px solid ${T.border}`, fontSize: 12.5, lineHeight: 1.55 }}>
          <i className={`ti ${ic}`} style={{ color: T.gold, width: 18, marginTop: 2 }} /><span style={{ flex: 1 }}>{t}</span>
        </div>)}
    </Card>
  </div>;
}
