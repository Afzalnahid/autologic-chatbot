import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig, interpolate, useCurrentFrame } from "remotion";
import { COPY } from "./copy.js";
import { Hook, Connect, Teach, Chat, Acts, Dash, CTA } from "./scenes/Scenes.jsx";
import { T } from "./theme.js";

// Scene lengths in seconds. The chat runs longest because it is the one part a
// visitor will actually read, and reading in Bangla takes longer than glancing
// at a headline.
const PLAN = [
  { C: Hook, secs: 5 },
  { C: Connect, secs: 7 },
  { C: Teach, secs: 7 },
  { C: Chat, secs: 11 },
  { C: Acts, secs: 7 },
  { C: Dash, secs: 5 },
  { C: CTA, secs: 5 },
];

export const TOTAL_SECONDS = PLAN.reduce((n, p) => n + p.secs, 0);

// A short cross-fade between scenes; a hard cut every few seconds feels like a
// slideshow rather than a film.
function Fade({ children, durationInFrames }) {
  const frame = useCurrentFrame();
  const o = interpolate(
    frame,
    [0, 8, durationInFrames - 8, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
}

export function Film({ lang = "en" }) {
  const { fps } = useVideoConfig();
  const c = COPY[lang] || COPY.en;
  let at = 0;
  return (
    <AbsoluteFill style={{ background: T.bg }}>
      <Audio src={staticFile("music.mp3")} volume={0.35} />
      {PLAN.map(({ C, secs }, i) => {
        const from = at;
        const dur = Math.round(secs * fps);
        at += dur;
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <Fade durationInFrames={dur}>
              <C c={c} />
            </Fade>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
