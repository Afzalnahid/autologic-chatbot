// Procedural audio for the film, so nothing is downloaded and nothing is
// unlicensed: a soft ambient bed under the narration, a handful of tiny sound
// effects, and the SFX track laid out from the cue list the timeline exports.
// Everything is plain 16-bit WAV written by hand.
import fs from "node:fs";

const SR = 48000;

function wav(path, L, R) {
  const n = L.length, buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(L[i] * 32767))), 44 + i * 4);
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(R[i] * 32767))), 46 + i * 4);
  }
  fs.writeFileSync(path, buf);
}

const note = (n) => 440 * Math.pow(2, (n - 69) / 12);   // MIDI → Hz

// ── The bed ────────────────────────────────────────────────────────────────
// D major, 84 BPM, two bars per chord. A warm detuned pad through a slow
// low-pass, a quiet plucked arpeggio on the off-beats, a sub root. Nothing
// that fights a voice: no drums, no melody above the vocal range's centre.
export function bed(seconds) {
  const n = Math.ceil(seconds * SR);
  const L = new Float32Array(n), R = new Float32Array(n);
  const bpm = 84, beat = 60 / bpm, chordLen = beat * 8;
  // D  A  Bm  G  |  Bm  G  D  A  (MIDI, root octave 3)
  const prog = [[50, 57, 61, 66], [45, 52, 56, 61], [47, 54, 57, 62], [43, 50, 54, 59],
                [47, 54, 57, 62], [43, 50, 54, 59], [50, 57, 61, 66], [45, 52, 56, 61]];
  // pad: per chord, 4 notes × 3 detuned oscillators; crossfade 1.6 s at changes
  const xf = 1.6;
  let lpL = 0, lpR = 0;
  const arpPattern = [0, 2, 1, 3, 2, 1, 0, 2];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const ci = Math.floor(t / chordLen), cpos = t - ci * chordLen;
    const cur = prog[ci % prog.length], prev = prog[(ci + prog.length - 1) % prog.length];
    const fade = ci === 0 ? 1 : Math.min(1, cpos / xf);
    let pad = 0;
    const padOf = (chord, w) => {
      if (w <= 0) return;
      for (let k = 0; k < chord.length; k++) {
        const f = note(chord[k]);
        for (const det of [-0.35, 0, 0.35]) {
          const ph = 2 * Math.PI * (f * (1 + det / 100)) * t;
          // triangle-ish: sine + a little 3rd harmonic
          pad += w * (Math.sin(ph) + 0.18 * Math.sin(3 * ph)) * (k === 0 ? 0.55 : 0.4);
        }
      }
    };
    padOf(cur, fade); padOf(prev, 1 - fade);
    pad *= 0.028;
    // slow filter sweep
    const cut = 0.045 + 0.035 * (0.5 + 0.5 * Math.sin(2 * Math.PI * t / 23));
    lpL += cut * (pad - lpL); lpR += cut * (pad * 0.97 - lpR);
    // pluck arpeggio: 8ths, exponential decay
    const eighth = beat / 2, ai = Math.floor(t / eighth), apos = t - ai * eighth;
    const an = cur[arpPattern[ai % 8]] + 12;
    const env = Math.exp(-apos * 7) * (apos < 0.004 ? apos / 0.004 : 1);
    const pf = note(an);
    const pluck = env * (Math.sin(2 * Math.PI * pf * t) + 0.25 * Math.sin(2 * Math.PI * pf * 2 * t) + 0.08 * Math.sin(2 * Math.PI * pf * 3 * t)) * 0.05;
    // sub
    const sub = Math.sin(2 * Math.PI * note(cur[0] - 12) * t) * 0.03 * fade + Math.sin(2 * Math.PI * note(prev[0] - 12) * t) * 0.03 * (1 - fade);
    // global fade in/out
    const g = Math.min(1, t / 2.5) * Math.min(1, Math.max(0, (seconds - t) / 4));
    const wide = 0.12 * Math.sin(2 * Math.PI * t / 9);
    L[i] = g * (lpL * (1 + wide) + pluck * 0.9 + sub);
    R[i] = g * (lpR * (1 - wide) + pluck * 1.0 + sub);
  }
  return [L, R];
}

// ── Effects ────────────────────────────────────────────────────────────────
function noise(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return (s / 4294967296) * 2 - 1; }; }
function render(len, fn) { const n = Math.ceil(len * SR), L = new Float32Array(n), R = new Float32Array(n); for (let i = 0; i < n; i++) { const [a, b] = fn(i / SR, i); L[i] = a; R[i] = b; } return [L, R]; }

export const sfx = {
  whoosh: () => { const rnd = noise(7); let bp = 0, bp2 = 0; return render(0.6, (t) => {
    const env = Math.sin(Math.PI * Math.min(1, t / 0.6)) ** 1.6; const f = 0.02 + 0.12 * (1 - t / 0.6);
    const x = rnd(); bp += f * (x - bp); bp2 += f * (bp - bp2); const v = (bp - bp2) * 6 * env * 0.7; return [v * (1 - t), v * t]; }); },
  pop: () => render(0.14, (t) => { const f = 720 - 420 * (t / 0.14); const v = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 28) * 0.55; return [v, v]; }),
  ding: () => render(0.9, (t) => { const v = (Math.sin(2 * Math.PI * 1318 * t) + 0.6 * Math.sin(2 * Math.PI * 1976 * t) + 0.3 * Math.sin(2 * Math.PI * 2637 * t)) * Math.exp(-t * 4.2) * 0.32; return [v, v * 0.9]; }),
  click: () => { const rnd = noise(3); return render(0.04, (t) => { const v = rnd() * Math.exp(-t * 160) * 0.5; return [v, v]; }); },
  chime: () => render(0.8, (t) => { let v = 0; [[0, 880], [0.12, 1108.7], [0.24, 1318.5]].forEach(([at, f]) => { if (t >= at) v += Math.sin(2 * Math.PI * f * (t - at)) * Math.exp(-(t - at) * 5) * 0.28; }); return [v, v]; }),
  swoosh: () => { const rnd = noise(11); let bp = 0; return render(0.35, (t) => { const env = Math.sin(Math.PI * Math.min(1, t / 0.35)); const x = rnd(); bp += 0.18 * (x - bp); const v = bp * 3.5 * env * 0.5; return [v * 0.6, v]; }); },
};

// Lays the cues onto one stereo track of the film's length.
export function sfxTrack(cues, seconds, gainDb = -16) {
  const n = Math.ceil(seconds * SR), L = new Float32Array(n), R = new Float32Array(n);
  const bank = Object.fromEntries(Object.entries(sfx).map(([k, f]) => [k, f()]));
  const g = Math.pow(10, gainDb / 20);
  for (const c of cues) {
    const s = bank[c.kind]; if (!s) continue;
    const at = Math.round(c.t * SR);
    for (let i = 0; i < s[0].length && at + i < n; i++) { L[at + i] += s[0][i] * g; R[at + i] += s[1][i] * g; }
  }
  return [L, R];
}

if (process.argv[1] && process.argv[1].endsWith("audio-gen.mjs")) {
  const [, , cmd, a, b] = process.argv;
  if (cmd === "bed") { const [L, R] = bed(+a || 60); wav(b || "bed.wav", L, R); console.log("wrote", b || "bed.wav"); }
  else if (cmd === "sfx") { const cues = JSON.parse(fs.readFileSync(a, "utf8")); const seconds = +b; const [L, R] = sfxTrack(cues.cues, seconds); wav(cues.out || "sfx.wav", L, R); console.log("wrote", cues.out || "sfx.wav", cues.cues.length, "cues"); }
  else console.log("usage: node audio-gen.mjs bed <seconds> <out.wav> | sfx <cues.json> <seconds>");
}
export { wav };
