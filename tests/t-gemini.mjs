// The shape Gemini's SDK will accept. It validates the history BEFORE any
// request is made and throws "First content should be with role 'user', got
// model" — which is exactly what the owner hit when adding a product with
// photos: the interview's first line is the assistant asking for a photograph,
// so the transcript sent up began with the assistant.
//
// The rule is enforced in one place (geminiTurns) so no route has to remember
// it, and these tests are what keep it enforced.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { loadPure } from "./shim.mjs";
import { readFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const G = join(here, "..", "src", "lib", "gemini.js");

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; }
  else { fail++; console.error("FAIL:", name, typeof extra === "string" ? extra : JSON.stringify(extra)); }
};
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), { got: a, want: b });

const { geminiTurns } = await loadPure(G, "tmp-gemini.mjs");

const u = (t) => ({ role: "user", parts: [{ text: t }] });
const mo = (t) => ({ role: "model", parts: [{ text: t }] });

// ── the ordinary case is untouched ─────────────────────────────────────────
eq("user-first list maps straight through",
  geminiTurns([
    { role: "user", content: "hi" },
    { role: "assistant", content: "hello" },
    { role: "user", content: "how much?" },
  ]),
  [u("hi"), mo("hello"), u("how much?")]);

// ── THE BUG: the interview opens with the assistant ────────────────────────
eq("a leading assistant turn is dropped",
  geminiTurns([
    { role: "assistant", content: "Attach the photo first." },
    { role: "user", content: "(3 photos)" },
  ]),
  [u("(3 photos)")]);

eq("several leading assistant turns are dropped",
  geminiTurns([
    { role: "assistant", content: "Attach the photo first." },
    { role: "assistant", content: "Added 1 photo. 2 were already here." },
    { role: "user", content: "(3 photos)" },
    { role: "assistant", content: "What is the price?" },
    { role: "user", content: "1450" },
  ]),
  [u("(3 photos)"), mo("What is the price?"), u("1450")]);

// The whole point of dropping only the LEADING ones.
ok("an assistant turn in the middle survives",
  geminiTurns([
    { role: "user", content: "a" },
    { role: "assistant", content: "b" },
    { role: "user", content: "c" },
  ]).some((t) => t.role === "model"));

// ── the invariant the SDK actually checks ──────────────────────────────────
const cases = [
  [{ role: "assistant", content: "x" }, { role: "user", content: "y" }],
  [{ role: "user", content: "y" }],
  [{ role: "assistant", content: "a" }, { role: "assistant", content: "b" }, { role: "user", content: "c" }],
];
for (const [i, c] of cases.entries()) {
  const turns = geminiTurns(c);
  const history = turns.slice(0, -1);
  ok(`case ${i}: history is empty or starts with user`,
    history.length === 0 || history[0].role === "user", history[0]);
  ok(`case ${i}: every turn has one non-empty part`,
    turns.every((t) => Array.isArray(t.parts) && t.parts.length === 1 && t.parts[0].text !== ""));
}

// ── content that is not worth sending ──────────────────────────────────────
eq("empty, null and undefined content are dropped",
  geminiTurns([
    { role: "user", content: "" },
    { role: "user", content: null },
    { role: "user", content: undefined },
    { role: "user", content: "real" },
  ]),
  [u("real")]);

eq("content is coerced to a string",
  geminiTurns([{ role: "user", content: 1450 }]), [u("1450")]);

// ── degenerate input must not throw ────────────────────────────────────────
eq("no user turn at all keeps the last thing said",
  geminiTurns([
    { role: "assistant", content: "a" },
    { role: "assistant", content: "b" },
  ]),
  [mo("b")]);
eq("empty list is empty", geminiTurns([]), []);
eq("no argument is empty", geminiTurns(), []);
eq("a non-array is empty", geminiTurns("nonsense"), []);
eq("null entries are skipped", geminiTurns([null, { role: "user", content: "x" }]), [u("x")]);

// An unknown role is treated as the customer, never as the model — a stray
// value must not be able to put the assistant first and break the request.
eq("an unknown role counts as user", geminiTurns([{ role: "system", content: "x" }]), [u("x")]);

// ── The model chain, and the order it is tried in ──────────────────────────
//
// The admin panel's chain reaches chatWithGemini and NOTHING else: reading a
// photo, transcribing a voice note and naming a batch of products all walk
// MODEL_CHAIN here. Until 2026-09-18 it led with gemini-2.5-flash, which was
// answering about nine calls a day before its quota bit — so on a busy day
// every photo paid a failed round trip before the model that actually answers
// got asked. What is held here is that the list leads with a model that works
// and that the documented default does not drift from the code's.
{
  const src = readFileSync(G, "utf8");
  const m = src.match(/process\.env\.GEMINI_MODELS \|\| "([^"]+)"/);
  ok("there is a built-in chain", !!m);
  const chain = (m ? m[1] : "").split(",").map((x) => x.trim()).filter(Boolean);

  ok("it names more than one model", chain.length >= 2, chain);
  ok("no id repeats", new Set(chain).size === chain.length, chain);
  // A preview id is the first thing Google retires; gemini-3-flash-preview sat
  // in the platform chain for three weeks having answered nothing since the day
  // it was set.
  ok("no preview model is relied on", chain.every((id) => !/preview/i.test(id)), chain);
  ok("every id looks like a Gemini chat model", chain.every((id) => /^gemini-[\d.]+-/.test(id)), chain);
  ok("embeddings are not in the chat chain", chain.every((id) => !/embedding/i.test(id)), chain);

  // Owner's rule, 2026-09-19: quality is never traded for a fallback. Every
  // model after the first must be the same generation or newer, and never a
  // cheaper tier (lite) — a failover must not quietly make the answers worse.
  const gen = (id) => Number((id.match(/^gemini-([\d.]+)-/) || [])[1] || 0);
  ok("no fallback is an older generation than the primary",
    chain.slice(1).every((id) => gen(id) >= gen(chain[0])), chain);
  ok("no fallback is a lite model", chain.slice(1).every((id) => !/lite/i.test(id)), chain);

  // The comment above the constant says which way round it goes; .env.example
  // shows the same list to anyone setting it by hand. Those two drifting apart
  // is how the wrong model ends up first.
  const env = readFileSync(join(here, "..", ".env.example"), "utf8");
  const doc = env.match(/^#\s*GEMINI_MODELS=(.+)$/m);
  ok("the example env documents the variable", !!doc);
  ok("and documents the same order the code defaults to",
    doc && doc[1].trim() === chain.join(","), doc ? doc[1].trim() : "");
}

console.log(fail === 0
  ? `${pass} passed, 0 failed`
  : `${pass} passed, ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
