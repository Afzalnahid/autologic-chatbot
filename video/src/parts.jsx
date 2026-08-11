import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { T, FONT } from "./theme.js";

// Icons are drawn rather than pulled from a font: an icon font that fails to load
// during a render leaves empty boxes in the finished MP4, and nobody notices
// until it is published.
export function Icon({ name, size = 24, color = T.blue }) {
  const p = { fill: "none", stroke: color, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    messenger: <path d="M12 3C7 3 3 6.8 3 11.4c0 2.6 1.3 4.9 3.3 6.4V21l3-1.6c.8.2 1.7.3 2.7.3 5 0 9-3.8 9-8.3S17 3 12 3z M7.5 13.2l2.6-2.8 2 2.1 2.4-2.1-2.6 2.8-2-2.1-2.4 2.1z" {...p} />,
    instagram: <><rect x="3" y="3" width="18" height="18" rx="5" {...p} /><circle cx="12" cy="12" r="4" {...p} /><circle cx="17" cy="7" r="1" fill={color} stroke="none" /></>,
    whatsapp: <path d="M20 12a8 8 0 0 1-11.9 7L4 20l1.1-3.9A8 8 0 1 1 20 12z M9 9.5c0 3 2.5 5.5 5.5 5.5.6 0 1-.4 1-.9l-.2-1-1.6-.5-.8.9c-1-.5-1.8-1.3-2.3-2.3l.9-.8-.5-1.6-1-.2c-.5 0-1 .4-1 .9z" {...p} />,
    globe: <><circle cx="12" cy="12" r="9" {...p} /><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z" {...p} /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" {...p} /><path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4" {...p} /></>,
    video: <><rect x="3" y="6" width="13" height="12" rx="3" {...p} /><path d="M16 10.5 21 8v8l-5-2.5z" {...p} /></>,
    bag: <><path d="M5 8h14l-1 12H6L5 8z" {...p} /><path d="M9 8V6a3 3 0 0 1 6 0v2" {...p} /></>,
    tag: <><path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9z" {...p} /><circle cx="7.5" cy="7.5" r="1.3" fill={color} stroke="none" /></>,
    check: <path d="m5 12 5 5L19 7" {...p} />,
    robot: <><rect x="4" y="8" width="16" height="12" rx="4" {...p} /><path d="M12 4v4M9 14h.01M15 14h.01" {...p} /></>,
    file: <><path d="M6 3h8l4 4v14H6z" {...p} /><path d="M14 3v4h4" {...p} /></>,
    upload: <path d="M12 16V4m0 0-4 4m4-4 4 4M4 18v2h16v-2" {...p} />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block", flexShrink: 0 }}>
      {paths[name] || paths.check}
    </svg>
  );
}

// One easing for everything that enters, so the whole film moves the same way.
export function useRise(delay = 0, distance = 26) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 200, mass: 0.6 } });
  return {
    opacity: s,
    transform: `translateY(${interpolate(s, [0, 1], [distance, 0])}px)`,
  };
}

export function Label({ children }) {
  return (
    <div style={{ fontSize: 22, letterSpacing: 3, textTransform: "uppercase",
      color: T.blue, fontWeight: 600, marginBottom: 18 }}>
      {children}
    </div>
  );
}

export function Title({ children, size = 68 }) {
  return (
    <h1 style={{ fontSize: size, lineHeight: 1.1, fontWeight: 700, letterSpacing: "-0.025em",
      color: T.text, margin: 0 }}>
      {children}
    </h1>
  );
}

export function Body({ children, width = 780 }) {
  return (
    <p style={{ fontSize: 28, lineHeight: 1.6, color: T.muted, maxWidth: width, margin: "22px 0 0" }}>
      {children}
    </p>
  );
}

// The scene frame: a soft brand glow behind everything, and a faint grid, so the
// background reads as a surface rather than flat black.
export function Stage({ children, glow = 0.5 }) {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 90) * 40;
  return (
    <div style={{ position: "absolute", inset: 0, background: T.bg, fontFamily: FONT,
      color: T.text, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0,
        backgroundImage:
          `linear-gradient(${T.line}66 1px, transparent 1px), linear-gradient(90deg, ${T.line}66 1px, transparent 1px)`,
        backgroundSize: "72px 72px",
        maskImage: "radial-gradient(120% 90% at 50% 0%, #000 15%, transparent 70%)",
        WebkitMaskImage: "radial-gradient(120% 90% at 50% 0%, #000 15%, transparent 70%)" }} />
      <div style={{ position: "absolute", left: `calc(50% + ${drift}px)`, top: -260, width: 1500, height: 900,
        transform: "translateX(-50%)", opacity: glow,
        background: `radial-gradient(closest-side, ${T.blue}22, transparent 72%)`, filter: "blur(30px)" }} />
      <div style={{ position: "absolute", inset: 0, padding: "0 130px",
        display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}

export function Panel({ children, style }) {
  return (
    <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 22,
      boxShadow: "0 30px 80px rgba(0,0,0,.5)", ...style }}>
      {children}
    </div>
  );
}
