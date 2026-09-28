// Entry point for the teasers alone, kept apart from the homepage film's Root so
// they never share a render.
//   npx remotion render src/trailer/index.jsx Teaser ../marketing/trailer/out/tellmore-teaser-picture.mp4 --muted
//   (then node ../marketing/trailer/mix2.mjs puts the sound on)
import React from "react";
import { Composition, registerRoot } from "remotion";
import { Trailer, FPS, SECONDS } from "./Trailer.jsx";
import { Teaser, TFPS, TSECONDS } from "./Teaser.jsx";

function Root() {
  return (
    <>
      <Composition id="Trailer" component={Trailer} durationInFrames={SECONDS * FPS} fps={FPS} width={1080} height={1920} />
      <Composition id="Teaser" component={Teaser} durationInFrames={TSECONDS * TFPS} fps={TFPS} width={1080} height={1920} />
    </>
  );
}

registerRoot(Root);
