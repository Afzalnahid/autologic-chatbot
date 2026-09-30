// The tutorial narration: one Gemini TTS request per line (paid key, a few
// paisa a video), in the one voice the owner chose for every tutorial —
// Sadachbia — calm and clear, a friendly teacher rather than a salesman.
//   node tts.mjs bn        → video/public/tutorial/<id>/vo-bn/NN.wav + durations.json
//   node tts.mjs en
//   node tts.mjs bn 04     → redo just these lines
// Reads GEMINI_TTS_KEY from .env.local and never prints it.
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadScript } from "./script.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../..");
const SCRIPT = loadScript();   // TUT=<id> picks the tutorial (script.mjs)
const [lang = "bn", ...only] = process.argv.slice(2);
const VOICE = "Sadachbia";
const OUT = path.join(ROOT, `video/public/tutorial/${SCRIPT.id}/vo-${lang}`);
const RAW = path.join(here, "out", SCRIPT.id, `raw-${lang}`);
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(RAW, { recursive: true });

const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const KEY = (env.match(/^GEMINI_TTS_KEY=(.*)$/m)?.[1] || "").trim().replace(/^["']|["']$/g, "");
if (!KEY) throw new Error("GEMINI_TTS_KEY is not in .env.local");
const API = "https://generativelanguage.googleapis.com/v1beta";

const STYLE = {
  bn: [
    "# AUDIO PROFILE: a friendly Bangladeshi product trainer recording a how-to video",
    "## THE SCENE: She is showing a shop owner, screen by screen, how to use an app. Patient, warm, smiling.",
    "### DIRECTOR'S NOTES",
    "Style: clear, calm and encouraging, like a helpful teacher — never a salesman, never a news reader.",
    "Pace: relaxed and easy to follow; brief natural pauses at commas.",
    "Accent: natural standard Bangladeshi Bangla. Button names and brand names in English exactly as written.",
  ].join("\n"),
  en: [
    "# AUDIO PROFILE: a friendly product trainer recording a how-to video",
    "## THE SCENE: She is showing a small-business owner, screen by screen, how to use an app. Patient, warm, smiling.",
    "### DIRECTOR'S NOTES",
    "Style: clear, calm and encouraging, like a helpful teacher — never a salesman.",
    "Pace: relaxed and easy to follow; brief natural pauses at commas.",
    "Accent: neutral, clear international English.",
  ].join("\n"),
}[lang];
// how brand words are written FOR THE VOICE; the captions keep script.json's text
const SAY = [["টেলমোর এআই", "TellMore AI"], ["tellmoreai.com", "TellMore AI dot com"]];
const say = (t) => SAY.reduce((s, [a, b]) => s.replaceAll(a, b), t);

async function call(pathname, body) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}/${pathname}`, { method: body ? "POST" : "GET", headers: { "x-goog-api-key": KEY, "content-type": "application/json" }, body: body && JSON.stringify(body) });
    if (res.ok) return res.json();
    const text = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < 5) { console.error(`${res.status}, waiting`); await new Promise((r) => setTimeout(r, 20000 * attempt)); continue; }
    throw new Error(`${res.status} ${text.slice(0, 300)}`);
  }
}
const { models = [] } = await call("models?pageSize=200");
const ver = (n) => Number(n.match(/gemini-([\d.]+)/)?.[1]?.split(".").slice(0, 2).join(".") || 0);
// TTS_MODEL overrides, for testing only: every video keeps one model's voice
const MODEL = process.env.TTS_MODEL || models.map((m) => m.name).filter((n) => /tts/i.test(n) && !/lite/.test(n)).sort((a, b) => ver(b) - ver(a))[0];
if (!MODEL) throw new Error("no TTS model for this key");

const wav = (pcm, rate) => {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
};
const ff = (args) => { for (let a = 0; ; a++) { try { return execFileSync("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] }); } catch (e) { if (a >= 3) throw e; } } };
// this machine's ffprobe sometimes dies and prints nothing: ask again, and never
// let a missing length through (it made two lines speak at once, 2026-09-30)
const dur = (f) => {
  for (let a = 0; a < 5; a++) {
    const d = Number(spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).stdout?.toString().trim());
    if (d > 0) return d;
  }
  throw new Error(`cannot read the length of ${f}`);
};

// ---- one take, cut at its pauses (the same method as marketing/promo/gemini_tts.mjs)
const seg = new Intl.Segmenter("bn", { granularity: "grapheme" });
const weight = (t) => [...seg.segment(t.replace(/[\s,।!?.]/g, ""))].length + (t.match(/[,।!?.]/g) || []).length * 2;
function pausesOf(file) {
  for (let a = 0; a < 4; a++) {
    const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "silencedetect=noise=-40dB:d=0.25", "-f", "null", "-"], { encoding: "utf8" });
    if (r.status === 0) {
      const s = [...r.stderr.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]);
      const e = [...r.stderr.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
      const d = +(r.stderr.match(/Duration: (\d+):(\d+):([\d.]+)/) || []).slice(1).reduce((acc, v, i) => acc + v * [3600, 60, 1][i], 0);
      return { pauses: s.map((v, i) => [v, e[i] ?? d]), dur: d };
    }
  }
  throw new Error("ffmpeg could not read " + file);
}
// Cut a take of n lines at n-1 of its inner pauses, choosing (dynamic
// programming) the cut where each piece is as long as its share of the text
// says and the pauses used are the long ones. null when no cut fits well.
function splitTake(file, texts) {
  const { pauses, dur: total } = pausesOf(file);
  const start = pauses[0] && pauses[0][0] < 0.05 ? pauses[0][1] : 0;
  const end = pauses.at(-1) && pauses.at(-1)[1] >= total - 0.05 ? pauses.at(-1)[0] : total;
  const cand = pauses.filter(([s, e]) => s > start + 0.1 && e < end - 0.1);
  const n = texts.length;
  if (cand.length < n - 1) return null;
  const sum = texts.reduce((a, t) => a + weight(t), 0);
  const speech = end - start - cand.reduce((a, [s, e]) => a + (e - s), 0);
  const expect = texts.map((t) => speech * weight(t) / sum);
  const pieceCost = (k, from, to) => Math.log(Math.max(0.05, to - from) / expect[k]) ** 2;
  const pauseCost = ([s, e]) => 2 * Math.max(0, 0.8 - (e - s));
  const best = Array.from({ length: n }, () => new Array(cand.length).fill(Infinity));
  const from = Array.from({ length: n }, () => new Array(cand.length).fill(-1));
  for (let j = 0; j < cand.length; j++) best[0][j] = pieceCost(0, start, cand[j][0]) + pauseCost(cand[j]);
  for (let k = 1; k < n - 1; k++) for (let j = k; j < cand.length; j++) for (let i = k - 1; i < j; i++) {
    const c = best[k - 1][i] + pieceCost(k, cand[i][1], cand[j][0]) + pauseCost(cand[j]);
    if (c < best[k][j]) { best[k][j] = c; from[k][j] = i; }
  }
  let last = -1, lastCost = Infinity;
  for (let j = n - 2; j < cand.length; j++) { const c = best[n - 2][j] + pieceCost(n - 1, cand[j][1], end); if (c < lastCost) { lastCost = c; last = j; } }
  if (last < 0) return null;
  const used = [last];
  for (let k = n - 2; k > 0; k--) used.unshift(from[k][used[0]]);
  const bounds = [start, ...used.flatMap((j) => cand[j]), end];
  const pieces = texts.map((_, i) => [bounds[i * 2], bounds[i * 2 + 1]]);
  return pieces.every(([s, e], i) => { const r = (e - s) / expect[i]; return r > 0.55 && r < 1.8; }) ? pieces : null;
}

// A line whose words have not changed keeps its take (the owner approves takes
// by ear; a new take of the same words would sound different). Asking for a
// line by id always makes a new take.
const SAID = path.join(OUT, "text.json");
const said = fs.existsSync(SAID) ? JSON.parse(fs.readFileSync(SAID, "utf8")) : {};
const todo = SCRIPT.lines.filter((line) => {
  if (only.length) return only.includes(line.id);
  const keep = said[line.id] === line[lang] && fs.existsSync(path.join(OUT, `${line.id}.wav`));
  if (keep) console.log(lang, line.id, "unchanged — kept");
  return !keep;
});

async function take(texts, style, file) {
  const r = await call(`${MODEL}:generateContent`, {
    contents: [{ parts: [{ text: `${style}\n\n#### TRANSCRIPT\n${texts.map(say).join("\n")}` }] }],
    generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } },
  });
  const part = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) throw new Error("no audio in the answer");
  fs.writeFileSync(file, wav(Buffer.from(part.inlineData.data, "base64"), Number(part.inlineData.mimeType.match(/rate=(\d+)/)?.[1] || 24000)));
  return file;
}
// trim the silence at both ends, gentle clean-up, 48 kHz stereo (optionally a slice of a longer take)
function finish(raw, id, from, to) {
  const cut = from != null ? ["-ss", from.toFixed(3), "-to", to.toFixed(3)] : [];
  ff(["-y", ...cut, "-i", raw, "-af", "aresample=48000,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse,highpass=f=70,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120,alimiter=limit=0.9",
    "-ac", "2", path.join(OUT, `${id}.wav`)]);
}
const done = (line) => {
  console.log(lang, line.id, dur(path.join(OUT, `${line.id}.wav`)).toFixed(2), "s");
  said[line.id] = line[lang];
  fs.writeFileSync(SAID, JSON.stringify(said, null, 1));
};

// The model allows 100 requests a day (hit on 2026-09-30 at one request per
// line), so a whole video's lines go in ONE take, read with a clear pause
// between lines, and are cut apart at those pauses (splitTake, as the promo
// does). check_voice.mjs then listens to every piece. If the cut does not fit,
// the lines fall back to one request each.
let single = todo;
if (todo.length > 1) {
  const raw = path.join(RAW, `take-${Date.now()}.wav`);
  await take(todo.map((l) => l[lang]), `${STYLE}\nPause for a full second between lines.`, raw);
  const pieces = splitTake(raw, todo.map((l) => l[lang]));
  if (pieces) { todo.forEach((line, i) => { finish(raw, line.id, Math.max(0, pieces[i][0] - 0.08), pieces[i][1] + 0.12); done(line); }); single = []; }
  else console.log(lang, "the take would not split cleanly — one request per line");
}
for (const line of single) {
  const raw = await take([line[lang]], STYLE, path.join(RAW, `${line.id}.wav`));
  finish(raw, line.id); done(line);
}
const durations = Object.fromEntries(SCRIPT.lines.map((l) => [l.id, +dur(path.join(OUT, `${l.id}.wav`)).toFixed(3)]));
fs.writeFileSync(path.join(OUT, "durations.json"), JSON.stringify(durations, null, 1));
console.log("wrote", OUT);
