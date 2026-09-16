// Records each scene (scene.html driven by id/lang/dur) with Chrome via
// Playwright's video recorder, muxes the narration in with ffmpeg, then
// concatenates the scenes into one MP4 per language.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";

const ROOT = process.cwd();
const script = JSON.parse(fs.readFileSync("script.json", "utf8"));
const durations = JSON.parse(fs.readFileSync("durations.json", "utf8"));
const langs = process.argv[2] ? [process.argv[2]] : ["en", "bn"];
const only = process.argv[3] ? process.argv[3].split(",") : null;
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

// A tiny static server so scene.html can fetch script.json (file:// blocks fetch).
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": p.endsWith(".json") ? "application/json" : "text/html; charset=utf-8" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const PORT = server.address().port;

const ff = (args) => execFileSync(ffmpeg, args, { stdio: ["ignore", "pipe", "pipe"] });

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--disable-gpu", "--no-sandbox", "--force-device-scale-factor=1", "--hide-scrollbars"] });
for (const lang of langs) {
  fs.mkdirSync(path.join("clips", lang), { recursive: true });
  const parts = [];
  for (const sc of script.scenes) {
    const mp4 = path.join("clips", lang, sc.id + ".mp4");
    parts.push(mp4);
    if (only && !only.includes(sc.id)) continue;
    const dur = Math.ceil((durations[`${lang}/${sc.id}`] || 12) + 1.2);
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, recordVideo: { dir: path.join("raw", lang), size: { width: 1920, height: 1080 } } });
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/scene.html?id=${sc.id}&lang=${lang}&dur=${dur}`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
    await page.waitForTimeout(dur * 1000 + 300);
    const video = page.video();
    await ctx.close();
    const webm = await video.path();
    const audio = path.join("audio", lang, sc.id + ".mp3");
    // Video: constant 30 fps H.264; audio: narration, padded with silence to the clip length.
    ff(["-y", "-i", webm, "-i", audio, "-filter_complex", "[1:a]apad[a]", "-map", "0:v:0", "-map", "[a]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30", "-vf", "scale=1920:1080",
        "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-t", String(dur), "-movflags", "+faststart", mp4]);
    fs.unlinkSync(webm);
    console.log(lang, sc.id, dur + "s ✓");
  }
  if (only) continue;   // a test render of a few scenes: no final concat
  const listFile = path.join("clips", lang, "list.txt");
  fs.writeFileSync(listFile, parts.map((p) => `file '${path.resolve(p).replace(/\\/g, "/")}'`).join("\n"));
  const out = `tellmoreai-explainer-${lang}.mp4`;
  ff(["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", "-movflags", "+faststart", out]);
  console.log("WROTE", out, (fs.statSync(out).size / 1e6).toFixed(1) + " MB");
}
await browser.close();
server.close();
