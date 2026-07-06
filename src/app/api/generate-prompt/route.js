export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { chatWithGemini } from "@/lib/gemini.js";

const META = `You are an expert prompt engineer for AI sales chatbots. A business owner will describe their business. Write a complete, production-ready system prompt for their customer service sales bot.

The generated prompt MUST include:
- Role and brand identity
- Tone and language rules (match customer language, Bangla/English/Banglish)
- A strict output format: reply ONLY with a JSON array of objects like {"type":"text_msg","text":"..."} or {"type":"image_msg","url":"..."}
- Greeting rules
- Product handling: use the injected PRODUCT SEARCH RESULTS as the only source of truth, never invent prices or codes
- How to show products (image_msg then text_msg with name, code, price)
- Delivery, payment and return policy placeholders the owner can edit
- Order confirmation flow
Output ONLY the final system prompt text, no preamble, no markdown fences.`;

export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { description } = await request.json();
    if (!description) return NextResponse.json({ error: "description required" }, { status: 400 });
    const prompt = await chatWithGemini(META, [{ role: "user", content: `Business description:\n${description}` }]);
    return NextResponse.json({ prompt: String(prompt).replace(/```/g, "").trim() });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
