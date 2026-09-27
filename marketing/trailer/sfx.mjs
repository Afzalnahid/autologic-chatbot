// The teaser's sound design, synthesised from scratch so nothing in it is
// someone else's recording: room tone, a clock, phone buzzes, a heartbeat, a
// hard cut to silence, a string-like swell, morning birds, a riser and a bass
// hit. Times follow the picture in video/src/trailer/Trailer.jsx.
//   node sfx.mjs   → video/public/trailer/sfx.wav (44.1 kHz stereo, 47 s)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, "../../video/public/trailer/sfx.wav");
const SR = 44100, LEN = 47;
const N = SR * LEN;
const dry = [new Float32Array(N), new Float32Array(N)];
const wet = [new Float32Array(N), new Float32Array(N)]; // goes through the reverb

let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const idx = (t) => Math.max(0, Math.min(N - 1, Math.round(t * SR)));
const put = (bus, i, l, r = l) => { if (i >= 0 && i < N) { bus[0][i] += l; bus[1][i] += r; } };

// ---- instruments -----------------------------------------------------------
function tick(t, hi) {
  const f = hi ? 3100 : 2300;
  for (let k = 0; k < SR * 0.04; k++) {
    const s = k / SR;
    const v = Math.sin(2 * Math.PI * f * s) * Math.exp(-s / 0.008) * 0.10 + (k < 60 ? rnd() * 0.06 : 0);
    put(dry, idx(t) + k, v * 0.9, v);
  }
}
function buzz(t, dur = 0.2, amp = 0.16) {
  for (let k = 0; k < SR * dur; k++) {
    const s = k / SR, e = Math.min(1, s / 0.01) * Math.min(1, (dur - s) / 0.03);
    const v = (Math.sin(2 * Math.PI * 175 * s) + 0.35 * Math.sin(2 * Math.PI * 525 * s) + 0.15 * rnd()) * e * amp;
    put(dry, idx(t) + k, v, v);
  }
}
function thump(t, amp) {
  for (let k = 0; k < SR * 0.25; k++) {
    const s = k / SR, f = 62 - 20 * Math.min(1, s / 0.08);
    const v = Math.sin(2 * Math.PI * f * s) * Math.exp(-s / 0.07) * amp;
    put(dry, idx(t) + k, v, v);
  }
}
function beat(t, amp) { thump(t, amp); thump(t + 0.26, amp * 0.6); }
function note(t, dur, f, amp, att = 1.6, rel = 1.6, bus = wet, pan = 0) {
  const parts = [[1, 1], [2, 0.35], [3, 0.18], [4, 0.08]];
  for (let k = 0; k < SR * dur; k++) {
    const s = k / SR;
    const e = Math.min(1, s / att) * Math.min(1, (dur - s) / rel);
    let v = 0;
    for (const [h, a] of parts) for (const d of [-0.004, 0, 0.005]) v += Math.sin(2 * Math.PI * f * h * (1 + d) * s) * a;
    v *= (amp * e) / 6;
    put(bus, idx(t) + k, v * (1 - pan), v * (1 + pan));
  }
}
function chord(t, dur, freqs, amp, att, rel) { freqs.forEach((f, i) => note(t, dur, f, amp, att, rel, wet, (i % 2 ? 0.25 : -0.25))); }
function pop(t, f, amp = 0.12) {
  for (let k = 0; k < SR * 0.12; k++) {
    const s = k / SR, v = Math.sin(2 * Math.PI * (f + 400 * s) * s) * Math.exp(-s / 0.035) * amp;
    put(dry, idx(t) + k, v, v); put(wet, idx(t) + k, v * 0.5, v * 0.5);
  }
}
function chirp(t, amp) {
  for (let r = 0; r < 3; r++) for (let k = 0; k < SR * 0.07; k++) {
    const s = k / SR, f = 3600 + 1800 * (s / 0.07);
    const v = Math.sin(2 * Math.PI * f * s) * Math.sin(Math.PI * s / 0.07) * amp;
    put(wet, idx(t + r * 0.11) + k, v * 0.7, v);
  }
}
function noiseBed(t0, t1, ampAt, cutAt) {
  let lp = 0;
  for (let i = idx(t0); i < idx(t1); i++) {
    const t = i / SR, c = cutAt(t);
    lp += c * (rnd() - lp);
    put(dry, i, lp * ampAt(t), lp * ampAt(t) * 0.95);
  }
}
function hit(t) {
  for (let k = 0; k < SR * 4; k++) {
    const s = k / SR, f = s < 0.35 ? 110 - 72 * (s / 0.35) : 38;
    const v = Math.sin(2 * Math.PI * f * s) * Math.exp(-s / 1.1) * 0.55;
    put(dry, idx(t) + k, v, v); put(wet, idx(t) + k, v * 0.3, v * 0.3);
  }
  let lp = 0;
  for (let k = 0; k < SR * 0.5; k++) { lp += 0.08 * (rnd() - lp); const v = lp * Math.exp(-k / SR / 0.12) * 1.4; put(wet, idx(t) + k, v, v); }
}

// ---- the score -------------------------------------------------------------
const CUT = 19.6; // everything stops here: the silence before the answer

// room tone + a low, slowly tightening drone under the night scenes
noiseBed(0, CUT, (t) => 0.05 + 0.03 * (t / CUT), () => 0.02);
for (let i = 0; i < idx(CUT); i++) {
  const t = i / SR, a = 0.03 + 0.07 * (t / CUT) ** 1.5;
  const v = (Math.sin(2 * Math.PI * 55 * t) + Math.sin(2 * Math.PI * 55.6 * t) + 0.5 * Math.sin(2 * Math.PI * 82.4 * t)) * a;
  put(dry, i, v, v);
}
// the clock
for (let t = 0.3, n = 0; t < CUT - 0.2; t += 1, n++) tick(t, n % 2 === 0);
// the first message, then the pile-up
buzz(3.9); buzz(4.2);
let t = 8.4, gap = 0.8;
while (t < 13.8) { buzz(t, 0.16, 0.13); t += gap; gap = Math.max(0.1, gap * 0.8); }
// heartbeat: in at 9 s, racing by 14 s, slowing into the dimming screen
for (let b = 9.0; b < CUT - 0.4;) {
  const bpm = b < 14.2 ? 70 + (125 - 70) * ((b - 9) / 5.2) : 125 - (125 - 50) * ((b - 14.2) / (CUT - 14.2));
  beat(b, 0.5); b += 60 / bpm;
}
// silence … then one soft click as the typing indicator appears
pop(20.6, 1200, 0.05);
// the swell under the answers (A minor, lifting to F major)
chord(24.8, 5.2, [110, 164.8, 220, 261.6], 0.22, 2.2, 1.5);
chord(29.2, 5.0, [87.3, 174.6, 220, 261.6, 349.2], 0.24, 1.2, 2.0);
[25.0, 27.3, 29.3, 31.2].forEach((x) => pop(x, 760, 0.10));   // bot replies
[26.6, 28.4, 30.4].forEach((x) => pop(x, 480, 0.07));         // customer messages
pop(32.3, 980, 0.13);                                            // order confirmed
// morning: C major, birds
chord(33.6, 5.0, [130.8, 196, 261.6, 329.6, 392], 0.2, 1.4, 2.4);
[34.0, 35.1, 36.3, 37.2].forEach((x, i) => chirp(x, 0.03 + 0.01 * (i % 2)));
// riser into the logo, the hit, and a soft chord under the end card
noiseBed(37.9, 39.0, (x) => 0.02 + 0.5 * ((x - 37.9) / 1.1) ** 2, (x) => 0.02 + 0.3 * ((x - 37.9) / 1.1));
hit(39.0);
chord(43.2, 3.8, [110, 164.8, 220], 0.12, 1.2, 2.2);

// ---- reverb (a small Schroeder: four combs, two all-passes) ---------------
function reverb(x) {
  const y = new Float32Array(N);
  for (const [d, g] of [[1557, 0.84], [1617, 0.83], [1491, 0.85], [1422, 0.86]]) {
    const buf = new Float32Array(d); let p = 0;
    for (let i = 0; i < N; i++) { const o = buf[p]; buf[p] = x[i] + o * g; y[i] += o * 0.25; p = (p + 1) % d; }
  }
  for (const [d, g] of [[225, 0.5], [556, 0.5]]) {
    const buf = new Float32Array(d); let p = 0;
    for (let i = 0; i < N; i++) { const b = buf[p], v = -g * y[i] + b; buf[p] = y[i] + g * v; y[i] = v; p = (p + 1) % d; }
  }
  return y;
}
const mix = [0, 1].map((c) => { const r = reverb(wet[c]); const m = new Float32Array(N); for (let i = 0; i < N; i++) m[i] = dry[c][i] + wet[c][i] * 0.7 + r[i] * 0.6; return m; });
// the cut to silence must be silence, reverb tails included
for (const m of mix) for (let i = idx(CUT); i < idx(20.55); i++) m[i] *= Math.max(0, 1 - (i - idx(CUT)) / (SR * 0.05));

let peak = 0; for (const m of mix) for (const v of m) peak = Math.max(peak, Math.abs(v));
const gain = 0.89 / peak;
const pcm = Buffer.alloc(44 + N * 4);
pcm.write("RIFF", 0); pcm.writeUInt32LE(36 + N * 4, 4); pcm.write("WAVE", 8); pcm.write("fmt ", 12);
pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22); pcm.writeUInt32LE(SR, 24);
pcm.writeUInt32LE(SR * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34); pcm.write("data", 36); pcm.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) for (let c = 0; c < 2; c++) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[c][i] * gain)) * 32767), 44 + i * 4 + c * 2);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, pcm);
console.log("wrote", OUT, `peak ${peak.toFixed(3)} → gain ${gain.toFixed(2)}`);
