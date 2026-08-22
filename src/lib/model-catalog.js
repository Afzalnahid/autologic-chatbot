// One list of usable Gemini models, shared by the client's AI Engine tab and the
// admin panel's platform AI screen — so the two can never offer different models
// or different labels for the same key.
//
// The list is always read LIVE from Google (that is also the real proof the key
// works). Nothing here hardcodes a model id: Google retires ids without warning,
// which is exactly what produced the "gemini-2.5-flash is no longer available"
// error this replaced. The platform is Gemini-only.
import { listGoogleModels } from "@/lib/gemini.js";

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
export async function listModels(_provider, apiKey) {
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

// Confirms every model the user picked is really on the key's live list.
export async function verifyModels(_provider, apiKey, picks = []) {
  const all = await listGoogleModels(apiKey);
  const ids = all.map((m) => m.id);
  if (!ids.length) return { ok: false, error: "This key has no usable chat models." };
  for (const m of picks) {
    if (m && !ids.includes(m)) {
      return { ok: false, error: `This key cannot use "${m}". Available: ${ids.slice(0, 4).join(", ")}${ids.length > 4 ? "…" : ""}` };
    }
  }
  return { ok: true, ids };
}
