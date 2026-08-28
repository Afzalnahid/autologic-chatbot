export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit.js";
import { getClientAI } from "@/lib/ai.js";
import { visionPrompt } from "@/lib/products.js";
import { checkProductQuota } from "@/lib/plan-limits.js";

// Read a handful of product photos and propose what each one is, BEFORE
// anything is saved.
//
// The owner photographs fifteen t-shirts and wants fifteen products. Typing
// fifteen names, fifteen categories and fifteen descriptions is the reason they
// stop after four. This looks at each photo and fills the row in; the owner
// then corrects whatever is wrong and saves. Nothing here writes to the
// catalogue — the drafts come back to the browser and only /api/add-product
// creates a row.
//
// The AI cost is deliberately the same as before. Vision already ran on every
// new product, at save time; it now runs here instead, and the description it
// produces travels back with the draft and is posted to /api/add-product as
// `visual`, which skips the second call. One photo, one vision call, exactly as
// it was — plus a single cheap text call that names the whole batch at once
// rather than one call per photo.
//
// Nothing is stored. The photos are read straight from the bytes of the request
// and never reach the image bucket, because an owner who reads fifteen photos
// and then closes the sheet must not leave fifteen orphaned files behind. They
// are uploaded once, later, by whichever drafts they actually save.
//
// Photos arrive a few at a time because the platform rejects any request over
// ~4.5 MB at the edge; the browser sends them in chunks that fit.
const MAX_PER_CALL = 6;

export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const rl = rateLimit(`photo-draft:${client.id}`, 40, 3600000);
    if (!rl.ok) return tooManyRequests(rl.retryAfter, "You are reading photos very quickly. Please wait a moment.");

    const form = await request.formData();
    const files = form.getAll("images").filter((f) => f && typeof f !== "string").slice(0, MAX_PER_CALL);
    if (!files.length) return NextResponse.json({ error: "no photos" }, { status: 400 });

    // Checked before any AI call, so an owner who has no room left is told
    // plainly instead of being charged for descriptions they cannot use.
    const q = await checkProductQuota(client, files.length);
    if (!q.ok) return NextResponse.json({ error: q.message }, { status: 403 });

    const hint = String(form.get("hint") || "").trim().slice(0, 80);
    const known = String(form.get("categories") || "").split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 40);

    // The same prompt the bot uses on a customer's photo. It must stay
    // identical: both descriptions are embedded and compared, so any drift
    // here quietly breaks photo matching (docs/prompts.md).
    const prompt = visionPrompt(client.business_type || "ecommerce", client.item_label || "product");
    const ai = await getClientAI(client.id, "product");

    const drafts = [];
    for (const f of files) {
      try {
        const b64 = Buffer.from(await f.arrayBuffer()).toString("base64");
        const visual = await ai.visionB64(b64, f.type || "image/jpeg", prompt);
        drafts.push({ visual, error: null });
      } catch (e) {
        // One unreadable photo must not lose the other five: the row still
        // comes back, just without a description to name it from.
        drafts.push({ visual: "", error: e.message });
      }
    }

    const { items, error } = await nameThem(client, drafts, hint, known);
    return NextResponse.json({
      ok: true,
      drafts: drafts.map((d, i) => ({ ...d, ...(items[i] || {}) })),
      nameError: error || null,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// One text call turns every vision description in the batch into a short shop
// name, a category and a customer-facing sentence. Batched on purpose: the model
// can see that it is looking at fifteen variations of one shirt and number them
// consistently, which it cannot do when asked about each photo alone.
async function nameThem(client, drafts, hint, known) {
  const usable = drafts.map((d, i) => ({ i, visual: d.visual })).filter((d) => d.visual);
  if (!usable.length) return { items: [], error: null };

  const system = `You catalogue products for a ${client.business_type === "agency" ? "service business" : "shop"} in Bangladesh. You are given technical descriptions of photographs. For each one, propose how it should be listed.

Rules:
- "name" is a short shop name a customer would recognise, 2 to 6 words. Never a sentence, never the technical description.
- "category" groups similar items. Reuse one of the shop's existing categories when it fits; only invent one when none does.
- "description" is one plain sentence a customer reads. No marketing adjectives, no invented facts: only what the photo actually shows.
- Never invent a price, a size, a fabric weight or a brand that is not described.
- Write in English. The shop translates for its own customers.
${hint ? `
THESE ARE ALL ${hint.toUpperCase()}. That is the kind of thing they are, and it is already known — so the name must carry what makes THIS one different from the others: the print, the graphic, the colour, the pattern, the wording on it. Write it as "${hint} — <what is different>", for example "${hint} — cream with circular back print" or "${hint} — olive with small chest logo".

NEVER number them. "${hint} 1", "${hint} 2" tells a customer nothing and tells the bot nothing: someone asking for "the one with the flowers" cannot be matched to a number. If two photographs genuinely look the same, say so in the difference rather than falling back on a count.
` : ""}
Answer with JSON only: {"items":[{"n":<the photo number>,"name":"...","category":"...","description":"..."}]}`;

  const lines = usable.map((d) => `Photo ${d.i + 1}: ${String(d.visual).slice(0, 900)}`).join("\n\n");
  const ask = [
    known.length ? `The shop's existing categories: ${known.join(", ")}.` : "",
    lines,
  ].filter(Boolean).join("\n\n");

  try {
    const ai = await getClientAI(client.id, "product.catalog");
    const raw = await ai.chat(system, [{ role: "user", content: ask }]);
    const items = [];
    for (const it of parseItems(raw)) {
      const n = Number(it?.n);
      if (!Number.isFinite(n) || n < 1 || n > drafts.length) continue;
      items[n - 1] = {
        product_name: String(it.name || "").trim().slice(0, 120),
        category: String(it.category || "").trim().slice(0, 80),
        description: String(it.description || "").trim().slice(0, 400),
      };
    }
    return { items, error: null };
  } catch (e) {
    // The photos were still read and the rows still exist. The owner types the
    // names themselves — worse than it should be, not broken.
    return { items: [], error: e.message };
  }
}

// Models wrap JSON in ```json fences often enough that not handling it is a bug
// waiting for a bad day.
function parseItems(raw) {
  const text = String(raw || "").replace(/^```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  try {
    const j = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(j?.items) ? j.items : [];
  } catch { return []; }
}
