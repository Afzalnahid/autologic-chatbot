// OpenAI, as the other half of the platform's AI.
//
// Owner's decision (2026-09-24): the whole system runs on ONE provider's key —
// a Gemini key or an OpenAI key, never a mixture. This file answers the same
// six questions src/lib/gemini.js answers, with the same argument shapes and
// the same return values, so src/lib/ai.js can hand either module to the rest
// of the product without anything downstream knowing which one it got:
//
//     chatWithOpenAI(system, messages, model, opts)  → string
//     analyzeImage(url, prompt, opts)                → string
//     analyzeImageBase64(b64, mime, prompt, opts)    → string
//     transcribeAudio(url, headers, opts)            → string
//     transcribeAudioBase64(b64, mime, opts)         → string
//     generateEmbedding(text, opts)                  → number[768]
//
// Plain fetch against the REST API rather than the SDK: six endpoints, no new
// package to keep up to date, and the error text comes back as OpenAI wrote it.
import { PROVIDERS, EMBED_DIMS, modelChain } from "@/lib/ai-providers.js";

const API = "https://api.openai.com/v1";
const P = PROVIDERS.openai;

function keyOf(opts) {
  const k = opts?.apiKey || process.env.OPENAI_API_KEY || "";
  if (!k) throw new Error("No OpenAI API key — add one in Admin → AI Engine, or set OPENAI_API_KEY.");
  return k;
}

// Same rule as the Gemini side: a model that is gone, out of quota or
// overloaded means "try the next one"; anything else is a real fault and has to
// surface rather than be retried into a different model.
const isModelUnavailable = (e) =>
  /\b404\b|\b429\b|\b503\b|does not exist|do not have access|deprecated|quota|rate limit|overload|unavailable/i.test(String(e?.message || ""));

async function withRetry(fn, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      if (!/429|503|quota|rate limit|overload|fetch failed|timeout/i.test(String(e.message || ""))) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw last;
}

// Every call reports its usage the same way gemini.js does, so the cost report
// counts an OpenAI reply exactly as it counts a Gemini one.
function report(opts, kind, model, response) {
  try { opts?.onUsage?.(kind, model, response); } catch { /* bookkeeping never breaks a reply */ }
}

/** The token counts out of an OpenAI response, in the shape usage.js wants. */
export function openaiTokens(response) {
  const u = response?.usage || {};
  const cached = u.prompt_tokens_details?.cached_tokens || 0;
  return {
    tokensIn: u.prompt_tokens || u.input_tokens || 0,
    tokensOut: u.completion_tokens || u.output_tokens || 0,
    // The part served from OpenAI's own prompt cache, billed lower — counted
    // separately for the same reason Gemini's cached tokens are.
    tokensCached: cached,
  };
}

async function post(path, body, opts, { form } = {}) {
  const res = await fetch(API + path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${keyOf(opts)}`,
      ...(form ? {} : { "Content-Type": "application/json" }),
    },
    body: form ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* an HTML error page from a proxy */ }
  if (!res.ok) {
    const msg = json?.error?.message || text.slice(0, 200) || res.statusText;
    throw new Error(`OpenAI ${res.status}: ${msg}`);
  }
  return json;
}

// Try the chosen models in order, then the provider's own chain.
async function onChain(model, run) {
  const chain = modelChain("openai", model);
  let last;
  for (const id of chain) {
    try { return await run(id); } catch (e) {
      last = e;
      if (!isModelUnavailable(e)) throw e;
      console.warn(`[openai] model ${id} unavailable, trying next:`, String(e.message || "").slice(0, 160));
    }
  }
  throw last;
}

// Our {role, content} list into OpenAI's. Unlike Gemini's SDK, OpenAI accepts a
// transcript that opens with the assistant, so nothing has to be dropped — but
// an empty turn is still not a turn.
export function openaiTurns(messages = []) {
  return (Array.isArray(messages) ? messages : [])
    .filter((m) => m && m.content !== undefined && m.content !== null && String(m.content) !== "")
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content) }));
}

export async function chatWithOpenAI(systemPrompt, messages, model, opts = {}) {
  const turns = openaiTurns(messages);
  if (!turns.length) throw new Error("chatWithOpenAI: nothing to send");
  return onChain(model, async (id) => {
    const r = await withRetry(() => post("/chat/completions", {
      model: id,
      messages: [...(systemPrompt ? [{ role: "system", content: String(systemPrompt) }] : []), ...turns],
    }, opts));
    report(opts, "chat", id, r);
    return r.choices?.[0]?.message?.content || "";
  });
}

// Vision. OpenAI takes a picture as a URL or as a data: URI in the same field,
// so both entry points meet here.
async function look(imagePart, prompt, opts, model) {
  return onChain(model, async (id) => {
    const r = await withRetry(() => post("/chat/completions", {
      model: id,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: String(prompt || "Describe this product in detail for product matching.") },
          { type: "image_url", image_url: { url: imagePart } },
        ],
      }],
    }, opts));
    report(opts, "vision", id, r);
    return r.choices?.[0]?.message?.content || "";
  });
}

export async function analyzeImage(imageUrl, prompt = "Describe this product in detail for product matching.", opts = {}) {
  return look(imageUrl, prompt, opts, opts.model);
}

export async function analyzeImageBase64(base64, mimeType, prompt, opts = {}) {
  const mime = String(mimeType || "image/jpeg").split(";")[0].trim() || "image/jpeg";
  return look(`data:${mime};base64,${base64}`, prompt, opts, opts.model);
}

// ── voice ──────────────────────────────────────────────────────────────────
// One model does transcription; it is not part of the chat chain, so a chat
// fallback never silently becomes the thing that hears a voice note.
const EXT = {
  "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/mp4": "m4a", "audio/m4a": "m4a",
  "audio/x-m4a": "m4a", "audio/mp4a-latm": "m4a", "audio/aac": "m4a",
  "audio/wav": "wav", "audio/x-wav": "wav", "audio/webm": "webm", "audio/ogg": "ogg",
};

async function transcribeBuffer(buf, mimeType, opts = {}) {
  const mime = String(mimeType || "audio/ogg").toLowerCase().split(";")[0].trim();
  const ext = EXT[mime] || "ogg";
  const model = opts.transcribeModel || P.transcribeModel;
  const form = new FormData();
  form.append("file", new Blob([buf], { type: mime || "audio/ogg" }), `voice.${ext}`);
  form.append("model", model);
  // Plain text back, exactly like the Gemini side returns.
  form.append("response_format", "text");
  const res = await fetch(`${API}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${keyOf(opts)}` },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 200);
    try { msg = JSON.parse(text)?.error?.message || msg; } catch { /* not json */ }
    throw new Error(`OpenAI ${res.status}: ${msg}`);
  }
  // The transcription endpoint reports no tokens, so the cost is estimated from
  // the length of what came back — the same approach the embedding side takes,
  // and better than recording a call that appears to have cost nothing.
  report(opts, "voice", model, { usage: { prompt_tokens: Math.ceil(text.length / 4), completion_tokens: 0 } });
  return text.replace(/^["'`\s]+|["'`\s]+$/g, "").trim();
}

export async function transcribeAudioBase64(base64, mimeType = "audio/webm", opts = {}) {
  return transcribeBuffer(Buffer.from(String(base64), "base64"), mimeType, opts);
}

export async function transcribeAudio(audioUrl, headers, opts = {}) {
  const res = await fetch(audioUrl, headers ? { headers } : undefined);
  if (!res.ok) throw new Error(`audio download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return transcribeBuffer(buf, res.headers.get("content-type") || "audio/mp4", opts);
}

// ── embeddings ─────────────────────────────────────────────────────────────
// 768 numbers, because that is the width of products.embedding and
// knowledge_base.embedding. OpenAI's `dimensions` parameter shortens the vector
// at the source, so the column needs no change — only the note of WHICH model
// made it, since an OpenAI 768 and a Gemini 768 are different spaces and
// comparing them returns confident nonsense.
export async function generateEmbedding(text, opts = {}) {
  const model = opts.embedModel || P.embedModel;
  const r = await withRetry(() => post("/embeddings", {
    model,
    input: String(text ?? ""),
    dimensions: EMBED_DIMS,
  }, opts));
  const vector = r.data?.[0]?.embedding;
  if (!Array.isArray(vector) || vector.length !== EMBED_DIMS) {
    throw new Error(`OpenAI embedding came back with ${vector?.length ?? "no"} numbers, expected ${EMBED_DIMS}`);
  }
  report(opts, "embed", model, r);
  return vector;
}

// ── the model list, for the dropdown and for verifying a key ───────────────
// Read live: model ids are retired without warning, so the screen must offer
// what the key can actually use rather than a list written here. A rejected key
// throws with OpenAI's own words, which is what makes this double as the
// key-verification step.
export async function listOpenAIModelsRaw(apiKey) {
  const res = await fetch(`${API}/models`, { headers: { Authorization: `Bearer ${apiKey || process.env.OPENAI_API_KEY || ""}` } });
  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 200);
    try { msg = JSON.parse(text)?.error?.message || msg; } catch { /* not json */ }
    throw new Error(`OpenAI ${res.status}: ${msg}`);
  }
  return (JSON.parse(text).data || []).map((m) => String(m.id)).filter(Boolean).sort();
}

/** Only the ids a chatbot can reply on — no embedding, audio or image models. */
export async function listOpenAIModels(apiKey) {
  const all = await listOpenAIModelsRaw(apiKey);
  return all.filter((id) =>
    /^(gpt|o\d|chatgpt)/i.test(id) &&
    !/embedding|whisper|transcribe|tts|audio|image|dall|moderation|realtime|search|codex/i.test(id));
}
