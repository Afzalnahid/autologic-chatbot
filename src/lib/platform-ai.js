// The platform's own AI: one row per provider, and a switch that lets exactly
// one of them be on.
//
// Owner's decision (2026-09-24): "I can set the two providers and there will be
// an on/off switch — when one provider is turned on the other goes off
// automatically. Two providers can't be on at the same time, but both can be
// off at the same time."
//
// Both off is a real state, not a broken one: the platform then runs on the
// GEMINI_API_KEY environment variable, exactly as it did before any of this
// existed. That is the safety net, and it is why "off, off" is allowed.
//
// The rules themselves are in src/lib/ai-providers.js, which is pure and
// tested; this file is the database around them.
//
// Order of precedence, most specific first:
//   1. the provider switched ON in the admin panel, with its saved key
//   2. the GEMINI_API_KEY environment variable
//
// Cached briefly so a busy minute does not re-read and re-decrypt on every
// message, and so an admin change takes effect within a minute without a deploy.
import { supabase } from "@/lib/supabase.js";
import { decryptSecret } from "@/lib/crypt.js";
import { PROVIDER_IDS, DEFAULT_PROVIDER, enabledProvider, normaliseProvider } from "@/lib/ai-providers.js";

const TTL = 60_000;
let _cache = null;

export function invalidatePlatformAI() { _cache = null; }

/** Every provider row, keys never decrypted — for the admin screen. */
export async function platformProviders() {
  const { data } = await supabase.from("platform_ai")
    .select("id,provider,key_mask,model_chain,status,enabled,last_verified_at,last_error,updated_at");
  const byId = new Map((data || []).map((r) => [normaliseProvider(r.id) || r.id, r]));
  return PROVIDER_IDS.map((id) => {
    const r = byId.get(id) || {};
    return {
      id,
      has_key: !!r.key_mask,
      key_mask: r.key_mask || null,
      model_chain: r.model_chain || null,
      status: r.status || null,
      enabled: !!r.enabled,
      last_verified_at: r.last_verified_at || null,
      last_error: r.last_error || null,
    };
  });
}

export async function getPlatformAI() {
  if (_cache && Date.now() - _cache.at < TTL) return _cache.v;
  // Nothing switched on: the environment key, which is Gemini's.
  let v = { provider: DEFAULT_PROVIDER, apiKey: null, modelChain: null, fromEnv: true };
  try {
    const { data } = await supabase.from("platform_ai").select("id,api_key_enc,model_chain,enabled");
    const rows = data || [];
    const on = enabledProvider(rows);
    if (on) {
      const row = rows.find((r) => (normaliseProvider(r.id) || r.id) === on);
      if (row?.api_key_enc) {
        v = { provider: on, apiKey: decryptSecret(row.api_key_enc), modelChain: row.model_chain || null, fromEnv: false };
      } else if (row?.model_chain) {
        // Switched on with no key. Refuse to half-apply it: stay on the
        // environment key and keep the models that were chosen, rather than
        // running OpenAI prompts through a Gemini key.
        v = { ...v, modelChain: on === DEFAULT_PROVIDER ? row.model_chain : null };
      }
    } else {
      // Both off. Models chosen for the default provider still apply while the
      // key itself is left in the environment variable.
      const row = rows.find((r) => (normaliseProvider(r.id) || r.id) === DEFAULT_PROVIDER);
      if (row?.model_chain) v = { ...v, modelChain: row.model_chain };
    }
  } catch (e) {
    // A decryption or connection failure must never stop the bot replying — the
    // environment key still works.
    console.error("[platform-ai] falling back to the environment key:", String(e?.message || e).slice(0, 160));
  }
  _cache = { v, at: Date.now() };
  return v;
}

/** Just the key, or null to mean "use the environment variable". */
export async function platformKey() {
  return (await getPlatformAI()).apiKey;
}

/** Which provider the platform answers on right now. */
export async function platformProvider() {
  return (await getPlatformAI()).provider;
}
