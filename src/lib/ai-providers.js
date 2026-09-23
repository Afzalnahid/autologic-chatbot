// The two AI providers the platform can run on, and the rules that keep a
// mixture from ever happening.
//
// Owner's decision (2026-09-24): "if it is a Gemini API key then the full
// system will run with this key, and if it is an OpenAI key the full system
// will run with the OpenAI key. Not a single part will run with another key."
//
// Two switches in the admin panel, one per provider. Turning one on turns the
// other off; both may be off (then the platform falls back to the environment
// key, which is how it ran before any of this existed); both on is impossible
// and is refused here as well as by a unique index in the database.
//
// Pure — no imports, no network, no database. Every decision in this file is
// tested in tests/t-ai-providers.mjs, and both the server and the admin screen
// read it, so they cannot drift apart.

export const PROVIDERS = {
  google: {
    id: "google",
    label: "Google AI Studio",
    short: "Gemini",
    keyLabel: "Gemini API key",
    keyHint: "aistudio.google.com/apikey",
    keyLooksLike: /^AIza[\w-]{20,}$/,
    // Primary first, then the fallback. The fallback is never a weaker
    // generation (owner's rule, 2026-09-19: "I don't want to lose my quality")
    // — same family, same price, so a failover changes neither the answer nor
    // the bill.
    defaultChain: ["gemini-3.6-flash", "gemini-3.8-flash"],
    // The vector space. The model IS the space: change it and every stored
    // vector becomes meaningless, which is why a change triggers a re-embed.
    embedModel: "gemini-embedding-001",
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    short: "OpenAI",
    keyLabel: "OpenAI API key",
    keyHint: "platform.openai.com/api-keys",
    keyLooksLike: /^sk-[\w-]{20,}$/,
    // gpt-6-luna is the cheapest capable model ($0.10 / $0.50 per million,
    // verified 2026-09-24) — cheaper than the Gemini primary. Its fallback is
    // NOT the same price: gpt-6-sol is $2.00 / $10.00, twenty times as much.
    // OpenAI has no same-price sibling, so unlike the Gemini pair a failover
    // here really does cost more. It only fires when the primary is out of
    // quota or retired, which is rare, and a rare reply at twenty times a very
    // small number is still a very small number — but it is worth knowing
    // before choosing this provider for a busy account.
    defaultChain: ["gpt-6-luna", "gpt-6-sol"],
    // text-embedding-3-small is 1536 numbers by default; OpenAI's `dimensions`
    // parameter shortens it, and 768 is what the products.embedding and
    // knowledge_base.embedding columns hold. So the database needs no change to
    // store an OpenAI vector — only to remember that it IS one.
    embedModel: "text-embedding-3-small",
    // The one model that hears a voice note.
    transcribeModel: "gpt-transcribe",
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS);

/** Every stored vector is this long, whoever made it. */
export const EMBED_DIMS = 768;

/** A provider id we recognise, or null. */
export function normaliseProvider(v) {
  const s = String(v || "").trim().toLowerCase();
  return PROVIDER_IDS.includes(s) ? s : null;
}

/** The provider a row/route should use when nothing says otherwise. */
export const DEFAULT_PROVIDER = "google";

/** Its display name, for a screen or an error message. */
export function providerLabel(id) {
  return PROVIDERS[normaliseProvider(id) || DEFAULT_PROVIDER].label;
}

/** Which embedding model that provider uses — the name of its vector space. */
export function embedModelFor(id) {
  return PROVIDERS[normaliseProvider(id) || DEFAULT_PROVIDER].embedModel;
}

/**
 * The chat models to try, in order: what was chosen, then the provider's own
 * default chain as a safety net. `chosen` may be a comma string ("primary,
 * fallback"), an array, or nothing.
 *
 * The chosen ids come FIRST and the defaults follow, so a client's pick is
 * honoured while a retired model id can never leave them with no model at all.
 */
export function modelChain(providerId, chosen) {
  const p = PROVIDERS[normaliseProvider(providerId) || DEFAULT_PROVIDER];
  const picks = (Array.isArray(chosen) ? chosen : String(chosen || "").split(","))
    .map((s) => String(s).trim()).filter(Boolean);
  const out = [];
  for (const id of [...picks, ...p.defaultChain]) if (!out.includes(id)) out.push(id);
  return out;
}

/** Just the two boxes an admin or a client fills in: primary and fallback. */
export function splitChain(providerId, chosen) {
  const chain = modelChain(providerId, chosen);
  return { primary: chain[0] || "", fallback: chain[1] || "" };
}

/** The two boxes back into what the database stores. Empty when nothing was set. */
export function joinChain(primary, fallback) {
  return [primary, fallback].map((s) => String(s || "").trim()).filter(Boolean).join(",");
}

/**
 * The switch. Rows are what the platform_ai table holds — one per provider,
 * each with `enabled`. Turning `wanted` on turns every other one off; passing
 * null turns them all off.
 *
 * Returns the full set as it should be saved, so the caller writes a state
 * rather than a sequence of toggles — there is no moment in between where two
 * providers are on.
 */
export function applySwitch(rows, wanted) {
  const on = normaliseProvider(wanted);
  const byId = new Map((rows || []).map((r) => [normaliseProvider(r.id) || r.id, r]));
  return PROVIDER_IDS.map((id) => ({ ...(byId.get(id) || { id }), id, enabled: id === on }));
}

/** Which provider is switched on, or null when the platform is on neither. */
export function enabledProvider(rows) {
  const on = (rows || []).filter((r) => r && r.enabled);
  // Two at once cannot happen through applySwitch or past the database's unique
  // index. If it somehow does, refuse to guess: answer null, which sends the
  // platform to the environment key rather than to a random half of a mixture.
  if (on.length !== 1) return null;
  return normaliseProvider(on[0].id);
}

/**
 * May this provider be switched on? A provider with no key saved would take the
 * whole platform down the moment it was enabled.
 */
export function canEnable(row) {
  return !!(row && (row.api_key_enc || row.has_key));
}

/**
 * Does a client's stored vector still match the provider that would answer a
 * question today? When it does not, the numbers are in a different space and
 * comparing them returns confident nonsense — so search must skip those rows
 * and a re-embed must bring them back.
 */
export function embeddingIsStale(row, providerId) {
  const want = embedModelFor(providerId);
  const has = String(row?.embedding_model || "").trim();
  // A row embedded before this column existed is Gemini's — that is all there
  // was — so it is only stale when the provider is no longer Google.
  if (!has) return (normaliseProvider(providerId) || DEFAULT_PROVIDER) !== "google";
  return has !== want;
}
