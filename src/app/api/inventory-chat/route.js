export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit.js";
import { supabase } from "@/lib/supabase.js";
import { getClientAI } from "@/lib/ai.js";
import { FIELDS, normalizeActions } from "@/lib/inventory-actions.js";

// The inventory assistant, half one: it answers questions about the catalogue
// and PROPOSES changes. It never makes one.
//
// That split is the whole design. An assistant that can quietly edit a shop's
// prices is a liability — a misheard sentence becomes a wrong price a customer
// is then quoted, and the owner finds out from the customer. So this route only
// ever returns words and a list of proposals; /api/inventory-apply carries them
// out, and only after the owner has looked at each one and pressed the button.
//
// The model is also given no way to reach the database. It answers with JSON
// naming a product id and a few whitelisted fields; anything outside that list
// (photos, a variant's own price, another shop's product) cannot be expressed,
// let alone applied.

// How much of the catalogue the model is shown. A shop with two thousand
// products cannot be sent whole, so the rows most likely to be the subject are
// picked and the model is told plainly how many it is NOT seeing — a model that
// thinks it has seen everything will happily say "you have no red shirts".
const CONTEXT_ROWS = 120;

export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const rl = rateLimit(`inv-chat:${client.id}`, 80, 3600000);
    if (!rl.ok) return tooManyRequests(rl.retryAfter, "You are asking very quickly. Please wait a moment.");

    const body = await request.json().catch(() => ({}));
    const messages = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m) => m && typeof m.content === "string" && m.content.trim())
      .slice(-14)
      .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content).slice(0, 4000) }));
    if (!messages.length) return NextResponse.json({ error: "nothing to answer" }, { status: 400 });

    const { data: rows } = await supabase.from("products")
      .select("id,metadata,created_at").eq("client_id", client.id)
      .order("created_at", { ascending: false }).limit(1000);
    const all = (rows || []).map((r) => ({ id: r.id, ...(r.metadata || {}) }));

    const last = messages[messages.length - 1].content;
    const shown = pick(all, last, CONTEXT_ROWS);
    const hidden = all.length - shown.length;

    const ai = await getClientAI(client.id, "product.assistant");
    const raw = await ai.chat(systemPrompt(client, all, shown, hidden), messages);
    const parsed = parse(raw);

    // Only proposals about products this shop owns survive. The model has no
    // way to learn another client's id, but "cannot happen" is not a filter.
    const owned = new Set(all.map((p) => String(p.id)));
    const actions = normalizeActions(parsed.actions).filter((a) => a.do === "create" || owned.has(String(a.id)));

    return NextResponse.json({
      ok: true,
      reply: parsed.reply || "I could not put that into words. Try asking it a different way.",
      actions,
      // The panel reads each product as it stands now, to show "450 → 500"
      // rather than just "500".
      before: Object.fromEntries(actions.filter((a) => a.id).map((a) => [a.id, all.find((p) => String(p.id) === String(a.id)) || null])),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// The rows most likely to be what the owner just talked about: anything whose
// name, code or category shares a word with the message, then the newest.
function pick(all, question, limit) {
  const words = String(question).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [];
  if (!words.length) return all.slice(0, limit);
  const score = (p) => {
    const hay = `${p.product_name || ""} ${p.product_code || ""} ${p.category || ""} ${p.brand || ""} ${(p.tags || []).join(" ")}`.toLowerCase();
    return words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0);
  };
  const hits = all.map((p) => ({ p, s: score(p) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.p);
  const rest = all.filter((p) => !hits.includes(p));
  return [...hits, ...rest].slice(0, limit);
}

// One product, as few characters as will still identify it.
const line = (p) => [
  `id=${p.id}`,
  `name=${p.product_name || "(unnamed)"}`,
  p.product_code ? `code=${p.product_code}` : "",
  p.category ? `category=${p.category}` : "",
  p.regular_price ? `price=${p.regular_price}` : "price=(none)",
  p.sale_price ? `sale=${p.sale_price}` : "",
  `stock=${p.stock_qty ?? "?"}${p.stock_status === "outofstock" ? " (out of stock)" : ""}`,
  p.options?.length ? `options=${p.options.map((o) => `${o.name}:${(o.values || []).join("/")}`).join("; ")}` : "",
  p.variants?.length ? `variants=${p.variants.length}` : "",
].filter(Boolean).join(" | ");

function systemPrompt(client, all, shown, hidden) {
  const inStock = all.filter((p) => p.stock_status !== "outofstock").length;
  return `You help the owner of a ${client.business_type === "agency" ? "service business" : "shop"} in Bangladesh look after their catalogue, by conversation. Their business is "${client.business_name || "this business"}".

WHAT YOU CAN DO
- Answer questions about the catalogue from the list below.
- PROPOSE changes. You never make a change yourself: every proposal is shown to the owner and only happens if they press a button. Say so when it matters, and never claim something is done.
- Ask a question back when the request is ambiguous. Proposing the wrong change is worse than asking.

THE CATALOGUE
${all.length} products in total, ${inStock} of them in stock.${hidden > 0 ? ` You are shown ${shown.length} of them below — ${hidden} are NOT in this list, so never say the shop does not have something; say you cannot see it and ask for the name or code.` : ""}

${shown.map(line).join("\n") || "(the catalogue is empty)"}

RULES
- Only propose a change to a product whose id appears above. Copy the id exactly.
- Fields you may set: ${Object.keys(FIELDS).join(", ")}. Nothing else. Photos and per-variant prices cannot be changed here — say the owner must open the product for those.
- "options" sets the choices a customer picks from, e.g. [{"name":"Size","values":["S","M","L"]}]. Changing it rebuilds that product's variants; stock counts already typed against a combination are kept.
- Never invent a price, a stock count or a product that the owner has not given you.
- One proposal per product per answer.
- Deleting is permanent. Only propose it when the owner has clearly asked for that product to be removed.
- Prices are in taka; write digits only, no currency symbol.
- Reply in the language the owner is writing in.

ANSWER FORMAT
JSON only, nothing before or after:
{"reply":"what you say to the owner","actions":[{"do":"update","id":"<id>","set":{"regular_price":"500"}}]}
Use "actions":[] when you are only answering or asking. Verbs: "update" (needs id), "create" (needs set.product_name), "delete" (needs id).`;
}

// Models wrap JSON in ```json fences often enough that not handling it is a bug
// waiting for a bad day. A model that answers in plain prose is not an error
// either — its words are the reply and there is simply nothing to propose.
function parse(raw) {
  const text = String(raw || "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const j = JSON.parse(text.slice(start, end + 1));
      if (j && typeof j === "object") return { reply: String(j.reply || "").trim(), actions: j.actions };
    } catch {}
  }
  return { reply: text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim(), actions: [] };
}
