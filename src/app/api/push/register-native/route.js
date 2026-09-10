export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { saveFcmToken, removeFcmToken, fcmEnabled } from "@/lib/fcm.js";

// The installed native app registers its FCM device token here (the sibling of
// /api/push/subscribe, which is for browser Web Push). POST saves it, DELETE
// removes it. Auth-gated to the signed-in client, so a token is only ever tied
// to the account that registered it.
export async function POST(request) {
  const { client, error } = await requireClient(request);
  if (error || !client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!fcmEnabled()) return NextResponse.json({ error: "push_not_configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const token = body?.token;
  if (!token) return NextResponse.json({ error: "missing token" }, { status: 400 });

  const r = await saveFcmToken(client.id, token, request.headers.get("user-agent") || "");
  if (!r.ok) return NextResponse.json({ error: r.reason || "could not save" }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request) {
  const { client, error } = await requireClient(request);
  if (error || !client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (body?.token) await removeFcmToken(body.token);
  return NextResponse.json({ ok: true });
}
