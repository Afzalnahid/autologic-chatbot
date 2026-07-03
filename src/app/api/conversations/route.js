export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getConversations, supabase } from "@/lib/supabase.js";

export async function DELETE(request) {
  try {
    const { sender_id } = await request.json();
    if (!sender_id) return NextResponse.json({ error: "missing sender_id" }, { status: 400 });
    await supabase.from("message_buffer").delete().eq("sender_id", sender_id);
    await supabase.from("chat_memory").delete().eq("session_id", sender_id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const messages = await getConversations();
    const grouped = {};
    messages.forEach(m => {
      const sid = m.sender_id;
      if (!grouped[sid]) {
        grouped[sid] = {
          id: sid, sender: "User " + (sid || "").slice(-4), platform: "messenger",
          status: m.status === "Pending" ? "active" : "resolved",
          lastMsg: (m.message_content || "").slice(0, 60), time: m.created_at, messages: [],
        };
      }
      const raw = m.message_content || "";
      const text = m.role !== "bot" && raw.startsWith("IDENTIFIED PRODUCTS") ? "📷 Photo" : raw;
      const attachments = (m.attachments || "").split(",").map(s => s.trim()).filter(Boolean);
      grouped[sid].messages.push({ role: m.role || "customer", text, attachments, time: m.created_at, status: m.status });
    });
    const result = Object.values(grouped);
    result.forEach(c => c.messages.sort((a, b) => new Date(a.time) - new Date(b.time)));
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
