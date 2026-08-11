# The product film

A 47-second video of the whole product cycle, in English and Bangla, 1920×1080.
It is a separate little project so its dependencies never touch the main app's
build — Vercel ignores this folder entirely.

## Rendering it

```bash
cd video
npm install
npm run render
```

Two files appear in `video/out/`. Rename and move them:

```bash
cp out/autologic-en.mp4 ../public/film-en.mp4
cp out/autologic-bn.mp4 ../public/film-bn.mp4
```

Commit those two files and the landing page picks them up on its own — the film
section is already built and waiting for exactly those filenames. Nothing else
needs changing.

To preview and edit without rendering, `npm start` opens Remotion Studio.

## Before you publish the Bangla one

The film asks for **Noto Sans Bengali** and falls back to whatever the machine
has. On a machine without a Bengali font the Bangla version renders boxes instead
of letters. Check `AutologicBN` in the studio, or watch the finished file, before
putting it live.

## Changing it

- **Words** — `src/copy.js`, both languages side by side
- **Scene lengths** — the `PLAN` array in `src/Video.jsx`, in seconds
- **Colours** — `src/theme.js`, which mirrors the app's tokens exactly

If the app's palette ever changes, change it here too, or the film will slowly
start to look like a different company's.

## The scenes

| # | Scene | Length |
|---|-------|--------|
| 1 | One promise: one chatbot, every channel | 5s |
| 2 | Four channels connecting | 7s |
| 3 | Documents uploading and being indexed | 7s |
| 4 | A real conversation on a phone | 11s |
| 5 | Booking, Meet link, order, tag | 7s |
| 6 | The dashboard | 5s |
| 7 | Start free | 5s |

The conversation is longest on purpose: it is the part a visitor actually reads,
and Bangla takes longer to read than an English headline.
