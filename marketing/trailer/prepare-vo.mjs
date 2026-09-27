// Turns the owner's own voice recordings into the teaser's voiceover.
// Put one recording per line in marketing/trailer/recordings/, named by line
// id — 01.m4a, 02.ogg, 03.mp3 … (any format a phone makes). Then:
//   node prepare-vo.mjs
// Each clip is cleaned (rumble cut, background hiss reduced, silence trimmed at
// both ends, loudness evened out to −16 LUFS), written over the scratch take in
// video/public/trailer/vo/, and its new length recorded in lines.json. A line
// that now runs into the next one is reported, so the timing can be moved.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const IN = path.join(here, "recordings");
const OUT = path.resolve(here, "../../video/public/trailer/vo");
const linesFile = path.join(here, "lines.json");
const doc = JSON.parse(fs.readFileSync(linesFile, "utf8"));
const files = fs.existsSync(IN) ? fs.readdirSync(IN) : [];

const FILTER = [
  "highpass=f=80",
  "afftdn=nf=-25",
  "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08",
  "areverse", "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15", "areverse",
  "acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120",
  "loudnorm=I=-16:LRA=7:TP=-1.5",
].join(",");

let done = 0;
for (const l of doc.lines) {
  const src = files.find((f) => path.parse(f).name === l.id);
  if (!src) { console.log(l.id, "— no recording, keeping the scratch take"); continue; }
  const out = path.join(OUT, `${l.id}.mp3`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", path.join(IN, src), "-af", FILTER, "-ar", "44100", "-ac", "1", "-b:a", "160k", out]);
  l.dur = +parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", out]).toString()).toFixed(2);
  l.ext = "mp3";
  done++;
  console.log(l.id, `${l.dur}s`, l.text);
}
doc.lines.forEach((l, i) => {
  const next = doc.lines[i + 1];
  if (next && l.at + l.dur > next.at - 0.2) console.log(`  ! line ${l.id} ends at ${(l.at + l.dur).toFixed(1)}s, too close to line ${next.id} at ${next.at}s`);
});
fs.writeFileSync(linesFile, JSON.stringify(doc, null, 2) + "\n");
console.log(`${done} recording(s) prepared`);
