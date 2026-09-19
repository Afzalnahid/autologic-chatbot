// Measures how the bed sits against the voice in the final mix, in numbers,
// because nobody here can listen to it: the bed on its own, the bed as it
// lands under speech (after the sidechain duck and the master gain), and the
// bed in a scene gap where nothing ducks it.
//   node audio-check.mjs en [bedVolume]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const lang = process.argv[2] || "en";
const bedVol = process.argv[3] || "0.55";
const info = JSON.parse(fs.readFileSync(`timeline-${lang}.json`, "utf8"));
const lufs = (args) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", ...args, "-af", "ebur128", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 64 << 20 }).stderr;
  const m = [...r.matchAll(/I:\s+(-?[\d.]+) LUFS/g)]; return m.length ? +m[m.length - 1][1] : NaN;
};
console.log("bed.wav alone        ", lufs(["-i", "build/bed.wav"]), "LUFS");
console.log("sfx.wav alone        ", lufs(["-i", "build/sfx.wav"]), "LUFS");
// Rebuild the ducked bed exactly as render.mjs does, then apply the same master gain.
const nar = info.vo.map((v) => ({ file: path.join("audio", lang, v.id + ".mp3"), at: v.at }));
const inputs = ["-i", "build/bed.wav"]; nar.forEach((v) => inputs.push("-i", v.file));
const parts = [];
const labels = nar.map((v, i) => { parts.push(`[${i + 1}:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay=${Math.round(v.at * 1000)}|${Math.round(v.at * 1000)}[n${i}]`); return `[n${i}]`; });
parts.push(`${labels.join("")}amix=inputs=${nar.length}:normalize=0[nar]`);
parts.push(`[0:a][nar]sidechaincompress=threshold=0.02:ratio=8:attack=60:release=700:makeup=1,volume=${bedVol}[bedv]`);
spawnSync("ffmpeg", ["-y", ...inputs, "-filter_complex", parts.join(";"), "-map", "[bedv]", "build/bedv.wav"], { stdio: "ignore" });
const gain = process.argv[4] || "5.3";
const s5 = info.scenes[4], s6 = info.scenes[5];
const voiceWin = [s5.t0 + 1, 20];                       // 20 s of scene 5, voice present
const gapWin = [s5.t0 + s5.D - 1.1, 0.7];               // after the VO ends, before the whoosh
console.log(`ducked bed under voice (${voiceWin[0].toFixed(1)}s +20s)`, (lufs(["-ss", String(voiceWin[0]), "-t", "20", "-i", "build/bedv.wav"]) + +gain).toFixed(1), "LUFS");
console.log(`bed in the scene gap   (${gapWin[0].toFixed(1)}s +0.7s)`, (lufs(["-ss", String(gapWin[0]), "-t", "0.7", "-i", "build/bedv.wav"]) + +gain).toFixed(1), "LUFS");
console.log("voice in the final mix (same 20 s window)", lufs(["-ss", String(voiceWin[0]), "-t", "20", "-i", `tellmoreai-explainer-${lang}.mp4`]), "LUFS");
