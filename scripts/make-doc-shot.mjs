// Takes a manual screenshot: one dashboard tab, light and dark, as WebP.
//
//   node scripts/make-doc-shot.mjs assistant
//   node scripts/make-doc-shot.mjs inventory --h=1400
//
// Writes public/docs/shots/<tab>.webp and <tab>.dark.webp, which is what
// src/app/docs/blocks.js looks for. Both languages of the manual share one
// image, so these are taken in English.
//
// The pictures were taken by hand until now, which is why a page could be
// written and its screenshot quietly never appear — blocks.js renders a
// labelled placeholder box when the file is missing, on the live site.
//
// It needs the dev server running (npm run dev) because the screenshot studio
// at /shots is 404 anywhere else. That is deliberate: the studio renders the
// REAL tab components against sample data, so a manual screenshot contains no
// customer's data and can be retaken in one pass whenever the design changes.
//
// Why Chrome and not a library: Chrome is already on this machine and already
// how scripts/make-og-images.mjs draws its cards, and it is the only thing here
// that can lay out the real page. WebP comes out of Chrome too — a canvas
// encodes it — so there is no image dependency to install for one file a month.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SHOTS = join(ROOT, "public", "docs", "shots");
const TMP = join(ROOT, ".shot-tmp");

const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((p) => existsSync(p));
if (!CHROME) throw new Error("No Chrome or Edge found — cannot take the screenshot.");

const args = process.argv.slice(2);
const tab = args.find((a) => !a.startsWith("--"));
if (!tab) throw new Error("Which tab? e.g. node scripts/make-doc-shot.mjs assistant");
const flag = (name, dflt) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : dflt;
};

// 1600 is what every existing manual screenshot is, and the docs page is built
// around that width. The height is the WINDOW, not the content: some tabs are
// as tall as their data, and some — the assistant among them — are a panel
// sized to the viewport, so there is no natural height to discover. Pass --h
// for a tab that needs more room.
const W = Number(flag("w", 1600));
const H = Number(flag("h", 1000));
const out = flag("out", tab);
const port = flag("port", "3000");
const quality = Number(flag("q", 0.9));
const base = `http://localhost:${port}/shots?tab=${encodeURIComponent(tab)}`;

// A screenshot of an empty page means the studio was not there — almost always
// the dev server is not running, and that is worth saying rather than shipping
// a blank picture.
try {
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--dump-dom", "--virtual-time-budget=4000", base], { stdio: "pipe", timeout: 60000 })
    .toString()
    .includes("Screenshot studio") || warn(`The page at ${base} does not look like the studio.`);
} catch {
  throw new Error(`Could not reach ${base}. Start the dev server first:  npm run dev`);
}
function warn(m) { console.warn("  ! " + m); }

// Headless Chrome on Windows sometimes dies on start with an access violation
// and no output — not caused by anything on the page, and gone on the next
// try. Three attempts, because a script the owner runs must not need somebody
// who can read a crash code.
function retry(fn, times = 3) {
  for (let i = 1; ; i++) {
    try { return fn(); }
    catch (e) {
      if (i >= times) throw e;
      console.warn(`  ! Chrome failed (attempt ${i}) — trying again`);
    }
  }
}

mkdirSync(TMP, { recursive: true });
mkdirSync(SHOTS, { recursive: true });

for (const theme of ["light", "dark"]) {
  const png = join(TMP, `${out}.${theme}.png`);
  retry(() => execFileSync(CHROME, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    `--window-size=${W},${H}`,
    // The page loads its fonts and its sample data over the network; without a
    // budget Chrome shoots before either arrives and the picture is a fallback
    // face on an empty tab.
    "--virtual-time-budget=8000",
    `--screenshot=${png}`,
    `${base}&theme=${theme}`,
  ], { stdio: "pipe", timeout: 90000 }));

  const file = theme === "dark" ? `${out}.dark.webp` : `${out}.webp`;
  writeFileSync(join(SHOTS, file), toWebp(png));
  console.log(`  wrote public/docs/shots/${file}`);
}

rmSync(TMP, { recursive: true, force: true });
console.log(`Done. Add  { shot: "${out}", cap: "…" }  to the page's blocks in en.js and bn.js.`);

// PNG in, WebP out, through a canvas in the same browser that took the shot.
//
// The PNG goes in as a data: URL rather than a file:// one on purpose: a canvas
// that has drawn a file:// image is tainted and toDataURL throws, and the flag
// that lifts that also lifts it for everything else.
function toWebp(pngPath) {
  const b64 = readFileSync(pngPath).toString("base64");
  const page = join(TMP, "convert.html");
  writeFileSync(page, `<!doctype html><meta charset="utf-8"><body><pre id="out"></pre><script>
const img = new Image();
img.onload = () => {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  c.getContext("2d").drawImage(img, 0, 0);
  document.getElementById("out").textContent = c.toDataURL("image/webp", ${quality});
};
img.onerror = () => { document.getElementById("out").textContent = "ERR"; };
img.src = "data:image/png;base64,${b64}";
</script></body>`);

  const dom = retry(() => execFileSync(CHROME, [
    "--headless=new", "--disable-gpu", "--dump-dom",
    "--virtual-time-budget=15000",
    pathToFileURL(page).href,
  ], { stdio: "pipe", maxBuffer: 256 * 1024 * 1024, timeout: 120000 })).toString();

  const m = dom.match(/data:image\/webp;base64,([A-Za-z0-9+/=]+)/);
  // Chrome falls back to PNG when it cannot encode WebP, and a .webp file that
  // is secretly a PNG breaks the size read in blocks.js — which then hands the
  // browser no dimensions and the page jumps as the picture lands.
  if (!m) throw new Error("Chrome did not produce a WebP. Is it too old to encode one?");
  return Buffer.from(m[1], "base64");
}
