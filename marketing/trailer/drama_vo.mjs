// The film-trailer read (owner, 2026-09-28: "the voice vibe doesn't match" — the
// clone speaks the way he talks, not the way a trailer narrator does). Each
// polished line (video/public/trailer/vo/NN.mp3) gets:
//   · ~2.5 semitones lower and 6% slower (rubberband, formants moved with the
//     pitch, which is what makes a voice sound bigger rather than just lower);
//   · chest (low shelf) and edge (presence) lifts, heavy compression;
//   · a hall: a generated 1.8 s impulse response, mixed in at a quarter.
//   node drama_vo.mjs   → video/public/trailer/vo-drama/NN.wav + lines.json "dramaDur"
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const VO = path.resolve(here, "../../video/public/trailer/vo");
const OUT = path.resolve(here, "../../video/public/trailer/vo-drama");
const IR = path.join(OUT, "hall-ir.wav");
fs.mkdirSync(OUT, { recursive: true });
const linesFile = path.join(here, "lines.json");
const doc = JSON.parse(fs.readFileSync(linesFile, "utf8"));

const ff = (args) => {
  for (let a = 1; ; a++) {
    try { return execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]); }
    catch (e) { if (a >= 4) throw e; } // this machine's ffmpeg sometimes crashes (0xC0000005)
  }
};
const dur = (f) => +parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", f]).toString()).toFixed(2);

// a hall: decaying noise, a little darker as it dies
ff(["-f", "lavfi", "-i", "aevalsrc=(random(0)*2-1)*exp(-t/0.42)|(random(1)*2-1)*exp(-t/0.45):s=48000:d=1.8", "-af", "lowpass=f=6000", IR]);

for (const l of doc.lines) {
  const src = path.join(VO, `${l.id}.mp3`);
  const out = path.join(OUT, `${l.id}.wav`);
  const graph = [
    "[0:a]aresample=48000,aformat=channel_layouts=stereo,rubberband=pitch=0.865:tempo=0.94,",
    "lowshelf=f=140:g=4,equalizer=f=320:t=q:w=1:g=-2,equalizer=f=3000:t=q:w=1.2:g=2,",
    "acompressor=threshold=-24dB:ratio=4:attack=5:release=150:makeup=3,asplit[d][w];",
    "[w][1:a]afir=dry=0:wet=1[r];",
    "[d][r]amix=inputs=2:weights=1 0.28:normalize=0,apad=pad_dur=0.6,",
    "loudnorm=I=-15:TP=-1.5:LRA=7,alimiter=limit=0.9[o]",
  ].join("");
  ff(["-i", src, "-i", IR, "-filter_complex", graph, "-map", "[o]", "-ar", "48000", out]);
  l.dramaDur = dur(out);
  console.log(l.id, `${l.dramaDur}s`);
}
fs.writeFileSync(linesFile, JSON.stringify(doc, null, 2) + "\n");
