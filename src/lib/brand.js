// The getvoicium brand mark — the "Friendly Bot": a chat-bubble-shaped robot
// face (owner's pick, 2026-09-12). One component so every header, footer and
// sign-in screen shows the SAME mark and they can never drift apart.
//
// The body is painted in `color` (white by default, to sit on the crimson brand
// tile) and the eyes + smile are KNOCKED OUT via a mask, so the tile behind
// shows through them — crimson eyes on the crimson tile, whatever colour on any
// other. No hooks, so it works in both server and client components.
let _idc = 0;

export function BotMark({ size = 18, color = "#fff", style, className }) {
  const id = "botmark-" + (_idc++);
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} className={className} style={style} aria-hidden="true" focusable="false">
      <defs>
        <mask id={id}>
          <rect width="512" height="512" fill="#000" />
          <rect x="240" y="70" width="32" height="46" rx="16" fill="#fff" />
          <circle cx="256" cy="66" r="22" fill="#fff" />
          <path fill="#fff" d="M176 118h160a76 76 0 0 1 76 76v112a76 76 0 0 1-76 76H222l-58 58c-9 9-24 3-24-10v-50a76 76 0 0 1-40-66V194a76 76 0 0 1 76-76z" />
          <rect x="186" y="190" width="42" height="66" rx="21" fill="#000" />
          <rect x="284" y="190" width="42" height="66" rx="21" fill="#000" />
          <path d="M204 300q52 46 104 0" stroke="#000" strokeWidth="20" strokeLinecap="round" fill="none" />
        </mask>
      </defs>
      <rect width="512" height="512" fill={color} mask={`url(#${id})`} />
    </svg>
  );
}
