// TellMore AI sales ad, in the style of a Bangla social-media promo (owner's
// reference, 2026-09-28): big words that land with the voice, cut-out people,
// quick punch-in cuts, the product's own chats as the proof.
// Two cuts (S ~40 s, L ~80 s) × two frames (9:16 Reels, 1:1 feed post).
// Script and timings: marketing/promo/lines.json → timeline.json (timeline.mjs).
// Sound is mixed outside (marketing/promo/mix.mjs); render with --muted.
// Every chat, name and price on screen is an example; the end card says so.
import React from "react";
import {
  AbsoluteFill, Easing, Img, Sequence, continueRender, delayRender, interpolate,
  spring, staticFile, useCurrentFrame, useVideoConfig,
} from "remotion";
import TL from "../../../marketing/promo/timeline.json";

// Each render has its own timeline (the cloned voice's, or one stock voice's:
// their lines last differently), handed down from makePromo.
const TLCtx = React.createContext(TL);
const useTL = () => React.useContext(TLCtx);
import { Mark, Grain, bn, shake } from "../trailer/Trailer.jsx";
import { BrandBug, BrandCard } from "../brand/Autolinium.jsx";

export const PFPS = 30;

const BG = "#0B0B0E", PANEL = "#16161B", LINE = "rgba(255,255,255,.09)";
const MAROON = "#7B1C3E", DEEP = "#5C1430", ROSE = "#E0588A";
const RED = "#FF4B55", YELLOW = "#FFD23F", BLUE = "#4DA8FF", MINT = "#2ED3A7", GREY = "#9A9AA6";
const DISPLAY = "'Baloo Da 2', 'Hind Siliguri', sans-serif";
const UI = "'Anek Bangla', 'Hind Siliguri', 'Segoe UI', sans-serif";

// ---- fonts (shipped in public/, never fetched at render time) ----------------
const FACES = [
  ["Baloo Da 2", "promo/fonts/BalooDa2.ttf", "400 800"],
  ["Anek Bangla", "promo/fonts/AnekBangla.ttf", "100 800"],
  ["Hind Siliguri", "trailer/fonts/HindSiliguri-SemiBold.ttf", "600"],
];
let fontsLoading = null;
const loadFonts = () => (fontsLoading ||= Promise.all(FACES.map(([fam, file, weight]) =>
  new FontFace(fam, `url(${staticFile(file)})`, { weight }).load().then((f) => document.fonts.add(f)))));
function useFonts() {
  const [handle] = React.useState(() => delayRender("promo fonts"));
  React.useEffect(() => { loadFonts().then(() => continueRender(handle), (e) => { console.error(e); continueRender(handle); }); }, [handle]);
}

// ---- small helpers ---------------------------------------------------------------
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
const ramp = (t, a, b, x = 0, y = 1, easing = Easing.inOut(Easing.cubic)) => interpolate(t, [a, b], [x, y], { ...clamp, easing });
const pop = (t, at, fps, cfg = { damping: 13, stiffness: 190, mass: 0.8 }) => (t < at ? 0 : spring({ frame: (t - at) * fps, fps, config: cfg }));

function useLayout() {
  const { width: W, height: H, fps } = useVideoConfig();
  const V = H > W, u = W / 1080;
  // Reels covers the top ~200 px and the bottom ~330 px with its own buttons, so
  // the words live between; a person may stand in the bottom band, text may not.
  return V
    ? { W, H, V, u, fps, head: [250, 470], stage: [740, 1590] }
    : { W, H, V, u, fps, head: [40, 300], stage: [345, 1080] };
}

// ---- the big words -----------------------------------------------------------------
// The current phrase is on screen (a sentence ends at । ? ! — and at a comma once
// the phrase has two words, so a long line arrives in short bursts); its words pop in
// as they are spoken. `hi`: [part of a word, colour, "box"?] — the first match wins.
function Headline({ id, t, hi = [], area, scale = 1, style }) {
  const L = useLayout();
  const { words } = useTL().lines[id];
  const phrases = [];
  words.forEach((w, i) => {
    const prev = phrases[phrases.length - 1];
    if (!prev || /[।?!]$/.test(words[i - 1].w) || (/,$/.test(words[i - 1].w) && prev.length >= 2)) phrases.push([]);
    phrases[phrases.length - 1].push({ ...w, i });
  });
  const cur = [...phrases].reverse().find((p) => t >= p[0].t - 0.12) || phrases[0];
  const [top, h] = area || L.head;
  const width = L.W - 100 * L.u;
  // Size by measuring the real words in the real face (the fonts are loaded
  // before the first frame), wrapping them the way the browser will.
  const boxed = (w) => hi.find(([k]) => w.includes(k))?.[2] === "box";
  const lines = (s) => {
    const ctx = (Headline.ctx ||= document.createElement("canvas").getContext("2d"));
    ctx.font = `800 ${s}px "Baloo Da 2"`;
    let n = 1, x = 0;
    for (const { w } of cur) {
      const ww = ctx.measureText(w).width + 0.28 * s + (boxed(w) ? 0.36 * s : 0);
      if (x > 0 && x + ww > width) { n++; x = ww; } else x += ww;
    }
    return n;
  };
  let size = (L.V ? 150 : 124) * L.u * scale;
  const fits = (s) => lines(s) * 1.18 * s <= h;
  while (size > 50 * L.u && !fits(size)) size -= 4 * L.u;
  return (
    <div style={{ position: "absolute", left: 50 * L.u, top, width, height: h, display: "flex", alignItems: "center", justifyContent: "center", ...style }}>
      <div style={{ textAlign: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: size, lineHeight: 1.18, color: "#fff" }}>
        {cur.map((w) => {
          const s = pop(t, w.t - 0.06, L.fps, { damping: 11, stiffness: 230, mass: 0.7 });
          const m = hi.find(([k]) => w.w.includes(k));
          const color = m ? m[1] : "#fff";
          const box = m && m[2] === "box";
          return (
            <span key={w.i} style={{
              display: "inline-block", margin: `0 ${0.14 * size}px`, opacity: Math.min(1, s * 2.5),
              transform: `translateY(${(1 - s) * 0.4 * size}px) scale(${0.55 + 0.45 * s})`,
              color: box ? "#fff" : color, background: box ? color : "none", borderRadius: box ? 0.16 * size : 0,
              padding: box ? `0 ${0.18 * size}px` : 0,
              textShadow: box ? "none" : `0 ${0.05 * size}px 0 rgba(0,0,0,.5), 0 0 ${0.3 * size}px rgba(0,0,0,.6)${m ? `, 0 0 ${0.35 * size}px ${color}55` : ""}`,
            }}>{w.w}</span>
          );
        })}
      </div>
    </div>
  );
}

// ---- backgrounds ---------------------------------------------------------------------
function Backdrop({ t, tint = MAROON, grid = true, glow = 0.45 }) {
  const L = useLayout();
  const cell = 96 * L.u, off = (t * 14 * L.u) % cell;
  return (
    <AbsoluteFill style={{ background: BG }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 80% 55% at 50% 72%, ${tint} 0%, transparent 70%)`, opacity: glow }} />
      {grid && <AbsoluteFill style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,.07) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,.07) 2px, transparent 2px)`,
        backgroundSize: `${cell}px ${cell}px`, backgroundPosition: `${off}px ${off}px`,
        maskImage: "radial-gradient(ellipse 90% 80% at 50% 50%, #000 40%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 50% 50%, #000 40%, transparent 100%)",
      }} />}
    </AbsoluteFill>
  );
}

// A cut-out person standing on the bottom edge, with a coloured disc behind.
function Person({ id, t, at = 0, x = 0.5, h, blob = ROSE, flip = false, d = 3 }) {
  const L = useLayout();
  const hp = (h ?? (L.V ? 0.5 : 0.62)) * L.H;
  const s = pop(t, at, L.fps, { damping: 15, stiffness: 120 });
  const drift = 1 + 0.035 * ramp(t, at, at + d + 1, 0, 1, Easing.linear);
  return (
    <>
      <div style={{ position: "absolute", left: x * L.W - hp * 0.36, top: L.H - hp * 0.86, width: hp * 0.72, height: hp * 0.72,
        borderRadius: "50%", background: `radial-gradient(circle at 40% 35%, ${blob}, ${blob}99 60%, ${blob}00 72%)`, transform: `scale(${s})`, opacity: 0.9 }} />
      <Img src={staticFile(`promo/people/cut/${id}.png`)} style={{
        position: "absolute", left: x * L.W, bottom: 0, height: hp, transformOrigin: "50% 100%",
        transform: `translateX(-50%) translateY(${(1 - s) * 0.35 * hp}px) scale(${drift}) scaleX(${flip ? -1 : 1})`,
        filter: "drop-shadow(0 24px 40px rgba(0,0,0,.65))", opacity: Math.min(1, s * 3),
      }} />
    </>
  );
}

// ---- chat pieces -------------------------------------------------------------------------
function Msg({ t, at, me = false, children, time, size = 1, maxW = 0.78, style }) {
  const L = useLayout();
  const s = pop(t, at, L.fps, { damping: 15, stiffness: 210 });
  const fs = (L.V ? 40 : 34) * L.u * size;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: me ? "flex-start" : "flex-end", opacity: Math.min(1, s * 2),
      transform: `translateY(${(1 - s) * 30 * L.u}px) scale(${0.85 + 0.15 * s})`, transformOrigin: me ? "left bottom" : "right bottom", ...style }}>
      <div style={{ maxWidth: `${maxW * 100}%`, padding: `${0.5 * fs}px ${0.75 * fs}px`, borderRadius: 0.8 * fs, fontFamily: UI, fontWeight: 500, fontSize: fs,
        lineHeight: 1.35, color: "#fff", background: me ? "#2A2A31" : MAROON, boxShadow: me ? "none" : `0 ${10 * L.u}px ${36 * L.u}px rgba(123,28,62,.5)` }}>{children}</div>
      {time && <div style={{ fontFamily: UI, fontSize: fs * 0.55, color: GREY, marginTop: 0.2 * fs }}>{time}</div>}
    </div>
  );
}
function Typing({ t, from, to }) {
  const L = useLayout();
  if (t < from || t >= to) return null;
  return (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <div style={{ display: "flex", gap: 10 * L.u, padding: `${18 * L.u}px ${26 * L.u}px`, borderRadius: 30 * L.u, background: MAROON }}>
        {[0, 1, 2].map((i) => <div key={i} style={{ width: 14 * L.u, height: 14 * L.u, borderRadius: "50%", background: "#fff", opacity: 0.35 + 0.65 * Math.max(0, Math.sin((t * 7) - i * 0.9)) }} />)}
      </div>
    </div>
  );
}
// A chat window: the shop's name, an "example" tag, then the messages.
function Chat({ t, at = 0, x, top, w, title = "আপনার শপ", sub = "এআই উত্তর দিচ্ছে", children, gap = 18 }) {
  const L = useLayout();
  const s = pop(t, at, L.fps, { damping: 16, stiffness: 150 });
  const width = w ?? (L.V ? 900 : 600) * L.u;
  const left = x ?? (L.W - width) / 2;
  return (
    <div style={{ position: "absolute", left, top: top ?? L.stage[0], width, padding: 26 * L.u, borderRadius: 30 * L.u, background: PANEL,
      border: `2px solid ${LINE}`, boxShadow: "0 30px 80px rgba(0,0,0,.55)", opacity: Math.min(1, s * 2), transform: `translateY(${(1 - s) * 60 * L.u}px) scale(${0.94 + 0.06 * s})` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 * L.u, paddingBottom: 18 * L.u, marginBottom: 20 * L.u, borderBottom: `2px solid ${LINE}` }}>
        <div style={{ width: 64 * L.u, height: 64 * L.u, borderRadius: "50%", background: MAROON, display: "grid", placeItems: "center" }}><Mark size={48 * L.u} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: UI, fontWeight: 700, fontSize: 32 * L.u, color: "#fff" }}>{title}</div>
          <div style={{ fontFamily: UI, fontSize: 22 * L.u, color: GREY }}>{sub}</div>
        </div>
        <div style={{ fontFamily: UI, fontSize: 20 * L.u, color: GREY, border: `1.5px solid ${LINE}`, borderRadius: 20 * L.u, padding: `${4 * L.u}px ${14 * L.u}px` }}>উদাহরণ</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: gap * L.u }}>{children}</div>
    </div>
  );
}
function Sticker({ t, at, children, color = YELLOW, ink = BG, x, y, rot = -6, size = 1 }) {
  const L = useLayout();
  const s = pop(t, at, L.fps, { damping: 9, stiffness: 220 });
  if (t < at) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${s})`, background: color, color: ink,
      fontFamily: DISPLAY, fontWeight: 800, fontSize: 54 * L.u * size, padding: `${6 * L.u}px ${26 * L.u}px`, borderRadius: 16 * L.u,
      boxShadow: `0 ${12 * L.u}px ${40 * L.u}px rgba(0,0,0,.5)`, whiteSpace: "nowrap" }}>{children}</div>
  );
}
function Flash({ t, at, dur = 0.25, color = "#fff", max = 0.85 }) {
  if (t < at || t > at + dur) return null;
  return <AbsoluteFill style={{ background: color, opacity: max * (1 - (t - at) / dur) }} />;
}

// ---- channel badges (drawn, not logos) -----------------------------------------------
function Channel({ kind, size }) {
  const c = { fb: "#1877F2", ig: "linear-gradient(45deg,#F9A825,#E1306C 50%,#833AB4)", wa: "#25D366", web: MAROON }[kind];
  const glyph = {
    fb: <path d="M58 100V64H46V50h12V40c0-12 7-19 18-19 5 0 10 1 10 1v12h-6c-6 0-8 4-8 8v8h13l-2 14H72v36z" fill="#fff" />,
    ig: <g fill="none" stroke="#fff" strokeWidth="8"><rect x="28" y="28" width="64" height="64" rx="18" /><circle cx="60" cy="60" r="15" /><circle cx="78" cy="42" r="2" fill="#fff" /></g>,
    wa: <g><path d="M60 24a36 36 0 0 0-31 54l-5 18 19-5a36 36 0 1 0 17-67z" fill="none" stroke="#fff" strokeWidth="7" /><path d="M47 44c2-4 5-4 7 0l3 7c1 2 0 4-2 5 2 5 6 9 11 11 1-2 3-3 5-2l7 3c4 2 4 5 0 7-6 4-13 2-21-4s-14-14-13-22c0-2 1-4 3-5z" fill="#fff" /></g>,
    web: <g fill="none" stroke="#fff" strokeWidth="6"><circle cx="60" cy="60" r="32" /><ellipse cx="60" cy="60" rx="14" ry="32" /><path d="M29 50h62M29 70h62" /></g>,
  }[kind];
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.28, background: c, display: "grid", placeItems: "center", boxShadow: `0 ${size * 0.12}px ${size * 0.3}px rgba(0,0,0,.5)` }}>
      <svg width={size * 0.8} height={size * 0.8} viewBox="0 0 120 120">{glyph}</svg>
    </div>
  );
}

// A crop of a stock photo, used as "a customer's photo" / "a product photo".
function Crop({ id, x, y, zoom, size, radius }) {
  return (
    <div style={{ width: size, height: size, borderRadius: radius, overflow: "hidden", position: "relative", flex: "none" }}>
      <Img src={staticFile(`promo/people/${id}.jpg`)} style={{ position: "absolute", width: `${zoom * 100}%`, left: `${-x * (zoom * 100 - 100)}%`, top: `${-y * 100}%` }} />
    </div>
  );
}

// ---- the scenes, one per voice line ------------------------------------------------------
// Each gets t (seconds from its line's first word), d (seconds until the next
// scene) and w(k) (when word k is spoken).
const SCENES = {
  "01": ({ t, d }) => (<>
    <Backdrop t={t} />
    <Person id="27442252" t={t} at={-0.25} d={d} />
    <Headline id="01" t={t} hi={[["ভাইজান", YELLOW]]} />
  </>),

  "02": ({ t, d, w, L }) => {
    const click = w(2) + 0.1;
    const cw = (L.V ? 820 : 600) * L.u, cx = L.V ? (L.W - cw) / 2 : 60 * L.u, cy = L.V ? L.stage[0] - 10 * L.u : L.stage[0] + 20 * L.u;
    const s = pop(t, -0.1, L.fps, { damping: 16, stiffness: 150 });
    const pressed = t >= click, cur = ramp(t, click - 0.7, click - 0.05, 0, 1);
    return (<>
      <Backdrop t={t} />
      <Person id="17595470" t={t} at={0.1} x={L.V ? 0.5 : 0.8} h={L.V ? 0.36 : 0.62} blob={MAROON} d={d} />
      <div style={{ position: "absolute", left: cx, top: cy, width: cw, borderRadius: 26 * L.u, overflow: "hidden", background: PANEL, border: `2px solid ${LINE}`,
        boxShadow: "0 30px 80px rgba(0,0,0,.6)", transform: `translateY(${(1 - s) * 80 * L.u}px)`, opacity: s }}>
        <div style={{ height: 150 * L.u, background: `linear-gradient(120deg, ${MAROON}, ${DEEP} 55%, #2a0f1b)` }} />
        <div style={{ padding: `0 ${28 * L.u}px ${28 * L.u}px`, marginTop: -60 * L.u }}>
          <div style={{ width: 120 * L.u, height: 120 * L.u, borderRadius: "50%", background: ROSE, border: `${6 * L.u}px solid ${PANEL}`, display: "grid", placeItems: "center",
            fontFamily: DISPLAY, fontWeight: 800, fontSize: 48 * L.u, color: "#fff" }}>শপ</div>
          <div style={{ fontFamily: UI, fontWeight: 700, fontSize: 44 * L.u, color: "#fff", marginTop: 10 * L.u }}>আপনার শপ</div>
          <div style={{ fontFamily: UI, fontSize: 26 * L.u, color: GREY }}>১২ হাজার ফলোয়ার · অনলাইন শপ</div>
          <div style={{ marginTop: 22 * L.u, display: "flex", gap: 16 * L.u }}>
            <div style={{ flex: 1, textAlign: "center", padding: `${16 * L.u}px 0`, borderRadius: 14 * L.u, fontFamily: UI, fontWeight: 700, fontSize: 30 * L.u,
              background: pressed ? "#2A2A31" : "#1877F2", color: pressed ? YELLOW : "#fff", transform: `scale(${pressed ? 1 : 1 - 0.05 * ramp(t, click - 0.1, click, 0, 1)})` }}>
              {pressed ? "✓ বুস্ট চালু" : "Boost post"}</div>
            <div style={{ flex: 1, textAlign: "center", padding: `${16 * L.u}px 0`, borderRadius: 14 * L.u, fontFamily: UI, fontWeight: 600, fontSize: 30 * L.u, background: "#2A2A31", color: "#fff" }}>মেসেজ</div>
          </div>
        </div>
      </div>
      {t < click + 0.5 && <svg width={60 * L.u} height={60 * L.u} viewBox="0 0 24 24" style={{ position: "absolute",
        left: cx + cw * (0.95 - 0.7 * cur), top: cy + (L.V ? 620 : 600) * L.u * (1 - 0.13 * cur) - 40 * L.u * (1 - cur) * 3, transform: `scale(${t >= click && t < click + 0.12 ? 0.8 : 1})` }}>
        <path d="M4 2l16 9-7 2 4 8-3 1-4-8-6 5z" fill="#fff" stroke="#000" strokeWidth="1.2" /></svg>}
      <Headline id="02" t={t} hi={[["পেজ", ROSE], ["বুস্ট", YELLOW]]} />
    </>);
  },

  "03": ({ t, d, w, L, line }) => {
    const texts = ["দাম কত?", "XL আছে?", "ডেলিভারি কবে?", "vai price?", "অর্ডার করতে চাই", "আছেন?", "COD হবে?"];
    const times = [w(0), w(1), w(2), w(3), w(4), line.dur + 0.1, line.dur + 0.3];
    const spots = L.V ? [[.05, .02], [.58, .08], [.03, .3], [.6, .36], [.06, .56], [.58, .62], [.3, .8]] : [[.03, .03], [.66, .05], [.02, .33], [.7, .36], [.04, .64], [.68, .68], [.36, .9]];
    const [y0, y1] = L.stage;
    const n = times.filter((x) => t >= x).length;
    return (<>
      <Backdrop t={t} />
      <Person id="27786496" t={t} at={-0.2} d={d} h={L.V ? 0.52 : 0.6} blob={MAROON} />
      {texts.map((tx, i) => { const s = pop(t, times[i], L.fps, { damping: 12, stiffness: 220 }); return t < times[i] ? null : (
        <div key={i} style={{ position: "absolute", left: spots[i][0] * L.W, top: y0 + spots[i][1] * (y1 - y0) * 0.9, display: "flex", alignItems: "center", gap: 12 * L.u,
          transform: `scale(${s})`, transformOrigin: "left center" }}>
          <div style={{ width: 52 * L.u, height: 52 * L.u, borderRadius: "50%", background: ["#E57373", "#64B5F6", "#FFB74D", "#81C784", "#BA68C8", "#4DB6AC", "#F06292"][i] }} />
          <div style={{ padding: `${14 * L.u}px ${24 * L.u}px`, borderRadius: 30 * L.u, background: "#2A2A31", fontFamily: UI, fontWeight: 500, fontSize: (L.V ? 38 : 32) * L.u, color: "#fff", boxShadow: "0 12px 30px rgba(0,0,0,.5)" }}>{tx}</div>
        </div>); })}
      {n > 0 && <div style={{ position: "absolute", right: 40 * L.u, top: L.head[0] + L.head[1] - 30 * L.u, padding: `${8 * L.u}px ${22 * L.u}px`, borderRadius: 40 * L.u, background: RED,
        fontFamily: UI, fontWeight: 700, fontSize: 30 * L.u, color: "#fff", transform: `scale(${1 + 0.15 * Math.max(0, 1 - (t - times[n - 1]) * 6)})` }}>{bn(n * 3)} টি নতুন মেসেজ</div>}
      <Headline id="03" t={t} hi={[["মেসেজ", ROSE]]} />
    </>);
  },

  "04": ({ t, w, L }) => {
    const [sx, sy] = t > w(3) ? shake(t, 14 * L.u * Math.max(0, 1 - (t - w(3)) * 2.5)) : [0, 0];
    return (<>
      <AbsoluteFill style={{ background: "#050506" }} />
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 50%, ${RED}33, transparent 60%)`, opacity: t > w(1) ? 1 : 0 }} />
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sx}px, ${sy}px)` }}>
        <Headline id="04" t={t} hi={[["রিপ্লাই", RED], ["দিবে", RED], ["কে", RED]]} area={[L.H * 0.3, L.H * 0.4]} scale={1.25} />
      </div>
      <Flash t={t} at={w(3)} color={RED} max={0.35} />
    </>);
  },

  "05": ({ t, d, w, L, line }) => {
    const n1 = w(5), n2 = line.dur + 0.15;
    const top = L.stage[0] + (L.V ? 110 : 80) * L.u;
    const Note = ({ at, text, i }) => { const s = pop(t, at, L.fps, { damping: 16, stiffness: 170 }); return t < at ? null : (
      <div style={{ position: "absolute", left: 60 * L.u, right: 60 * L.u, top: top + i * 150 * L.u, display: "flex", gap: 20 * L.u, alignItems: "center", padding: 24 * L.u,
        borderRadius: 30 * L.u, background: "rgba(40,40,48,.88)", backdropFilter: "blur(10px)", border: `1.5px solid ${LINE}`, transform: `translateY(${(1 - s) * -60 * L.u}px)`, opacity: s }}>
        <div style={{ width: 70 * L.u, height: 70 * L.u, borderRadius: 18 * L.u, background: "#1877F2", display: "grid", placeItems: "center" }}><Channel kind="fb" size={60 * L.u} /></div>
        <div style={{ flex: 1, fontFamily: UI }}>
          <div style={{ fontSize: 26 * L.u, color: GREY }}>রুমানা · এইমাত্র</div>
          <div style={{ fontSize: 38 * L.u, fontWeight: 600, color: "#fff" }}>{text}</div>
        </div>
      </div>); };
    return (<>
      <AbsoluteFill style={{ background: "#05060c" }}>
        <Img src={staticFile("promo/people/6943442.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(.6) saturate(.7)",
          transform: `scale(${1.05 + 0.05 * t / Math.max(d, 1)})` }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(5,6,20,.92) 0%, rgba(10,14,40,.35) 45%, rgba(5,6,20,.6) 100%)" }} />
      <div style={{ position: "absolute", left: 60 * L.u, top: L.stage[0], fontFamily: UI, fontWeight: 700, fontSize: 34 * L.u, color: "#cfd6ff",
        padding: `${6 * L.u}px ${20 * L.u}px`, borderRadius: 30 * L.u, background: "rgba(80,90,160,.35)" }}>☾ রাত ২:১৭</div>
      <Note at={n1} text="দাম কত?" i={0} />
      <Note at={n2} text="হ্যালো? আছেন?" i={1} />
      <Headline id="05" t={t} hi={[["ঘুমায়", BLUE], ["দাম", YELLOW], ["কত", YELLOW]]} />
    </>);
  },

  "06": ({ t, d, w, L }) => {
    const fail = w(8);
    return (<>
      <Backdrop t={t} tint="#5a0d18" />
      <Person id="4923044" t={t} at={-0.1} x={L.V ? 0.5 : 0.76} h={L.V ? 0.4 : 0.6} blob={RED} d={d} />
      <Chat t={t} at={-0.1} x={L.V ? undefined : 50 * L.u} w={(L.V ? 860 : 560) * L.u} top={L.V ? L.stage[0] - 20 * L.u : L.stage[0] + 10 * L.u} sub="রুমানার সাথে চ্যাট">
        <Msg t={t} at={-0.1} me time="রাত ২:১৭">দাম কত?</Msg>
        <Msg t={t} at={w(1)} time="সকাল ৯:৪০">জি আপু, ১,২৫০ টাকা</Msg>
        <Msg t={t} at={w(5)} me>লাগবে না, অন্য পেজ থেকে নিয়ে নিছি</Msg>
      </Chat>
      <Sticker t={t} at={fail} color={RED} ink="#fff" x={L.V ? L.W * 0.72 : 330 * L.u} y={L.V ? L.stage[0] + 700 * L.u : L.stage[0] + 640 * L.u} rot={-8}>অর্ডার মিস!</Sticker>
      <Headline id="06" t={t} hi={[["সকালে", YELLOW], ["অন্য", RED, "box"], ["পেজ", RED, "box"], ["কিনে", RED], ["ফেলছে", RED]]} />
    </>);
  },

  "07": ({ t, d, w, L, line }) => {
    const qs = ["ডেলিভারি চার্জ কত?", "সাইজ আছে?", "ক্যাশ অন ডেলিভারি হবে?"];
    const times = [w(4), w(5), w(8), w(11), w(13)];
    for (let x = line.dur + 0.1; x < d; x += 0.13) times.push(x);
    const [y0, y1] = L.stage;
    return (<>
      <Backdrop t={t} tint="#4a1020" />
      <Person id="6667491" t={t} at={-0.1} d={d} h={L.V ? 0.5 : 0.6} blob={MAROON} />
      {times.map((at, i) => { if (t < at) return null; const s = pop(t, at, L.fps, { damping: 12, stiffness: 240 });
        const rx = ((i * 0.618) % 1), ry = ((i * 0.381 + 0.13) % 1);
        return <div key={i} style={{ position: "absolute", left: (0.02 + rx * 0.62) * L.W, top: y0 + ry * (y1 - y0) * 0.8, transform: `scale(${s}) rotate(${(rx - 0.5) * 8}deg)`,
          padding: `${12 * L.u}px ${22 * L.u}px`, borderRadius: 28 * L.u, background: "#2A2A31", border: `1.5px solid ${LINE}`, fontFamily: UI, fontWeight: 500, fontSize: 32 * L.u, color: "#fff",
          boxShadow: "0 10px 28px rgba(0,0,0,.55)", whiteSpace: "nowrap" }}>{qs[i % 3]}</div>; })}
      <Sticker t={t} at={w(6)} x={L.W * 0.72} y={L.head[0] + L.head[1] + (L.V ? 90 : 70) * L.u} rot={6}>একই প্রশ্ন ×১০০</Sticker>
      <Headline id="07" t={t} hi={[["ঝামেলা", RED], ["একশো", YELLOW], ["ডেলিভারি", ROSE], ["সাইজ", ROSE], ["ক্যাশ", ROSE]]} />
    </>);
  },

  "08": ({ t, d, w, L }) => (<>
    <Backdrop t={t} />
    <Person id="12167590" t={t} at={-0.1} x={L.V ? 0.5 : 0.8} h={L.V ? 0.4 : 0.64} blob={BLUE} d={d} />
    <Chat t={t} at={-0.05} x={L.V ? undefined : 50 * L.u} w={(L.V ? 860 : 580) * L.u} top={L.V ? L.stage[0] - 20 * L.u : L.stage[0] + 10 * L.u} title="অন্য একটা শপ" sub="সবসময় সাথে সাথে উত্তর">
      <Msg t={t} at={w(2)} me time="রাত ২:১৭">দাম কত?</Msg>
      <Msg t={t} at={w(5)} time="রাত ২:১৭ · ১ সেকেন্ডে">১,২৫০ টাকা আপু। অর্ডার করবেন?</Msg>
    </Chat>
    <Headline id="08" t={t} hi={[["দিনরাত", YELLOW], ["সাথে", YELLOW], ["ঘুমায়", BLUE]]} />
  </>),

  "09": ({ t, d, w, L }) => {
    const g = ramp(t, w(2), d, 0, 1, Easing.in(Easing.quad));
    return (<>
      <AbsoluteFill style={{ background: "#050506" }} />
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 70%, ${ROSE} 0%, ${MAROON} 25%, transparent ${20 + 45 * g}%)`, opacity: 0.25 + 0.75 * g }} />
      <Headline id="09" t={t} hi={[["এআই", ROSE]]} area={[L.H * 0.28, L.H * 0.4]} scale={1.2} />
    </>);
  },

  "10": ({ t, L }) => {
    const s = pop(t, 0, L.fps, { damping: 10, stiffness: 140 });
    const size = (L.V ? 380 : 320) * L.u;
    return (<>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, ${MAROON} 0%, ${DEEP} 35%, #0B0B0E 75%)` }} />
      {[0, 0.25, 0.5].map((k) => { const r = ramp(t, k, k + 1.2, 0, 1, Easing.out(Easing.cubic)); return (
        <div key={k} style={{ position: "absolute", left: "50%", top: "45%", width: size * (1 + 2.2 * r), height: size * (1 + 2.2 * r), borderRadius: "50%",
          border: `${4 * L.u}px solid ${ROSE}`, transform: "translate(-50%,-50%)", opacity: 0.7 * (1 - r) }} />); })}
      <div style={{ position: "absolute", left: "50%", top: "45%", transform: `translate(-50%,-50%) scale(${s})` }}><Mark size={size} /></div>
      <div style={{ position: "absolute", left: 0, right: 0, top: `calc(45% + ${size * 0.55}px)`, textAlign: "center", opacity: ramp(t, 0.25, 0.5), transform: `translateY(${ramp(t, 0.25, 0.6, 30, 0)}px)` }}>
        <div style={{ fontFamily: UI, fontWeight: 800, fontSize: 118 * L.u, color: "#fff", letterSpacing: -1 }}>TellMore AI</div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 52 * L.u, color: "#F5B8CD" }}>টেলমোর এআই</div>
      </div>
      <Flash t={t} at={0} dur={0.35} />
    </>);
  },

  "11": ({ t, d, w, L }) => {
    const chips = ["পণ্য", "দাম", "ডেলিভারি"];
    const absorb = w(5), chat = w(7);
    const [y0] = L.stage;
    const cx = L.W / 2, cy = y0 + (L.V ? 330 : 250) * L.u;
    return (<>
      <Backdrop t={t} />
      {t < chat + 0.3 && <div style={{ opacity: 1 - ramp(t, chat, chat + 0.3) }}>
        <div style={{ position: "absolute", left: cx, top: cy, transform: `translate(-50%,-50%) scale(${1 + 0.25 * Math.max(0, 1 - Math.abs(t - absorb - 0.35) * 3)})` }}>
          <div style={{ width: 240 * L.u, height: 240 * L.u, borderRadius: "50%", background: MAROON, display: "grid", placeItems: "center", boxShadow: `0 0 ${120 * L.u}px ${ROSE}88` }}><Mark size={190 * L.u} /></div>
        </div>
        {chips.map((c, i) => { const s = pop(t, w(i + 1), L.fps); const k = ramp(t, absorb, absorb + 0.4, 0, 1, Easing.in(Easing.cubic));
          const ang = (-150 + i * 60) * Math.PI / 180, R = (L.V ? 360 : 330) * L.u;
          const x = cx + Math.cos(ang) * R * (1 - k), y = cy + Math.sin(ang) * R * 0.75 * (1 - k) + (L.V ? 60 : 30) * L.u * (1 - k);
          return t < w(i + 1) ? null : <div key={c} style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) scale(${s * (1 - 0.7 * k)})`, opacity: 1 - k,
            padding: `${14 * L.u}px ${34 * L.u}px`, borderRadius: 40 * L.u, background: "#2A2A31", border: `2px solid ${ROSE}`, fontFamily: DISPLAY, fontWeight: 800, fontSize: 52 * L.u, color: "#fff" }}>{c}</div>; })}
      </div>}
      {t >= chat && <Chat t={t} at={chat} sub="এআই উত্তর দিচ্ছে">
        <Msg t={t} at={chat + 0.05} me>আপু, এটার দাম কত?</Msg>
        <Typing t={t} from={chat + 0.4} to={w(10)} />
        <Msg t={t} at={w(10)} time="১ সেকেন্ডে উত্তর">১,২৫০ টাকা আপু। ঢাকায় ডেলিভারি ৬০ টাকা, ২ দিনে পৌঁছে যাবে।</Msg>
      </Chat>}
      <Headline id="11" t={t} hi={[["পণ্য", ROSE], ["দাম", ROSE], ["ডেলিভারি", ROSE], ["শিখে", YELLOW], ["কথা", YELLOW]]} />
    </>);
  },

  "12": ({ t, w, L }) => {
    const cell = (L.V ? 460 : 470) * L.u, gap = 24 * L.u;
    const gx = (L.W - cell * 2 - gap) / 2, gy = L.stage[0] + (L.V ? 20 : -10) * L.u;
    const hgt = (L.V ? 300 : 175) * L.u;
    const card = (i, at, label, body) => { const s = pop(t, at, L.fps, { damping: 12, stiffness: 200 }); const ok = t >= w(8);
      return t < at ? null : (
        <div key={i} style={{ position: "absolute", left: gx + (i % 2) * (cell + gap), top: gy + Math.floor(i / 2) * (hgt + gap), width: cell, height: hgt, borderRadius: 26 * L.u, background: PANEL,
          border: `2px solid ${ok ? ROSE : LINE}`, padding: 22 * L.u, boxSizing: "border-box", transform: `scale(${s})`, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: UI, fontWeight: 700, fontSize: 28 * L.u, color: GREY }}>
            <span>{label}</span>{ok && <span style={{ color: ROSE, transform: `scale(${pop(t, w(8) + i * 0.06, L.fps)})` }}>✓ বুঝেছে</span>}</div>
          {body}
        </div>); };
    const bubble = (tx) => <div style={{ alignSelf: "flex-start", padding: `${12 * L.u}px ${22 * L.u}px`, borderRadius: 26 * L.u, background: "#2A2A31", fontFamily: UI, fontSize: (L.V ? 40 : 32) * L.u, color: "#fff" }}>{tx}</div>;
    return (<>
      <Backdrop t={t} />
      {card(0, w(0), "বাংলা", bubble("দাম কত আপু?"))}
      {card(1, w(2), "বাংলিশ", bubble("dam koto apu?"))}
      {card(2, w(4), "ভয়েস", <div style={{ display: "flex", alignItems: "center", gap: 12 * L.u }}>
        <div style={{ width: 56 * L.u, height: 56 * L.u, borderRadius: "50%", background: ROSE, display: "grid", placeItems: "center", color: "#fff", fontSize: 24 * L.u }}>▶</div>
        {Array.from({ length: 16 }, (_, i) => <div key={i} style={{ width: 8 * L.u, borderRadius: 4 * L.u, background: "#ccc", height: (10 + Math.abs(Math.sin(i * 1.7 + t * 6)) * (L.V ? 60 : 40)) * L.u }} />)}
      </div>)}
      {card(3, w(6), "ছবি", <div style={{ display: "flex", gap: 14 * L.u, alignItems: "flex-end" }}>
        <Crop id="17595470" x={0.55} y={0.55} zoom={2.2} size={(L.V ? 190 : 100) * L.u} radius={18 * L.u} />
        <div style={{ fontFamily: UI, fontSize: 28 * L.u, color: "#ddd" }}>এটা আছে?</div></div>)}
      <Headline id="12" t={t} hi={[["বাংলায়", ROSE], ["বাংলিশে", ROSE], ["ভয়েস", ROSE], ["ছবি", ROSE], ["বোঝে", YELLOW]]} />
    </>);
  },

  "13": ({ t, w, L }) => {
    const size = (L.V ? 460 : 330) * L.u, top = L.stage[0] + 10 * L.u, left = (L.W - size) / 2;
    const scan = ramp(t, w(1), w(4), 0, 1, Easing.linear);
    return (<>
      <Backdrop t={t} />
      <div style={{ position: "absolute", left, top, transform: `scale(${pop(t, w(0), L.fps)})` }}>
        <Crop id="17595470" x={0.55} y={0.5} zoom={2} size={size} radius={30 * L.u} />
        {t >= w(1) && t < w(4) + 0.2 && <div style={{ position: "absolute", left: 0, right: 0, top: scan * size, height: 6 * L.u, background: ROSE, boxShadow: `0 0 ${30 * L.u}px ${ROSE}` }} />}
        {t >= w(4) && <div style={{ position: "absolute", inset: 0, borderRadius: 30 * L.u, border: `${6 * L.u}px solid ${ROSE}` }} />}
      </div>
      <div style={{ position: "absolute", left: 60 * L.u, right: 60 * L.u, top: top + size + 30 * L.u }}>
        <Msg t={t} at={w(4)} time="উদাহরণ" maxW={0.95}>এটা আমাদের নীল জামদানি, ৩,৪৫০ টাকা। স্টকে আছে আপু!</Msg>
      </div>
      <Headline id="13" t={t} hi={[["ছবি", ROSE], ["প্রোডাক্ট", YELLOW]]} />
    </>);
  },

  "14": ({ t, w, L }) => {
    const pw = (L.V ? 900 : 640) * L.u, px = (L.W - pw) / 2 - (L.V ? 0 : 150 * L.u), top = L.stage[0] - (L.V ? 10 : 15) * L.u;
    const fs = (L.V ? 34 : 28) * L.u;
    const row = (at, who, text, reply) => { const s = pop(t, at, L.fps); return t < at ? null : (
      <div style={{ display: "flex", gap: 14 * L.u, marginLeft: reply ? 70 * L.u : 0, opacity: s, transform: `translateY(${(1 - s) * 20}px)` }}>
        <div style={{ width: 56 * L.u, height: 56 * L.u, borderRadius: "50%", flex: "none", background: reply ? MAROON : "#64B5F6", display: "grid", placeItems: "center" }}>{reply && <Mark size={40 * L.u} />}</div>
        <div style={{ padding: `${10 * L.u}px ${20 * L.u}px`, borderRadius: 22 * L.u, background: "#2A2A31", fontFamily: UI, fontSize: fs, color: "#fff" }}>
          <div style={{ fontWeight: 700, fontSize: fs * 0.8 }}>{who}</div>{text}</div>
      </div>); };
    return (<>
      <Backdrop t={t} />
      <div style={{ position: "absolute", left: px, top, width: pw, borderRadius: 26 * L.u, background: PANEL, border: `2px solid ${LINE}`, padding: 24 * L.u, boxSizing: "border-box",
        transform: `scale(${pop(t, -0.1, L.fps)})`, display: "flex", flexDirection: "column", gap: 16 * L.u }}>
        <div style={{ fontFamily: UI, fontWeight: 700, fontSize: fs, color: "#fff" }}>আপনার শপ <span style={{ color: GREY, fontWeight: 400 }}>· নতুন কালেকশন এসেছে!</span></div>
        <div style={{ height: (L.V ? 260 : 150) * L.u, borderRadius: 18 * L.u, overflow: "hidden" }}><Crop id="17595469" x={0.5} y={0.5} zoom={1.3} size={pw} radius={0} /></div>
        {row(w(2), "নুসরাত", "price?")}
        {row(w(5), "আপনার শপ", "ইনবক্সে জানিয়েছি আপু!", true)}
      </div>
      {t >= w(7) && <div style={{ position: "absolute", right: 40 * L.u, top: top + (L.V ? 700 : 430) * L.u, width: (L.V ? 640 : 460) * L.u }}>
        <Msg t={t} at={w(7)} time="Messenger · উদাহরণ" maxW={1}>হাই নুসরাত আপু! এটার দাম ১,২৫০ টাকা। অর্ডার করবেন?</Msg></div>}
      <Headline id="14" t={t} hi={[["কমেন্ট", YELLOW], ["ইনবক্স", ROSE]]} />
    </>);
  },

  "15": ({ t, w, L }) => (<>
    <Backdrop t={t} />
    <Chat t={t} at={-0.1} sub="নুসরাতের সাথে চ্যাট">
      <Msg t={t} at={w(1)} me>দাম কত?</Msg>
      <Msg t={t} at={w(2)}>১,২৫০ টাকা আপু।</Msg>
      {t >= w(4) && <div style={{ textAlign: "center", fontFamily: UI, fontSize: 26 * L.u, color: GREY, opacity: pop(t, w(4), L.fps) }}>— ৩ ঘণ্টা পর —</div>}
      <Msg t={t} at={w(7)}>আপু, জামাটা কি নিবেন? স্টক কিন্তু কম আছে।</Msg>
    </Chat>
    <Sticker t={t} at={w(8)} x={L.W * 0.7} y={L.V ? L.stage[0] + 700 * L.u : L.stage[0] + 670 * L.u} rot={-5}>অটো ফলো-আপ</Sticker>
    <Headline id="15" t={t} hi={[["চুপ", RED], ["মনে", YELLOW], ["করায়", YELLOW]]} />
  </>),

  "16": ({ t, w, L }) => {
    const cal = w(10), s = pop(t, cal, L.fps, { damping: 12, stiffness: 170 });
    return (<>
      <Backdrop t={t} />
      <Chat t={t} at={-0.1} title="আপনার এজেন্সি" sub="ক্লায়েন্টের সাথে চ্যাট" top={L.stage[0] - (L.V ? 10 : 20) * L.u}>
        <Msg t={t} at={w(4)} me>কাল একটু কথা বলা যাবে?</Msg>
        <Msg t={t} at={w(6)}>অবশ্যই! বৃহস্পতিবার বিকাল ৪টা ঠিক আছে?</Msg>
      </Chat>
      {t >= cal && <div style={{ position: "absolute", left: (L.W - 700 * L.u) / 2, top: L.stage[0] + (L.V ? 480 : 470) * L.u, width: 700 * L.u, display: "flex", gap: 24 * L.u, alignItems: "center",
        padding: 26 * L.u, borderRadius: 26 * L.u, background: "#fff", transform: `scale(${s}) rotate(-2deg)`, boxShadow: "0 30px 70px rgba(0,0,0,.6)" }}>
        <div style={{ width: 120 * L.u, borderRadius: 16 * L.u, overflow: "hidden", textAlign: "center", fontFamily: UI, flex: "none" }}>
          <div style={{ background: "#EA4335", color: "#fff", fontSize: 26 * L.u, fontWeight: 700, padding: `${4 * L.u}px 0` }}>বৃহঃ</div>
          <div style={{ background: "#F1F3F4", color: "#202124", fontSize: 60 * L.u, fontWeight: 800 }}>২</div></div>
        <div style={{ fontFamily: UI, color: "#202124" }}>
          <div style={{ fontSize: 38 * L.u, fontWeight: 800 }}>✓ মিটিং বুক হয়েছে</div>
          <div style={{ fontSize: 28 * L.u, color: "#5f6368" }}>বিকাল ৪:০০ · Google Meet লিংক পাঠানো হয়েছে</div></div>
      </div>}
      <Headline id="16" t={t} hi={[["সার্ভিস", YELLOW], ["মিটিং", ROSE], ["গুগল", BLUE], ["ক্যালেন্ডারে", BLUE]]} />
    </>);
  },

  "23": ({ t, d, w, L }) => {
    const n = w(9), s = pop(t, n, L.fps, { damping: 14, stiffness: 170 });
    return (<>
      <Backdrop t={t} />
      <Person id="17595469" t={t} at={-0.1} x={L.V ? 0.5 : 0.76} h={L.V ? 0.4 : 0.6} blob={MAROON} d={d} />
      <Chat t={t} at={-0.1} x={L.V ? undefined : 50 * L.u} w={(L.V ? 860 : 580) * L.u} top={L.V ? L.stage[0] - 20 * L.u : L.stage[0] + 10 * L.u} sub="সাকিবের সাথে চ্যাট">
        <Msg t={t} at={w(1)} me>আমি একজন মানুষের সাথে কথা বলতে চাই</Msg>
        <Msg t={t} at={w(1) + 0.5}>অবশ্যই ভাইয়া, এখনই আমাদের টিমকে জানাচ্ছি।</Msg>
      </Chat>
      {t >= n && <div style={{ position: "absolute", left: 60 * L.u, right: 60 * L.u, top: L.head[0] + L.head[1] - (L.V ? 20 : 60) * L.u, display: "flex", gap: 18 * L.u, alignItems: "center",
        padding: 22 * L.u, borderRadius: 28 * L.u, background: "rgba(245,245,248,.96)", transform: `translateY(${(1 - s) * -80 * L.u}px)`, opacity: s }}>
        <div style={{ width: 64 * L.u, height: 64 * L.u, borderRadius: 16 * L.u, background: MAROON, display: "grid", placeItems: "center" }}><Mark size={50 * L.u} /></div>
        <div style={{ fontFamily: UI, color: "#111" }}><div style={{ fontSize: 26 * L.u, color: "#666" }}>TellMore AI · এইমাত্র</div>
          <div style={{ fontSize: 34 * L.u, fontWeight: 700 }}>সাকিব একজন মানুষের সাথে কথা বলতে চান</div></div>
      </div>}
      <Headline id="23" t={t} hi={[["মানুষের", YELLOW], ["ফোনে", ROSE], ["খবর", ROSE]]} style={{ opacity: t >= n ? 1 - ramp(t, n, n + 0.25) : 1 }} />
    </>);
  },

  "24": ({ t, w, L }) => {
    const pw = (L.V ? 470 : 330) * L.u, ph = pw * 2.05, px = (L.W - pw) / 2, py = L.stage[0] - (L.V ? 0 : 20) * L.u;
    const s = pop(t, -0.15, L.fps, { damping: 15, stiffness: 130 });
    const rows = [["নতুন অর্ডার · নীল জামদানি", "৩,৪৫০ টাকা", w(1)], ["নতুন অর্ডার · টিল শার্ট", "৯৫০ টাকা", w(4)], ["নতুন অর্ডার · ফ্লোরাল শার্ট", "১,১৫০ টাকা", w(6)]];
    return (<>
      <Backdrop t={t} />
      <div style={{ position: "absolute", left: px, top: py, width: pw, height: ph, borderRadius: 60 * L.u, background: "#000", border: `${10 * L.u}px solid #2c2c33`,
        overflow: "hidden", transform: `translateY(${(1 - s) * 300 * L.u}px)`, boxShadow: "0 40px 90px rgba(0,0,0,.7)" }}>
        <div style={{ padding: 22 * L.u, display: "flex", flexDirection: "column", gap: 16 * L.u }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 * L.u, fontFamily: UI, fontWeight: 700, fontSize: 30 * L.u, color: "#fff", marginTop: 30 * L.u }}>
            <Mark size={40 * L.u} /> TellMore AI</div>
          {rows.map(([a, b, at], i) => t < at ? null : (
            <div key={i} style={{ padding: 18 * L.u, borderRadius: 20 * L.u, background: "#1c1c22", border: `1.5px solid ${LINE}`, transform: `scale(${pop(t, at, L.fps)})`, fontFamily: UI }}>
              <div style={{ fontSize: 22 * L.u, color: GREY }}>{a}</div><div style={{ fontSize: 34 * L.u, fontWeight: 700, color: "#fff" }}>{b}</div></div>))}
        </div>
      </div>
      <Headline id="24" t={t} hi={[["অর্ডার", YELLOW], ["নোটিফিকেশন", ROSE], ["মোবাইল", ROSE], ["অ্যাপ", ROSE]]} />
    </>);
  },

  "17": ({ t, w, L }) => {
    const kinds = ["fb", "ig", "wa", "web"], names = ["Facebook", "Instagram", "WhatsApp", "Website"];
    const join = w(5), k = ramp(t, join, join + 0.45, 0, 1, Easing.inOut(Easing.cubic));
    const cx = L.W / 2, cy = L.stage[0] + (L.V ? 400 : 300) * L.u, R = (L.V ? 360 : 290) * L.u, size = (L.V ? 170 : 140) * L.u;
    return (<>
      <Backdrop t={t} />
      <svg style={{ position: "absolute", inset: 0 }} width={L.W} height={L.H}>{kinds.map((_, i) => { const a = (-135 + i * 90) * Math.PI / 180;
        return <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(a) * R} y2={cy + Math.sin(a) * R * 0.8} stroke={ROSE} strokeWidth={5 * L.u} strokeDasharray={`${16 * L.u} ${12 * L.u}`}
          strokeDashoffset={-t * 60 * L.u} opacity={k} />; })}</svg>
      <div style={{ position: "absolute", left: cx, top: cy, transform: `translate(-50%,-50%) scale(${k})`, width: 200 * L.u, height: 200 * L.u, borderRadius: "50%", background: MAROON,
        display: "grid", placeItems: "center", boxShadow: `0 0 ${100 * L.u}px ${ROSE}99` }}><Mark size={150 * L.u} /></div>
      {kinds.map((kd, i) => { const a = (-135 + i * 90) * Math.PI / 180, s = pop(t, w(i), L.fps, { damping: 11, stiffness: 220 });
        return t < w(i) ? null : <div key={kd} style={{ position: "absolute", left: cx + Math.cos(a) * R, top: cy + Math.sin(a) * R * 0.8, transform: `translate(-50%,-50%) scale(${s})`,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10 * L.u }}>
          <Channel kind={kd} size={size} /><div style={{ fontFamily: UI, fontWeight: 700, fontSize: 28 * L.u, color: "#fff" }}>{names[i]}</div></div>; })}
      <Headline id="17" t={t} hi={[["ফেসবুক", BLUE], ["ইনস্টাগ্রাম", "#F06292"], ["হোয়াটসঅ্যাপ", "#4ADE80"], ["ওয়েবসাইট", YELLOW], ["এক", ROSE], ["জায়গা", ROSE]]} />
    </>);
  },

  "18": ({ t, w, L }) => {
    const click = w(2), code = w(4), on = t >= click;
    const bw = (L.V ? 820 : 720) * L.u, bx = (L.W - bw) / 2, by = L.stage[0] + (L.V ? 60 : 30) * L.u;
    const cur = ramp(t, click - 0.6, click - 0.05, 0, 1);
    return (<>
      <Backdrop t={t} />
      <div style={{ position: "absolute", left: bx, top: by, width: bw, padding: `${34 * L.u}px 0`, borderRadius: 24 * L.u, textAlign: "center", fontFamily: UI, fontWeight: 800,
        fontSize: 44 * L.u, color: "#fff", background: on ? "#17171c" : "#1877F2", border: on ? `3px solid ${MINT}` : "3px solid transparent",
        transform: `scale(${pop(t, -0.1, L.fps) * (t >= click && t < click + 0.12 ? 0.95 : 1)})`, boxShadow: "0 24px 60px rgba(0,0,0,.55)" }}>
        {on ? <span><span style={{ display: "inline-block", width: 26 * L.u, height: 26 * L.u, borderRadius: "50%", background: MINT, marginRight: 16 * L.u, boxShadow: `0 0 ${24 * L.u}px ${MINT}` }} />বট চালু · Live</span>
          : "Facebook পেজ কানেক্ট করুন"}</div>
      {t < click + 0.5 && <svg width={64 * L.u} height={64 * L.u} viewBox="0 0 24 24" style={{ position: "absolute", left: bx + bw * (0.95 - 0.4 * cur), top: by + 200 * L.u * (1 - cur) + 60 * L.u }}>
        <path d="M4 2l16 9-7 2 4 8-3 1-4-8-6 5z" fill="#fff" stroke="#000" strokeWidth="1.2" /></svg>}
      {t >= code && <div style={{ position: "absolute", left: "50%", top: by + (L.V ? 330 : 250) * L.u, transform: `translateX(-50%) scale(${pop(t, code, L.fps, { damping: 10, stiffness: 200 })})`,
        fontFamily: "Consolas, monospace", fontWeight: 700, fontSize: 130 * L.u, color: "#666" }}>
        {"</>"}<div style={{ position: "absolute", left: "-10%", right: "-10%", top: "50%", height: 14 * L.u, background: RED, transform: "rotate(-14deg)", borderRadius: 8 * L.u }} /></div>}
      <Headline id="18" t={t} hi={[["সেটআপ", YELLOW], ["এক", YELLOW], ["ক্লিক", YELLOW], ["কোড", RED]]} />
    </>);
  },

  "19": ({ t, w, L }) => {
    const shots = [["17595470", 0.55, 0.55, 2.2, "নীল জামদানি", "৩,৪৫০"], ["27442252", 0.5, 0.45, 2.4, "টিল শার্ট", "৯৫০"], ["12772053", 0.5, 0.55, 2.2, "কমলা জ্যাকেট", "১,৮০০"], ["12167590", 0.45, 0.4, 2.4, "ফ্লোরাল শার্ট", "১,১৫০"]];
    const made = w(7);
    const cell = (L.V ? 440 : 232) * L.u, gap = 22 * L.u, cols = L.V ? 2 : 4;
    const gx = (L.W - cols * cell - (cols - 1) * gap) / 2, gy = L.stage[0] + (L.V ? 10 : 20) * L.u;
    return (<>
      <Backdrop t={t} />
      {shots.map(([id, x, y, z, name, price], i) => { const at = w(Math.min(2 + i, 4)) + (i > 2 ? 0.15 : 0); const s = pop(t, at, L.fps, { damping: 13, stiffness: 190 }); const m = t >= made;
        return t < at ? null : <div key={id} style={{ position: "absolute", left: gx + (i % cols) * (cell + gap), top: gy + Math.floor(i / cols) * (cell * 1.32 + gap), width: cell,
          transform: `scale(${s}) rotate(${m ? 0 : (i - 1.5) * 4}deg)`, borderRadius: 22 * L.u, overflow: "hidden", background: PANEL, border: `2px solid ${m ? ROSE : LINE}` }}>
          <Crop id={id} x={x} y={y} zoom={z} size={cell} radius={0} />
          <div style={{ padding: 14 * L.u, fontFamily: UI, height: Math.max(cell * 0.32 - 28 * L.u, 76 * L.u), opacity: m ? pop(t, made + i * 0.08, L.fps) : 0.25 }}>
            <div style={{ fontSize: 28 * L.u, fontWeight: 700, color: "#fff" }}>{m ? name : "…"}</div>
            <div style={{ fontSize: 26 * L.u, color: ROSE, fontWeight: 700 }}>{m ? `৳${price}` : ""}</div></div>
        </div>; })}
      <Headline id="19" t={t} hi={[["ছবিগুলা", ROSE], ["নিজেই", YELLOW], ["বানায়", YELLOW]]} />
    </>);
  },

  "25": ({ t, w, L }) => {
    const sent = w(10), s = pop(t, -0.1, L.fps);
    const pw = (L.V ? 880 : 700) * L.u, px = (L.W - pw) / 2, top = L.stage[0] + 10 * L.u;
    return (<>
      <Backdrop t={t} />
      <div style={{ position: "absolute", left: px, top, width: pw, padding: 28 * L.u, boxSizing: "border-box", borderRadius: 28 * L.u, background: PANEL, border: `2px solid ${LINE}`,
        transform: `scale(${s})`, fontFamily: UI, display: "flex", flexDirection: "column", gap: 20 * L.u }}>
        <div style={{ fontSize: 32 * L.u, fontWeight: 700, color: "#fff" }}>ব্রডকাস্ট · অফার পাঠান</div>
        {t >= w(1) && <div style={{ padding: 20 * L.u, borderRadius: 18 * L.u, background: "#22222a", fontSize: 34 * L.u, color: "#fff", transform: `scale(${pop(t, w(1), L.fps)})` }}>আজকে সব শাড়িতে ২০% ছাড়! শুধু আজ রাত ১২টা পর্যন্ত।</div>}
        {t >= w(4) && <div style={{ alignSelf: "flex-start", padding: `${8 * L.u}px ${20 * L.u}px`, borderRadius: 30 * L.u, background: `${ROSE}22`, border: `2px solid ${ROSE}`,
          fontSize: 28 * L.u, color: "#F5B8CD", transform: `scale(${pop(t, w(4), L.fps)})` }}>গত ২৪ ঘণ্টায় মেসেজ দিয়েছেন: ৩৮৭ জন</div>}
        <div style={{ padding: `${20 * L.u}px 0`, borderRadius: 16 * L.u, textAlign: "center", fontSize: 36 * L.u, fontWeight: 800, color: "#fff", background: t >= sent ? "#2A2A31" : MAROON }}>
          {t >= sent ? `✓ ${bn(Math.min(387, Math.round(387 * ramp(t, sent, sent + 0.8, 0, 1, Easing.out(Easing.quad)))))} জনকে পাঠানো হয়েছে` : "সবাইকে পাঠান"}</div>
      </div>
      <Headline id="25" t={t} hi={[["অফার", YELLOW], ["সবাইরে", ROSE], ["একসাথে", ROSE]]} />
    </>);
  },

  "20": ({ t, L }) => (<>
    <AbsoluteFill style={{ background: "#050506" }} />
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 50%, ${YELLOW}22, transparent 60%)` }} />
    <Headline id="20" t={t} hi={[["ভালো", YELLOW], ["না", YELLOW], ["লাগে", YELLOW]]} area={[L.H * 0.3, L.H * 0.4]} scale={1.2} />
  </>),

  "21": ({ t, d, w, L }) => {
    const bw = (L.V ? 760 : 560) * L.u, bx = L.V ? (L.W - bw) / 2 : 60 * L.u, by = L.stage[0] + (L.V ? 0 : 20) * L.u;
    const glow = 0.6 + 0.4 * Math.sin(t * 6);
    return (<>
      <Backdrop t={t} tint="#3d0f22" />
      <Person id="12772053" t={t} at={0.05} x={L.V ? 0.5 : 0.78} h={L.V ? 0.4 : 0.56} blob={ROSE} d={d} />
      {/* words only, no box around them: nothing in the promo may look like a
          button (owner, 2026-09-30) */}
      <div style={{ position: "absolute", left: bx, top: by, width: bw, padding: `${30 * L.u}px 0`, textAlign: "center",
        textShadow: `0 0 ${40 * glow * L.u}px ${ROSE}, 0 ${4 * L.u}px ${18 * L.u}px rgba(0,0,0,.8)`, transform: `scale(${pop(t, 0, L.fps, { damping: 10, stiffness: 180 })})` }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 70 * L.u, color: "#fff" }}>ফ্রি ট্রায়াল</div>
        {t >= w(3) && <div style={{ fontFamily: UI, fontWeight: 800, fontSize: 150 * L.u, lineHeight: 1, color: YELLOW, transform: `scale(${pop(t, w(3), L.fps, { damping: 9, stiffness: 220 })})` }}>৳০</div>}
        <div style={{ fontFamily: UI, fontSize: 28 * L.u, color: GREY }}>কোনো কার্ড লাগে না</div>
      </div>
      <Headline id="21" t={t} hi={[["ফ্রি", YELLOW], ["টাকাও", YELLOW]]} />
    </>);
  },

  "22": ({ t, w, L }) => {
    const logo = w(3), s = pop(t, logo, L.fps, { damping: 11, stiffness: 150 });
    const cy = L.V ? L.H * 0.5 : L.H * 0.52, size = (L.V ? 260 : 210) * L.u;
    return (<>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 50%, ${MAROON} 0%, ${DEEP} 30%, #0B0B0E 72%)` }} />
      {t < logo ? <Headline id="22" t={t} hi={[["আজকেই", YELLOW], ["চালু", YELLOW]]} area={[L.H * 0.32, L.H * 0.36]} scale={1.15} /> : (<>
        <div style={{ position: "absolute", left: "50%", top: cy - size * 0.9, transform: `translate(-50%,-50%) scale(${s})` }}><Mark size={size} /></div>
        <div style={{ position: "absolute", left: 0, right: 0, top: cy - size * 0.2, textAlign: "center", opacity: ramp(t, logo + 0.15, logo + 0.4) }}>
          <div style={{ fontFamily: UI, fontWeight: 800, fontSize: 104 * L.u, color: "#fff" }}>TellMore AI</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 46 * L.u, color: "#F5B8CD", marginTop: -6 * L.u }}>আপনার শপের ২৪ ঘণ্টার সেলস অ্যাসিস্ট্যান্ট</div>
          {/* the address as plain words, never a button-like box (owner, 2026-09-30) */}
          <div style={{ marginTop: 34 * L.u, color: "#fff", fontFamily: UI, fontWeight: 800, fontSize: 56 * L.u, letterSpacing: 0.5 * L.u }}>tellmoreai.com</div>
          <div style={{ fontFamily: UI, fontSize: 22 * L.u, color: "#b9a3ad", marginTop: 20 * L.u }}>ভিডিওর চ্যাট, নাম ও দাম উদাহরণ মাত্র</div>
        </div></>)}
      <Flash t={t} at={logo} dur={0.3} />
    </>);
  },
};

// Autolinium's marks and end card: ../brand/Autolinium.jsx (shared with the tutorials).

// ---- the film -----------------------------------------------------------------------------
// `brand` (marketing/promo/brand.json) adds Autolinium's marks and end card; the
// composition is then `brand.outro` seconds longer than the timeline.
export function makePromo(cut, tl = TL, brand = null) {
  const { order, at, seconds } = tl.cuts[cut];
  // The cut lands one frame before the voice. (It was 0.12 s early, which left
  // ~4 frames of empty background at every cut: the scene's pieces pop in from
  // about -0.1 s.)
  const PRE = 1 / 30;
  function Promo() {
    useFonts();
    const { fps } = useVideoConfig();
    const starts = order.map((id, i) => (i === 0 ? 0 : at[id] - PRE));
    return (
      <TLCtx.Provider value={tl}><AbsoluteFill style={{ background: BG }}>
        {order.map((id, i) => {
          const from = Math.round(starts[i] * fps);
          const to = i < order.length - 1 ? Math.round(starts[i + 1] * fps) : Math.round(seconds * fps);
          const lead = at[id] - starts[i];
          return (
            <Sequence key={id} from={from} durationInFrames={to - from}>
              <SceneWithLength id={id} lead={lead} d={(to - from) / fps - lead} />
            </Sequence>
          );
        })}
        {brand && <Sequence from={Math.round(seconds * fps)}><BrandCard brand={brand} /></Sequence>}
        <Grain amount={0.05} />
        {brand && <BrandBug brand={brand} until={seconds} />}
      </AbsoluteFill></TLCtx.Provider>
    );
  }
  return Promo;
}

// Scene with its real on-screen length passed down (for slow drifts).
function SceneWithLength({ id, lead, d }) {
  const f = useCurrentFrame();
  const L = useLayout();
  const t = f / L.fps - lead;
  const line = useTL().lines[id];
  const w = (k) => line.words[Math.min(k, line.words.length - 1)].t;
  const Body = SCENES[id];
  const punch = 1 + 0.07 * (1 - ramp(f / L.fps, 0, 0.22, 0, 1, Easing.out(Easing.cubic)));
  return (
    <AbsoluteFill style={{ transform: `scale(${punch})`, overflow: "hidden" }}>
      <Body t={t} d={d} w={w} L={L} line={line} />
    </AbsoluteFill>
  );
}
