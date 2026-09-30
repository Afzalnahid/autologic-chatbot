// When everything happens in a tutorial video — one pure function shared by the
// picture (video/src/tutorial/Tutorial.jsx) and the sound (mix.mjs), so the
// two cannot disagree.
//
// A line's segment lasts as long as the longer of its voice (plus a breath) and
// its screen action. The action (capture.json's virtual clock) is slowed down
// to fill the voice when it is much shorter — never more than 1.6×, so typing
// never crawls — and placed so it FINISHES as the voice does: the narrator says
// "tap Create account" and the tap lands on the words, not seconds before
// (owner, 2026-09-30: a scene that did not match its voice). A line that opens
// a new page shows that page from its first frame while the action waits.
export const FPS = 30;
export const INTRO = 2.6;        // title card
export const OUTRO = 4.5;        // Autolinium's end card (only where the script asks: "endCard": true)
// Every other video just holds its last frame a moment with the brand line on
// it; the contact card belongs on the important films only (owner, 2026-09-30).
export const SHORT_OUTRO = 1.2;
const LEAD = 0.15, VOICE_AT = 0.3, BREATH = 0.7, TAIL = 0.45;

export function tutorialTimeline(script, capture, durations) {
  const segs = [];
  let at = INTRO;
  for (const line of script.lines) {
    const cap = capture.lines.find((l) => l.id === line.id);
    if (!cap) throw new Error(`line ${line.id} is not in the capture — run capture.mjs again`);
    const voice = durations[line.id];
    // never guess: a missing length once made two lines speak at once
    if (!(voice > 0)) throw new Error(`line ${line.id} has no voice length — run tts.mjs again`);
    const action = Math.max(0.1, cap.end - cap.start);
    const k = Math.min(1.6, Math.max(1, (voice * 0.9) / action));
    const len = Math.max(VOICE_AT + voice + BREATH, LEAD + action * k + TAIL);
    const off = Math.max(LEAD, Math.min(VOICE_AT + voice - 0.25, len - TAIL) - action * k);
    segs.push({ id: line.id, at, len, off, voiceAt: at + VOICE_AT, voice, capStart: cap.start, capEnd: cap.end, k, focus: cap.focus });
    at += len;
  }
  for (let i = 1; i < segs.length; i++) {
    const a = segs[i - 1], b = segs[i];
    if (a.voiceAt + a.voice > b.voiceAt - 0.2) throw new Error(`voices ${a.id} and ${b.id} would overlap`);
  }
  const endCard = !!script.endCard;
  return { segs, body: at, endCard, total: at + (endCard ? OUTRO : SHORT_OUTRO) };
}

// capture-clock time shown at video time v (seconds)
export function captureTime(tl, v) {
  const s = [...tl.segs].reverse().find((x) => v >= x.at) || tl.segs[0];
  // just short of the line's end: the frame AT the end belongs to the next line
  return s.capStart + Math.min(s.capEnd - s.capStart - 0.001, Math.max(0, (v - s.at - s.off) / s.k));
}
// video time at which capture-clock time t is shown
export function videoTime(tl, t) {
  const s = tl.segs.find((x) => t >= x.capStart && t <= x.capEnd) || tl.segs[tl.segs.length - 1];
  return s.at + s.off + (t - s.capStart) * s.k;
}
