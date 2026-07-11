export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { requireClient } from "@/lib/auth.js";

export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const form = await request.formData();
    const sender_id = form.get("sender_id");
    const file = form.get("file");
    const kind = form.get("kind") || "image";
    if (!sender_id || !file) return NextResponse.json({ error: "missing fields" }, { status: 400 });

    const { data: mb } = await supabase.from("message_buffer").select("platform,client_id,sender_id").order("created_at",{ascending:false}).limit(300);
    const platform = (mb || []).find(m => m.client_id === client.id && m.sender_id === sender_id)?.platform || "facebook";
    const { data: chans } = await supabase.from("channels").select("*").eq("status", "connected").limit(200);
    const ch = (chans || []).find(c => c.client_id === client.id && c.platform === platform)
      || (chans || []).find(c => c.client_id === client.id);
    if (!ch) return NextResponse.json({ error: "no channel" }, { status: 400 });

    if (platform === "whatsapp") {
      const ext = (file.name?.split(".").pop() || (kind === "audio" ? "mp4" : "jpg")).toLowerCase();
      const path = `${client.id}/chat/${Date.now()}.${ext}`;
      const buf = Buffer.from(await file.arrayBuffer());
      const { error: upErr } = await supabase.storage.from("product-images").upload(path, buf, { contentType: file.type || "image/jpeg" });
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
      const url = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
      const body = kind === "audio"
        ? { messaging_product: "whatsapp", to: sender_id, type: "audio", audio: { link: url } }
        : { messaging_product: "whatsapp", to: sender_id, type: "image", image: { link: url } };
      const wa = await fetch(`https://graph.facebook.com/v24.0/${ch.page_id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ch.access_token}` },
        body: JSON.stringify(body),
      }).then(r => r.json());
      if (wa.error) return NextResponse.json({ error: wa.error.message }, { status: 502 });
      await supabase.from("message_buffer").insert({
        sender_id, message_content: kind === "audio" ? "🎤 Voice message" : "📷 Photo",
        status: "Replied", role: "agent", client_id: client.id, platform,
      });
      return NextResponse.json({ ok: true });
    }

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
      client_id: client.id,
      platform,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
