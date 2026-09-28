// The promo's voiceover from Google's Gemini TTS — a stock voice, no cloning
// (owner, 2026-09-29: the CPU clone never sounded professional; he chose Gemini
// because its delivery can be DIRECTED in words: an upbeat Dhaka sales read).
//
// Key: GEMINI_TTS_KEY in .env.local, which the owner creates and pastes himself
// (the app's own GEMINI_API_KEY lives in Vercel, not here). Never printed.
// The free tier allows few requests a day, so several lines go in ONE request,
// read with a pause between them (the full run splits them at the pauses).
//
//   node gemini_tts.mjs models                     → which TTS models the key can use
//   node gemini_tts.mjs sample Puck Fenrir …       → out/gemini/sample-<voice>.wav (lines 01–06)
//   node gemini_tts.mjs lines Puck S               → out/gemini/Puck/NN.wav for every line of cut S (or L)
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../..");
const OUT = path.join(here, "out", "gemini");
const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const KEY = (env.match(/^GEMINI_TTS_KEY=(.*)$/m)?.[1] || "").trim().replace(/^["']|["']$/g, "");
if (KEY.length < 20) { console.error("GEMINI_TTS_KEY is not in .env.local yet"); process.exit(1); }
const API = "https://generativelanguage.googleapis.com/v1beta";
const { lines } = JSON.parse(fs.readFileSync(path.join(here, "lines.json"), "utf8"));

// The direction. Written in English because the model follows English direction
// best; the words themselves stay Bangla.
const STYLE = [
  "# AUDIO PROFILE: Rafi, 27, the voice of a viral Bangladeshi Facebook sales ad",
  "## THE SCENE: A young man from Dhaka tells a friend, grinning, about a tool that answers his shop's messages.",
  "### DIRECTOR'S NOTES",
  "Style: energetic, warm, smiling, confident — a real person, not a news reader. Punch the key words; real questions where there is a question mark.",
  "Pace: brisk, like a Reel, with a clear one-second pause after every line.",
  "Accent: natural colloquial Dhaka Bangla (Bangladesh), not West Bengal. Brand names in English as written.",
].join("\n");
// how brand words are written FOR THE VOICE; the screen keeps lines.json's text
const SAY = [["টেলমোর এআই", "TellMore AI"], ["এআই", "AI"]];
const say = (t) => SAY.reduce((s, [a, b]) => s.replaceAll(a, b), t);

async function call(pathname, body) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}/${pathname}`, { method: body ? "POST" : "GET", headers: { "x-goog-api-key": KEY, "content-type": "application/json" }, body: body && JSON.stringify(body) });
    if (res.ok) return res.json();
    const text = await res.text();
    if (res.status === 429 && attempt < 4) { console.error("rate limited, waiting 65 s"); await new Promise((r) => setTimeout(r, 65000)); continue; }
    throw new Error(`${res.status} ${text.slice(0, 400)}`);
  }
}

let modelName;
async function model() {
  if (modelName) return modelName;
  const { models = [] } = await call("models?pageSize=200");
  const tts = models.filter((m) => /tts/i.test(m.name) && m.supportedGenerationMethods?.includes("generateContent")).map((m) => m.name);
  // the newest full (not "lite") model: highest version number first
  const ver = (n) => Number(n.match(/gemini-([\d.]+)/)?.[1]?.split(".").slice(0, 2).join(".") || 0);
  modelName = tts.filter((n) => !/lite/.test(n)).sort((a, b) => ver(b) - ver(a))[0] || tts[0];
  if (!modelName) throw new Error("this key can use no TTS model");
  return modelName;
}

const wav = (pcm, rate = 24000) => {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
};

async function speak(voice, texts, file) {
  // Direction and words in Google's TTS prompt layout (profile / notes /
  // transcript), so only the transcript is performed: as one plain paragraph the
  // model READ THE DIRECTION ALOUD (17 s of English, first samples 2026-09-29),
  // and this model refuses a system instruction.
  const r = await call(`${await model()}:generateContent`, {
    contents: [{ parts: [{ text: `${STYLE}\n\n#### TRANSCRIPT\n${texts.map(say).join("\n")}` }] }],
    generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
  });
  const part = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) throw new Error("no audio in the answer");
  const rate = Number(part.inlineData.mimeType.match(/rate=(\d+)/)?.[1] || 24000);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, wav(Buffer.from(part.inlineData.data, "base64"), rate));
  return file;
}

// ---- whole lines: several per request, split at the pauses -------------------------
const seg = new Intl.Segmenter("bn", { granularity: "grapheme" });
const weight = (t) => [...seg.segment(t.replace(/[\s,।!?]/g, ""))].length + (t.match(/[,।!?]/g) || []).length * 2;
const ff = (args) => { for (let a = 0; ; a++) { try { return execFileSync("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] }); } catch (e) { if (a >= 3) throw e; } } };
// the pauses in a take (ffmpeg reports them on stderr, so spawnSync, not execFileSync)
function pausesOf(file) {
  for (let a = 0; a < 4; a++) {
    const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "silencedetect=noise=-40dB:d=0.25", "-f", "null", "-"], { encoding: "utf8" });
    if (r.status === 0) {
      const s = [...r.stderr.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]);
      const e = [...r.stderr.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
      const dur = +(r.stderr.match(/Duration: (\d+):(\d+):([\d.]+)/) || []).slice(1).reduce((acc, v, i) => acc + v * [3600, 60, 1][i], 0);
      return { pauses: s.map((v, i) => [v, e[i] ?? dur]), dur };
    }
  }
  throw new Error("ffmpeg could not read " + file);
}

// Cut a take of n lines at n-1 of its inner pauses. Every choice of pauses is
// scored (dynamic programming): each piece should be as long as its share of the
// text says, and the pauses used should be long (the direction asks for a
// one-second pause between lines; commas and full stops inside a line are
// shorter). Accepted only if every piece is within 0.5–2× its expected length.
function splitTake(file, texts) {
  const { pauses, dur } = pausesOf(file);
  const start = pauses[0] && pauses[0][0] < 0.05 ? pauses[0][1] : 0;
  const end = pauses.at(-1) && pauses.at(-1)[1] >= dur - 0.05 ? pauses.at(-1)[0] : dur;
  const cand = pauses.filter(([s, e]) => s > start + 0.1 && e < end - 0.1);
  const n = texts.length;
  if (cand.length < n - 1) return null;
  const total = texts.reduce((a, t) => a + weight(t), 0);
  const pauseTime = cand.reduce((a, [s, e]) => a + (e - s), 0);
  const speech = end - start - pauseTime;  // what the lines themselves take (roughly)
  const expect = texts.map((t) => speech * weight(t) / total);
  const pieceCost = (k, from, to) => Math.log(Math.max(0.05, to - from) / expect[k]) ** 2;
  const pauseCost = ([s, e]) => 2 * Math.max(0, 0.8 - (e - s));
  // best[k][j]: lines 0..k done, line k ending at candidate pause j
  const best = Array.from({ length: n }, () => new Array(cand.length).fill(Infinity));
  const from = Array.from({ length: n }, () => new Array(cand.length).fill(-1));
  for (let j = 0; j < cand.length; j++) best[0][j] = pieceCost(0, start, cand[j][0]) + pauseCost(cand[j]);
  for (let k = 1; k < n - 1; k++) for (let j = k; j < cand.length; j++) for (let i = k - 1; i < j; i++) {
    const c = best[k - 1][i] + pieceCost(k, cand[i][1], cand[j][0]) + pauseCost(cand[j]);
    if (c < best[k][j]) { best[k][j] = c; from[k][j] = i; }
  }
  let last = -1, lastCost = Infinity;
  if (n === 1) return [[start, end]];
  for (let j = n - 2; j < cand.length; j++) { const c = best[n - 2][j] + pieceCost(n - 1, cand[j][1], end); if (c < lastCost) { lastCost = c; last = j; } }
  if (last < 0) return null;
  const used = [last];
  for (let k = n - 2; k > 0; k--) used.unshift(from[k][used[0]]);
  const bounds = [start, ...used.flatMap((j) => cand[j]), end];
  const pieces = texts.map((_, i) => [bounds[i * 2], bounds[i * 2 + 1]]);
  const ok = pieces.every(([s, e], i) => { const r = (e - s) / expect[i]; return r > 0.5 && r < 2; });
  pieces.forEach(([s, e], i) => console.log(`  ${String(i + 1).padStart(2)} ${s.toFixed(2)}–${e.toFixed(2)}s  ×${((e - s) / expect[i]).toFixed(2)}  ${texts[i].slice(0, 30)}`));
  return ok ? pieces : null;
}

// One request per voice for the short cut: the free tier allows 10 a day.
const GROUPS = { S: [lines.filter((l) => l.in.includes("S")).map((l) => l.id)] };

async function allLines(voice, cut) {
  const dir = path.join(OUT, voice);
  fs.mkdirSync(dir, { recursive: true });
  // only the lines not on disk yet (e.g. 01–06 come from the approved sample)
  const missing = GROUPS[cut].map((g) => g.filter((id) => !fs.existsSync(path.join(dir, `${id}.wav`)))).filter((g) => g.length);
  for (const ids of missing) {
    const texts = ids.map((id) => lines.find((l) => l.id === id).text);
    // a take already on disk is reused, so a failed split never costs a new request
    const takeFile = path.join(dir, `take-${cut}.wav`);
    const take = fs.existsSync(takeFile) ? takeFile : await speak(voice, texts, takeFile);
    const pieces = splitTake(take, texts);
    if (!pieces) { console.error(voice, "the take did not split cleanly — kept at", take, "(no more requests spent)"); process.exitCode = 2; return; }
    pieces.forEach(([s, e], i) => ff(["-y", "-loglevel", "error", "-i", take, "-ss", Math.max(0, s - 0.06).toFixed(3), "-to", (e + 0.08).toFixed(3), path.join(dir, `${ids[i]}.wav`)]));
    console.log(voice, ids.join(" "), "done");
  }
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "models") {
  const { models = [] } = await call("models?pageSize=200");
  console.log(models.filter((m) => /tts/i.test(m.name)).map((m) => m.name).join("\n") || "no TTS models on this key");
} else if (cmd === "cost") {
  // node gemini_tts.mjs cost Puck Fenrir …  — what the whole-cut takes on disk cost:
  // prompt tokens counted by the (free) countTokens call, audio at 25 tokens a
  // second; prices per 1M tokens for gemini-3.8-flash-tts until 2026-12-31.
  const PRICE_IN = 0.5, PRICE_OUT = 9.0;
  const ids = GROUPS.S[0].filter((id) => !["01", "02", "03", "04", "05", "06"].includes(id));
  const texts = ids.map((id) => lines.find((l) => l.id === id).text);
  const prompt = `${STYLE}\n\n#### TRANSCRIPT\n${texts.map(say).join("\n")}`;
  const { totalTokens } = await call(`${await model()}:countTokens`, { contents: [{ parts: [{ text: prompt }] }] });
  let sum = 0;
  for (const voice of rest) {
    const take = path.join(OUT, voice, "take-S.wav");
    const sec = pausesOf(take).dur;
    const cost = (totalTokens * PRICE_IN + sec * 25 * PRICE_OUT) / 1e6;
    sum += cost;
    console.log(`${voice}: ${totalTokens} text tokens + ${sec.toFixed(2)} s audio = ${Math.round(sec * 25)} audio tokens → $${cost.toFixed(6)}`);
  }
  console.log(`total $${sum.toFixed(6)}`);
} else if (cmd === "split") {
  // node gemini_tts.mjs split <voice> <take.wav> 01 02 …  — split a take already made (no request)
  const [voice, take, ...ids] = rest;
  const texts = ids.map((id) => lines.find((l) => l.id === id).text);
  const pieces = splitTake(take, texts);
  if (!pieces) { console.error("did not split cleanly"); process.exit(2); }
  fs.mkdirSync(path.join(OUT, voice), { recursive: true });
  pieces.forEach(([s, e], i) => ff(["-y", "-loglevel", "error", "-i", take, "-ss", Math.max(0, s - 0.06).toFixed(3), "-to", (e + 0.08).toFixed(3), path.join(OUT, voice, `${ids[i]}.wav`)]));
  console.log(voice, ids.join(" "), "split");
} else if (cmd === "lines") {
  await allLines(rest[0] || "Puck", rest[1] || "S");
} else if (cmd === "test") {
  const f = await speak(rest[0] || "Puck", ["ভাইজান, শুনেন।", "পেজ খুলছেন, বুস্টও করছেন।"], path.join(OUT, "test.wav"));
  console.log("wrote", f);
} else if (cmd === "sample") {
  const ids = ["01", "02", "03", "04", "05", "06"];
  for (const voice of rest.length ? rest : ["Puck", "Fenrir", "Sadachbia", "Achird"]) {
    const f = await speak(voice, ids.map((id) => lines.find((l) => l.id === id).text), path.join(OUT, `sample-${voice}.wav`));
    console.log("wrote", f, "with", await model());
  }
} else {
  console.error("usage: node gemini_tts.mjs models | sample [voices…]");
  process.exit(1);
}
