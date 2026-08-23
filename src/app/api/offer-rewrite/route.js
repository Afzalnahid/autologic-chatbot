export const dynamic = "force-dynamic";
export const maxDuration = 30;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit.js";
import { getClientAI } from "@/lib/ai.js";

// Takes the owner's rough offer (title, details, selected products) and asks
// the AI to rewrite it as one clean, organised offer the bot can quote. The
// owner's language is preserved — Bangla stays Bangla, English stays English.
const META = `You tidy promotional offers for an online business's customer-service chatbot.
The owner wrote an offer roughly; rewrite it clearly and completely.

Rules:
- Keep the SAME language(s) the owner used (Bangla stays Bangla, English stays English, mixed stays mixed).
- Keep every fact: prices, quantities, conditions, dates, product names. NEVER invent new discounts, prices or conditions.
- "title": one short, punchy line a customer instantly understands (max ~60 characters).
- "details": 1-2 short sentences with the conditions and what's included. If a product list is given, weave the product names in naturally.
- No markdown, no emojis, no quotes inside values.
- Reply with ONLY this JSON, nothing else: {"title":"...","details":"..."}`;

export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const rl = rateLimit(`offer-rewrite:${client.id}`, 20, 3600000);
    if (!rl.ok) return tooManyRequests(rl.retryAfter, "You have organised several offers recently. Please wait a few minutes.");

    const { title = "", details = "", products = [] } = await request.json();
    const raw = [String(title).trim(), String(details).trim()].filter(Boolean).join("\n");
    if (!raw) return NextResponse.json({ error: "Write the offer first, then organise it." }, { status: 400 });

    const prodLine = Array.isArray(products) && products.length
      ? "\nProducts in this offer: " + products.map((p) => [String(p.name || "").trim(), p.code ? `(${p.code})` : "", p.price ? `- ${p.price}tk` : ""].filter(Boolean).join(" ")).join(", ")
      : "";

    const out = String(await (await getClientAI(client.id)).chat(META, [{ role: "user", content: raw + prodLine }]))
      .replace(/```json|```/g, "").trim();
    const m = out.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ error: "Could not organise the offer — please try again." }, { status: 502 });
    const parsed = JSON.parse(m[0]);
    if (!parsed.title && !parsed.details) return NextResponse.json({ error: "Could not organise the offer — please try again." }, { status: 502 });
    return NextResponse.json({ title: String(parsed.title || title), details: String(parsed.details || details) });
  } catch (e) {
    console.error("[offer-rewrite]", e.message);
    return NextResponse.json({ error: "Could not organise the offer — please try again." }, { status: 500 });
  }
}
