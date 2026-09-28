// The teasers' voice in three Gemini stock voices at once (owner, 2026-09-29:
// "correct the voices in those trailers, three artists per video"). Replaces the
// owner's dramatised clone in both cuts.
//   · who says what: Fenrir opens the night, Sadachbia asks, Puck turns the story
//     ("তারপর হঠাৎ…") and answers; the last line, all three at once;
//   · a cinematic finish without the old pitch-drop: chest, a little edge, firm
//     compression, the same generated hall as drama_vo.mjs at a fifth;
//   · every line fitted to its slot in BOTH cuts (lines.json "at" for cut one,
//     teaser.json "vo" for cut two, which also must not cross the dead silence or
//     the big hit); a line too long is sped up, never more than 1.3×.
// Input: marketing/promo/out/gemini-trailer/<Voice>/NN.wav (gemini_tts.mjs trailer <Voice>).
//   node gemini_trio.mjs → video/public/trailer/vo-trio/NN.wav + lines.json dur / dramaDur
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "../promo/out/gemini-trailer");
const OUT = path.resolve(here, "../../video/public/trailer/vo-trio");
const IR = path.resolve(here, "../../video/public/trailer/vo-drama/hall-ir.wav");
const linesFile = path.join(here, "lines.json");
const doc = JSON.parse(fs.readFileSync(linesFile, "utf8"));
const TL = JSON.parse(fs.readFileSync(path.join(here, "teaser.json"), "utf8"));
const WHO = { "01": "Fenrir", "02": "Sadachbia", "03": "Fenrir", "04": "Sadachbia", "05": "Puck", "06": "Puck", "07": "Sadachbia", "08": "all" };
const PAD = 0.6; // room for the hall's tail

const ff = (args) => { for (let a = 1; ; a++) { try { return execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]); } catch (e) { if (a >= 4) throw e; } } };
const dur = (f) => +parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", f]).toString()).toFixed(2);

// the longest each line may be: the gap to the next line (less a breath), in the tighter of the two cuts
const ids = doc.lines.map((l) => l.id);
const room = (id) => {
  const i = ids.indexOf(id);
  const one = i < ids.length - 1 ? doc.lines[i + 1].at - doc.lines[i].at - 0.2 : 7;
  let two = i < ids.length - 1 ? TL.vo[ids[i + 1]] - TL.vo[id] - 0.2 : TL.seconds - TL.vo[id] - 3;
  if (TL.vo[id] < TL.silence[0]) two = Math.min(two, TL.silence[0] - TL.vo[id] - 0.1);   // stop before the dead silence
  if (TL.vo[id] >= TL.silence[0] && TL.vo[id] < TL.silence[1]) two = Math.min(two, TL.silence[1] - TL.vo[id] - 0.05); // the whisper ends before the hit
  return Math.min(one, two);
};

fs.mkdirSync(OUT, { recursive: true });
const tmp = path.join(OUT, "_dry.wav");
for (const l of doc.lines) {
  const who = WHO[l.id];
  // 1. the dry line: one voice, or all three from the same instant
  if (who === "all") {
    const src = ["Puck", "Fenrir", "Sadachbia"].map((v) => path.join(SRC, v, `${l.id}.wav`));
    ff([...src.flatMap((f) => ["-i", f]), "-filter_complex", "[0][1][2]amix=inputs=3:normalize=0:duration=longest,volume=0.62,aresample=48000", tmp]);
  } else {
    ff(["-i", path.join(SRC, who, `${l.id}.wav`), "-af", "aresample=48000", tmp]);
  }
  // 2. fit it: trim the silence at both ends, then speed up only if still too long
  const trimmed = path.join(OUT, "_trim.wav");
  ff(["-i", tmp, "-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse", trimmed]);
  const len = dur(trimmed), max = room(l.id);
  const speed = len > max ? Math.min(1.3, len / max) : 1;
  // 3. the cinematic finish
  const graph = [
    `[0:a]aformat=channel_layouts=stereo${speed > 1 ? `,atempo=${speed.toFixed(3)}` : ""},`,
    "highpass=f=70,lowshelf=f=140:g=3,equalizer=f=320:t=q:w=1:g=-2,equalizer=f=3000:t=q:w=1.2:g=2.5,highshelf=f=8000:g=2,",
    "acompressor=threshold=-22dB:ratio=3.5:attack=5:release=140:makeup=2.5,asplit[d][w];",
    "[w][1:a]afir=dry=0:wet=1[r];",
    `[d][r]amix=inputs=2:weights=1 0.2:normalize=0,apad=pad_dur=${PAD},`,
    "loudnorm=I=-15:TP=-1.5:LRA=7,alimiter=limit=0.9[o]",
  ].join("");
  const out = path.join(OUT, `${l.id}.wav`);
  ff(["-i", trimmed, "-i", IR, "-filter_complex", graph, "-map", "[o]", "-ar", "48000", out]);
  l.dramaDur = dur(out);              // cut two: subtitle and music duck read this
  l.dur = +(l.dramaDur - PAD).toFixed(2); // cut one: the spoken part only
  l.ext = "wav";
  console.log(l.id, who.padEnd(9), `${len.toFixed(2)}s`, `room ${max.toFixed(2)}s`, speed > 1 ? `sped ×${speed.toFixed(2)}${len / max > 1.3 ? " — STILL TOO LONG" : ""}` : "fits");
}
for (const f of ["_dry.wav", "_trim.wav"]) fs.rmSync(path.join(OUT, f), { force: true });
doc._voice = "vo-trio: three Gemini voices (gemini_trio.mjs); the owner's clone is in vo/ and vo-drama/";
fs.writeFileSync(linesFile, JSON.stringify(doc, null, 2) + "\n");
