import { GoogleGenerativeAI } from "@google/generative-ai";

let _genAI = null;
function getGenAI() {
  if (!_genAI) _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "AIzaSyCk7XCrBzWR2AtZrrqxmPbYzndh8ZKUAEs");
  return _genAI;
}

const PRIMARY_MODEL = "gemini-2.5-flash";
const LITE_MODEL = "gemini-2.0-flash";

export async function chatWithGemini(systemPrompt, messages, model = PRIMARY_MODEL) {
  try {
    const m = getGenAI().getGenerativeModel({ model, systemInstruction: systemPrompt });
    const history = messages.slice(0, -1).map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));
    const chat = m.startChat({ history });
    const lastMsg = messages[messages.length - 1];
    const result = await chat.sendMessage(lastMsg.content);
    return result.response.text();
  } catch (e) {
    if (model === PRIMARY_MODEL) {
      console.warn("Primary model failed, falling back to lite:", e.message);
      return chatWithGemini(systemPrompt, messages, LITE_MODEL);
    }
    throw e;
  }
}


async function withRetry(fn, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      const msg = String(e.message || "");
      if (!/429|503|quota|overload|fetch failed|timeout/i.test(msg)) throw e;
      await new Promise(r => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw last;
}

export async function analyzeImage(imageUrl, prompt = "Describe this jewelry product in detail for product matching.") {
  const model = getGenAI().getGenerativeModel({ model: LITE_MODEL });
  const response = await fetch(imageUrl);
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mimeType = response.headers.get("content-type") || "image/jpeg";

  const result = await withRetry(() => model.generateContent([
    prompt,
    { inlineData: { data: base64, mimeType } },
  ]));
  return result.response.text();
}


async function withRetry(fn, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      const msg = String(e.message || "");
      if (!/429|503|quota|overload|fetch failed|timeout/i.test(msg)) throw e;
      await new Promise(r => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw last;
}

export async function analyzeImageFromTelegram(fileUrl, prompt) {
  return analyzeImage(fileUrl, prompt);
}

export async function generateEmbedding(text) {
  const model = getGenAI().getGenerativeModel({ model: "text-embedding-004" });
  const result = await withRetry(() => model.embedContent(text));
  return result.embedding.values;
}

export async function extractProductsFromUrl(htmlContent, url) {
  const model = getGenAI().getGenerativeModel({ model: PRIMARY_MODEL });
  const prompt = `Extract ALL product data from this webpage HTML. The URL is: ${url}

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

HTML content (first 15000 chars):
${htmlContent.substring(0, 15000)}

Return ONLY the JSON array, no markdown or explanation.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().replace(/```json|```/g, "").trim();
  return JSON.parse(text);
}
