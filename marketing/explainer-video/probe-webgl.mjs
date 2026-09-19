// Does headless Chrome here give us WebGL (for the Three.js scenes) and how
// fast is a 1080p screenshot? Prints both so the renderer can be planned.
import { chromium } from "playwright-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
for (const args of [["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars"], ["--hide-scrollbars"]]) {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.setContent(`<canvas id=c width=1920 height=1080></canvas>`);
  const info = await page.evaluate(() => {
    const gl = document.getElementById("c").getContext("webgl2") || document.getElementById("c").getContext("webgl");
    if (!gl) return { webgl: false };
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    return { webgl: true, version: gl.getParameter(gl.VERSION), renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "?" };
  });
  const t0 = Date.now();
  for (let i = 0; i < 5; i++) await page.screenshot({ type: "jpeg", quality: 90 });
  console.log(JSON.stringify(args), info, "screenshot ms:", ((Date.now() - t0) / 5).toFixed(0));
  await browser.close();
}
