// Records a tutorial's screen: drives a headless Chrome through script.json's
// `do` steps against the local dev server and keeps a screenshot after every
// step (every two letters while typing), with where the pointer was and a
// virtual clock, so Tutorial.jsx can replay it at the voice's pace.
//
//   node capture.mjs desktop        (1440×810 CSS px at 4/3 → 1920×1080)
//   node capture.mjs phone          (360×640 at 3× → 1080×1920)
//
// Needs `next dev` on :3000 (the screenshot studio /shots is 404 anywhere
// else). Writes video/public/tutorial/<id>/<device>/NNN.png + capture.json.
//
// Safety: every value typed is an example, and the studio's sign-in form runs
// in demo mode. The run still watches the network and STOPS if anything asks a
// host other than this machine (and Google Fonts) — nothing may reach Supabase.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadScript } from "./script.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = loadScript();   // TUT=<id> picks the tutorial (script.mjs)
const device = process.argv[2] || "desktop";
const DEV = { desktop: { width: 1440, height: 810, dpr: 4 / 3, mobile: false }, phone: { width: 360, height: 640, dpr: 3, mobile: true } }[device];
if (!DEV) throw new Error("device: desktop | phone");
const ORIGIN = "http://localhost:3000";
const OUT = path.resolve(here, `../../video/public/tutorial/${SCRIPT.id}/${device}`);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// ---- Chrome over the DevTools protocol (no library: Chrome is already here) ----
const CHROME = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find((p) => fs.existsSync(p));
const PORT = 9333;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "tut-"));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--hide-scrollbars",
  "--no-first-run", "--no-default-browser-check", "--force-color-profile=srgb", "--lang=en-US", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page"); } catch {}
}
if (!target) throw new Error("Chrome did not start");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let nextId = 1;
const pending = new Map(), listeners = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { const { ok, bad } = pending.get(m.id); pending.delete(m.id); m.error ? bad(new Error(m.error.message)) : ok(m.result); }
  else if (m.method) listeners.forEach((f) => f(m));
});
const cdp = (method, params = {}) => new Promise((ok, bad) => { const id = nextId++; pending.set(id, { ok, bad }); ws.send(JSON.stringify({ id, method, params })); });
const once = (method) => new Promise((r) => { const f = (m) => { if (m.method === method) { listeners.splice(listeners.indexOf(f), 1); r(m.params); } }; listeners.push(f); });

// the network guard: Supabase never, and nothing at all off this machine once
// anything has been typed (the landing page may load its own third-party bits)
const outside = [];
let typed = false;
listeners.push((m) => {
  if (m.method !== "Network.requestWillBeSent") return;
  const u = m.params.request.url;
  if (/^(data|blob):/.test(u) || u.startsWith(ORIGIN) || /^https:\/\/(fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net)\//.test(u)) return;
  if (typed || /supabase/i.test(u)) outside.push(u);
});
// the dashboard asks "Delete …?" / "Send this message to N people now?" with the
// browser's own confirm(): answer yes, as the owner would in the video
listeners.push((m) => { if (m.method === "Page.javascriptDialogOpening") cdp("Page.handleJavaScriptDialog", { accept: true }).catch(() => {}); });
await cdp("Network.enable");
await cdp("Page.enable");
await cdp("Runtime.enable");
await cdp("Emulation.setDeviceMetricsOverride", { width: DEV.width, height: DEV.height, deviceScaleFactor: DEV.dpr, mobile: DEV.mobile });
if (DEV.mobile) await cdp("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
// light, whatever this machine prefers, and no motion-sickness preference
await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }, { name: "prefers-reduced-motion", value: "no-preference" }] });

const js = async (expr) => (await cdp("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result.value;
const guard = () => { if (outside.length) { console.error("STOPPED — the page asked another host:", outside); process.exit(2); } };

// find an element: CSS, or text=… for the innermost visible element whose text is exactly that
const box = (sel) => js(`(() => {
  const s = ${JSON.stringify(sel)};
  let el;
  // text=… exact text · has=… the innermost element whose text contains it · up=N:<sel> that element's Nth parent
  let up = 0, q = s;
  if (q.startsWith("up=")) { up = Number(q.slice(3, q.indexOf(":"))); q = q.slice(q.indexOf(":") + 1); }
  if (q.startsWith("text=") || q.startsWith("has=")) {
    const want = q.slice(q.indexOf("=") + 1).trim(), exact = q.startsWith("text=");
    const all = [...document.querySelectorAll("button, a, span, div, label, p, h1, h2, h3, h4, li, td")]
      // has= ignores case: labels are upper-cased by CSS, and innerText follows it
      .filter((e) => e.offsetParent && e.innerText && (exact ? e.innerText.trim() === want : e.innerText.toLowerCase().includes(want.toLowerCase())));
    // the innermost match, first on the page (the hero button before the footer one)
    el = all.filter((e) => !all.some((o) => o !== e && e.contains(o)))[0];
  } else el = [...document.querySelectorAll(q)].find((e) => e.offsetParent || e.getClientRects().length);
  if (!el) return null;
  for (let i = 0; i < up && el.parentElement; i++) el = el.parentElement;
  el.scrollIntoView({ block: "nearest", inline: "nearest" });   // scroll only when it is off screen
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
})()`);

// ---- recording --------------------------------------------------------------------
let clock = 0, n = 0;
const frames = [], events = [], lines = [];
let pointer = { x: DEV.width * 0.62, y: DEV.height * 0.62 };
async function shot() {
  // the dev server's own badge is not part of the product
  await js(`document.querySelectorAll("nextjs-portal").forEach((e) => e.remove())`);
  const { data } = await cdp("Page.captureScreenshot", { format: "png" });
  const file = `${String(++n).padStart(3, "0")}.png`;
  fs.writeFileSync(path.join(OUT, file), Buffer.from(data, "base64"));
  frames.push({ t: +clock.toFixed(3), img: file });
}
async function settle(ms = 350) { await sleep(ms); await js(`document.fonts.ready.then(() => true)`); }

for (const line of SCRIPT.lines) {
  const start = clock, focus = [];
  // a motion-graphics line (Tutorial.jsx draws it): nothing to record
  if (line.scene) { clock += 0.1; lines.push({ id: line.id, start: +start.toFixed(3), end: +clock.toFixed(3), focus: null, scene: true }); continue; }
  // a phone lays some screens out differently (the menu is behind "More"): a
  // line may give its own steps for one device as do_phone / do_desktop
  for (const [op, arg, arg2] of line[`do_${device}`] || line.do) {
    if (op === "open") {
      const loaded = once("Page.loadEventFired");
      await cdp("Page.navigate", { url: ORIGIN + arg });
      await loaded; await settle(1800); guard();
      events.push({ t: clock, type: "cut", url: arg });
      await shot(); clock += 0.4;
    } else if (op === "wait") {
      await sleep(Math.max(200, arg * 1000)); await shot(); clock += arg;
    } else if (op === "move") {
      const b = await box(arg);
      if (!b) throw new Error(`line ${line.id}: nothing matches ${arg}`);
      await settle(250); await shot();                 // after the scroll into view
      pointer = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
      focus.push(b);
      events.push({ t: clock, type: "move", ...pointer });
      clock += 0.6;
    } else if (op === "click" || op === "tap") {
      events.push({ t: clock, type: "click", ...pointer });
      if (op === "click") {
        for (const type of ["mousePressed", "mouseReleased"]) await cdp("Input.dispatchMouseEvent", { type, x: pointer.x, y: pointer.y, button: "left", clickCount: 1 });
        await settle(300); guard();
      }
      await shot(); clock += 0.35;
    } else if (op === "type") {
      const chars = [...arg];
      typed = true;
      for (let i = 0; i < chars.length; i++) {
        await cdp("Input.insertText", { text: chars[i] });
        clock += 0.075;
        if (i % 2 === 1 || i === chars.length - 1) await shot();
      }
      guard(); clock += 0.2;
    } else if (op === "hold") {
      const b = await box(arg); if (b) focus.push(b);
      await shot(); clock += 0.3;
    } else if (op === "note") {
      // a labelled highlight on one part of the screen, until the line ends
      const b = await box(arg);
      if (!b) throw new Error(`line ${line.id}: nothing matches ${arg}`);
      await settle(200); await shot();
      focus.push(b);
      events.push({ t: clock, type: "note", box: b, text: arg2 || null, line: line.id });
      clock += 0.9;
    } else if (op === "scroll") {
      await js(`(() => { const s = ${JSON.stringify(arg)}; const el = s.startsWith("text=") ? null : document.querySelector(s); if (el) el.scrollIntoView({ block: "start" }); else window.scrollBy(0, ${Number(arg) || 400}); })()`);
      await settle(400);
      events.push({ t: clock, type: "cut" });
      await shot(); clock += 0.5;
    } else if (op === "key") {
      for (const type of ["keyDown", "keyUp"]) await cdp("Input.dispatchKeyEvent", { type, key: arg, code: arg, windowsVirtualKeyCode: arg === "Enter" ? 13 : arg === "Escape" ? 27 : 0 });
      await settle(400); guard(); await shot(); clock += 0.3;
    } else if (op === "mail") {
      events.push({ t: clock, type: "mail" }); clock += 3.6;   // Tutorial.jsx draws the inbox here
    }
  }
  lines.push({ id: line.id, start: +start.toFixed(3), end: +clock.toFixed(3), focus: focus.length ? union(focus) : null });
}
function union(bs) {
  const x0 = Math.min(...bs.map((b) => b.x)), y0 = Math.min(...bs.map((b) => b.y));
  const x1 = Math.max(...bs.map((b) => b.x + b.w)), y1 = Math.max(...bs.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

guard();
fs.writeFileSync(path.join(OUT, "capture.json"), JSON.stringify({ device, viewport: DEV, total: +clock.toFixed(3), lines, frames, events }, null, 1));
console.log(`${device}: ${frames.length} frames, ${clock.toFixed(1)} s of action, nothing left this machine`);
ws.close(); chrome.kill();
