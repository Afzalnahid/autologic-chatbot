// Entry point for the teaser alone, kept apart from the homepage film's Root so
// the two never share a render.
//   npx remotion render src/trailer/index.jsx Trailer out/tellmore-trailer-bn.mp4
import React from "react";
import { Composition, registerRoot } from "remotion";
import { Trailer, FPS, SECONDS } from "./Trailer.jsx";

function Root() {
  return <Composition id="Trailer" component={Trailer} durationInFrames={SECONDS * FPS} fps={FPS} width={1080} height={1920} />;
}

registerRoot(Root);
