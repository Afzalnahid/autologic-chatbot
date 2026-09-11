// Voiceover: one MP3 per scene per language (Microsoft Edge neural voices,
// free), then the exact duration of each clip via ffmpeg so the video scene
// can be timed to the narration.
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";

const script = JSON.parse(fs.readFileSync("script.json", "utf8"));
const langs = process.argv[2] ? [process.argv[2]] : ["en", "bn"];
const durations = fs.existsSync("durations.json") ? JSON.parse(fs.readFileSync("durations.json", "utf8")) : {};

function durationOf(file) {
  try { execFileSync(ffmpeg, ["-i", file], { stdio: ["ignore", "pipe", "pipe"] }); }
  catch (e) {
    const m = String(e.stderr || "").match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
    if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3];
  }
  return 0;
}

for (const lang of langs) {
  fs.mkdirSync(path.join("audio", lang), { recursive: true });
  const tts = new MsEdgeTTS();
  await tts.setMetadata(script.voices[lang], OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  for (const sc of script.scenes) {
    const out = path.join("audio", lang, sc.id + ".mp3");
    if (!fs.existsSync(out) || fs.statSync(out).size < 2000) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const { audioStream } = tts.toStream(sc[lang].vo, { rate: "-4%" });
          const ws = fs.createWriteStream(out);
          audioStream.pipe(ws);
          await new Promise((res, rej) => { ws.on("finish", res); ws.on("error", rej); audioStream.on("error", rej); });
          if (fs.statSync(out).size > 2000) break;
        } catch (e) { console.error("retry", sc.id, lang, String(e.message || e).slice(0, 80)); }
      }
    }
    durations[`${lang}/${sc.id}`] = durationOf(out);
    console.log(lang, sc.id, durations[`${lang}/${sc.id}`].toFixed(1) + "s");
  }
  tts.close?.();
}
fs.writeFileSync("durations.json", JSON.stringify(durations, null, 2));
const total = (l) => Object.entries(durations).filter(([k]) => k.startsWith(l + "/")).reduce((a, [, v]) => a + v, 0);
console.log("TOTAL en", total("en").toFixed(0) + "s", "bn", total("bn").toFixed(0) + "s");
