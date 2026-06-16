import { NextResponse } from "next/server";
import { parseMessengerEvent, sendTypingOn, sendResponses, sendTextMessage } from "@/lib/messenger.js";
import { analyzeImage, chatWithGemini, generateEmbedding } from "@/lib/gemini.js";
import { insertMessageBuffer, markMessagesReplied, getPendingMessages, getChatMemory, saveChatMemory, matchDocuments } from "@/lib/supabase.js";

const VERIFY_TOKEN = process.env.FACEBOOK_VERIFY_TOKEN;

const SYSTEM_PROMPT = `Role: You are a professional, direct sales executive for the premium jewelry brand "Evalora".
Core Goal: Identify products using tools and provide short, accurate responses.

BUSINESS: Evalora - premium quality jewelry shop. Online only.
TONE: Professional, polite. Say "we" for business. Address customer as "আপনি".
GREETING: Never use "নমস্কার". Match customer language. First message: "হ্যালো" or "হাই". Ongoing: skip greeting.
FORBIDDEN: No markdown images. No bullet lists. No image URLs in text. Keep short.

OUTPUT: Return ONLY a JSON array. No intro or outro text.

WHEN CUSTOMER SENDS IMAGE:
- You receive "IDENTIFIED PRODUCTS:" with descriptions under "--- PRODUCT X ---"
- For EACH product section, I will provide the vector search results
- Pick the SINGLE BEST match per image
- Show that many products (1 image = 1 product, 3 images = 3 products)

WHEN CUSTOMER GIVES PRODUCT CODE (EV 101, etc):
- Search results provided. Show the ONE match.

WHEN CUSTOMER DESCRIBES IN TEXT:
- Search results provided. Show top 2 relevant.

PRODUCT DISPLAY:
1. If image_url is valid http: {"type": "image_msg", "url": "[image_url]"}
2. Always: {"type": "text_msg", "text": "Product: [name]\\nCode: [code]\\nPrice: [PRICE] BDT"}
3. Price: sale_price if exists, else regular_price, else "যোগাযোগ করুন"
4. End with ONE Bangla closing line under 10 words.

DELIVERY: Dhaka: ৳80 (1-2 days). Outside: ৳130 (2-3 days). COD or Bkash/Nagad.
MATERIAL: Copper + Zircon. Rings: Adjustable. Couple rings: set only.
Ring Box: ৳250 only | ৳200 with ring. Prices FIXED.
ORDER: Ask Full Name, Phone, Address. Confirm with image.

Be a boss sales executive. Never sound like a bot.`;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request) {
  const body = await request.json();
  const event = parseMessengerEvent(body);
  if (!event) return NextResponse.json({ status: "ignored" });

  const { senderId, text, images, audio } = event;

  try {
    await sendTypingOn(senderId);

    let messageContent = text;

    if (images.length > 0) {
      const descriptions = [];
      for (let i = 0; i < images.length; i++) {
        try {
          const desc = await analyzeImage(images[i],
            "Describe this jewelry product in detail: material, stones, design, color, style. Be specific for product matching."
          );
          descriptions.push(desc);
        } catch {
          descriptions.push("Could not analyze image");
        }
      }
      const identifiedBlock = "IDENTIFIED PRODUCTS:\n\n" +
        descriptions.map((d, i) => `--- PRODUCT ${i + 1} ---\n${d}\n`).join("\n");
      messageContent = (text ? text + "\n\n" : "") + identifiedBlock;
    }

    await insertMessageBuffer(senderId, messageContent);

    const pending = await getPendingMessages(senderId);
    const hasNull = pending.some(m => !m.message_content || m.message_content.trim() === "" || m.message_content.trim().toLowerCase() === "null");
    if (hasNull) return NextResponse.json({ status: "waiting_for_content" });

    const combinedPrompt = pending.map(m => m.message_content).join("\n");
    const memory = await getChatMemory(senderId, 10);
    const chatHistory = memory.map(m => m.message);

    let searchContext = "";
    const needsSearch = combinedPrompt.includes("IDENTIFIED PRODUCTS:") ||
      combinedPrompt.match(/EV\s*\d+/i) ||
      combinedPrompt.match(/(ring|necklace|bracelet|pendant|earring|couple|chain)/i) ||
      combinedPrompt.match(/(দেখাও|দাম|price|কত|show|product)/i);

    if (needsSearch) {
      try {
        const searchQuery = combinedPrompt.includes("IDENTIFIED PRODUCTS:")
          ? combinedPrompt.match(/--- PRODUCT 1 ---\n([\s\S]*?)(?=\n---|$)/)?.[1]?.trim() || combinedPrompt
          : combinedPrompt;
        const embedding = await generateEmbedding(searchQuery.substring(0, 500));
        const matches = await matchDocuments(embedding, 3);
        if (matches.length > 0) {
          searchContext = "\n\nSUPABASE VECTOR STORE RESULTS:\n" +
            matches.map((m, i) => `Result ${i + 1}:\n- content: ${m.content}\n- metadata: ${JSON.stringify(m.metadata)}\n- similarity: ${m.similarity}`).join("\n\n");
        }
      } catch (e) {
        console.error("Vector search failed:", e.message);
      }
    }

    const messages = [
      ...chatHistory.map(m => ({ role: m.role, content: m.content })),
      { role: "user", content: combinedPrompt + searchContext },
    ];

    const aiResponse = await chatWithGemini(SYSTEM_PROMPT, messages);

    await saveChatMemory(senderId, { role: "user", content: combinedPrompt });
    await saveChatMemory(senderId, { role: "assistant", content: aiResponse });

    let parsed;
    try {
      const cleaned = aiResponse.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      await sendTextMessage(senderId, aiResponse);
      await markMessagesReplied(senderId);
      return NextResponse.json({ status: "sent_text" });
    }

    if (Array.isArray(parsed)) {
      await sendResponses(senderId, parsed);
    } else {
      await sendTextMessage(senderId, aiResponse);
    }

    await markMessagesReplied(senderId);
  } catch (e) {
    console.error("Messenger handler error:", e);
    await sendTextMessage(senderId, "Sorry, something went wrong. Please try again.");
  }

  return NextResponse.json({ status: "ok" });
}
