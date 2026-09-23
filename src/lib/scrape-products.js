// Reading a product off somebody's web page.
//
// The prompt used to live inside gemini.js and call Gemini directly, which made
// it the one job the platform could not do on an OpenAI key (owner's rule,
// 2026-09-24: one provider runs everything). It now takes a chat function —
// whatever src/lib/ai.js hands it — so it runs on either.
//
// Pure apart from the call it is given, so tests/t-scrape-products.mjs can hold
// the prompt and the parsing without a network.

export const SCRAPE_LIMIT = 15000;

export function scrapePrompt(htmlContent, url) {
  return `Extract ALL product data from this webpage HTML. The URL is: ${url}

Return a JSON array of products. Each product must have:
{
  "name": "Product Name",
  "categories": [{"name": "Category"}],
  "regular_price": 0,
  "sale_price": 0,
  "stock_status": "instock",
  "description": "Product description",
  "images": [{"src": "image_url"}]
}

HTML content (first ${SCRAPE_LIMIT} chars):
${String(htmlContent || "").substring(0, SCRAPE_LIMIT)}

Return ONLY the JSON array, no markdown or explanation.`;
}

/** The model's answer into a list of products. Never throws on rubbish. */
export function parseScraped(text) {
  const cleaned = String(text || "").replace(/\`\`\`json|\`\`\`/g, "").trim();
  if (!cleaned) return [];
  try {
    const out = JSON.parse(cleaned);
    return Array.isArray(out) ? out : (out && typeof out === "object" ? [out] : []);
  } catch {
    // Some models wrap the array in a sentence. Take the first [...] block.
    const m = cleaned.match(/\[[\s\S]*\]/);
    if (!m) return [];
    try { const out = JSON.parse(m[0]); return Array.isArray(out) ? out : []; } catch { return []; }
  }
}

/**
 * `chat(system, messages)` is whichever provider is answering. Scraping a page
 * is one of the most expensive single calls the product makes — 15k characters
 * of HTML in the prompt — so the caller's meter is already attached to it.
 */
export async function extractProductsFromPage(chat, htmlContent, url) {
  const text = await chat("", [{ role: "user", content: scrapePrompt(htmlContent, url) }]);
  return parseScraped(text);
}
