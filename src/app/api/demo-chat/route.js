export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

const N8N_DEMO_URL = process.env.N8N_DEMO_WEBHOOK_URL || "https://stylish-lobster.pikapod.net/webhook/demo-chat";

export async function POST(request) {
  try {
    const { messages, sessionId } = await request.json();
    const lastMsg = messages?.[messages.length - 1]?.content || "";
    const r = await fetch(N8N_DEMO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: lastMsg, sessionId: sessionId || "dashboard" }),
    });
    const d = await r.json();
    let reply = d.reply || "";
    try {
      const parsed = JSON.parse(reply.replace(/```json|```/g, "").trim());
      if (Array.isArray(parsed)) reply = parsed.filter(p => p.type === "text_msg").map(p => p.text).join("\n");
    } catch {}
    return NextResponse.json({ reply: reply || "No response" });
  } catch (e) {
    return NextResponse.json({ reply: "Demo service unavailable: " + e.message }, { status: 500 });
  }
}
