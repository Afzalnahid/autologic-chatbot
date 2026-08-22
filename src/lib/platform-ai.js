// The platform's own AI key and model choice.
//
// Order of precedence, most specific first:
//   1. the key saved in the admin panel (platform_ai table, encrypted)
//   2. the GEMINI_API_KEY environment variable — how it worked before this
//      existed, and still the safety net if the table is empty or unreadable
//
// Cached briefly so a busy minute does not re-read and re-decrypt on every
// message, and so an admin change takes effect within a minute without a deploy.
import { supabase } from "@/lib/supabase.js";
import { decryptSecret } from "@/lib/crypt.js";

const TTL = 60_000;
let _cache = null;

export function invalidatePlatformAI() { _cache = null; }

export async function getPlatformAI() {
  if (_cache && Date.now() - _cache.at < TTL) return _cache.v;
  let v = { provider: "google", apiKey: null, modelChain: null, fromEnv: true };
  try {
    const { data } = await supabase.from("platform_ai").select("provider,api_key_enc,model_chain").eq("id", "main").maybeSingle();
    if (data?.api_key_enc) {
      v = { provider: data.provider || "google", apiKey: decryptSecret(data.api_key_enc), modelChain: data.model_chain || null, fromEnv: false };
    } else if (data?.model_chain) {
      // Models chosen in the admin panel still apply even while the key itself
      // is left in the environment variable.
      v = { ...v, modelChain: data.model_chain };
    }
  } catch (e) {
    // A decryption or connection failure must never stop the bot replying — the
    // environment key still works.
    console.error("[platform-ai] falling back to the environment key:", String(e?.message || e).slice(0, 160));
  }
  _cache = { v, at: Date.now() };
  return v;
}

// Just the key, or null to mean "use the environment variable".
export async function platformKey() {
  return (await getPlatformAI()).apiKey;
}
