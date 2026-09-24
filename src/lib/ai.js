// Per-client AI routing (BYOK), across two providers.
//
// The super admin grants a client permission (a client_ai row); the client then
// chooses a provider — Google AI Studio or OpenAI — and pastes their own key.
// Until a key is saved they run on the platform key like everyone else.
//
// Owner's decision (2026-09-24): ONE provider runs everything. A Gemini key
// answers chats, reads photographs, hears voice notes and makes the search
// vectors; an OpenAI key does all four. No call ever crosses to the other
// provider, on the platform key or a client's.
//
// Four hard rules:
//   1. A client with their own key runs ONLY on it. If it hits its quota or
//      breaks, the calls fail — they are never routed to the platform key.
//      That is the whole point of the feature: their AI cost is completely
//      separated from the platform's. The bot's existing error handling now
//      says nothing to the customer and alerts the owner instead.
//   2. Embeddings run on the SAME provider as everything else, and every
//      embedded row records which model made it (products.embedding_model,
//      knowledge_base.embedding_model). A Gemini 768-number vector and an
//      OpenAI 768-number vector are different spaces: comparing them returns
//      confident nonsense rather than an error, so search only ever compares
//      rows made by the model that is answering today, and a change of provider
//      re-embeds the rest in the background.
//   3. Two providers are never on at once — see src/lib/ai-providers.js, which
//      holds that rule and is tested on its own.
//   4. No dashboard ever sees the key again — only its masked form.
import { supabase } from "@/lib/supabase.js";
import { decryptSecret } from "@/lib/crypt.js";
import { notifyKeyFailing } from "@/lib/email.js";
import { notify } from "@/lib/push.js";
import { recordUsage, geminiTokens } from "@/lib/usage.js";
import { limitsFor } from "@/lib/plan-limits.js";
import { getPlatformAI } from "@/lib/platform-ai.js";
import {
  chatWithGemini, analyzeImage, analyzeImageBase64,
  transcribeAudio, transcribeAudioBase64, generateEmbedding,
} from "@/lib/gemini.js";
import {
  chatWithOpenAI, analyzeImage as oaImage, analyzeImageBase64 as oaImageB64,
  transcribeAudio as oaVoice, transcribeAudioBase64 as oaVoiceB64,
  generateEmbedding as oaEmbed, openaiTokens,
} from "@/lib/openai.js";
import { normaliseProvider, DEFAULT_PROVIDER, embedModelFor, modelChain } from "@/lib/ai-providers.js";

// The six things the product asks of an AI, from whichever provider is
// answering. Every argument shape and return value is identical on both sides,
// which is what lets the rest of the code stay unaware of the choice.
const MODULES = {
  google: {
    chat: chatWithGemini, visionUrl: analyzeImage, visionB64: analyzeImageBase64,
    transcribeUrl: transcribeAudio, transcribeB64: transcribeAudioBase64,
    embed: generateEmbedding, tokens: geminiTokens,
  },
  openai: {
    chat: chatWithOpenAI, visionUrl: oaImage, visionB64: oaImageB64,
    transcribeUrl: oaVoice, transcribeB64: oaVoiceB64,
    embed: oaEmbed, tokens: openaiTokens,
  },
};
const moduleFor = (id) => MODULES[normaliseProvider(id) || DEFAULT_PROVIDER];

// One message can transcribe, describe an image and chat; a 60s memo means the
// key row is read once per warm lambda, not three times per message.
//
// The memo holds the CONFIG, not the finished ai object, because the object
// carries the feature the caller is spending under (see src/lib/usage.js).
// Building it is a handful of closures — the database read is the expensive
// part, and that is what is cached.
const memo = new Map();

// `feature` says which part of the product is spending. Pass an AREA ("bot",
// "product", "knowledge") and the kind of call fills in the rest — a photo
// under "bot" records as bot.vision. Pass a full id ("bot.tag") when a caller
// needs its own line in the cost report.
// `pageId` is which channel the work belongs to, and it is only ever set on the
// bot's own path — a customer wrote to a particular Page, number or widget.
// Everything else (indexing a product, the owner pressing a button) genuinely
// has no channel and passes nothing, which the meter records as "".
//
// It is NOT part of the memo key on purpose: the memo caches a client's KEY and
// model chain, which do not vary by channel, and keying on it would multiply
// the cache and the decryption work by the number of channels for no gain.
export async function getClientAI(clientId, feature = "other", pageId = "") {
  const id = String(clientId || "");
  const hit = memo.get(id);
  if (hit && Date.now() - hit.at < 60_000) return build(id, hit.cfg, hit.platformChain, hit.platformApiKey, feature, pageId, hit.platformProvider);
  let cfg = null;
  let platformChain = null;
  // The platform's own key, as set in the admin panel; null means "use the
  // GEMINI_API_KEY environment variable", which is what getGenAI already does.
  let platformApiKey = null;
  // Which provider the platform is switched to right now (ai-providers.js holds
  // the one-at-a-time rule). A client with no key of their own rides this.
  let platformProvider = DEFAULT_PROVIDER;
  try {
    const pai = await getPlatformAI();
    platformApiKey = pai.apiKey || null;
    platformProvider = normaliseProvider(pai.provider) || DEFAULT_PROVIDER;
    const { data } = await supabase.from("client_ai")
      .select("provider,api_key_enc,model,status").eq("client_id", clientId).maybeSingle();
    // Permission without a key yet → platform, same as everyone else. Either
    // provider is honoured; an unrecognised one is ignored rather than guessed
    // at, which sends that client to the platform key instead of to a provider
    // this build does not know how to call.
    const provider = normaliseProvider(data?.provider);
    if (data?.api_key_enc && provider) {
      cfg = { provider, key: decryptSecret(data.api_key_enc), model: data.model || undefined, status: data.status };
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
  memo.set(id, { cfg, platformChain, platformApiKey, platformProvider, at: Date.now() });
  return build(id, cfg, platformChain, platformApiKey, feature, pageId, platformProvider);
}

// Does this client run on their OWN AI key right now? The same test getClientAI
// makes when it routes (a saved Google key), without decrypting it — used by
// billing to price a BYOK client on the lower price list. A key that is
// currently "failing" still counts: they are a BYOK client whose key needs
// fixing, not a platform-key client, so their price must not jump back up.
// Fails closed (false) on any error, which charges the standard price — the safe
// direction, and it never hands the lower price to someone without a key.
export async function clientHasOwnKey(clientId) {
  try {
    const { data } = await supabase.from("client_ai")
      .select("api_key_enc,provider").eq("client_id", clientId).maybeSingle();
    return !!(data?.api_key_enc && normaliseProvider(data?.provider));
  } catch {
    return false;
  }
}

function build(clientId, cfg, platformChain, platformApiKey, feature, pageId = "", platformProviderId = DEFAULT_PROVIDER) {
  // Token meter. Every AI call reports through this so the admin panel can
  // answer "what does this client cost me?" — see src/lib/usage.js. Cost follows
  // the KEY the call actually ran on: ownKey usage is the client's money and is
  // excluded from platform cost.
  //
  // The provider recorded is now the one that really answered, embeddings
  // included. It used to force "google" on every embed, because that was the
  // only provider there was; leaving that in would file an OpenAI embedding
  // under Google's price list and quietly mis-state the cost report.
  const meter = (providerId, ownKey, tokensOf) => ({
    onUsage: (kind, model, response) => {
      const t = tokensOf(response);
      recordUsage({
        clientId,
        kind,
        feature,
        provider: providerId,
        model,
        ownKey,
        tokensIn: t.tokensIn,
        tokensOut: t.tokensOut,
        // The part the provider served from its own cache, billed lower.
        tokensCached: t.tokensCached,
        // "" for anything that is not a customer message on a channel.
        pageId,
      });
    },
  });

  // ── the platform's key ────────────────────────────────────────────────────
  const pId = normaliseProvider(platformProviderId) || DEFAULT_PROVIDER;
  const pMod = moduleFor(pId);
  // Platform calls carry the admin-set key (when there is one) alongside the meter.
  const pm = { ...meter(pId, false, pMod.tokens), ...(platformApiKey ? { apiKey: platformApiKey } : {}) };

  const platform = {
    provider: "platform",
    // Which AI actually answers, and the name of the vector space its
    // embeddings land in. Callers store the second one beside every vector.
    aiProvider: pId,
    embedModel: embedModelFor(pId),
    ownKey: false,
    chat: (sys, msgs) => pMod.chat(sys, msgs, platformChain || undefined, pm),
    visionUrl: (url, prompt) => pMod.visionUrl(url, prompt, pm),
    visionB64: (b64, mime, prompt) => pMod.visionB64(b64, mime, prompt, pm),
    transcribeUrl: (url, headers) => pMod.transcribeUrl(url, headers, pm),
    transcribeB64: (b64, mime) => pMod.transcribeB64(b64, mime, pm),
    embed: (text) => pMod.embed(text, pm),
  };
  if (!cfg) return platform;

  // ── a client's own key ────────────────────────────────────────────────────
  // Whichever provider they chose runs ALL of it — chat, vision, voice and the
  // search vectors — on their key, at their cost.
  const cId = normaliseProvider(cfg.provider) || DEFAULT_PROVIDER;
  const mod = moduleFor(cId);
  const o = { apiKey: cfg.key, ...meter(cId, true, mod.tokens) };
  const chain = modelChain(cId, cfg.model);
  const own = {
    chat: (sys, msgs) => mod.chat(sys, msgs, chain, o),
    visionUrl: (url, prompt) => mod.visionUrl(url, prompt, o),
    visionB64: (b64, mime, prompt) => mod.visionB64(b64, mime, prompt, o),
    transcribeUrl: (url, headers) => mod.transcribeUrl(url, headers, o),
    transcribeB64: (b64, mime) => mod.transcribeB64(b64, mime, o),
    embed: (text) => mod.embed(text, o),
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
      console.log(`[ai] client ${clientId} used their OWN key (${cId}${chain[0] ? "/" + chain[0] : ""}) for ${name} — ok`);
      if (cfg.status === "failing") { cfg.status = "verified"; markOk(clientId); }
      return out;
    } catch (e) {
      console.error(`[ai] client ${clientId} own key (${cId}/${name}) failed — NOT falling back:`, String(e.message || "").slice(0, 200));
      if (cfg.status !== "failing") { cfg.status = "failing"; }
      markFailing(clientId, e);
      throw e;
    }
  };

  return {
    provider: cId,
    aiProvider: cId,
    embedModel: embedModelFor(cId),
    ownKey: true,
    chat: strict("chat", own.chat),
    visionUrl: strict("vision", own.visionUrl),
    visionB64: strict("vision", own.visionB64),
    transcribeUrl: strict("voice", own.transcribeUrl),
    transcribeB64: strict("voice", own.transcribeB64),
    // Not strict-wrapped: the caller (product search / import) already tolerates
    // a failed embedding without crashing a reply.
    embed: own.embed,
  };
}

/**
 * A chat function on the PLATFORM's key, for the last-resort paths that run
 * when a client's own AI config could not be read at all (the language rewrite
 * in bot.js, the auto-tagger in tags.js).
 *
 * It exists so those two places do not call Gemini by name. Before the second
 * provider they did, which was harmless while Gemini was the only one; with an
 * OpenAI platform key it would have sent an OpenAI-shaped bill through a Gemini
 * client and, with no GEMINI_API_KEY set, simply thrown. Usage is still counted,
 * under the feature the caller names.
 */
export async function platformChat(clientId, feature) {
  const pai = await getPlatformAI();
  const id = normaliseProvider(pai.provider) || DEFAULT_PROVIDER;
  const mod = moduleFor(id);
  const opts = {
    ...(pai.apiKey ? { apiKey: pai.apiKey } : {}),
    onUsage: (kind, model, response) => {
      const t = mod.tokens(response);
      recordUsage({ clientId, kind, feature, provider: id, model, ownKey: false,
        tokensIn: t.tokensIn, tokensOut: t.tokensOut, tokensCached: t.tokensCached });
    },
  };
  return (system, msgs) => mod.chat(system, msgs, pai.modelChain || undefined, opts);
}

// Fire-and-forget bookkeeping: the customer's reply never waits on it.
// The platform owner is told too — a client whose key has died is a client
// whose bot is silent, and they usually need help rather than a lecture.
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
    // The same once-per-outage moment, on the phone: the bot is paused until
    // the key is fixed, and the owner must not learn that from a customer.
    notify(clientId, {
      title: "⚠️ Your AI key stopped working",
      body: "The bot is paused until it is fixed. Open AI Engine to check the key.",
      url: "/dashboard#ai", tag: "key-failing",
    }).catch(() => {});
    // And the platform owner, on the admin console's bell: a client whose key
    // has died is a client whose bot is silent, and they usually need help
    // rather than to be left to notice.
    import("@/lib/platform-events.js").then(({ logEvent }) => logEvent({
      kind: "key_failing",
      title: "A client's AI key stopped working",
      body: `${flipped.provider || "?"}${flipped.model ? "/" + flipped.model : ""} — ${errMsg}`,
      clientId,
      clientName: c?.business_name || null,
    })).catch(() => {});
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
