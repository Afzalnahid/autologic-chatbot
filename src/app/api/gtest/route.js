export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { chatWithGemini } from "@/lib/gemini.js";
export async function GET() {
  try {
    const r = await chatWithGemini("Reply ONLY [{\"type\":\"text_msg\",\"text\":\"hi\"}]", [{ role: "user", content: "Hi" }]);
    return NextResponse.json({ ok: true, raw: r });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message, stack: e.stack?.slice(0,300) });
  }
}
