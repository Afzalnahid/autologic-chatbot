// The rules that keep the platform on ONE AI provider at a time.
//
// Owner's decision (2026-09-24): a Gemini key runs the whole system, an OpenAI
// key runs the whole system, and no part of it ever runs on the other one. Two
// switches, one per provider; turning one on turns the other off; both off is
// allowed; both on is not.
//
// ai-providers.js has no imports, so it loads as-is.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const M = await import(pathToFileURL(join(here, "..", "src", "lib", "ai-providers.js")).href);
const {
  PROVIDERS, PROVIDER_IDS, EMBED_DIMS, DEFAULT_PROVIDER,
  normaliseProvider, providerLabel, embedModelFor,
  modelChain, splitChain, joinChain,
  applySwitch, enabledProvider, canEnable, embeddingIsStale,
} = M;

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── the two providers ──────────────────────────────────────────────────────
ok("there are exactly two providers", same(PROVIDER_IDS, ["google", "openai"]));
ok("each has a name a person would recognise", PROVIDERS.google.label === "Google AI Studio" && PROVIDERS.openai.label === "OpenAI");
ok("each names where to get a key", PROVIDER_IDS.every((id) => /\./.test(PROVIDERS[id].keyHint)));
ok("each has a primary AND a fallback model", PROVIDER_IDS.every((id) => PROVIDERS[id].defaultChain.length >= 2));
ok("a fallback is never the same id as the primary", PROVIDER_IDS.every((id) => {
  const [a, b] = PROVIDERS[id].defaultChain; return a !== b;
}));
ok("each names its embedding model", PROVIDER_IDS.every((id) => !!PROVIDERS[id].embedModel));
ok("the two embedding models are different spaces", PROVIDERS.google.embedModel !== PROVIDERS.openai.embedModel);
ok("every vector is the length the columns hold", EMBED_DIMS === 768);

// ── reading a provider id ──────────────────────────────────────────────────
ok("a known id passes through", normaliseProvider("openai") === "openai");
ok("case and spaces do not matter", normaliseProvider("  Google ") === "google");
ok("an unknown id is refused rather than guessed", normaliseProvider("anthropic") === null && normaliseProvider("") === null && normaliseProvider(null) === null);
ok("the default is Google, which is what every existing row is", DEFAULT_PROVIDER === "google");
ok("an unknown id still gets a usable label", providerLabel("nonsense") === "Google AI Studio");

// ── the model chain ────────────────────────────────────────────────────────
ok("nothing chosen falls back to the provider's own chain",
  same(modelChain("openai", ""), PROVIDERS.openai.defaultChain));
ok("a chosen model is tried FIRST, and the defaults still follow",
  same(modelChain("google", "gemini-3.8-pro"), ["gemini-3.8-pro", ...PROVIDERS.google.defaultChain]));
ok("primary and fallback both survive, in order",
  same(modelChain("openai", "gpt-6-astra,gpt-6-sol").slice(0, 2), ["gpt-6-astra", "gpt-6-sol"]));
ok("an id is never listed twice", (() => {
  const c = modelChain("google", "gemini-3.6-flash");
  return new Set(c).size === c.length;
})());
ok("stray spaces and empty entries are dropped",
  same(modelChain("openai", " gpt-6-astra , , ").slice(0, 1), ["gpt-6-astra"]));
ok("an array works as well as a comma string",
  same(modelChain("openai", ["gpt-6-astra"]), modelChain("openai", "gpt-6-astra")));
ok("a chain is never empty, whatever it is given", modelChain("openai", null).length >= 2);

// ── the two boxes on the screen ────────────────────────────────────────────
ok("split gives a primary and a fallback",
  same(splitChain("openai", "gpt-6-astra,gpt-6-sol"), { primary: "gpt-6-astra", fallback: "gpt-6-sol" }));
ok("split on nothing shows the provider's defaults",
  splitChain("google", "").primary === PROVIDERS.google.defaultChain[0]);
ok("join puts them back", joinChain("a", "b") === "a,b");
ok("join drops an empty box", joinChain("a", "") === "a" && joinChain("", "b") === "b" && joinChain("", "") === "");
ok("a round trip keeps what was typed", (() => {
  const s = splitChain("openai", "x,y"); return joinChain(s.primary, s.fallback) === "x,y";
})());

// ── the switch: one on, or none ────────────────────────────────────────────
const rows = [{ id: "google", api_key_enc: "g" }, { id: "openai", api_key_enc: "o" }];
{
  const after = applySwitch(rows, "openai");
  ok("turning one on turns the other off", same(after.map((r) => [r.id, r.enabled]), [["google", false], ["openai", true]]));
  ok("it keeps everything else on the row", after.find((r) => r.id === "openai").api_key_enc === "o");
  ok("exactly one is on", after.filter((r) => r.enabled).length === 1);
}
{
  const after = applySwitch(applySwitch(rows, "openai"), "google");
  ok("switching back flips both", same(after.map((r) => r.enabled), [true, false]));
}
ok("both can be off", applySwitch(rows, null).every((r) => !r.enabled));
ok("an unknown id turns everything off rather than half-applying",
  applySwitch(rows, "anthropic").every((r) => !r.enabled));
ok("a provider missing from the table is still written out", applySwitch([{ id: "google" }], "openai").length === 2);

ok("the one that is on is reported", enabledProvider([{ id: "google", enabled: false }, { id: "openai", enabled: true }]) === "openai");
ok("none on reads as none", enabledProvider([{ id: "google", enabled: false }]) === null);
ok("no rows at all reads as none", enabledProvider([]) === null && enabledProvider(null) === null);
ok("two on is refused rather than guessed — that is the state that must never ship",
  enabledProvider([{ id: "google", enabled: true }, { id: "openai", enabled: true }]) === null);

ok("a provider with no key cannot be switched on", canEnable({ id: "openai" }) === false);
ok("one with a saved key can", canEnable({ id: "openai", api_key_enc: "x" }) === true);
ok("the screen's own has_key flag counts too", canEnable({ id: "openai", has_key: true }) === true);

// ── stale vectors ──────────────────────────────────────────────────────────
ok("a Gemini row is fine while the provider is Google",
  embeddingIsStale({ embedding_model: "gemini-embedding-001" }, "google") === false);
ok("the same row is stale the moment the provider is OpenAI",
  embeddingIsStale({ embedding_model: "gemini-embedding-001" }, "openai") === true);
ok("an OpenAI row is fine on OpenAI",
  embeddingIsStale({ embedding_model: "text-embedding-3-small" }, "openai") === false);
ok("a row from before this column existed counts as Gemini's",
  embeddingIsStale({}, "google") === false && embeddingIsStale({ embedding_model: "" }, "openai") === true);
ok("a row embedded by a model we no longer use is stale even on the same provider",
  embeddingIsStale({ embedding_model: "text-embedding-ada-002" }, "openai") === true);

console.log(`t-ai-providers: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
