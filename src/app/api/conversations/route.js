export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { requireClient } from "@/lib/auth.js";

export async function DELETE(request) {
  try {
    const { sender_id } = await request.json();
    if (!sender_id) return NextResponse.json({ error: "missing sender_id" }, { status: 400 });
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    await supabase.from("message_buffer").delete().eq("sender_id", sender_id).eq("client_id", client.id);
    await supabase.from("chat_memory").delete().eq("session_id", sender_id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(request) {
  const { client, error: authErr } = await requireClient(request);
  if (authErr || !client) return NextResponse.json([], { status: authErr ? 401 : 200 });
  try {
    const { data: all } = await supabase.from("message_buffer").select("*").order("created_at", { ascending: false }).limit(500);
    const messages = (all || []).filter(m => m.client_id === client.id);

    const { data: contactRows } = await supabase.from("contacts").select("sender_id,name,client_id");
    const nameOf = Object.fromEntries(
      (contactRows || [])
        .filter(c => c.client_id === client.id && c.name)
        .map(c => [c.sender_id, c.name])
    );
    const displayName = (sid, platform) => {
      if (nameOf[sid]) return nameOf[sid];
      // WhatsApp sender_id is the customer's phone number in international format
      if (platform === "whatsapp" && /^\d{6,}$/.test(sid || "")) return "+" + sid;
      return "User " + (sid || "").slice(-4);
    };

    // Turn a stored bot reply (a JSON array of message objects) into readable text.
    const humanize = (raw, role) => {
      const s = String(raw || "");
      if (role === "bot" && (s.trim().startsWith("[") || s.trim().startsWith("{"))) {
        try {
          const parsed = JSON.parse(s);
          const arr = Array.isArray(parsed) ? parsed : [parsed];
          const parts = arr.map(o => {
            if (o.type === "text_msg" && o.text) return o.text;
            if (o.type === "image_msg") return "🖼️ Image";
            return "";
          }).filter(Boolean);
          if (parts.length) return parts.join("\n");
        } catch { /* not JSON, fall through */ }
      }
      return s;
    };

    const grouped = {};
    messages.forEach(m => {
      const sid = m.sender_id;
      const role = m.role || "customer";
      const rawContent = m.message_content || "";
      const shown = role !== "bot" && rawContent.startsWith("IDENTIFIED ITEMS") ? "📷 Photo" : humanize(rawContent, role);
      if (!grouped[sid]) {
        const platform = m.platform || "facebook";
        grouped[sid] = {
          id: sid, sender: displayName(sid, platform), platform,
          status: m.status === "Pending" ? "active" : "resolved",
          lastMsg: shown.slice(0, 60), time: m.created_at, messages: [],
        };
      }
      const attachments = (m.attachments || "").split(",").map(s => s.trim()).filter(Boolean);
      grouped[sid].messages.push({ role, text: shown, attachments, time: m.created_at, status: m.status });
    });
    const result = Object.values(grouped);
    result.forEach(c => c.messages.sort((a, b) => new Date(a.time) - new Date(b.time)));
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
