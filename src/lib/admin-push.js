// Notifications for the ADMIN app — a different app from the one the clients
// use, with its own devices and its own address.
//
// Owner, 2026-09-24: "I notice that my native app which is for users it
// automatically converted to admin app — the admin app and the user app will be
// separated. There will be two separated apps, one is for user where the user
// notification comes, and an admin app where the admin panel notifications
// come."
//
// What went wrong before: pushToAdmins() addressed an admin by their OWN client
// id, because an admin usually also runs a business on the platform. So a new
// signup, a payment or a server error arrived in the same app as that business's
// customer messages — and because the alert carried url "/admin", tapping it
// turned the user app into the admin console. Two audiences down one pipe.
//
// Now an admin device registers HERE, keyed by the admin's email address, in
// admin_fcm_tokens / admin_push_subscriptions. Nothing in this file can reach a
// client's device and nothing in push.js/fcm.js can reach an admin's, because
// the two live in different tables — that is the separation, and it does not
// depend on anybody remembering a rule.
//
// The sending itself is shared: the same Firebase project and the same VAPID
// keys, only a different list of devices (sendFcmToTokens / sendPushToSubs).
import { supabase } from "@/lib/supabase.js";
import { sendPushToSubs } from "@/lib/push.js";
import { sendFcmToTokens } from "@/lib/fcm.js";

const clean = (e) => String(e || "").trim().toLowerCase();

// ── the admin app's native devices ─────────────────────────────────────────
export async function saveAdminFcmToken(email, token, userAgent = "") {
  const who = clean(email);
  if (!who || !token) return { ok: false, reason: "missing" };
  const { error } = await supabase.from("admin_fcm_tokens").upsert({
    email: who, token, platform: "android",
    user_agent: String(userAgent).slice(0, 300), last_used_at: new Date().toISOString(),
  }, { onConflict: "token" });
  return error ? { ok: false, reason: error.message } : { ok: true };
}

export async function removeAdminFcmToken(token) {
  if (!token) return;
  await supabase.from("admin_fcm_tokens").delete().eq("token", token);
}

// ── the admin console's browsers ───────────────────────────────────────────
export async function saveAdminSubscription(email, sub, userAgent = "") {
  const who = clean(email);
  if (!who || !sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return { ok: false, reason: "bad_subscription" };
  }
  const { error } = await supabase.from("admin_push_subscriptions").upsert({
    email: who,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    user_agent: String(userAgent || "").slice(0, 300),
    last_used_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });
  return error ? { ok: false, reason: error.message } : { ok: true };
}

export async function removeAdminSubscription(endpoint) {
  if (!endpoint) return;
  await supabase.from("admin_push_subscriptions").delete().eq("endpoint", endpoint);
}

// ── reaching one admin on every device they have ───────────────────────────
// The mirror of notify() in push.js, for the other audience. Never throws; a
// platform alert must not be able to break the thing that raised it.
export async function notifyAdmin(email, payload = {}) {
  const who = clean(email);
  if (!who) return { sent: 0, reason: "no_admin" };
  // An admin alert is only ever about the admin console, so the url defaults
  // there rather than to /dashboard — and the admin app is the only app that
  // will ever receive it.
  const load = { ...payload, url: String(payload.url || "/admin") };
  try {
    const [{ data: subs }, { data: toks }] = await Promise.all([
      supabase.from("admin_push_subscriptions").select("endpoint,p256dh,auth").eq("email", who),
      supabase.from("admin_fcm_tokens").select("token").eq("email", who),
    ]);
    const [web, native] = await Promise.all([
      sendPushToSubs(subs || [], load, removeAdminSubscription),
      sendFcmToTokens((toks || []).map((t) => t.token), load, removeAdminFcmToken),
    ]);
    return { web, native, sent: (web.sent || 0) + (native.sent || 0) };
  } catch (e) {
    console.error("[admin-push]", String(e?.message || e).slice(0, 160));
    return { sent: 0, reason: "error" };
  }
}
