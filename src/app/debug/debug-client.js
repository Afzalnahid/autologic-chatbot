"use client";
import { useState, useEffect } from "react";
import { createClient as createSb } from "@/utils/supabase/client";

let sb = null;
function getSb() { if (!sb) sb = createSb(); return sb; }

export default function DebugClient() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [clientId, setClientId] = useState("0f129935-d27e-44cc-a7e9-51f655522b18");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSb().auth.getSession().then(({ data: { session: s } }) => setSession(s));
    const { data: sub } = getSb().auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const login = async () => {
    const { error } = await getSb().auth.signInWithPassword({ email, password });
    if (error) setOut("LOGIN ERROR: " + error.message);
  };

  const appView = async () => {
    setBusy(true); setOut("Loading...");
    const token = session?.access_token || "";
    try {
      const res = await fetch(`/api/admin/cleanup-files?t=${Date.now()}`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json();
      setOut("STATUS: " + res.status + "\n\n" + JSON.stringify(j, null, 2));
    } catch (e) { setOut("ERROR: " + e.message); }
    setBusy(false);
  };

  const wipe = async () => {
    if (!window.confirm("Delete ALL file_registry + knowledge_base rows? This cannot be undone.")) return;
    setBusy(true); setOut("Wiping...");
    const token = session?.access_token || "";
    try {
      const res = await fetch(`/api/admin/cleanup-files`, {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ confirm: "WIPE" }),
      });
      const j = await res.json();
      setOut("STATUS: " + res.status + "\n\n" + JSON.stringify(j, null, 2) + "\n\nNow re-check with the other buttons.");
    } catch (e) { setOut("ERROR: " + e.message); }
    setBusy(false);
  };

  const callDetail = async () => {
    setBusy(true); setOut("Loading...");
    const token = session?.access_token || "";
    try {
      const res = await fetch(`/api/admin/client-detail?id=${clientId}&t=${Date.now()}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await res.text();
      let pretty = text;
      try {
        const j = JSON.parse(text);
        // Highlight the files array specifically
        pretty = "STATUS: " + res.status + "\n\n=== files array ===\n" +
          JSON.stringify(j.files, null, 2) +
          "\n\n=== full response ===\n" + JSON.stringify(j, null, 2);
      } catch {}
      setOut(pretty);
    } catch (e) {
      setOut("FETCH ERROR: " + e.message);
    }
    setBusy(false);
  };

  const callMain = async () => {
    setBusy(true); setOut("Loading...");
    const token = session?.access_token || "";
    try {
      const res = await fetch(`/api/admin?t=${Date.now()}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      const client = (j.clients || []).find(c => c.id === clientId);
      setOut("STATUS: " + res.status + "\n\n=== this client's kb_files count (main API) ===\n" +
        (client ? client.kb_files : "client not found") +
        "\n\n=== client row ===\n" + JSON.stringify(client, null, 2));
    } catch (e) {
      setOut("FETCH ERROR: " + e.message);
    }
    setBusy(false);
  };

  const S = { background: "#05080f", minHeight: "100vh", color: "#e8e8ec", fontFamily: "monospace", padding: 16 };
  const inp = { width: "100%", background: "#080e1a", border: "1px solid #1a2744", borderRadius: 6, padding: "10px", color: "#e8e8ec", fontSize: 13, marginBottom: 8, boxSizing: "border-box" };
  const btn = { padding: "10px 16px", borderRadius: 6, border: "none", background: "#f0c040", color: "#0a0a0a", fontWeight: 600, fontSize: 13, cursor: "pointer", marginRight: 8, marginBottom: 8 };

  return (
    <div style={S}>
      <h2 style={{ color: "#f0c040" }}>API Debug</h2>
      {!session ? (
        <div style={{ maxWidth: 400 }}>
          <p style={{ fontSize: 13, color: "#8b9cbd" }}>Login first:</p>
          <input style={inp} placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input style={inp} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
          <button style={btn} onClick={login}>Login</button>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 12, color: "#22c55e" }}>Logged in: {session.user.email}</p>
          <input style={inp} value={clientId} onChange={e => setClientId(e.target.value)} placeholder="client id" />
          <div>
            <button style={btn} onClick={callDetail} disabled={busy}>Call client-detail API</button>
            <button style={btn} onClick={callMain} disabled={busy}>Call main admin API</button>
            <button style={btn} onClick={appView} disabled={busy}>See app's file_registry</button>
            <button style={{...btn, background:"#dc2626", color:"#fff"}} onClick={wipe} disabled={busy}>WIPE all files</button>
          </div>
        </div>
      )}
      <pre style={{ background: "#0d1529", padding: 12, borderRadius: 8, marginTop: 16, fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-all", border: "1px solid #1a2744" }}>{out}</pre>
    </div>
  );
}
