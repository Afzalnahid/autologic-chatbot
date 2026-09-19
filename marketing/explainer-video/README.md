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
  `--film <name>` renders a short ad from `films/<name>/` instead.
- `ads.js` — the scene builders the short ads use (see below).
- `films/<name>/script.json` — one short ad each.
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

## The short ads (40–60 s)

The same engine also makes short marketing cuts. Each one is a folder under
`films/<name>/` holding only a `script.json`; the words, the on-screen text
AND the timings live in that script, so a new ad is a new script, not code.
The scene builders for ads are in `ads.js` (`adHook`, `adAnswer`, `adChat`,
`adScreen`, `adPrice`, `adOutro`) and read the scene object: `chat` (bubbles
with `at` seconds), `callouts` (rectangles in the screenshot's 1280×820
space), `steps`, `tiles`, `chips`, `toast`, `cards`, `price`.

    node tts.mjs --film midnight            # voices → films/midnight/audio/, durations.json
    node render.mjs en --film midnight --stills 3,12,30
    node render.mjs en --film midnight      # → tellmoreai-midnight-en.mp4 (+ poster)
    node render.mjs bn --film midnight

Current ads: `midnight` (the 24/7 promise), `photo-to-order` (shops),
`book-meetings` (service businesses), `live-in-minutes` (setup + prices).
Every ad ends on the same outro: tellmoreai.com, the 3-day trial, the
Autolinium credit and contacts. Both languages, ~42–55 s each.

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
