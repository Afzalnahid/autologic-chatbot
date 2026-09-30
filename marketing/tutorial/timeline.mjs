// When everything happens in a tutorial video — one pure function shared by the
// picture (video/src/tutorial/Tutorial.jsx) and the sound (mix.mjs), so the
// two cannot disagree.
//
// A line's segment lasts as long as the longer of its voice (plus a breath) and
// its screen action. The action (capture.json's virtual clock) plays from the
// segment's start, slowed down to fill the voice when it is much shorter —
// never more than 1.6×, so typing never crawls.
export const FPS = 30;
export const INTRO = 2.6;        // title card
export const OUTRO = 4.5;        // Autolinium's end card
const LEAD = 0.15, VOICE_AT = 0.3, BREATH = 0.7, TAIL = 0.45;

export function tutorialTimeline(script, capture, durations) {
  const segs = [];
  let at = INTRO;
  for (const line of script.lines) {
    const cap = capture.lines.find((l) => l.id === line.id);
    const voice = durations[line.id] || 3;
    const action = Math.max(0.1, cap.end - cap.start);
    const k = Math.min(1.6, Math.max(1, (voice * 0.9) / action));
    const len = Math.max(VOICE_AT + voice + BREATH, LEAD + action * k + TAIL);
    segs.push({ id: line.id, at, len, voiceAt: at + VOICE_AT, voice, capStart: cap.start, capEnd: cap.end, k, focus: cap.focus });
    at += len;
  }
  return { segs, body: at, total: at + OUTRO };
}

// capture-clock time shown at video time v (seconds)
export function captureTime(tl, v) {
  const s = [...tl.segs].reverse().find((x) => v >= x.at) || tl.segs[0];
  // just short of the line's end: the frame AT the end belongs to the next line
  return s.capStart + Math.min(s.capEnd - s.capStart - 0.001, Math.max(0, (v - s.at - LEAD) / s.k));
}
// video time at which capture-clock time t is shown
export function videoTime(tl, t) {
  const s = tl.segs.find((x) => t >= x.capStart && t <= x.capEnd) || tl.segs[tl.segs.length - 1];
  return s.at + LEAD + (t - s.capStart) * s.k;
}
