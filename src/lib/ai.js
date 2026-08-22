// Per-client AI routing (BYOK). The super admin grants a client permission
// (a client_ai row); the client then pastes their own Google AI (Gemini) key in
// their dashboard. Until a key is saved, they run on the platform key like
// everyone else. The platform is Gemini-only: one key runs chat, vision, voice
// and embeddings.
//
// Three hard rules:
//   1. A client with their own key runs ONLY on it. If it hits its quota or
//      breaks, the calls fail — they are never routed to the platform key.
//      That is the whole point of the feature: their AI cost is completely
//      separated from the platform's. The bot's existing error handling turns
//      the failure into a polite "the team will get back to you", and the
//      failure is recorded so both dashboards show WHY.
//   2. Embeddings use the gemini-embedding-001 model (768-d) — that model is the
//      vector space. A client on their own Gemini key embeds on it too (same
//      model, same space, their cost); a client with no key uses the platform
//      key. Never another model or provider (CLAUDE.md invariant).
//   3. No dashboard ever sees the key again — only its masked form.
import { supabase } from "@/lib/supabase.js";
import { decryptSecret } from "@/lib/crypt.js";
import { notifyKeyFailing } from "@/lib/email.js";
import { recordUsage, geminiTokens } from "@/lib/usage.js";
import { limitsFor } from "@/lib/plan-limits.js";
import { getPlatformAI } from "@/lib/platform-ai.js";
import {
  chatWithGemini, analyzeImage, analyzeImageBase64,
  transcribeAudio, transcribeAudioBase64, generateEmbedding,
} from "@/lib/gemini.js";

// One message can transcribe, describe an image and chat; a 60s memo means the
// key row is read once per warm lambda, not three times per message.
const memo = new Map();

export async function getClientAI(clientId) {
  const id = String(clientId || "");
  const hit = memo.get(id);
  if (hit && Date.now() - hit.at < 60_000) return hit.ai;
  let cfg = null;
  let platformChain = null;
  // The platform's own key, as set in the admin panel; null means "use the
  // GEMINI_API_KEY environment variable", which is what getGenAI already does.
  let platformApiKey = null;
  try {
    platformApiKey = (await getPlatformAI()).apiKey || null;
    const { data } = await supabase.from("client_ai")
      .select("provider,api_key_enc,model,status").eq("client_id", clientId).maybeSingle();
    // Permission without a key yet → platform, same as everyone else. Only
    // Google (Gemini) keys are honoured — the platform is Gemini-only.
    if (data?.api_key_enc && data?.provider === "google") {
      cfg = { provider: "google", key: decryptSecret(data.api_key_enc), model: data.model || undefined, status: data.status };
    }
    // Which models the PLATFORM key should use for this client: their own
    // override first, then their package's, then the built-in chain. Set from
    // the admin panel (Packages & Costs), so switching everyone to a cheaper
    // model is a dropdown, not a deploy.
    if (!cfg) {
      const { data: c } = await supabase.from("clients")
        .select("plan,model_chain,limit_overrides").eq("id", clientId).maybeSingle();
      if (c) platformChain = (await limitsFor(c)).modelChain || null;
      // Nothing set for this client or their package → whatever the admin panel
      // picked as the platform default.
      if (!platformChain) platformChain = (await getPlatformAI()).modelChain || null;
    }
  } catch (e) {
    // A decryption error (e.g. after a secret rotation) must not crash a
    // reply; it surfaces as "failing" the first time the key is used.
    console.error("[ai] config load:", String(e.message || "").slice(0, 160));
  }
  const ai = build(id, cfg, platformChain, platformApiKey);
  memo.set(id, { ai, at: Date.now() });
  return ai;
}

function build(clientId, cfg, platformChain, platformApiKey) {
  // Token meter. Every AI call reports through this so the admin panel can
  // answer "what does this client cost me?" — see src/lib/usage.js. Cost follows
  // the KEY the call actually ran on: ownKey usage is the client's money and is
  // excluded from platform cost. Embeddings are always the gemini-embedding-001
  // model (provider "google") whoever's key runs them — a BYOK client's
  // embeddings are theirs, a platform client's are ours.
  const meter = (provider, ownKey) => ({
    onUsage: (kind, model, response) => {
      const t = geminiTokens(response);
      recordUsage({
        clientId,
        kind,
        provider: kind === "embed" ? "google" : provider,
        model,
        ownKey,
        tokensIn: t.tokensIn,
        tokensOut: t.tokensOut,
      });
    },
  });
  // Platform calls carry the admin-set key (when there is one) alongside the meter.
  const pm = { ...meter("google", false), ...(platformApiKey ? { apiKey: platformApiKey } : {}) };

  const platform = {
    provider: "platform",
    ownKey: false,
    chat: (sys, msgs) => chatWithGemini(sys, msgs, platformChain || undefined, pm),
    visionUrl: (url, prompt) => analyzeImage(url, prompt, pm),
    visionB64: (b64, mime, prompt) => analyzeImageBase64(b64, mime, prompt, pm),
    transcribeUrl: (url, headers) => transcribeAudio(url, headers, pm),
    transcribeB64: (b64, mime) => transcribeAudioBase64(b64, mime, pm),
    embed: (text) => generateEmbedding(text, pm),
  };
  if (!cfg) return platform;

  // A BYOK client is always on Google (Gemini): one key runs chat, vision, voice
  // AND embeddings, all on their own key (their cost, same 768-d vector space).
  const o = { apiKey: cfg.key, ...meter("google", true) };
  const own = {
    chat: (sys, msgs) => chatWithGemini(sys, msgs, cfg.model, o),
    visionUrl: (url, prompt) => analyzeImage(url, prompt, o),
    visionB64: (b64, mime, prompt) => analyzeImageBase64(b64, mime, prompt, o),
    transcribeUrl: (url, headers) => transcribeAudio(url, headers, o),
    transcribeB64: (b64, mime) => transcribeAudioBase64(b64, mime, o),
    embed: (text) => generateEmbedding(text, o),
  };

  // Hard separation: no platform fallback. Record failures (both dashboards
  // read the status), heal the status on the next success (a daily quota
  // resets by itself), and rethrow so the caller's error path answers.
  //
  // Success is logged too, not only failure. Without it a working BYOK client
  // is completely silent in the runtime logs, so "did that reply ride their
  // key or ours?" had no answer — the one question every BYOK test asks.
  // Only BYOK clients log here, so this is a handful of lines, not every reply.
  const strict = (name, fn) => async (...args) => {
    try {
      const out = await fn(...args);
      console.log(`[ai] client ${clientId} used their OWN key (${cfg.provider}${cfg.model ? "/" + cfg.model : ""}) for ${name} — ok`);
      if (cfg.status === "failing") { cfg.status = "verified"; markOk(clientId); }
      return out;
    } catch (e) {
      console.error(`[ai] client ${clientId} own key (${cfg.provider}/${name}) failed — NOT falling back:`, String(e.message || "").slice(0, 200));
      if (cfg.status !== "failing") { cfg.status = "failing"; }
      markFailing(clientId, e);
      throw e;
    }
  };

  return {
    provider: cfg.provider,
    ownKey: true,
    chat: strict("chat", own.chat),
    visionUrl: strict("vision", own.visionUrl),
    visionB64: strict("vision", own.visionB64),
    transcribeUrl: strict("voice", own.transcribeUrl),
    transcribeB64: strict("voice", own.transcribeB64),
    // Not strict-wrapped: a BYOK client's embed runs on their own Gemini key,
    // and the caller (product search / import) already tolerates a failed
    // embedding without crashing a reply.
    embed: own.embed,
  };
}

// Fire-and-forget bookkeeping: the customer's reply never waits on it.
// Also emails the client ONCE when the key flips from working to failing — the
// transition is detected atomically (the update only matches a row that was not
// already "failing"), so a healthy→broken event mails them, but the next failed
// message a minute later does not. Never throws (it is not awaited).
async function markFailing(clientId, e) {
  try {
    const errMsg = String(e?.message || "unknown").slice(0, 300);
    const now = new Date().toISOString();
    const { data: flipped } = await supabase.from("client_ai")
      .update({ status: "failing", last_error: errMsg, last_error_at: now, updated_at: now })
      .eq("client_id", clientId).neq("status", "failing")
      .select("provider,model").maybeSingle();
    if (!flipped) {
      // Already failing — just keep the latest error text fresh, no new email.
      await supabase.from("client_ai").update({ last_error: errMsg, last_error_at: now, updated_at: now }).eq("client_id", clientId);
      return;
    }
    // Just broke — tell the client so they can top up / fix billing.
    const { data: c } = await supabase.from("clients").select("business_name,owner_email").eq("id", clientId).maybeSingle();
    if (c?.owner_email) {
      notifyKeyFailing(c.owner_email, {
        business: c.business_name || "your business",
        provider: flipped.provider, model: flipped.model, error: errMsg,
      }).catch(() => {});
    }
  } catch (err) {
    console.error("[ai] markFailing:", String(err?.message || err).slice(0, 160));
  }
}
function markOk(clientId) {
  supabase.from("client_ai")
    .update({ status: "verified", last_error: null, last_error_at: null, updated_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .then(() => {}, () => {});
}
