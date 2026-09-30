// Renders the promo pictures (no sound — mix.mjs adds it), bundling once.
//   node render.mjs                → all four: S-V S-Q L-V L-Q
//   node render.mjs S-V L-Q        → just these
// Output: out/promo-<cut>-<frame>-picture.mp4
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { cleanUpBundles } from "../bundle-cleanup.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const VIDEO = path.resolve(here, "../../video");
const require = createRequire(path.join(VIDEO, "package.json"));
const { bundle } = require("@remotion/bundler");
const { selectComposition, renderMedia } = require("@remotion/renderer");

const want = process.argv.slice(2);
const jobs = want.length ? want : ["S-V", "S-Q", "L-V", "L-Q"];
const serveUrl = await bundle({ entryPoint: path.join(VIDEO, "src/promo/index.jsx"), publicDir: path.join(VIDEO, "public") });
cleanUpBundles(serveUrl);   // ../bundle-cleanup.mjs: do not fill drive C: with copies
for (const job of jobs) {
  const composition = await selectComposition({ serveUrl, id: `Promo${job}` });
  const outputLocation = path.join(here, "out", `promo-${job}-picture.mp4`);
  // this machine's compositor sometimes dies with 0xC0000005 for no reason; retry
  for (let attempt = 1; ; attempt++) {
    try {
      let last = -1;
      await renderMedia({ serveUrl, composition, codec: "h264", crf: 18, muted: true, outputLocation, concurrency: 4,
        onProgress: ({ progress }) => { const p = Math.floor(progress * 10); if (p !== last) { last = p; console.log(job, `${p * 10}%`); } } });
      console.log("wrote", outputLocation);
      break;
    } catch (e) {
      console.error(job, "attempt", attempt, "failed:", e.message.split("\n")[0]);
      if (attempt >= 4) throw e;
    }
  }
}
