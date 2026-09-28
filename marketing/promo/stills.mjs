// Proof frames: one still from the middle of every scene, for checking the
// design without a full render. Bundles once, then renders each frame.
//   node stills.mjs S V          → out/stills/S-V/NN.png  (+ sheet.png)
//   node stills.mjs L Q 11 12    → just these scenes
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const VIDEO = path.resolve(here, "../../video");
const require = createRequire(path.join(VIDEO, "package.json"));
const { bundle } = require("@remotion/bundler");
const { selectComposition, renderStill } = require("@remotion/renderer");

const [cut = "S", frame = "V", ...only] = process.argv.slice(2);
const TL = JSON.parse(fs.readFileSync(path.join(here, "timeline.json"), "utf8"));
const { order, at, seconds } = TL.cuts[cut];
const out = path.join(here, "out", "stills", `${cut}-${frame}`);
fs.mkdirSync(out, { recursive: true });

const serveUrl = await bundle({ entryPoint: path.join(VIDEO, "src/promo/index.jsx"), publicDir: path.join(VIDEO, "public") });
const composition = await selectComposition({ serveUrl, id: `Promo${cut}-${frame}` });
const ids = order.filter((id) => !only.length || only.includes(id));
for (const id of ids) {
  const i = order.indexOf(id);
  const end = i < order.length - 1 ? at[order[i + 1]] : seconds;
  // late in the scene, so everything that pops in has popped in
  const t = at[id] + (end - at[id]) * 0.82;
  for (let attempt = 1; ; attempt++) {
    try {
      await renderStill({ serveUrl, composition, frame: Math.round(t * 30), output: path.join(out, `${id}.png`), imageFormat: "png" });
      console.log(id, t.toFixed(2));
      break;
    } catch (e) { if (attempt >= 3) { console.error(id, e.message); break; } }
  }
}
// a contact sheet of whatever exists
const pngs = order.filter((id) => fs.existsSync(path.join(out, `${id}.png`)));
const cols = frame === "V" ? 7 : 6, w = frame === "V" ? 270 : 320, h = frame === "V" ? 480 : 320;
const args = ["-hide_banner", "-loglevel", "error", "-y"];
pngs.forEach((id) => args.push("-i", path.join(out, `${id}.png`)));
const f = pngs.map((_, i) => `[${i}]scale=${w}:${h}[v${i}]`).join(";") + ";" + pngs.map((_, i) => `[v${i}]`).join("") +
  `xstack=inputs=${pngs.length}:fill=black:layout=` + pngs.map((_, i) => `${(i % cols) * w}_${Math.floor(i / cols) * h}`).join("|") + "[o]";
for (let a = 0; a < 4; a++) { try { execFileSync("ffmpeg", [...args, "-filter_complex", f, "-map", "[o]", path.join(out, "sheet.png")]); break; } catch {} }
console.log("sheet", path.join(out, "sheet.png"));
