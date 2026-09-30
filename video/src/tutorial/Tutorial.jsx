// TellMore how-to videos (owner, 2026-09-30): the REAL dashboard screens,
// recorded from the local screenshot studio by marketing/tutorial/capture.mjs,
// replayed at the narrator's pace inside a browser window (16:9) or a phone
// (9:16) with a pointer, zoom on what matters, the step, subtitles, and
// Autolinium's marks and end card (the owner's rule for every video).
// Everything is handed in as input props by marketing/tutorial/render.mjs:
// { script, capture, durations, lang, brand, id, device }.
// Sound is mixed outside (mix.mjs); render with --muted.
import React from "react";
import {
  AbsoluteFill, Easing, Img, Sequence, continueRender, delayRender, interpolate,
  spring, staticFile, useCurrentFrame, useVideoConfig,
} from "remotion";
import { Mark } from "../trailer/Trailer.jsx";
import { BrandBug, BrandCard } from "../brand/Autolinium.jsx";
import { TI } from "./icons.js";
import { TECH_LOGOS } from "../../../src/lib/tech-logos.js";
import { tutorialTimeline, captureTime, videoTime, FPS, INTRO, OUTRO } from "../../../marketing/tutorial/timeline.mjs";

export { FPS };
const MAROON = "#7B1C3E", ROSE = "#E0588A", SKY = "#6EC8FF";
const UI_BN = "'Anek Bangla', 'Hind Siliguri', 'Segoe UI', sans-serif";
const UI_EN = "'Segoe UI', 'Anek Bangla', sans-serif";
const DISPLAY = "'Baloo Da 2', 'Hind Siliguri', sans-serif";

// ---- fonts (shipped in public/, never fetched at render time) ----------------
const FACES = [["Baloo Da 2", "promo/fonts/BalooDa2.ttf", "400 800"], ["Anek Bangla", "promo/fonts/AnekBangla.ttf", "100 800"], ["tabler-icons", "fonts/tabler-subset.woff2", "400"]];
let fontsLoading = null;
const loadFonts = () => (fontsLoading ||= Promise.all(FACES.map(([fam, file, weight]) =>
  new FontFace(fam, `url(${staticFile(file)})`, { weight }).load().then((f) => document.fonts.add(f)))));
function useFonts() {
  const [handle] = React.useState(() => delayRender("tutorial fonts"));
  React.useEffect(() => { loadFonts().then(() => continueRender(handle), (e) => { console.error(e); continueRender(handle); }); }, [handle]);
}

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
const ramp = (t, a, b, x = 0, y = 1, easing = Easing.inOut(Easing.cubic)) => interpolate(t, [a, b], [x, y], { ...clamp, easing });
const pop = (t, at, fps, config = { damping: 14, stiffness: 170 }) => (t < at ? 0 : spring({ frame: (t - at) * fps, fps, config }));

export const tutorialDuration = ({ props }) => {
  if (!props?.script) return { durationInFrames: 10 * FPS };
  return { durationInFrames: Math.round(tutorialTimeline(props.script, props.capture, props.durations).total * FPS) };
};

// Where the screen sits in the frame, in video pixels.
function useStage(capture) {
  const { width: W, height: H } = useVideoConfig();
  const V = H > W, vp = capture.viewport;
  if (V) {
    const sh = 1180, sw = sh * vp.width / vp.height, bezel = 16;
    return { V, W, H, screen: { x: (W - sw) / 2, y: 262, w: sw, h: sh }, bezel, sub: { top: 1488, font: 40 } };
  }
  const sh = 740, sw = sh * vp.width / vp.height, bar = 38;
  return { V, W, H, screen: { x: (W - sw) / 2, y: 84 + bar, w: sw, h: sh }, bar, sub: { top: 884, font: 33 } };
}

// camera for one line: zoom towards what it works on (a line may cap it: "zoom")
function cameraFor(seg, vp, V, line) {
  if (!seg?.focus || line?.zoom === 1) return { cx: vp.width / 2, cy: vp.height / 2, z: 1 };
  const f = seg.focus, pad = V ? 60 : 240;
  const cap = Math.min(V ? 1.22 : 1.65, line?.zoom || 9);
  const z = Math.min(cap, Math.max(1, Math.min(vp.width / (f.w + pad), vp.height / (f.h + pad * 0.7))));
  const half = { w: vp.width / (2 * z), h: vp.height / (2 * z) };
  const cx = Math.min(vp.width - half.w, Math.max(half.w, f.x + f.w / 2));
  const cy = Math.min(vp.height - half.h, Math.max(half.h, f.y + f.h / 2));
  return { cx, cy, z };
}

export function Tutorial(props) {
  useFonts();
  const { script, capture, durations, lang, brand, id, device } = props;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const v = frame / fps;
  const tl = React.useMemo(() => tutorialTimeline(script, capture, durations), [script, capture, durations]);
  const st = useStage(capture);
  const vp = capture.viewport;
  const UI = lang === "bn" ? UI_BN : UI_EN;
  const dir = `tutorial/${id}/${device}/`;

  // which line, and the capture clock
  const si = Math.max(0, tl.segs.findIndex((s, i) => v >= s.at && (i === tl.segs.length - 1 || v < tl.segs[i + 1].at)));
  const seg = tl.segs[si], line = script.lines[si];
  const inBody = v >= INTRO && v < tl.body;
  const t = captureTime(tl, Math.max(INTRO, Math.min(v, tl.body - 0.001)));

  // the screenshot on screen, and a short cross-fade over each page change
  const frames = capture.frames;
  let fi = 0;
  for (let i = 0; i < frames.length; i++) if (frames[i].t <= t + 1e-6) fi = i;
  const cut = [...capture.events].reverse().find((e) => e.type === "cut" && e.t <= t + 1e-6);
  const cutV = cut ? videoTime(tl, cut.t) : -9;
  const fade = ramp(v, cutV, cutV + 0.35);
  const before = cut ? frames.filter((f) => f.t < cut.t).pop() : null;

  // camera: ease from the previous line's framing into this line's
  const cam0 = cameraFor(tl.segs[si - 1], vp, st.V, script.lines[si - 1]), cam1 = cameraFor(seg, vp, st.V, line);
  const k = ramp(v, seg.at, seg.at + 0.9);
  const cam = { cx: cam0.cx + (cam1.cx - cam0.cx) * k, cy: cam0.cy + (cam1.cy - cam0.cy) * k, z: cam0.z + (cam1.z - cam0.z) * k };
  const b = st.screen.w / vp.width;
  const T = { x: st.screen.w / 2 - cam.z * b * cam.cx, y: st.screen.h / 2 - cam.z * b * cam.cy };
  const toScreen = (p) => ({ x: T.x + cam.z * b * p.x, y: T.y + cam.z * b * p.y });

  // pointer: glide to each target, ripple on each click
  const ev = capture.events;
  let ptr = { x: vp.width * 0.62, y: vp.height * 0.62 }, from = ptr, moveT = -9;
  for (const e of ev) { if (e.t > t) break; if (e.type === "move") { from = ptr; ptr = { x: e.x, y: e.y }; moveT = e.t; } }
  const glide = ramp(t, moveT, moveT + 0.5);
  const pos = toScreen({ x: from.x + (ptr.x - from.x) * glide, y: from.y + (ptr.y - from.y) * glide });
  const click = [...ev].reverse().find((e) => e.type === "click" && e.t <= t + 1e-6);
  const clickAge = click ? v - videoTime(tl, click.t) : 9;
  const firstMove = ev.find((e) => e.type === "move");
  const showPtr = firstMove && t >= firstMove.t;

  // the inbox (line with a "mail" event)
  const mail = ev.find((e) => e.type === "mail");
  const mailV = mail ? videoTime(tl, mail.t) : -99;
  const mailK = mail ? tl.segs.find((s) => mail.t >= s.capStart && mail.t <= s.capEnd)?.k || 1 : 1;
  const mt = (v - mailV) / mailK;                  // seconds into the inbox, at capture pace
  const mailOn = mail && mt >= 0 && mt < 3.6;

  // a motion-graphics line takes the device's place; cross-fade in and out of it
  const isScene = (i) => !!script.lines[i]?.scene;
  const sceneNow = inBody && isScene(si);
  const devO = sceneNow ? 1 - ramp(v, seg.at, seg.at + 0.4) : (inBody && isScene(si - 1) ? ramp(v, seg.at, seg.at + 0.4) : 1);

  // labelled highlights of this line, from when they were placed
  const notes = ev.filter((e) => e.type === "note" && e.line === line.id && e.t <= t + 1e-6);

  return (
    <AbsoluteFill style={{ background: "#0B0B0E" }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 55% at 50% ${st.V ? 45 : 55}%, ${MAROON}55 0%, transparent 70%)` }} />

      {sceneNow && <SceneView line={line} seg={seg} v={v} lang={lang} st={st} fps={fps} />}

      <AbsoluteFill style={{ opacity: devO }}>
      {/* the device */}
      {st.V ? (
        <div style={{ position: "absolute", left: st.screen.x - st.bezel, top: st.screen.y - st.bezel, width: st.screen.w + st.bezel * 2, height: st.screen.h + st.bezel * 2,
          borderRadius: 64, background: "#16161B", border: "2px solid #2c2c33", boxShadow: "0 40px 100px rgba(0,0,0,.6)" }} />
      ) : (
        <div style={{ position: "absolute", left: st.screen.x, top: st.screen.y - st.bar, width: st.screen.w, height: st.screen.h + st.bar, borderRadius: 14,
          background: "#1c1c22", boxShadow: "0 40px 100px rgba(0,0,0,.6)", overflow: "hidden" }}>
          <div style={{ height: st.bar, display: "flex", alignItems: "center", gap: 9, padding: "0 16px", background: "#26262d" }}>
            {["#ff5f57", "#febc2e", "#28c840"].map((c) => <div key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />)}
            <div style={{ marginLeft: 18, flex: 1, maxWidth: 520, height: 24, borderRadius: 12, background: "#1a1a20", color: "#b8b8c4", fontFamily: UI_EN, fontSize: 14,
              display: "flex", alignItems: "center", padding: "0 14px", gap: 8 }}>
              <svg width="12" height="12" viewBox="0 0 24 24"><path d="M6 10V8a6 6 0 1 1 12 0v2h1v11H5V10zm2 0h8V8a4 4 0 1 0-8 0z" fill="#8a8a96" /></svg>
              {[...capture.events].reverse().find((e) => e.type === "cut" && e.url && e.t <= t + 1e-6)?.url === "/" ? "tellmoreai.com" : "tellmoreai.com/dashboard"}
            </div>
          </div>
        </div>
      )}
      <div style={{ position: "absolute", left: st.screen.x, top: st.screen.y, width: st.screen.w, height: st.screen.h, overflow: "hidden",
        borderRadius: st.V ? 50 : "0 0 14px 14px", background: "#fff" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: st.screen.w, height: st.screen.h, transformOrigin: "0 0",
          transform: `translate(${T.x}px, ${T.y}px) scale(${cam.z})` }}>
          {before && fade < 1 && <Img src={staticFile(dir + before.img)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />}
          <Img src={staticFile(dir + frames[fi].img)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: before ? fade : 1 }} />
        </div>
        {notes.map((n, i) => <Note key={i} n={n} toScreen={toScreen} age={v - videoTime(tl, n.t)} lang={lang} st={st} fps={fps} />)}
        {mailOn && <Inbox mt={mt} lang={lang} st={st} fps={fps} />}
        {showPtr && !mailOn && (st.V
          ? <Touch x={pos.x} y={pos.y} age={clickAge} />
          : <Arrow x={pos.x} y={pos.y} age={clickAge} />)}
      </div>
      </AbsoluteFill>

      {/* the step */}
      {inBody && line.step && (
        <div style={{ position: "absolute", right: st.V ? 52 : 36, top: st.V ? 152 : 26, opacity: ramp(v, seg.at, seg.at + 0.3),
          padding: st.V ? "10px 26px" : "8px 20px", borderRadius: 40, background: MAROON, color: "#fff", fontFamily: UI, fontWeight: 700,
          fontSize: st.V ? 34 : 24, boxShadow: "0 10px 30px rgba(0,0,0,.45)" }}>{line.step[lang]}</div>
      )}

      {/* subtitles */}
      {inBody && (
        <div style={{ position: "absolute", left: st.V ? 60 : 200, right: st.V ? 60 : 200, top: st.sub.top, display: "flex", justifyContent: "center",
          opacity: ramp(v, seg.voiceAt - 0.2, seg.voiceAt + 0.1) * (1 - ramp(v, seg.at + seg.len - 0.25, seg.at + seg.len)) }}>
          <div style={{ fontFamily: UI, fontWeight: lang === "bn" ? 600 : 600, fontSize: st.sub.font, lineHeight: 1.4, color: "#fff", textAlign: "center",
            textShadow: "0 2px 12px rgba(0,0,0,.8)", textWrap: "balance" }}>{subtitleAt(line[lang], v - seg.voiceAt, seg.voice)}</div>
        </div>
      )}

      {/* title card */}
      {v < INTRO + 0.4 && <Intro v={v} title={script.title[lang]} lang={lang} fps={fps} V={st.V} />}

      <Sequence from={Math.round(tl.body * fps)}><BrandCard brand={brand} lang={lang} /></Sequence>
      <BrandBug brand={brand} until={tl.body} />
    </AbsoluteFill>
  );
}

// The sentence being spoken, not the whole line: a long line in full ran to
// three rows and sat on Autolinium's bottom line. Sentences share the voice's
// time by their length; very short ones ride with their neighbour.
function subtitleAt(text, t, dur) {
  // a full stop ends a sentence only before a space (not in "tellmoreai.com")
  const parts = text.split(/(?<=[।?!])\s+|(?<=\.)\s+/).map((s) => s.trim()).filter(Boolean);
  const chunks = [];
  for (const p of parts) {
    const last = chunks[chunks.length - 1];
    if (last && (last.length < 28 || p.length < 18) && last.length + p.length < 95) chunks[chunks.length - 1] = `${last} ${p}`;
    else chunks.push(p);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  let acc = 0;
  for (const c of chunks) { acc += c.length; if (t < (acc / total) * dur) return c; }
  return chunks[chunks.length - 1];
}

// ---- icons: Tabler (the site's subset), brand logos (Simple Icons, src/lib/tech-logos.js) or TellMore's own mark
export function Ico({ name, size, color = "#fff" }) {
  if (name === "tellmore") return <Mark size={size} />;
  if (name?.startsWith("logo:")) {
    const logo = TECH_LOGOS.find((x) => x.name === name.slice(5));
    return <svg width={size} height={size} viewBox="0 0 24 24"><path d={logo?.d || ""} fill={color} /></svg>;
  }
  const cp = TI[name];
  return <span style={{ fontFamily: "tabler-icons", fontSize: size, lineHeight: 1, color, display: "inline-block", width: size, height: size, textAlign: "center" }}>{cp ? String.fromCodePoint(cp) : "•"}</span>;
}

// A labelled highlight: a rounded outline that draws itself around one part of
// the screen, and a label pill beside it.
function Note({ n, toScreen, age, lang, st, fps }) {
  const a = toScreen({ x: n.box.x - 6, y: n.box.y - 6 }), b = toScreen({ x: n.box.x + n.box.w + 6, y: n.box.y + n.box.h + 6 });
  const w = b.x - a.x, h = b.y - a.y;
  const draw = ramp(age, 0, 0.45);
  const s = pop(age, 0.2, fps, { damping: 13, stiffness: 190 });
  const text = n.text?.[lang];
  const below = a.y < st.screen.h * 0.5;
  const fs = st.V ? 30 : 21;
  return (
    <>
      <svg style={{ position: "absolute", left: a.x - 4, top: a.y - 4, overflow: "visible" }} width={w + 8} height={h + 8}>
        <rect x="4" y="4" width={Math.max(0, w)} height={Math.max(0, h)} rx="12" fill={`${ROSE}14`} stroke={ROSE} strokeWidth="4"
          pathLength="1" strokeDasharray="1" strokeDashoffset={1 - draw} />
      </svg>
      {text && (
        <div style={{ position: "absolute", left: Math.min(Math.max(12, a.x), st.screen.w - 12 - 460), top: below ? b.y + 12 : undefined, bottom: below ? undefined : st.screen.h - a.y + 12,
          maxWidth: 460, padding: st.V ? "12px 20px" : "8px 16px", borderRadius: 14, background: "#1a1a20", color: "#fff", fontFamily: lang === "bn" ? UI_BN : UI_EN,
          fontWeight: 600, fontSize: fs, lineHeight: 1.35, boxShadow: "0 12px 30px rgba(0,0,0,.35)", border: `2px solid ${ROSE}`,
          transform: `scale(${s})`, transformOrigin: below ? "top left" : "bottom left", opacity: Math.min(1, s * 2) }}>{text}</div>
      )}
    </>
  );
}

// ---- motion-graphics lines ------------------------------------------------------------
// line.scene: "title" { title, sub, icon } · "points" { title, points: [{ icon, bn, en }] }
// · "flow" { title, nodes: [{ icon, bn, en }], hub?: index }. Items appear in step
// with the voice (spread across the line).
function SceneView({ line, seg, v, lang, st, fps }) {
  const UI = lang === "bn" ? UI_BN : UI_EN, HEAD = lang === "bn" ? DISPLAY : UI_EN;
  const V = st.V;
  const o = ramp(v, seg.at, seg.at + 0.4) * (1 - ramp(v, seg.at + seg.len - 0.35, seg.at + seg.len));
  const area = V ? { x: 60, y: 270, w: 960, h: 1180 } : { x: 90, y: 90, w: 1740, h: 760 };
  const title = line.title?.[lang];
  const items = line.points || line.nodes || [];
  const when = (i) => seg.voiceAt + (seg.voice * 0.85) * (items.length > 1 ? i / items.length : 0);
  const Head = title ? (
    <div style={{ fontFamily: HEAD, fontWeight: 800, fontSize: V ? 64 : 58, color: "#fff", textAlign: "center", lineHeight: 1.2, textWrap: "balance",
      opacity: ramp(v, seg.at + 0.1, seg.at + 0.5), transform: `translateY(${ramp(v, seg.at + 0.1, seg.at + 0.55, 20, 0)}px)` }}>{title}</div>
  ) : null;

  if (line.scene === "title") {
    const s = pop(v, seg.at + 0.1, fps, { damping: 12, stiffness: 150 });
    return (
      <AbsoluteFill style={{ opacity: o, alignItems: "center", justifyContent: "center" }}>
        {line.icon && <div style={{ width: V ? 200 : 170, height: V ? 200 : 170, borderRadius: "50%", background: `linear-gradient(145deg, ${ROSE}, ${MAROON})`, display: "grid", placeItems: "center",
          transform: `scale(${s})`, boxShadow: `0 0 80px ${ROSE}66`, marginBottom: 34 }}><Ico name={line.icon} size={V ? 110 : 92} /></div>}
        <div style={{ padding: "0 80px" }}>{Head}</div>
        {line.sub && <div style={{ fontFamily: UI, fontSize: V ? 38 : 32, color: "#d9c3cc", marginTop: 18, textAlign: "center", padding: "0 80px", opacity: ramp(v, seg.at + 0.45, seg.at + 0.8) }}>{line.sub[lang]}</div>}
      </AbsoluteFill>
    );
  }

  if (line.scene === "points") {
    return (
      <div style={{ position: "absolute", left: area.x, top: area.y, width: area.w, height: area.h, opacity: o, display: "flex", flexDirection: "column", justifyContent: "center", gap: V ? 34 : 30 }}>
        {Head}
        <div style={{ display: "grid", gridTemplateColumns: V || items.length < 4 ? "1fr" : "1fr 1fr", gap: V ? 22 : 20, marginTop: 14, padding: V ? 0 : "0 80px" }}>
          {items.map((p, i) => {
            const s = pop(v, when(i), fps, { damping: 14, stiffness: 180 });
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 24, padding: V ? "22px 26px" : "22px 28px", borderRadius: 18, background: "#16161B", border: "2px solid rgba(255,255,255,.08)",
                opacity: Math.min(1, s * 2), transform: `translateX(${(1 - s) * -40}px)` }}>
                <div style={{ width: V ? 76 : 78, height: V ? 76 : 78, borderRadius: 16, background: `${ROSE}22`, border: `2px solid ${ROSE}66`, display: "grid", placeItems: "center", flex: "none" }}>
                  <Ico name={p.icon} size={V ? 42 : 44} color="#F5B8CD" /></div>
                <div style={{ fontFamily: UI, fontWeight: 600, fontSize: V ? 38 : 36, color: "#fff", lineHeight: 1.35 }}>{p[lang]}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // flow: nodes in a row (a column on a phone), joined by arrows that run in turn
  const n = items.length, node = V ? 190 : 170;
  return (
    <div style={{ position: "absolute", left: area.x, top: area.y, width: area.w, height: area.h, opacity: o, display: "flex", flexDirection: "column", justifyContent: "center", gap: V ? 50 : 60 }}>
      {Head}
      <div style={{ display: "flex", flexDirection: V ? "column" : "row", alignItems: "center", justifyContent: "center", gap: 0 }}>
        {items.map((p, i) => {
          const s = pop(v, when(i), fps, { damping: 13, stiffness: 170 });
          const hub = line.hub === i;
          const arrow = i < n - 1 ? ramp(v, when(i) + 0.3, when(i + 1), 0, 1) : 0;
          return (
            <React.Fragment key={i}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, width: V ? 560 : Math.min(300, (area.w - 60) / n - 70), opacity: Math.min(1, s * 2), transform: `scale(${0.7 + 0.3 * s})` }}>
                <div style={{ width: hub ? node * 1.15 : node, height: hub ? node * 1.15 : node, borderRadius: "50%", display: "grid", placeItems: "center",
                  background: hub ? `linear-gradient(145deg, ${ROSE}, ${MAROON})` : "#16161B", border: hub ? "none" : `3px solid ${ROSE}66`,
                  boxShadow: hub ? `0 0 90px ${ROSE}77` : "0 20px 50px rgba(0,0,0,.45)" }}>
                  <Ico name={p.icon} size={(hub ? node * 1.15 : node) * 0.5} color={hub ? "#fff" : "#F5B8CD"} /></div>
                <div style={{ fontFamily: UI, fontWeight: 700, fontSize: V ? 34 : 26, color: "#fff", textAlign: "center", lineHeight: 1.3 }}>{p[lang]}</div>
              </div>
              {i < n - 1 && (
                <svg width={V ? 40 : 70} height={V ? 70 : 40} viewBox={V ? "0 0 40 70" : "0 0 70 40"} style={{ flex: "none", margin: V ? "6px 0" : "0 0 60px 0" }}>
                  {V
                    ? <><line x1="20" y1="4" x2="20" y2={4 + 52 * arrow} stroke={ROSE} strokeWidth="5" strokeLinecap="round" />{arrow > 0.95 && <path d="M8 50 L20 64 L32 50" fill="none" stroke={ROSE} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />}</>
                    : <><line x1="4" y1="20" x2={4 + 52 * arrow} y2="20" stroke={ROSE} strokeWidth="5" strokeLinecap="round" />{arrow > 0.95 && <path d="M50 8 L64 20 L50 32" fill="none" stroke={ROSE} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />}</>}
                </svg>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function Intro({ v, title, lang, fps, V }) {
  const o = 1 - ramp(v, INTRO - 0.1, INTRO + 0.35);
  const s = pop(v, 0.05, fps, { damping: 12, stiffness: 140 });
  const UI = lang === "bn" ? UI_BN : UI_EN;
  return (
    <AbsoluteFill style={{ opacity: o, background: `radial-gradient(circle at 50% 45%, ${MAROON} 0%, #3a0f22 38%, #0B0B0E 75%)`, alignItems: "center", justifyContent: "center" }}>
      <div style={{ transform: `scale(${s})` }}><Mark size={V ? 220 : 170} /></div>
      <div style={{ fontFamily: UI_EN, fontWeight: 800, fontSize: V ? 70 : 54, color: "#fff", marginTop: 14, opacity: ramp(v, 0.2, 0.5) }}>TellMore AI</div>
      <div style={{ fontFamily: lang === "bn" ? DISPLAY : UI_EN, fontWeight: 700, fontSize: V ? 76 : 62, color: "#F5B8CD", marginTop: 18, opacity: ramp(v, 0.45, 0.8),
        transform: `translateY(${ramp(v, 0.45, 0.85, 24, 0)}px)`, textAlign: "center", padding: "0 60px" }}>{title}</div>
      <div style={{ fontFamily: UI, fontSize: V ? 36 : 28, color: "#d9c3cc", marginTop: 16, opacity: ramp(v, 0.8, 1.1) }}>
        {lang === "bn" ? "ধাপে ধাপে গাইড" : "A step-by-step guide"}</div>
    </AbsoluteFill>
  );
}

// desktop pointer, with a ripple on each click
function Arrow({ x, y, age }) {
  const r = age >= 0 && age < 0.5 ? age / 0.5 : 1;
  const press = age >= 0 && age < 0.15 ? 0.85 : 1;
  return (
    <>
      {r < 1 && <div style={{ position: "absolute", left: x - 34 * r - 8, top: y - 34 * r - 8, width: (34 * r + 8) * 2, height: (34 * r + 8) * 2, borderRadius: "50%",
        border: `4px solid ${ROSE}`, opacity: 1 - r }} />}
      <svg width="34" height="34" viewBox="0 0 24 24" style={{ position: "absolute", left: x - 5, top: y - 3, transform: `scale(${press})`, transformOrigin: "5px 3px",
        filter: "drop-shadow(0 3px 5px rgba(0,0,0,.45))" }}>
        <path d="M4 2l16 9-7 2 4 8-3 1-4-8-6 5z" fill="#fff" stroke="#111" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    </>
  );
}

// phone: a fingertip, pressed on each tap
function Touch({ x, y, age }) {
  const r = age >= 0 && age < 0.55 ? age / 0.55 : 1;
  const down = age >= 0 && age < 0.25;
  return (
    <>
      {r < 1 && <div style={{ position: "absolute", left: x - 60 * r - 20, top: y - 60 * r - 20, width: (60 * r + 20) * 2, height: (60 * r + 20) * 2, borderRadius: "50%",
        background: `${ROSE}33`, border: `4px solid ${ROSE}`, opacity: 1 - r }} />}
      <div style={{ position: "absolute", left: x - 30, top: y - 30, width: 60, height: 60, borderRadius: "50%", background: down ? `${ROSE}aa` : "rgba(255,255,255,.55)",
        border: "3px solid rgba(20,20,26,.55)", boxShadow: "0 6px 18px rgba(0,0,0,.35)", transform: `scale(${down ? 0.85 : 1})` }} />
    </>
  );
}

// A generic inbox: the confirmation email arrives, opens, and is confirmed.
// Drawn, not a real mail app — it only shows the idea of the step.
function Inbox({ mt, lang, st, fps }) {
  const W = st.screen.w, Hs = st.screen.h, V = st.V;
  const s = V ? 1.6 : 1;
  const inn = ramp(mt, 0, 0.35) * (1 - ramp(mt, 3.25, 3.6));
  const open = mt >= 0.9;
  const tapAt = 2.2, done = mt >= tapAt + 0.15;
  const cw = Math.min(W * 0.86, 640 * s);
  const btn = pop(mt, 0.95, fps);
  return (
    <AbsoluteFill style={{ background: `rgba(11,11,14,${0.55 * inn})`, alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: cw, borderRadius: 18 * s, background: "#fff", boxShadow: "0 30px 80px rgba(0,0,0,.45)", overflow: "hidden", fontFamily: UI_EN,
        opacity: inn, transform: `translateY(${(1 - inn) * 40}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 * s, padding: `${14 * s}px ${18 * s}px`, borderBottom: "1px solid #eee", fontSize: 17 * s, fontWeight: 700, color: "#222" }}>
          <svg width={22 * s} height={22 * s} viewBox="0 0 24 24"><path d="M3.5 6h17v12h-17zM3.8 6.4l8.2 6.4 8.2-6.4" fill="none" stroke={MAROON} strokeWidth="1.8" /></svg>
          {lang === "bn" ? "ইমেইল" : "Inbox"}
        </div>
        <div style={{ display: "flex", gap: 12 * s, padding: `${14 * s}px ${18 * s}px`, background: open ? "#fff" : "#fdf3f6", alignItems: "center" }}>
          <div style={{ width: 40 * s, height: 40 * s, borderRadius: "50%", background: MAROON, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 18 * s }}>T</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15 * s, fontWeight: 700, color: "#111" }}>TellMore AI</div>
            <div style={{ fontSize: 14 * s, color: "#444" }}>Confirm your email address</div>
          </div>
          <div style={{ fontSize: 12 * s, color: "#999" }}>now</div>
        </div>
        {open && (
          <div style={{ padding: `${10 * s}px ${22 * s}px ${22 * s}px`, textAlign: "center" }}>
            <div style={{ fontSize: 14 * s, color: "#555", lineHeight: 1.5, marginBottom: 16 * s }}>Tap the button below to confirm your email and finish creating your account.</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 * s, padding: `${12 * s}px ${30 * s}px`, borderRadius: 10 * s, fontSize: 16 * s, fontWeight: 700,
              color: "#fff", background: done ? "#1f9d62" : MAROON, transform: `scale(${btn * (mt >= tapAt && mt < tapAt + 0.15 ? 0.94 : 1)})` }}>
              {done ? "✓ Email confirmed" : "Confirm email"}</div>
          </div>
        )}
      </div>
      {open && mt < 3.2 && (V
        ? <Touch x={W / 2} y={Hs / 2 + 150} age={(mt - tapAt)} />
        : <Arrow x={W / 2 + ramp(mt, 1.3, 2.0, 180, 10)} y={Hs / 2 + ramp(mt, 1.3, 2.0, 160, 72)} age={mt - tapAt} />)}
    </AbsoluteFill>
  );
}
