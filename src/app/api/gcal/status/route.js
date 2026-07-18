export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { supabase } from "@/lib/supabase.js";

export async function GET(request) {
  const { client, error: authErr } = await requireClient(request);
  if (authErr || !client) return NextResponse.json({ connected: false }, { status: authErr ? 401 : 200 });
  return NextResponse.json({
    connected: !!client.gcal_connected,
    email: client.gcal_email || "",
  });
}

export async function DELETE(request) {
  const { client } = await requireClient(request);
  if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await supabase
    .from("clients")
    .update({
      gcal_connected: false,
      gcal_access_token: null,
      gcal_refresh_token: null,
      gcal_token_expiry: null,
      gcal_email: null,
    })
    .eq("id", client.id);
  return NextResponse.json({ ok: true });
}
