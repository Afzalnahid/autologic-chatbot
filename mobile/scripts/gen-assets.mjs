// Builds the source icon + splash images for @capacitor/assets, straight from
// the brand mark (a white lightning bolt on crimson) — no white border. Runs in
// CI (sharp rasterises the SVGs to PNG); @capacitor/assets then turns these into
// every Android density, including the adaptive icon (crimson background +
// white-bolt foreground), so the launcher fills the whole icon with crimson.
//
// Run from the mobile/ folder (cwd = mobile), which is where assets/ belongs.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("assets", { recursive: true });

const CRIMSON = "#D92632";
// The getvoicium lightning bolt, in a 0..24 box (same mark as the web app).
const BOLT = "M13 2 4.5 13.5H11l-1 8.5L19.5 10H13z";

const svg = (size, viewBox, inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}">${inner}</svg>`;
const bolt = (fill) => `<path d="${BOLT}" fill="${fill}"/>`;

// Adaptive foreground: the white bolt kept inside the launcher's safe zone
// (~57% of the canvas, centred) on a transparent field.
const foreground = svg(1024, "-9 -9 42 42", bolt("#fff"));
// Adaptive background: solid crimson, edge to edge — this is what removes the
// white border; the launcher may round the corners but the fill stays crimson.
const background = svg(1024, "0 0 24 24", `<rect x="0" y="0" width="24" height="24" fill="${CRIMSON}"/>`);
// Splash: a smaller centred bolt on the same crimson field.
const splash = svg(2732, "-30 -30 84 84", `<rect x="-30" y="-30" width="84" height="84" fill="${CRIMSON}"/>${bolt("#fff")}`);
// Notification small icon: the bolt as a WHITE-on-TRANSPARENT silhouette.
// Android's status bar keeps only the alpha channel, so the bolt must be the
// only opaque shape — a full (crimson-square) icon would render as a white box.
// A little padding (viewBox wider than the art) keeps it off the edges.
const notif = svg(96, "-5 -5 34 34", bolt("#fff"));

const write = (name, source) => sharp(Buffer.from(source)).png().toFile(`assets/${name}`);

await Promise.all([
  write("icon-foreground.png", foreground),
  write("icon-background.png", background),
  write("splash.png", splash),
  write("splash-dark.png", splash),
  write("notif-icon.png", notif),
]);

console.log("brand icon + splash source images written to mobile/assets/");
