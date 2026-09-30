// Puts the sound on a rendered tutorial picture: the voice lines at their
// seconds (timeline.mjs), a soft synthesised pad under everything (made here,
// so no music licence), a quiet tick on each click and a chime when the
// confirmation email arrives. Levelled to −14 LUFS for Facebook/YouTube.
//   node mix.mjs desktop bn   → out/<id>/tutorial-<id>-desktop-bn.mp4
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadScript } from "./script.mjs";
import { tutorialTimeline, videoTime } from "./timeline.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const [device = "desktop", lang = "bn"] = process.argv.slice(2);
const script = loadScript();   // TUT=<id> picks the tutorial (script.mjs)
const pub = path.resolve(here, "../../video/public/tutorial", script.id);
const capture = JSON.parse(fs.readFileSync(path.join(pub, device, "capture.json"), "utf8"));
const durations = JSON.parse(fs.readFileSync(path.join(pub, `vo-${lang}`, "durations.json"), "utf8"));
const tl = tutorialTimeline(script, capture, durations);
const OUT = path.join(here, "out", script.id);
const tag = `${script.id}-${device}-${lang}`;
const picture = path.join(OUT, `tutorial-${tag}-picture.mp4`);
const out = path.join(OUT, `tutorial-${tag}.mp4`);

// ---- the bed: pad + ticks + chime, synthesised ----------------------------------
const SR = 48000, N = Math.ceil(SR * tl.total);
const L = new Float32Array(N), R = new Float32Array(N);
const add = (i, l, r = l) => { if (i >= 0 && i < N) { L[i] += l; R[i] += r; } };
// a slow, warm chord that breathes; quieter under the voice (mixed below)
const chord = [[110, 0.5], [164.81, 0.32], [220, 0.3], [277.18, 0.18], [329.63, 0.16]];
for (let i = 0; i < N; i++) {
  const s = i / SR;
  const env = Math.min(1, s / 2.5) * Math.min(1, (tl.total - s) / 3);
  const breathe = 0.75 + 0.25 * Math.sin(2 * Math.PI * s / 7.3);
  let v = 0;
  for (const [f, a] of chord) v += a * Math.sin(2 * Math.PI * f * s + Math.sin(2 * Math.PI * 0.11 * s) * 0.6);
  v *= 0.045 * env * breathe;
  add(i, v, v * 0.96);
}
const tick = (t) => { const i0 = Math.round(t * SR); for (let k = 0; k < SR * 0.04; k++) { const s = k / SR, v = Math.sin(2 * Math.PI * 1800 * s) * Math.exp(-s / 0.006) * 0.22; add(i0 + k, v); } };
const chime = (t) => { for (const [f, d] of [[1046.5, 0], [1318.5, 0.12], [1568, 0.24]]) { const i0 = Math.round((t + d) * SR); for (let k = 0; k < SR * 0.9; k++) { const s = k / SR, v = Math.sin(2 * Math.PI * f * s) * Math.exp(-s / 0.3) * 0.08; add(i0 + k, v); } } };
for (const e of capture.events) {
  if (e.type === "click") tick(videoTime(tl, e.t));
  if (e.type === "mail") chime(videoTime(tl, e.t) + 0.1);
}
const bed = path.join(OUT, `bed-${tag}.wav`);
const pcm = Buffer.alloc(44 + N * 4);
pcm.write("RIFF", 0); pcm.writeUInt32LE(36 + N * 4, 4); pcm.write("WAVE", 8); pcm.write("fmt ", 12); pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22);
pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34); pcm.write("data", 36); pcm.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4); pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4); }
fs.writeFileSync(bed, pcm);

// ---- the mix ----------------------------------------------------------------------
const spoken = tl.segs.map((s) => `between(t,${(s.voiceAt - 0.1).toFixed(2)},${(s.voiceAt + s.voice).toFixed(2)})`).join("+");
const inputs = ["-i", picture, "-i", bed];
const parts = [`[1:a]volume='if(gt(${spoken},0),0.55,1)':eval=frame[bed]`];
tl.segs.forEach((s, i) => {
  inputs.push("-i", path.join(pub, `vo-${lang}`, `${s.id}.wav`));
  const ms = Math.round(s.voiceAt * 1000);
  parts.push(`[${i + 2}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms}[v${i}]`);
});
parts.push(`[bed]${tl.segs.map((_, i) => `[v${i}]`).join("")}amix=inputs=${tl.segs.length + 1}:normalize=0:duration=longest,atrim=0:${tl.total.toFixed(3)},loudnorm=I=-14:TP=-1.0:LRA=9[aout]`);
const args = ["-y", "-loglevel", "error", ...inputs, "-filter_complex", parts.join(";"), "-map", "0:v", "-map", "[aout]",
  "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", tl.total.toFixed(3), "-movflags", "+faststart", out];
for (let a = 1; ; a++) { try { execFileSync("ffmpeg", args, { stdio: "inherit" }); break; } catch (e) { if (a >= 4) throw e; console.error("ffmpeg crashed, retrying"); } }
console.log("wrote", out, `${tl.total.toFixed(1)} s`);
