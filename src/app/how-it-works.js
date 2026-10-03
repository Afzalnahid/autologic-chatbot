"use client";
import { useEffect, useRef, useState } from "react";
import { CH, STAGES } from "@/lib/landing.js";

// "How it works" (owner, 2026-10-04: "make it more attractive, more
// professional, and fix the proportions — it feels stretched"). Four things the
// bot does, as tabs on the left; on the right, one message going through the
// same four beats: the customer writes, the bot reads your own information, it
// replies, and it does the work. It moves on by itself every few seconds,
// pauses while pointed at or off screen, and any tab can be opened by hand. On
// a phone the tabs become a row of chips above the card, so the section is a
// card high instead of a long list.

const PER = 6500, TICK = 100;

export default function HowItWorks({ bn }) {
  const [k, setK] = useState(0);
  const [t, setT] = useState(0);
  const [hover, setHover] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  const wrap = useRef(null);
  const tabs = useRef(null);

  useEffect(() => {
    try { setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch {}
    const el = wrap.current;
    if (!el || !("IntersectionObserver" in window)) { setVisible(true); return; }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const playing = visible && !hover && !reduced;
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setT((x) => x + TICK), TICK);
    return () => clearInterval(id);
  }, [playing]);
  useEffect(() => { if (t >= PER) { setK((x) => (x + 1) % STAGES.length); setT(0); } }, [t]);

  // Keep the active chip in view on a phone, without moving the page.
  useEffect(() => {
    const row = tabs.current, on = row?.children?.[k];
    if (row && on && row.scrollWidth > row.clientWidth) row.scrollTo({ left: on.offsetLeft - 8, behavior: "smooth" });
  }, [k]);

  const open = (i) => { setK(i); setT(0); };
  const s = STAGES[k], ch = CH[s.ch];

  return <div ref={wrap} className="hw" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
    <div>
      <div ref={tabs} className="hw-tabs" role="tablist" aria-label={bn ? "বট যা যা করে" : "What the bot does"}>
        {STAGES.map((x, i) => <button key={x.ch} type="button" role="tab" aria-selected={i === k} className={`hw-tab${i === k ? " on" : ""}`} onClick={() => open(i)}>
          <span className="hw-ic"><i className={`ti ${x.icon}`} /></span>
          <span className="hw-t">{bn ? x.titleBn : x.title}<small>{String(i + 1).padStart(2, "0")}</small></span>
          <span className="hw-cap">{bn ? x.capBn : x.cap}</span>
          {i === k && !reduced && <span className="hw-bar" style={{ width: "100%", transform: `scaleX(${t / PER})`, transition: `transform ${TICK}ms linear` }} />}
        </button>)}
      </div>
    </div>

    <div>
      <div className="hw-card" role="tabpanel" aria-label={bn ? s.titleBn : s.title}>
        <div className="hw-head"><i className={`ti ${ch.icon}`} style={{ fontSize: 16, color: "#E08BA6" }} /><b>{ch.name}</b><span style={{ marginLeft: "auto" }}>{bn ? "এখনই" : "just now"}</span></div>
        <div className="hw-steps" key={k}>
          <div className="hw-row">
            <span className="hw-dot"><i className="ti ti-message-circle" /></span>
            <div style={{ minWidth: 0 }}>
              <div className="hw-lbl">{bn ? "গ্রাহক লেখেন" : "The customer writes"}</div>
              <div className={`hw-me${s.photo ? "" : " noimg"}`}>{s.photo && <img src={s.photo} alt="" />}<span>{bn ? s.inn : s.inEn}</span></div>
            </div>
          </div>
          <div className="hw-row">
            <span className="hw-dot"><i className="ti ti-sparkles" /></span>
            <div style={{ minWidth: 0 }}>
              <div className="hw-lbl">{bn ? "TellMore যা দেখে" : "TellMore reads"}</div>
              <span className="hw-src"><i className={`ti ${s.srcIcon}`} />{bn ? s.srcBn : s.src}</span>
            </div>
          </div>
          <div className="hw-row">
            <span className="hw-dot"><i className="ti ti-message-reply" /></span>
            <div style={{ minWidth: 0 }}>
              <div className="hw-lbl">{bn ? "উত্তর দেয়" : "It replies"}</div>
              <div className="hw-bot">{bn ? s.say : s.sayEn}
                {s.product && <div className="hw-prod"><img src={s.product.img} alt={bn ? s.product.name : s.product.nameEn} /><div><b>{bn ? s.product.name : s.product.nameEn}</b><span>{bn ? s.product.price : s.product.priceEn}</span></div></div>}
              </div>
            </div>
          </div>
          <div className="hw-row">
            <span className="hw-dot"><i className="ti ti-check" /></span>
            <div style={{ minWidth: 0 }}>
              <div className="hw-lbl">{bn ? "আর কাজটা করে" : "And gets it done"}</div>
              <span className="hw-did"><i className="ti ti-circle-check" />{bn ? s.didBn : s.did}</span>
            </div>
          </div>
        </div>
      </div>
      <p className="hw-mcap">{bn ? s.capBn : s.cap}</p>
    </div>
  </div>;
}
