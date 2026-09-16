// Builds the source icon + splash images for @capacitor/assets, straight from
// the TellMore AI logo mark — the plum robot-bubble (owner's final logo,
// 2026-09-17) on white. Runs in CI (sharp rasterises the SVGs to PNG);
// @capacitor/assets then turns these into every Android density, including the
// adaptive icon (white background + plum-logo foreground).
//
// The drawing is copied from src/lib/brand-mark.js (this runs from mobile/, with
// its own package.json, outside the Next build) — keep the two in sync. It is
// drawn in a 1024 canvas with its centre at (512, 504); the viewBoxes below
// crop and pad it.
//
// Run from the mobile/ folder (cwd = mobile), which is where assets/ belongs.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("assets", { recursive: true });

const BG = "#FFFFFF";
const PLUM = "#722B4D";
const INK = "#1E1A1D";

const mark = (color, ink) =>
  `<path fill="${color}" d="M330 522V517A115 115 0 0 1 445 402H580A115 115 0 0 1 695 517V522H632.6A74 74 0 0 0 559 456H466A74 74 0 0 0 392.4 522Z"/>` +
  `<path fill="${color}" d="M330 538V545A115 115 0 0 0 375 636V674L446 660H580A115 115 0 0 0 695 545V538H632.6A74 74 0 0 1 559 604H466A74 74 0 0 1 392.4 538Z"/>` +
  `<path fill="${color}" d="M322 458A47 67 0 0 0 322 592Z"/>` +
  `<path fill="${color}" d="M703 458A47 67 0 0 1 703 592Z"/>` +
  `<rect x="510" y="362" width="4" height="42" fill="${ink}"/>` +
  `<circle cx="512" cy="350" r="14" fill="${ink}"/>` +
  `<path d="M424 514Q447 481 470 514M554 514Q577 481 600 514" stroke="${ink}" stroke-width="13" stroke-linecap="round" fill="none"/>`;

// Adaptive foreground: the logo in its own colours, centred in the launcher's
// safe zone (~66% of the canvas), hence the wide box.
const foreground = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="12 4 1000 1000">${mark(PLUM, INK)}</svg>`;
// Adaptive background: solid white, edge to edge.
const background = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 24 24"><rect width="24" height="24" fill="${BG}"/></svg>`;
// Splash: the logo, small, in the middle of a white field.
const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="-1110 -1118 3244 3244"><rect x="-1110" y="-1118" width="3244" height="3244" fill="${BG}"/>${mark(PLUM, INK)}</svg>`;
// Notification small icon: a WHITE silhouette on transparent (the status bar
// keeps only the alpha channel). The face is a real hole, so it still reads.
const notif = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="257 249 510 510">${mark("#fff", "#fff")}</svg>`;

const write = (name, source) => sharp(Buffer.from(source)).png().toFile(`assets/${name}`);

await Promise.all([
  write("icon-foreground.png", foreground),
  write("icon-background.png", background),
  write("splash.png", splash),
  write("splash-dark.png", splash),
  write("notif-icon.png", notif),
]);

console.log("TellMore AI icon + splash source images written to mobile/assets/");
