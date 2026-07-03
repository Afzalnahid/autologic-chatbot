export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";

const N8N_DEMO_URL = process.env.N8N_DEMO_WEBHOOK_URL || "https://stylish-lobster.pikapod.net/webhook/demo-chat";

export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    const { messages, sessionId } = await request.json();
    const lastMsg = messages?.[messages.length - 1]?.content || "";
    const r = await fetch(N8N_DEMO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: lastMsg, sessionId: sessionId || client?.id || "dashboard", clientId: client?.id ? String(client.id) : "none" }),
    });
    const text = await r.text();
    let reply = "";
    try {
      const d = JSON.parse(text);
      reply = d.reply || "";
    } catch {
      reply = text;
    }
    let images = [];
    try {
      const parsed = JSON.parse(reply.replace(/```json|```/g, "").trim());
      if (Array.isArray(parsed)) {
        images = parsed.filter(p => p.type === "image_msg" && p.url).map(p => p.url);
        reply = parsed.filter(p => p.type === "text_msg").map(p => p.text).join("\n");
      }
    } catch {}
    return NextResponse.json({ reply: reply || "", images });
  } catch (e) {
    return NextResponse.json({ reply: "Demo error: " + e.message }, { status: 500 });
  }
}
