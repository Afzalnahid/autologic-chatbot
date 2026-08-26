// Builds src/app/favicon.ico from the same brand mark that src/app/icon.svg draws.
//
// Why this exists: modern browsers take the SVG favicon, but Google, Bing and
// every link-preview scraper still ask for /favicon.ico at the site root first.
// Without that file they fall back to a generic globe.
//
// Why it is hand-written: this project has no image library (no sharp, no
// canvas), and adding one for a 1 KB file is not worth the dependency. Node's
// own zlib is all a PNG needs, and an .ico is just PNGs in a small wrapper.
//
// Run it with:  node scripts/make-favicon.mjs
//
// IMPORTANT: the geometry below is a copy of icon.svg's. If the brand mark ever
// changes, change icon.svg, mirror it here, and re-run this script.

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(dirname(fileURLToPath(import.meta.url))), "src", "app", "favicon.ico");

// ---- the brand mark, in icon.svg's 64x64 coordinate space -------------------

const BOX = 64;
const RADIUS = 15;                      // rect rx
const FROM = [0xd9, 0x26, 0x32];        // #D92632
const TO = [0xb0, 0x18, 0x24];          // #B01824

// icon.svg's bolt path "M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11z" with the file's
// transform="translate(5.5,5.4) scale(2.2)" already applied to each point.
const BOLT = [
  [34.1, 12.0],
  [34.1, 27.4],
  [47.3, 27.4],
  [29.7, 51.6],
  [29.7, 36.2],
  [16.5, 36.2],
];

// ---- geometry --------------------------------------------------------------

// Distance test for a rounded rectangle: inside the straight parts always, and
// inside a corner only when within RADIUS of that corner's centre.
function inRoundedRect(x, y) {
  const r = RADIUS;
  if (x < 0 || y < 0 || x > BOX || y > BOX) return false;
  const cx = x < r ? r : x > BOX - r ? BOX - r : x;
  const cy = y < r ? r : y > BOX - r ? BOX - r : y;
  if (cx === x || cy === y) return true;          // not in a corner square
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;  // in a corner: inside the arc
}

// Even-odd ray cast. The bolt is a simple polygon, so this is exact.
function inPolygon(x, y, pts) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

// The gradient runs corner to corner (x1,y1 = 0,0 -> x2,y2 = 1,1 in icon.svg),
// so a point's position along it is just how far it is across both axes.
function gradientAt(x, y) {
  const t = Math.min(1, Math.max(0, (x / BOX + y / BOX) / 2));
  return [
    Math.round(FROM[0] + (TO[0] - FROM[0]) * t),
    Math.round(FROM[1] + (TO[1] - FROM[1]) * t),
    Math.round(FROM[2] + (TO[2] - FROM[2]) * t),
  ];
}

// Renders one size. Every pixel is sampled SS x SS times and averaged — that is
// what gives the rounded corners and the bolt's diagonals smooth edges instead
// of staircases, which matters most at 16px.
const SS = 4;
function render(size) {
  const px = Buffer.alloc(size * size * 4);
  const step = BOX / size / SS;
  const origin = step / 2;

  for (let py = 0; py < size; py++) {
    for (let pxi = 0; pxi < size; pxi++) {
      let rSum = 0, gSum = 0, bSum = 0, aSum = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (pxi * SS + sx) * step + origin;
          const y = (py * SS + sy) * step + origin;
          if (!inRoundedRect(x, y)) continue;      // transparent outside the tile

          let rgb;
          if (inPolygon(x, y, BOLT)) rgb = [255, 255, 255];
          else rgb = gradientAt(x, y);

          rSum += rgb[0]; gSum += rgb[1]; bSum += rgb[2]; aSum += 1;
        }
      }

      const i = (py * size + pxi) * 4;
      if (aSum === 0) continue;                    // fully outside: leave as 0,0,0,0
      // Average only over the samples that landed inside, then let coverage set
      // alpha. Averaging colour over empty samples would darken the edges.
      px[i] = Math.round(rSum / aSum);
      px[i + 1] = Math.round(gSum / aSum);
      px[i + 2] = Math.round(bSum / aSum);
      px[i + 3] = Math.round((aSum / (SS * SS)) * 255);
    }
  }
  return px;
}

// ---- PNG encoding ----------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function toPng(px, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // 8 bits per channel
  ihdr[9] = 6;   // truecolour with alpha
  // 10, 11, 12 stay 0: deflate, adaptive filtering, no interlace

  // Each scanline is prefixed with its filter type. 0 (none) keeps this simple
  // and the images are tiny, so the extra bytes cost nothing.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- ICO container ---------------------------------------------------------

// An .ico is a 6-byte header, one 16-byte directory entry per size, then the
// image data. Storing PNG rather than BMP inside is allowed and is what every
// current browser and crawler reads.
function toIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);               // reserved
  header.writeUInt16LE(1, 2);               // 1 = icon
  header.writeUInt16LE(images.length, 4);

  const dir = Buffer.alloc(16 * images.length);
  let offset = 6 + 16 * images.length;

  images.forEach(({ size, png }, i) => {
    const at = i * 16;
    dir[at] = size >= 256 ? 0 : size;       // 0 means 256
    dir[at + 1] = size >= 256 ? 0 : size;
    dir[at + 2] = 0;                        // palette colours (0 = truecolour)
    dir[at + 3] = 0;                        // reserved
    dir.writeUInt16LE(1, at + 4);           // colour planes
    dir.writeUInt16LE(32, at + 6);          // bits per pixel
    dir.writeUInt32LE(png.length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });

  return Buffer.concat([header, dir, ...images.map((i) => i.png)]);
}

// ---- build -----------------------------------------------------------------

// 16 and 32 are what browser tabs and bookmark bars use; 48 is the size Google
// names in its favicon guidance, and 64 clears the "larger than 48" it
// recommends on top of that.
//
// Largest first on purpose: Next reads the FIRST directory entry to write the
// sizes="" attribute on the <link>, so a small entry here would advertise the
// whole file as 16x16 to Google. Browsers read the whole directory and pick the
// size they need regardless of order.
const SIZES = [64, 48, 32, 16];
const images = SIZES.map((size) => ({ size, png: toPng(render(size), size) }));
const ico = toIco(images);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, ico);

console.log(`wrote ${OUT}`);
console.log(`  ${ico.length} bytes, ${SIZES.length} sizes: ${SIZES.join(", ")}`);
