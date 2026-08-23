export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit.js";
import { getClientAI } from "@/lib/ai.js";
import { supabase } from "@/lib/supabase.js";
import { composeProfile } from "@/lib/profile.js";

const META = `You are an expert prompt engineer for AI customer-service chatbots. From the business owner's answers, write ONLY the BUSINESS PROFILE section of a system prompt.

Use EXACTLY this structure with these headings:

IDENTITY & TONE:
(bot persona for this business, tone per the owner's choice, preferred languages, any brand rules they gave)

WHAT WE OFFER:
(products/services summary; include the catalog link behaviour if a link was given)

PRICING & POLICIES:
(delivery, payment, returns for shops; pricing overview and service area for agencies; working hours)

HOW TO HANDLE ORDERS OR BOOKINGS:
(behavioural guidance only — what to collect and confirm)

FREQUENTLY ASKED QUESTIONS:
(the owner's FAQs with answers, if provided)

BOUNDARIES:
(what the bot must not do or claim for this business)

STRICT RULES for you:
- Do NOT include any of these (the platform already enforces them): JSON/output format, markdown/list bans, language matching, greeting timing, image-match logic, product display format, price fallback logic, closing-line rule, source-of-truth rules, or order confirmation format.
- Use ONLY facts the owner actually gave you. Never invent prices, delivery charges, policies, services or claims.
- When a detail was NOT provided, do not guess and do not leave an empty heading. Instead write a short instruction telling the bot what to do, e.g. "Delivery charges were not provided — if a customer asks, say you will confirm with the team and ask for their location."
- The owner may write in Bangla, English or a mix. Understand it either way and always write the profile in clear English — the bot still replies to customers in their own language.
- Infer the business category from the description (jewelry, clothing, food, electronics, coaching, clinic, real estate, or anything else) and write guidance that fits that category naturally.
- Keep it compact and practical. No filler, no marketing language.
- Output ONLY the section text. No preamble, no markdown fences.`;

export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const rl = rateLimit(`generate-prompt:${client.id}`, 10, 3600000);
    if (!rl.ok) return tooManyRequests(rl.retryAfter, "You have generated several prompts recently. Please wait a few minutes before trying again.");
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
      // The interview asks a shop and an agency different things; every answer
      // it can collect is passed through, so a new question never silently
      // fails to reach the generated profile.
      const ECOM_FIELDS = [
        ["products", "Main products / categories"], ["delivery", "Delivery"],
        ["deliveryAreas", "Delivery areas"], ["payment", "Payment methods"],
        ["advancePay", "Advance payment rule"], ["returnPolicy", "Return/refund policy"],
        ["stock", "What to do when an item is out of stock"], ["warranty", "Warranty / guarantee"],
        ["complaints", "How to handle complaints or angry customers"],
      ];
      const AGENCY_FIELDS = [
        ["services", "Services offered"], ["pricing", "How pricing works"],
        ["process", "How we work with a client"], ["timeline", "Timeline / when results appear"],
        ["clients", "Who we work with"], ["contract", "Contract & payment terms"],
        ["objections", "Common objections and the owner's answers"],
        ["meetingInfo", "Meetings/booking info"],
      ];
      for (const [k, label] of (bt === "ecommerce" ? ECOM_FIELDS : AGENCY_FIELDS)) {
        if (answers[k]) L.push(`${label}: ${answers[k]}`);
      }
      if (answers.catalogLink) L.push(`Catalog/website link (bot should share this when the customer asks to see everything/full collection, without searching): ${answers.catalogLink}`);
      if (answers.special) L.push(`Special brand rules from the owner (e.g. how to address customers, banned words, brand phrases): ${answers.special}`);
      if (answers.faq) L.push(`FAQs from the owner:\n${answers.faq}`);
      // Things the owner taught after the initial interview — deliberate
      // corrections, so they outrank the earlier answers.
      const notes = (Array.isArray(answers.notes) ? answers.notes : [])
        .map((n) => String(n?.text || "").trim()).filter(Boolean);
      if (notes.length) L.push(`Later instructions from the owner (these override anything above that disagrees):\n${notes.map((n) => `- ${n}`).join("\n")}`);
      input = L.join("\n");
    } else {
      input = `Business type: ${bt}\nCatalog unit: ${unit}\nBusiness description:\n${description}`;
    }

    let prompt = "";
    let generated = false;
    if (body.mode !== "raw") {
      try {
        prompt = String(await (await getClientAI(client.id)).chat(META, [{ role: "user", content: input }])).replace(/```/g, "").trim();
        generated = Boolean(prompt);
      } catch (e) {
        console.error("[generate-prompt] AI failed, using composed profile:", e.message);
      }
    }
    if (!prompt) prompt = composeProfile(answers || { description }, bt);

    const { data: row } = await supabase
      .from("app_settings")
      .select("*")
      .eq("id", String(client.id))
      .maybeSingle();
    const merged = { ...(row?.settings || {}), businessPrompt: prompt, ...(answers ? { questionnaire: answers } : {}) };
    await supabase.from("app_settings").upsert({ id: String(client.id), settings: merged }, { onConflict: "id" });

    return NextResponse.json({ prompt, generated });
  } catch (e) {
    console.error("[generate-prompt]", e.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
