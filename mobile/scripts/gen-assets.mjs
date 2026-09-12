// Builds the source icon + splash images for @capacitor/assets, straight from
// the brand mark — the "Friendly Bot": a chat-bubble-shaped robot face, white on
// crimson, no white border (owner's pick, 2026-09-12). Runs in CI (sharp
// rasterises the SVGs to PNG); @capacitor/assets then turns these into every
// Android density, including the adaptive icon (crimson background + white-bot
// foreground), so the launcher fills the whole icon with crimson.
//
// Run from the mobile/ folder (cwd = mobile), which is where assets/ belongs.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("assets", { recursive: true });

const CRIMSON = "#D92632";

// The Friendly Bot in a 512 box (same mark as the web app). The body is white
// and the eyes + smile are KNOCKED OUT via a mask, so whatever is behind shows
// through them — on the crimson tile that makes crimson eyes and a crimson
// smile, and the same art works as a white-only silhouette for the status bar.
const BOT_BODY = `
  <rect x="240" y="70" width="32" height="46" rx="16" fill="#fff"/>
  <circle cx="256" cy="66" r="22" fill="#fff"/>
  <path fill="#fff" d="M176 118h160a76 76 0 0 1 76 76v112a76 76 0 0 1-76 76H222l-58 58c-9 9-24 3-24-10v-50a76 76 0 0 1-40-66V194a76 76 0 0 1 76-76z"/>`;
const BOT_FEATURES = `
  <rect x="186" y="190" width="42" height="66" rx="21" fill="#000"/>
  <rect x="284" y="190" width="42" height="66" rx="21" fill="#000"/>
  <path d="M204 300q52 46 104 0" stroke="#000" stroke-width="20" stroke-linecap="round" fill="none"/>`;
// A white bot with transparent eyes/mouth, on a transparent field. `viewBox`
// controls the padding: on the adaptive foreground the art must sit inside the
// launcher's safe zone (~66% of the canvas), so the 512 art is centred in a
// wider box.
const botWhite = (viewBox, size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}">
  <defs><mask id="m"><rect x="0" y="0" width="512" height="512" fill="#000"/>${BOT_BODY}${BOT_FEATURES}</mask></defs>
  <rect x="0" y="0" width="512" height="512" fill="#fff" mask="url(#m)"/></svg>`;

// Adaptive foreground: white bot (with cut-out face) centred in the safe zone.
const foreground = botWhite("-96 -110 704 704", 1024);
// Adaptive background: solid crimson, edge to edge — removes the white border.
const background = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 24 24"><rect width="24" height="24" fill="${CRIMSON}"/></svg>`;
// Splash: the bot on the same crimson field.
const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="-680 -680 1872 1872"><rect x="-680" y="-680" width="1872" height="1872" fill="${CRIMSON}"/>
  <defs><mask id="s"><rect x="0" y="0" width="512" height="512" fill="#000"/>${BOT_BODY}${BOT_FEATURES}</mask></defs>
  <rect x="0" y="0" width="512" height="512" fill="#fff" mask="url(#s)"/></svg>`;
// Notification small icon: the bot as a WHITE-on-TRANSPARENT silhouette (the
// status bar keeps only the alpha channel), the face cut out so it still reads.
const notif = botWhite("-40 -50 592 592", 96);

const write = (name, source) => sharp(Buffer.from(source)).png().toFile(`assets/${name}`);

await Promise.all([
  write("icon-foreground.png", foreground),
  write("icon-background.png", background),
  write("splash.png", splash),
  write("splash-dark.png", splash),
  write("notif-icon.png", notif),
]);

console.log("Friendly Bot icon + splash source images written to mobile/assets/");
