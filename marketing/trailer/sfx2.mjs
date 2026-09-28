// Sound effects for the second cut, synthesised (no samples): the clock, rain,
// whooshes on the cuts, impacts on the title cards, a heartbeat, buzzes, a riser
// into a digital glitch and dead silence, the chat's pops, and the big hit on
// the logo. The score itself is the Pixabay track; this layer sits on top.
// Times from teaser.json and video/src/trailer/Teaser.jsx.
//   node sfx2.mjs   → video/public/trailer/sfx2.wav (48 kHz stereo)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const TL = JSON.parse(fs.readFileSync(path.join(here, "teaser.json"), "utf8"));
const OUT = path.resolve(here, "../../video/public/trailer/sfx2.wav");
const SR = 48000, LEN = TL.seconds, N = SR * LEN;
const dry = [new Float32Array(N), new Float32Array(N)];
const wet = [new Float32Array(N), new Float32Array(N)];
let seed = 11;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const idx = (t) => Math.max(0, Math.min(N - 1, Math.round(t * SR)));
const put = (bus, i, l, r = l) => { if (i >= 0 && i < N) { bus[0][i] += l; bus[1][i] += r; } };

function tick(t, hi, amp = 0.16) {
  const f = hi ? 3300 : 2400;
  for (let k = 0; k < SR * 0.05; k++) { const s = k / SR; const v = Math.sin(2 * Math.PI * f * s) * Math.exp(-s / 0.009) * amp + (k < 80 ? rnd() * amp * 0.6 : 0); put(dry, idx(t) + k, v, v * 0.9); put(wet, idx(t) + k, v * 0.3, v * 0.3); }
}
function buzz(t, dur = 0.18, amp = 0.2) {
  for (let k = 0; k < SR * dur; k++) { const s = k / SR, e = Math.min(1, s / 0.008) * Math.min(1, (dur - s) / 0.02); const v = (Math.sin(2 * Math.PI * 175 * s) + 0.4 * Math.sin(2 * Math.PI * 525 * s) + 0.2 * rnd()) * e * amp; put(dry, idx(t) + k, v, v); }
}
function thump(t, amp) { for (let k = 0; k < SR * 0.28; k++) { const s = k / SR, f = 64 - 24 * Math.min(1, s / 0.09); put(dry, idx(t) + k, Math.sin(2 * Math.PI * f * s) * Math.exp(-s / 0.08) * amp); } }
function beat(t, amp) { thump(t, amp); thump(t + 0.25, amp * 0.6); }
function whoosh(t, dur = 0.55, amp = 0.35) {
  let lp = 0;
  for (let k = 0; k < SR * dur; k++) {
    const s = k / SR, x = s / dur, env = Math.sin(Math.PI * x) ** 2, c = 0.02 + 0.25 * env;
    lp += c * (rnd() - lp); const pan = x * 2 - 1;
    put(dry, idx(t - dur * 0.6) + k, lp * env * amp * (1 - pan * 0.6), lp * env * amp * (1 + pan * 0.6));
  }
}
function impact(t, amp = 0.8) {
  for (let k = 0; k < SR * 2.5; k++) { const s = k / SR, f = s < 0.25 ? 95 - 55 * (s / 0.25) : 40; const v = Math.sin(2 * Math.PI * f * s) * Math.exp(-s / 0.7) * amp; put(dry, idx(t) + k, v); put(wet, idx(t) + k, v * 0.25); }
  let lp = 0; for (let k = 0; k < SR * 0.6; k++) { lp += 0.12 * (rnd() - lp); const v = lp * Math.exp(-k / SR / 0.1) * 1.6 * amp; put(wet, idx(t) + k, v, v); }
  // a metallic ring on top, what a trailer "hit" has besides the boom
  for (let k = 0; k < SR * 1.6; k++) { const s = k / SR; const v = (Math.sin(2 * Math.PI * 523 * s) * 0.5 + Math.sin(2 * Math.PI * 787 * s) * 0.35 + Math.sin(2 * Math.PI * 1311 * s) * 0.2) * Math.exp(-s / 0.35) * 0.06 * amp; put(wet, idx(t) + k, v, v * 0.9); }
}
function riser(t0, t1, amp = 0.5) {
  let lp = 0;
  for (let i = idx(t0); i < idx(t1); i++) { const x = (i / SR - t0) / (t1 - t0); lp += (0.01 + 0.35 * x * x) * (rnd() - lp); const f = 80 + 900 * x * x; const v = (lp * 0.9 + Math.sin(2 * Math.PI * f * (i / SR)) * 0.25) * amp * x ** 2; put(dry, i, v, v); }
}
function glitch(t, dur = 0.35) { for (let k = 0; k < SR * dur; k++) { const s = k / SR; const on = Math.floor(s * 40) % 2 === 0; const v = on ? (Math.sign(Math.sin(2 * Math.PI * (300 + 2000 * rnd() * 0.02) * s)) * 0.12 + rnd() * 0.15) : 0; put(dry, idx(t) + k, v, -v); } }
function pop(t, f, amp = 0.12) { for (let k = 0; k < SR * 0.12; k++) { const s = k / SR, v = Math.sin(2 * Math.PI * (f + 400 * s) * s) * Math.exp(-s / 0.035) * amp; put(dry, idx(t) + k, v); put(wet, idx(t) + k, v * 0.5); } }
function rain(t0, t1, amp) { let lp = 0, hp = 0; for (let i = idx(t0); i < idx(t1); i++) { const n = rnd(); lp += 0.25 * (n - lp); hp = n - lp; const e = Math.min(1, (i / SR - t0) / 0.3) * Math.min(1, (t1 - i / SR) / 0.3); const drop = rnd() > 0.9993 ? 0.5 : 0; put(dry, i, (hp * 0.35 + drop * rnd()) * amp * e, (hp * 0.35 + drop * rnd()) * amp * e); } }
function chirp(t, amp) { for (let r = 0; r < 3; r++) for (let k = 0; k < SR * 0.07; k++) { const s = k / SR, f = 3600 + 1800 * (s / 0.07); put(wet, idx(t + r * 0.11) + k, Math.sin(2 * Math.PI * f * s) * Math.sin(Math.PI * s / 0.07) * amp); } }
function drone(t0, t1, amp) { for (let i = idx(t0); i < idx(t1); i++) { const t = i / SR, e = Math.min(1, (t - t0) / 1.5) * Math.min(1, (t1 - t) / 1.0); const v = (Math.sin(2 * Math.PI * 41 * t) + 0.6 * Math.sin(2 * Math.PI * 61.7 * t)) * amp * e; put(dry, i, v, v); } }

// ---- the cue sheet -----------------------------------------------------------
const [S0, S1] = TL.silence;
for (let t = 0.2, n = 0; t < 19; t += 1, n++) tick(t, n % 2 === 0, t < 1 ? 0.22 : 0.13);
rain(1.0, 4.4, 0.35); rain(25.0, 28.1, 0.3);
[4.3, 8.6, 13.0, 17.0, 19.0, 25.0, 29.0, 33.0, 47.0].forEach((t) => whoosh(t));
buzz(9.0); buzz(9.25); buzz(10.7, 0.15, 0.15); buzz(11.9, 0.15, 0.15);
for (let t = 19.2, g = 0.7; t < 23.8; t += g, g = Math.max(0.09, g * 0.82)) buzz(t, 0.12, 0.13);
[24.0, 28.0, 32.0].forEach((t) => impact(t, 0.9));
for (let b = 29.0; b < 37.3;) { const bpm = 72 + (140 - 72) * ((b - 29) / 8.3); beat(b, 0.55); b += 60 / bpm; }
for (let t = 33.2; t < 36.5; t += 0.35) buzz(t, 0.1, 0.1);
riser(34.2, S0 - 0.15, 0.6); glitch(S0 - 0.35);
pop(38.3, 1200, 0.06);                                    // the one click in the silence
[40.5, 42.1, 43.6, 44.8].forEach((t) => pop(t, 760, 0.11));
[41.4, 42.9, 44.1].forEach((t) => pop(t, 480, 0.08));
pop(45.8, 980, 0.14);
[47.4, 48.3, 49.2].forEach((t, i) => chirp(t, 0.03 + 0.01 * i));
riser(49.2, TL.hit - 0.02, 0.5); impact(TL.hit, 1.2); drone(TL.hit, TL.seconds, 0.05);

// ---- reverb, the silence, write --------------------------------------------------
function reverb(x) {
  const y = new Float32Array(N);
  for (const [d, g] of [[1687, 0.86], [1753, 0.85], [1609, 0.87], [1543, 0.88]]) { const buf = new Float32Array(d); let p = 0; for (let i = 0; i < N; i++) { const o = buf[p]; buf[p] = x[i] + o * g; y[i] += o * 0.25; p = (p + 1) % d; } }
  for (const [d, g] of [[243, 0.5], [601, 0.5]]) { const buf = new Float32Array(d); let p = 0; for (let i = 0; i < N; i++) { const b = buf[p], v = -g * y[i] + b; buf[p] = y[i] + g * v; y[i] = v; p = (p + 1) % d; } }
  return y;
}
const mix = [0, 1].map((c) => { const r = reverb(wet[c]); const m = new Float32Array(N); for (let i = 0; i < N; i++) m[i] = dry[c][i] + wet[c][i] * 0.7 + r[i] * 0.55; return m; });
// the silence is silence: nothing but the one click
for (const m of mix) for (let i = idx(S0); i < idx(S1); i++) { const t = i / SR; if (!(t >= 38.3 && t < 38.45)) m[i] *= Math.max(0, 1 - (i - idx(S0)) / (SR * 0.04)); }
let peak = 0; for (const m of mix) for (const v of m) peak = Math.max(peak, Math.abs(v));
const gain = 0.89 / peak;
const pcm = Buffer.alloc(44 + N * 4);
pcm.write("RIFF", 0); pcm.writeUInt32LE(36 + N * 4, 4); pcm.write("WAVE", 8); pcm.write("fmt ", 12);
pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22); pcm.writeUInt32LE(SR, 24);
pcm.writeUInt32LE(SR * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34); pcm.write("data", 36); pcm.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) for (let c = 0; c < 2; c++) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[c][i] * gain)) * 32767), 44 + i * 4 + c * 2);
fs.writeFileSync(OUT, pcm);
console.log("wrote", OUT, `peak ${peak.toFixed(3)} gain ${gain.toFixed(2)}`);
