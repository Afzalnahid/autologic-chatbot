// The promo's effects layer, synthesised (no samples), from timeline.json: a
// whoosh on each cut, a pop per chat bubble, a click, a notification ding, a hit
// on the big words, a riser into the logo and a boom on it, a till for "৳০".
// One file per cut and frame-independent (the sound is the same in 9:16 and 1:1).
//   node sfx.mjs S        → video/public/promo/sfx-S.wav (48 kHz stereo)
//   node sfx.mjs S puck   → sfx-S-puck.wav, from timeline-puck.json (a stock voice's timing)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const [cut = "S", variant] = process.argv.slice(2);
const TL = JSON.parse(fs.readFileSync(path.join(here, variant ? `timeline-${variant}.json` : "timeline.json"), "utf8"));
// brand.json's variants run brand.outro seconds longer: a whoosh into Autolinium's end card
const BRAND = JSON.parse(fs.readFileSync(path.join(here, "brand.json"), "utf8"));
const { order, at } = TL.cuts[cut];
const outro = BRAND.variants.includes(variant) ? BRAND.outro : 0;
const seconds = TL.cuts[cut].seconds + outro;
const OUT = path.resolve(here, `../../video/public/promo/sfx-${cut}${variant ? `-${variant}` : ""}.wav`);
const SR = 48000, N = Math.ceil(SR * seconds);
const bus = [new Float32Array(N), new Float32Array(N)];
let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const idx = (t) => Math.round(t * SR);
const put = (i, l, r = l) => { if (i >= 0 && i < N) { bus[0][i] += l; bus[1][i] += r; } };

const FX = {
  whoosh(t, amp = 0.28) { const dur = 0.4; let lp = 0; for (let k = 0; k < SR * dur; k++) { const x = k / SR / dur, e = Math.sin(Math.PI * x) ** 2; lp += (0.03 + 0.3 * e) * (rnd() - lp); const p = x * 2 - 1; put(idx(t - dur * 0.55) + k, lp * e * amp * (1 - p * 0.6), lp * e * amp * (1 + p * 0.6)); } },
  pop(t, amp = 0.16) { const f = 620 + 380 * ((rnd() + 1) / 2); for (let k = 0; k < SR * 0.09; k++) { const s = k / SR, v = Math.sin(2 * Math.PI * (f + 900 * s) * s) * Math.exp(-s / 0.025) * amp; put(idx(t) + k, v); } },
  click(t, amp = 0.25) { for (let k = 0; k < SR * 0.03; k++) { const s = k / SR, v = (rnd() * 0.6 + Math.sin(2 * Math.PI * 2200 * s)) * Math.exp(-s / 0.004) * amp; put(idx(t) + k, v); } },
  ding(t, amp = 0.13) { for (const [f, d] of [[1318.5, 0], [1760, 0.09]]) for (let k = 0; k < SR * 0.6; k++) { const s = k / SR, v = (Math.sin(2 * Math.PI * f * s) + 0.3 * Math.sin(2 * Math.PI * f * 2 * s)) * Math.exp(-s / 0.18) * amp; put(idx(t + d) + k, v); } },
  hit(t, amp = 0.55) { for (let k = 0; k < SR * 0.5; k++) { const s = k / SR, f = 110 - 60 * Math.min(1, s / 0.12); put(idx(t) + k, Math.sin(2 * Math.PI * f * s) * Math.exp(-s / 0.12) * amp); } let lp = 0; for (let k = 0; k < SR * 0.15; k++) { lp += 0.3 * (rnd() - lp); put(idx(t) + k, lp * Math.exp(-k / SR / 0.03) * amp); } },
  boom(t, amp = 0.8) { FX.hit(t, amp); for (let k = 0; k < SR * 1.8; k++) { const s = k / SR; put(idx(t) + k, Math.sin(2 * Math.PI * 45 * s) * Math.exp(-s / 0.6) * amp * 0.5); } for (let k = 0; k < SR * 1.2; k++) { const s = k / SR, v = (Math.sin(2 * Math.PI * 880 * s) * 0.4 + Math.sin(2 * Math.PI * 1320 * s) * 0.25) * Math.exp(-s / 0.35) * 0.07; put(idx(t) + k, v, v * 0.9); } },
  riser(t, amp = 0.3, until = 1) { let lp = 0; const n = Math.max(1, SR * until); for (let k = 0; k < n; k++) { const x = k / n; lp += (0.01 + 0.3 * x * x) * (rnd() - lp); const v = (lp + Math.sin(2 * Math.PI * (200 + 1200 * x * x) * (k / SR)) * 0.2) * amp * x * x; put(idx(t) + k, v, v); } },
  fail(t, amp = 0.2) { for (const [f, d] of [[392, 0], [330, 0.16], [262, 0.32]]) for (let k = 0; k < SR * 0.2; k++) { const s = k / SR, v = Math.sign(Math.sin(2 * Math.PI * f * s)) * Math.exp(-s / 0.12) * amp * 0.5; put(idx(t + d) + k, v); } },
  scan(t, amp = 0.08) { for (let k = 0; k < SR * 0.9; k++) { const s = k / SR, v = Math.sin(2 * Math.PI * (500 + 700 * s) * s) * amp * Math.sin(Math.PI * s / 0.9); put(idx(t) + k, v); } },
  send(t, amp = 0.22) { FX.whoosh(t + 0.25, amp); FX.ding(t + 0.3, 0.1); },
  cash(t, amp = 0.14) { FX.click(t, 0.3); for (let k = 0; k < SR * 0.7; k++) { const s = k / SR, v = (Math.sin(2 * Math.PI * 2093 * s) + 0.5 * Math.sin(2 * Math.PI * 2637 * s)) * Math.exp(-s / 0.2) * amp; put(idx(t + 0.05) + k, v); } },
};

// the flood of bubbles in line 07's hold, one pop each (Promo.jsx makes them every 0.13 s)
for (const [i, id] of order.entries()) {
  const base = at[id];
  for (const c of TL.lines[id].cues) FX[c.s](base + c.t, undefined, c.until != null ? c.until - c.t : undefined);
  if (id === "07") { const end = i < order.length - 1 ? at[order[i + 1]] - base : 0; for (let x = TL.lines[id].dur + 0.1; x < end; x += 0.13) FX.pop(base + x, 0.09); }
}

if (outro) { FX.whoosh(TL.cuts[cut].seconds, 0.24); FX.ding(TL.cuts[cut].seconds + 0.25, 0.07); }

let peak = 0; for (const c of bus) for (const v of c) peak = Math.max(peak, Math.abs(v));
const gain = peak > 0.89 ? 0.89 / peak : 1;
const pcm = Buffer.alloc(44 + N * 4);
pcm.write("RIFF", 0); pcm.writeUInt32LE(36 + N * 4, 4); pcm.write("WAVE", 8); pcm.write("fmt ", 12);
pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22); pcm.writeUInt32LE(SR, 24);
pcm.writeUInt32LE(SR * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34); pcm.write("data", 36); pcm.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) for (let c = 0; c < 2; c++) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, bus[c][i] * gain)) * 32767), 44 + i * 4 + c * 2);
fs.writeFileSync(OUT, pcm);
console.log("wrote", OUT, `peak ${peak.toFixed(2)}`);
