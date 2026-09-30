// The three-voice cut (owner, 2026-09-29: "one video where you use 3 voices
// together"): three friends talking. Fenrir, the loud one, raises the problem and
// asks; Sadachbia, the lively one, jumps in; Puck, the upbeat one, has the answer.
// "টেলমোর এআই" (line 10) is said by all three at once. Lines 20 and 21 are one sentence,
// so one voice says both (owner, 2026-10-01).
// Takes the polished lines from vo-puck/, vo-fenrir/, vo-sadachbia/ (polish_promo.py --voice).
//   node make_trio.mjs   → video/public/promo/vo-trio/NN.wav + durations.json, then node timeline.mjs trio
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.resolve(here, "../../video/public/promo");
const OUT = path.join(PUB, "vo-trio");
const WHO = {
  "01": "fenrir", "02": "fenrir", "03": "sadachbia", "04": "sadachbia", "05": "fenrir", "06": "sadachbia",
  "07": "fenrir", "08": "fenrir", "09": "puck", "10": "all", "11": "puck", "12": "sadachbia",
  "13": "sadachbia", "14": "puck", "15": "sadachbia", "16": "puck", "23": "fenrir", "24": "sadachbia",
  "17": "fenrir", "18": "puck", "19": "puck", "25": "fenrir", "20": "puck", "21": "puck", "22": "puck",
};
const VOICES = ["puck", "fenrir", "sadachbia"];
const run = (bin, args) => { for (let a = 0; ; a++) { try { return execFileSync(bin, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); } catch (e) { if (a >= 3) throw e; } } };
const length = (f) => +(+run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).trim()).toFixed(2);

// Every line at the same loudness. Three voices, each take read on its own day,
// came out anywhere from -14 to -22 LUFS, and the owner heard line 20 drop
// (2026-10-01: "the voice got quieter here"). Each line is measured (EBU R128)
// and moved to TARGET, with a limiter so a raised line cannot clip.
const TARGET = -16;
function loudness(f) {
  for (let a = 0; a < 4; a++) {
    const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", f, "-af", "ebur128=framelog=quiet", "-f", "null", "-"], { encoding: "utf8" });
    const m = r.stderr?.match(/I:\s+(-?[\d.]+) LUFS/g);
    if (r.status === 0 && m) return +m.at(-1).match(/-?[\d.]+/)[0];
  }
  return NaN;
}
function level(f) {
  const i = loudness(f);
  if (!Number.isFinite(i) || i < -60) { console.log(`  ${path.basename(f)}: loudness not measured, left as it is`); return; }
  const gain = Math.max(-12, Math.min(12, TARGET - i));
  if (Math.abs(gain) < 0.3) return;
  const tmp = f.replace(/\.wav$/, ".lvl.wav");
  run("ffmpeg", ["-y", "-loglevel", "error", "-i", f, "-af", `volume=${gain.toFixed(2)}dB,alimiter=limit=0.89`, tmp]);
  fs.renameSync(tmp, f);
  console.log(`  ${path.basename(f)}: ${i.toFixed(1)} → ${TARGET} LUFS (${gain > 0 ? "+" : ""}${gain.toFixed(1)} dB)`);
}

fs.mkdirSync(OUT, { recursive: true });
const durs = {};
for (const [id, who] of Object.entries(WHO)) {
  const out = path.join(OUT, `${id}.wav`);
  if (who === "all") {
    const src = VOICES.map((v) => path.join(PUB, `vo-${v}`, `${id}.wav`));
    if (!src.every((f) => fs.existsSync(f))) continue;
    // all three from the same instant, a little quieter each, so the sum is not louder than one voice
    run("ffmpeg", ["-y", "-loglevel", "error", ...src.flatMap((f) => ["-i", f]), "-filter_complex",
      "[0][1][2]amix=inputs=3:normalize=0:duration=longest,volume=0.62,alimiter=limit=0.89", out]);
  } else {
    const src = path.join(PUB, `vo-${who}`, `${id}.wav`);
    if (!fs.existsSync(src)) continue;
    fs.copyFileSync(src, out);
  }
  level(out);
  durs[id] = length(out);
}
fs.writeFileSync(path.join(OUT, "durations.json"), JSON.stringify(durs, null, 1) + "\n");
console.log(`vo-trio: ${Object.keys(durs).length} lines`, Object.entries(durs).map(([k, v]) => `${k}:${WHO[k]}`).join(" "));
