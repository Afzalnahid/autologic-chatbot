import React from "react";
import { Composition } from "remotion";
import { Film, TOTAL_SECONDS } from "./Video.jsx";

const FPS = 30;

// 1920x1080 so it sits cleanly in a landing-page section and still looks sharp
// on a laptop; the same file scales down fine on a phone.
export function RemotionRoot() {
  return (
    <>
      <Composition
        id="AutologicEN"
        component={Film}
        durationInFrames={TOTAL_SECONDS * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ lang: "en" }}
      />
      <Composition
        id="AutologicBN"
        component={Film}
        durationInFrames={TOTAL_SECONDS * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ lang: "bn" }}
      />
    </>
  );
}
