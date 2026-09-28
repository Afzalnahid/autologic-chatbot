// Entry point for the promo ad alone (kept apart from the homepage film and the teasers).
// The short (S) and long (L) cut, each as a 9:16 Reel (V) and a 1:1 post (Q):
//   PromoS-V                → the owner's cloned voice (timeline.json, vo/)
//   PromoS-V-puck, -fenrir, -sadachbia → one Gemini stock voice each (timeline-<voice>.json, vo-<voice>/)
//   PromoS-V-trio           → the three voices as three friends (make_trio.mjs)
//   node ../marketing/promo/render.mjs S-V-puck    then    node ../marketing/promo/mix.mjs S V puck
import React from "react";
import { Composition, registerRoot } from "remotion";
import TL from "../../../marketing/promo/timeline.json";
import PUCK from "../../../marketing/promo/timeline-puck.json";
import FENRIR from "../../../marketing/promo/timeline-fenrir.json";
import SADACHBIA from "../../../marketing/promo/timeline-sadachbia.json";
import TRIO from "../../../marketing/promo/timeline-trio.json";
import { makePromo, PFPS } from "./Promo.jsx";

const VOICES = { "": TL, "-puck": PUCK, "-fenrir": FENRIR, "-sadachbia": SADACHBIA, "-trio": TRIO };
const FRAMES = { V: [1080, 1920], Q: [1080, 1080] };
const PROMOS = Object.fromEntries(Object.entries(VOICES).flatMap(([v, tl]) => ["S", "L"].map((cut) => [cut + v, makePromo(cut, tl)])));

function Root() {
  return (
    <>
      {Object.entries(VOICES).flatMap(([v, tl]) => ["S", "L"].flatMap((cut) => Object.entries(FRAMES).map(([f, [width, height]]) => (
        <Composition key={cut + f + v} id={`Promo${cut}-${f}${v}`} component={PROMOS[cut + v]} fps={PFPS}
          durationInFrames={Math.round(tl.cuts[cut].seconds * PFPS)} width={width} height={height} />
      ))))}
    </>
  );
}

registerRoot(Root);
