# Product explainer video — generator

Makes the narrated explainer films (English + Bangla, 1080p30, ~7 min) from
one script, with no paid tool: Microsoft Edge neural voices for the narration,
GSAP + three.js in Chrome for the motion graphics and 3D, real dashboard
screens from the screenshot studio, procedurally generated ambient bed and
sound effects, ffmpeg to encode and mux. Nothing here touches the web app; it
is a standalone folder with its own `node_modules`.

The brief it follows is `MASTER_PROMPT.md` — read that first.

## Files

- `MASTER_PROMPT.md` — the owner's brief, restated: rules, structure, the
  feature checklist every render must cover, brand, voice, deliverables.
- `script.json` — the 19 scenes: on-screen title/sub and the voiceover in both
  languages, the voices, the company contact block. **Edit the words here.**
- `tts.mjs` — one MP3 per scene per language (skips clips whose text has not
  changed) and `durations.json`, which the timeline is built from.
- `shots.mjs` — captures the real dashboard tabs from the running dev server's
  `/shots` studio into `shots/*.png` (light theme, 1280 wide at 2×).
- `timeline.html` + `engine.js` — the film as ONE seekable timeline. Every
  scene is a builder in `engine.js`; `window.__seek(t)` renders the frame at t.
  `three-bits.js` holds the 3D logo (the brand mark extruded) and the channel
  coins. `icons.json` is Tabler icon path data (fetched once).
- `audio-gen.mjs` — the ambient bed (D major pad + soft pluck, 84 BPM), the
  effects (whoosh, pop, ding, click, chime, swoosh) and the SFX track laid out
  from the cues the timeline exports.
- `render.mjs` — frame-by-frame capture through Chrome DevTools → H.264, then
  the audio mix (narration at −16 LUFS, bed ducked under it, limiter) → MP4.
- `debug.mjs` — seeks to a few times and prints what is visible; for QA.

## Run (in this folder; Node 20+, Chrome installed, internet for fonts + voices)

    npm i                      # msedge-tts@2 playwright-core@1 gsap three
    node shots.mjs             # needs `next dev` running on :3000 (the /shots studio)
    node tts.mjs               # voices, ~3 min (only re-makes changed clips)
    node render.mjs en --stills 3,20,75,180,392   # QA: PNG stills into stills/
    node render.mjs en         # the English film, ~25 min
    node render.mjs bn         # the Bangla film

Outputs: `tellmoreai-explainer-en.mp4`, `-bn.mp4`, and a `-poster.jpg` each.
`node render.mjs en --from 60 --to 90` renders a slice for checking one scene.

## How it stays exact

Frame by frame, not a screen recording: the renderer asks the page for the
frame at t, so nothing depends on how fast the machine is, and the narration
is mixed at the same scene start times the timeline exported. GSAP, three.js
and the particle canvas are all driven from that one t; nothing uses a clock.

## Gotchas

- The voices come from Edge's online service; a clip sometimes fails with
  "stream closed" — `tts.mjs` retries four times.
- Headless Chrome here has hardware WebGL (ANGLE/D3D11); if a machine has
  none, add `--use-angle=swiftshader --enable-unsafe-swiftshader` to the
  Chrome args in `render.mjs` (slower, same frames).
- `/shots` is 404 outside `next dev`, so the screens are captured locally.
- Music: the bed is generated, so it is licence-free. Drop a licensed track in
  as `build/bed.wav` (48 kHz stereo) before rendering to use it instead.
