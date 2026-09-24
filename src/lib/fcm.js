// Native push for the installed app (Firebase Cloud Messaging), the sibling of
// src/lib/push.js (web push). Same idea, same payload shape { title, body, url,
// tag } — but a native device registers a single FCM TOKEN, and the server sends
// through the FCM HTTP v1 API authorised by a Firebase service account.
//
// The service account is one env var, FIREBASE_SERVICE_ACCOUNT (the whole JSON).
// Missing/blank → fcmEnabled() is false and every send is a quiet no-op, so the
// bot never breaks because push is not set up. Nothing here ever throws.
import { supabase } from "@/lib/supabase.js";

let _sa = null, _saTried = false;
function serviceAccount() {
  if (_saTried) return _sa;
  _saTried = true;
  try { _sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || ""); }
  catch { _sa = null; }
  return _sa && _sa.client_email && _sa.private_key ? _sa : (_sa = null);
}

export function fcmEnabled() { return !!serviceAccount(); }
const projectId = () => serviceAccount()?.project_id || "getvoicium";

// An OAuth access token for the FCM scope, minted from the service account and
// cached until shortly before it expires (~1h). google-auth-library is imported
// lazily so a cold start that never sends a push does not pay for it.
let _tok = null, _tokExp = 0;
async function accessToken() {
  const sa = serviceAccount();
  if (!sa) return null;
  if (_tok && Date.now() < _tokExp) return _tok;
  const { GoogleAuth } = await import("google-auth-library");
  const auth = new GoogleAuth({ credentials: sa, scopes: ["https://www.googleapis.com/auth/firebase.messaging"] });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  _tok = token || null;
  _tokExp = Date.now() + 55 * 60 * 1000;   // refresh ~5 min before the 1h expiry
  return _tok;
}

// Store / remove one device's token. Upsert on the token, so re-registering the
// same device updates the row instead of duplicating it.
export async function saveFcmToken(clientId, token, userAgent = "") {
  if (!clientId || !token) return { ok: false, reason: "missing" };
  const { error } = await supabase.from("fcm_tokens").upsert({
    client_id: clientId, token, platform: "android",
    user_agent: String(userAgent).slice(0, 300), last_used_at: new Date().toISOString(),
  }, { onConflict: "token" });
  return error ? { ok: false, reason: error.message } : { ok: true };
}

export async function removeFcmToken(token) {
  if (!token) return;
  await supabase.from("fcm_tokens").delete().eq("token", token);
}

// Send to a list of device tokens. Fans out, counts, prunes a token FCM reports
// as dead (UNREGISTERED / 404), logs the rest, and never throws.
//
// Separated from sendFcm so the admin app can reuse it: since 2026-09-24 the
// admin app's devices live in their own table keyed by email, not by client id
// (src/lib/admin-push.js), but the sending is identical — same Firebase project,
// same service account, only a different list of tokens. `onDead` is how the
// caller prunes from ITS own table.
export async function sendFcmToTokens(tokens, payload = {}, onDead = removeFcmToken) {
  try {
    if (!serviceAccount()) return { sent: 0, reason: "not_configured" };
    const list = (tokens || []).filter(Boolean);
    if (!list.length) return { sent: 0, reason: "no_tokens" };
    const at = await accessToken();
    if (!at) return { sent: 0, reason: "no_token" };

    const url = `https://fcm.googleapis.com/v1/projects/${projectId()}/messages:send`;
    const title = payload.title || "TellMore AI";
    const body = payload.body || "";
    const data = { url: String(payload.url || "/dashboard") };
    if (payload.tag) data.tag = String(payload.tag);

    let sent = 0;
    await Promise.all(list.map(async (token) => {
      const message = {
        message: {
          token,
          notification: { title, body },
          data,
          android: { priority: "HIGH", notification: { tag: payload.tag || undefined } },
        },
      };
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json" },
          body: JSON.stringify(message),
        });
        if (res.ok) { sent++; return; }
        const err = await res.json().catch(() => ({}));
        const code = err?.error?.details?.find?.((d) => d.errorCode)?.errorCode || err?.error?.status;
        // The device unregistered (app removed, token rotated). Prune it.
        if (res.status === 404 || code === "UNREGISTERED" || code === "NOT_FOUND") await onDead(token);
        else console.error("[fcm] send failed:", res.status, code || "");
      } catch (e) {
        console.error("[fcm] send error:", String(e?.message || e).slice(0, 160));
      }
    }));
    return { sent, tokens: list.length };
  } catch (e) {
    console.error("[fcm]", String(e?.message || e).slice(0, 160));
    return { sent: 0, reason: "error" };
  }
}

// Send to every device this client has registered.
export async function sendFcm(clientId, payload = {}) {
  try {
    if (!serviceAccount()) return { sent: 0, reason: "not_configured" };
    if (!clientId) return { sent: 0, reason: "no_client" };
    const { data: rows } = await supabase.from("fcm_tokens").select("token").eq("client_id", clientId);
    if (!rows?.length) return { sent: 0, reason: "no_tokens" };
    return await sendFcmToTokens(rows.map((r) => r.token), payload);
  } catch (e) {
    console.error("[fcm]", String(e?.message || e).slice(0, 160));
    return { sent: 0, reason: "error" };
  }
}
