// "২টা ১৭" — the TellMore AI teaser. 9:16, 47 s. Story and timing:
// marketing/trailer/script.md; voiceover lines and their start times:
// marketing/trailer/lines.json; sound design: marketing/trailer/sfx.mjs.
// No people on screen (owner's choice): the phone, the room, the messages.
// Every chat in it is an example; the end card says so.
import React from "react";
import {
  AbsoluteFill, Easing, continueRender, delayRender, interpolate,
  spring, staticFile, useCurrentFrame, useVideoConfig,
} from "remotion";
import VO from "../../../marketing/trailer/lines.json";

export const FPS = 30;
export const SECONDS = 47;

const MAROON = "#7B1C3E", ACCENT = "#C04A72", INK = "#F4F4F6";
const SERIF = "'Tiro Bangla', serif";
const SANS = "'Hind Siliguri', 'Segoe UI', sans-serif";

// Fonts ship in public/trailer/fonts so the render never depends on the network.
const FACES = [["Tiro Bangla", "TiroBangla-Regular.ttf", "400"], ["Hind Siliguri", "HindSiliguri-Medium.ttf", "500"], ["Hind Siliguri", "HindSiliguri-SemiBold.ttf", "600"]];
let fontsLoading = null;
const loadFonts = () => (fontsLoading ||= Promise.all(FACES.map(([fam, file, weight]) =>
  new FontFace(fam, `url(${staticFile(`trailer/fonts/${file}`)})`, { weight }).load().then((f) => document.fonts.add(f)),
)));
// Hold every frame until the Bangla faces are in, or the first frames render in a fallback font.
function useFonts() {
  const [handle] = React.useState(() => delayRender("trailer fonts"));
  React.useEffect(() => { loadFonts().then(() => continueRender(handle), (e) => { console.error(e); continueRender(handle); }); }, [handle]);
}

const bn = (n) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
const ramp = (t, a, b, x = 0, y = 1, easing = Easing.inOut(Easing.cubic)) => interpolate(t, [a, b], [x, y], { ...clamp, easing });
const graphemes = (s) => [...new Intl.Segmenter("bn", { granularity: "grapheme" }).segment(s)].map((g) => g.segment);
const shake = (t, amp) => [Math.sin(t * 91.7) * amp + Math.sin(t * 37.3) * amp * 0.6, Math.cos(t * 83.1) * amp + Math.sin(t * 29.9) * amp * 0.5];

// ---- beats (seconds) ------------------------------------------------------
const CUT = 19.6;          // the screen goes dark and the sound stops
const CHAT = 24.8;         // someone answers
const MORNING = 33.6;
const LOGO = 38.8, HIT = 39.0;
const END = 43.4;

// The pile-up: the same accelerating schedule as the buzzes in sfx.mjs.
const PILE = (() => { const out = []; let t = 8.4, g = 0.8; while (t < 13.8) { out.push(+t.toFixed(3)); t += g; g = Math.max(0.1, g * 0.8); } return out; })();
const NAMES = ["তানভীর", "নুসরাত", "সাকিব", "মিম", "রাফি", "জান্নাত", "আরিফ", "সুমাইয়া", "ফাহিম", "তাসনিম", "রিয়াদ", "লাবিবা", "ইমরান", "অর্পা", "সাদিয়া"];
const TEXTS = ["দাম কত?", "ডেলিভারি কবে পাব?", "অর্ডার করতে চাই", "XL আছে?", "vai reply den", "কালারটা কি এমনই?", "ঢাকার বাইরে দেন?", "হ্যালো?", "আছেন?", "cash on delivery hobe?", "আজকে পাঠাতে পারবেন?", "প্লিজ রিপ্লাই দিন", "স্টক আছে?", "দাম একটু কম হবে?", "???"];
const NOTES = [{ t: 3.9, who: "রুমানা", text: "আপু, এটা কি এখনো আছে?" }, ...PILE.map((t, i) => ({ t, who: NAMES[i % NAMES.length], text: TEXTS[i % TEXTS.length] }))];

// ---- shared pieces ----------------------------------------------------------
function Grain({ amount = 0.07 }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ mixBlendMode: "overlay", opacity: amount, pointerEvents: "none" }}>
      <svg width="100%" height="100%"><filter id={`g${f % 6}`}><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={f % 6} /></filter>
        <rect width="100%" height="100%" filter={`url(#g${f % 6})`} /></svg>
    </AbsoluteFill>
  );
}
const Vignette = ({ strength = 0.75 }) => (
  <AbsoluteFill style={{ background: `radial-gradient(ellipse 75% 60% at 50% 48%, transparent 40%, rgba(0,0,0,${strength}) 100%)` }} />
);
function Mark({ size, color = "#fff" }) {
  return (
    <svg width={size} height={size} viewBox="162 155 700 700">
      <path fill={color} d="M330 522V517A115 115 0 0 1 445 402H580A115 115 0 0 1 695 517V522H632.6A74 74 0 0 0 559 456H466A74 74 0 0 0 392.4 522Z" />
      <path fill={color} d="M330 538V545A115 115 0 0 0 375 636V674L446 660H580A115 115 0 0 0 695 545V538H632.6A74 74 0 0 1 559 604H466A74 74 0 0 1 392.4 538Z" />
      <path fill={color} d="M322 458A47 67 0 0 0 322 592Z" /><path fill={color} d="M703 458A47 67 0 0 1 703 592Z" />
      <rect x="510" y="362" width="4" height="42" fill={color} /><circle cx="512" cy="350" r="14" fill={color} />
      <path d="M424 514Q447 481 470 514M554 514Q577 481 600 514" stroke={color} strokeWidth="13" strokeLinecap="round" fill="none" />
    </svg>
  );
}
// Subtitles for sound-off viewers: lines 01–05 (the others are on screen as titles).
function Subtitle({ t }) {
  const line = VO.lines.find((l) => ["01", "02", "03", "04", "05"].includes(l.id) && t >= l.at && t < l.at + (l.dur || 3.5));
  if (!line) return null;
  const a = Math.min(ramp(t, line.at, line.at + 0.25), ramp(t, line.at + (line.dur || 3.5) - 0.3, line.at + (line.dur || 3.5), 1, 0));
  return (
    <div style={{ position: "absolute", left: 80, right: 80, bottom: 250, textAlign: "center", opacity: a,
      fontFamily: SANS, fontWeight: 500, fontSize: 44, color: INK }}><span style={{ background: "rgba(0,0,0,.62)", padding: "8px 22px", borderRadius: 12, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone", lineHeight: 1.6 }}>{line.text}</span></div>
  );
}

// ---- 0 – 19.6 s: the night -------------------------------------------------
function Notification({ n, age, index, dim }) {
  const { fps } = useVideoConfig();
  const inA = spring({ frame: age * fps, fps, config: { damping: 16, stiffness: 180 } });
  return (
    <div style={{ position: "absolute", left: 22, right: 22, top: 330 + index * 154, height: 142,
      transform: `translateY(${(1 - inA) * -90}px) scale(${0.94 + 0.06 * inA})`, opacity: inA * (index > 4 ? Math.max(0, 6 - index) : 1) * dim,
      borderRadius: 30, background: "rgba(255,255,255,.13)", border: "1px solid rgba(255,255,255,.08)", padding: "18px 24px", boxSizing: "border-box",
      fontFamily: SANS, color: INK }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 21, color: "rgba(255,255,255,.62)" }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#3B82F6,#A855F7)" }} />
        Messenger · এখন
      </div>
      <div style={{ fontSize: 27, fontWeight: 600, marginTop: 6 }}>{n.who}</div>
      <div style={{ fontSize: 26, color: "rgba(255,255,255,.86)", marginTop: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.text}</div>
    </div>
  );
}

function Night({ t }) {
  // camera: slow push, a jolt on each buzz, rising tremor in the pile-up, then a pull-back
  const push = t < 14.4 ? ramp(t, 0, 14.4, 1.0, 1.24, Easing.in(Easing.quad)) : ramp(t, 14.4, CUT, 1.24, 0.92);
  const tilt = t < 14.4 ? 30 : ramp(t, 14.4, CUT, 30, 38);
  const buzzing = NOTES.some((n) => t >= n.t && t < n.t + 0.2);
  const tremor = (buzzing ? 5 : 0) + (t > 8.4 && t < 14.4 ? ramp(t, 8.4, 13.8, 0, 7) : 0);
  const [sx, sy] = shake(t, tremor);
  // the screen: on with the first light, off as the phone times out
  const screen = Math.min(ramp(t, 0.2, 1.4, 0.35, 1), ramp(t, 16.8, 19.2, 1, 0));
  const flare = NOTES.reduce((m, n) => Math.max(m, t >= n.t ? Math.exp(-(t - n.t) / 0.35) : 0), 0);
  const shown = NOTES.filter((n) => t >= n.t);
  const count = t < 8.4 ? shown.length : Math.round(ramp(t, 8.4, 13.9, 1, 50, Easing.in(Easing.quad)));
  const titleChars = graphemes("রাত ২টা ১৭ মিনিট");
  const typed = Math.floor(ramp(t, 0.4, 1.8, 0, titleChars.length, Easing.linear));
  const titleA = ramp(t, 3.2, 3.8, 1, 0);

  return (
    <AbsoluteFill style={{ background: "#040509", overflow: "hidden" }}>
      <AbsoluteFill style={{ perspective: 1900, perspectiveOrigin: "50% 30%" }}>
        <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px) rotateX(${tilt}deg) scale(${push})`, transformOrigin: "50% 58%" }}>
          {/* the bedside table, lit only by the phone */}
          <AbsoluteFill style={{ inset: -600, background: "repeating-linear-gradient(94deg, #0d0a08 0 38px, #110d0a 38px 41px, #0c0907 41px 90px)" }} />
          <AbsoluteFill style={{ inset: -600, background: `radial-gradient(ellipse 34% 30% at 50% 50%, rgba(90,130,255,${0.10 + 0.22 * screen + 0.18 * flare}), transparent 70%)` }} />
          {/* the phone */}
          <div style={{ position: "absolute", left: 260, top: 380, width: 560, height: 1140, borderRadius: 74, background: "#0a0a0c",
            border: "10px solid #18181c", boxShadow: "0 60px 120px rgba(0,0,0,.8)", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, opacity: screen, filter: `brightness(${0.85 + 0.5 * flare})`,
              background: "linear-gradient(170deg,#1c2b52 0%,#0f1730 55%,#080b16 100%)" }}>
              <div style={{ position: "absolute", top: 110, width: "100%", textAlign: "center", fontFamily: SANS, color: INK }}>
                <div style={{ fontSize: 22, opacity: 0.75 }}>শনিবার, ২৭ সেপ্টেম্বর</div>
                <div style={{ fontSize: 132, fontWeight: 500, lineHeight: 1.05 }}>২:১৭</div>
              </div>
              {t >= 8.4 && (
                <div style={{ position: "absolute", top: 36, left: 0, right: 0, textAlign: "center", fontFamily: SANS, fontWeight: 600,
                  fontSize: 24, color: t > 16 ? "#ff9a9a" : INK }}>
                  {t > 16 ? `${bn(50)}টি মেসেজের উত্তর দেওয়া হয়নি` : `${bn(count)}টি নতুন মেসেজ`}
                </div>
              )}
              {shown.slice().reverse().slice(0, 6).map((n, i) => (
                <Notification key={n.t} n={n} age={t - n.t} index={i} dim={1} />
              ))}
            </div>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
      <Vignette strength={0.85} />
      {/* the heartbeat, felt as a pulse in the dark */}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(123,28,62,${t > 9 && t < CUT ? 0.18 * Math.abs(Math.sin(t * Math.PI * (t < 14.2 ? 1.2 + (t - 9) * 0.18 : 2.1 - (t - 14.2) * 0.2))) : 0}) 100%)` }} />
      <div style={{ position: "absolute", top: 230, width: "100%", textAlign: "center", fontFamily: SERIF, fontSize: 62, letterSpacing: 2, color: INK, opacity: titleA }}>
        {titleChars.slice(0, typed).join("")}<span style={{ opacity: t % 1 < 0.5 && typed < titleChars.length ? 1 : 0 }}>|</span>
      </div>
    </AbsoluteFill>
  );
}

// ---- 19.6 – 24.8 s: silence, and three dots -------------------------------
function Dots({ t, from }) {
  return (
    <div style={{ display: "flex", gap: 16 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ width: 22, height: 22, borderRadius: 11, background: "#fff",
          transform: `translateY(${Math.sin((t - from) * 7 - i * 0.9) * 7}px)`, opacity: 0.55 + 0.45 * Math.max(0, Math.sin((t - from) * 7 - i * 0.9)) }} />
      ))}
    </div>
  );
}
function Dark({ t }) {
  const a = ramp(t, 20.6, 21.1);
  const grow = ramp(t, 24.2, CHAT, 1, 1.6);
  return (
    <AbsoluteFill style={{ background: "#000", alignItems: "center", justifyContent: "center" }}>
      <div style={{ opacity: a * ramp(t, 24.4, CHAT, 1, 0), transform: `scale(${(0.8 + 0.2 * a) * grow})`, padding: "30px 40px", borderRadius: 44,
        background: MAROON, boxShadow: `0 0 ${80 + 30 * Math.sin(t * 3)}px rgba(192,74,114,.55)` }}>
        <Dots t={t} from={20.6} />
      </div>
    </AbsoluteFill>
  );
}

// ---- 24.8 – 33.6 s: the answers -------------------------------------------
const CHAT_LOG = [
  { at: 0, me: true, text: "আপু, এটা কি এখনো আছে?" },
  { at: 25.0, text: "জি আপু, আছে 😊 দাম ৳১,২৫০। কোন সাইজ লাগবে?" },
  { at: 26.6, me: true, text: "vai XL hobe? dhakar baire den?" },
  { at: 27.3, text: "জি, XL আছে। ঢাকার বাইরেও পাঠাই — ৩–৪ দিনে পৌঁছাবে।" },
  { at: 28.0, me: true, voice: true },
  { at: 28.8, text: "শুনেছি 🙂 নীল রঙেরটাও স্টকে আছে। পাঠিয়ে দেব?" },
  { at: 29.3, me: true, photo: true },
  { at: 30.1, text: "ছবির পণ্যটা পেয়েছি — এটাও আছে। দুটোই অর্ডার করবেন?" },
  { at: 31.4, order: true },
];
// in step with the owner's voice: the words of line 06 land at these seconds
const WORDS = [[25.95, "বাংলায়।"], [27.05, "বাংলিশে।"], [28.25, "ভয়েস মেসেজে।"], [29.3, "ছবি দেখে।"]];

function Bubble({ m, age }) {
  const { fps } = useVideoConfig();
  const s = spring({ frame: age * fps, fps, config: { damping: 15, stiffness: 170 } });
  const base = { maxWidth: 700, padding: "22px 30px", borderRadius: 36, fontFamily: SANS, fontSize: 36, lineHeight: 1.4 };
  let body;
  if (m.voice) body = (
    <div style={{ ...base, background: "#26262c", color: INK, display: "flex", alignItems: "center", gap: 18 }}>
      <div style={{ width: 54, height: 54, borderRadius: 27, background: ACCENT, display: "grid", placeItems: "center", fontSize: 24 }}>▶</div>
      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>{Array.from({ length: 26 }, (_, i) => (
        <div key={i} style={{ width: 6, borderRadius: 3, background: "#bbb", height: 12 + Math.abs(Math.sin(i * 1.9) * 38) }} />))}</div>
      <div style={{ fontSize: 26, color: "#aaa" }}>০:০৬</div>
    </div>);
  else if (m.photo) body = (
    <div style={{ width: 380, height: 380, borderRadius: 30, overflow: "hidden", position: "relative",
      background: "linear-gradient(135deg,#1f3b57 0%,#2c6e7f 45%,#d9a066 100%)" }}>
      <div style={{ position: "absolute", left: 110, top: 70, width: 160, height: 250, borderRadius: "70px 70px 20px 20px", background: "rgba(255,255,255,.22)" }} />
      <div style={{ position: "absolute", right: 18, bottom: 14, fontFamily: SANS, fontSize: 22, color: "#fff", opacity: 0.8 }}>ছবি</div>
    </div>);
  else if (m.order) body = (
    <div style={{ ...base, background: "#12301f", border: "2px solid #2ED3A7", color: "#dffbf1", fontWeight: 600 }}>✅ অর্ডার কনফার্ম · ২টি পণ্য</div>);
  else body = <div style={{ ...base, background: m.me ? "#26262c" : MAROON, color: INK, boxShadow: m.me ? "none" : "0 10px 40px rgba(123,28,62,.45)" }}>{m.text}</div>;
  return (
    <div style={{ display: "flex", justifyContent: m.me ? "flex-start" : "flex-end", opacity: s,
      transform: `translateY(${(1 - s) * 40}px) scale(${0.92 + 0.08 * s})`, transformOrigin: m.me ? "left bottom" : "right bottom" }}>{body}</div>
  );
}

function Answers({ t }) {
  const visible = CHAT_LOG.filter((m) => t >= m.at);
  const typing = CHAT_LOG.find((m) => !m.me && m.at > t && m.at - t < 0.55 && m.at > 25.1);
  const zoom = ramp(t, CHAT, MORNING, 1.0, 1.06, Easing.linear);
  const word = WORDS.filter(([at]) => t >= at).pop();
  const wAge = word ? t - word[0] : 0;
  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 90% 60% at 50% 30%, #1a1016 0%, #0B0B0E 60%, #050507 100%)" }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        <div style={{ position: "absolute", top: 90, left: 60, right: 60, display: "flex", alignItems: "center", gap: 20,
          paddingBottom: 26, borderBottom: "1px solid #26262d", fontFamily: SANS, color: INK }}>
          <div style={{ width: 76, height: 76, borderRadius: 38, background: "#2a2a31" }} />
          <div><div style={{ fontSize: 34, fontWeight: 600 }}>আপনার দোকান</div>
            <div style={{ fontSize: 24, color: ACCENT, fontWeight: 600 }}>TellMore AI উত্তর দিচ্ছে · রাত ২:১৯</div></div>
        </div>
        <div style={{ position: "absolute", left: 60, right: 60, top: 250, bottom: 640, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 22, overflow: "hidden", WebkitMaskImage: "linear-gradient(to bottom, transparent 0, #000 140px)", maskImage: "linear-gradient(to bottom, transparent 0, #000 140px)" }}>
          {visible.slice(-6).map((m) => <Bubble key={m.at + (m.text || "")} m={m} age={t - m.at} />)}
          {typing && <div style={{ alignSelf: "flex-end", padding: "24px 32px", borderRadius: 36, background: MAROON }}><Dots t={t} from={0} /></div>}
        </div>
      </AbsoluteFill>
      {word && (
        <div style={{ position: "absolute", bottom: 330, width: "100%", textAlign: "center", fontFamily: SERIF, fontSize: 118, color: INK,
          opacity: ramp(wAge, 0, 0.25), filter: `blur(${ramp(wAge, 0, 0.3, 14, 0)}px)`, transform: `translateY(${ramp(wAge, 0, 0.4, 30, 0)}px)`,
          textShadow: "0 0 40px rgba(192,74,114,.45)" }}>{word[1]}</div>
      )}
      <Vignette strength={0.6} />
    </AbsoluteFill>
  );
}

// ---- 33.6 – 38.8 s: morning -------------------------------------------------
function Morning({ t }) {
  const l = ramp(t, MORNING, MORNING + 1.2);
  const rays = (t - MORNING) * 4;
  const orders = [34.0, 34.6, 35.2];
  const title = ramp(t, 34.4, 34.9);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(200deg, rgba(255,196,120,${0.9 * l}) 0%, #8a4b25 35%, #2a160d 75%, #140b07 100%)` }}>
      <AbsoluteFill style={{ opacity: 0.35 * l, background: `repeating-conic-gradient(from ${200 + rays}deg at 95% -5%, rgba(255,230,180,.35) 0deg 4deg, transparent 4deg 11deg)` }} />
      <div style={{ position: "absolute", left: 250, top: 300, width: 580, height: 1080, borderRadius: 74, background: "#0a0a0c", border: "10px solid #1d1d22",
        boxShadow: "0 60px 140px rgba(0,0,0,.6)", overflow: "hidden", transform: `translateY(${(1 - l) * 60}px)` }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(170deg,#6b3a22 0%,#2b1a12 60%,#140b07 100%)", fontFamily: SANS, color: INK }}>
          <div style={{ position: "absolute", top: 70, width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 22, opacity: 0.8 }}>শনিবার, ২৭ সেপ্টেম্বর</div>
            <div style={{ fontSize: 132, fontWeight: 500, lineHeight: 1.05 }}>৭:০৩</div>
          </div>
          {orders.filter((o) => t >= o).reverse().map((o, i) => {
            const a = ramp(t, o, o + 0.35);
            return (
              <div key={o} style={{ position: "absolute", left: 22, right: 22, top: 300 + i * 150, height: 134, borderRadius: 30, padding: "18px 24px", boxSizing: "border-box",
                background: "rgba(255,255,255,.16)", opacity: a, transform: `translateY(${(1 - a) * -40}px)` }}>
                <div style={{ fontSize: 21, opacity: 0.7, display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: MAROON }} />TellMore AI · রাত ২:{bn(19 + i * 7)}</div>
                <div style={{ fontSize: 28, fontWeight: 600, marginTop: 6 }}>🛒 নতুন অর্ডার এসেছে</div>
                <div style={{ fontSize: 24, opacity: 0.85 }}>২টি পণ্য · রাতেই নেওয়া হয়েছে</div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 250, width: "100%", textAlign: "center", fontFamily: SERIF, fontSize: 120, color: "#fff5e8",
        opacity: title, filter: `blur(${(1 - title) * 10}px)`, textShadow: "0 4px 30px rgba(0,0,0,.5)" }}>আপনি ঘুমান।</div>
      <Vignette strength={0.55} />
    </AbsoluteFill>
  );
}

// ---- 38.8 – 47 s: the name, then the offer --------------------------------
function Reveal({ t }) {
  const m = ramp(t, HIT - 0.05, HIT + 0.9, 0, 1, Easing.out(Easing.cubic));
  const [sx, sy] = shake(t, t > HIT && t < HIT + 0.5 ? 10 * (1 - (t - HIT) / 0.5) : 0);
  const line = ramp(t, 39.6, 40.2);
  const out = ramp(t, END - 0.5, END, 1, 0);
  return (
    <AbsoluteFill style={{ background: "#000", alignItems: "center", justifyContent: "center", opacity: out }}>
      <div style={{ transform: `translate(${sx}px,${sy}px) scale(${1.18 - 0.18 * m})`, opacity: m, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ width: 300, height: 300, borderRadius: 72, background: `linear-gradient(135deg,#8A2348,#5C1430)`,
          boxShadow: `0 0 ${60 + 140 * Math.exp(-(t - HIT) / 0.8)}px rgba(192,74,114,.7)`, display: "grid", placeItems: "center" }}>
          <Mark size={290} />
        </div>
        <div style={{ marginTop: 56, fontFamily: SANS, fontWeight: 600, fontSize: 92, color: INK, letterSpacing: 1 }}>TellMore AI</div>
        <div style={{ marginTop: 6, fontFamily: SERIF, fontSize: 84, color: ACCENT, opacity: line, filter: `blur(${(1 - line) * 8}px)` }}>জেগেই আছে।</div>
      </div>
    </AbsoluteFill>
  );
}
function EndCard({ t }) {
  const a = ramp(t, END, END + 0.6);
  const out = ramp(t, SECONDS - 0.7, SECONDS, 1, 0);
  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 40%, #1a0c12 0%, #050507 70%)", alignItems: "center", justifyContent: "center",
      opacity: a * out, fontFamily: SANS, color: INK }}>
      <div style={{ width: 150, height: 150, borderRadius: 36, background: "linear-gradient(135deg,#8A2348,#5C1430)", display: "grid", placeItems: "center" }}><Mark size={145} /></div>
      <div style={{ marginTop: 60, fontSize: 88, fontWeight: 600 }}>৩ দিন ফ্রি ট্রায়াল</div>
      <div style={{ marginTop: 4, fontSize: 44, color: "#b9b9c2" }}>কোনো কার্ড লাগে না</div>
      <div style={{ marginTop: 60, padding: "22px 54px", borderRadius: 16, background: MAROON, fontSize: 54, fontWeight: 600 }}>tellmoreai.com</div>
      <div style={{ position: "absolute", bottom: 130, fontSize: 24, color: "#6f6f78" }}>দৃশ্যের চ্যাটগুলো উদাহরণ · Autolinium, চট্টগ্রাম</div>
    </AbsoluteFill>
  );
}

// ---- the film -----------------------------------------------------------------
export function Trailer() {
  useFonts();
  const t = useCurrentFrame() / FPS;
  let scene;
  if (t < CUT) scene = <Night t={t} />;
  else if (t < CHAT) scene = <Dark t={t} />;
  else if (t < MORNING) scene = <Answers t={t} />;
  else if (t < LOGO) scene = <Morning t={t} />;
  else if (t < END) scene = <Reveal t={t} />;
  else scene = <EndCard t={t} />;
  // a warm flash between the answers and the morning
  const flash = t > MORNING - 0.25 && t < MORNING + 0.5 ? Math.max(0, 1 - Math.abs(t - MORNING) / 0.35) : 0;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {scene}
      <AbsoluteFill style={{ background: "#ffe2b8", opacity: flash * 0.8 }} />
      <Subtitle t={t} />
      <Grain amount={t < CUT ? 0.09 : 0.06} />
      {/* No <Audio> here: the sound goes on afterwards (marketing/trailer/mix.mjs),
          because Remotion's bundled ffmpeg crashed on this machine probing it. */}
    </AbsoluteFill>
  );
}

// Shared with the second cut (Teaser.jsx).
export { MAROON, ACCENT, INK, SERIF, SANS, useFonts, bn, ramp, graphemes, shake, NAMES, TEXTS, Grain, Vignette, Mark, Notification, Dots, Bubble };
