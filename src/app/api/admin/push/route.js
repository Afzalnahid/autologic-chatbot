export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { callerEmail, callerRole } from "@/lib/admin-auth.js";
import { fcmEnabled } from "@/lib/fcm.js";
import { pushEnabled } from "@/lib/push.js";
import {
  saveAdminFcmToken, removeAdminFcmToken,
  saveAdminSubscription, removeAdminSubscription,
} from "@/lib/admin-push.js";

// Where an ADMIN device registers to be told what is happening on the platform.
//
// The sibling of /api/push/register-native and /api/push/subscribe, which are
// for a CLIENT's devices. Kept apart on purpose (owner, 2026-09-24: the admin
// app and the user app must be two separate apps): a token registered here can
// only ever be reached by notifyAdmin(), and a client's token can only ever be
// reached by notify(). Neither can spill into the other.
//
// One route for both kinds of device because the admin console and the admin
// app are the same page — the body says which: { token } is the native app's
// FCM token, { subscription } is a browser's Web Push subscription.

async function admin(request) {
  const email = await callerEmail(request);
  if (!email) return null;
  const role = await callerRole(email);
  if (!role || role === "pending" || role === "blocked") return null;
  return email;
}

export async function POST(request) {
  const email = await admin(request);
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const ua = request.headers.get("user-agent") || "";

  if (body?.token) {
    if (!fcmEnabled()) return NextResponse.json({ error: "push_not_configured" }, { status: 503 });
    const r = await saveAdminFcmToken(email, body.token, ua);
    if (!r.ok) return NextResponse.json({ error: r.reason || "could not save" }, { status: 400 });
    return NextResponse.json({ ok: true, kind: "native" });
  }

  if (body?.subscription) {
    if (!pushEnabled()) return NextResponse.json({ error: "push_not_configured" }, { status: 503 });
    const r = await saveAdminSubscription(email, body.subscription, ua);
    if (!r.ok) return NextResponse.json({ error: r.reason || "could not save" }, { status: 400 });
    return NextResponse.json({ ok: true, kind: "web" });
  }

  return NextResponse.json({ error: "missing token or subscription" }, { status: 400 });
}

export async function DELETE(request) {
  const email = await admin(request);
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (body?.token) await removeAdminFcmToken(body.token);
  if (body?.endpoint) await removeAdminSubscription(body.endpoint);
  return NextResponse.json({ ok: true });
}
