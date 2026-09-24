# The product document

Two PDFs, English and Bangla, in `out/`. Rebuild them with:

    node docs/brochure/build.mjs

## What is where

| File | What it holds |
| --- | --- |
| `content.mjs` | The product description, how it works, and every screen with its short description and instructions — both languages |
| `commercial.mjs` | Packages and prices, the comparison, security, contact |
| `build.mjs` | The page design, and the call to headless Chrome that makes the PDFs |
| `../shots/*.png` | The screenshots, 2x and light-themed, captured from `/shots` |
| `out/` | The built HTML and the two PDFs |

## Re-taking the screenshots

They come from the screenshot studio, which only runs on a local dev server:

1. Start the dev server (`node node_modules/next/dist/bin/next dev`).
2. For each screen, load `http://localhost:3000/shots?tab=<name>&theme=light`
   in headless Chrome at 1280x900 with `--force-device-scale-factor=2` and
   `--virtual-time-budget=12000`, and save to `docs/shots/<name>.png`.

Light theme on purpose: dark screenshots print heavy and eat ink. 2x on purpose:
at one page per screenshot they are printed large, and 1x looks soft.

## The rules this document is written under

These are not style preferences. The owner asked for a professional document
with no false information in it, and that is a harder requirement than it looks.

1. **Nothing is invented.** Prices and limits come from `src/lib/plans.js`,
   features from `src/lib/features.js`, contact details from
   `src/lib/company.js`. `tests/t-brochure.mjs` compares the document against
   those files and fails if they disagree — so a price change in the app cannot
   leave a wrong price in the brochure.
2. **No customer results are claimed.** The screenshots carry demonstration data
   ("Nokshi Threads", "Pixel Studio") and both editions say so in the footer.
   There are no testimonials and no "x% more sales", because none have been
   measured. The test fails if either appears.
3. **Competitor facts are sourced and dated.** Chatfuel's and Tidio's prices
   were read from their own pricing pages on 25 September 2026 and are printed
   with the url and that date. ManyChat's page blocks automated reading, so
   ManyChat is not quoted at all rather than quoted from memory.
4. **The comparison compares; it does not boast.** "Best" is an opinion. The
   test fails if either edition calls the product the best, and requires each
   edition to state at least two places where Autolinium is the weaker company.

## When something changes

- A price changes → change `src/lib/plans.js`, then `commercial.mjs`, then
  rebuild. The test tells you if you forget the second step.
- A screen changes → retake that screenshot, rebuild.
- Time passes → the competitor prices go stale. Re-read their pages, update
  `COMPARISON.sources` with the new date, rebuild.
