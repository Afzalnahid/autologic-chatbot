"use client";
import { useState, useEffect } from "react";
import { createClient as createSb } from "@/utils/supabase/client";
import { RULES, PASSWORD_HINT, checkPassword } from "@/lib/password-rules.js";

const T = {
  bg: "#0A0D14", bgAlt: "#0D1119", card: "#0F1420",
  gold: "#FF6B75", text: "#E7EAF2", textMuted: "#98A3BA",
  border: "#1F2839", danger: "#FF5A5F", success: "#2ED3A7",
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
    // This said "at least 6 characters" until 2026-09-25, when the project was
    // set to 8 plus a capital, a small letter and a number. A six-character
    // password sailed past this check and was refused by Supabase in wording
    // written for a developer. One rule, in one file, for every screen.
    const check = checkPassword(pw);
    if (!check.ok) { setErr(check.firstError); return; }
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
            {/* The rule, ticking as they type. Written out here rather than
                reusing the dashboard's component, because this page carries its
                own palette and none of the dashboard's CSS variables — but the
                WORDS come from password-rules.js, so it cannot drift. */}
            {pw.length === 0
              ? <div style={{ fontSize: 11.5, color: T.textMuted, lineHeight: 1.55, margin: "-4px 2px 12px" }}>{PASSWORD_HINT}</div>
              : <ul style={{ listStyle: "none", margin: "-4px 2px 12px", padding: 0, display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
                  {RULES.map(r => (
                    <li key={r.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: r.test(pw) ? T.success : T.textMuted }}>
                      <span aria-hidden="true">{r.test(pw) ? "✓" : "○"}</span>{r.label}
                    </li>
                  ))}
                </ul>}
            <input style={{ ...input, paddingRight: 13 }} type={show ? "text" : "password"} placeholder="Confirm new password" value={pw2} onChange={e => setPw2(e.target.value)} onKeyDown={e => e.key === "Enter" && save()} />
            {err && <div style={{ fontSize: 12, color: T.danger, marginBottom: 10 }}>{err}</div>}
            <button onClick={save} style={{ width: "100%", padding: "11px", borderRadius: 8, border: "none", background: T.gold, color: "#0a0a0a", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Update password</button>
          </>
        )}
      </div>
    </div>
  );
}
