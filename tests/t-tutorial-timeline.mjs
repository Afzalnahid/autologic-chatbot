// When things happen in a tutorial video (marketing/tutorial/timeline.mjs), the
// one function the picture and the sound both read.
//
// Owner, 2026-09-30: Autolinium's contact card closes only the important films
// (tutorials 00 and 19, marked "endCard": true); every other video ends on a
// short hold with the brand line. Two older lessons stay pinned here too: a
// guessed voice length once made two lines speak at once, and an action that
// finished before its words did not match the voice.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, readdirSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const T = await import(pathToFileURL(join(root, "marketing", "tutorial", "timeline.mjs")).href);

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };

const capture = { lines: [{ id: "01", start: 0, end: 2 }, { id: "02", start: 2, end: 3 }] };
const voices = { "01": 3, "02": 2.5 };
const plain = { lines: [{ id: "01" }, { id: "02" }] };
const card = { ...plain, endCard: true };

// ── the ending ──────────────────────────────────────────────────────────────
const a = T.tutorialTimeline(plain, capture, voices);
const b = T.tutorialTimeline(card, capture, voices);
ok("a video without endCard has no card", a.endCard === false);
ok("a video without endCard ends on the short hold", Math.abs(a.total - a.body - T.SHORT_OUTRO) < 1e-9);
ok("the short hold is short (under 2 s)", T.SHORT_OUTRO > 0 && T.SHORT_OUTRO < 2);
ok("\"endCard\": true gets the card", b.endCard === true);
ok("the card gets the full outro", Math.abs(b.total - b.body - T.OUTRO) < 1e-9);
ok("the card does not change the body", a.body === b.body);

// ── the body ────────────────────────────────────────────────────────────────
ok("the body starts after the title card", a.segs[0].at === T.INTRO);
ok("lines follow each other", Math.abs(a.segs[1].at - (a.segs[0].at + a.segs[0].len)) < 1e-9);
ok("every line lasts at least its voice", a.segs.every((s) => s.len >= s.voice));
ok("the action ends with the voice, not before it",
  a.segs.every((s) => s.at + s.off + (s.capEnd - s.capStart) * s.k >= s.voiceAt + s.voice - 0.3));
ok("a missing voice length stops the build", throws(() => T.tutorialTimeline(plain, capture, { "01": 3 }), /no voice length/));
ok("a line missing from the capture stops the build",
  throws(() => T.tutorialTimeline({ lines: [{ id: "09" }] }, capture, { "09": 2 }), /not in the capture/));

// ── the scripts ─────────────────────────────────────────────────────────────
const dir = join(root, "marketing", "tutorial", "scripts");
const cards = readdirSync(dir).filter((f) => f.endsWith(".json") && JSON.parse(readFileSync(join(dir, f), "utf8")).endCard).sort();
ok(`only tutorials 00 and 19 carry the card (found: ${cards.join(", ") || "none"})`,
  cards.length === 2 && cards[0].startsWith("00-") && cards[1].startsWith("19-"));

console.log(`t-tutorial-timeline: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
