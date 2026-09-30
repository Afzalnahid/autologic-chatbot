// Remotion's bundle() copies the whole video/public folder (every tutorial's
// screenshots, ~0.4 GB) into a fresh remotion-webpack-bundle-* folder in the
// system temp dir, and nothing ever deletes it. On 2026-09-30, 55 of them
// (20 GB) filled drive C: and the next render died with ENOSPC. Call this
// right after bundle():
//   - this run's bundle is removed when the process exits, including through
//     process.exit();
//   - any bundle older than two hours is removed now: one left by a crashed
//     run. The random 0xC0000005 crash on this machine skips exit handlers.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PREFIX = "remotion-webpack-bundle-";
const STALE_MS = 2 * 60 * 60 * 1000;

export function cleanUpBundles(serveUrl) {
  const tmp = path.resolve(os.tmpdir());
  const mine = path.resolve(serveUrl);
  // only ever a bundle folder directly inside the temp dir
  const isBundle = (p) => path.dirname(p) === tmp && path.basename(p).startsWith(PREFIX);
  for (const name of fs.readdirSync(tmp)) {
    const p = path.join(tmp, name);
    if (!isBundle(p) || p === mine) continue;
    try { if (Date.now() - fs.statSync(p).mtimeMs > STALE_MS) fs.rmSync(p, { recursive: true, force: true }); } catch {}
  }
  if (isBundle(mine)) process.on("exit", () => { try { fs.rmSync(mine, { recursive: true, force: true }); } catch {} });
}
