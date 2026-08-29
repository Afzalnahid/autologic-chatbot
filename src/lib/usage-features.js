// The feature registry: WHICH part of the product spent the money.
//
// This file is deliberately dependency-free. src/lib/usage.js (server only,
// holds the database client) re-exports it, and the admin panel — which runs in
// the browser — imports it directly. One list, two sides, no drift, and no
// service-role client dragged into the bundle.

// ── Features: WHICH part of the product spent the money ─────────────────────
//
// "kind" says what sort of call it was (chat / vision / voice / embed / scrape).
// "feature" says who asked for it. Without the second one every chat call looks
// the same and "what does auto-tagging cost me?" has no answer.
//
// A feature id is "area.name". The area is one of three, and that is the split
// the admin panel shows per client:
//   bot       — runs by itself, on a customer message. The recurring cost.
//   catalogue — indexing the shop or the documents. Paid once per product/file.
//   platform  — dashboard tools the owner presses a button for.
//
// Callers usually pass just the AREA ("bot", "product") and the kind fills in
// the rest, so a new call site cannot forget to name itself.
export const AREAS = {
  bot: { label: "Bot — customer chats", hint: "Runs by itself every time a customer writes. This is the cost that grows with traffic." },
  catalogue: { label: "Products & Knowledge", hint: "Indexing the catalogue or the knowledge base. Paid once per product or document, not per message." },
  platform: { label: "Platform tools", hint: "Dashboard buttons the owner presses — writing the bot profile, rewriting an offer." },
};

export const FEATURES = {
  "bot.chat": { area: "bot", label: "Customer replies", note: "The answer itself" },
  "bot.embed": { area: "bot", label: "Finding the answer", note: "Searching products / knowledge for each message" },
  "bot.vision": { area: "bot", label: "Reading customer photos", note: "One call per photo, uncapped" },
  "bot.voice": { area: "bot", label: "Voice notes", note: "Transcribing a voice message" },
  "bot.language": { area: "bot", label: "Language correction", note: "Rewriting a reply that came back in the wrong language" },
  "bot.tag": { area: "bot", label: "Auto-tagging", note: "Labelling a conversation when the word rules cannot" },
  "bot.comment": { area: "bot", label: "Comment replies", note: "Answering a public comment on a post" },

  "product.vision": { area: "catalogue", label: "Describing product photos", note: "One call per photo — every side of a product, not only the first" },
  "product.embed": { area: "catalogue", label: "Indexing products", note: "Once per product saved or imported" },
  "product.scrape": { area: "catalogue", label: "Reading a website page", note: "Website import — the most expensive single call" },
  "product.chat": { area: "catalogue", label: "Product import (other)", note: "" },
  "product.interview": { area: "catalogue", label: "Adding a product by chat", note: "One call per question asked while building one product" },
  "product.catalog": { area: "catalogue", label: "Naming a batch of photos", note: "One call for a whole batch, not one per photo" },
  "product.group": { area: "catalogue", label: "Grouping photos", note: "Deciding which pictures are the same product. Text only, one call per batch" },
  "knowledge.embed": { area: "catalogue", label: "Indexing documents", note: "Once per ~1,200 characters of an uploaded file" },

  "platform.prompt": { area: "platform", label: "Writing the bot profile", note: "Generate-with-AI in Bot Training" },
  "platform.offer": { area: "platform", label: "Rewriting an offer", note: "Polish button on an offer" },
  // The assistant answering and proposing. It is a dashboard tool the owner
  // presses, not a per-product cost, so it belongs beside the other two rather
  // than in the catalogue: a shop that adds no products can still run this all
  // day asking what is low on stock.
  "product.assistant": { area: "platform", label: "AI Assistant chat", note: "Answering the owner and proposing changes. One call per message they send" },

  legacy: { area: "unattributed", label: "Recorded before the split", note: "Older rows: real cost, but no feature was stored yet" },
  other: { area: "unattributed", label: "Not attributed", note: "A call site that did not name itself — treat as a bug" },
};

// "bot" + kind "vision" → "bot.vision". An id that already carries a dot is
// used as-is, which is how the finer ones (bot.tag, bot.language) are set.
export function featureId(area, kind) {
  const a = String(area || "other");
  if (a.includes(".")) return a;
  const id = `${a}.${kind || "chat"}`;
  return FEATURES[id] ? id : a === "other" ? "other" : id;
}

export function areaOf(feature) {
  return FEATURES[feature]?.area || (String(feature || "").split(".")[0] in AREAS ? String(feature).split(".")[0] : "unattributed");
}

export function featureLabel(feature) {
  return FEATURES[feature]?.label || feature || "Unknown";
}
