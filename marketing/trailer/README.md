# TellMore AI teaser "২টা ১৭"

A 47-second vertical (9:16) suspense teaser for Reels, no people on screen.
Story: `script.md`. Voiceover lines and start times: `lines.json`.

| Piece | Made by |
|---|---|
| Picture | `video/src/trailer/Trailer.jsx` (Remotion) |
| Sound design | `node sfx.mjs` → `video/public/trailer/sfx.wav` (synthesised, no samples) |
| Scratch voice | `node scratch-vo.mjs` → `video/public/trailer/vo/*.mp3` (computer voice, for timing only) |
| Real voice | the owner's recordings in `recordings/`, then `node prepare-vo.mjs` |
| Fonts | Tiro Bangla, Hind Siliguri (OFL) in `video/public/trailer/fonts/` |

| Cloned voice | `recordings/me.wav` + `me.txt` → `.venv311/Scripts/python clone_vo.py` (IndicF5, CPU, ~8 min a line) → `polish_vo.py` (DeepFilterNet + voiceover EQ) |

Render the picture (from `video/`), then put the sound on it (from here):

    npx remotion render src/trailer/index.jsx Trailer ../marketing/trailer/out/tellmore-trailer-bn-picture.mp4 --muted
    node mix.mjs      → out/tellmore-trailer-bn-final.mp4 (−14 LUFS)

The sound is mixed outside Remotion because its bundled ffmpeg crashed on this
machine (0xC0000005) every time it probed the audio files.

## Recording the voice (for the owner)

- A quiet room with curtains or a bed nearby (soft things stop echo). Fan off.
- Phone 20–25 cm from the mouth, a little to the side so breath does not hit it.
- Speak low and slow, like a film trailer. Leave a real pause at every "…".
- One recording per line. Say each line three times in the same recording; the
  best take is kept.
- Send them named `01` to `08` (WhatsApp voice notes are fine).

| # | Line | How |
|---|---|---|
| 01 | শহর ঘুমিয়ে আছে। | calm, almost a whisper |
| 02 | কিন্তু আপনার গ্রাহক… জেগে আছে। | pause at "…", lean on "জেগে" |
| 03 | একটা মেসেজ। দশটা। পঞ্চাশটা। | each word faster and tighter |
| 04 | প্রতিটা না-দেওয়া উত্তর… একটা হারানো অর্ডার। | slow, heavy |
| 05 | তারপর… কেউ একজন উত্তর দিল। | whisper, a long pause after "তারপর" |
| 06 | বাংলায়। বাংলিশে। ভয়েস মেসেজে। ছবি দেখে। | brighter, a beat between each |
| 07 | আপনি ঘুমান। | warm, smiling |
| 08 | টেলমোর এআই জেগে থাকে। | confident, the last word falls |
