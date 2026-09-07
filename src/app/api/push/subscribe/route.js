export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { saveSubscription, removeSubscription, pushEnabled } from "@/lib/push.js";

// The dashboard sends the browser's push subscription here after the owner turns
// notifications on. POST saves it; DELETE removes it when they turn it off.
export async function POST(request) {
  const { client } = await requireClient(request);
  if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!pushEnabled()) return NextResponse.json({ error: "push_not_configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const sub = body?.subscription;
  const r = await saveSubscription(client.id, sub, request.headers.get("user-agent") || "");
  if (!r.ok) return NextResponse.json({ error: r.reason || "could not save" }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request) {
  const { client } = await requireClient(request);
  if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (body?.endpoint) await removeSubscription(body.endpoint);
  return NextResponse.json({ ok: true });
}
