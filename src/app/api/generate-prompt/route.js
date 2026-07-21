export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { chatWithGemini } from "@/lib/gemini.js";
import { supabase } from "@/lib/supabase.js";

// Hybrid generation: the AI writes ONLY the business profile section, inside a
// fixed structure. Core output/format rules live in code (bot.js FIXED_CORE)
// and are never part of what clients can edit.
const META = `You are an expert prompt engineer for AI customer-service chatbots. From the business owner's answers, write ONLY the BUSINESS PROFILE section of a system prompt.

Use EXACTLY this structure with these headings:

IDENTITY & TONE:
(bot persona for this business, tone per the owner's choice, preferred languages)

WHAT WE OFFER:
(products/services summary)

PRICING & POLICIES:
(delivery, payment, returns for shops; pricing overview and service area for agencies; working hours)

HOW TO HANDLE ORDERS OR BOOKINGS:
(behavioral guidance only, e.g. what to collect and confirm; for shops: guide to order; for agencies: guide to book a meeting)

FREQUENTLY ASKED QUESTIONS:
(the owner's FAQs with answers, if provided)

BOUNDARIES:
(what the bot must not do or claim for this business)

STRICT RULES for you:
- Do NOT include any JSON/output-format instructions, language-matching rules, or "source of truth" rules — the platform enforces those separately.
- Only use facts from the owner's answers. Do not invent prices, policies or services.
- Write in clear English (the bot itself will still reply to customers in their language).
- Output ONLY the section text. No preamble, no markdown fences.`;

export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const body = await request.json();
    const { answers, description } = body;
    if (!answers && !description) return NextResponse.json({ error: "answers required" }, { status: 400 });

    const bt = client.business_type || "ecommerce";
    const unit = client.item_label || (bt === "ecommerce" ? "product" : "service");

    let input;
    if (answers) {
      const L = [];
      L.push(`Business type: ${bt === "agency" ? "Agency / Service provider" : "E-commerce / Online shop"}`);
      L.push(`Catalog unit: ${unit}`);
      if (answers.description) L.push(`About the business: ${answers.description}`);
      if (answers.tone) L.push(`Bot tone: ${answers.tone}`);
      if (answers.languages) L.push(`Customer languages: ${answers.languages}`);
      if (answers.hours) L.push(`Working hours: ${answers.hours}`);
      if (bt === "ecommerce") {
        if (answers.delivery) L.push(`Delivery: ${answers.delivery}`);
        if (answers.payment) L.push(`Payment methods: ${answers.payment}`);
        if (answers.returnPolicy) L.push(`Return/refund policy: ${answers.returnPolicy}`);
      } else {
        if (answers.services) L.push(`Services offered: ${answers.services}`);
        if (answers.meetingInfo) L.push(`Meetings/booking info: ${answers.meetingInfo}`);
      }
      if (answers.faq) L.push(`FAQs from the owner:\n${answers.faq}`);
      input = L.join("\n");
    } else {
      input = `Business type: ${bt}\nCatalog unit: ${unit}\nBusiness description:\n${description}`;
    }

    const prompt = String(await chatWithGemini(META, [{ role: "user", content: input }])).replace(/```/g, "").trim();

    // Persist server-side: merge businessPrompt + questionnaire into settings.
    const { data: rows } = await supabase.from("app_settings").select("*");
    const row = (rows || []).find(r => r.id === String(client.id));
    const merged = { ...(row?.settings || {}), businessPrompt: prompt, ...(answers ? { questionnaire: answers } : {}) };
    await supabase.from("app_settings").upsert({ id: String(client.id), settings: merged }, { onConflict: "id" });

    return NextResponse.json({ prompt });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
