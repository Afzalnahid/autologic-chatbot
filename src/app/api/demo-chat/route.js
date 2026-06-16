import { NextResponse } from "next/server";
import { chatWithGemini, generateEmbedding } from "@/lib/gemini.js";
import { matchDocuments } from "@/lib/supabase.js";

export async function POST(request) {
  try {
    const { messages, systemPrompt } = await request.json();
    const lastMsg = messages[messages.length - 1]?.content || "";

    let searchContext = "";
    if (lastMsg.match(/(product|ring|necklace|show|price|দেখাও|দাম|EV\s*\d+)/i)) {
      try {
        const embedding = await generateEmbedding(lastMsg);
        const matches = await matchDocuments(embedding, 3);
        if (matches.length > 0) {
          searchContext = "\n\nPRODUCT DATABASE RESULTS:\n" +
            matches.map((m, i) => `${i + 1}. ${m.metadata?.product_name} (${m.metadata?.product_code}) - ${m.metadata?.sale_price || m.metadata?.regular_price || "N/A"} BDT`).join("\n");
        }
      } catch {}
    }

    const augmented = [...messages];
    if (searchContext) {
      augmented[augmented.length - 1] = { ...augmented[augmented.length - 1], content: lastMsg + searchContext };
    }

    const reply = await chatWithGemini(systemPrompt || "You are a helpful business assistant.", augmented);
    return NextResponse.json({ reply });
  } catch (e) {
    return NextResponse.json({ reply: "Sorry, something went wrong." }, { status: 500 });
  }
}
