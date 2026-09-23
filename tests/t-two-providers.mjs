// The whole system on ONE provider — whichever one is switched on.
//
// Owner's decision (2026-09-24): a Gemini key runs everything; an OpenAI key
// runs everything; no part ever crosses to the other. The rules themselves are
// held in tests/t-ai-providers.mjs. This suite holds the wiring: that every AI
// call really does go through the router, that the OpenAI adapter answers the
// same six questions in the same shapes, and — the one that matters most —
// that no vector is ever compared with a vector from the other provider.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (...p) => readFileSync(join(root, ...p), "utf8");
const OA = await import(pathToFileURL(join(root, "src", "lib", "openai.js")).href).catch(() => null);
const SC = await import(pathToFileURL(join(root, "src", "lib", "scrape-products.js")).href);

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

// ── the OpenAI adapter answers the same six questions ──────────────────────
const openai = read("src", "lib", "openai.js");
for (const fn of ["chatWithOpenAI", "analyzeImage", "analyzeImageBase64", "transcribeAudio", "transcribeAudioBase64", "generateEmbedding"])
  ok(`openai.js exports ${fn}`, new RegExp(`export (async )?function ${fn}\\b`).test(openai));
ok("it asks for 768 numbers, the width the columns hold", /dimensions: EMBED_DIMS/.test(openai));
ok("and refuses a vector of any other length rather than storing it", /expected \$\{EMBED_DIMS\}/.test(openai));
ok("it reads the model list live, never from a hardcoded list", /\/models`/.test(openai) && !/gpt-6-luna"/.test(openai.replace(/\/\/.*$/gm, "")));
ok("a voice note uses the transcription model, not the chat chain", /opts\.transcribeModel \|\| P\.transcribeModel/.test(openai));

// Token counting, the pure part of the meter.
if (OA) {
  const t = OA.openaiTokens({ usage: { prompt_tokens: 100, completion_tokens: 20, prompt_tokens_details: { cached_tokens: 40 } } });
  ok("tokens in, out and cached are read", t.tokensIn === 100 && t.tokensOut === 20 && t.tokensCached === 40);
  const z = OA.openaiTokens({});
  ok("a response with no usage counts as zero, never NaN", z.tokensIn === 0 && z.tokensOut === 0 && z.tokensCached === 0);
  const alt = OA.openaiTokens({ usage: { input_tokens: 7, output_tokens: 3 } });
  ok("the newer input/output names are understood too", alt.tokensIn === 7 && alt.tokensOut === 3);

  const turns = OA.openaiTurns([{ role: "assistant", content: "hi" }, { role: "user", content: "hello" }, { role: "user", content: "" }]);
  ok("an empty turn is dropped", turns.length === 2);
  ok("a transcript may open with the assistant — OpenAI allows what Gemini refuses", turns[0].role === "assistant");
  ok("roles are mapped to OpenAI's names", turns[1].role === "user");
}

// ── the router picks the module, and hides which one it picked ─────────────
const ai = read("src", "lib", "ai.js");
ok("both provider modules are wired in", /MODULES = \{[\s\S]{0,400}google:[\s\S]{0,400}openai:/.test(ai));
ok("a provider is chosen by id, not by an if on 'google'", /const moduleFor = /.test(ai));
ok("the six calls go through the chosen module", (ai.match(/pMod\.(chat|visionUrl|visionB64|transcribeUrl|transcribeB64|embed)/g) || []).length === 6);
ok("a client's own key uses their provider's module for all six",
  ["chat", "visionUrl", "visionB64", "transcribeUrl", "transcribeB64", "embed"]
    .every((k) => ai.includes(`mod.${k}(`)));
ok("the caller is told which vector space it is in", /embedModel: embedModelFor\(/.test(ai));
ok("usage is filed under the provider that really answered", /provider: providerId,/.test(ai));
ok("embeddings are no longer forced to 'google' in the meter", !/kind === "embed" \? "google"/.test(ai));
ok("a client key on either provider is honoured", /const provider = normaliseProvider\(data\?\.provider\)/.test(ai));
ok("billing counts a BYOK client on either provider", /normaliseProvider\(data\?\.provider\)\)/.test(ai));
ok("there is a platform chat for the last-resort paths", /export async function platformChat/.test(ai));

// ── nothing calls Gemini by name except the Google branch ──────────────────
const callers = [
  ["the bot", ["src", "lib", "bot.js"]],
  ["the tagger", ["src", "lib", "tags.js"]],
  ["the knowledge base", ["src", "lib", "knowledge.js"]],
  ["the product indexer", ["src", "lib", "products.js"]],
  ["the URL importer", ["src", "app", "api", "import-url", "route.js"]],
];
for (const [label, f] of callers) {
  const src = read(...f);
  ok(`${label} no longer calls Gemini directly`, !/chatWithGemini\(|generateEmbedding\(|extractProductsFromUrl\(/.test(src));
}
ok("the bot still imports only the provider-neutral constant from gemini.js",
  /import \{ UNCLEAR_AUDIO \} from "@\/lib\/gemini\.js"/.test(read("src", "lib", "bot.js")));

// ── the page scraper works on either provider ──────────────────────────────
ok("the scrape prompt carries the page's address", SC.scrapePrompt("<p>x</p>", "https://shop.test").includes("https://shop.test"));
ok("the HTML is trimmed to a bounded size", SC.scrapePrompt("x".repeat(99999), "u").length < SC.SCRAPE_LIMIT + 2000);
ok("a clean array parses", SC.parseScraped('[{"name":"a"}]').length === 1);
ok("code fences are stripped", SC.parseScraped('```json\n[{"name":"a"}]\n```').length === 1);
ok("a lone object becomes a list", SC.parseScraped('{"name":"a"}').length === 1);
ok("an array inside a chatty answer is found", SC.parseScraped('Sure! [{"name":"a"}] there you go').length === 1);
ok("rubbish is an empty list, never a throw", SC.parseScraped("sorry, I cannot do that").length === 0 && SC.parseScraped("").length === 0);

// ── the part that must never go wrong: vector spaces ───────────────────────
const products = read("src", "lib", "products.js");
const knowledge = read("src", "lib", "knowledge.js");
ok("a product records the model that embedded it", /embedding_model: ai\.embedModel/.test(products));
ok("a document records it too", /embedding_model: kAI\.embedModel/.test(knowledge));
ok("product search only compares the same space", /embed_model: ai\.embedModel/.test(read("src", "lib", "bot.js")));
ok("knowledge search only compares the same space", /embed_model: qAI\.embedModel/.test(knowledge));

// The two places that used to destructure embedProduct and throw the new
// fields away — a row that loses embedding_model is mistaken for a Gemini one
// for ever after.
for (const f of [["src", "app", "api", "add-product", "route.js"], ["src", "app", "api", "inventory-apply", "route.js"]]) {
  const src = read(...f);
  ok(`${f.at(-2)} keeps every field embedProduct returns`, !/const \{ content, embedding \} = await embedProduct/.test(src));
}

// ── the automatic rebuild ──────────────────────────────────────────────────
const cron = read("src", "app", "api", "cron", "embeddings", "route.js");
ok("there is a sweep that re-embeds what is in the wrong space", /staleRows\(/.test(cron));
ok("it uses the provider answering for THAT client", /getClientAI\(c\.id/.test(cron));
ok("it is bounded, so one huge catalogue cannot run it out of time", /ROWS_PER_RUN/.test(cron) && /CLIENTS_PER_RUN/.test(cron));
ok("one bad row does not stop the sweep", /catch \(e\) \{[\s\S]{0,200}product \$\{row\.id\}/.test(cron));
ok("a row from before the column existed counts as Gemini's", /"gemini-embedding-001"/.test(cron));
ok("it is scheduled", JSON.parse(read("vercel.json")).crons.some((c) => c.path === "/api/cron/embeddings"));
ok("changing a client's provider marks their rows for redoing", /markEmbeddingsStale/.test(read("src", "app", "api", "ai-key", "route.js")));
ok("switching the platform's provider kicks the sweep at once", /kickReembed/.test(read("src", "app", "api", "admin", "ai", "route.js")));

// ── the switch, end to end through the route ───────────────────────────────
const adminRoute = read("src", "app", "api", "admin", "ai", "route.js");
ok("the switch is its own action", /action === "set_active"/.test(adminRoute));
ok("it turns everything off BEFORE turning one on — the reverse is refused by the index",
  adminRoute.indexOf("enabled: false") < adminRoute.indexOf("enabled: true"));
ok("a provider with no key cannot be switched on", /canEnable\(row\)/.test(adminRoute));
ok("changing the switch needs the secret admin key", adminRoute.indexOf("checkSuperKey") < adminRoute.indexOf('action === "set_active"'));
ok("a removed key also switches that provider off", /api_key_enc: null, key_mask: null, status: "no_key", enabled: false/.test(adminRoute));

console.log(`t-two-providers: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
