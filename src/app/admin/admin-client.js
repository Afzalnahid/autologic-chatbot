"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient as createSb } from "@/utils/supabase/client";

const T = {
  bg: "#05080f", bgAlt: "#080e1a", card: "#0d1529",
  gold: "#f0c040", goldBg: "rgba(240,192,64,0.08)",
  text: "#e8e8ec", textMuted: "#8b9cbd",
  border: "#1a2744", danger: "#dc2626", success: "#22c55e", info: "#3b82f6", warn: "#f59e0b",
};

let sb = null;
function getSb() {
  if (!sb) sb = createSb();
  return sb;
}

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

export default function AdminClient() {
  const [session, setSession] = useState(null);
  const [adminKey, setAdminKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMsg, setAuthMsg] = useState("");
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    getSb().auth.getSession().then(({ data: { session: s } }) => setSession(s));
    const { data: sub } = getSb().auth.onAuthStateChange((_e, s) => setSession(s));
    const saved = sessionStorage.getItem("admin_key") || "";
    if (saved) setAdminKey(saved);
    return () => sub.subscription.unsubscribe();
  }, []);

  const api = useCallback(async (method, body) => {
    const token = session?.access_token || "";
    const res = await fetch("/api/admin", {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-admin-key": adminKey },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return res;
  }, [session, adminKey]);

  const load = useCallback(async () => {
    setErr("");
    const res = await api("GET");
    if (res.status === 401) { setErr("Unauthorized — email admin তালিকায় নেই বা admin key ভুল"); setData(null); return; }
    const d = await res.json().catch(() => null);
    if (d?.overview) setData(d);
  }, [api]);

  useEffect(() => { if (session && adminKey) load(); }, [session, adminKey, load]);

  const login = async () => {
    setAuthMsg("");
    const { error } = await getSb().auth.signInWithPassword({ email, password });
    if (error) setAuthMsg(error.message);
  };
  const submitKey = () => {
    sessionStorage.setItem("admin_key", keyInput);
    setAdminKey(keyInput);
  };
  const logout = async () => {
    await getSb().auth.signOut();
    sessionStorage.removeItem("admin_key");
    setAdminKey(""); setData(null);
  };

  const act = async (id, action, value) => {
    setBusy(id + action);
    const res = await api("PUT", { id, action, value });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d.error || "failed"); }
    await load(); setBusy("");
  };
  const del = async (c) => {
    const typed = window.prompt(`"${c.business_name || c.owner_email}" স্থায়ীভাবে delete হবে — সব data মুছে যাবে।\n\nনিশ্চিত হলে DELETE লিখুন:`);
    if (typed !== "DELETE") return;
    setBusy(c.id + "del");
    const res = await api("DELETE", { id: c.id, confirm: "DELETE" });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d.error || "failed"); }
    await load(); setBusy("");
  };

  const page = { background: T.bg, minHeight: "100vh", color: T.text, fontFamily: "sans-serif", padding: 20 };
  const input = { width: "100%", background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 8, padding: "11px 13px", color: T.text, fontSize: 14, marginBottom: 12, boxSizing: "border-box" };

  // Step 1: Supabase login
  if (!session) return (
    <div style={{ ...page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Card style={{ width: 360 }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Admin Login</div>
        <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 20 }}>Step 1 of 2 — account login</div>
        <input style={input} placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input style={input} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && login()} />
        {authMsg && <div style={{ fontSize: 12, color: T.danger, marginBottom: 10 }}>{authMsg}</div>}
        <Btn gold onClick={login} style={{ width: "100%" }}>Sign in</Btn>
      </Card>
    </div>
  );

  // Step 2: admin key
  if (!adminKey) return (
    <div style={{ ...page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Card style={{ width: 360 }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Admin Key</div>
        <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 20 }}>Step 2 of 2 — {session.user.email}</div>
        <input style={input} type="password" placeholder="Secret admin key" value={keyInput} onChange={e => setKeyInput(e.target.value)} onKeyDown={e => e.key === "Enter" && submitKey()} />
        <Btn gold onClick={submitKey} style={{ width: "100%" }}>Enter</Btn>
        <div style={{ height: 8 }} />
        <Btn onClick={logout} style={{ width: "100%" }}>Logout</Btn>
      </Card>
    </div>
  );

  if (!data) return (
    <div style={{ ...page, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div style={{ color: T.textMuted }}>{err || "Loading..."}</div>
      {err && <Btn onClick={logout}>Logout</Btn>}
    </div>
  );

  const { overview: o, clients } = data;
  const pIcons = { facebook: "FB", instagram: "IG", whatsapp: "WA", website: "WEB" };

  return (
    <div style={page}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>Autologic <span style={{ color: T.gold }}>Admin</span></div>
            <div style={{ fontSize: 12.5, color: T.textMuted }}>{session.user.email}</div>
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

        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Clients</div>
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
                        <span key={i} style={{ marginRight: 8, color: ch.status === "connected" ? T.success : T.textMuted }}>
                          {pIcons[ch.platform] || ch.platform}
                        </span>
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
                <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
                  <Btn small onClick={() => act(c.id, "plan", c.plan === "pro" ? "trial" : "pro")} disabled={busy === c.id + "plan"}>
                    {c.plan === "pro" ? "Downgrade to trial" : "Upgrade to Pro"}
                  </Btn>
                  <Btn small onClick={() => act(c.id, "extend_trial", 7)} disabled={busy === c.id + "extend_trial"}>+7d trial</Btn>
                  <Btn small onClick={() => act(c.id, "extend_trial", 30)} disabled={busy === c.id + "extend_trial"}>+30d trial</Btn>
                  <Btn small onClick={() => act(c.id, "suspend", !c.suspended)} disabled={busy === c.id + "suspend"} style={{ color: c.suspended ? T.success : T.warn }}>
                    {c.suspended ? "Resume" : "Suspend"}
                  </Btn>
                  <Btn small danger onClick={() => del(c)} disabled={busy === c.id + "del"} style={{ marginLeft: "auto" }}>Delete</Btn>
                </div>
              </Card>
            );
          })}
          {clients.length === 0 && <Card style={{ textAlign: "center", color: T.textMuted, padding: 40 }}>No clients yet</Card>}
        </div>
      </div>
    </div>
  );
}
