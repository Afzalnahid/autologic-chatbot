// "২টা ১৭" — second cut, built like a film trailer (owner, 2026-09-28): real
// footage (Pexels, graded by marketing/trailer/grade_clips.mjs), a trailer score
// (Pixabay), title cards on the hits, a cut to dead silence, then the answer.
// Timeline: marketing/trailer/teaser.json (shared with the mix, mix2.mjs).
// The sound is not in here — it is mixed on afterwards (see mix2.mjs).
import React from "react";
import { AbsoluteFill, Easing, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig, spring } from "remotion";
import TL from "../../../marketing/trailer/teaser.json";
import VO from "../../../marketing/trailer/lines.json";
import {
  MAROON, ACCENT, INK, SERIF, SANS, useFonts, bn, ramp, graphemes, shake, NAMES, TEXTS,
  Grain, Vignette, Mark, Notification, Dots, Bubble,
} from "./Trailer.jsx";

export const TFPS = 30;
export const TSECONDS = TL.seconds;

const SIL0 = TL.silence[0], SIL1 = TL.silence[1];
const HIT = TL.hit;
const END = 53.5;

// ---- the shots -----------------------------------------------------------------
// [clip, in the film from, to, from this second of the clip, zoom start → end]
const SHOTS = [
  ["rain-window", 1.0, 4.3, 1.0, 1.0, 1.12],
  ["face-phone", 4.3, 8.6, 3.0, 1.06, 1.2],
  ["phone-bed", 8.6, 13.0, 2.0, 1.0, 1.1],
  ["wet-street", 13.0, 17.0, 1.0, 1.0, 1.16],
  ["clock", 17.0, 19.0, 0.5, 1.12, 1.28],
  ["rain-window", 25.0, 28.0, 7.0, 1.18, 1.38],
  ["clock", 29.0, 32.0, 1.0, 1.25, 1.55],
  ["morning", 47.0, 50.3, 1.0, 1.0, 1.08],
];
const TITLES = [[24.0, "একটা প্রশ্ন।", INK], [28.0, "একটা অপেক্ষা।", INK], [32.0, "একটা হারানো অর্ডার।", "#ff6b7d"]];
const HITS = [1.0, 4.3, 8.6, 13.0, 17.0, 19.0, 24.0, 25.0, 28.0, 29.0, 32.0, 33.0, 40.3, HIT];

// the pile-up on the phone: fast, then faster
const PILE = (() => { const o = []; let t = 19.2, g = 0.7; while (t < 23.8) { o.push(+t.toFixed(3)); t += g; g = Math.max(0.09, g * 0.82); } return o; })();
const PILE_NOTES = PILE.map((t, i) => ({ t, who: NAMES[i % NAMES.length], text: TEXTS[i % TEXTS.length] }));

function Clip({ name, a, b, from, z0, z1 }) {
  const t = useCurrentFrame() / TFPS + a;
  const z = ramp(t, a, b, z0, z1, Easing.linear);
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#000" }}>
      <AbsoluteFill style={{ transform: `scale(${z})` }}>
        <OffthreadVideo src={staticFile(`trailer/cut/${name}.mp4`)} startFrom={Math.round(from * TFPS)} muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      {/* a short fade in from black on every cut */}
      <AbsoluteFill style={{ background: "#000", opacity: ramp(t, a, a + 0.18, 0.85, 0) }} />
    </AbsoluteFill>
  );
}

// a glass notification floating over the phone on the bed
function Floating({ t, at, who, text, y }) {
  const { fps } = useVideoConfig();
  if (t < at) return null;
  const s = spring({ frame: (t - at) * fps, fps, config: { damping: 14, stiffness: 170 } });
  return (
    <div style={{ position: "absolute", left: 90, right: 90, top: y, padding: "22px 28px", borderRadius: 30,
      background: "rgba(20,24,40,.62)", border: "1px solid rgba(255,255,255,.14)", backdropFilter: "blur(14px)",
      boxShadow: "0 0 60px rgba(90,130,255,.35)", color: INK, fontFamily: SANS, opacity: s,
      transform: `translateY(${(1 - s) * -60}px) scale(${0.92 + 0.08 * s})` }}>
      <div style={{ fontSize: 24, color: "rgba(255,255,255,.65)", display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#3B82F6,#A855F7)" }} />Messenger · এখন</div>
      <div style={{ fontSize: 32, fontWeight: 600, marginTop: 6 }}>{who}</div>
      <div style={{ fontSize: 31, opacity: 0.9 }}>{text}</div>
    </div>
  );
}

// the phone's lock screen, full frame: the pile-up (19–24 s) and the red count (33–37.5 s)
function Pile({ t, red }) {
  const shown = PILE_NOTES.filter((n) => t >= n.t || red);
  const count = red ? 50 : Math.round(ramp(t, 19.2, 23.9, 1, 50, Easing.in(Easing.quad)));
  const buzz = PILE_NOTES.some((n) => t >= n.t && t < n.t + 0.12);
  const [sx, sy] = shake(t, red ? ramp(t, 35.5, 37.4, 2, 16) : (buzz ? 7 : 2) + ramp(t, 19, 24, 0, 6));
  const flicker = red && t > 36.3 ? (Math.sin(t * 90) > 0.2 ? 1 : 0.25) : 1;
  const glitch = red && t > 37.1;
  return (
    <AbsoluteFill style={{ background: "#03040a", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 60% 45% at 50% 50%, ${red ? "rgba(160,20,40,.35)" : "rgba(60,90,200,.30)"}, transparent 70%)` }} />
      <div style={{ width: 560, height: 1140, borderRadius: 74, background: "#0a0a0c", border: "10px solid #18181c", overflow: "hidden", position: "relative",
        transform: `translate(${sx}px,${sy}px) scale(1.42)`, opacity: flicker, filter: glitch ? "hue-rotate(40deg) saturate(2)" : "none" }}>
        <div style={{ position: "absolute", inset: 0, background: red ? "linear-gradient(170deg,#3a0c16 0%,#1a0a10 60%,#0b0508 100%)" : "linear-gradient(170deg,#1c2b52 0%,#0f1730 55%,#080b16 100%)" }}>
          <div style={{ position: "absolute", top: 34, width: "100%", textAlign: "center", fontFamily: SANS, fontWeight: 600, fontSize: 24, color: red ? "#ff9aa6" : INK }}>
            {red ? `${bn(50)}টি মেসেজের উত্তর দেওয়া হয়নি` : `${bn(count)}টি নতুন মেসেজ`}
          </div>
          <div style={{ position: "absolute", top: 110, width: "100%", textAlign: "center", fontFamily: SANS, color: INK }}>
            <div style={{ fontSize: 22, opacity: 0.75 }}>শনিবার, ২৭ সেপ্টেম্বর</div>
            <div style={{ fontSize: 132, fontWeight: 500, lineHeight: 1.05 }}>২:{red ? "৪৪" : "১৭"}</div>
          </div>
          {shown.slice().reverse().slice(0, 6).map((n, i) => (
            <Notification key={n.t} n={n} age={red ? 2 : t - n.t} index={i} dim={red ? 0.55 : 1} />
          ))}
        </div>
      </div>
      {glitch && <AbsoluteFill style={{ background: `repeating-linear-gradient(0deg, rgba(255,255,255,.06) 0 3px, transparent 3px ${6 + Math.round(Math.sin(t * 80) * 3)}px)`,
        transform: `translateX(${Math.sin(t * 150) * 30}px)` }} />}
    </AbsoluteFill>
  );
}

function TitleCard({ t, at, text, color }) {
  const a = t - at;
  const s = ramp(a, 0, 0.25, 1.25, 1, Easing.out(Easing.cubic));
  const o = Math.min(ramp(a, 0, 0.08), ramp(a, 0.8, 1.0, 1, 0));
  const [sx] = shake(t, a < 0.2 ? 14 * (1 - a / 0.2) : 0);
  return (
    <AbsoluteFill style={{ background: "#000", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: SERIF, fontSize: 124, color, opacity: o, transform: `translateX(${sx}px) scale(${s})`, letterSpacing: 1,
        textShadow: `${a < 0.15 ? -6 : 0}px 0 rgba(255,0,60,.6), ${a < 0.15 ? 6 : 0}px 0 rgba(0,200,255,.6), 0 0 50px rgba(255,255,255,.15)` }}>{text}</div>
    </AbsoluteFill>
  );
}

// ---- the answer ------------------------------------------------------------------
const ANSWERS = [
  { at: 0, me: true, text: "আপু, এটা কি এখনো আছে?" },
  { at: 40.5, text: "জি আপু, আছে 😊 দাম ৳১,২৫০। কোন সাইজ লাগবে?" },
  { at: 41.4, me: true, text: "vai XL hobe? dhakar baire den?" },
  { at: 42.1, text: "জি, XL আছে। ঢাকার বাইরেও পাঠাই — ৩–৪ দিনে পৌঁছাবে।" },
  { at: 42.9, me: true, voice: true },
  { at: 43.6, text: "শুনেছি 🙂 নীল রঙেরটাও স্টকে আছে। পাঠিয়ে দেব?" },
  { at: 44.1, me: true, photo: true },
  { at: 44.8, text: "ছবির পণ্যটা পেয়েছি — এটাও আছে। দুটোই অর্ডার করবেন?" },
  { at: 45.8, order: true },
];
// the words of line 06, where the dramatised read says them
const WORDS = [[41.0, "বাংলায়।"], [42.2, "বাংলিশে।"], [43.4, "ভয়েস মেসেজে।"], [44.5, "ছবি দেখে।"]];

function Answer({ t }) {
  const visible = ANSWERS.filter((m) => t >= m.at);
  const word = WORDS.filter(([at]) => t >= at).pop();
  const wAge = word ? t - word[0] : 0;
  const [sx, sy] = shake(t, t < SIL1 + 0.35 ? 12 * (1 - (t - SIL1) / 0.35) : 0);
  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 90% 60% at 50% 30%, #2a0f1c 0%, #0B0B0E 60%, #050507 100%)", transform: `translate(${sx}px,${sy}px)` }}>
      <AbsoluteFill style={{ transform: `scale(${ramp(t, SIL1, 47, 1.04, 1.1, Easing.linear)})` }}>
        <div style={{ position: "absolute", top: 150, left: 60, right: 60, display: "flex", alignItems: "center", gap: 20, paddingBottom: 26,
          borderBottom: "1px solid #26262d", fontFamily: SANS, color: INK }}>
          <div style={{ width: 76, height: 76, borderRadius: 38, background: "#2a2a31" }} />
          <div><div style={{ fontSize: 34, fontWeight: 600 }}>আপনার দোকান</div>
            <div style={{ fontSize: 24, color: ACCENT, fontWeight: 600 }}>TellMore AI উত্তর দিচ্ছে · রাত ২:৪৪</div></div>
        </div>
        <div style={{ position: "absolute", left: 60, right: 60, top: 300, bottom: 640, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 22,
          overflow: "hidden", WebkitMaskImage: "linear-gradient(to bottom, transparent 0, #000 140px)", maskImage: "linear-gradient(to bottom, transparent 0, #000 140px)" }}>
          {visible.slice(-6).map((m) => <Bubble key={m.at + (m.text || "")} m={m} age={t - m.at} />)}
        </div>
      </AbsoluteFill>
      {word && (
        <div style={{ position: "absolute", bottom: 330, width: "100%", textAlign: "center", fontFamily: SERIF, fontSize: 124, color: INK,
          opacity: ramp(wAge, 0, 0.2), filter: `blur(${ramp(wAge, 0, 0.25, 16, 0)}px)`, transform: `scale(${ramp(wAge, 0, 0.35, 1.15, 1)})`,
          textShadow: "0 0 50px rgba(192,74,114,.6)" }}>{word[1]}</div>
      )}
      <Vignette strength={0.55} />
    </AbsoluteFill>
  );
}

function Silence({ t }) {
  const a = ramp(t, 38.3, 38.7);
  return (
    <AbsoluteFill style={{ background: "#000", alignItems: "center", justifyContent: "center" }}>
      <div style={{ opacity: a, transform: `scale(${0.85 + 0.15 * a + ramp(t, 39.8, SIL1, 0, 0.5)})`, padding: "30px 40px", borderRadius: 44, background: MAROON,
        boxShadow: `0 0 ${90 + 40 * Math.sin(t * 3)}px rgba(192,74,114,.6)` }}>
        <Dots t={t} from={38.3} />
      </div>
    </AbsoluteFill>
  );
}

function Morning({ t }) {
  const o = ramp(t, 47.6, 48.2);
  return (
    <div style={{ position: "absolute", bottom: 330, width: "100%", textAlign: "center", fontFamily: SERIF, fontSize: 118, color: "#fff5e8",
      opacity: o * ramp(t, 50.0, 50.3, 1, 0), filter: `blur(${(1 - o) * 10}px)`, textShadow: "0 4px 40px rgba(0,0,0,.7)" }}>আপনি নিশ্চিন্তে<br />ঘুমান।</div>
  );
}

function Reveal({ t }) {
  const m = ramp(t, HIT - 0.02, HIT + 0.9, 0, 1, Easing.out(Easing.cubic));
  const [sx, sy] = shake(t, t < HIT + 0.5 ? 14 * (1 - (t - HIT) / 0.5) : 0);
  const line = ramp(t, 51.2, 51.8);
  return (
    <AbsoluteFill style={{ background: "#000", alignItems: "center", justifyContent: "center", opacity: ramp(t, END - 0.5, END, 1, 0) }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, rgba(192,74,114,${0.45 * Math.exp(-(t - HIT) / 0.9)}), transparent 55%)` }} />
      <div style={{ transform: `translate(${sx}px,${sy}px) scale(${1.25 - 0.25 * m})`, opacity: m, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ width: 300, height: 300, borderRadius: 72, background: "linear-gradient(135deg,#8A2348,#5C1430)",
          boxShadow: `0 0 ${60 + 160 * Math.exp(-(t - HIT) / 0.8)}px rgba(192,74,114,.75)`, display: "grid", placeItems: "center" }}><Mark size={290} /></div>
        <div style={{ marginTop: 56, fontFamily: SANS, fontWeight: 600, fontSize: 96, color: INK, letterSpacing: 1 }}>TellMore AI</div>
        <div style={{ marginTop: 6, fontFamily: SERIF, fontSize: 88, color: ACCENT, opacity: line, filter: `blur(${(1 - line) * 8}px)` }}>জেগেই আছে।</div>
      </div>
    </AbsoluteFill>
  );
}

function EndCard({ t }) {
  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 40%, #1a0c12 0%, #050507 70%)", alignItems: "center", justifyContent: "center",
      opacity: ramp(t, END, END + 0.5) * ramp(t, TSECONDS - 0.7, TSECONDS, 1, 0), fontFamily: SANS, color: INK }}>
      <div style={{ width: 150, height: 150, borderRadius: 36, background: "linear-gradient(135deg,#8A2348,#5C1430)", display: "grid", placeItems: "center" }}><Mark size={145} /></div>
      <div style={{ marginTop: 60, fontSize: 88, fontWeight: 600 }}>৩ দিন ফ্রি ট্রায়াল</div>
      <div style={{ marginTop: 4, fontSize: 44, color: "#b9b9c2" }}>কোনো কার্ড লাগে না</div>
      <div style={{ marginTop: 60, padding: "22px 54px", borderRadius: 16, background: MAROON, fontSize: 54, fontWeight: 600 }}>tellmoreai.com</div>
      <div style={{ position: "absolute", bottom: 150, fontSize: 24, color: "#6f6f78" }}>দৃশ্যের চ্যাটগুলো উদাহরণ · Autolinium, চট্টগ্রাম</div>
    </AbsoluteFill>
  );
}

// spoken lines 01–05 as subtitles (06–08 are on screen as words and titles)
function Subtitle({ t }) {
  const line = VO.lines.find((l) => ["01", "02", "03", "04", "05"].includes(l.id) && t >= TL.vo[l.id] && t < TL.vo[l.id] + (l.dramaDur || 3) - 0.5);
  if (!line) return null;
  const at = TL.vo[line.id], end = at + (line.dramaDur || 3) - 0.5;
  return (
    <div style={{ position: "absolute", left: 70, right: 70, bottom: 240, textAlign: "center", opacity: Math.min(ramp(t, at, at + 0.2), ramp(t, end - 0.25, end, 1, 0)),
      fontFamily: SANS, fontWeight: 500, fontSize: 44, color: INK }}>
      <span style={{ background: "rgba(0,0,0,.6)", padding: "8px 22px", borderRadius: 12, lineHeight: 1.6, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>{line.text}</span>
    </div>
  );
}

export function Teaser() {
  useFonts();
  const t = useCurrentFrame() / TFPS;
  let layer = null;
  if (t >= 19.0 && t < 24.0) layer = <Pile t={t} />;
  else if (t >= 33.0 && t < SIL0) layer = <Pile t={t} red />;
  else if (t >= SIL0 && t < SIL1) layer = <Silence t={t} />;
  else if (t >= SIL1 && t < 47.0) layer = <Answer t={t} />;
  else if (t >= HIT && t < END) layer = <Reveal t={t} />;
  else if (t >= END) layer = <EndCard t={t} />;
  const title = TITLES.find(([at]) => t >= at && t < at + 1.0);
  const flash = HITS.reduce((m, h) => Math.max(m, t >= h && t < h + 0.25 ? 1 - (t - h) / 0.25 : 0), 0);
  const typed = graphemes("রাত ২টা ১৭");
  const nTyped = Math.floor(ramp(t, 1.1, 1.9, 0, typed.length, Easing.linear));
  const bars = t < END;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {SHOTS.map(([name, a, b, from, z0, z1], i) => (
        <Sequence key={i} from={Math.round(a * TFPS)} durationInFrames={Math.round((b - a) * TFPS)}>
          <Clip name={name} a={a} b={b} from={from} z0={z0} z1={z1} />
        </Sequence>
      ))}
      {layer}
      {title && <TitleCard t={t} at={title[0]} text={title[1]} color={title[2]} />}
      {t >= 8.6 && t < 13.0 && <>
        <Floating t={t} at={9.0} who="রুমানা" text="আপু, এটা কি এখনো আছে?" y={420} />
        <Floating t={t} at={10.7} who="সাকিব" text="দাম কত?" y={640} />
        <Floating t={t} at={11.9} who="মিম" text="আছেন?" y={830} />
      </>}
      {t >= 47.0 && t < HIT && <Morning t={t} />}
      {t > 1.0 && t < 4.1 && (
        <div style={{ position: "absolute", top: 300, width: "100%", textAlign: "center", fontFamily: SERIF, fontSize: 96, color: INK, letterSpacing: 2,
          opacity: ramp(t, 3.6, 4.1, 1, 0), textShadow: "0 0 40px rgba(0,0,0,.8)" }}>{typed.slice(0, nTyped).join("")}</div>
      )}
      <Subtitle t={t} />
      <AbsoluteFill style={{ background: "#fff", opacity: flash * 0.28, mixBlendMode: "screen" }} />
      <Grain amount={0.08} />
      {bars && <>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 96, background: "#000" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 96, background: "#000" }} />
      </>}
    </AbsoluteFill>
  );
}
