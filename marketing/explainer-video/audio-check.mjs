// Measures how the bed sits against the voice in the final mix, in numbers,
// because nobody here can listen to it: the bed on its own, the bed as it
// lands under speech (after the sidechain duck and the master gain), and the
// bed in a scene gap where nothing ducks it.
//   node audio-check.mjs en [bedVolume] [gainDb] [--film <name>]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
const lang = positional[0] || "en";
const bedVol = positional[1] || "0.55";
const gain = positional[2] || "5.3";
const film = opt("--film") || "explainer";
const base = film === "explainer" ? "." : path.join("films", film);
const tag = `${film}-${lang}`;
const info = JSON.parse(fs.readFileSync(path.join(base, `timeline-${lang}.json`), "utf8"));
const lufs = (a) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", ...a, "-af", "ebur128", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 64 << 20 }).stderr;
  const m = [...r.matchAll(/I:\s+(-?[\d.]+) LUFS/g)]; return m.length ? +m[m.length - 1][1] : NaN;
};
console.log("bed.wav alone        ", lufs(["-i", `build/bed-${tag}.wav`]), "LUFS");
console.log("sfx.wav alone        ", lufs(["-i", `build/sfx-${tag}.wav`]), "LUFS");
// Rebuild the ducked bed exactly as render.mjs does, then apply the same master gain.
const nar = info.vo.map((v) => ({ file: path.join(base, "audio", lang, v.id + ".mp3"), at: v.at }));
const inputs = ["-i", `build/bed-${tag}.wav`]; nar.forEach((v) => inputs.push("-i", v.file));
const parts = [];
const labels = nar.map((v, i) => { parts.push(`[${i + 1}:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay=${Math.round(v.at * 1000)}|${Math.round(v.at * 1000)}[n${i}]`); return `[n${i}]`; });
parts.push(`${labels.join("")}amix=inputs=${nar.length}:normalize=0[nar]`);
parts.push(`[0:a][nar]sidechaincompress=threshold=0.02:ratio=8:attack=60:release=700:makeup=1,volume=${bedVol}[bedv]`);
spawnSync("ffmpeg", ["-y", ...inputs, "-filter_complex", parts.join(";"), "-map", "[bedv]", "build/bedv.wav"], { stdio: "ignore" });
// a voiced window inside the longest scene, and the gap after its narration ends
const s = info.scenes.reduce((a, b) => (b.D > a.D ? b : a));
const win = Math.min(20, Math.max(3, s.D - 3));
const voiceWin = [s.t0 + 1, win];
const gapWin = [s.t0 + s.D - 1.1, 0.7];
console.log(`ducked bed under voice (${voiceWin[0].toFixed(1)}s +${win}s)`, (lufs(["-ss", String(voiceWin[0]), "-t", String(win), "-i", "build/bedv.wav"]) + +gain).toFixed(1), "LUFS");
console.log(`bed in the scene gap   (${gapWin[0].toFixed(1)}s +0.7s)`, (lufs(["-ss", String(gapWin[0]), "-t", "0.7", "-i", "build/bedv.wav"]) + +gain).toFixed(1), "LUFS");
console.log(`voice in the final mix (same window)`, lufs(["-ss", String(voiceWin[0]), "-t", String(win), "-i", `tellmoreai-${tag}.mp4`]), "LUFS");
