// The promo's one timeline, read by the picture (video/src/promo/Promo.jsx), the
// effects (sfx.mjs) and the mix (mix.mjs), so all three agree to the frame.
//   · each cut (S short, L long) plays its lines in order with a breath between;
//   · every word gets a start time, from its share of the line (graphemes, plus a
//     beat for a comma or a full stop), so the big words land with the voice;
//   · effect cues are written against words, not seconds, and resolved here.
// Lines without a polished take yet get an estimated length, so the picture can
// be previewed before the voice is finished.
//   node timeline.mjs          → timeline.json       (the cloned voice, vo/, lengths in lines.json)
//   node timeline.mjs puck     → timeline-puck.json  (a stock voice, vo-puck/, lengths in its durations.json)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const { lines } = JSON.parse(fs.readFileSync(path.join(here, "lines.json"), "utf8"));
const variant = process.argv[2];
const VO = variant ? `vo-${variant}` : "vo";
const durFile = path.resolve(here, `../../video/public/promo/${VO}/durations.json`);
const DURS = variant && fs.existsSync(durFile) ? JSON.parse(fs.readFileSync(durFile, "utf8")) : null;
const lengthOf = (l) => (DURS ? DURS[l.id] : l.dur);
const seg = new Intl.Segmenter("bn", { granularity: "grapheme" });
const glen = (s) => [...seg.segment(s.replace(/[।?!,.]/g, ""))].length;

const LEAD = 0.35, GAP = 0.3, TAIL = 3.6;
// the long cut lets each demo finish on screen before the next line
const HOLD_L = { "05": 0.6, "07": 0.9, "11": 1.3, "12": 0.9, "13": 1.1, "14": 1.2, "15": 1.1, "16": 1.1, "23": 0.7, "24": 0.9, "17": 0.7, "18": 0.6, "19": 1.0, "25": 0.9 };
// a longer breath AFTER these lines in either cut (seconds)
const AFTER = { "03": 0.45, "04": 0.35, "06": 0.4, "09": 0.15, "10": 0.75, "11": 0.6, "12": 0.4, "18": 0.4, "19": 0.35, "20": 0.25, "21": 0.35 };

// Effect cues: [word index | "end", sound, offset seconds, "end" = lasts to the
// line end]. The word indices are the SAME ones Promo.jsx animates on, so a pop
// is heard on the frame its bubble appears.
const CUES = {
  "01": [[0, "whoosh", -0.2]],
  "02": [[0, "whoosh", -0.15], [2, "click", 0.1]],
  "03": [[0, "pop"], [1, "pop"], [2, "pop"], [3, "pop"], [4, "pop"], ["end", "pop", 0.1], ["end", "pop", 0.3]],
  "04": [[0, "hit"], [1, "whoosh", -0.1], [3, "hit", 0.05]],
  "05": [[0, "whoosh", -0.15], [5, "ding"], ["end", "ding", 0.15]],
  "06": [[0, "whoosh", -0.15], [1, "pop"], [5, "pop"], [8, "fail"]],
  "07": [[0, "whoosh", -0.15], [4, "pop"], [5, "pop"], [6, "hit"], [8, "pop"], [11, "pop"], [13, "pop"]],
  "08": [[0, "whoosh", -0.15], [2, "pop"], [5, "pop"]],
  "09": [[0, "hit"], [2, "riser", 0, "end"]],
  "10": [[0, "boom"]],
  "11": [[1, "pop"], [2, "pop"], [3, "pop"], [5, "whoosh"], [7, "pop"], [10, "pop"]],
  "12": [[0, "pop"], [2, "pop"], [4, "pop"], [6, "pop"], [8, "ding"]],
  "13": [[0, "pop"], [1, "scan"], [4, "pop"]],
  "14": [[0, "whoosh", -0.15], [2, "pop"], [5, "pop"], [7, "pop"]],
  "15": [[0, "whoosh", -0.15], [1, "pop"], [2, "pop"], [7, "ding"]],
  "16": [[0, "whoosh", -0.15], [4, "pop"], [6, "pop"], [10, "ding"]],
  "23": [[0, "whoosh", -0.15], [1, "pop"], [9, "ding"]],
  "24": [[1, "ding"], [4, "whoosh"]],
  "25": [[0, "whoosh", -0.15], [1, "pop"], [4, "pop"], [10, "send"]],
  "17": [[0, "pop"], [1, "pop"], [2, "pop"], [3, "pop"], [5, "hit"]],
  "18": [[0, "whoosh", -0.15], [2, "click"], [2, "ding", 0.25], [4, "hit"]],
  "19": [[0, "whoosh", -0.15], [2, "pop"], [3, "pop"], [4, "pop"], [7, "ding"]],
  "20": [[0, "whoosh", -0.2]],
  "21": [[0, "hit"], [3, "cash"]],
  "22": [[0, "whoosh", -0.15], [3, "boom"]],
};

function wordTimes(text, dur) {
  const words = text.split(/\s+/).filter(Boolean);
  const weight = (w) => glen(w) + (/[,]$/.test(w) ? 2 : 0) + (/[।?!]$/.test(w) ? 3 : 0);
  const total = words.reduce((a, w) => a + weight(w), 0);
  let acc = 0;
  return words.map((w) => { const t = +(dur * 0.94 * acc / total).toFixed(3); acc += weight(w); return { w, t }; });
}

const out = { vo: VO, lines: {}, cuts: {} };
for (const l of lines) {
  const dur = lengthOf(l) ?? +(glen(l.text) * 0.072 + 0.2).toFixed(2);
  const words = wordTimes(l.text, dur);
  const cues = (CUES[l.id] || []).map(([k, s, off = 0, until]) => {
    const t = +((k === "end" ? dur : words[Math.min(k, words.length - 1)].t) + off).toFixed(3);
    return until ? { t, s, until: dur } : { t, s };
  });
  out.lines[l.id] = { text: l.text, dur, estimated: lengthOf(l) == null, words, cues };
}
for (const cut of ["S", "L"]) {
  const ids = lines.filter((l) => l.in.includes(cut)).map((l) => l.id);
  const at = {};
  let t = LEAD;
  ids.forEach((id, i) => {
    at[id] = +t.toFixed(3);
    t += out.lines[id].dur + (i < ids.length - 1 ? (cut === "L" && HOLD_L[id]) || AFTER[id] || GAP : 0);
  });
  const seconds = Math.ceil((t + TAIL) * 10) / 10;
  out.cuts[cut] = { seconds, order: ids, at };
}
fs.writeFileSync(path.join(here, variant ? `timeline-${variant}.json` : "timeline.json"), JSON.stringify(out, null, 1) + "\n");
const est = lines.filter((l) => l.in.includes("S") && lengthOf(l) == null).length;
console.log(`S ${out.cuts.S.seconds}s · L ${out.cuts.L.seconds}s${est ? ` · ${est} lines still estimated` : ""}`);
