// The stock footage (Pexels, free for commercial use, downloaded with the
// owner's go-ahead on 2026-09-28) brought to one shape and one look before the
// film uses it: 1080×1920, 30 fps, no sound, and a trailer grade — crushed
// blacks, cool teal shadows for the night, warm gold for the morning.
//   node grade_clips.mjs   → video/public/trailer/cut/<name>.mp4
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "../../video/public/trailer/stock");
const OUT = path.resolve(here, "../../video/public/trailer/cut");
fs.mkdirSync(OUT, { recursive: true });

const FIT = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30";
// (a first, harder grade crushed the face and the street to black)
const NIGHT = "eq=contrast=1.1:brightness=0.02:saturation=0.8:gamma=1.18,colorbalance=rs=-0.05:bs=0.08:gs=0.02:rh=0.04:bh=-0.03,curves=all='0/0 0.1/0.07 0.5/0.53 1/1',vignette=PI/5";
const MORNING = "eq=contrast=1.12:brightness=0.0:saturation=0.9,colorbalance=rs=0.05:bs=-0.06:rh=0.08:gh=0.03:bh=-0.08,vignette=PI/5";

const CLIPS = [
  ["rain-window", NIGHT], ["face-phone", NIGHT], ["phone-bed", NIGHT],
  ["wet-street", NIGHT], ["clock", NIGHT], ["morning", MORNING],
];
for (const [name, grade] of CLIPS) {
  const out = path.join(OUT, `${name}.mp4`);
  for (let a = 1; ; a++) {
    try {
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", path.join(SRC, `${name}.mp4`), "-an",
        "-vf", `${FIT},${grade},format=yuv420p`, "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-movflags", "+faststart", out]);
      break;
    } catch (e) { if (a >= 4) throw e; } // the machine's random 0xC0000005
  }
  console.log("graded", name);
}
