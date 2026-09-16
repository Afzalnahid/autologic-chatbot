// The TellMore AI brand mark as a React component. One component so every
// header, footer and sign-in screen shows the SAME mark and they can never
// drift apart. The drawing itself lives in brand-mark.js (owner's final logo,
// 2026-09-17: the plum robot-bubble).
//
// Default colours are the logo's own — plum body, near-black eyes/antenna —
// meant to sit on a white tile. Pass color="#fff" ink="#fff" for a white
// silhouette on a coloured field. The face is a real hole, so the background
// shows through it. No hooks and no ids, so it works in both server and client
// components without hydration differences.
import { markInner, MARK_VIEWBOX, PLUM, INK } from "./brand-mark.js";

export function BotMark({ size = 18, color = PLUM, ink = INK, style, className }) {
  return (
    <svg viewBox={MARK_VIEWBOX} width={size} height={size} className={className} style={style}
      aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: markInner(color, ink) }} />
  );
}
