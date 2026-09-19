// Real dashboard screens for the video, from the screenshot studio of the
// running dev server (`/shots?tab=…`, 404 anywhere but `next dev`). Light
// theme, 1280 wide at 2× so they stay crisp inside a laptop mock-up at 1080p.
import { chromium } from "playwright-core";
import fs from "node:fs";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.SHOTS_BASE || "http://localhost:3000";
const TABS = ["analytics", "conversations", "comments", "broadcast", "inventory", "assistant", "knowledge", "orders", "bookings", "channels", "website-widget", "bot-training", "ai-engine", "profile"];
const PAGES = [["pricing", "/pricing"], ["home", "/"]];
fs.mkdirSync("shots", { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--hide-scrollbars"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.addInitScript(() => { try { localStorage.setItem("al-theme", "light"); } catch {} });
for (const tab of TABS) {
  const out = `shots/${tab}.png`;
  try {
    await page.goto(`${BASE}/shots?tab=${tab}&theme=light`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2500);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: out, type: "png" });
    console.log("✓", tab);
  } catch (e) { console.log("✗", tab, String(e.message || e).slice(0, 120)); }
}
for (const [name, path] of PAGES) {
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.evaluate(() => { document.querySelectorAll(".al-obs,[data-reveal]").forEach((e) => e.classList.add("al-in")); return document.fonts.ready; });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `shots/${name}.png`, type: "png", fullPage: name === "pricing" });
    console.log("✓", name);
  } catch (e) { console.log("✗", name, String(e.message || e).slice(0, 120)); }
}
await browser.close();
