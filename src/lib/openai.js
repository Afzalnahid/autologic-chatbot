// Minimal OpenAI REST client — used only for clients whose own key is an
// OpenAI key (see src/lib/ai.js). No SDK: runtime dependencies stay few
// (docs/architecture.md §1), and three fetch calls do not need one.
//
// Embeddings are deliberately absent. The catalogue's vectors live in Gemini's
// 768-dimensional space; an OpenAI embedding is a different space and would
// silently break search for everything already saved (CLAUDE.md invariant).
const API = "https://api.openai.com/v1";

// Chat/vision chain, walked exactly like the Gemini one: a retired or
// rate-limited model id moves to the next, anything else surfaces.
const CHAT_CHAIN = ["gpt-4o-mini", "gpt-4.1-mini"];

const isUnavailable = (status, body) =>
  status === 404 || status === 429 || status === 503 ||
  /model.*(not found|deprecated|no longer)/i.test(String(body || ""));

async function post(apiKey, path, payload) {
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  if (!r.ok) {
    const e = new Error(`openai ${r.status}: ${text.slice(0, 300)}`);
    e.status = r.status; e.body = text;
    throw e;
  }
  return JSON.parse(text);
}

async function onChain(model, run) {
  const chain = model ? [model, ...CHAT_CHAIN.filter((m) => m !== model)] : CHAT_CHAIN;
  let last;
  for (const id of chain) {
    try { return await run(id); }
    catch (e) {
      last = e;
      if (!isUnavailable(e.status, e.body)) throw e;
      console.warn(`[openai] model ${id} unavailable, trying next:`, String(e.message || "").slice(0, 160));
    }
  }
  throw last;
}

export async function chatWithOpenAI(apiKey, systemPrompt, messages, model) {
  return onChain(model, async (id) => {
    const j = await post(apiKey, "/chat/completions", {
      model: id,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
      ],
    });
    return j.choices?.[0]?.message?.content || "";
  });
}

export async function visionOpenAI(apiKey, base64, mimeType, prompt, model) {
  return onChain(model, async (id) => {
    const j = await post(apiKey, "/chat/completions", {
      model: id,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${mimeType || "image/jpeg"};base64,${base64}` } },
        ],
      }],
    });
    return j.choices?.[0]?.message?.content || "";
  });
}

const audioExt = (mime) => {
  const m = String(mime || "").toLowerCase();
  if (m.includes("ogg") || m.includes("opus")) return "ogg";
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "mp4";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  if (m.includes("webm")) return "webm";
  return "ogg";
};

export async function transcribeOpenAI(apiKey, base64, mimeType) {
  const buf = Buffer.from(base64, "base64");
  const fd = new FormData();
  fd.append("file", new Blob([buf], { type: mimeType || "audio/ogg" }), `audio.${audioExt(mimeType)}`);
  fd.append("model", "whisper-1");
  // Bias, not instruction: Whisper uses this as style context for mixed
  // Bangla / English / Banglish customer voice notes.
  fd.append("prompt", "Customer voice message for a Bangladeshi shop; may be Bangla, English or mixed Banglish. Keep numbers as digits.");
  const r = await fetch(`${API}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
  });
  const text = await r.text();
  if (!r.ok) {
    const e = new Error(`openai transcribe ${r.status}: ${text.slice(0, 300)}`);
    e.status = r.status; e.body = text;
    throw e;
  }
  return String(JSON.parse(text).text || "").trim();
}

// Cheapest real check that a key works: list models. Optionally confirm a
// specific model id is visible to this key.
export async function verifyOpenAIKey(apiKey, model) {
  const r = await fetch(`${API}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!r.ok) return { ok: false, error: `OpenAI answered ${r.status} — the key looks invalid or blocked` };
  if (model) {
    try {
      const j = await r.json();
      if (!j.data?.some((m) => m.id === model)) return { ok: false, error: `This key cannot see the model "${model}"` };
    } catch { /* a parse hiccup should not fail a valid key */ }
  }
  return { ok: true };
}
