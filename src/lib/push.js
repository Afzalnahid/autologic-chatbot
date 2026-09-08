// Web Push — sending the owner a notification on their phone/browser even when
// the dashboard is closed. The browser gives us a "subscription" (an endpoint +
// two keys), we store it, and to notify the owner we POST an encrypted payload to
// that endpoint. web-push does the VAPID signing and the payload encryption.
//
// Everything here is fire-and-forget from the caller's point of view: a push must
// never delay or break the order/booking/reply that triggered it.
import webpush from "web-push";
import { supabase } from "@/lib/supabase.js";

const PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:support@getvoicium.com";

let configured = false;
function configure() {
  if (configured) return true;
  if (!PUBLIC || !PRIVATE) return false;
  try { webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE); configured = true; }
  catch (e) { console.error("[push] VAPID config:", e.message); return false; }
  return true;
}

// Whether push is switched on for this deployment (the keys are set).
export function pushEnabled() {
  return !!(PUBLIC && PRIVATE);
}

// Store (or refresh) one device's subscription. Keyed by endpoint, so the same
// browser re-subscribing updates its row rather than piling up duplicates.
export async function saveSubscription(clientId, sub, userAgent = "") {
  if (!clientId || !sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return { ok: false, reason: "bad_subscription" };
  }
  const { error } = await supabase.from("push_subscriptions").upsert({
    client_id: clientId,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    user_agent: String(userAgent || "").slice(0, 300),
    last_used_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });
  if (error) { console.error("[push] save subscription:", error.message); return { ok: false, reason: error.message }; }
  return { ok: true };
}

export async function removeSubscription(endpoint) {
  if (!endpoint) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

// Send a notification to EVERY device this owner has enabled. Never throws.
// A subscription the push service reports as gone (404/410) is deleted so a dead
// phone does not get retried for ever. `payload` is { title, body, url, tag }.
export async function sendPush(clientId, payload = {}) {
  try {
    if (!clientId) return { sent: 0, reason: "no_client" };
    // The commonest live failure is the server missing its VAPID keys (set in
    // the host's env, e.g. Vercel): subscribing still works because that only
    // needs the PUBLIC key in the browser, but sending needs the PRIVATE key on
    // the server — so pushes vanish silently. Say so out loud instead.
    if (!configure()) {
      console.error("[push] NOT configured — VAPID_PRIVATE_KEY / NEXT_PUBLIC_VAPID_PUBLIC_KEY missing on the server. Nothing was sent.");
      return { sent: 0, reason: "not_configured" };
    }
    const { data: subs } = await supabase.from("push_subscriptions")
      .select("endpoint,p256dh,auth").eq("client_id", clientId);
    if (!subs || !subs.length) return { sent: 0, reason: "no_subscriptions" };

    const body = JSON.stringify({
      title: String(payload.title || "getvoicium"),
      body: String(payload.body || ""),
      url: String(payload.url || "/dashboard"),
      tag: payload.tag ? String(payload.tag) : undefined,
    });

    let sent = 0;
    await Promise.all(subs.map(async (s) => {
      const subscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
      try {
        await webpush.sendNotification(subscription, body, { TTL: 3600 });
        sent++;
      } catch (e) {
        const code = e?.statusCode;
        // 404/410 = the browser dropped this subscription. Prune it.
        if (code === 404 || code === 410) await removeSubscription(s.endpoint);
        else console.error("[push] send failed:", code, e?.body || e?.message || e);
      }
    }));
    return { sent, subscriptions: subs.length };
  } catch (e) {
    console.error("[push] sendPush:", e?.message || e);
    return { sent: 0, reason: "error" };
  }
}
