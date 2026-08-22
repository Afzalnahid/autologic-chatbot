// Per-client AI routing (BYOK). The super admin grants a client permission
// (a client_ai row); the client then pastes their own key — Google AI Studio
// or OpenAI — in their dashboard. Until a key is saved, they run on the
// platform key like everyone else.
//
// Three hard rules:
//   1. A client with their own key runs ONLY on it. If it hits its quota or
//      breaks, the calls fail — they are never routed to the platform key.
//      That is the whole point of the feature: their AI cost is completely
//      separated from the platform's. The bot's existing error handling turns
//      the failure into a polite "the team will get back to you", and the
//      failure is recorded so both dashboards show WHY.
//   2. Embeddings ALWAYS run on the platform's Gemini key. All saved product
//      and knowledge vectors live in gemini-embedding-001's 768-d space;
//      another provider's embeddings are a different space and would silently
//      break search for everything already stored (CLAUDE.md invariant).
//   3. No dashboard ever sees the key again — only its masked form.
import { supabase } from "@/lib/supabase.js";
import { decryptSecret } from "@/lib/crypt.js";
import { notifyKeyFailing } from "@/lib/email.js";
import { recordUsage, geminiTokens } from "@/lib/usage.js";
import { limitsFor } from "@/lib/plan-limits.js";
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
  let platformChain = null;
  try {
    const { data } = await supabase.from("client_ai")
      .select("provider,api_key_enc,model,status").eq("client_id", clientId).maybeSingle();
    // Permission without a key yet → platform, same as everyone else.
    if (data?.api_key_enc && data?.provider) {
      cfg = { provider: data.provider, key: decryptSecret(data.api_key_enc), model: data.model || undefined, status: data.status };
    }
    // Which models the PLATFORM key should use for this client: their own
    // override first, then their package's, then the built-in chain. Set from
    // the admin panel (Packages & Costs), so switching everyone to a cheaper
    // model is a dropdown, not a deploy.
    if (!cfg) {
      const { data: c } = await supabase.from("clients")
        .select("plan,model_chain,limit_overrides").eq("id", clientId).maybeSingle();
      if (c) platformChain = (await limitsFor(c)).modelChain || null;
    }
  } catch (e) {
    // A decryption error (e.g. after a secret rotation) must not crash a
    // reply; it surfaces as "failing" the first time the key is used.
    console.error("[ai] config load:", String(e.message || "").slice(0, 160));
  }
  const ai = build(id, cfg, platformChain);
  memo.set(id, { ai, at: Date.now() });
  return ai;
}

function build(clientId, cfg, platformChain) {
  // Token meter. Every AI call reports through this so the admin panel can
  // answer "what does this client cost me?" — see src/lib/usage.js. ownKey
  // usage is still recorded but is the CLIENT's money, so cost reports exclude
  // it. Embeddings always meter as platform/google: they run on the platform
  // key even for a BYOK client (CLAUDE.md invariant), so we pay for them.
  const meter = (provider, ownKey) => ({
    onUsage: (kind, model, response) => {
      const t = geminiTokens(response);
      recordUsage({
        clientId,
        kind,
        provider: kind === "embed" ? "google" : provider,
        model,
        ownKey: kind === "embed" ? false : ownKey,
        tokensIn: t.tokensIn,
        tokensOut: t.tokensOut,
      });
    },
  });
  const pm = meter("google", false);   // platform key

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

  let own;
  if (cfg.provider === "google") {
    const o = { apiKey: cfg.key, ...meter("google", true) };
    own = {
      chat: (sys, msgs) => chatWithGemini(sys, msgs, cfg.model, o),
      visionUrl: (url, prompt) => analyzeImage(url, prompt, o),
      visionB64: (b64, mime, prompt) => analyzeImageBase64(b64, mime, prompt, o),
      transcribeUrl: (url, headers) => transcribeAudio(url, headers, o),
      transcribeB64: (b64, mime) => transcribeAudioBase64(b64, mime, o),
    };
  } else {
    const o = meter("openai", true);
    own = {
      chat: (sys, msgs) => chatWithOpenAI(cfg.key, sys, msgs, cfg.model, o),
      visionB64: (b64, mime, prompt) => visionOpenAI(cfg.key, b64, mime, prompt, cfg.model, o),
      visionUrl: async (url, prompt) => {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`image download failed: ${r.status}`);
        const b64 = Buffer.from(await r.arrayBuffer()).toString("base64");
        return visionOpenAI(cfg.key, b64, r.headers.get("content-type") || "image/jpeg", prompt, cfg.model, o);
      },
      transcribeB64: (b64, mime) => transcribeOpenAI(cfg.key, b64, mime),
      transcribeUrl: async (url, headers) => {
        const r = await fetch(url, headers ? { headers } : undefined);
        if (!r.ok) throw new Error(`audio download failed: ${r.status}`);
        return transcribeOpenAI(cfg.key, Buffer.from(await r.arrayBuffer()).toString("base64"), r.headers.get("content-type") || "audio/mp4");
      },
    };
  }

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
    embed: platform.embed,
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
