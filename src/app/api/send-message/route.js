export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { requireClient } from "@/lib/auth.js";

export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { sender_id, text } = await request.json();
    if (!sender_id || !text) return NextResponse.json({ error: "missing fields" }, { status: 400 });

    const { data: ch } = await supabase.from("channels").select("access_token, client_id").eq("status", "connected").eq("client_id", client.id).limit(1).single();
    if (!ch) return NextResponse.json({ error: "no connected channel" }, { status: 400 });

    const fbRes = await fetch(`https://graph.facebook.com/v24.0/me/messages?access_token=${ch.access_token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { id: sender_id }, messaging_type: "MESSAGE_TAG", tag: "HUMAN_AGENT", message: { text } }),
    });
    const fbData = await fbRes.json();
    if (fbData.error) return NextResponse.json({ error: fbData.error.message }, { status: 502 });

    await supabase.from("message_buffer").insert({
      sender_id, message_content: text, status: "Replied", role: "agent", client_id: ch.client_id,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
