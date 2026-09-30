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
const MODEL = models.map((m) => m.name).filter((n) => /tts/i.test(n) && !/lite/.test(n)).sort((a, b) => ver(b) - ver(a))[0];
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

// A line whose words have not changed keeps its take (the owner approves takes
// by ear; a new take of the same words would sound different). Asking for a
// line by id always makes a new take.
const SAID = path.join(OUT, "text.json");
const said = fs.existsSync(SAID) ? JSON.parse(fs.readFileSync(SAID, "utf8")) : {};
for (const line of SCRIPT.lines) {
  if (only.length && !only.includes(line.id)) continue;
  if (!only.length && said[line.id] === line[lang] && fs.existsSync(path.join(OUT, `${line.id}.wav`))) { console.log(lang, line.id, "unchanged — kept"); continue; }
  const raw = path.join(RAW, `${line.id}.wav`);
  const r = await call(`${MODEL}:generateContent`, {
    contents: [{ parts: [{ text: `${STYLE}\n\n#### TRANSCRIPT\n${say(line[lang])}` }] }],
    generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } },
  });
  const part = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) throw new Error(`line ${line.id}: no audio in the answer`);
  fs.writeFileSync(raw, wav(Buffer.from(part.inlineData.data, "base64"), Number(part.inlineData.mimeType.match(/rate=(\d+)/)?.[1] || 24000)));
  // trim the silence at both ends, gentle clean-up, 48 kHz stereo
  ff(["-y", "-i", raw, "-af", "aresample=48000,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse,highpass=f=70,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120,alimiter=limit=0.9",
    "-ac", "2", path.join(OUT, `${line.id}.wav`)]);
  console.log(lang, line.id, dur(path.join(OUT, `${line.id}.wav`)).toFixed(2), "s");
  said[line.id] = line[lang];
  fs.writeFileSync(SAID, JSON.stringify(said, null, 1));
}
const durations = Object.fromEntries(SCRIPT.lines.map((l) => [l.id, +dur(path.join(OUT, `${l.id}.wav`)).toFixed(3)]));
fs.writeFileSync(path.join(OUT, "durations.json"), JSON.stringify(durations, null, 1));
console.log("wrote", OUT);
