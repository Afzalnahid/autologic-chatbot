export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { chatWithGemini } from "@/lib/gemini.js";
export async function GET() {
  try {
    const r = await chatWithGemini("Reply with the word OK only.", [{ role: "user", content: "test" }]);
    return NextResponse.json({ ok: true, raw: r });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message });
  }
}
