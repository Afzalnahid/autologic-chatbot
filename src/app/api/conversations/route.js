export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getConversations } from "@/lib/supabase.js";

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
