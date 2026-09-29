// Puts the sound on a rendered promo picture with the system ffmpeg:
//   · the beat (Pixabay "Advertising Presentation (Beat Way Up)", BombinSound):
//     its opening for the body of the ad, then its real ending for the last
//     seconds so the music finishes instead of fading mid-bar; pulled down under
//     every spoken line so the voice sits on top;
//   · the effects layer (sfx-<cut>.wav from sfx.mjs);
//   · the voice lines (video/public/promo/vo/NN.wav) at their seconds.
// Levelled to −14 LUFS for Reels and feed video.
//   node mix.mjs S V         → out/tellmore-promo-S-V.mp4        (cut S|L, frame V|Q)
//   node mix.mjs S V puck    → out/tellmore-promo-S-V-puck.mp4   (a stock voice: timeline-puck.json, vo-puck/)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.resolve(here, "../../video/public/promo");
const [cut = "S", frame = "V", variant] = process.argv.slice(2);
const TL = JSON.parse(fs.readFileSync(path.join(here, variant ? `timeline-${variant}.json` : "timeline.json"), "utf8"));
const tag = `-${cut}-${frame}${variant ? `-${variant}` : ""}`;
// brand.json's variants run brand.outro seconds longer (Autolinium's end card);
// the music's own ending then lands on that card
const BRAND = JSON.parse(fs.readFileSync(path.join(here, "brand.json"), "utf8"));
const { order, at } = TL.cuts[cut];
const seconds = TL.cuts[cut].seconds + (BRAND.variants.includes(variant) ? BRAND.outro : 0);
const picture = path.join(here, "out", `promo${tag}-picture.mp4`);
const out = path.join(here, "out", `tellmore-promo${tag}.mp4`);

const ENDING = [97.4, 103.0];            // the track's own last bar and ring-out
const endAt = seconds - (ENDING[1] - ENDING[0]);
const XF = 0.35;

const spoken = order.map((id) => [at[id] - 0.1, at[id] + TL.lines[id].dur]);
const duck = spoken.map(([s, e]) => `between(t,${s.toFixed(2)},${e.toFixed(2)})`).join("+");
const musicVol = `volume='if(gt(${duck},0),0.17,0.3)':eval=frame`;

const inputs = ["-i", picture, "-i", path.join(PUB, "music-beat-way-up.mp3"), "-i", path.join(PUB, `sfx-${cut}${variant ? `-${variant}` : ""}.wav`)];
const parts = [
  `[1:a]aresample=48000,asplit[m1][m2]`,
  `[m1]atrim=0:${(endAt + XF).toFixed(2)},asetpts=PTS-STARTPTS,afade=t=out:st=${endAt.toFixed(2)}:d=${XF}[ma]`,
  `[m2]atrim=${ENDING[0]}:${ENDING[1]},asetpts=PTS-STARTPTS,afade=t=in:d=${XF},adelay=${Math.round(endAt * 1000)}|${Math.round(endAt * 1000)}[mb]`,
  `[ma][mb]amix=inputs=2:normalize=0:duration=longest,${musicVol}[music]`,
  `[2:a]volume=0.85[fx]`,
];
order.forEach((id, i) => {
  inputs.push("-i", path.join(PUB, TL.vo || "vo", `${id}.wav`));
  const ms = Math.round(at[id] * 1000);
  parts.push(`[${i + 3}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms}[v${i}]`);
});
parts.push(`[music][fx]${order.map((_, i) => `[v${i}]`).join("")}amix=inputs=${order.length + 2}:normalize=0:duration=longest,atrim=0:${seconds},loudnorm=I=-14:TP=-1.0:LRA=9[aout]`);

const args = ["-y", "-loglevel", "error", ...inputs, "-filter_complex", parts.join(";"),
  "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", String(seconds), "-movflags", "+faststart", out];
for (let attempt = 1; ; attempt++) {
  try { execFileSync("ffmpeg", args, { stdio: "inherit" }); break; }
  catch (e) { if (attempt >= 4) throw e; console.error("ffmpeg crashed, retrying"); }
}
console.log("wrote", out);
