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

console.log(fail === 0
  ? `${pass} passed, 0 failed`
  : `${pass} passed, ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
