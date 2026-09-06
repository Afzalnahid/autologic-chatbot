// How the bot writes Bangla. The SCRIPT was never the problem — the register
// was: it answered in প্রমিত (formal, literary) Bangla, which nobody types on
// Messenger, so a shop's reply read like a government notice. BANGLA_STYLE is
// the rule, and it has to reach every prompt that can produce Bangla.
//
// Also guards the rewrite check, which used to call any Bengali character in a
// Banglish reply "wrong language" — and would have rewritten a correct reply
// just for carrying a shop's Bengali brand name.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { loadPure } from "./shim.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const BOT = join(here, "..", "src", "lib", "bot.js");

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; }
  else { fail++; console.error("FAIL:", name, extra); }
};
const near = (a, b, tol = 0.02) => Math.abs(a - b) <= tol;

const bot = await loadPure(BOT, "tmp-lang.mjs");
const { detectLanguage, bengaliShare, languageLock, BANGLA_STYLE } = bot;

// ── detectLanguage: unchanged, and it decides which lock is used ───────────
ok("detect: Bengali script is Bangla", detectLanguage("হ্যাঁ, দাম কত?") === "Bangla");
ok("detect: roman Bangla is Banglish", detectLanguage("vai dam koto lagbe?") === "Banglish");
ok("detect: plain English is English", detectLanguage("What is the price?") === "English");
ok("detect: empty is English", detectLanguage("") === "English");

// ── BANGLA_STYLE: the register, stated once and reused ─────────────────────
ok("style: names the register it must avoid", /প্রমিত/.test(BANGLA_STYLE));
ok("style: says everyday spoken Bangla", /everyday spoken Bangla/i.test(BANGLA_STYLE));
ok("style: keeps the English words customers use", /offer, price, sell/i.test(BANGLA_STYLE));
ok("style: prefers দাম over মূল্য", /দাম[\s\S]*মূল্য/.test(BANGLA_STYLE));
ok("style: carries a worked example", /আপনাদের অফার প্রাইস কত/.test(BANGLA_STYLE));

// ── languageLock: script per language, register on the Bangla side ─────────
const bangla = languageLock("Bangla");
const banglish = languageLock("Banglish");
const english = languageLock("English");

ok("lock: Bangla still asks for Bangla script", /Bangla script only/.test(bangla));
ok("lock: Bangla carries the style rule", bangla.includes(BANGLA_STYLE));
ok("lock: Banglish still means English letters",
  /spelled in English letters/.test(banglish) && /no Bengali script/.test(banglish));
ok("lock: Banglish carries the style rule too", banglish.includes(BANGLA_STYLE));
ok("lock: English is untouched by the Bangla style", !english.includes(BANGLA_STYLE));
ok("lock: English still forbids Bengali script", /English only/.test(english));

// The owner's other rule: a name goes out exactly as the business stored it.
for (const [name, txt] of [["Bangla", bangla], ["Banglish", banglish], ["English", english]]) {
  ok(`lock: ${name} protects names`, /never translated and never transliterated/.test(txt));
}
// And the rule that pre-dates all of this, still stated everywhere.
ok("lock: no bilingual slash reply", /separated by a slash/.test(bangla));

// ── bengaliShare: Bengali prose vs a single Bengali name ───────────────────
ok("share: no letters at all is 0", bengaliShare("1450 :) ---") === 0);
ok("share: empty is 0", bengaliShare("") === 0);
ok("share: undefined is 0", bengaliShare(undefined) === 0);
ok("share: pure Latin is 0", bengaliShare("Dam 1450 taka, delivery 60 taka.") === 0);

const pureBengali = "হ্যাঁ, নেভি পাঞ্জাবিটি এম সাইজে আছে। দাম ১৪৫০ টাকা।";
ok("share: Bengali prose is ~1", near(bengaliShare(pureBengali), 1), bengaliShare(pureBengali));

// The case the threshold exists for: a Banglish reply carrying the shop's
// Bengali-script brand name is CORRECT and must not be rewritten.
const banglishWithName =
  "Ji bhai, নকশী থ্রেডস er navy panjabi ta M size e stock ache. " +
  "Dam 1450 taka, Dhaka r vitore delivery 60 taka.";
ok("share: a Bengali name inside a Banglish reply stays under the 0.25 cut",
  bengaliShare(banglishWithName) < 0.25, bengaliShare(banglishWithName));
ok("share: Bengali prose is over the 0.25 cut", bengaliShare(pureBengali) > 0.25);

console.log(fail === 0
  ? `${pass} passed, 0 failed`
  : `${pass} passed, ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
