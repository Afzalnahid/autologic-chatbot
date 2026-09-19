// Renders the film frame by frame from the seekable timeline, then mixes the
// narration, the ambient bed and the effects, and muxes it all into one MP4.
//
//   node render.mjs en                      full English film
//   node render.mjs bn                      full Bangla film
//   node render.mjs en --stills 3,12,40     PNG stills at those seconds (QA)
//   node render.mjs en --from 60 --to 90    a slice, for checking one scene
//
// Frame by frame rather than a screen recording: every frame is exactly the
// frame at t, so the picture never stutters and the audio lines up to the
// frame no matter how slow the machine is.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { bed, sfxTrack, wav } from "./audio-gen.mjs";

const HERE = path.resolve(".");
const REPO = path.resolve(HERE, "..", "..");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const FPS = 30;
const args = process.argv.slice(2);
const lang = args[0] === "bn" ? "bn" : "en";
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const stills = opt("--stills");
const from = +(opt("--from") ?? 0), to = opt("--to") ? +opt("--to") : null;

// Static server rooted at the repo, so the page can import src/lib/brand-mark.js.
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".css": "text/css" };
const server = http.createServer((req, res) => {
  const p = path.join(REPO, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(REPO) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const PORT = server.address().port;

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--hide-scrollbars", "--force-device-scale-factor=1", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.error("PAGE ERROR", e.message));
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.error("console:", m.text().slice(0, 200)); });
await page.goto(`http://127.0.0.1:${PORT}/marketing/explainer-video/timeline.html?lang=${lang}`);
await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 180000 });
const err = await page.evaluate(() => window.__error);
if (err) { console.error("BUILD FAILED:", err); await browser.close(); server.close(); process.exit(1); }
const info = await page.evaluate(() => ({ total: window.__total, cues: window.__cues, vo: window.__vo, scenes: window.__scenes }));
console.log(`timeline ${lang}: ${info.total.toFixed(1)}s, ${info.scenes.length} scenes, ${info.cues.length} cues`);
fs.writeFileSync(`timeline-${lang}.json`, JSON.stringify(info, null, 1));
const cdp = await page.context().newCDPSession(page);

async function seek(t) { await page.evaluate((t) => window.__seek(t), t); }
async function shot(format = "jpeg", quality = 93) { const r = await cdp.send("Page.captureScreenshot", { format, quality, optimizeForSpeed: true }); return Buffer.from(r.data, "base64"); }

if (stills) {
  fs.mkdirSync("stills", { recursive: true });
  for (const s of stills.split(",")) {
    const t = +s; await seek(t);
    fs.writeFileSync(path.join("stills", `${lang}-${String(t).padStart(5, "0")}.png`), await shot("png"));
    console.log("still", t);
  }
  await browser.close(); server.close(); process.exit(0);
}

// ── Audio ──────────────────────────────────────────────────────────────────
const total = to ?? info.total;
const dur = total - from;
fs.mkdirSync("build", { recursive: true });
{
  const [L, R] = bed(info.total + 1); wav("build/bed.wav", L, R);
  const [sL, sR] = sfxTrack(info.cues, info.total + 1); wav("build/sfx.wav", sL, sR);
}
// narration: each clip delayed to its scene, mixed, then bed ducked under it
const nar = info.vo.map((v) => ({ file: path.join("audio", lang, v.id + ".mp3"), at: v.at }));
const inputs = ["-i", "build/bed.wav", "-i", "build/sfx.wav"];
nar.forEach((v) => inputs.push("-i", v.file));
const parts = [];
const narLabels = nar.map((v, i) => { parts.push(`[${i + 2}:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay=${Math.round(v.at * 1000)}|${Math.round(v.at * 1000)}[n${i}]`); return `[n${i}]`; });
parts.push(`${narLabels.join("")}amix=inputs=${nar.length}:normalize=0,volume=1.0[nar]`);
parts.push(`[nar]asplit=2[narA][narB]`);
parts.push(`[0:a][narB]sidechaincompress=threshold=0.02:ratio=8:attack=60:release=700:makeup=1[bedd]`);
parts.push(`[bedd]volume=0.55[bedv]`);
// Two passes rather than loudnorm's one-pass mode (which pumps): measure the
// narration alone, then apply one fixed gain so the voice sits at -16 LUFS,
// with a true-peak limiter as the only dynamic stage.
const narOnly = parts.slice(0, parts.length - 3).concat([`[nar]ebur128=peak=true[out]`]);
const meas = execFileSync("ffmpeg", ["-y", ...inputs, "-filter_complex", narOnly.join(";"), "-map", "[out]", "-f", "null", "-"], { stdio: ["ignore", "ignore", "pipe"] }).toString();
const lufs = parseFloat((meas.match(/I:\s+(-?[\d.]+) LUFS/) || [])[1]);
const gainDb = Number.isFinite(lufs) ? Math.max(-12, Math.min(20, -16 - lufs)) : 0;
console.log(`narration measured ${lufs} LUFS → gain ${gainDb.toFixed(1)} dB`);
parts.push(`[narA][bedv][1:a]amix=inputs=3:normalize=0,volume=${gainDb.toFixed(2)}dB,alimiter=limit=0.85:attack=5:release=60,atrim=start=${from}:end=${total},asetpts=PTS-STARTPTS[out]`);
const mixFile = `build/mix-${lang}.m4a`;
execFileSync("ffmpeg", ["-y", ...inputs, "-filter_complex", parts.join(";"), "-map", "[out]", "-c:a", "aac", "-b:a", "192k", mixFile], { stdio: ["ignore", "ignore", "inherit"] });
console.log("audio mixed →", mixFile);

// ── Video ──────────────────────────────────────────────────────────────────
const videoFile = `build/video-${lang}.mp4`;
const ff = spawn("ffmpeg", ["-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "pipe:0", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(FPS), "-movflags", "+faststart", videoFile], { stdio: ["pipe", "ignore", "inherit"] });
const frames = Math.round(dur * FPS);
const t0 = Date.now();
for (let f = 0; f < frames; f++) {
  await seek(from + f / FPS);
  const buf = await shot();
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if (f % 300 === 0) { const el = (Date.now() - t0) / 1000; console.log(`frame ${f}/${frames}  ${(f / frames * 100).toFixed(0)}%  ${el.toFixed(0)}s elapsed, ~${((el / Math.max(1, f)) * (frames - f)).toFixed(0)}s left`); }
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await browser.close(); server.close();

const out = (from || to) ? `tellmoreai-explainer-${lang}-slice.mp4` : `tellmoreai-explainer-${lang}.mp4`;
execFileSync("ffmpeg", ["-y", "-i", videoFile, "-i", mixFile, "-c:v", "copy", "-c:a", "copy", "-shortest", "-movflags", "+faststart", out], { stdio: ["ignore", "ignore", "inherit"] });
// poster: the brand frame
execFileSync("ffmpeg", ["-y", "-ss", String(Math.min(dur - 1, Math.max(0, (info.scenes[1]?.t0 ?? 12) + 6 - from))), "-i", out, "-frames:v", "1", "-update", "1", "-q:v", "2", out.replace(/\.mp4$/, "-poster.jpg")], { stdio: ["ignore", "ignore", "inherit"] });
console.log("WROTE", out, (fs.statSync(out).size / 1e6).toFixed(1) + " MB", "in", ((Date.now() - t0) / 60000).toFixed(1), "min");
