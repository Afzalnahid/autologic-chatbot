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
import fs from "node:fs";
import path from "node:path";
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

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "models") {
  const { models = [] } = await call("models?pageSize=200");
  console.log(models.filter((m) => /tts/i.test(m.name)).map((m) => m.name).join("\n") || "no TTS models on this key");
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
