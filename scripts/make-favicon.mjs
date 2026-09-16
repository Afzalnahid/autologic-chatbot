// Builds src/app/favicon.ico from the same brand mark that src/app/icon.svg
// draws — the TellMore AI logo mark (plum robot-bubble, owner's final logo
// 2026-09-17).
//
// Why this exists: modern browsers take the SVG favicon (icon.svg), but Google,
// Bing and every link-preview scraper still ask for /favicon.ico at the site
// root first. Without that file they fall back to a generic globe.
//
// The bot mark has curves (the rounded bubble, the antenna, the smile), which
// cannot be hand-plotted the way the old flat bolt was — so this renders
// icon.svg with sharp (rasteriser) and packs the PNGs into a multi-size .ico.
// sharp is only needed to REGENERATE the committed favicon.ico; it is not a
// runtime dependency of the app. If it is not installed, add it once with
//   npm i -D sharp
//
// Run it with:  node scripts/make-favicon.mjs
//
// IMPORTANT: the mark lives in src/app/icon.svg. Change it there, then re-run
// this so the .ico matches.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(ROOT, "src", "app", "icon.svg");
const OUT = join(ROOT, "src", "app", "favicon.ico");
const SIZES = [16, 32, 48];

let sharp;
try { sharp = (await import("sharp")).default; }
catch { console.error("This script needs sharp to rasterise the SVG. Install it once with: npm i -D sharp"); process.exit(1); }

const pngs = [];
for (const s of SIZES) pngs.push(await sharp(SRC, { density: 400 }).resize(s, s).png().toBuffer());

// An .ico is a small header + one directory entry per image + the PNG blobs.
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);            // reserved
header.writeUInt16LE(1, 2);            // type: icon
header.writeUInt16LE(pngs.length, 4);  // image count
const dir = Buffer.alloc(16 * pngs.length);
let offset = 6 + 16 * pngs.length;
pngs.forEach((png, i) => {
  const b = i * 16, s = SIZES[i];
  dir.writeUInt8(s >= 256 ? 0 : s, b + 0);   // width  (0 means 256)
  dir.writeUInt8(s >= 256 ? 0 : s, b + 1);   // height
  dir.writeUInt8(0, b + 2);                  // palette
  dir.writeUInt8(0, b + 3);                  // reserved
  dir.writeUInt16LE(1, b + 4);               // colour planes
  dir.writeUInt16LE(32, b + 6);              // bits per pixel
  dir.writeUInt32LE(png.length, b + 8);      // size of this image
  dir.writeUInt32LE(offset, b + 12);         // offset of this image
  offset += png.length;
});
writeFileSync(OUT, Buffer.concat([header, dir, ...pngs]));
console.log("wrote src/app/favicon.ico —", offset, "bytes,", SIZES.join("/"), "px");
