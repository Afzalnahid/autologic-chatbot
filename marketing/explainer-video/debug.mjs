// Loads the timeline, seeks to a few times and prints what covers the frame.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
const REPO = path.resolve("..", "..");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const p = path.join(REPO, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { console.log("404", req.url); res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--hide-scrollbars"] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on("pageerror", (e) => console.error("PAGE ERROR", e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/marketing/explainer-video/timeline.html?lang=${process.argv[2] || "en"}`);
await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 180000 });
for (const t of (process.argv[3] || "2,12.6,20").split(",").map(Number)) {
  const r = await page.evaluate((t) => {
    window.__seek(t);
    const w = document.getElementById("wipe"), rc = w.getBoundingClientRect();
    const vis = [...document.querySelectorAll(".scene")].filter((s) => getComputedStyle(s).visibility === "visible").map((s) => s.dataset.id + ":" + getComputedStyle(s).opacity);
    const cm = document.getElementById("chromeMark"); const cs = cm.querySelector("svg"); const bb = cs && cs.getBoundingClientRect(); const chrome = { html: cm.innerHTML.slice(0, 160), w: bb && bb.width, h: bb && bb.height };
    return { t, chrome, wipe: { left: Math.round(rc.left), right: Math.round(rc.right), transform: getComputedStyle(w).transform.slice(0, 80) }, visible: vis, stage: getComputedStyle(document.getElementById("stage")).backgroundColor };
  }, t);
  console.log(JSON.stringify(r));
}
await browser.close(); server.close();
