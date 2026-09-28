// Puts the teaser's sound on the picture with the system ffmpeg: the sound
// design at 60%, each voice line at its second from lines.json, the whole mix
// levelled to -14 LUFS for Reels. Remotion's bundled ffmpeg kept crashing on
// this machine (0xC0000005) in its audio step, so the picture is rendered
// --muted and the sound goes on here.
//   (in video/)  npx remotion render src/trailer/index.jsx Trailer ../marketing/trailer/out/tellmore-trailer-bn-picture.mp4 --muted
//   node mix.mjs   → out/tellmore-trailer-bn-final.mp4
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.resolve(here, "../../video/public/trailer");
// the three Gemini voices (vo-trio/, gemini_trio.mjs); `node mix.mjs clone` for the owner's clone (vo/*.mp3)
const CLONE = process.argv[2] === "clone";
const picture = path.join(here, "out", CLONE ? "tellmore-trailer-bn-picture.mp4" : "tellmore-trailer-bn-trio-picture.mp4");
const out = path.join(here, "out", CLONE ? "tellmore-trailer-bn-final.mp4" : "tellmore-trailer-bn-trio.mp4");
const { lines } = JSON.parse(fs.readFileSync(path.join(here, "lines.json"), "utf8"));

const inputs = ["-i", picture, "-i", path.join(PUB, "sfx.wav")];
const parts = ["[1:a]volume=0.6[s]"];
lines.forEach((l, i) => {
  inputs.push("-i", path.join(PUB, CLONE ? "vo" : "vo-trio", CLONE ? `${l.id}.mp3` : `${l.id}.wav`));
  const ms = Math.round(l.at * 1000);
  parts.push(`[${i + 2}:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay=${ms}|${ms}[v${i}]`);
});
const mixIn = ["[s]", ...lines.map((_, i) => `[v${i}]`)].join("");
parts.push(`${mixIn}amix=inputs=${lines.length + 1}:normalize=0:duration=first,loudnorm=I=-14:TP=-1.0:LRA=11[a]`);

const args = ["-y", "-loglevel", "error", ...inputs, "-filter_complex", parts.join(";"),
  "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", out];
for (let attempt = 1; ; attempt++) {
  try { execFileSync("ffmpeg", args, { stdio: "inherit" }); break; }
  catch (e) { if (attempt >= 3) throw e; console.error("ffmpeg crashed, retrying"); }
}
console.log("wrote", out);
