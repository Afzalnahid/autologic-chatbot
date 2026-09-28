// Entry point for the promo ad alone (kept apart from the homepage film and the teasers).
// Four renders: the short (S) and long (L) cut, each as a 9:16 Reel and a 1:1 post.
//   remotion render src/promo/index.jsx PromoS-V ../marketing/promo/out/promo-S-V-picture.mp4 --muted
//   (then node ../marketing/promo/mix.mjs S V puts the sound on)
import React from "react";
import { Composition, registerRoot } from "remotion";
import TL from "../../../marketing/promo/timeline.json";
import { makePromo, PFPS } from "./Promo.jsx";

const PROMOS = { S: makePromo("S"), L: makePromo("L") };
const FRAMES = { V: [1080, 1920], Q: [1080, 1080] };

function Root() {
  return (
    <>
      {["S", "L"].flatMap((cut) => Object.entries(FRAMES).map(([f, [width, height]]) => (
        <Composition key={cut + f} id={`Promo${cut}-${f}`} component={PROMOS[cut]} fps={PFPS}
          durationInFrames={Math.round(TL.cuts[cut].seconds * PFPS)} width={width} height={height} />
      )))}
    </>
  );
}

registerRoot(Root);
