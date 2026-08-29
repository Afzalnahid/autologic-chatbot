export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit.js";
import { getClientAI } from "@/lib/ai.js";
import { normalizeSet, draftGaps, LABELS, ASK_ORDER, exampleFor } from "@/lib/inventory-actions.js";
import { findDuplicate } from "@/lib/duplicates.js";
import { supabase } from "@/lib/supabase.js";

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
    const lang = body.lang === "bn" ? "bn" : "en";

    // The shop's own categories, so the category question offers them rather
    // than asking the owner to remember what they called things.
    const { data: rows } = await supabase.from("products")
      .select("metadata").eq("client_id", client.id).limit(1000);
    const cats = [...new Set((rows || []).map((r) => String(r.metadata?.category || "").trim()).filter(Boolean))].slice(0, 30);

    // A name already in the catalogue, checked BEFORE the model is asked — so
    // it can ask what makes this one different in the same breath, instead of
    // the owner being stopped and told a fact they already knew.
    const already = draft.product_name
      ? await findDuplicate(client.id, { name: draft.product_name, code: draft.product_code })
      : null;

    const ai = await getClientAI(client.id, "product.interview");
    const raw = await ai.chat(
      prompt(client, draft, photos, visual, gaps, { lang, cats, clash: already?.product_name || "" }),
      messages.length ? messages : [{ role: "user", content: "Let's add a product." }],
    );
    const out = parse(raw);

    const merged = { ...draft, ...normalizeSet(out.set) };
    const after = draftGaps(merged, photos);

    // Checked again on the merged draft, because the name may have only just
    // been given. This is what the panel shows and what the NEXT turn's prompt
    // turns into "what makes this one different".
    const clash = merged.product_name
      ? await findDuplicate(client.id, { name: merged.product_name, code: merged.product_code })
      : null;

    return NextResponse.json({
      ok: true,
      reply: out.reply || "What else should I know about it?",
      draft: merged,
      gaps: after,
      // The name matches something already here. NOT an error and not a refusal
      // — a shop with fifteen box t-shirts calls all of them box t-shirts. The
      // panel says so in the owner's own language and the next turn asks what
      // makes this one different.
      duplicate: clash,
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

// `cats`, not `known`. It used to be `known`, which is also the name of the
// function two lines above that prints what the draft already holds — so the
// parameter shadowed it and `${known(draft)}` called an array. Every turn of
// every interview threw, and nothing here could catch it locally, because the
// route needs a database and an AI key to reach that line at all.
function prompt(client, draft, photos, visual, gaps, { lang = "en", cats = [], clash = "" } = {}) {
  const shop = client.business_type === "agency" ? "service business" : "shop";
  const thing = client.item_label || (client.business_type === "agency" ? "service" : "product");
  // The order to work through, and it is ONE list, in the order a person would
  // say it out loud: what it is, where it belongs, what it costs, what it is
  // like, what a customer picks between, then the photos.
  //
  // It used to be three lists stitched together — what blocks the save first,
  // then what the shop should have, then the rest — which sorted the questions
  // by how much they matter. That is not the same question as what to ask next,
  // and it is why the assistant demanded a photograph before it had asked what
  // the thing was like.
  //
  // Every line carries a real answer, not a description of one. Nobody should
  // have to guess what shape of answer a question wants.
  const queue = gaps.queue.map((k) => {
    const eg = exampleFor(k, lang);
    return `${LABELS[k] || k}${eg ? ` — an answer looks like: ${eg}` : ""}`;
  });

  return `You are helping the owner of a ${shop} in Bangladesh add ONE ${thing} to their catalogue, by asking them about it. Their business is "${client.business_name || "this business"}".

HOW TO ASK
- One question per message. Never a list of questions, never a form.
- Short and plain. The owner is not a programmer and does not know the field names.
- EVERY question carries an example of the answer, in brackets at the end. Not a description of the answer — an actual one. Use the example printed beside that question in the list below, word for word. "What is it called? (for example: Box T-shirt — green seed print)". "What does it cost? (for example: 500)". Somebody who has never done this before should never have to guess what shape of answer you want.
- Take whatever they give you, even if it answers three questions at once, and put it in the right places.
- If an answer is unclear, ask again about that one thing rather than guessing.
- ${lang === "bn" ? "Write EVERY message in Bangla. The owner has set this dashboard to Bangla. Keep product names, codes and numbers as they typed them." : "Write every message in English unless the owner writes to you in another language, in which case answer in theirs."}
- Never say the ${thing} has been saved or added. You are only collecting; the owner presses a button at the end.
- You are adding ONE ${thing} here. If the owner says they have many to add, or mentions a spreadsheet, a CSV, a product link or a WooCommerce shop, stop asking and tell them the buttons under the message box do that in one go — "Many photos", "A spreadsheet", "A product link", "WooCommerce" — and say which one fits. Answering forty questions one at a time is not what they want.

WHAT IS ALREADY KNOWN
${known(draft)}
- Photos attached: ${photos}${visual ? `\n- What the AI sees in the first photo (do NOT read this back to the owner word for word; use it to suggest a name or category): ${visual.slice(0, 700)}` : ""}

WHAT IS STILL MISSING, in the order to ask for it. Ask for number 1 now — not number 3, not two of them at once.
${queue.length ? queue.map((q, i) => `${i + 1}. ${q}`).join("\n") : "Nothing — everything has been answered."}
${gaps.blocking.length
  ? `\nThe ${thing} cannot be SAVED until ${gaps.blocking.map((k) => LABELS[k]).join(", ")} ${gaps.blocking.length > 1 ? "are" : "is"} given — but that is about saving, not about what to ask next. Keep to the order above; the owner will be shown what is still needed.`
  : `\nEverything required is there. Ask about anything still missing above, and when the owner has nothing more to add, tell them they can press Save.`}
${gaps.queue[0] === "photo" ? `\nPhotos are the next thing to ask for. Say to use the photo button beside the message box, that one ${thing} can have several pictures — a front, a back, a close-up — that they can attach them all at once, and that the first one is what customers see.` : ""}

RULES
- Never invent a price, a stock count, a size or a brand. If it was not said, it is not known.
- Prices are in taka: digits only, no symbol, no commas.
- CATEGORY is its own question, asked straight after the name, and it is asked with the shop's own categories offered: ${cats.length ? cats.join(", ") : "they have none yet, so ask what to call the first one"}. Ask which of those it belongs in, or what to call a new one.
- ONE ${thing} CAN HAVE SEVERAL PHOTOS — a front, a back, a close-up. When you ask for photos, say so, and say they can attach them all at once.
- "options" is what a customer chooses between, e.g. [{"name":"Size","values":["S","M","L"]},{"name":"Colour","values":["Black"]}]. Ask whether customers pick between anything, and give the example that fits what you can see.
- Nothing here is compulsory except what blocks the save. If the owner says "no", "none" or "skip" to a question, accept it and move to the next one. Asking twice for a description a shop does not write is how a five-question job becomes a chore.
${clash ? `
THIS NAME IS ALREADY IN THE CATALOGUE. The owner has a ${thing} called "${clash}". They are almost certainly adding ANOTHER one of the same kind, not repeating themselves — a shop with fifteen box t-shirts calls all of them box t-shirts.

Do NOT tell them it is a duplicate and stop. Ask what makes THIS one different — the print, the colour, the pattern, the wording on it — and then set product_name to "${clash} — <that difference>". A customer asking for "the one with the flowers" can be matched to that; two products with the same name cannot be told apart at all.
` : ""}
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
