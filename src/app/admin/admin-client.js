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

const ROLE_COLOR = { super: T.purple, full: T.success, editor: T.info, viewer: T.textMuted, pending: T.warn, blocked: T.danger };
const ROLE_LABEL = { super: "Super Admin", full: "Full Access", editor: "Editor", viewer: "Viewer", pending: "Pending", blocked: "Blocked" };

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
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const openDetail = async (id) => {
    setDetailLoading(true); setDetail({ loading: true });
    const token = session?.access_token || "";
    const res = await fetch(`/api/admin/client-detail?id=${id}&t=${Date.now()}`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
    const d = await res.json().catch(() => null);
    setDetail(d && !d.error ? d : null);
    setDetailLoading(false);
  };

  useEffect(() => {
    getSb().auth.getSession().then(({ data: { session: s } }) => setSession(s));
    const { data: sub } = getSb().auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const api = useCallback(async (method, body, extraHeaders) => {
    const token = session?.access_token || "";
    const url = method === "GET" ? `/api/admin?t=${Date.now()}` : "/api/admin";
    return fetch(url, {
      method,
      cache: "no-store",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(extraHeaders || {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }, [session]);

  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async (silent) => {
    if (!silent) { setErr(""); setRefreshing(true); }
    const res = await api("GET");
    if (res.status === 401) { if (!silent) { setData(null); setRefreshing(false); } return; }
    const d = await res.json().catch(() => null);
    if (d) setData(d);
    if (!silent) setRefreshing(false);
  }, [api]);

  useEffect(() => { if (session) load(); }, [session, load]);

  // Auto-refresh every 10s so client-side changes (products, orders, bookings,
  // knowledge files, plan changes) reflect in the admin dashboard in near real-time.
  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => load(true), 10000);
    return () => clearInterval(t);
  }, [session, load]);

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

  // Verify or reject a client payment.
  const reviewPayment = async (req, decision) => {
    let note = null;
    if (decision === "reject") {
      note = window.prompt(`Reject payment from "${req.business_name}"?\n\nReason (shown to the client):`);
      if (note === null) return;
    } else if (!window.confirm(`Confirm you received \u09F3${Number(req.amount).toLocaleString("en-IN")} via ${req.method}\nTransaction: ${req.txn_id}\n\nThis will activate the ${req.plan} plan.`)) {
      return;
    }
    setBusy(req.id + decision);
    const res = await api("PUT", { type: "payment", request_id: req.id, decision, note });
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
  const removeAdmin = async (target_email) => {
    if (!window.confirm(`Remove ${target_email} completely from admin list? They can sign up again later but will start as pending.`)) return;
    setBusy(target_email + "remove");
    const res = await api("PUT", { type: "remove_admin", target_email }, { "x-admin-key": superKey });
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

  // --- Blocked screen ---
  if (data.role === "blocked") return (
    <div style={{ ...page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Card style={{ width: 400, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🚫</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Access blocked</div>
        <div style={{ fontSize: 13.5, color: T.textMuted, marginBottom: 20 }}>Your admin account <strong style={{ color: T.text }}>{data.email}</strong> has been blocked by the super admin. Contact them if you think this is a mistake.</div>
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
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
              <Btn onClick={() => load()} disabled={refreshing}>{refreshing ? "Refreshing..." : "Refresh"}</Btn>
              {data.server_time && <span style={{ fontSize: 10.5, color: T.textMuted }}>synced {new Date(data.server_time).toLocaleTimeString()}</span>}
            </div>
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
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      {["viewer", "editor", "full"].map(r => (
                        <Btn key={r} small onClick={() => setRole(a.email, r)} disabled={!superKey || busy === a.email + r || a.role === r}
                          style={{ background: a.role === r ? ROLE_COLOR[r] : "rgba(240,192,64,0.1)", color: a.role === r ? "#fff" : T.text }}>
                          {ROLE_LABEL[r]}
                        </Btn>
                      ))}
                      {a.role === "blocked"
                        ? <Btn small onClick={() => setRole(a.email, "pending")} disabled={!superKey || busy === a.email + "pending"} style={{ color: T.success }}>Unblock</Btn>
                        : <Btn small onClick={() => setRole(a.email, "blocked")} disabled={!superKey || busy === a.email + "blocked"} style={{ color: T.danger }}>Block</Btn>}
                      <Btn small danger onClick={() => removeAdmin(a.email)} disabled={!superKey || busy === a.email + "remove"}>Remove</Btn>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {(() => {
          const payments = data.payments || [];
          const pending = payments.filter(p => p.status === "pending");
          const reviewed = payments.filter(p => p.status !== "pending").slice(0, 8);
          if (!payments.length) return null;
          const taka = n => "\u09F3" + Number(n || 0).toLocaleString("en-IN");
          return (
            <Card style={{ marginBottom: 20, border: pending.length ? `1px solid ${T.warn}55` : undefined }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                Payments
                {pending.length > 0 && <Badge color={T.warn}>{pending.length} awaiting review</Badge>}
              </div>
              <div style={{ fontSize: 12.5, color: T.textMuted, marginBottom: 16 }}>
                Check the transaction in your bKash/Nagad app before approving.
              </div>

              {pending.length === 0
                ? <div style={{ fontSize: 13, color: T.textMuted, marginBottom: reviewed.length ? 16 : 0 }}>No payments waiting for review.</div>
                : pending.map(p => (
                  <div key={p.id} style={{ background: T.bgAlt, border: `0.5px solid ${T.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                      <div style={{ minWidth: 200, flex: "1 1 240px" }}>
                        <div style={{ fontSize: 14.5, fontWeight: 600 }}>{p.business_name}</div>
                        <div style={{ fontSize: 12.5, color: T.textMuted, marginTop: 2 }}>{p.owner_email}</div>
                        <div style={{ fontSize: 12.5, color: T.textMuted, marginTop: 6 }}>
                          {new Date(p.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div style={{ minWidth: 190 }}>
                        <div style={{ fontSize: 19, fontWeight: 700, color: T.gold }}>{taka(p.amount)}</div>
                        <div style={{ fontSize: 12.5, color: T.textMuted, marginTop: 3 }}>
                          {p.plan} · {p.billing_cycle} · {p.method}
                        </div>
                        <div style={{ fontSize: 12.5, marginTop: 5 }}>
                          <span style={{ color: T.textMuted }}>Txn </span>
                          <span style={{ fontFamily: "monospace", color: T.text }}>{p.txn_id}</span>
                        </div>
                        {p.sender_number && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}>From {p.sender_number}</div>}
                      </div>
                    </div>
                    {canEdit && (
                      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                        <Btn small onClick={() => reviewPayment(p, "approve")} disabled={busy === p.id + "approve"} style={{ background: T.success, color: "#fff" }}>
                          {busy === p.id + "approve" ? "Approving..." : "Approve & activate"}
                        </Btn>
                        <Btn small danger onClick={() => reviewPayment(p, "reject")} disabled={busy === p.id + "reject"}>Reject</Btn>
                      </div>
                    )}
                  </div>
                ))}

              {reviewed.length > 0 && (
                <div style={{ marginTop: 8, paddingTop: 14, borderTop: `0.5px solid ${T.border}` }}>
                  <div style={{ fontSize: 12, color: T.textMuted, textTransform: "uppercase", letterSpacing: .8, marginBottom: 10 }}>Recently reviewed</div>
                  {reviewed.map(p => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "7px 0", fontSize: 12.5, flexWrap: "wrap" }}>
                      <span style={{ flex: "1 1 160px" }}>{p.business_name}</span>
                      <span style={{ color: T.textMuted }}>{taka(p.amount)} · {p.plan}</span>
                      <Badge color={p.status === "approved" ? T.success : T.danger}>{p.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })()}

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
                {canEdit ? (
                  <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
                    <Btn small onClick={() => openDetail(c.id)}>View details</Btn>
                    <Btn small onClick={() => act(c.id, "plan", c.plan === "pro" ? "trial" : "pro")} disabled={busy === c.id + "plan"}>{c.plan === "pro" ? "Downgrade to trial" : "Upgrade to Pro"}</Btn>
                    <Btn small onClick={() => act(c.id, "extend_trial", 7)} disabled={busy === c.id + "extend_trial"}>+7d trial</Btn>
                    <Btn small onClick={() => act(c.id, "extend_trial", 30)} disabled={busy === c.id + "extend_trial"}>+30d trial</Btn>
                    <Btn small onClick={() => act(c.id, "suspend", !c.suspended)} disabled={busy === c.id + "suspend"} style={{ color: c.suspended ? T.success : T.warn }}>{c.suspended ? "Resume" : "Suspend"}</Btn>
                    {canDelete && <Btn small danger onClick={() => del(c)} disabled={busy === c.id + "del"} style={{ marginLeft: "auto" }}>Delete</Btn>}
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, marginTop: 14, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
                    <Btn small onClick={() => openDetail(c.id)}>View details</Btn>
                  </div>
                )}
              </Card>
            );
          })}
          {clients.length === 0 && <Card style={{ textAlign: "center", color: T.textMuted, padding: 40 }}>No clients yet</Card>}
        </div>
      </div>

      {detail && <ClientDetailModal detail={detail} loading={detailLoading} onClose={() => setDetail(null)} />}
    </div>
  );
}

function Row({ label, value }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
    <span style={{ color: T.textMuted }}>{label}</span>
    <span style={{ color: T.text, textAlign: "right", wordBreak: "break-word" }}>{value || "—"}</span>
  </div>;
}
function Section({ title, children }) {
  return <div style={{ marginTop: 18 }}>
    <div style={{ fontSize: 13.5, fontWeight: 600, color: T.gold, marginBottom: 8 }}>{title}</div>
    {children}
  </div>;
}

function ClientDetailModal({ detail, loading, onClose }) {
  const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 20, zIndex: 100, overflowY: "auto" };
  const box = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24, width: 640, maxWidth: "100%", marginTop: 20, marginBottom: 40 };
  const pIcons = { facebook: "Facebook", instagram: "Instagram", whatsapp: "WhatsApp", website: "Website" };

  if (loading || detail.loading) return (
    <div style={overlay} onClick={onClose}><div style={box} onClick={e => e.stopPropagation()}><div style={{ color: T.textMuted, textAlign: "center", padding: 30 }}>Loading client details...</div></div></div>
  );

  const { client: c, channels, messages: m, orders, bookings, products, files } = detail;
  const fmt = (d) => d ? new Date(d).toLocaleDateString() : "—";
  const isAgency = c.business_type === "agency";

  return (
    <div style={overlay} onClick={onClose}>
      <div style={box} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 700 }}>{c.business_name || "—"}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              <Badge color={isAgency ? T.info : T.gold}>{isAgency ? "Agency" : "E-commerce"}</Badge>
              <Badge color={c.plan === "pro" ? T.success : T.warn}>{c.plan}</Badge>
              {c.suspended && <Badge color={T.danger}>Suspended</Badge>}
              {c.gcal_connected && <Badge color={T.success}>Calendar connected</Badge>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.textMuted, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <Section title="Business Information">
          <Row label="Email" value={c.owner_email} />
          <Row label="Phone" value={c.phone} />
          <Row label="Address" value={c.address} />
          <Row label="Website" value={c.website} />
          <Row label="Business type" value={isAgency ? "Agency / Service provider" : "E-commerce / Online shop"} />
          <Row label="Plan" value={c.plan} />
          <Row label="Joined" value={fmt(c.created_at)} />
          <Row label="Trial start" value={fmt(c.trial_start)} />
          <Row label="Trial end" value={fmt(c.trial_end)} />
          {c.gcal_connected && <Row label="Calendar email" value={c.gcal_email} />}
        </Section>

        <Section title={`Messages (${m.total} total)`}>
          <Row label="Today" value={m.today} />
          <Row label="This week" value={m.week} />
          <Row label="This month" value={m.month} />
          <Row label="From customers" value={m.customer} />
          <Row label="From bot" value={m.bot} />
          <Row label="From agent" value={m.agent} />
        </Section>

        <Section title={`Channels (${channels.length})`}>
          {channels.length ? channels.map((ch, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13, gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 500 }}>{pIcons[ch.platform] || ch.platform}</span>
              <span style={{ color: T.textMuted, fontFamily: "monospace", fontSize: 11.5 }}>{ch.page_id || "—"}</span>
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Badge color={ch.status === "connected" ? T.success : T.textMuted}>{ch.status}</Badge>
                <span style={{ color: T.textMuted, fontSize: 11.5 }}>{fmt(ch.connected_at)}</span>
              </span>
            </div>
          )) : <div style={{ color: T.textMuted, fontSize: 13, padding: "6px 0" }}>No channels connected</div>}
        </Section>

        {isAgency ? (
          <>
            <Section title={`Knowledge Base Files (${files.length})`}>
              {files.length ? files.map((f, i) => (
                <div key={`kb-${f.file_name}-${i}`} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13, gap: 10 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.file_name}</span>
                  <span style={{ color: T.textMuted, fontSize: 11.5, flexShrink: 0 }}>{f.chunks} chunks · {fmt(f.created_at)}</span>
                </div>
              )) : <div style={{ color: T.textMuted, fontSize: 13, padding: "6px 0" }}>No files uploaded</div>}
            </Section>
            <Section title={`Bookings (${bookings.length})`}>
              {bookings.length ? bookings.slice(0, 20).map((b, i) => (
                <div key={i} style={{ padding: "8px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ fontWeight: 500 }}>{b.customer_name || "—"}</span>
                    <Badge color={b.status === "Confirmed" ? T.success : T.textMuted}>{b.status}</Badge>
                  </div>
                  <div style={{ color: T.textMuted, fontSize: 12, marginTop: 2 }}>{b.service_want} · {b.meeting_date} {b.meeting_time}</div>
                </div>
              )) : <div style={{ color: T.textMuted, fontSize: 13, padding: "6px 0" }}>No bookings</div>}
            </Section>
          </>
        ) : (
          <>
            <Section title={`Products (${products.length})`}>
              {products.length ? products.slice(0, 30).map((p, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13, gap: 10 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                  <span style={{ color: T.textMuted, flexShrink: 0 }}>{p.price ? `${p.price}` : ""} {p.code ? `· ${p.code}` : ""}</span>
                </div>
              )) : <div style={{ color: T.textMuted, fontSize: 13, padding: "6px 0" }}>No products</div>}
            </Section>
            <Section title={`Orders (${orders.length})`}>
              {orders.length ? orders.slice(0, 20).map((o, i) => (
                <div key={i} style={{ padding: "8px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ fontWeight: 500 }}>{o.customer_name || "—"} <span style={{ color: T.textMuted, fontWeight: 400 }}>#{o.order_code}</span></span>
                    <Badge color={o.status === "Pending" ? T.warn : T.success}>{o.status}</Badge>
                  </div>
                  <div style={{ color: T.textMuted, fontSize: 12, marginTop: 2 }}>{o.total_price ? `৳${o.total_price} · ` : ""}{fmt(o.created_at)}</div>
                </div>
              )) : <div style={{ color: T.textMuted, fontSize: 13, padding: "6px 0" }}>No orders</div>}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
