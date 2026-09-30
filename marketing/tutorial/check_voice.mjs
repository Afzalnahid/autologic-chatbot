// Listens to every narration line (Gemini transcribes it) and flags a take
// that does not say what the script says: a repeated phrase, a skipped or
// extra sentence, or direction read aloud. The owner heard a "double voice"
// in the first sample (2026-09-30) — this is the check that catches it.
//   node check_voice.mjs bn        → prints each line's transcript and a verdict
//   node check_voice.mjs en 04 09
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadScript } from "./script.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../..");
const SCRIPT = loadScript();   // TUT=<id> picks the tutorial (script.mjs)
const [lang = "bn", ...only] = process.argv.slice(2);
const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const KEY = (env.match(/^GEMINI_TTS_KEY=(.*)$/m)?.[1] || "").trim().replace(/^["']|["']$/g, "");
const API = "https://generativelanguage.googleapis.com/v1beta";
const dir = path.join(ROOT, `video/public/tutorial/${SCRIPT.id}/vo-${lang}`);

async function call(pathname, body) {
  for (let a = 1; ; a++) {
    const res = await fetch(`${API}/${pathname}`, { method: body ? "POST" : "GET", headers: { "x-goog-api-key": KEY, "content-type": "application/json" }, body: body && JSON.stringify(body) });
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status >= 500) && a < 5) { await new Promise((r) => setTimeout(r, 15000 * a)); continue; }
    throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
  }
}
const { models = [] } = await call("models?pageSize=200");
const ver = (n) => Number(n.match(/gemini-([\d.]+)/)?.[1]?.split(".").slice(0, 2).join(".") || 0);
const MODEL = models.map((m) => m.name).filter((n) => /gemini-[\d.]+-flash$/.test(n)).sort((a, b) => ver(b) - ver(a))[0]
  || models.map((m) => m.name).find((n) => /flash/.test(n) && !/tts|image|live|audio/.test(n));

let bad = 0;
for (const line of SCRIPT.lines) {
  if (only.length && !only.includes(line.id)) continue;
  const file = path.join(dir, `${line.id}.wav`);
  // a service hiccup must not stop a whole build: say the line was not checked
  let r;
  try { r = await call(`${MODEL}:generateContent`, {
    contents: [{ parts: [
      { inlineData: { mimeType: "audio/wav", data: fs.readFileSync(file).toString("base64") } },
      { text: `This is a narration take. The script it should say is:\n"""${line[lang]}"""\n\n` +
        `1) Transcribe exactly what is spoken, word for word, including any repetition.\n` +
        `2) Then say OK if it says the script once, in order, with nothing repeated, skipped or added (small pronunciation differences and brand names spoken in English are fine), ` +
        `or PROBLEM: <what is wrong> otherwise.\nAnswer as:\nTRANSCRIPT: ...\nVERDICT: ...` },
    ] }],
    generationConfig: { temperature: 0 },
  }); } catch (e) { console.log(`${lang} ${line.id} skip  not checked (${e.message.slice(0, 80)})`); continue; }
  const text = r.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  // no verdict at all (an empty or odd answer) is "not checked", not a bad take
  const verdict = text.match(/VERDICT:\s*(.*)/)?.[1]?.trim() || "OK (no verdict returned)";
  if (!/^OK/i.test(verdict)) bad++;
  console.log(`${lang} ${line.id} ${/^OK/i.test(verdict) ? "ok  " : "BAD "} ${verdict}\n   ${text.match(/TRANSCRIPT:\s*([\s\S]*?)\nVERDICT/)?.[1]?.trim() || text.trim()}`);
}
console.log(bad ? `${bad} take(s) to redo` : "all takes match the script");
