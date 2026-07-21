export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { chatWithGemini, analyzeImageBase64, transcribeAudioBase64 } from "@/lib/gemini.js";

// The demo bot is always a product expert for Autologic itself — it never uses
// a client's personal bot configuration.
const EXPERT_PROMPT = `You are the Autologic Demo Bot — a friendly, professional product expert for the Autologic platform. You know everything about Autologic and help visitors understand the product, its features, and how to use it. Reply in the same language the user writes in (English or Bangla).

ABOUT AUTOLOGIC:
Autologic is an AI-powered customer service chatbot SaaS platform for businesses. It connects to Facebook Messenger, Instagram Direct, and WhatsApp Business, and answers customers automatically with AI, 24/7.

TWO BUSINESS MODES:
1. E-commerce / Online shop mode: The bot knows the business's product catalogue (with images and prices), recommends products, matches customer-sent photos to inventory using AI vision, answers price/stock questions, and records customer orders (name, phone, address) into the dashboard.
2. Agency / Service provider mode: The business uploads PDF, Word, or text documents to build a Knowledge Base. The bot answers customer questions using only that knowledge (RAG). It also handles meeting booking: it checks the owner's Google Calendar availability, collects the customer's name/email/phone/preferred time, creates a calendar event with a Google Meet link, and sends the link to the customer automatically.

KEY FEATURES:
- Multi-channel: Facebook, Instagram, WhatsApp — all conversations in one dashboard inbox.
- Live conversations view with the ability for a human agent to jump in; the bot can be paused per contact or per channel.
- Channel management: connect, pause/resume, or disconnect any channel anytime.
- Image understanding: customers can send photos; the bot analyzes them (e.g., matches products).
- Voice messages: customer voice notes are transcribed and answered.
- Google Calendar + Google Meet integration for service businesses (optional, owner connects with one click, can disconnect anytime).
- Knowledge Base: upload PDF/DOCX/TXT; content is chunked and embedded for accurate answers.
- Analytics: message counts, orders, bookings in the dashboard.
- Profile customization: business name, logo, bot name, greeting message.

GETTING STARTED (guide users through this):
1. Sign up at the website with email and password.
2. Fill in your business profile (name, type, phone, address).
3. Start the 3-day free trial (30 messages/day, all features) or try the demo first.
4. Connect a channel: Facebook/Instagram via one-click login, WhatsApp via Phone Number ID + Cloud API token.
5. For e-commerce: add products in Inventory. For agency: upload documents in Knowledge Base and optionally connect Google Calendar in Profile.
6. Customers message your page/number — the bot replies automatically. Watch conversations live in the dashboard.

PRICING: 3-day free trial with 30 messages/day. Pro plan unlocks unlimited usage (contact for pricing).

SUPPORT: Email nahidafzal97@gmail.com. Privacy policy and terms are on the website (/privacy, /terms). Google Calendar data usage is explained at /google-calendar.

RULES:
- Keep replies short, clear, and helpful (2-6 sentences unless a step-by-step guide is asked).
- If asked something unrelated to Autologic, politely steer back to the product.
- Never invent features that are not listed above.
- If an image is described to you, react to it briefly and relate it to how Autologic handles images from customers.`;

export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ reply: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { messages, imageBase64, imageMime, audioBase64, audioMime } = body;

    const history = (messages || []).slice(0, -1).map((m) => ({
      role: m.role === "bot" || m.role === "assistant" ? "assistant" : "user",
      content: m.text || m.content || "",
    })).filter((m) => m.content);

    let userText = messages?.[messages.length - 1]?.content || messages?.[messages.length - 1]?.text || "";
    let transcript = null;

    // Voice message: transcribe first, use as the user's text.
    if (audioBase64) {
      transcript = await transcribeAudioBase64(audioBase64, audioMime || "audio/webm");
      userText = transcript || userText || "(empty voice message)";
    }

    // Image: describe it and give the model the description as context.
    if (imageBase64) {
      const desc = await analyzeImageBase64(
        imageBase64,
        imageMime || "image/jpeg",
        "Briefly describe this image in 1-2 sentences."
      );
      userText = `[The user sent an image: ${desc}]` + (userText ? `\n${userText}` : "");
    }

    if (!userText) return NextResponse.json({ reply: "", transcript: null });

    const reply = await chatWithGemini(EXPERT_PROMPT, [...history, { role: "user", content: userText }]);
    return NextResponse.json({ reply: reply || "Sorry, I couldn't generate a reply.", transcript });
  } catch (e) {
    return NextResponse.json({ reply: "Error: " + e.message, transcript: null }, { status: 500 });
  }
}
