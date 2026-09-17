// What a REPLY costs, out of the measured book.
//
// The admin panel's planner and its per-message headline both worked this out
// from `by_kind`, and kind "chat" is every call that sends text: a customer
// reply carrying the catalogue and the history (~7,400 tokens) was averaged
// with auto-tagging (~90 tokens), the language rewrite, the batch photo namer
// and the AI Assistant. On the 2026-09-18 book that read $0.0035 a reply
// against a true $0.0063 — the planner, and the suggested price floor printed
// underneath it, were both about 45% short on the one number a package is
// priced against.
//
// replyRates/replyTokens read `by_feature`, which names WHO asked. These checks
// use a book shaped like the real one so the failure this prevents is the one
// that actually happened.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const { replyRates, replyTokens, messageCosts, perCallRates } =
  await import(pathToFileURL(join(ROOT, "src", "lib", "package-cost.js")).href + "?v=" + Date.now());

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

// A book shaped like production on 2026-09-18: a few expensive replies and a
// lot of cheap internal calls, all of them kind "chat".
const BOOK = {
  "bot.chat":     { calls: 153, tokensIn: 1136214, tokensOut: 35978, cost: 0.96809, ownKeyCost: 0 },
  "bot.vision":   { calls: 295, tokensIn: 356127, tokensOut: 37042, cost: 0.40245, ownKeyCost: 0 },
  "bot.voice":    { calls: 36, tokensIn: 15740, tokensOut: 1381, cost: 0.01698, ownKeyCost: 0 },
  "bot.embed":    { calls: 159, tokensIn: 5369, tokensOut: 0, cost: 0.00081, ownKeyCost: 0 },
  "bot.tag":      { calls: 35, tokensIn: 3256, tokensOut: 58, cost: 0.00251, ownKeyCost: 0 },
  "bot.language": { calls: 42, tokensIn: 10074, tokensOut: 1206, cost: 0.01208, ownKeyCost: 0 },
  "product.assistant": { calls: 4, tokensIn: 6944, tokensOut: 866, cost: 0.00846, ownKeyCost: 0 },
  "product.vision":    { calls: 66, tokensIn: 80940, tokensOut: 9374, cost: 0.09586, ownKeyCost: 0 },
};

// ── The reply rate is the REPLY's rate, not the average of everything ───────
{
  const r = replyRates(BOOK);
  ok("a reply is priced from bot.chat alone", near(r.parts.chat, 0.96809 / 153, 1e-9));
  // The number the panel used to show: every kind-"chat" call averaged.
  const chatKind = ["bot.chat", "bot.tag", "bot.language", "product.assistant"];
  const blended = chatKind.reduce((n, k) => n + BOOK[k].cost, 0) / chatKind.reduce((n, k) => n + BOOK[k].calls, 0);
  // On the real book the gap was 1.79×; this subset of it gives 1.49×. Either
  // way the old figure was a different number, not a rounding difference.
  ok("which is far above the by-kind average that used to be shown", r.parts.chat > blended * 1.4);
  ok("the assistant is not part of a reply's price", r.parts.chat !== blended);

  ok("the search is priced from bot.embed", near(r.parts.embed, 0.00081 / 159, 1e-9));
  ok("reading a photo is priced from bot.vision, not product.vision",
    near(r.parts.vision, 0.40245 / 295, 1e-9) && !near(r.parts.vision, 0.09586 / 66, 1e-9));
  ok("a voice note is priced from bot.voice", near(r.parts.voice, 0.01698 / 36, 1e-9));
}

// ── Photos per reply is measured, because it decides a photo shop's bill ────
{
  const r = replyRates(BOOK);
  ok("photos per reply is measured", near(r.photosPerReply, 295 / 153, 1e-9));
  ok("and it is above one here, as production is", r.photosPerReply > 1.9);
  ok("replies is the count of real replies", r.replies === 153);
  ok("no book means no guess", replyRates({}).photosPerReply === null && replyRates({}).replies === 0);
}

// ── A text reply pays for the search as well as the answer ─────────────────
{
  const r = replyRates(BOOK);
  ok("text = answer + search", near(r.text, r.parts.chat + r.parts.embed, 1e-12));
  ok("a photo reply costs more than a text one", r.image > r.text);
  ok("a voice reply costs more than a text one", r.voice > r.text);
}

// ── The measured SIZE of a reply, for the per-1,000 line on the rate card ──
{
  const s = replyTokens(BOOK);
  ok("tokens in are the measured average", near(s.in, 1136214 / 153, 1e-9));
  ok("tokens out too", near(s.out, 35978 / 153, 1e-9));
  ok("a real reply is far bigger than the 3,000 this used to assume", s.in > 6000);
  ok("no replies measured → null, never a flattering default", replyTokens({}) === null);
}

// ── Nothing measured must read as free ─────────────────────────────────────
{
  const r = replyRates({ "bot.chat": { calls: 0, cost: 0 } });
  ok("a feature with no calls has no rate", r.parts.chat === null);
  ok("and the blended text cost is null, not zero", r.text === null);
}

// ── The panel must not go back to the wrong bucket ─────────────────────────
{
  const src = readFileSync(join(ROOT, "src", "app", "admin", "Packages.js"), "utf8");
  // by_kind is fine for the "where the money goes" bars; it is NOT fine for a
  // per-reply rate. Ban the division that made the old number.
  ok("no component divides a by_kind bucket to get a per-call rate",
    !/by_kind\?\.\[[^\]]+\][^\n]*\.cost\s*\/\s*[^\n]*\.calls/.test(src));
  ok("the planner reads replyRates", /replyRates\(/.test(src));
  ok("the rate card reads the measured reply size", /replyTokens\(/.test(src));
  ok("the rate card no longer assumes 3,000 tokens in", !/\(3000 \/ 1e6\)/.test(src));
}

console.log(fail === 0 ? `${pass} passed, 0 failed` : `${pass} passed, ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
