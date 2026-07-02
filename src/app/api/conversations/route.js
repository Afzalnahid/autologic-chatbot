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
      grouped[sid].messages.push({ role: "customer", text: m.message_content || "", time: m.created_at, status: m.status });
    });
    return NextResponse.json(Object.values(grouped));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
