"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient as createSb } from "@/utils/supabase/client";

const T = {
  bg: "#05080f", bgAlt: "#080e1a", card: "#0d1529",
  gold: "#f0c040", text: "#e8e8ec", textMuted: "#8b9cbd",
  border: "#1a2744", danger: "#dc2626", success: "#22c55e", info: "#3b82f6", warn: "#f59e0b", purple: "#8b5cf6",
};

let sb = null;
function getSb() { if (!sb) sb = createSb(); return sb; }

function Card({ children, style }) {
  return <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, ...style }}>{children}</div>;
}
function Btn({ children, onClick, gold, danger, small, disabled, style }) {
  return <button onClick={onClick} disabled={disabled} style={{
    padding: small ? "5px 12px" : "9px 18px", borderRadius: 8, border: "none", cursor: disabled ? "default" : "pointer",
    fontSize: small ? 12 : 13.5, fontWeight: 500, opacity: disabled ? 0.5 : 1,
    background: gold ? T.gold : danger ? T.danger : "rgba(240,192,64,0.1)",
    color: gold ? "#0a0a0a" : danger ? "#fff" : T.text, ...style
  }}>{children}</button>;
}
function Stat({ label, value, color }) {
  return <Card style={{ flex: "1 1 140px", minWidth: 140 }}>
    <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 700, color: color || T.text }}>{value}</div>
  </Card>;
}
function Badge({ children, color }) {
  return <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 12, background: `${color}22`, color, fontWeight: 600 }}>{children}</span>;
}
function PwInput({ value, onChange, placeholder, onEnter }) {
  const [show, setShow] = useState(false);
  const wrap = { position: "relative", marginBottom: 12 };
  const input = { width: "100%", background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 8, padding: "11px 42px 11px 13px", color: T.text, fontSize: 14, boxSizing: "border-box" };
  return <div style={wrap}>
    <input style={input} type={show ? "text" : "password"} placeholder={placeholder} value={value} onChange={onChange} onKeyDown={e => e.key === "Enter" && onEnter && onEnter()} />
    <button onClick={() => setShow(s => !s)} type="button" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: 12, padding: 4 }}>
      {show ? "Hide" : "Show"}
    </button>
  </div>;
}

const ROLE_COLOR = { super: T.purple, full: T.success, editor: T.info, viewer: T.textMuted, pending: T.warn };
const ROLE_LABEL = { super: "Super Admin", full: "Full Access", editor: "Editor", viewer: "Viewer", pending: "Pending" };

export default function AdminClient() {
  const [session, setSession] = useState(null);
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMsg, setAuthMsg] = useState("");
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [superKey, setSuperKey] = useState("");
  const [keyOk, setKeyOk] = useState(false);

  useEffect(() => {
    getSb().auth.getSession().then(({ data: { session: s } }) => setSession(s));
    const { data: sub } = getSb().auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const api = useCallback(async (method, body, extraHeaders) => {
    const token = session?.access_token || "";
    return fetch("/api/admin", {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(extraHeaders || {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }, [session]);

  const load = useCallback(async () => {
    setErr("");
    const res = await api("GET");
    if (res.status === 401) { setData(null); return; }
    const d = await res.json().catch(() => null);
    if (d) setData(d);
  }, [api]);

  useEffect(() => { if (session) load(); }, [session, load]);

  const auth = async () => {
    setAuthMsg("");
    const fn = mode === "signup" ? "signUp" : "signInWithPassword";
    const { error } = await getSb().auth[fn]({ email, password });
    if (error) setAuthMsg(error.message);
    else if (mode === "signup") setAuthMsg("Account created. If email confirmation is on, verify then login.");
  };
  const logout = async () => { await getSb().auth.signOut(); setData(null); setKeyOk(false); };

  const act = async (id, action, value) => {
    setBusy(id + action);
    const res = await api("PUT", { id, action, value });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d.error || "failed"); }
    await load(); setBusy("");
  };
  const del = async (c) => {
    const typed = window.prompt(`"${c.business_name || c.owner_email}" permanently delete — all data removed.\n\nType DELETE to confirm:`);
    if (typed !== "DELETE") return;
    setBusy(c.id + "del");
    const res = await api("DELETE", { id: c.id, confirm: "DELETE" });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d.error || "failed"); }
    await load(); setBusy("");
  };
  const setRole = async (target_email, new_role) => {
    setBusy(target_email + new_role);
    const res = await api("PUT", { type: "set_role", target_email, new_role }, { "x-admin-key": superKey });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d.error || "failed"); }
    await load(); setBusy("");
  };

  const page = { background: T.bg, minHeight: "100vh", color: T.text, fontFamily: "sans-serif", padding: 20 };

  // --- Auth screen ---
  if (!session) return (
    <div style={{ ...page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Card style={{ width: 370 }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Autologic <span style={{ color: T.gold }}>Admin</span></div>
        <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 20 }}>{mode === "signup" ? "Create an admin account" : "Sign in to continue"}</div>
        <input style={{ width: "100%", background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 8, padding: "11px 13px", color: T.text, fontSize: 14, marginBottom: 12, boxSizing: "border-box" }} placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <PwInput value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" onEnter={auth} />
        {authMsg && <div style={{ fontSize: 12, color: authMsg.includes("created") ? T.success : T.danger, marginBottom: 10 }}>{authMsg}</div>}
        <Btn gold onClick={auth} style={{ width: "100%" }}>{mode === "signup" ? "Sign up" : "Sign in"}</Btn>
        <div style={{ textAlign: "center", marginTop: 14, fontSize: 12.5, color: T.textMuted }}>
          {mode === "signup" ? "Already have an account? " : "New admin? "}
          <span onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setAuthMsg(""); }} style={{ color: T.gold, cursor: "pointer" }}>
            {mode === "signup" ? "Login" : "Sign up"}
          </span>
        </div>
      </Card>
    </div>
  );

  if (!data) return <div style={{ ...page, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: T.textMuted }}>Loading...</div></div>;

  // --- Pending screen ---
  if (data.role === "pending") return (
    <div style={{ ...page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Card style={{ width: 400, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>⏳</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Awaiting approval</div>
        <div style={{ fontSize: 13.5, color: T.textMuted, marginBottom: 6 }}>Your account <strong style={{ color: T.text }}>{data.email}</strong> is registered but not yet approved.</div>
        <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 20 }}>The super admin needs to assign you a role before you can access the dashboard.</div>
        <Btn onClick={load} style={{ marginRight: 8 }}>Check again</Btn>
        <Btn danger onClick={logout}>Logout</Btn>
      </Card>
    </div>
  );

  const { overview: o, clients, role, admins } = data;
  const pIcons = { facebook: "FB", instagram: "IG", whatsapp: "WA", website: "WEB" };
  const canEdit = ["super", "full", "editor"].includes(role);
  const canDelete = ["super", "full"].includes(role);

  return (
    <div style={page}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>Autologic <span style={{ color: T.gold }}>Admin</span></div>
            <div style={{ fontSize: 12.5, color: T.textMuted, display: "flex", alignItems: "center", gap: 8 }}>{data.email} <Badge color={ROLE_COLOR[role]}>{ROLE_LABEL[role]}</Badge></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={load}>Refresh</Btn>
            <Btn danger onClick={logout}>Logout</Btn>
          </div>
        </div>

        {err && <div style={{ color: T.danger, fontSize: 13, marginBottom: 14 }}>{err}</div>}

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 26 }}>
          <Stat label="Total clients" value={o.total_clients} />
          <Stat label="Trial" value={o.trial} color={T.warn} />
          <Stat label="Pro" value={o.pro} color={T.success} />
          <Stat label="Suspended" value={o.suspended} color={T.danger} />
          <Stat label="Messages (7d)" value={o.messages_7d} color={T.info} />
          <Stat label="Total messages" value={o.total_messages} />
          <Stat label="Orders" value={o.total_orders} />
          <Stat label="Bookings" value={o.total_bookings} />
          <Stat label="Live channels" value={o.connected_channels} color={T.gold} />
        </div>

        {role === "super" && admins && (
          <Card style={{ marginBottom: 26 }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Admin Access Control <Badge color={T.purple}>Super Admin only</Badge></div>
            <div style={{ fontSize: 12.5, color: T.textMuted, marginBottom: 14 }}>Assign roles to admins. Changing roles requires your secret key.</div>
            <div style={{ marginBottom: 16 }}>
              <PwInput value={superKey} onChange={e => { setSuperKey(e.target.value); setKeyOk(false); }} placeholder="Secret admin key (required to change roles)" onEnter={() => setKeyOk(true)} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {admins.map(a => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 12px", background: T.bgAlt, borderRadius: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis" }}>{a.email}</span>
                    <Badge color={ROLE_COLOR[a.role]}>{ROLE_LABEL[a.role]}</Badge>
                  </div>
                  {a.role !== "super" && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {["viewer", "editor", "full", "pending"].map(r => (
                        <Btn key={r} small onClick={() => setRole(a.email, r)} disabled={!superKey || busy === a.email + r || a.role === r}
                          style={{ background: a.role === r ? ROLE_COLOR[r] : "rgba(240,192,64,0.1)", color: a.role === r ? "#fff" : T.text }}>
                          {ROLE_LABEL[r]}
                        </Btn>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Clients {!canEdit && <Badge color={T.textMuted}>View only</Badge>}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {clients.map(c => {
            const trialLeft = c.trial_end ? Math.ceil((new Date(c.trial_end) - Date.now()) / 86400000) : 0;
            return (
              <Card key={c.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 220, flex: "1 1 260px" }}>
                    <div style={{ fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {c.business_name || "—"}
                      <Badge color={c.business_type === "agency" ? T.info : T.gold}>{c.business_type === "agency" ? "Agency" : "E-commerce"}</Badge>
                      <Badge color={c.plan === "pro" ? T.success : T.warn}>{c.plan}</Badge>
                      {c.suspended && <Badge color={T.danger}>Suspended</Badge>}
                      {c.gcal_connected && <Badge color={T.success}>Calendar</Badge>}
                    </div>
                    <div style={{ fontSize: 12.5, color: T.textMuted, marginTop: 4 }}>{c.owner_email}</div>
                    <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                      Joined {new Date(c.created_at).toLocaleDateString()}
                      {c.plan === "trial" && <> · Trial {trialLeft > 0 ? `${trialLeft}d left` : "expired"}</>}
                    </div>
                    <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>
                      {c.channels.length ? c.channels.map((ch, i) => (
                        <span key={i} style={{ marginRight: 8, color: ch.status === "connected" ? T.success : T.textMuted }}>{pIcons[ch.platform] || ch.platform}</span>
                      )) : "No channels"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", fontSize: 12.5, color: T.textMuted }}>
                    <div style={{ textAlign: "center" }}><div style={{ fontSize: 17, fontWeight: 700, color: T.text }}>{c.messages}</div>msgs<div style={{ fontSize: 11 }}>({c.messages_7d} 7d)</div></div>
                    {c.business_type === "agency"
                      ? <><div style={{ textAlign: "center" }}><div style={{ fontSize: 17, fontWeight: 700, color: T.text }}>{c.bookings}</div>bookings</div>
                        <div style={{ textAlign: "center" }}><div style={{ fontSize: 17, fontWeight: 700, color: T.text }}>{c.kb_files}</div>KB files</div></>
                      : <><div style={{ textAlign: "center" }}><div style={{ fontSize: 17, fontWeight: 700, color: T.text }}>{c.orders}</div>orders</div>
                        <div style={{ textAlign: "center" }}><div style={{ fontSize: 17, fontWeight: 700, color: T.text }}>{c.products}</div>products</div></>}
                  </div>
                </div>
                {canEdit && (
                  <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
                    <Btn small onClick={() => act(c.id, "plan", c.plan === "pro" ? "trial" : "pro")} disabled={busy === c.id + "plan"}>{c.plan === "pro" ? "Downgrade to trial" : "Upgrade to Pro"}</Btn>
                    <Btn small onClick={() => act(c.id, "extend_trial", 7)} disabled={busy === c.id + "extend_trial"}>+7d trial</Btn>
                    <Btn small onClick={() => act(c.id, "extend_trial", 30)} disabled={busy === c.id + "extend_trial"}>+30d trial</Btn>
                    <Btn small onClick={() => act(c.id, "suspend", !c.suspended)} disabled={busy === c.id + "suspend"} style={{ color: c.suspended ? T.success : T.warn }}>{c.suspended ? "Resume" : "Suspend"}</Btn>
                    {canDelete && <Btn small danger onClick={() => del(c)} disabled={busy === c.id + "del"} style={{ marginLeft: "auto" }}>Delete</Btn>}
                  </div>
                )}
              </Card>
            );
          })}
          {clients.length === 0 && <Card style={{ textAlign: "center", color: T.textMuted, padding: 40 }}>No clients yet</Card>}
        </div>
      </div>
    </div>
  );
}
