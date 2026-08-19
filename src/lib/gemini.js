import { GoogleGenerativeAI } from "@google/generative-ai";

let _genAI = null;
function getGenAI() {
  if (!_genAI) _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
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



export async function analyzeImageBase64(base64, mimeType, prompt) {
  const model = getGenAI().getGenerativeModel({ model: PRIMARY_MODEL });
  const result = await withRetry(() => model.generateContent([
    prompt,
    { inlineData: { data: base64, mimeType } },
  ]));
  return result.response.text();
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

export async function generateEmbedding(text) {
  const model = getGenAI().getGenerativeModel({ model: "gemini-embedding-001" });
  const result = await withRetry(() => model.embedContent({
    content: { parts: [{ text }] },
    outputDimensionality: 768,
  }));
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

// Voice notes. One transcription core for every channel (Facebook, Instagram,
// WhatsApp, widget), on the same Gemini model the bot replies with.
//
// The prompt is built for real customer audio: phone recordings, low volume,
// background noise, Bangla / English / Banglish in one breath. Temperature 0
// keeps it literal. When the audio is genuinely unintelligible the model says
// so with a marker instead of inventing words — the bot then asks the
// customer to repeat or type, rather than answering the wrong question.
const TRANSCRIBE_PROMPT = `You are a precise speech-to-text engine for a customer-service chat in Bangladesh.

Transcribe the speech in this audio EXACTLY as spoken.
- The speaker may use Bangla, English, or a mix (Banglish) — keep each word in the language it was spoken. Write Bangla words in Bangla script, English words in Latin script.
- The recording may be quiet, noisy, clipped, or from a phone held far away: listen carefully through the noise and transcribe what is actually said. Do not skip quiet words.
- Keep numbers, product codes, sizes, prices, phone numbers and addresses exactly as spoken (digits as digits).
- Do NOT summarise, translate, correct, or add anything. No commentary, no quotes, no labels.
- If there is no speech at all, or it is truly impossible to make out, output exactly: [unclear]

Output only the transcript text.`;

export const UNCLEAR_AUDIO = "[unclear]";

function normalizeAudioMime(mime) {
  const m = String(mime || "").toLowerCase().split(";")[0].trim();
  if (!m || m === "application/octet-stream") return "audio/ogg";
  if (m === "audio/mp4a-latm" || m === "audio/x-m4a") return "audio/mp4";
  if (m === "audio/x-wav") return "audio/wav";
  return m;
}

async function transcribeParts(base64, mimeType) {
  const model = getGenAI().getGenerativeModel({ model: PRIMARY_MODEL, generationConfig: { temperature: 0 } });
  const result = await withRetry(() => model.generateContent([
    TRANSCRIBE_PROMPT,
    { inlineData: { data: base64, mimeType: normalizeAudioMime(mimeType) } },
  ]));
  const text = (result.response.text() || "").replace(/^["'`\s]+|["'`\s]+$/g, "").trim();
  return text;
}

export async function transcribeAudioBase64(base64, mimeType = "audio/webm") {
  return transcribeParts(base64, mimeType);
}

export async function transcribeAudio(audioUrl, headers) {
  const res = await fetch(audioUrl, headers ? { headers } : undefined);
  if (!res.ok) throw new Error(`audio download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer()).toString("base64");
  const mime = res.headers.get("content-type") || "audio/mp4";
  return transcribeParts(buf, mime);
}
