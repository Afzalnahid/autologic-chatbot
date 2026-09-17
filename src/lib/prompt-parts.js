// What of a product actually goes into the reply prompt.
//
// A product's metadata row is about 3,900 characters — roughly 970 tokens — and
// three or four of them ride along with every single reply. Most of that weight
// is not something the bot answers with: `visual` and `visuals` are the AI's own
// long description of the photograph (used to build the search vector, already
// done by the time we get here), and `client_id`, `photo_key`, `created_at` and
// `updated_at` are bookkeeping the model has no use for at all.
//
// So the prompt carries the fields a reply is actually made of — name, code,
// price, variants, stock, image — with the long prose capped. Measured on
// Broker's BD's catalogue: 3,888 characters down to about 1,200, which is
// ~600 tokens saved per product and ~2,000 per reply.
//
// Pure, so tests/t-prompt-parts.mjs can hold it to that without a database.

// Long text the model only needs the gist of.
const DESC_MAX = 300;
const VISUAL_MAX = 160;

const clip = (v, max) => {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…";
};

// Dropped outright: bookkeeping, and the photo descriptions that exist to build
// the search vector rather than to answer a customer.
const DROP = new Set(["client_id", "photo_key", "created_at", "updated_at", "visuals", "embedding"]);

/**
 * One product, as the reply prompt should see it.
 *
 * WHEN THE CUSTOMER SENT A PHOTO, KEEP THE WHOLE DESCRIPTION.
 * Finding the product is a vector search and happens before any of this: the
 * photo description is part of `content`, which is what was embedded, so the
 * trim cannot affect which products come back. What the model still has to do
 * is pick between the three or four it was handed — and with two power banks or
 * two red sarees in that list, the detail in the photo description ("matte
 * black, ridged grips, 146 × 70 mm, four built-in cables") is exactly what
 * separates them. So a photo turn gets the full text and a text turn gets a
 * line of it. Photos are about one message in eight, so the cost of being
 * careful here is small.
 *
 * @param {object} metadata  the row's metadata
 * @param {number} [score]   similarity from the vector search, 0-1
 * @param {{ photo?: boolean }} [opts]  the customer sent a picture this turn
 */
export function productForPrompt(metadata, score, opts = {}) {
  const m = metadata && typeof metadata === "object" ? metadata : {};
  const out = {};
  for (const [k, v] of Object.entries(m)) {
    if (DROP.has(k)) continue;
    if (v === null || v === undefined || v === "") continue;
    if (k === "description") { const d = clip(v, DESC_MAX); if (d) out.description = d; continue; }
    // A photo turn keeps the whole description (see the note above); a text
    // turn gets one line — enough to confirm "the red one with the gold border".
    if (k === "visual") {
      const d = opts.photo ? String(v).replace(/\s+/g, " ").trim() : clip(v, VISUAL_MAX);
      if (d) out.visual = d;
      continue;
    }
    out[k] = v;
  }
  // The search puts this on every row; the prompt tells the bot not to guess
  // below 0.5, so it has to survive the trim.
  if (typeof score === "number" && Number.isFinite(score)) out.match_score = Number(score.toFixed(2));
  return out;
}

/**
 * The SEARCH RESULTS block, one product per line.
 * @param {Array} rows                  what the vector search returned
 * @param {{ photo?: boolean }} [opts]  the customer sent a picture this turn
 */
export function productsBlock(rows = [], opts = {}) {
  return rows
    .map((p) => JSON.stringify(productForPrompt(p.metadata, typeof p.similarity === "number" ? p.similarity : undefined, opts)))
    .join("\n");
}
