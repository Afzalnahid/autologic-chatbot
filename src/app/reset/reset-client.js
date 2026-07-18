"use client";
import { useState, useEffect } from "react";
import { createClient as createSb } from "@/utils/supabase/client";

const T = {
  bg: "#05080f", bgAlt: "#080e1a", card: "#0d1529",
  gold: "#f0c040", text: "#e8e8ec", textMuted: "#8b9cbd",
  border: "#1a2744", danger: "#dc2626", success: "#22c55e",
};

let sb = null;
function getSb() { if (!sb) sb = createSb(); return sb; }

export default function ResetClient() {
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase sets a recovery session from the email link fragment.
    getSb().auth.getSession().then(({ data: { session } }) => setReady(!!session));
    const { data: sub } = getSb().auth.onAuthStateChange((_e, s) => setReady(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const save = async () => {
    setErr(""); setMsg("");
    if (pw.length < 6) { setErr("Password must be at least 6 characters."); return; }
    if (pw !== pw2) { setErr("Passwords do not match."); return; }
    const { error } = await getSb().auth.updateUser({ password: pw });
    if (error) setErr(error.message);
    else { setDone(true); setMsg("Password updated. Redirecting to login..."); setTimeout(() => { window.location.href = "/"; }, 2000); }
  };

  const card = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 28, width: 360 };
  const input = { width: "100%", background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 8, padding: "11px 44px 11px 13px", color: T.text, fontSize: 14, marginBottom: 12, boxSizing: "border-box" };

  return (
    <div style={{ background: T.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", color: T.text, padding: 16 }}>
      <div style={card}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Reset Password</div>
        {!ready ? (
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 12 }}>
            Open this page from the password reset link in your email. If you got here directly, request a new link from the login screen.
          </div>
        ) : done ? (
          <div style={{ fontSize: 13.5, color: T.success, marginTop: 12 }}>{msg}</div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 20 }}>Enter your new password below.</div>
            <div style={{ position: "relative" }}>
              <input style={input} type={show ? "text" : "password"} placeholder="New password" value={pw} onChange={e => setPw(e.target.value)} />
              <button type="button" onClick={() => setShow(s => !s)} style={{ position: "absolute", right: 10, top: 15, background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: 12 }}>{show ? "Hide" : "Show"}</button>
            </div>
            <input style={{ ...input, paddingRight: 13 }} type={show ? "text" : "password"} placeholder="Confirm new password" value={pw2} onChange={e => setPw2(e.target.value)} onKeyDown={e => e.key === "Enter" && save()} />
            {err && <div style={{ fontSize: 12, color: T.danger, marginBottom: 10 }}>{err}</div>}
            <button onClick={save} style={{ width: "100%", padding: "11px", borderRadius: 8, border: "none", background: T.gold, color: "#0a0a0a", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Update password</button>
          </>
        )}
      </div>
    </div>
  );
}
