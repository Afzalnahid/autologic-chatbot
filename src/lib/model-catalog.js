// One list of usable AI models, shared by the client's AI Engine tab and the
// admin panel's platform AI screen — so the two can never offer different
// models or different labels for the same key.
//
// The list is always read LIVE from the provider (that is also the real proof
// the key works). Nothing here hardcodes a model id: Google retires ids without
// warning, which is exactly what produced the "gemini-2.5-flash is no longer
// available" error this replaced.
import { listGoogleModels } from "@/lib/gemini.js";
import { listOpenAIModels } from "@/lib/openai.js";

// "fast"  = cheap and quick — the right default for most replies.
// "smart" = higher quality, higher cost — a good fallback or upgrade.
export const tierOf = (provider, id) =>
  provider === "google"
    ? (/pro/i.test(id) ? "smart" : "fast")
    : (/mini|nano|small/i.test(id) ? "fast" : "smart");

// Everything a text chatbot can actually run on. Image, audio, TTS and
// embedding models are dropped: picking one would simply break replies.
function usable(provider, all) {
  if (provider === "google") {
    const drop = /embedding|image|tts|audio|vision|native|dialog|aqa|gemma|learnlm/i;
    return all.filter((m) => !drop.test(m.id));
  }
  const drop = /instruct|search|audio|realtime|transcribe|tts|image|moderation|embedding|babbage|davinci/i;
  return all.filter((m) => /^(gpt-5|gpt-4\.5|gpt-4\.1|gpt-4o|o[0-9])/i.test(m.id) && !drop.test(m.id));
}

// Returns [{ id, name, tier, note }] with the provider's own display name,
// cheapest/fastest first so the default main choice stays economical.
export async function listModels(provider, apiKey) {
  const all = provider === "google" ? await listGoogleModels(apiKey) : await listOpenAIModels(apiKey);
  if (!all.length) return [];
  const good = usable(provider, all);
  const list = good.length ? good : all.slice(0, 6);
  list.sort((a, b) => (tierOf(provider, a.id) === "fast" ? 0 : 1) - (tierOf(provider, b.id) === "fast" ? 0 : 1));
  return list.slice(0, 24).map((m) => {
    const tier = tierOf(provider, m.id);
    return {
      id: m.id,
      name: m.displayName || m.id,
      tier,
      note: tier === "fast" ? "Low cost · Fast" : "More powerful · Higher cost",
    };
  });
}

// Confirms every model the user picked is really on the key's live list.
export async function verifyModels(provider, apiKey, picks = []) {
  const all = provider === "google" ? await listGoogleModels(apiKey) : await listOpenAIModels(apiKey);
  const ids = all.map((m) => m.id);
  if (!ids.length) return { ok: false, error: "This key has no usable chat models." };
  for (const m of picks) {
    if (m && !ids.includes(m)) {
      return { ok: false, error: `This key cannot use "${m}". Available: ${ids.slice(0, 4).join(", ")}${ids.length > 4 ? "…" : ""}` };
    }
  }
  return { ok: true, ids };
}
