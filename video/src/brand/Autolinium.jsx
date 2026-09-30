// Autolinium, the company behind TellMore AI (marketing/promo/brand.json). The
// owner's standing rule (2026-09-29): EVERY TellMore video carries its mark and
// name top left and a product/contact line at the very bottom for the whole
// film, then its own end card. Shared by the promo and the tutorials so they
// cannot drift apart.
// Latin text is set in the system's Segoe UI (every render runs on Windows);
// the mark is marketing/promo/brand/make_mark.py's light version. The host
// composition loads "Baloo Da 2" (the end card's Bangla line).
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

const LATIN = "'Segoe UI', 'Anek Bangla', sans-serif";
const DISPLAY = "'Baloo Da 2', 'Hind Siliguri', sans-serif";
const SKY = "#6EC8FF";
const MARK = "promo/brand/autolinium-mark-light.png";
const soft = (u) => `0 ${2 * u}px ${10 * u}px rgba(0,0,0,.75)`;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
const ramp = (t, a, b, x = 0, y = 1) => interpolate(t, [a, b], [x, y], { ...clamp, easing: Easing.inOut(Easing.cubic) });
const pop = (t, at, fps, config) => (t < at ? 0 : spring({ frame: (t - at) * fps, fps, config }));

// V: a portrait frame; u: one pixel of the 1080-wide design
function useFrameUnits() {
  const { width: W, height: H, fps } = useVideoConfig();
  return { V: H > W, u: Math.min(W, H) / 1080, fps };
}

// The mark top left and the product line at the bottom, from the start until
// `until` seconds (the end card takes over from there).
export function BrandBug({ brand, until }) {
  const { V, u, fps } = useFrameUnits();
  const t = useCurrentFrame() / fps;
  const o = ramp(t, 0.2, 0.7) * (1 - ramp(t, until - 0.3, until));
  if (o <= 0) return null;
  const mark = (V ? 66 : 50) * u;
  return (
    <AbsoluteFill style={{ opacity: o, pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: (V ? 52 : 36) * u, top: (V ? 150 : 26) * u, display: "flex", alignItems: "center", gap: 16 * u,
        filter: `drop-shadow(0 ${2 * u}px ${8 * u}px rgba(0,0,0,.7))` }}>
        <Img src={staticFile(MARK)} style={{ height: mark }} />
        <div style={{ fontFamily: LATIN, fontWeight: 600, fontSize: mark * 0.62, color: "#fff", letterSpacing: 0.3 * u }}>{brand.name}</div>
      </div>
      {/* at the very bottom of the frame (owner, 2026-09-29), on a feathered
          shade, not a box, so it reads over a white shirt too */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 150 * u,
        background: "linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,.6) 60%, rgba(0,0,0,.7))" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: (V ? 44 : 22) * u, textAlign: "center",
        fontFamily: LATIN, fontWeight: 600, fontSize: (V ? 29 : 24) * u, color: "rgba(255,255,255,.9)", textShadow: soft(u), whiteSpace: "nowrap" }}>
        An {brand.name} product<span style={{ color: SKY, margin: `0 ${14 * u}px` }}>·</span>{brand.web}<span style={{ color: SKY, margin: `0 ${14 * u}px` }}>·</span>{brand.phone}
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

// The last card: Autolinium's mark, name and tagline, "TellMore AI — an
// Autolinium product", its contacts and the Meta line. `lang` picks the
// product line's language (the Bangla films say it in Bangla).
export function BrandCard({ brand, lang = "bn" }) {
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
        <Img src={staticFile(MARK)} style={{ height: mark, transform: `scale(${s})`, filter: `drop-shadow(0 0 ${40 * u}px rgba(80,170,255,.35))` }} />
        <div style={{ fontFamily: LATIN, fontWeight: 700, fontSize: (V ? 104 : 72) * u, color: "#fff", marginTop: 18 * u, letterSpacing: 1 * u, ...rise(0.25) }}>{brand.name}</div>
        <div style={{ fontFamily: LATIN, fontSize: (V ? 31 : 24) * u, color: "#9FB3CC", marginTop: 2 * u, ...rise(0.35) }}>{brand.tagline}</div>
        <div style={{ width: 140 * u, height: 3 * u, borderRadius: 2 * u, background: SKY, margin: `${(V ? 44 : 26) * u}px 0`, opacity: ramp(t, 0.45, 0.8) }} />
        {lang === "bn"
          ? <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: (V ? 50 : 38) * u, color: "#fff", ...rise(0.5) }}>
              TellMore AI <span style={{ color: "#9FB3CC", fontWeight: 600 }}>— {brand.name}-এর একটি প্রোডাক্ট</span></div>
          : <div style={{ fontFamily: LATIN, fontWeight: 700, fontSize: (V ? 46 : 35) * u, color: "#fff", ...rise(0.5) }}>
              TellMore AI <span style={{ color: "#9FB3CC", fontWeight: 600 }}>— an {brand.name} product</span></div>}
        <div style={{ display: "flex", flexDirection: "column", gap: (V ? 22 : 12) * u, marginTop: (V ? 46 : 24) * u }}>
          {row("phone", brand.phone, 0.7)}
          {row("email", brand.email, 0.8)}
          {row("web", brand.web, 0.9)}
          {row("place", brand.address, 1.0)}
        </div>
        <div style={{ marginTop: (V ? 60 : 26) * u, display: "flex", alignItems: "center", gap: 14 * u, padding: `${14 * u}px ${30 * u}px`, borderRadius: 40 * u,
          border: `2px solid rgba(110,200,255,.45)`, background: "rgba(110,200,255,.08)", fontFamily: LATIN, fontWeight: 600, fontSize: (V ? 30 : 23) * u, color: "#fff", ...rise(1.2) }}>
          <svg width={34 * u} height={34 * u} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill={SKY} /><path d="M7.5 12.3l3 3 6-6.3" fill="none" stroke="#07090F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {brand.meta}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
