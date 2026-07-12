export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { chatWithGemini, generateEmbedding } from "@/lib/gemini.js";
export async function GET() {
  const out = {};
  try {
    out.chat = await chatWithGemini("Reply with OK only.", [{ role: "user", content: "test" }]);
  } catch (e) { out.chatError = e.message; }
  try {
    const emb = await generateEmbedding("test");
    out.embedDims = emb.length;
  } catch (e) { out.embedError = e.message; }
  return NextResponse.json(out);
}
