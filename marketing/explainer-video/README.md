# Product explainer video — generator

Makes the two narrated explainer videos (English + Bangla, 1080p, ~5 min)
from a script, without any paid tool: Microsoft Edge neural voices for the
narration, Chrome (via Playwright) to record the animated scenes, ffmpeg to
mux and join. Nothing here touches the web app; it is a standalone folder.

Files
- `script.json` — the 16 scenes: title, subtitle and voiceover in both
  languages, plus the voice per language. Edit the words here.
- `scene.html` — the animated scenes (mock dashboard, phone, pricing…),
  one template per scene, driven by `?id=&lang=&dur=`.
- `tts.mjs` — voiceover MP3 per scene per language + `durations.json`.
- `render.mjs` — records each scene to the narration's length, muxes the
  audio, concatenates → `tellmoreai-explainer-<lang>.mp4`.

Run (in this folder, needs Node 20+, Chrome installed, internet for fonts
and voices):

    npm init -y
    npm i msedge-tts@2 ffmpeg-static@5 playwright-core@1
    mkdir -p "$LOCALAPPDATA/ms-playwright/ffmpeg-1011" && cp node_modules/ffmpeg-static/ffmpeg.exe "$LOCALAPPDATA/ms-playwright/ffmpeg-1011/ffmpeg-win64.exe"
    node tts.mjs          # voices, ~2 min
    node render.mjs       # both languages, ~20 min; `node render.mjs en 04-inbox` renders one scene

If the product name or domain changes: search-and-replace "TellMore AI" in
`script.json` and `scene.html` (the logo mark itself is name-free), regenerate.
Voices: `en-US-AndrewNeural` / `bn-BD-PradeepNeural` (female alternatives:
`en-US-AvaNeural` / `bn-BD-NabanitaNeural`).
