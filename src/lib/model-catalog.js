// One list of usable models per provider, shared by the client's AI Engine tab
// and the admin panel's platform AI screen — so the two can never offer
// different models or different labels for the same key.
//
// The list is always read LIVE from the provider (that is also the real proof
// the key works). Nothing here hardcodes a model id: both providers retire ids
// without warning, which is exactly what produced the "gemini-2.5-flash is no
// longer available" error this replaced.
import { listGoogleModels, listGoogleModelsRaw } from "@/lib/gemini.js";
import { listOpenAIModels, listOpenAIModelsRaw } from "@/lib/openai.js";
import { normaliseProvider, DEFAULT_PROVIDER } from "@/lib/ai-providers.js";

// "fast"  = cheap and quick — the right default for most replies.
// "smart" = higher quality, higher cost — a good fallback or upgrade.
export const tierOf = (id) => (/pro/i.test(id) ? "smart" : "fast");

// Everything a text chatbot can actually run on. Image, audio, TTS and embedding
// models are dropped: picking one would simply break replies.
function usable(all) {
  const drop = /embedding|image|tts|audio|vision|native|dialog|aqa|gemma|learnlm/i;
  return all.filter((m) => !drop.test(m.id));
}

// Returns [{ id, name, tier, note }] with the model's own display name,
// cheapest/fastest first so the default main choice stays economical.
export async function listModels(provider, apiKey) {
  if ((normaliseProvider(provider) || DEFAULT_PROVIDER) === "openai") return listOpenAIChat(apiKey);
  const all = await listGoogleModels(apiKey);
  if (!all.length) return [];
  const good = usable(all);
  const list = good.length ? good : all.slice(0, 6);
  list.sort((a, b) => (tierOf(a.id) === "fast" ? 0 : 1) - (tierOf(b.id) === "fast" ? 0 : 1));
  return list.slice(0, 24).map((m) => {
    const tier = tierOf(m.id);
    return {
      id: m.id,
      name: m.displayName || m.id,
      tier,
      note: tier === "fast" ? "Low cost · Fast" : "More powerful · Higher cost",
    };
  });
}

// OpenAI's side of the same question. Their /models endpoint gives ids and
// nothing else — no display name, no price tier — so the tier is read from the
// id, which is the only signal there is. "mini"/"nano"/"luna" style ids are the
// cheap fast ones; anything else is treated as the more capable, dearer tier,
// which is the safe way round: a model wrongly called expensive costs nobody
// anything, one wrongly called cheap surprises the owner on the bill.
function openaiTier(id) {
  return /mini|nano|small|luna|lite|flash/i.test(id) ? "fast" : "smart";
}

async function listOpenAIChat(apiKey) {
  const ids = await listOpenAIModels(apiKey);
  if (!ids.length) return [];
  const list = ids.map((id) => ({ id, tier: openaiTier(id) }));
  list.sort((a, b) => (a.tier === "fast" ? 0 : 1) - (b.tier === "fast" ? 0 : 1) || a.id.localeCompare(b.id));
  return list.slice(0, 24).map((m) => ({
    id: m.id,
    name: m.id,
    tier: m.tier,
    note: m.tier === "fast" ? "Low cost · Fast" : "More powerful · Higher cost",
  }));
}

// Everything on the key that can COST money, for the admin price book.
//
// `listModels` above answers a different question — what a chatbot can run on —
// and drops embeddings, which is right there and wrong here: every product
// saved is an embedding call, and it is a line on the bill. The price book has
// to be able to name a rate for anything the platform might spend on, or the
// spend falls through to the "any other model" fallback and every figure under
// it is a house guess.
//
// `kind` is only for reading: which list a model belongs under on screen.
export function kindOf(id, methods = []) {
  if (methods.includes("embedContent") || /embedding/i.test(id)) return "embedding";
  if (/tts|audio|speech/i.test(id)) return "audio";
  if (/image|imagen/i.test(id)) return "image";
  return "chat";
}

// Everything the PLATFORM's current provider can be billed for. It used to
// read Google's list whatever was switched on, so with an OpenAI platform key
// the price book could not name a single model it was actually paying for.
export async function listBillableModels(apiKey, provider) {
  const id = normaliseProvider(provider) || DEFAULT_PROVIDER;
  if (id === "openai") {
    const ids = await listOpenAIModelsRaw(apiKey);
    return ids.map((m) => ({
      id: m,
      name: m,
      kind: /embedding/i.test(m) ? "embedding"
        : /transcribe|whisper|tts|audio|realtime/i.test(m) ? "audio"
        : /image|dall/i.test(m) ? "image" : "chat",
    }));
  }
  const all = await listGoogleModelsRaw(apiKey);
  return all
    // Preview and experimental ids come and go weekly and would fill the screen
    // with rates nobody will ever spend against.
    .filter((m) => !/(-preview|-exp|-latest|-\d{3,4}$)/i.test(m.id))
    .map((m) => ({ id: m.id, name: m.displayName || m.id, kind: kindOf(m.id, m.methods) }))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
}

// Confirms every model the user picked is really on the key's live list.
export async function verifyModels(provider, apiKey, picks = []) {
  const all = await listModels(provider, apiKey);
  const ids = all.map((m) => m.id);
  if (!ids.length) return { ok: false, error: "This key has no usable chat models." };
  for (const m of picks) {
    if (m && !ids.includes(m)) {
      return { ok: false, error: `This key cannot use "${m}". Available: ${ids.slice(0, 4).join(", ")}${ids.length > 4 ? "…" : ""}` };
    }
  }
  return { ok: true, ids };
}
