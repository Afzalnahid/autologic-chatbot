// Voiceover: one MP3 per scene per language (Microsoft Edge neural voices,
// free), then the exact length of each clip so the timeline can be built to
// the narration. Re-runs only make the clips that are missing or whose text
// changed (a hash of the text sits beside each clip).
//   node tts.mjs [en|bn] [--film <name>]     default: both languages, the explainer
// A film other than the explainer lives in films/<name>/ (script, audio, durations).
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
const film = opt("--film") || "explainer";
const base = film === "explainer" ? "." : path.join("films", film);
if (!fs.existsSync(path.join(base, "script.json"))) { console.error(`no script at ${base}/script.json`); process.exit(1); }
const script = JSON.parse(fs.readFileSync(path.join(base, "script.json"), "utf8"));
const langs = positional[0] ? [positional[0]] : ["en", "bn"];
const durFile = path.join(base, "durations.json");
const durations = fs.existsSync(durFile) ? JSON.parse(fs.readFileSync(durFile, "utf8")) : {};

function durationOf(file) {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]).toString();
  return parseFloat(out) || 0;
}

for (const lang of langs) {
  fs.mkdirSync(path.join(base, "audio", lang), { recursive: true });
  for (const sc of script.scenes) {
    const out = path.join(base, "audio", lang, sc.id + ".mp3");
    const hashFile = out + ".txt";
    const text = sc[lang].vo;
    const hash = createHash("sha1").update(script.voices[lang] + script.rate[lang] + text).digest("hex");
    const fresh = fs.existsSync(out) && fs.statSync(out).size > 2000 && fs.existsSync(hashFile) && fs.readFileSync(hashFile, "utf8") === hash;
    if (!fresh) {
      let ok = false;
      for (let attempt = 1; attempt <= 4 && !ok; attempt++) {
        try {
          const tts = new MsEdgeTTS();
          await tts.setMetadata(script.voices[lang], OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
          const { audioStream } = tts.toStream(text, { rate: script.rate[lang] });
          const ws = fs.createWriteStream(out);
          audioStream.pipe(ws);
          await new Promise((res, rej) => { ws.on("finish", res); ws.on("error", rej); audioStream.on("error", rej); });
          tts.close?.();
          ok = fs.statSync(out).size > 2000;
        } catch (e) { console.error("retry", lang, sc.id, String(e.message || e).slice(0, 80)); await new Promise((r) => setTimeout(r, 1500 * attempt)); }
      }
      if (!ok) { console.error("FAILED", lang, sc.id); process.exitCode = 1; continue; }
      fs.writeFileSync(hashFile, hash);
    }
    durations[`${lang}/${sc.id}`] = durationOf(out);
    console.log(film, lang, sc.id, durations[`${lang}/${sc.id}`].toFixed(1) + "s", fresh ? "(kept)" : "");
  }
}
fs.writeFileSync(durFile, JSON.stringify(durations, null, 2));
const total = (l) => Object.entries(durations).filter(([k]) => k.startsWith(l + "/")).reduce((a, [, v]) => a + v, 0);
console.log(`TOTAL narration (${film})  en`, total("en").toFixed(0) + "s", " bn", total("bn").toFixed(0) + "s");
