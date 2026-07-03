export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";

export async function POST(request) {
  try {
    const form = await request.formData();
    const sender_id = form.get("sender_id");
    const file = form.get("file");
    const kind = form.get("kind") || "image";
    if (!sender_id || !file) return NextResponse.json({ error: "missing fields" }, { status: 400 });

    const { data: ch } = await supabase.from("channels").select("*").eq("status", "connected").limit(1).single();
    if (!ch) return NextResponse.json({ error: "no channel" }, { status: 400 });

    const fb = new FormData();
    fb.append("recipient", JSON.stringify({ id: sender_id }));
    fb.append("messaging_type", "MESSAGE_TAG");
    fb.append("tag", "HUMAN_AGENT");
    fb.append("message", JSON.stringify({ attachment: { type: kind, payload: { is_reusable: false } } }));
    fb.append("filedata", file, file.name || (kind === "audio" ? "voice.mp4" : "photo.jpg"));

    const r = await fetch(`https://graph.facebook.com/v24.0/me/messages?access_token=${ch.access_token}`, { method: "POST", body: fb });
    const d = await r.json();
    if (d.error) return NextResponse.json({ error: d.error.message }, { status: 502 });

    await supabase.from("message_buffer").insert({
      sender_id,
      message_content: kind === "audio" ? "🎤 Voice message" : "📷 Photo",
      status: "Replied",
      role: "agent",
      client_id: ch.client_id,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
