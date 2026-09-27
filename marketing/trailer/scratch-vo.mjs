// A scratch voiceover for the teaser, so the picture can be cut to real timing
// before the owner records the real one. Computer voice (Microsoft Edge, free),
// slowed and lowered for a trailer read. Writes video/public/trailer/vo/NN.mp3
// and prints each line's length so an overlong line shows up at once.
//   node scratch-vo.mjs
import { MsEdgeTTS, OUTPUT_FORMAT } from "../explainer-video/node_modules/msedge-tts/dist/index.js";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, "../../video/public/trailer/vo");
fs.mkdirSync(OUT, { recursive: true });
const { lines } = JSON.parse(fs.readFileSync(path.join(here, "lines.json"), "utf8"));

for (const l of lines) {
  const out = path.join(OUT, `${l.id}.mp3`);
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata("bn-BD-PradeepNeural", OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(l.text, { rate: "-14%", pitch: "-6Hz" });
      const ws = fs.createWriteStream(out);
      audioStream.pipe(ws);
      await new Promise((res, rej) => { ws.on("finish", res); ws.on("error", rej); audioStream.on("error", rej); });
      if (fs.statSync(out).size > 2000) break;
    } catch (e) {
      console.error("retry", l.id, String(e.message || e).slice(0, 80));
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  const secs = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", out]).toString());
  console.log(l.id, `${l.at}s +${secs.toFixed(2)}s`, l.text);
}
