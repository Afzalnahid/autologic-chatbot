// Autolinium, the company behind TellMore AI (marketing/promo/brand.json). The
// owner's standing rule (2026-09-29, revised 2026-09-30): EVERY TellMore video
// carries TellMore AI's logo top left and "A product of" + Autolinium's one
// stacked logo at the very bottom for the whole film; only the important films
// end on the contact card. Nothing may look like a button. Shared by the promo
// and the tutorials so they cannot drift apart.
// Latin text is set in the system's Segoe UI (every render runs on Windows).
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Mark } from "../trailer/Trailer.jsx";

const LATIN = "'Segoe UI', 'Anek Bangla', sans-serif";
const DISPLAY = "'Baloo Da 2', 'Hind Siliguri', sans-serif";
const SKY = "#6EC8FF";
const MAROON = "#7B1C3E", ROSE = "#E0588A";
// the logo the owner sent on 2026-09-30, made transparent by
// marketing/promo/brand/make_logo.py
const LOGO = "promo/brand/autolinium-logo.png";
const soft = (u) => `0 ${2 * u}px ${10 * u}px rgba(0,0,0,.75)`;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
const ramp = (t, a, b, x = 0, y = 1) => interpolate(t, [a, b], [x, y], { ...clamp, easing: Easing.inOut(Easing.cubic) });
const pop = (t, at, fps, config) => (t < at ? 0 : spring({ frame: (t - at) * fps, fps, config }));

// V: a portrait frame; u: one pixel of the 1080-wide design
function useFrameUnits() {
  const { width: W, height: H, fps } = useVideoConfig();
  return { V: H > W, u: Math.min(W, H) / 1080, fps };
}

// TellMore AI's own mark top left, and "A product of" + Autolinium's logo at
// the very bottom, from the start until `until` seconds (an end card, where a
// video has one, takes over from there). Owner, 2026-09-30: TellMore on top,
// Autolinium at the bottom, no contact details in the line, English everywhere.
export function BrandBug({ until }) {
  const { V, u, fps } = useFrameUnits();
  const t = useCurrentFrame() / fps;
  const o = ramp(t, 0.2, 0.7) * (1 - ramp(t, until - 0.3, until));
  if (o <= 0) return null;
  const mark = (V ? 66 : 50) * u;
  // the size of the words beside it, not a second headline (owner, 2026-09-30)
  const fs = (V ? 28 : 23) * u, logoH = fs * 2.3;
  return (
    <AbsoluteFill style={{ opacity: o, pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: (V ? 88 : 56) * u, top: (V ? 108 : 20) * u, display: "flex", alignItems: "center", gap: 14 * u,
        filter: `drop-shadow(0 ${2 * u}px ${8 * u}px rgba(0,0,0,.7))` }}>
        <div style={{ width: mark, height: mark, borderRadius: "50%", background: `linear-gradient(145deg, ${ROSE}, ${MAROON})`, display: "grid", placeItems: "center" }}>
          <Mark size={mark * 0.74} /></div>
        <div style={{ fontFamily: LATIN, fontWeight: 700, fontSize: mark * 0.6, color: "#fff", letterSpacing: 0.2 * u }}>TellMore AI</div>
      </div>
      {/* at the very bottom of the frame (owner, 2026-09-29), on a feathered
          shade, not a box, so it reads over a white shirt too */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: (V ? 200 : 150) * u,
        background: "linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,.62) 55%, rgba(0,0,0,.75))" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: (V ? 36 : 12) * u, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 * u }}>
        <div style={{ fontFamily: LATIN, fontWeight: 600, fontSize: fs, color: "rgba(255,255,255,.88)", textShadow: soft(u), whiteSpace: "nowrap" }}>A product of</div>
        {/* the one stacked logo, mark over the word (owner, 2026-09-30:
            "only the one with the name under it") */}
        <Img src={staticFile(LOGO)} style={{ height: logoH, filter: `drop-shadow(0 0 ${10 * u}px rgba(90,170,255,.45))` }} />
      </div>
    </AbsoluteFill>
  );
}

// Small line icons for the end card (drawn, 24-unit box).
const ICON = {
  phone: "M6.6 3.5l2.6-.4 1.6 4-1.9 1.4a11 11 0 0 0 5 5l1.4-1.9 4 1.6-.4 2.6c-.2 1.1-1.2 1.9-2.3 1.8A15.5 15.5 0 0 1 4.8 5.8c-.1-1.1.7-2.1 1.8-2.3z",
  email: "M3.5 6h17v12h-17zM3.8 6.4l8.2 6.4 8.2-6.4",
  web: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3.5 9h17M3.5 15h17M12 3c-2.6 2.6-3.6 5.6-3.6 9s1 6.4 3.6 9M12 3c2.6 2.6 3.6 5.6 3.6 9s-1 6.4-3.6 9",
  place: "M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11zM12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
};
function Icon({ d, size }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" style={{ flex: "none" }}><path d={d} fill="none" stroke={SKY} strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}

// The last card: Autolinium's logo and tagline, "TellMore AI — a product of
// Autolinium", its contacts and the Meta line. Only on the films that matter
// most (owner, 2026-09-30: the promo, "how it works" and the series' last
// video), not on every tutorial.
export function BrandCard({ brand }) {
  const { V, u, fps } = useFrameUnits();
  const t = useCurrentFrame() / fps;
  const rise = (at) => ({ opacity: ramp(t, at, at + 0.35), transform: `translateY(${ramp(t, at, at + 0.45, 26 * u, 0)}px)` });
  const s = pop(t, 0.05, fps, { damping: 14, stiffness: 150 });
  const mark = (V ? 250 : 150) * u, fs = (V ? 36 : 27) * u;
  const row = (icon, text, at) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 20 * u, ...rise(at) }}>
      <Icon d={ICON[icon]} size={fs * 1.15} />
      <div style={{ fontFamily: LATIN, fontSize: fs, lineHeight: 1.25, color: "#E9EEF5" }}>{[].concat(text).map((x) => <div key={x}>{x}</div>)}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: "#07090F" }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 75% 45% at 50% ${V ? 30 : 34}%, #123A66 0%, #0B1A30 45%, transparent 75%)`, opacity: 0.9 }} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: (V ? 340 : 70) * u }}>
        <Img src={staticFile(LOGO)} style={{ height: mark * 1.45, transform: `scale(${s})`, filter: `drop-shadow(0 0 ${40 * u}px rgba(80,170,255,.4))` }} />
        <div style={{ fontFamily: LATIN, fontSize: (V ? 31 : 24) * u, color: "#9FB3CC", marginTop: 14 * u, ...rise(0.35) }}>{brand.tagline}</div>
        <div style={{ width: 140 * u, height: 3 * u, borderRadius: 2 * u, background: SKY, margin: `${(V ? 44 : 26) * u}px 0`, opacity: ramp(t, 0.45, 0.8) }} />
        {/* English in every film (owner, 2026-09-30) */}
        <div style={{ fontFamily: LATIN, fontWeight: 700, fontSize: (V ? 46 : 35) * u, color: "#fff", ...rise(0.5) }}>
          TellMore AI <span style={{ color: "#9FB3CC", fontWeight: 600 }}>— a product of {brand.name}</span></div>
        <div style={{ display: "flex", flexDirection: "column", gap: (V ? 22 : 12) * u, marginTop: (V ? 46 : 24) * u }}>
          {row("phone", brand.phone, 0.7)}
          {row("email", brand.email, 0.8)}
          {row("web", brand.web, 0.9)}
          {row("place", brand.address, 1.0)}
        </div>
        {/* words and a tick, no frame: nothing may look like a button (owner, 2026-09-30) */}
        <div style={{ marginTop: (V ? 60 : 26) * u, display: "flex", alignItems: "center", gap: 14 * u,
          fontFamily: LATIN, fontWeight: 600, fontSize: (V ? 30 : 23) * u, color: "#fff", ...rise(1.2) }}>
          <svg width={34 * u} height={34 * u} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill={SKY} /><path d="M7.5 12.3l3 3 6-6.3" fill="none" stroke="#07090F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {brand.meta}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
