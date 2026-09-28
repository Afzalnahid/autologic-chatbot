// The second cut's sound, put on the rendered picture with the system ffmpeg:
//   · the score (Pixabay "Dark Mystery Trailer"): part A from its start, cut
//     dead for the silence, part B back in on its big hit — and pulled down
//     under every spoken line so the voice sits on top;
//   · the effects layer (sfx2.wav);
//   · the dramatised voice lines (vo-drama/NN.wav) at their seconds.
// Levelled to −14 LUFS for Reels.
//   node mix2.mjs   → out/tellmore-teaser-final.mp4
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.resolve(here, "../../video/public/trailer");
const TL = JSON.parse(fs.readFileSync(path.join(here, "teaser.json"), "utf8"));
const { lines } = JSON.parse(fs.readFileSync(path.join(here, "lines.json"), "utf8"));
const picture = path.join(here, "out", "tellmore-teaser-picture.mp4");
const out = path.join(here, "out", "tellmore-teaser-final.mp4");
const { a, b } = TL.music;

// music level: full, but a third lower wherever a line is being spoken
const spoken = lines.map((l) => [TL.vo[l.id], TL.vo[l.id] + (l.dramaDur || 3) - 0.4]);
const duck = spoken.map(([s, e]) => `between(t,${s.toFixed(2)},${e.toFixed(2)})`).join("+");
const musicVol = `volume='if(gt(${duck},0),0.42,0.7)':eval=frame`;

const inputs = ["-i", picture, "-i", path.join(PUB, TL.music.file), "-i", path.join(PUB, "sfx2.wav")];
const parts = [
  `[1:a]aresample=48000,asplit[m1][m2]`,
  `[m1]atrim=${a.from}:${a.to},asetpts=PTS-STARTPTS,afade=t=out:st=${(a.to - a.from - 0.15).toFixed(2)}:d=0.15,adelay=${Math.round(a.at * 1000)}|${Math.round(a.at * 1000)}[ma]`,
  `[m2]atrim=${b.from}:${b.to},asetpts=PTS-STARTPTS,afade=t=out:st=${(b.to - b.from - 2.5).toFixed(2)}:d=2.5,adelay=${Math.round(b.at * 1000)}|${Math.round(b.at * 1000)}[mb]`,
  `[ma][mb]amix=inputs=2:normalize=0:duration=longest,${musicVol}[music]`,
  `[2:a]volume=0.9[fx]`,
];
lines.forEach((l, i) => {
  inputs.push("-i", path.join(PUB, "vo-drama", `${l.id}.wav`));
  const ms = Math.round(TL.vo[l.id] * 1000);
  parts.push(`[${i + 3}:a]aresample=48000,aformat=channel_layouts=stereo,volume=1.15,adelay=${ms}|${ms}[v${i}]`);
});
parts.push(`[music][fx]${lines.map((_, i) => `[v${i}]`).join("")}amix=inputs=${lines.length + 2}:normalize=0:duration=longest,atrim=0:${TL.seconds},loudnorm=I=-14:TP=-1.0:LRA=11[aout]`);

const args = ["-y", "-loglevel", "error", ...inputs, "-filter_complex", parts.join(";"),
  "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", String(TL.seconds), out];
for (let attempt = 1; ; attempt++) {
  try { execFileSync("ffmpeg", args, { stdio: "inherit" }); break; }
  catch (e) { if (attempt >= 4) throw e; console.error("ffmpeg crashed, retrying"); }
}
console.log("wrote", out);
