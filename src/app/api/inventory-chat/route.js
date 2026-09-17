export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { featureGate } from "@/lib/plan-limits.js";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit.js";
import { supabase } from "@/lib/supabase.js";
import { getClientAI } from "@/lib/ai.js";
import { FIELDS, normalizeActions } from "@/lib/inventory-actions.js";
import { normalizeSettingActions, settingsSummary, trainingKeys, OFFER_FIELDS, TRAINING_FIELDS, IDENTITY_FIELDS, TONES, LANGUAGES } from "@/lib/assistant-actions.js";

// The assistant, half one: it answers questions and PROPOSES changes. It never
// makes one.
//
// That split is the whole design. An assistant that can quietly edit a shop's
// prices is a liability — a misheard sentence becomes a wrong price a customer
// is then quoted, and the owner finds out from the customer. So this route only
// ever returns words and a list of proposals; /api/inventory-apply carries them
// out, and only after the owner has looked at each one and pressed the button.
//
// The model is also given no way to reach the database. It answers with JSON
// naming an id and a few whitelisted fields; anything outside those lists
// (photos, a variant's own price, another shop's product, a setting nobody put
// on the list) cannot be expressed, let alone applied.
//
// It reaches past the catalogue now. The owner asked for one place from which
// the whole dashboard is driven, so this route is also shown the shop's OFFERS,
// how far the bot may bargain, what it has been taught and who it says it is —
// everything the Bot Training tab holds, which is one row in app_settings. The
// route name still says inventory; what it does is wider than that, and
// renaming a live route is a separate job from making it work.

// How much of the catalogue the model is shown. A shop with two thousand
// products cannot be sent whole, so the rows most likely to be the subject are
// picked and the model is told plainly how many it is NOT seeing — a model that
// thinks it has seen everything will happily say "you have no red shirts".
const CONTEXT_ROWS = 120;

export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    // Package gate — see FEATURE_DEFS in src/lib/features.js.
    const gate = await featureGate(client, "assistant");
    if (!gate.ok) return NextResponse.json({ error: gate.message, feature: "assistant" }, { status: 403 });
    const rl = rateLimit(`inv-chat:${client.id}`, 80, 3600000);
    if (!rl.ok) return tooManyRequests(rl.retryAfter, "You are asking very quickly. Please wait a moment.");

    const body = await request.json().catch(() => ({}));
    const messages = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m) => m && typeof m.content === "string" && m.content.trim())
      .slice(-14)
      .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content).slice(0, 4000) }));
    if (!messages.length) return NextResponse.json({ error: "nothing to answer" }, { status: 400 });

    // A shop is driven through its CATALOGUE; a service business through the
    // KNOWLEDGE its bot answers from (uploaded documents) — different tables, so
    // an agency reads its knowledge docs where a shop reads its products. Both
    // read everything the Bot Training tab holds (one row in app_settings).
    const agency = client.business_type === "agency";
    const [{ data: rows }, { data: files }, { data: setRow }] = await Promise.all([
      agency ? Promise.resolve({ data: [] })
        : supabase.from("products").select("id,metadata,created_at").eq("client_id", client.id)
            .order("created_at", { ascending: false }).limit(1000),
      agency ? supabase.from("file_registry").select("file_id,file_name,chunks,created_at").eq("client_id", client.id)
            .order("created_at", { ascending: false }).limit(200)
        : Promise.resolve({ data: [] }),
      supabase.from("app_settings").select("settings").eq("id", String(client.id)).maybeSingle(),
    ]);
    const all = (rows || []).map((r) => ({ id: r.id, ...(r.metadata || {}) }));
    const docs = files || [];
    const settings = setRow?.settings || {};

    const last = messages[messages.length - 1].content;
    const shown = agency ? [] : pick(all, last, CONTEXT_ROWS);
    const hidden = agency ? 0 : all.length - shown.length;

    const ai = await getClientAI(client.id, "product.assistant");
    const raw = await ai.chat(agency ? agencyPrompt(client, docs, settings) : systemPrompt(client, all, shown, hidden, settings), messages);
    const parsed = parse(raw);

    // Only proposals about products this shop owns survive. The model has no
    // way to learn another client's id, but "cannot happen" is not a filter.
    // A screen the model asked to open (a photo interview, an importer, the
    // overview editor) — validated against the fixed list so a made-up token
    // does nothing. When one is set, the proposals are dropped: the screen is
    // the action now.
    // A service business has no catalogue screens; the one screen it opens is
    // the document upload for its knowledge base.
    const UI_TOKENS = agency
      ? new Set(["import:docs"])
      : new Set(["add_photo", "import:photos", "import:csv", "import:url", "import:woo", "import:shopify", "overview"]);
    const ui = UI_TOKENS.has(String(parsed.ui || "")) ? String(parsed.ui) : null;

    // No catalogue for an agency, so no product proposals — its half of the
    // dashboard is the knowledge documents (uploaded, not proposed) and the Bot
    // Training settings below.
    const owned = new Set(all.map((p) => String(p.id)));
    const actions = agency ? [] : (ui ? [] : normalizeActions(parsed.actions).filter((a) => a.do === "create" || owned.has(String(a.id))));

    // The same rule for the settings half: an offer or a note the model names
    // has to be one that is actually there, or the proposal is dropped before
    // the owner is ever shown it.
    const offerIds = new Set((Array.isArray(settings.offers) ? settings.offers : []).map((o) => String(o?.id)));
    const noteIds = new Set((Array.isArray(settings.questionnaire?.notes) ? settings.questionnaire.notes : []).map((n) => String(n?.id)));
    const settingActions = ui ? [] : normalizeSettingActions(parsed.settings).filter((a) => {
      if (a.do === "offer.update" || a.do === "offer.delete") return offerIds.has(String(a.id));
      if (a.do === "note.delete") return noteIds.has(String(a.id));
      return true;
    });

    return NextResponse.json({
      ok: true,
      reply: parsed.reply || "I could not put that into words. Try asking it a different way.",
      ui,
      actions,
      settingActions,
      // The panel reads each product as it stands now, to show "450 → 500"
      // rather than just "500".
      before: Object.fromEntries(actions.filter((a) => a.id).map((a) => [a.id, all.find((p) => String(p.id) === String(a.id)) || null])),
      // The same idea for the other half, and it is one object rather than a
      // map because every settings proposal is a change to the same thing.
      // Trimmed to what the cards actually read: the generated business profile
      // is thousands of words and would ride along in every message for nothing.
      settingsBefore: settingActions.length ? forCards(settings) : null,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Only the parts of the settings a proposal card reads back, so "5% → 10%" can
// be shown. `businessPrompt` is deliberately not among them: it is the whole
// generated profile, it is never what a card compares against, and sending it
// with every answer would be a page of text riding along for nothing.
const forCards = (s) => ({
  botName: s.botName || "", businessName: s.businessName || "", greeting: s.greeting || "",
  offers: Array.isArray(s.offers) ? s.offers : [],
  bargain: s.bargain || {},
  followup: { enabled: !!s.followup?.enabled },
  questionnaire: s.questionnaire || {},
});

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

// The agency twin of systemPrompt. A service business's bot answers from three
// things — the profile answers, the facts it has been taught, and the uploaded
// KNOWLEDGE DOCUMENTS — not from a catalogue of products with prices and stock.
// So this prompt drops products, offers-as-catalogue and bargaining, and instead
// knows how to teach the bot, fill in the profile, and open the document upload.
function agencyPrompt(client, docs, settings) {
  const keys = trainingKeys("agency");
  const docLines = (docs || []).length
    ? docs.map((d) => `- ${d.file_name || "(untitled)"}${d.chunks ? ` (${d.chunks} pieces)` : ""}`).join("\n")
    : "(no documents uploaded yet)";
  return `You run the dashboard of a service business in Bangladesh, by conversation, for its owner. Their business is "${client.business_name || "this business"}". You are the one place from which the whole thing is driven: what the bot knows, what it has been taught, who it says it is, and how it follows up.

WHAT YOU CAN DO
- Answer questions from what you are shown below. It is everything you can see.
- PROPOSE changes. You never make a change yourself: every proposal is shown to the owner as a card and only happens if they press a button. Say so when it matters, and never claim something is done.
- Ask a question back when the request is ambiguous. Proposing the wrong change is worse than asking.
- Take the owner to another tab when that is what they want (e.g. "show me the bookings", "open bot training"). Just answer normally — the panel recognises it.
- You cannot send anything to a customer. Broadcasts and replies are not yours; say the owner does that on Broadcast or Inbox.

HOW THIS BOT LEARNS — TWO WAYS, KNOW WHICH TO USE
1. A SHORT FACT or a PROFILE ANSWER — the owner tells you something in words (a service and its price, opening hours, the refund policy, how the work runs). You SAVE it yourself: use "note.add" for a single standalone fact, or "training.set" to fill in one of the profile answers below. Both reach the bot immediately.
2. A LOT of written material — a rate card, a brochure, a services document. That is a FILE and you cannot read or type it in. Set "ui":"import:docs" and tell them in one line that the upload is opening; they attach the PDF / Word / text file and it is added to the knowledge base.
When you set "ui", "settings" must be empty — the screen takes over.

THE KNOWLEDGE DOCUMENTS (what the bot has been given to read from)
${docLines}

THE BOT'S OWN SETTINGS
${settingsSummary(settings, keys)}

RULES
- TEACHING: "note.add" is one plain fact the bot should know — "we are closed on Fridays", "a logo design starts at 5000 taka". Short, one fact each.
- PROFILE ANSWERS are the long-form training: ${keys.join(", ")}. Setting one REPLACES what is there, so read the old answer back if you are only adding to it.
- IDENTITY: ${Object.keys(IDENTITY_FIELDS).join(", ")}. "tone" must be exactly one of: ${TONES.join(" | ")}. "languages" must be exactly one of: ${LANGUAGES.join(" | ")}.
- OFFERS are deals the bot quotes word for word. Fields: ${Object.keys(OFFER_FIELDS).join(", ")}.
- Only propose an offer or note change with an id that appears above. Copy it exactly.
- Never invent a service, a price, a policy or a fact the owner has not given you.
- Prices are in taka; write digits only, no currency symbol.
- Reply in the language the owner is writing in.

ANSWER FORMAT
JSON only, nothing before or after:
{"reply":"what you say to the owner","settings":[{"do":"note.add","set":{"text":"We are closed on Fridays"}}],"ui":""}
Use an empty array when you are only answering or asking, and "ui":"" unless you are opening the upload.
Settings verbs: "note.add", "note.delete" (needs id), "training.set", "identity.set", "offer.create", "offer.update" (needs id), "offer.delete" (needs id), "followup.set".`;
}

function systemPrompt(client, all, shown, hidden, settings) {
  const inStock = all.filter((p) => p.stock_status !== "outofstock").length;
  const agency = client.business_type === "agency";
  const keys = trainingKeys(client.business_type);
  return `You run the dashboard of a ${agency ? "service business" : "shop"} in Bangladesh, by conversation, for its owner. Their business is "${client.business_name || "this business"}". You are the one place from which the whole thing is driven: the catalogue, the offers the bot quotes, how far it may bargain, what it has been taught, and who it says it is.

WHAT YOU CAN DO
- Answer questions from what you are shown below. It is everything you can see.
- PROPOSE changes. You never make a change yourself: every proposal is shown to the owner as a card and only happens if they press a button. Say so when it matters, and never claim something is done.
- Ask a question back when the request is ambiguous. Proposing the wrong change is worse than asking.
- Take the owner to another tab when that is what they want. You do not need to do anything for that — the panel recognises "show me the orders", "open bot training" on its own. Just answer normally.
- You cannot send anything to a customer. Broadcasts and replies are not yours; say the owner does that on Broadcast or Inbox.

SOME THINGS NEED A SCREEN, NOT TEXT — OPEN IT WITH "ui"
You cannot attach a photo, read a file, connect another shop, or set a picture by typing. When the owner wants one of these, DO NOT propose actions — instead set "ui" to one value and, in "reply", tell them in one short line what is opening:
- "ui":"add_photo" — they want to add ONE new ${agency ? "service" : "product"}. This opens the guided add where they send its photo and you ask the rest, one question at a time. Prefer this whenever a NEW ${agency ? "service" : "product"} is being added, unless they clearly gave full text details AND said there is no photo — then you may "create" it by text instead.
- "ui":"import:photos" — MANY ${agency ? "services" : "products"} to add, a photo of each.
- "ui":"import:csv" — a spreadsheet / CSV / Excel.
- "ui":"import:url" — a product link / URL.
- "ui":"import:woo" — a WooCommerce shop.
- "ui":"import:shopify" — a Shopify shop.
- "ui":"overview" — set the category OVERVIEW image (the picture the bot sends when a customer first asks broadly, e.g. "power bank ache?").
When you set "ui", "actions" and "settings" must be empty — the screen takes over.

THE CATALOGUE
${all.length} products in total, ${inStock} of them in stock.${hidden > 0 ? ` You are shown ${shown.length} of them below — ${hidden} are NOT in this list, so never say the shop does not have something; say you cannot see it and ask for the name or code.` : ""}

${shown.map(line).join("\n") || "(the catalogue is empty)"}

THE BOT'S OWN SETTINGS
${settingsSummary(settings, keys)}

RULES — THE CATALOGUE
- Only propose a change to a product whose id appears above. Copy the id exactly.
- Fields you may set: ${Object.keys(FIELDS).join(", ")}. Nothing else. Photos and per-variant prices cannot be changed here — say the owner must open the product for those.
- "options" sets the choices a customer picks from, e.g. [{"name":"Size","values":["S","M","L"]}]. Changing it rebuilds that product's variants; stock counts already typed against a combination are kept.
- One proposal per product per answer.
- Deleting is permanent. Only propose it when the owner has clearly asked for that product to be removed.

RULES — THE BOT'S SETTINGS
- OFFERS are deals the bot quotes to customers word for word, so write them as a customer should read them. Fields: ${Object.keys(OFFER_FIELDS).join(", ")}. You cannot choose WHICH products an offer covers — that is picked from the real catalogue on the Offers tab — so say that when it matters.
- Switching an offer off ("active": false) keeps it for later; deleting throws it away. Prefer switching off unless the owner says remove.
- BARGAINING: "mode" is one of fixed (never moves on price), limited (may take up to max_discount_pct off), custom (the owner's own rule in words).
- TEACHING: "note.add" is how the bot learns one more fact — "we are closed on Fridays", "delivery is free over 2000". Short, plain, one fact each.
- TRAINING answers are the long-form profile: ${keys.join(", ")}. Setting one REPLACES what is there, so read the old answer back if you are only adding to it.
- IDENTITY: ${Object.keys(IDENTITY_FIELDS).join(", ")}. "tone" must be exactly one of: ${TONES.join(" | ")}. "languages" must be exactly one of: ${LANGUAGES.join(" | ")}.
- Only propose an offer or note change with an id that appears above. Copy it exactly.

RULES — BOTH
- Never invent a price, a stock count, an offer or a fact the owner has not given you.
- Prices are in taka; write digits only, no currency symbol.
- Reply in the language the owner is writing in.

ANSWER FORMAT
JSON only, nothing before or after:
{"reply":"what you say to the owner","actions":[{"do":"update","id":"<id>","set":{"regular_price":"500"}}],"settings":[{"do":"offer.create","set":{"title":"Eid sale","details":"20% off everything until 15 April"}}],"ui":""}
Use empty arrays when you are only answering or asking, and "ui":"" unless you are opening a screen (see above).
Catalogue verbs: "update" (needs id), "create" (needs set.product_name), "delete" (needs id).
Settings verbs: "offer.create", "offer.update" (needs id), "offer.delete" (needs id), "bargain.set", "note.add", "note.delete" (needs id), "training.set", "identity.set", "followup.set".`;
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
      if (j && typeof j === "object") return { reply: String(j.reply || "").trim(), actions: j.actions, settings: j.settings, ui: j.ui };
    } catch {}
  }
  return { reply: text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim(), actions: [], settings: [], ui: "" };
}
