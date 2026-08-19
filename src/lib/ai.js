// Per-client AI routing (BYOK). Every AI-touching feature asks this module
// which key to use; by default that is the platform's Gemini key, but a client
// the super admin has given their own key (client_ai table) runs chat, vision
// and voice on that key instead — Google AI Studio or OpenAI.
//
// Two hard rules:
//   1. Embeddings ALWAYS run on the platform's Gemini key. All saved product
//      and knowledge vectors live in gemini-embedding-001's 768-d space;
//      another provider's embeddings are a different space and would silently
//      break search for everything already stored (CLAUDE.md invariant).
//   2. A failing client key never silences the bot. The call falls back to the
//      platform key, and the failure is recorded on the client_ai row so the
//      super admin sees "failing" plus the provider's own error text.
import { supabase } from "@/lib/supabase.js";
import { decryptSecret } from "@/lib/crypt.js";
import {
  chatWithGemini, analyzeImage, analyzeImageBase64,
  transcribeAudio, transcribeAudioBase64, generateEmbedding,
} from "@/lib/gemini.js";
import { chatWithOpenAI, visionOpenAI, transcribeOpenAI } from "@/lib/openai.js";

// One message can transcribe, describe an image and chat; a 60s memo means the
// key row is read once per warm lambda, not three times per message.
const memo = new Map();

export async function getClientAI(clientId) {
  const id = String(clientId || "");
  const hit = memo.get(id);
  if (hit && Date.now() - hit.at < 60_000) return hit.ai;
  let cfg = null;
  try {
    const { data } = await supabase.from("client_ai")
      .select("provider,api_key_enc,model").eq("client_id", clientId).maybeSingle();
    if (data?.api_key_enc) cfg = { provider: data.provider, key: decryptSecret(data.api_key_enc), model: data.model || undefined };
  } catch (e) {
    // A missing row, a decryption error after a secret rotation — the bot must
    // still answer, so the platform key covers it.
    console.error("[ai] config load:", String(e.message || "").slice(0, 160));
  }
  const ai = build(id, cfg);
  memo.set(id, { ai, at: Date.now() });
  return ai;
}

function build(clientId, cfg) {
  const platform = {
    provider: "platform",
    chat: (sys, msgs) => chatWithGemini(sys, msgs),
    visionUrl: (url, prompt) => analyzeImage(url, prompt),
    visionB64: (b64, mime, prompt) => analyzeImageBase64(b64, mime, prompt),
    transcribeUrl: (url, headers) => transcribeAudio(url, headers),
    transcribeB64: (b64, mime) => transcribeAudioBase64(b64, mime),
    embed: (text) => generateEmbedding(text),
  };
  if (!cfg) return platform;

  let own;
  if (cfg.provider === "google") {
    const o = { apiKey: cfg.key };
    own = {
      chat: (sys, msgs) => chatWithGemini(sys, msgs, cfg.model, o),
      visionUrl: (url, prompt) => analyzeImage(url, prompt, o),
      visionB64: (b64, mime, prompt) => analyzeImageBase64(b64, mime, prompt, o),
      transcribeUrl: (url, headers) => transcribeAudio(url, headers, o),
      transcribeB64: (b64, mime) => transcribeAudioBase64(b64, mime, o),
    };
  } else {
    own = {
      chat: (sys, msgs) => chatWithOpenAI(cfg.key, sys, msgs, cfg.model),
      visionB64: (b64, mime, prompt) => visionOpenAI(cfg.key, b64, mime, prompt, cfg.model),
      visionUrl: async (url, prompt) => {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`image download failed: ${r.status}`);
        const b64 = Buffer.from(await r.arrayBuffer()).toString("base64");
        return visionOpenAI(cfg.key, b64, r.headers.get("content-type") || "image/jpeg", prompt, cfg.model);
      },
      transcribeB64: (b64, mime) => transcribeOpenAI(cfg.key, b64, mime),
      transcribeUrl: async (url, headers) => {
        const r = await fetch(url, headers ? { headers } : undefined);
        if (!r.ok) throw new Error(`audio download failed: ${r.status}`);
        return transcribeOpenAI(cfg.key, Buffer.from(await r.arrayBuffer()).toString("base64"), r.headers.get("content-type") || "audio/mp4");
      },
    };
  }

  const guard = (name, fn, fallback) => async (...args) => {
    try { return await fn(...args); }
    catch (e) {
      console.error(`[ai] client ${clientId} own key (${cfg.provider}/${name}) failed, using platform:`, String(e.message || "").slice(0, 200));
      markFailing(clientId, e);
      return fallback(...args);
    }
  };

  return {
    provider: cfg.provider,
    chat: guard("chat", own.chat, platform.chat),
    visionUrl: guard("vision", own.visionUrl, platform.visionUrl),
    visionB64: guard("vision", own.visionB64, platform.visionB64),
    transcribeUrl: guard("voice", own.transcribeUrl, platform.transcribeUrl),
    transcribeB64: guard("voice", own.transcribeB64, platform.transcribeB64),
    embed: platform.embed,
  };
}

// Fire-and-forget: the customer's reply never waits on this bookkeeping.
function markFailing(clientId, e) {
  supabase.from("client_ai")
    .update({ status: "failing", last_error: String(e?.message || "unknown").slice(0, 300), last_error_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .then(() => {}, () => {});
}
