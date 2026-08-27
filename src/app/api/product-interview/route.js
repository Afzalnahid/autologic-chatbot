export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit.js";
import { getClientAI } from "@/lib/ai.js";
import { normalizeSet, draftGaps, LABELS, ASK_ORDER } from "@/lib/inventory-actions.js";

// Adding one product by being asked about it.
//
// The drawer is a form: fourteen boxes, and the owner has to know which of them
// matter. This is the same product built the other way round — the assistant
// asks for one thing, the owner answers in a sentence, and the answer lands in
// the right box. It is the difference between filling in a form and being
// served by someone who knows the questions.
//
// The state is NOT the model's memory. The draft is a real object that travels
// with every turn, is re-cleaned through the whitelist on arrival, and comes
// back so the browser can show it. A model that forgets what it was told, or
// invents a price it was never given, cannot corrupt it: only the whitelist
// writes to the draft, and only the gaps the server computes decide whether the
// product may be saved. The model's own "I think we are done" is an opinion.
//
// Nothing here writes to the catalogue. The finished draft is saved by
// /api/add-product, the same route the drawer uses, with the photos the browser
// has been holding all along.
export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const rl = rateLimit(`prod-interview:${client.id}`, 150, 3600000);
    if (!rl.ok) return tooManyRequests(rl.retryAfter, "You are answering very quickly. Please wait a moment.");

    const body = await request.json().catch(() => ({}));
    const messages = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m) => m && typeof m.content === "string" && m.content.trim())
      .slice(-20)
      .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content).slice(0, 2000) }));

    // The draft is re-cleaned even though the browser sent it back to us: a
    // field can only ever have got in through this whitelist, and it must not
    // be possible to widen that by editing what the page posts.
    const draft = normalizeSet(body.draft);
    const photos = Math.max(0, Math.min(12, Number(body.photos) || 0));
    // What the AI read off the first photo. Kept out of the conversation and
    // out of the draft — it is search text, not something the owner types.
    const visual = String(body.visual || "").slice(0, 4000);

    const gaps = draftGaps(draft, photos);
    const ai = await getClientAI(client.id, "product.interview");
    const raw = await ai.chat(prompt(client, draft, photos, visual, gaps), messages.length ? messages : [{ role: "user", content: "Let's add a product." }]);
    const out = parse(raw);

    const merged = { ...draft, ...normalizeSet(out.set) };
    const after = draftGaps(merged, photos);
    return NextResponse.json({
      ok: true,
      reply: out.reply || "What else should I know about it?",
      draft: merged,
      gaps: after,
      // The model may say it is finished; it is only true if the product can
      // actually be sold.
      done: after.ready && (out.done === true || after.wanted.length === 0),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

const known = (draft) => {
  const lines = Object.entries(draft)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `- ${LABELS[k] || k}: ${k === "options" ? v.map((o) => `${o.name} (${o.values.join(", ")})`).join("; ") : Array.isArray(v) ? v.join(", ") : v}`);
  return lines.length ? lines.join("\n") : "- nothing yet";
};

function prompt(client, draft, photos, visual, gaps) {
  const shop = client.business_type === "agency" ? "service business" : "shop";
  const thing = client.item_label || (client.business_type === "agency" ? "service" : "product");
  // The order to work through: what blocks the save, then what the shop should
  // have, then the rest. Naming it explicitly is what stops the model asking
  // for a brand before it has asked for a price.
  const queue = [...gaps.blocking, ...gaps.wanted, ...gaps.rest].map((k) => LABELS[k] || k);

  return `You are helping the owner of a ${shop} in Bangladesh add ONE ${thing} to their catalogue, by asking them about it. Their business is "${client.business_name || "this business"}".

HOW TO ASK
- One question per message. Never a list of questions, never a form.
- Short and plain. The owner is not a programmer and does not know the field names.
- Take whatever they give you, even if it answers three questions at once, and put it in the right places.
- If an answer is unclear, ask again about that one thing rather than guessing.
- Reply in the language the owner is writing in. If they write Bangla, answer in Bangla.
- Never say the ${thing} has been saved or added. You are only collecting; the owner presses a button at the end.

WHAT IS ALREADY KNOWN
${known(draft)}
- Photos attached: ${photos}${visual ? `\n- What the AI sees in the first photo (do NOT read this back to the owner word for word; use it to suggest a name or category): ${visual.slice(0, 700)}` : ""}

WHAT IS STILL MISSING, in the order to ask for it
${queue.length ? queue.map((q, i) => `${i + 1}. ${q}`).join("\n") : "Nothing — everything has been answered."}
${gaps.blocking.length ? `\nThe ${thing} CANNOT be saved until these are given: ${gaps.blocking.map((k) => LABELS[k]).join(", ")}. Ask for the first of them now.` : `\nEverything required is there. Ask about anything still missing above, and when the owner has nothing more to add, tell them they can press Save.`}
${photos === 0 ? `\nThere are no photos yet. Ask the owner to attach some with the photo button beside the message box — one ${thing} can have several pictures, and the first one is the one customers see. Without a photo the bot cannot recognise this ${thing} when a customer sends a picture.` : ""}

RULES
- Never invent a price, a stock count, a size or a brand. If it was not said, it is not known.
- Prices are in taka: digits only, no symbol, no commas.
- "options" is what a customer chooses between, e.g. [{"name":"Size","values":["S","M","L"]},{"name":"Colour","values":["Black"]}].
- You may only fill these fields: ${ASK_ORDER.filter((k) => k !== "photo").join(", ")}. Photos are attached by the owner, not by you.
- Set "done" to true only when the owner has said they have nothing more to add.

ANSWER FORMAT
JSON only, nothing before or after:
{"reply":"your one question or reply to the owner","set":{"product_name":"..."},"done":false}
Use "set":{} when the owner told you nothing new.`;
}

// A model that answers in plain prose has still asked a useful question; its
// words become the reply and nothing is filled in. Fences are stripped because
// they turn up often enough that not handling them is a bug waiting for a bad
// day.
function parse(raw) {
  const text = String(raw || "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const j = JSON.parse(text.slice(start, end + 1));
      if (j && typeof j === "object") return { reply: String(j.reply || "").trim(), set: j.set, done: j.done === true };
    } catch {}
  }
  return { reply: text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim(), set: {}, done: false };
}
