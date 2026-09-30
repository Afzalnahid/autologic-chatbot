// Entry point for the tutorial videos alone. Two frames — Tutorial-desktop
// (16:9, a browser window) and Tutorial-phone (9:16, a phone) — and everything
// else (script, capture, voice lengths, language, Autolinium) arrives as input
// props from marketing/tutorial/render.mjs, which also sizes the film.
import React from "react";
import { Composition, registerRoot } from "remotion";
import { Tutorial, tutorialDuration, FPS } from "./Tutorial.jsx";

function Root() {
  return (
    <>
      <Composition id="Tutorial-desktop" component={Tutorial} fps={FPS} width={1920} height={1080} durationInFrames={300} defaultProps={{}} calculateMetadata={tutorialDuration} />
      <Composition id="Tutorial-phone" component={Tutorial} fps={FPS} width={1080} height={1920} durationInFrames={300} defaultProps={{}} calculateMetadata={tutorialDuration} />
    </>
  );
}

registerRoot(Root);
