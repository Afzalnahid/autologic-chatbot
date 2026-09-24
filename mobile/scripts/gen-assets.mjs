// Builds the source icon + splash images for @capacitor/assets, straight from
// the TellMore AI logo mark (the robot-bubble, owner's final logo, 2026-09-17).
// Runs in CI (sharp rasterises the SVGs to PNG); @capacitor/assets then turns
// these into every Android density, including the adaptive icon.
//
// 2026-09-21 — owner: "the app icon is too small, it can't define the app".
// It was the plum outline on WHITE at the launcher's strict safe-zone size: a
// thin drawing in a white circle, which reads as small and empty next to other
// apps. A launcher icon is a solid field of the brand colour with the mark in
// white, as large as the launcher's mask allows:
//   · background: the brand maroon, edge to edge (a soft diagonal, as in the app);
//   · foreground: the mark in WHITE, 15% larger. The launcher shows the centre
//     72 of the icon's 108 units (a circle of radius ~333 in this 1000 box);
//     the mark is roughly an ellipse of half-axes 237 × 169, so at 1.15× it is
//     273 × 194 — inside the mask on every launcher shape, with air around it.
// The same tile (maroon, white mark) is the splash, so icon → splash → the
// app's own launch screen is one picture.
//
// The drawing is copied from src/lib/brand-mark.js (this runs from mobile/, with
// its own package.json, outside the Next build) — keep the two in sync. It is
// drawn in a 1024 canvas with its centre at (512, 504); the viewBoxes below
// crop and pad it.
//
// Run from the mobile/ folder (cwd = mobile), which is where assets/ belongs.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const MAROON = "#7B1C3E", MAROON_DEEP = "#5C1430";
const LIGHT = "#FCFCFD", DARK = "#0B0B0E";

// The ADMIN app is built from this same drawing in a deeper shade, so the two
// icons are told apart on the home screen while still reading as one product
// (owner, 2026-09-24: two separate apps). Its workflow sets these; unset means
// the user app's own colours, so nothing about that build changes.
//   TM_FIELD_FROM / TM_FIELD_TO — the two ends of the icon's diagonal field
//   TM_OUT                      — where to write, default ./assets
// Parameterising beats a second copy of the logo: two copies drift apart, and
// the last time the icon changed it was because the owner said the old one
// "can't define the app".
const FIELD_FROM = process.env.TM_FIELD_FROM || "#8A2348";
const FIELD_TO = process.env.TM_FIELD_TO || MAROON_DEEP;
const OUT = process.env.TM_OUT || "assets";

mkdirSync(OUT, { recursive: true });

const mark = (color, ink) =>
  `<path fill="${color}" d="M330 522V517A115 115 0 0 1 445 402H580A115 115 0 0 1 695 517V522H632.6A74 74 0 0 0 559 456H466A74 74 0 0 0 392.4 522Z"/>` +
  `<path fill="${color}" d="M330 538V545A115 115 0 0 0 375 636V674L446 660H580A115 115 0 0 0 695 545V538H632.6A74 74 0 0 1 559 604H466A74 74 0 0 1 392.4 538Z"/>` +
  `<path fill="${color}" d="M322 458A47 67 0 0 0 322 592Z"/>` +
  `<path fill="${color}" d="M703 458A47 67 0 0 1 703 592Z"/>` +
  `<rect x="510" y="362" width="4" height="42" fill="${ink}"/>` +
  `<circle cx="512" cy="350" r="14" fill="${ink}"/>` +
  `<path d="M424 514Q447 481 470 514M554 514Q577 481 600 514" stroke="${ink}" stroke-width="13" stroke-linecap="round" fill="none"/>`;

const field = (id) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${FIELD_FROM}"/><stop offset="1" stop-color="${FIELD_TO}"/></linearGradient></defs>`;

// Adaptive foreground: the white mark, 1.15× (an 870-unit window on the drawing,
// centred on the mark's own centre, 512 × 504).
const foreground = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="77 69 870 870">${mark("#fff", "#fff")}</svg>`;
// Adaptive background: the maroon field, edge to edge.
const background = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${field("g")}<rect width="1024" height="1024" fill="url(#g)"/></svg>`;
// Splash: the same maroon tile with the white mark, centred on the app's own
// background — light, and near-black for a phone in dark mode.
const splash = (bg) => `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">${field("s")}
  <rect width="2732" height="2732" fill="${bg}"/>
  <rect x="1086" y="1086" width="560" height="560" rx="150" fill="url(#s)"/>
  <svg x="1086" y="1086" width="560" height="560" viewBox="212 204 600 600">${mark("#fff", "#fff")}</svg>
</svg>`;
// Notification small icon: a WHITE silhouette on transparent (the status bar
// keeps only the alpha channel). The face is a real hole, so it still reads.
const notif = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="257 249 510 510">${mark("#fff", "#fff")}</svg>`;

const write = (name, source) => sharp(Buffer.from(source)).png().toFile(`${OUT}/${name}`);

await Promise.all([
  write("icon-foreground.png", foreground),
  write("icon-background.png", background),
  write("splash.png", splash(LIGHT)),
  write("splash-dark.png", splash(DARK)),
  write("notif-icon.png", notif),
]);

console.log(`TellMore AI icon + splash source images written to ${OUT}/ (white mark on ${FIELD_FROM} → ${FIELD_TO})`);
