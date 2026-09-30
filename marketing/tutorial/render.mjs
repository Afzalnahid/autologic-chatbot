// Renders a tutorial's picture (no sound — mix.mjs adds it).
//   node render.mjs desktop bn           → out/<id>/tutorial-<id>-desktop-bn-picture.mp4
//   node render.mjs phone en --stills    → out/<id>/stills-phone-en/NN.png (one per line + end card)
// Needs capture.mjs (screens) and tts.mjs (voice lengths) to have run first.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadScript } from "./script.mjs";
import { tutorialTimeline, FPS } from "./timeline.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const VIDEO = path.resolve(here, "../../video");
const require = createRequire(path.join(VIDEO, "package.json"));
const { bundle } = require("@remotion/bundler");
const { selectComposition, renderMedia, renderStill } = require("@remotion/renderer");

const [device = "desktop", lang = "bn", ...flags] = process.argv.slice(2);
const script = loadScript();   // TUT=<id> picks the tutorial (script.mjs)
const pub = path.join(VIDEO, "public", "tutorial", script.id);
const inputProps = {
  script, lang, device, id: script.id,
  capture: JSON.parse(fs.readFileSync(path.join(pub, device, "capture.json"), "utf8")),
  durations: JSON.parse(fs.readFileSync(path.join(pub, `vo-${lang}`, "durations.json"), "utf8")),
  brand: JSON.parse(fs.readFileSync(path.resolve(here, "../promo/brand.json"), "utf8")),
};
const OUT = path.join(here, "out", script.id);
fs.mkdirSync(OUT, { recursive: true });

const serveUrl = await bundle({ entryPoint: path.join(VIDEO, "src/tutorial/index.jsx"), publicDir: path.join(VIDEO, "public") });
const composition = await selectComposition({ serveUrl, id: `Tutorial-${device}`, inputProps });
const retry = async (what, fn) => { for (let a = 1; ; a++) { try { return await fn(); } catch (e) { console.error(what, "attempt", a, "failed:", e.message.split("\n")[0]); if (a >= 4) throw e; } } };

if (flags.includes("--stills")) {
  const tl = tutorialTimeline(script, inputProps.capture, inputProps.durations);
  const dir = path.join(OUT, `stills-${device}-${lang}`);
  fs.mkdirSync(dir, { recursive: true });
  const at = [["00", 1.4], ...tl.segs.map((s) => [s.id, s.at + s.len * 0.8]), ["end", tl.total - 0.5]];
  for (const [name, sec] of at) await retry(name, () => renderStill({ serveUrl, composition, inputProps, frame: Math.round(sec * FPS), output: path.join(dir, `${name}.png`), imageFormat: "png" }));
  const files = at.map(([n]) => path.join(dir, `${n}.png`));
  const V = device === "phone", w = V ? 270 : 480, h = V ? 480 : 270, cols = V ? 7 : 4;
  const args = ["-v", "error", "-y"]; files.forEach((f) => args.push("-i", f));
  const fc = files.map((_, i) => `[${i}]scale=${w}:${h}[v${i}]`).join(";") + ";" + files.map((_, i) => `[v${i}]`).join("") +
    `xstack=inputs=${files.length}:fill=black:layout=` + files.map((_, i) => `${(i % cols) * w}_${Math.floor(i / cols) * h}`).join("|") + "[o]";
  execFileSync("ffmpeg", [...args, "-filter_complex", fc, "-map", "[o]", path.join(dir, "sheet.png")]);
  console.log("stills", dir);
  process.exit(0);        // the renderer's browser otherwise keeps node alive
} else {
  const outputLocation = path.join(OUT, `tutorial-${script.id}-${device}-${lang}-picture.mp4`);
  let last = -1, alive = Date.now();
  // this machine's renderer has hung for half an hour with no error (2026-09-30):
  // give up after 3 minutes without progress, and let build.mjs run it again
  const watchdog = setInterval(() => { if (Date.now() - alive > 180000) { console.error("render stalled for 3 minutes — giving up"); process.exit(3); } }, 10000);
  await retry("render", () => renderMedia({ serveUrl, composition, inputProps, codec: "h264", crf: 18, muted: true, outputLocation, concurrency: 4,
    onProgress: ({ progress }) => { alive = Date.now(); const p = Math.floor(progress * 10); if (p !== last) { last = p; console.log(device, lang, `${p * 10}%`); } } }));
  clearInterval(watchdog);
  console.log("wrote", outputLocation);
  process.exit(0);
}
