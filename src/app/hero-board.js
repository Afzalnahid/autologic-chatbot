"use client";
import { useEffect, useRef, useState } from "react";
import { CH, CONVOS, P } from "@/lib/landing.js";

// The phone in the home page's hero (owner, 2026-10-04): four real
// conversations, one per channel, as a carousel. It plays on its own — each
// message arrives in turn, the bot "types" before it answers, and the next
// conversation slides in — and the visitor can step back and forth with the
// arrows, the channel buttons, the progress bars or a swipe.
//
// One clock drives everything: `elapsed` milliseconds into the current
// conversation, ticking only while the phone is on screen, the tab is visible
// and nobody is pointing at it. What is shown, the typing dots and the progress
// bar are all read off that one number, so pausing is simply not ticking.
//
// The first conversation is drawn complete on the first paint (the page at rest
// shows what it does); the clock starts at the end of its messages.

const TICK = 100, START = 400, ME_GAP = 900, TYPING = 1000, BOT_GAP = 1300, HOLD = 3200;

function schedule(msgs) {
  let t = START;
  const at = [], typing = [];
  for (const m of msgs) {
    if (m.me) { at.push(t); t += ME_GAP; }
    else { typing.push([t, t + TYPING]); t += TYPING; at.push(t); t += BOT_GAP; }
  }
  return { at, typing, done: at[at.length - 1] + 200, total: t + HOLD };
}
const PLAN = CONVOS.map((c) => schedule(c.msgs));

function Bubble({ me, children }) {
  return <div style={{ maxWidth: "86%", fontSize: 12, lineHeight: 1.5, padding: "7px 10px", borderRadius: 12,
    background: me ? P.fill : P.bubble, color: me ? P.onAccent : P.ink,
    borderBottomRightRadius: me ? 4 : 12, borderBottomLeftRadius: me ? 12 : 4,
    border: me ? "none" : `1px solid ${P.line}` }}>{children}</div>;
}

function Message({ m, eager }) {
  const cards = m.products || (m.product ? [m.product] : []);
  const img = (src, alt) => <img src={src} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" />;
  return <div className={`al-msg${m.me ? " me" : ""}`}>
    <Bubble me={m.me}>
      {m.photo && <div className="al-photo">{img(m.photo, "")}</div>}
      {m.text}
      {cards.length > 0 && <div className={cards.length > 1 ? "al-cards" : undefined}>
        {cards.map((p, i) => <div key={i} className="al-card">
          {img(p.img, p.name)}
          <div style={{ padding: "5px 8px 6px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.35 }}>{p.name}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: P.accent, marginTop: 2 }}>{p.price}</div>
            {p.meta && <div style={{ fontSize: 10, color: P.inkSoft, marginTop: 1 }}>{p.meta}</div>}
          </div>
        </div>)}
      </div>}
    </Bubble>
  </div>;
}

export default function HeroBoard({ c, bn }) {
  const [idx, setIdx] = useState(0);
  const [elapsed, setElapsed] = useState(PLAN[0].done);
  const [dir, setDir] = useState("");
  const [hover, setHover] = useState(false);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);
  const wrap = useRef(null);
  const touch = useRef(null);

  // Never animate for someone who asked for less motion; never run off screen.
  useEffect(() => {
    try { setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch {}
    const el = wrap.current;
    let io;
    if (el && "IntersectionObserver" in window) {
      io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting && document.visibilityState === "visible"), { threshold: 0.25 });
      io.observe(el);
    }
    const onVis = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    // The next conversations' photos, ready before they are needed.
    for (const cv of CONVOS) for (const m of cv.msgs) for (const src of [m.photo, m.product?.img, ...(m.products || []).map((p) => p.img)]) if (src) { const i = new Image(); i.src = src; }
    return () => { io?.disconnect(); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  const playing = !reduced && visible && !hover;
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setElapsed((e) => e + TICK), TICK);
    return () => clearInterval(t);
  }, [playing]);

  const go = (n, d) => {
    const k = (n + CONVOS.length) % CONVOS.length;
    setDir(d || (k > idx ? "next" : "prev"));
    setIdx(k);
    setElapsed(reduced ? PLAN[k].done : 0);
  };
  // The end of a conversation moves on to the next.
  useEffect(() => { if (elapsed >= PLAN[idx].total) go(idx + 1, "next"); }, [elapsed, idx]); // eslint-disable-line react-hooks/exhaustive-deps

  const cv = CONVOS[idx], plan = PLAN[idx], ch = CH[cv.ch];
  const shown = reduced ? cv.msgs.length : plan.at.filter((t) => elapsed >= t).length;
  const typing = !reduced && plan.typing.some(([a, b]) => elapsed >= a && elapsed < b);
  const complete = shown >= cv.msgs.length;
  const progress = Math.min(1, elapsed / plan.total);
  const label = (k) => `${k + 1} / ${CONVOS.length}: ${CH[CONVOS[k].ch].short}`;

  const onTouchStart = (e) => { touch.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touch.current === null) return;
    const dx = e.changedTouches[0].clientX - touch.current;
    touch.current = null;
    if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1), dx < 0 ? "next" : "prev");
  };

  return <div ref={wrap} className="al-board" style={{ maxWidth: 330, margin: "0 auto", width: "100%" }}
    role="region" aria-roledescription="carousel" aria-label={bn ? "বটের কথোপকথন" : "Conversations with the bot"}
    onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
    onFocus={() => setHover(true)} onBlur={() => setHover(false)}>

    <div className="al-bars">
      {CONVOS.map((x, k) => <button key={x.ch} type="button" onClick={() => go(k)} aria-label={label(k)} aria-current={k === idx ? "true" : undefined}
        className={k < idx ? "done" : ""}>
        <span><i style={k === idx ? { transform: `scaleX(${progress})`, transition: `transform ${TICK}ms linear` } : undefined} /></span>
      </button>)}
    </div>

    <div className="al-phone" style={{ background: "linear-gradient(160deg, #2A2230, #121116)" }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="al-screen" style={{ background: P.paper2 }}>
        <div className="al-notch" />
        <div className="al-status" style={{ color: P.inkSoft }}>
          <span className="al-mono">9:41</span>
          <span style={{ display: "inline-flex", gap: 5 }}>
            <i className="ti ti-wifi" style={{ fontSize: 12 }} /><i className="ti ti-battery-3" style={{ fontSize: 12 }} />
          </span>
        </div>
        <div key={idx} className={`al-slide${dir ? ` in-${dir}` : ""}`} aria-roledescription="slide" aria-label={label(idx)}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 16px 11px", borderBottom: `1px solid ${P.line}`, background: P.paper2 }}>
            <i className={`ti ${ch.icon}`} style={{ fontSize: 16, color: P.blue }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>{ch.name}</span>
            <span className="lbl" style={{ marginLeft: "auto", fontSize: 9, color: P.inkSoft, letterSpacing: ".09em", textTransform: "uppercase" }}>{c[cv.kind]}</span>
          </div>
          <div className="al-stack" aria-live="off">
            {cv.msgs.slice(0, shown).map((m, i) => <Message key={i} m={m} eager={idx === 0} />)}
            {typing && <div className="al-msg"><div className="al-typing"><b /><b /><b /></div></div>}
          </div>
          <div style={{ padding: "9px 16px", borderTop: `1px solid ${P.line}`, fontSize: 9.5, letterSpacing: ".06em", textTransform: "uppercase",
            color: P.inkSoft, display: "flex", alignItems: "center", gap: 7, background: P.paper2, minHeight: 34,
            opacity: complete ? 1 : 0, transition: "opacity .35s ease-out" }}>
            <i className="ti ti-check" style={{ fontSize: 12, color: P.live }} />{c.notes[cv.note]}
          </div>
        </div>
      </div>
    </div>

    <div className="al-ctrl">
      <button type="button" onClick={() => go(idx - 1, "prev")} aria-label={bn ? "আগের কথোপকথন" : "Previous conversation"}><i className="ti ti-chevron-left" /></button>
      {CONVOS.map((x, k) => <button key={x.ch} type="button" className={`al-ch${k === idx ? " on" : ""}`} onClick={() => go(k)}
        aria-label={label(k)} title={CH[x.ch].short}><i className={`ti ${CH[x.ch].icon}`} /></button>)}
      <button type="button" onClick={() => go(idx + 1, "next")} aria-label={bn ? "পরের কথোপকথন" : "Next conversation"}><i className="ti ti-chevron-right" /></button>
    </div>
  </div>;
}
