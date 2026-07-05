export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { runDemo } from "@/lib/bot.js";

export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ reply: "Unauthorized" }, { status: 401 });
    const { messages } = await request.json();
    const history = (messages || []).slice(0, -1).map(m => ({
      role: m.role === "bot" ? "assistant" : "user",
      content: m.text || m.content || "",
    })).filter(m => m.content);
    const lastMsg = messages?.[messages.length - 1]?.content || messages?.[messages.length - 1]?.text || "";
    if (!lastMsg) return NextResponse.json({ reply: "", images: [] });

    const { items, error } = await runDemo(client.id, lastMsg, history);
    if (error) return NextResponse.json({ reply: "Error: " + error, images: [] }, { status: 502 });

    const images = items.filter(i => i.type === "image_msg" && i.url).map(i => i.url);
    const reply = items.filter(i => i.type === "text_msg" && i.text).map(i => i.text).join("\n");
    return NextResponse.json({ reply, images });
  } catch (e) {
    return NextResponse.json({ reply: "Error: " + e.message, images: [] }, { status: 500 });
  }
}
