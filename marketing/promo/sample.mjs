// A voice sample for the owner to approve before the full clone: the given
// lines back to back with the ad's own breaths, dry and over the ducked beat.
//   node sample.mjs 01 02 03 …   → out/voice-sample-dry.m4a, out/voice-sample-music.m4a
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.resolve(here, "../../video/public/promo");
const { lines } = JSON.parse(fs.readFileSync(path.join(here, "lines.json"), "utf8"));
const ids = process.argv.slice(2);
const AFTER = { "03": 0.45, "04": 0.35, "06": 0.4, "09": 0.15, "10": 0.75, "12": 0.4 };
let t = 0.3;
const at = ids.map((id) => { const s = t; t += lines.find((l) => l.id === id).dur + (AFTER[id] ?? 0.3); return s; });
const total = t + 0.6;

const inputs = ids.flatMap((id) => ["-i", path.join(PUB, "vo", `${id}.wav`)]);
const vo = ids.map((_, i) => `[${i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round(at[i] * 1000)}|${Math.round(at[i] * 1000)}[v${i}]`).join(";");
const mixv = `${ids.map((_, i) => `[v${i}]`).join("")}amix=inputs=${ids.length}:normalize=0:duration=longest,apad,atrim=0:${total.toFixed(2)}`;
const run = (args) => { for (let a = 0; ; a++) { try { return execFileSync("ffmpeg", args, { stdio: "inherit" }); } catch (e) { if (a >= 3) throw e; } } };

run(["-y", "-loglevel", "error", ...inputs, "-filter_complex", `${vo};${mixv},loudnorm=I=-16:TP=-1.5[out]`,
  "-map", "[out]", "-c:a", "aac", "-b:a", "160k", path.join(here, "out", "voice-sample-dry.m4a")]);
const duck = ids.map((id, i) => `between(t,${(at[i] - 0.1).toFixed(2)},${(at[i] + lines.find((l) => l.id === id).dur).toFixed(2)})`).join("+");
run(["-y", "-loglevel", "error", ...inputs, "-i", path.join(PUB, "music-beat-way-up.mp3"), "-filter_complex",
  `${vo};${mixv}[voice];[${ids.length}:a]aresample=48000,atrim=0:${total.toFixed(2)},afade=t=out:st=${(total - 1).toFixed(2)}:d=1,volume='if(gt(${duck},0),0.17,0.3)':eval=frame[m];[voice][m]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1[out]`,
  "-map", "[out]", "-c:a", "aac", "-b:a", "160k", path.join(here, "out", "voice-sample-music.m4a")]);
console.log(`sample ${total.toFixed(1)}s`);
