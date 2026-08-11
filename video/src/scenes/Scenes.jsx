import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig, Sequence } from "remotion";
import { T, CH } from "../theme.js";
import { Icon, Stage, Panel, Label, Title, Body, useRise } from "../parts.jsx";

// 1 — the hook. One promise, nothing else on screen.
export function Hook({ c }) {
  const a = useRise(0), b = useRise(8), d = useRise(16);
  const frame = useCurrentFrame();
  return (
    <Stage glow={0.75}>
      <div style={{ ...a, display: "inline-flex", alignItems: "center", gap: 12, alignSelf: "flex-start",
        border: `1px solid ${T.mint}44`, background: "rgba(46,211,167,.08)", color: T.mint,
        borderRadius: 999, padding: "10px 22px", fontSize: 22, fontWeight: 600 }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: T.mint,
          opacity: 0.6 + 0.4 * Math.sin(frame / 8) }} />
        {c.hookSmall}
      </div>
      <div style={{ ...b, marginTop: 34 }}>
        <Title size={86}>{c.hookBig[0]}</Title>
      </div>
      <div style={{ ...d }}>
        <Title size={86}>{c.hookBig[1]}</Title>
      </div>
    </Stage>
  );
}

// 2 — connecting the channels. Each card lands, then ticks over to connected.
export function Connect({ c }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const keys = Object.keys(CH);
  const head = useRise(0), sub = useRise(6);
  return (
    <Stage>
      <div style={head}><Label>{c.s1Label}</Label></div>
      <div style={sub}><Title>{c.s1Title}</Title><Body>{c.s1Body}</Body></div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 22, marginTop: 54 }}>
        {keys.map((k, i) => {
          const start = 26 + i * 9;
          const s = spring({ frame: frame - start, fps, config: { damping: 200, mass: 0.7 } });
          const linked = spring({ frame: frame - (start + 22), fps, config: { damping: 200 } });
          return (
            <Panel key={k} style={{ padding: 26, opacity: s,
              transform: `translateY(${interpolate(s, [0, 1], [40, 0])}px)` }}>
              <div style={{ width: 62, height: 62, borderRadius: 18, background: T.blueSoft,
                display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                <Icon name={CH[k].icon} size={30} color={CH[k].tint} />
              </div>
              <div style={{ fontSize: 26, fontWeight: 600 }}>{CH[k].name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 14,
                opacity: linked, color: T.mint, fontSize: 20, fontWeight: 600 }}>
                <Icon name="check" size={20} color={T.mint} />
                {linked > 0.5 ? "Connected" : ""}
              </div>
            </Panel>
          );
        })}
      </div>
    </Stage>
  );
}

// 3 — teaching it. Files drop in and are indexed.
export function Teach({ c }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const head = useRise(0), sub = useRise(6);
  return (
    <Stage>
      <div style={head}><Label>{c.s2Label}</Label></div>
      <div style={sub}><Title>{c.s2Title}</Title><Body>{c.s2Body}</Body></div>

      <Panel style={{ marginTop: 46, padding: 30, maxWidth: 900 }}>
        {c.s2Files.map((f, i) => {
          const start = 26 + i * 14;
          const s = spring({ frame: frame - start, fps, config: { damping: 200 } });
          const done = spring({ frame: frame - (start + 20), fps, config: { damping: 200 } });
          return (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 18, padding: "18px 0",
              borderTop: i ? `1px solid ${T.line}` : "none", opacity: s,
              transform: `translateX(${interpolate(s, [0, 1], [-24, 0])}px)` }}>
              <Icon name="file" size={30} />
              <div style={{ fontSize: 25, flex: 1 }}>{f}</div>
              <div style={{ width: 220, height: 8, borderRadius: 4, background: T.panelAlt, overflow: "hidden" }}>
                <div style={{ width: `${Math.round(done * 100)}%`, height: "100%", background: T.blue }} />
              </div>
              <div style={{ width: 130, textAlign: "right", fontSize: 20, fontWeight: 600,
                color: done > 0.9 ? T.mint : T.dim }}>
                {done > 0.9 ? "Indexed" : `${Math.round(done * 100)}%`}
              </div>
            </div>
          );
        })}
      </Panel>
    </Stage>
  );
}

// 4 — the product doing its job. A real conversation, typed out.
export function Chat({ c }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const head = useRise(0);
  // Each turn: typing indicator, then the bubble.
  const turns = c.chat.map((_, i) => 24 + i * 34);

  return (
    <Stage>
      <div style={{ display: "flex", gap: 70, alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <div style={head}><Label>{c.s3Label}</Label></div>
          <div style={useRise(6)}><Title>{c.s3Title}</Title><Body width={560}>{c.s3Body}</Body></div>
        </div>

        {/* A phone, because that is where all of this actually happens. */}
        <div style={{ width: 430, borderRadius: 52, padding: 14,
          background: "linear-gradient(160deg,#232B3D,#10151F)",
          boxShadow: "0 40px 90px rgba(0,0,0,.55)" }}>
          <div style={{ background: T.bg, borderRadius: 40, height: 700, overflow: "hidden",
            display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "26px 22px 16px",
              borderBottom: `1px solid ${T.line}`, background: T.panel }}>
              <Icon name="whatsapp" size={26} color={CH.whatsapp.tint} />
              <div style={{ fontSize: 21, fontWeight: 600 }}>WhatsApp Business</div>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8,
                color: T.mint, fontSize: 16 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.mint,
                  opacity: 0.5 + 0.5 * Math.sin(frame / 7) }} />
                live
              </div>
            </div>

            <div style={{ flex: 1, padding: 20, display: "flex", flexDirection: "column",
              justifyContent: "flex-end", gap: 12 }}>
              {c.chat.map((msg, i) => {
                const at = turns[i];
                const s = spring({ frame: frame - at, fps, config: { damping: 200, mass: 0.5 } });
                if (s <= 0) return null;
                return (
                  <div key={i} style={{ display: "flex", justifyContent: msg.me ? "flex-end" : "flex-start",
                    opacity: s, transform: `translateY(${interpolate(s, [0, 1], [14, 0])}px)` }}>
                    <div style={{ maxWidth: "84%", fontSize: 19, lineHeight: 1.55, padding: "13px 16px",
                      borderRadius: 18, background: msg.me ? T.blue : T.panelAlt,
                      color: msg.me ? T.ink : T.text,
                      border: msg.me ? "none" : `1px solid ${T.line}`,
                      borderBottomRightRadius: msg.me ? 6 : 18,
                      borderBottomLeftRadius: msg.me ? 18 : 6 }}>
                      {msg.text}
                    </div>
                  </div>
                );
              })}

              {/* Typing dots sit in the gap before each bot reply. */}
              {[1, 3].map((i) => {
                const show = frame > turns[i] - 20 && frame < turns[i] - 2;
                if (!show) return null;
                return (
                  <div key={"t" + i} style={{ display: "inline-flex", gap: 6, alignSelf: "flex-start",
                    padding: "14px 18px", borderRadius: 18, background: T.panelAlt,
                    border: `1px solid ${T.line}` }}>
                    {[0, 1, 2].map((n) => (
                      <span key={n} style={{ width: 8, height: 8, borderRadius: "50%", background: T.muted,
                        opacity: 0.35 + 0.65 * Math.abs(Math.sin((frame - n * 3) / 6)) }} />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Stage>
  );
}

// 5 — what it does after answering.
export function Acts({ c }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Stage>
      <div style={useRise(0)}><Label>{c.s4Label}</Label></div>
      <div style={useRise(6)}><Title>{c.s4Title}</Title></div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, marginTop: 48 }}>
        {c.s4Items.map((it, i) => {
          const s = spring({ frame: frame - (24 + i * 10), fps, config: { damping: 200 } });
          return (
            <Panel key={i} style={{ padding: 30, display: "flex", alignItems: "center", gap: 22,
              opacity: s, transform: `translateY(${interpolate(s, [0, 1], [30, 0])}px)` }}>
              <div style={{ width: 62, height: 62, borderRadius: 18, background: T.blueSoft,
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={it.icon} size={30} />
              </div>
              <div style={{ fontSize: 26, lineHeight: 1.4 }}>{it.text}</div>
            </Panel>
          );
        })}
      </div>
    </Stage>
  );
}

// 6 — the dashboard. Numbers count up rather than appearing finished.
export function Dash({ c }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Stage>
      <div style={useRise(0)}><Label>{c.s5Label}</Label></div>
      <div style={useRise(6)}><Title>{c.s5Title}</Title></div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 22, marginTop: 52 }}>
        {c.stats.map((s, i) => {
          const sp = spring({ frame: frame - (22 + i * 9), fps, config: { damping: 200 } });
          return (
            <Panel key={i} style={{ padding: 38, opacity: sp,
              transform: `translateY(${interpolate(sp, [0, 1], [34, 0])}px)` }}>
              <div style={{ fontSize: 76, fontWeight: 700, color: T.blue, letterSpacing: "-0.03em" }}>
                {s.value}
              </div>
              <div style={{ fontSize: 24, color: T.muted, marginTop: 10 }}>{s.label}</div>
            </Panel>
          );
        })}
      </div>
    </Stage>
  );
}

// 7 — the ask.
export function CTA({ c }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 200 } });
  const btn = spring({ frame: frame - 14, fps, config: { damping: 200 } });
  return (
    <Stage glow={0.9}>
      <div style={{ textAlign: "center", alignItems: "center", display: "flex",
        flexDirection: "column", opacity: s }}>
        <div style={{ width: 96, height: 96, borderRadius: 28, background: T.blue,
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 34,
          transform: `scale(${interpolate(s, [0, 1], [0.7, 1])})` }}>
          <Icon name="robot" size={52} color={T.ink} />
        </div>
        <Title size={64}>{c.ctaTitle}</Title>
        <p style={{ fontSize: 26, color: T.muted, marginTop: 20 }}>{c.ctaSub}</p>
        <div style={{ marginTop: 40, opacity: btn,
          transform: `translateY(${interpolate(btn, [0, 1], [18, 0])}px)` }}>
          <div style={{ background: T.blue, color: T.ink, fontSize: 28, fontWeight: 700,
            padding: "22px 54px", borderRadius: 16,
            boxShadow: `0 20px 50px ${T.blue}44` }}>
            {c.ctaButton}
          </div>
        </div>
      </div>
    </Stage>
  );
}
