// The film as one seekable timeline. Nothing here runs on a clock: the
// renderer calls window.__seek(t) and reads the frame, so a frame at t is
// always the same frame. GSAP holds the 2D animation, three.js the 3D pieces,
// a 2D canvas the particles — all three driven from the same t.
import * as THREE from "three";
import { makeStage, buildLogo, makeCoin, glyph, ease } from "./three-bits.js";
import { markSvg } from "/src/lib/brand-mark.js";

const qs = new URLSearchParams(location.search);
const lang = qs.get("lang") === "bn" ? "bn" : "en";
document.body.classList.toggle("bn", lang === "bn");
const L = (en, bn) => (lang === "bn" ? bn : en);

try {
  const [script, durations, icons] = await Promise.all(["script.json", "durations.json", "icons.json"].map((f) => fetch(f).then((r) => r.json())));
  const FPS = 30;
  const stage = document.getElementById("stage");
  const scenesRoot = document.getElementById("scenes");
  const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const ico = (n, s = 22, c = "currentColor", w = 1.9) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${(icons[n] || []).map((d) => `<path d="${d}"/>`).join("")}</svg>`;
  document.getElementById("chromeMark").innerHTML = markSvg({ size: 38 });

  // ── timeline skeleton ────────────────────────────────────────────────────
  // lazy:false — every tween writes its values the moment it renders, never on
  // the next tick, because the renderer takes the screenshot right after seek.
  gsap.defaults({ lazy: false });
  gsap.set("#wipe", { xPercent: -140, skewX: -10 });
  const tl = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } });
  const cues = [];
  const cue = (t, kind) => cues.push({ t: +t.toFixed(3), kind });
  const vo = [];
  const scenes = script.scenes.map((sc) => ({ ...sc, text: sc[lang] }));
  let clock = 0;
  for (const sc of scenes) {
    const voDur = durations[`${lang}/${sc.id}`] || 10;
    sc.D = Math.max(voDur + 1.2, sc.min || 8);
    sc.t0 = clock; clock += sc.D;
    vo.push({ id: sc.id, at: +(sc.t0 + 0.45).toFixed(3) });
  }
  const total = clock;
  const DARK = new Set(["hook", "answer", "outro"]);

  // ── shared helpers ───────────────────────────────────────────────────────
  const words = (node) => { node.innerHTML = node.textContent.trim().split(/\s+/).map((w) => `<span class="w"><span class="wi">${w}</span></span>`).join(" "); return [...node.querySelectorAll(".wi")]; };

  function headline(ctx, { x = 110, y = 240, w = 780, size, eyebrow, at = 0.2, sub = true } = {}) {
    const box = el(`<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px"></div>`);
    const eb = el(`<div class="eyebrow"><i></i>${eyebrow || `${L("Chapter", "অধ্যায়")} ${String(ctx.i + 1).padStart(2, "0")}`}</div>`);
    const h = el(`<div class="h1"${size ? ` style="font-size:${size}px"` : ""}>${ctx.text.title}</div>`);
    box.append(eb, h);
    let s = null;
    if (sub) { s = el(`<div class="sub">${ctx.text.sub}</div>`); box.append(s); }
    ctx.content.append(box);
    const ws = words(h);
    ctx.tl.fromTo(eb, { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.5 }, ctx.T(at));
    ctx.tl.fromTo(ws, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.75, stagger: 0.055, ease: "power4.out" }, ctx.T(at + 0.1));
    if (s) ctx.tl.fromTo(s, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6 }, ctx.T(at + 0.6));
    return { box, h, s };
  }

  function chips(ctx, items, { x, y, at = 0, stagger = 0.16, gap = 12, dir = "row", cls = "", width } = {}) {
    const wrap = el(`<div style="position:absolute;left:${x}px;top:${y}px;display:flex;flex-direction:${dir};flex-wrap:wrap;gap:${gap}px;${width ? `width:${width}px` : ""}"></div>`);
    const nodes = items.map((it) => {
      const c = el(`<span class="chip ${cls} ${it.cls || ""}">${it.icon ? ico(it.icon, 22) : ""}${it.text}</span>`);
      wrap.append(c); return c;
    });
    ctx.content.append(wrap);
    nodes.forEach((n, k) => {
      const t = ctx.T(at + (Array.isArray(stagger) ? stagger[k] : k * stagger));
      ctx.tl.fromTo(n, { opacity: 0, y: 18, scale: 0.85 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "back.out(1.7)" }, t);
      cue(t, "pop");
    });
    return nodes;
  }

  // A browser window holding a real dashboard screen. Coordinates for the
  // callouts are in the screenshot's own 1280×820 space.
  function laptop(ctx, shot, { x, y, w = 1080, h = 640, tilt = -6, at = 0.3, url = "app.tellmoreai.com/dashboard" } = {}) {
    const k = w / 1280;
    const win = el(`<div class="win" style="left:${x}px;top:${y}px;width:${w}px;height:${h + 44}px"><div class="bar"><i></i><i></i><i></i><span class="url">${ico("lock", 12, "#0B7A5D")}${url}</span></div><div class="screen" style="height:${h}px"><div class="pan"><img src="shots/${shot}.png" alt=""></div></div></div>`);
    ctx.content.append(win);
    const pan = win.querySelector(".pan");
    if (tilt) gsap.set(win, { transformPerspective: 2400, rotationY: tilt, rotationX: 1.5 });
    ctx.tl.fromTo(win, { opacity: 0, y: 60, rotationY: tilt - 8 }, { opacity: 1, y: 0, rotationY: tilt, duration: 0.9, ease: "power3.out" }, ctx.T(at));
    return {
      win, pan,
      callout(r, label, at, { hide, pos = "" } = {}) {
        const c = el(`<div class="co ${pos}" style="left:${(r[0] - 6) * k}px;top:${(r[1] - 6) * k}px;width:${(r[2] - r[0] + 12) * k}px;height:${(r[3] - r[1] + 12) * k}px">${label ? `<span class="lb">${label}</span>` : ""}</div>`);
        pan.append(c);
        ctx.tl.fromTo(c, { opacity: 0, scale: 1.18 }, { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(1.8)" }, ctx.T(at));
        ctx.tl.fromTo(c, { boxShadow: "0 0 0 6px rgba(123,28,62,.14)" }, { boxShadow: "0 0 0 14px rgba(123,28,62,0)", duration: 0.9, repeat: 1, ease: "power2.out" }, ctx.T(at + 0.4));
        cue(ctx.T(at), "click");
        if (hide) ctx.tl.to(c, { opacity: 0, duration: 0.3 }, ctx.T(hide));
        return c;
      },
      panTo(yShot, at, dur = 1.2) { ctx.tl.to(pan, { y: -yShot * k, duration: dur, ease: "power2.inOut" }, ctx.T(at)); },
      zoom(scale, at, dur = 1.5, ox = 50, oy = 30) { ctx.tl.to(pan, { scale, transformOrigin: `${ox}% ${oy}%`, duration: dur, ease: "power2.inOut" }, ctx.T(at)); },
      swap(shot2, at) {
        const img2 = el(`<img src="shots/${shot2}.png" alt="" style="position:absolute;left:0;top:0;opacity:0">`);
        pan.append(img2);
        ctx.tl.to(img2, { opacity: 1, duration: 0.6 }, ctx.T(at));
        return img2;
      },
    };
  }

  function phone(ctx, { x, y, name = "Rahela", channel = "Messenger", chIcon = "brand-messenger", scale = 1, at = 0.3 } = {}) {
    const ph = el(`<div class="phone" style="left:${x}px;top:${y}px;transform-origin:50% 0"><div class="pscr"><div class="notch"></div><div class="phead"><span class="av">${name[0]}</span><span>${name}<small>${ico(chIcon, 12)} ${channel}</small></span><span class="live"><i></i>Live</span></div><div class="msgs"></div><div class="pfoot">${L("Message", "মেসেজ")}<span class="send">${ico("send", 15, "#fff")}</span></div></div></div>`);
    ctx.content.append(ph);
    gsap.set(ph, { scale, transformPerspective: 2000, rotationY: 6 });
    ctx.tl.fromTo(ph, { opacity: 0, y: 70, rotationY: 14 }, { opacity: 1, y: 0, rotationY: 6, duration: 0.9 }, ctx.T(at));
    const msgs = ph.querySelector(".msgs");
    const api = {
      ph, msgs,
      bubble(kind, html, at, { hideAt } = {}) {
        const b = el(`<div class="b ${kind}">${html}</div>`);
        msgs.append(b);
        ctx.tl.set(b, { display: "block" }, ctx.T(at));
        ctx.tl.fromTo(b, { opacity: 0, scale: 0.7, y: 14 }, { opacity: 1, scale: 1, y: 0, duration: 0.42, ease: "back.out(1.9)" }, ctx.T(at));
        cue(ctx.T(at), kind === "me" ? "pop" : "swoosh");
        if (hideAt != null) ctx.tl.set(b, { display: "none" }, ctx.T(hideAt));
        return b;
      },
      typing(at, dur = 1.1) {
        const b = el(`<div class="b bot typing"><i></i><i></i><i></i></div>`);
        msgs.append(b);
        ctx.tl.set(b, { display: "flex" }, ctx.T(at));
        ctx.tl.fromTo(b, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.3 }, ctx.T(at));
        ctx.tl.to(b.querySelectorAll("i"), { y: -5, duration: 0.22, stagger: 0.1, repeat: Math.max(1, Math.floor(dur / 0.5)), yoyo: true, ease: "sine.inOut" }, ctx.T(at + 0.2));
        ctx.tl.set(b, { display: "none" }, ctx.T(at + dur));
        return b;
      },
      clear(at) { ctx.tl.set(msgs.querySelectorAll(".b"), { display: "none" }, ctx.T(at)); },
    };
    return api;
  }

  const voiceNote = (secs = "0:07") => `<div class="vn">${ico("microphone", 18, "#fff")}<span class="bars">${Array.from({ length: 22 }, (_, i) => `<i style="height:${6 + Math.round(14 * Math.abs(Math.sin(i * 1.7)))}px"></i>`).join("")}</span><span style="font-size:13px;opacity:.85">${secs}</span></div>`;

  // Deterministic particles for the dark scenes.
  const bgDark = document.getElementById("bgDark");
  const pctx = bgDark.getContext("2d");
  const rnd = (() => { let s = 20260919; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
  const P = Array.from({ length: 150 }, () => ({ x: rnd() * 1920, y: rnd() * 1080, r: 1 + rnd() * 2.2, vx: 6 + rnd() * 14, vy: -4 + rnd() * 8, ph: rnd() * 6.28, a: 0.25 + rnd() * 0.5 }));
  function drawParticles(t) {
    pctx.clearRect(0, 0, 1920, 1080);
    const g = pctx.createRadialGradient(1300, 300, 50, 1300, 300, 1100); g.addColorStop(0, "rgba(123,28,62,.28)"); g.addColorStop(1, "rgba(123,28,62,0)");
    pctx.fillStyle = g; pctx.fillRect(0, 0, 1920, 1080);
    const pts = P.map((p) => ({ x: ((p.x + p.vx * t) % 2000 + 2000) % 2000 - 40, y: ((p.y + p.vy * t) % 1160 + 1160) % 1160 - 40, r: p.r * (0.8 + 0.3 * Math.sin(t * 1.3 + p.ph)), a: p.a }));
    pctx.strokeStyle = "rgba(224,139,166,.13)"; pctx.lineWidth = 1;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y; const d2 = dx * dx + dy * dy;
      if (d2 < 130 * 130) { pctx.globalAlpha = 1 - Math.sqrt(d2) / 130; pctx.beginPath(); pctx.moveTo(pts[i].x, pts[i].y); pctx.lineTo(pts[j].x, pts[j].y); pctx.stroke(); }
    }
    pctx.globalAlpha = 1;
    for (const p of pts) { pctx.fillStyle = `rgba(242,238,241,${p.a})`; pctx.beginPath(); pctx.arc(p.x, p.y, p.r, 0, 6.28); pctx.fill(); }
  }
  const frames3d = [];   // { from, to, fn(t) }

  // Shared 3D logo (one geometry, cloned per scene).
  const logoProto = buildLogo();

  // ── the scenes ───────────────────────────────────────────────────────────
  const build = {
    hook(c) {
      const clock = el(`<div class="mono" style="position:absolute;left:110px;top:150px;font-size:112px;font-weight:600;letter-spacing:-.02em;color:#F2EEF1;line-height:1">12:07<span style="font-size:36px;margin-left:16px;color:#E08BA6">AM</span></div>`);
      c.content.append(clock);
      c.tl.fromTo(clock, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.9 }, c.T(0.2));
      // the colon blinks on the second
      const colon = el(`<span style="position:absolute;left:0;top:0;opacity:0"></span>`); // (kept simple: no blink, steadier on video)
      headline(c, { x: 110, y: 420, w: 900, eyebrow: L("Tonight", "আজ রাতে"), at: 1.2 });
      const texts = L(["Dam koto?", "Is this in stock?", "Delivery to Cumilla?", "Size M ache?", "koto tk?", "Still available?", "Hello? Anyone?", "Price please 🙏"],
                      ["দাম কত?", "স্টকে আছে?", "কুমিল্লায় ডেলিভারি?", "M সাইজ আছে?", "কত টাকা?", "এখনো পাওয়া যাবে?", "হ্যালো? কেউ আছেন?", "দামটা বলবেন 🙏"]);
      const icons4 = ["brand-messenger", "brand-instagram", "brand-whatsapp", "world"];
      texts.forEach((tx, i) => {
        const b = el(`<div class="bub" style="left:${1000 + (i % 3) * 270 + (i % 2) * 40}px;top:-120px">${ico(icons4[i % 4], 20, "#E08BA6")} ${tx}</div>`);
        c.content.append(b);
        const at = c.T(0.6 + i * 0.85), land = 560 + (i % 4) * 95 + Math.floor(i / 4) * 40;
        c.tl.fromTo(b, { y: 0, rotationX: -40, rotationZ: -8 + (i % 3) * 8, opacity: 0 }, { y: land, rotationX: 0, rotationZ: (i % 2 ? 3 : -3), opacity: 1, duration: 1.3, ease: "bounce.out" }, at);
        cue(at + 0.9, "pop");
      });
      const stamp = el(`<div class="stamp" style="left:1010px;top:340px">${L("Sold — by whoever answered first", "বিক্রি হলো — যে আগে উত্তর দিল, তার কাছে")}</div>`);
      c.content.append(stamp);
      c.tl.fromTo(stamp, { opacity: 0, scale: 2.2, rotation: -14 }, { opacity: 1, scale: 1, rotation: -8, duration: 0.45, ease: "power4.in" }, c.T(8.2));
      cue(c.T(8.6), "ding");
    },

    brand(c) {
      const st = makeStage(c.content);
      const logo = logoProto.clone(); logo.position.set(-420, 10, 0); st.scene.add(logo);
      const t0 = c.t0, D = c.D;
      frames3d.push({ from: t0 - 0.5, to: t0 + D + 0.5, fn(t) {
        const s = t - t0; const e = ease.outBack(Math.min(1, s / 1.4));
        logo.scale.setScalar(0.35 + 0.65 * ease.outCubic(Math.min(1, s / 1.2)));
        logo.rotation.y = -1.3 + 1.3 * e + 0.12 * Math.sin(s * 0.8);
        logo.rotation.x = 0.1 * Math.sin(s * 0.6 + 1);
        logo.position.y = 10 + 14 * Math.sin(s * 0.9);
        st.render();
      } });
      const glow = el(`<div style="position:absolute;left:180px;top:190px;width:640px;height:640px;border-radius:50%;background:radial-gradient(circle,rgba(123,28,62,.22),rgba(123,28,62,0) 70%)"></div>`);
      c.content.prepend(glow);
      c.tl.fromTo(glow, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 1.4 }, c.T(0));
      const name = el(`<div style="position:absolute;left:1000px;top:390px;font-weight:900;font-size:108px;letter-spacing:-.045em;line-height:1">TellMore AI</div>`);
      const tag = el(`<div class="mono" style="position:absolute;left:1006px;top:530px;font-size:20px;letter-spacing:.2em;text-transform:uppercase;color:var(--m)">${script.brand.site}</div>`);
      const line = el(`<div style="position:absolute;left:1006px;top:582px;width:0;height:4px;background:linear-gradient(90deg,var(--m),var(--lift));border-radius:2px"></div>`);
      const auto = el(`<div style="position:absolute;left:1006px;top:640px;display:flex;align-items:center;gap:14px"><span class="chip m">${ico("building-store", 20, "#fff")}${L("An Autolinium product", "একটি Autolinium পণ্য")}</span><span class="chip">${L("Conversations that convert", "Conversations that convert")}</span></div>`);
      c.content.append(name, tag, line, auto);
      const letters = name.textContent.split("").map((ch) => `<span style="display:inline-block;white-space:pre">${ch}</span>`).join("");
      name.innerHTML = letters;
      c.tl.fromTo(name.children, { opacity: 0, y: 40, rotationX: -60 }, { opacity: 1, y: 0, rotationX: 0, duration: 0.7, stagger: 0.045, ease: "back.out(1.4)" }, c.T(1.0));
      c.tl.fromTo(tag, { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.6 }, c.T(1.9));
      c.tl.to(line, { width: 520, duration: 0.9, ease: "power3.inOut" }, c.T(2.1));
      c.tl.fromTo(auto.children, { opacity: 0, y: 20, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.2, ease: "back.out(1.6)" }, c.T(2.8));
      cue(c.T(1.0), "chime"); cue(c.T(2.8), "pop"); cue(c.T(3.0), "pop");
    },

    problem(c) {
      headline(c, { x: 110, y: 250, w: 720, size: 60 });
      const px = 1150, py = 170;
      const ph = el(`<div class="phone" style="left:${px}px;top:${py}px;transform:scale(.86);transform-origin:50% 0"><div class="pscr"><div class="notch"></div><div class="phead"><span class="av">?</span><span>${L("Inbox", "ইনবক্স")}<small>${L("4 channels", "৪টা চ্যানেল")}</small></span></div><div class="msgs" style="bottom:20px;gap:6px"></div></div></div>`);
      c.content.append(ph);
      c.tl.fromTo(ph, { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.9 }, c.T(0.2));
      const counter = el(`<div style="position:absolute;left:${px + 30}px;top:${py - 76}px;display:flex;align-items:center;gap:10px" class="chip m">${ico("bell", 20, "#fff")}<span>${L("Unanswered", "উত্তর বাকি")}: <b id="cnt">0</b></span></div>`);
      c.content.append(counter);
      c.tl.fromTo(counter, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5 }, c.T(1.4));
      const num = { v: 0 }; const cnt = counter.querySelector("#cnt");
      c.tl.to(num, { v: 127, duration: 10, ease: "power1.in", onUpdate: () => { cnt.textContent = Math.round(num.v); } }, c.T(1.6));
      const tiles = [["brand-messenger", "#0084FF", 940, 240], ["brand-instagram", "#E1306C", 1660, 240], ["brand-whatsapp", "#25D366", 940, 760], ["world", "#7B1C3E", 1660, 760]];
      const tileEls = tiles.map(([ic, col, x, y]) => { const t = el(`<div class="ctile" style="left:${x}px;top:${y}px">${ico(ic, 46, col, 1.7)}</div>`); c.content.append(t); return t; });
      c.tl.fromTo(tileEls, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.6, stagger: 0.12, ease: "back.out(1.8)" }, c.T(0.5));
      const qs = L(["Price?", "Size M?", "Delivery charge?", "In stock?", "koto tk?", "Cash on delivery?", "Color options?", "Still available?", "Cumilla te delivery?", "Discount?", "Kobe pabo?", "Original?"],
                   ["দাম?", "M সাইজ?", "ডেলিভারি চার্জ?", "স্টকে আছে?", "কত টাকা?", "ক্যাশ অন ডেলিভারি?", "অন্য রঙ আছে?", "এখনো আছে?", "কুমিল্লায় ডেলিভারি?", "ডিসকাউন্ট?", "কবে পাব?", "অরিজিনাল?"]);
      const msgs = ph.querySelector(".msgs");
      qs.forEach((q, i) => {
        const src = tiles[i % 4];
        const fly = el(`<div class="chip" style="position:absolute;left:${src[2] + 20}px;top:${src[3] + 20}px;font-size:17px;padding:8px 14px">${q}</div>`);
        c.content.append(fly);
        const at = c.T(1.2 + i * 0.7);
        c.tl.fromTo(fly, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.25 }, at);
        c.tl.to(fly, { left: px + 60, top: py + 320 + (i % 5) * 8, scale: 0.7, duration: 0.7, ease: "power2.in" }, at + 0.25);
        c.tl.to(fly, { opacity: 0, duration: 0.15 }, at + 0.95);
        const inb = el(`<div class="b bot" style="font-size:15px;padding:8px 12px">${q}</div>`);
        msgs.append(inb);
        c.tl.set(inb, { display: "block" }, at + 0.95);
        c.tl.fromTo(inb, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3 }, at + 0.95);
        cue(at + 0.95, "pop");
      });
      const walk = chips(c, [{ icon: "user", text: L("…quietly walks away", "…চুপচাপ চলে যায়") }], { x: 110, y: 700, at: 11.5, cls: "" });
    },

    answer(c) {
      const st = makeStage(c.content);
      const logo = logoProto.clone(); logo.position.set(0, 40, 0); st.scene.add(logo);
      const coinDefs = [["brand-messenger", "#0084FF"], ["brand-instagram", "#E1306C"], ["brand-whatsapp", "#25D366"], ["world", "#7B1C3E"]];
      const coins = coinDefs.map(([n, col]) => { const co = makeCoin(glyph(icons[n], col), { rim: col, size: 64 }); st.scene.add(co); return co; });
      const t0 = c.t0, D = c.D;
      frames3d.push({ from: t0 - 0.5, to: t0 + D + 0.5, fn(t) {
        const s = t - t0;
        const intro = ease.outCubic(Math.min(1, s / 1.3));
        logo.scale.setScalar(0.62 * intro);
        logo.rotation.y = 0.18 * Math.sin(s * 0.7); logo.rotation.x = 0.08 * Math.sin(s * 0.5);
        const conv = ease.inOut(Math.min(1, Math.max(0, (s - (D - 4.2)) / 2.4)));
        coins.forEach((co, k) => {
          const a = s * 0.62 + k * Math.PI / 2 + 1;
          const rx = 560 * (1 - conv) + 120 * conv, rz = 170 * (1 - conv) + 60 * conv;
          co.position.set(Math.cos(a) * rx, 40 + Math.sin(a * 2) * 28 * (1 - conv) - 330 * conv, Math.sin(a) * rz + 40 * (1 - conv));
          co.rotation.z = 0.25 * Math.sin(s * 1.1 + k); co.rotation.y = 0.35 * Math.sin(s * 0.9 + k * 2);
          const sc = intro * (1 - 0.7 * conv); co.scale.setScalar(Math.max(0.001, sc));
        });
        st.render();
      } });
      headline(c, { x: 110, y: 700, w: 900, size: 56, at: 1.2, eyebrow: L("The answer", "সমাধান") });
      chips(c, [{ icon: "clock", text: "24/7" }, { text: "বাংলা" }, { text: "English" }, { text: "Banglish" }], { x: 1280, y: 120, at: 4.5, stagger: 0.25 });
      const tray = el(`<div style="position:absolute;left:760px;top:790px;width:400px;height:150px;border-radius:26px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;gap:12px;font-weight:700;font-size:26px;color:#F2EEF1;backdrop-filter:blur(6px)">${ico("mail", 30, "#E08BA6")}${L("One inbox", "একটা ইনবক্স")}</div>`);
      c.content.append(tray);
      c.tl.fromTo(tray, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.7 }, c.T(D - 3.6));
      c.tl.fromTo(tray, { boxShadow: "0 0 0 0 rgba(46,211,167,0)" }, { boxShadow: "0 0 0 18px rgba(46,211,167,0)", duration: 0.9, ease: "power2.out" }, c.T(D - 1.6));
      cue(c.T(D - 1.7), "chime");
    },

    start(c) {
      headline(c, { x: 110, y: 150, w: 620, size: 54, sub: false });
      const steps = [
        [L("Sign up", "সাইন আপ করুন"), L("3-day free trial · no card", "৩ দিনের ফ্রি ট্রায়াল · কার্ড লাগে না")],
        [L("Connect a channel", "চ্যানেল যুক্ত করুন"), L("One click — log in, pick the Page", "এক ক্লিক — লগইন করুন, পেজটা বাছুন")],
        [L("The bot is live", "বট চালু"), L("Facebook · Instagram · WhatsApp · website", "Facebook · Instagram · WhatsApp · ওয়েবসাইট")],
      ];
      steps.forEach(([b, s], i) => {
        const st = el(`<div class="step" style="position:absolute;left:110px;top:${360 + i * 130}px;width:600px"><span class="n">${i + 1}</span><div><b>${b}</b><span>${s}</span></div></div>`);
        c.content.append(st);
        c.tl.fromTo(st, { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.6 }, c.T(0.8 + i * 3.4));
        cue(c.T(0.8 + i * 3.4), "pop");
      });
      const lp = laptop(c, "channels", { x: 770, y: 200, w: 1070 });
      lp.callout([797, 45, 989, 83], L("Connect in one click", "এক ক্লিকে যুক্ত করুন"), 4.2, { hide: 8.5, pos: "below right" });
      lp.callout([895, 188, 946, 226], L("Live", "চালু"), 8.8, { hide: 11.6, pos: "right" });
      lp.callout([898, 344, 976, 382], L("Instagram", "Instagram"), 11.8, { hide: 13.8, pos: "right" });
      lp.panTo(60, 13.4);
      lp.callout([898, 498, 976, 536], L("WhatsApp — even a new number", "WhatsApp — নতুন নম্বরও"), 14.0, { hide: 17.4, pos: "right" });
      lp.callout([186, 704, 660, 762], L("Your website — one line of code", "আপনার ওয়েবসাইট — এক লাইন কোড"), 17.6, { hide: 21.5 });
      chips(c, [{ icon: "check", text: L("No tokens", "টোকেন নেই"), cls: "mint" }, { icon: "check", text: L("No code", "কোড নেই"), cls: "mint" }, { icon: "check", text: L("No developer", "ডেভেলপার লাগে না"), cls: "mint" }], { x: 110, y: 790, at: 20.2, stagger: 0.22 });
    },

    teach(c) {
      headline(c, { x: 1180, y: 130, w: 660, size: 50, sub: false });
      const lp = laptop(c, "bot-training", { x: 80, y: 190, w: 1040, tilt: 6 });
      lp.callout([291, 172, 730, 208], L("Train · Offers · Bargaining · Behavior", "Train · Offers · Bargaining · Behavior"), 1.2, { hide: 5.5, pos: "below" });
      lp.panTo(180, 8.5);
      lp.callout([310, 394, 970, 522], L("Describe your business", "আপনার ব্যবসার বর্ণনা"), 9.0, { hide: 17.5 });
      lp.callout([861, 307, 957, 336], L("AI fills it in for you", "AI নিজেই ভরে দেয়"), 19.5, { pos: "right" });
      const rows = [
        [1.5, "user", L("Name · greeting · tone · language", "নাম · অভিবাদন · ধরন · ভাষা")],
        [5.6, "building-store", L("Shop: 14 questions — delivery, payment, returns, hours…", "দোকান: ১৪টা প্রশ্ন — ডেলিভারি, পেমেন্ট, রিটার্ন, সময়…")],
        [9.4, "calendar-event", L("Service: 13 — services, pricing, process, meetings…", "সেবা: ১৩টা — সার্ভিস, দাম, ধাপ, মিটিং…")],
        [14.0, "bolt", L("Add an instruction any time — it obeys from the next message", "যেকোনো সময় নতুন নির্দেশ — পরের মেসেজ থেকেই মানে")],
        [19.6, "sparkles", L("AI writes your whole business profile", "AI আপনার পুরো প্রোফাইল লিখে দেয়")],
      ];
      rows.forEach(([at, icn, tx], i) => {
        const r = el(`<div class="tile" style="position:absolute;left:1180px;top:${330 + i * 108}px;width:660px"><span class="ic">${ico(icn, 24)}</span><span style="font-size:19px;line-height:1.3">${tx}</span></div>`);
        c.content.append(r);
        c.tl.fromTo(r, { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.6 }, c.T(at));
        cue(c.T(at), "pop");
      });
    },

    products(c) {
      headline(c, { x: 110, y: 120, w: 680, size: 52, sub: false });
      const lp = laptop(c, "inventory", { x: 840, y: 180, w: 1020, h: 600 });
      lp.callout([870, 176, 1002, 211], L("Add products", "পণ্য যোগ"), 2.2, { hide: 8, pos: "below" });
      lp.callout([1011, 173, 1136, 214], L("AI Assistant", "AI Assistant"), 18.2, { hide: 21, pos: "below right" });
      lp.callout([547, 35, 736, 99], L("Sizes & colours", "সাইজ ও রঙ"), 21.2, { hide: 25, pos: "below" });
      lp.callout([365, 333, 1149, 410], L("Cover image per collection", "প্রতিটা কালেকশনের কভার ছবি"), 23.0, { pos: "below" });
      const ways = [
        ["camera", L("Snap a photo", "ছবি তুলুন"), L("AI writes name & description", "AI নাম ও বিবরণ লেখে")],
        ["photo", L("A batch of photos", "অনেক ছবি একসাথে"), L("sorted into products", "পণ্য ধরে ভাগ হয়")],
        ["message-2", L("Describe it in chat", "চ্যাটে বলুন"), L("the AI interviews you", "AI প্রশ্ন করে নেয়")],
        ["link", L("Paste a website link", "ওয়েবসাইট লিংক"), L("one link, one product", "এক লিংক, এক পণ্য")],
        ["file-spreadsheet", L("Import a CSV", "CSV ইমপোর্ট"), L("many at once", "একসাথে অনেক")],
        ["building-store", "Shopify", L("pull the whole store", "পুরো দোকান আনুন")],
        ["shopping-cart", "WooCommerce", L("pull the whole store", "পুরো দোকান আনুন")],
        ["sparkles", L("Tell the AI Assistant", "AI Assistant-কে বলুন"), L("“add a red saree, 2,500”", "“লাল শাড়ি যোগ করো, ২,৫০০”")],
      ];
      ways.forEach(([icn, b, s], i) => {
        const t = el(`<div class="tile" style="position:absolute;left:${110 + (i % 2) * 360}px;top:${290 + Math.floor(i / 2) * 104}px;width:340px"><span class="ic">${ico(icn, 24)}</span><span>${b}<small>${s}</small></span></div>`);
        c.content.append(t);
        const at = c.T(2.0 + i * 2.0);
        c.tl.fromTo(t, { opacity: 0, y: 24, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: "back.out(1.5)" }, at);
        cue(at, "pop");
      });
      chips(c, [{ icon: "tag", text: L("Variants with own prices", "ভ্যারিয়েন্ট, আলাদা দাম") }, { icon: "photo", text: L("Collection covers", "কালেকশন কভার") }, { icon: "check", text: L("Duplicate finder", "ডুপ্লিকেট খোঁজা") }], { x: 110, y: 730, at: 20.8, stagger: 0.7 });
    },

    docs(c) {
      headline(c, { x: 110, y: 130, w: 640, size: 50, sub: false });
      const lp = laptop(c, "knowledge", { x: 760, y: 200, w: 1080 });
      lp.callout([1043, 125, 1136, 163], L("Upload", "আপলোড"), 2.6, { hide: 8.5, pos: "below right" });
      lp.callout([131, 192, 1149, 442], L("PDF · Word · text — indexed for the bot", "PDF · Word · লেখা — বটের জন্য index"), 4.2, { hide: 9.4, pos: "below" });
      const img2 = lp.swap("bookings", 10.0);
      cue(c.T(10), "swoosh");
      lp.callout([131, 330, 1149, 509], L("Booked by the bot", "বট বুক করেছে"), 13.6, { hide: 18.8 });
      lp.callout([150, 448, 278, 490], L("Meet link", "Meet লিংক"), 15.6, { hide: 18.8, pos: "below" });
      lp.callout([1059, 419, 1130, 448], L("Cancel → customer is told", "বাতিল → কাস্টমার জানে"), 19.2, { pos: "right" });
      chips(c, [{ icon: "file-spreadsheet", text: "PDF" }, { text: "Word" }, { text: L("Text", "লেখা") }], { x: 110, y: 330, at: 2.0, stagger: 0.2 });
      // a little week grid: the bot finds a free slot
      const grid = el(`<div style="position:absolute;left:110px;top:440px;width:600px"><div class="eyebrow" style="margin-bottom:12px"><i></i>${L("Google Calendar", "Google Calendar")}</div><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">${Array.from({ length: 20 }, (_, i) => `<div class="slot" style="height:44px;border-radius:10px;background:${[2, 6, 9, 13, 16].includes(i) ? "#ECE6EA" : "#fff"};border:1px solid var(--line)"></div>`).join("")}</div></div>`);
      c.content.append(grid);
      c.tl.fromTo(grid, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6 }, c.T(10.2));
      const slot = grid.querySelectorAll(".slot")[12];
      c.tl.to(slot, { backgroundColor: "#2ED3A7", scale: 1.08, duration: 0.4, ease: "back.out(2)" }, c.T(12.6));
      cue(c.T(12.6), "ding");
      chips(c, [{ icon: "calendar-event", text: L("Thu 4:00 PM — free", "বৃহস্পতিবার ৪টা — খালি"), cls: "mint" }, { icon: "link", text: L("Meet link sent", "Meet লিংক পাঠানো হলো") }], { x: 110, y: 720, at: 13.0, stagger: 2.2 });
    },

    inbox(c) {
      headline(c, { x: 1060, y: 170, w: 760, size: 54, sub: false });
      const p = phone(c, { x: 560, y: 120, name: "Tasnim", channel: "Instagram", chIcon: "brand-instagram" });
      p.bubble("me", L("এই জামদানি শাড়িটার দাম কত?", "এই জামদানি শাড়িটার দাম কত?"), 1.0);
      p.typing(2.0, 1.2);
      p.bubble("bot", L("জামদানি শাড়ি — ৳৩,২০০, ফ্রি ডেলিভারি। লাল আর নীল আছে 🙂", "জামদানি শাড়ি — ৳৩,২০০, ফ্রি ডেলিভারি। লাল আর নীল আছে 🙂"), 3.3);
      p.bubble("me", "size ache?", 6.2); p.bubble("me", "M hobe?", 6.7); p.bubble("me", "delivery koto?", 7.2);
      p.typing(8.0, 1.3);
      p.bubble("bot", L("M আছে। ঢাকার ভেতরে ডেলিভারি ৳৬০, ১–২ দিনে।", "M আছে। ঢাকার ভেতরে ডেলিভারি ৳৬০, ১–২ দিনে।"), 9.4);
      p.clear(11.9);
      p.bubble("me", `<div class="photo">${ico("photo", 40, "#fff")}</div><div style="margin-top:6px">${L("Ei design ta ache?", "এই ডিজাইনটা আছে?")}</div>`, 12.2);
      p.typing(13.4, 1.3);
      p.bubble("bot", L("Matched — Cotton kurti, ৳1,450 · M and L in stock ✓", "মিলে গেছে — কটন কুর্তি, ৳১,৪৫০ · M আর L আছে ✓"), 14.8);
      p.bubble("me", voiceNote("0:07"), 17.6);
      p.typing(18.8, 1.2);
      p.bubble("bot", L("Yes — we deliver to Sylhet, 2–3 days. Cash on delivery is fine.", "জি, সিলেটে ডেলিভারি হয়, ২–৩ দিন। ক্যাশ অন ডেলিভারি চলবে।"), 20.1);
      const feats = [
        [3.4, "language", L("Replies in the customer's language", "কাস্টমারের ভাষায় উত্তর")],
        [9.5, "message-2", L("3 quick messages → one reply", "৩টা মেসেজ → একটা উত্তর")],
        [14.9, "photo", L("Photo → the exact product, real price", "ছবি → ঠিক পণ্য, আসল দাম")],
        [20.2, "microphone", L("Voice note → understood, answered", "ভয়েস নোট → বুঝে উত্তর")],
      ];
      feats.forEach(([at, icn, tx], i) => {
        const r = el(`<div class="tile" style="position:absolute;left:1060px;top:${420 + i * 100}px;width:760px"><span class="ic">${ico(icn, 24)}</span><span style="font-size:20px">${tx}</span></div>`);
        c.content.append(r);
        c.tl.fromTo(r, { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.6 }, c.T(at));
        cue(c.T(at), "chime");
      });
    },

    orders(c) {
      headline(c, { x: 110, y: 104, w: 1400, size: 48, sub: false });
      const p = phone(c, { x: 110, y: 240, name: "Rahela", channel: "WhatsApp", chIcon: "brand-whatsapp", scale: 0.92 });
      p.bubble("me", L("Order korte chai — M, red", "অর্ডার করতে চাই — M, লাল"), 0.8);
      p.typing(1.6, 1.0);
      p.bubble("bot", L("Great! Your name, phone and address please 🙂", "দারুণ! নাম, ফোন আর ঠিকানা দিন 🙂"), 2.7);
      p.bubble("me", L("Rahela Khatun, 017…, Kandirpar, Cumilla", "রাহেলা খাতুন, ০১৭…, কান্দিরপাড়, কুমিল্লা"), 4.4);
      p.typing(5.2, 1.0);
      p.bubble("bot card", `<b style="font-size:16px">${L("Order #AL2481 confirmed ✓", "অর্ডার #AL2481 নিশ্চিত ✓")}</b><div style="margin-top:6px;color:var(--soft)">Jamdani saree · M · ${L("red", "লাল")}<br>৳3,200 + ৳60 ${L("delivery", "ডেলিভারি")} = <b>৳3,260</b><br>${L("Cash on delivery · 2 days", "ক্যাশ অন ডেলিভারি · ২ দিন")}</div>`, 6.3);
      cue(c.T(6.4), "ding");
      chips(c, [{ text: L("Cash on delivery", "ক্যাশ অন ডেলিভারি") }, { text: "bKash" }, { text: "Nagad" }, { text: L("Card", "কার্ড") }, { icon: "check", text: L("Never the same order twice", "একই অর্ডার দুবার নয়"), cls: "mint" }], { x: 560, y: 240, at: 8.0, stagger: 0.35, width: 560 });
      const lp = laptop(c, "orders", { x: 700, y: 400, w: 1160, h: 560, at: 11.8 });
      lp.callout([131, 256, 704, 291], L("Pending → Confirmed → Shipped → Delivered", "Pending → Confirmed → Shipped → Delivered"), 13.6, { hide: 18.5, pos: "below" });
      lp.callout([144, 528, 618, 563], L("One tap", "এক চাপে"), 16.4, { hide: 20.2 });
      lp.callout([1053, 192, 1136, 227], L("Export CSV", "CSV-তে নামান"), 20.6, { hide: 24.6, pos: "right" });
      const toast = el(`<div class="toast" style="position:absolute;left:1440px;top:250px">${`<span class="ic">${ico("bell", 22)}</span>`}<div><b>${L("New order #A-1042", "নতুন অর্ডার #A-1042")}</b><span>Tasnim Rahman · ৳1,510 · ${L("also emailed", "ইমেইলেও গেছে")}</span></div></div>`);
      c.content.append(toast);
      c.tl.fromTo(toast, { opacity: 0, y: -30, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "back.out(1.6)" }, c.T(24.6));
      cue(c.T(24.6), "ding");
    },

    comments(c) {
      headline(c, { x: 110, y: 120, w: 700, size: 52, sub: false });
      const post = el(`<div class="card" style="left:110px;top:330px;width:520px;padding:0;overflow:hidden"><div style="display:flex;align-items:center;gap:10px;padding:14px 18px;font-weight:700"><span style="width:34px;height:34px;border-radius:50%;background:var(--m);color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px">N</span>nokshithreads<span style="margin-left:auto;color:var(--faint)">${ico("brand-instagram", 20)}</span></div><div style="height:180px;background:linear-gradient(135deg,#E7C8D2,#7B1C3E);display:flex;align-items:center;justify-content:center;color:#fff">${ico("photo", 48, "#fff")}</div><div style="padding:14px 18px;font-size:16px"><b>${L("New Eid collection 🌙", "নতুন ঈদ কালেকশন 🌙")}</b> ${L("— panjabi in every size.", "— সব সাইজে পাঞ্জাবি।")}</div><div class="cm" style="padding:0 18px 14px;display:none"><div style="display:flex;gap:10px;font-size:16px"><b>tasnim.r</b><span>${L("koto?", "কত?")}</span></div></div><div class="rp" style="margin:0 18px 16px;padding:12px 14px;border-radius:12px;background:var(--sunk);font-size:15px;display:none"><b style="color:var(--m)">nokshithreads</b> ${L("Of course — I've sent you the details in a message 💬", "নিশ্চয়ই — বিস্তারিত মেসেজে পাঠিয়েছি 💬")}</div></div>`);
      c.content.append(post);
      c.tl.fromTo(post, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.8 }, c.T(0.3));
      const cm = post.querySelector(".cm"), rp = post.querySelector(".rp");
      c.tl.set(cm, { display: "block" }, c.T(1.6)); c.tl.fromTo(cm, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.4 }, c.T(1.6)); cue(c.T(1.6), "pop");
      c.tl.set(rp, { display: "block" }, c.T(3.6)); c.tl.fromTo(rp, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4 }, c.T(3.6)); cue(c.T(3.6), "swoosh");
      const dm = el(`<div class="chip m" style="position:absolute;left:180px;top:640px">${ico("mail", 20, "#fff")}${L("Private message → inbox", "প্রাইভেট মেসেজ → ইনবক্স")}</div>`);
      c.content.append(dm);
      c.tl.fromTo(dm, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2)" }, c.T(5.2));
      c.tl.to(dm, { x: 720, y: -160, scale: 0.85, duration: 1.0, ease: "power2.inOut" }, c.T(6.0));
      c.tl.to(dm, { opacity: 0, duration: 0.3 }, c.T(7.0));
      cue(c.T(6.0), "swoosh");
      const lp = laptop(c, "comments", { x: 760, y: 220, w: 1080, at: 5.8 });
      lp.callout([397, 192, 742, 230], L("Replied · Sent to inbox · Needs attention", "উত্তর · ইনবক্সে · নজর দরকার"), 8.4, { hide: 12.5, pos: "below" });
      lp.callout([854, 272, 1101, 298], L("Both, tracked", "দুটোই, স্ট্যাটাসসহ"), 10.6, { pos: "below right" });
    },

    offers(c) {
      headline(c, { x: 110, y: 104, w: 1500, size: 48, sub: false });
      const offers = [
        [L("Eid offer — 20% off all panjabi", "ঈদ অফার — সব পাঞ্জাবিতে ২০% ছাড়"), L("until 31 Mar · 12 products", "৩১ মার্চ পর্যন্ত · ১২টা পণ্য")],
        [L("Free delivery inside Dhaka", "ঢাকার ভেতরে ফ্রি ডেলিভারি"), L("until Friday · all products", "শুক্রবার পর্যন্ত · সব পণ্য")],
        [L("Buy 2 sarees, get a scarf", "২টা শাড়িতে একটা স্কার্ফ ফ্রি"), L("until 15 Apr · sarees", "১৫ এপ্রিল পর্যন্ত · শাড়ি")],
      ];
      offers.forEach(([t1, t2], i) => {
        const card = el(`<div class="card" style="left:110px;top:${270 + i * 120}px;width:760px;display:flex;align-items:center;gap:16px"><span style="width:50px;height:50px;border-radius:14px;background:var(--sunk);color:var(--m);display:flex;align-items:center;justify-content:center">${ico("tag", 26)}</span><div style="flex:1"><b style="font-size:21px">${t1}</b><div style="color:var(--faint);font-size:16px;margin-top:2px">${t2}</div></div><span class="chip mint" style="font-size:15px;padding:8px 14px">${L("Live", "চালু")}</span></div>`);
        c.content.append(card);
        c.tl.fromTo(card, { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.6 }, c.T(1.0 + i * 1.3));
        cue(c.T(1.0 + i * 1.3), "pop");
      });
      chips(c, [{ icon: "check", text: L("Quoted exactly — never invented", "হুবহু বলে — নিজে বানায় না"), cls: "mint" }, { icon: "sparkles", text: L("AI rewrites the wording", "AI লেখাটা সাজিয়ে দেয়") }], { x: 110, y: 650, at: 6.2, stagger: 1.4 });
      const modes = [
        ["lock", L("Fixed price", "নির্দিষ্ট দাম"), L("no discounts, ever", "কোনো ছাড় নেই")],
        ["arrow-back-up", L("Limited — secret max", "সীমিত — গোপন সর্বোচ্চ"), L("haggles step by step", "ধাপে ধাপে দরদাম")],
        ["user", L("Your own rule", "নিজের নিয়ম"), L("written in your words", "নিজের ভাষায় লেখা")],
      ];
      modes.forEach(([icn, b, s], i) => {
        const t = el(`<div class="tile" style="position:absolute;left:${960 + i * 300}px;top:270px;width:280px;flex-direction:column;align-items:flex-start;gap:10px;padding:20px"><span class="ic">${ico(icn, 24)}</span><span>${b}<small>${s}</small></span></div>`);
        c.content.append(t);
        c.tl.fromTo(t, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6 }, c.T(10.6 + i * 1.6));
        cue(c.T(10.6 + i * 1.6), "pop");
      });
      const chat = el(`<div style="position:absolute;left:960px;top:450px;width:860px;display:flex;flex-direction:column;gap:10px;align-items:flex-start"></div>`);
      c.content.append(chat);
      const lines = [["me", L("3000 e dea jabe?", "৩০০০-এ দেওয়া যাবে?"), 15.4], ["bot", L("৳3,200 is already a fair price… but for you, ৳3,150 🙂", "৳৩,২০০-ই ন্যায্য দাম… তবে আপনার জন্য ৳৩,১৫০ 🙂"), 16.6], ["me", L("3050?", "৩০৫০?"), 18.2], ["bot", L("Okay — ৳3,100, final. Shall I book it?", "আচ্ছা — ৳৩,১০০, ফাইনাল। অর্ডার করে দিই?"), 19.4]];
      lines.forEach(([k, tx, at]) => {
        const b = el(`<div class="b ${k}" style="display:block;font-size:18px;max-width:70%;${k === "me" ? "align-self:flex-end" : ""}">${tx}</div>`);
        chat.append(b);
        c.tl.fromTo(b, { opacity: 0, scale: 0.8, y: 10 }, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "back.out(1.8)" }, c.T(at));
        cue(c.T(at), k === "me" ? "pop" : "swoosh");
      });
      const lock = el(`<div class="chip gold" style="position:absolute;left:1440px;top:680px">${ico("lock", 20, "#3A2A06")}${L("Your floor: ৳2,900 — never revealed", "আপনার সীমা: ৳২,৯০০ — কখনো ফাঁস হয় না")}</div>`);
      c.content.append(lock);
      c.tl.fromTo(lock, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2)" }, c.T(20.8));
      cue(c.T(20.8), "click");
    },

    assistant(c) {
      headline(c, { x: 110, y: 110, w: 900, size: 52, sub: false });
      const lp = laptop(c, "assistant", { x: 600, y: 300, w: 1230, h: 660, tilt: -5 });
      const overlay = el(`<div style="position:absolute;left:150px;top:235px;width:1000px;display:flex;flex-direction:column;gap:12px;align-items:flex-start"></div>`);
      lp.win.querySelector(".screen").append(overlay);
      const items = [
        ["me", L("Add a red saree at 2,500, 10 in stock", "লাল শাড়ি যোগ করো, দাম ২,৫০০, স্টক ১০টা"), 3.0],
        ["card", `<div style="display:flex;align-items:center;gap:12px"><span style="width:38px;height:38px;border-radius:10px;background:var(--sunk);color:var(--m);display:flex;align-items:center;justify-content:center">${ico("sparkles", 20)}</span><b>${L("Proposal · Create product", "প্রস্তাব · নতুন পণ্য")}</b></div><div style="margin:10px 0 12px;font-size:16px;line-height:1.6;color:var(--soft)">${L("Red saree · ৳2,500 · stock 10 · category Sarees", "লাল শাড়ি · ৳২,৫০০ · স্টক ১০ · ক্যাটাগরি শাড়ি")}</div><span class="apply chip m" style="font-size:16px;padding:9px 18px">${L("Apply", "Apply")}</span>`, 5.6],
        ["me", L("Which products are low on stock?", "কোন পণ্যের স্টক কম?"), 9.6],
        ["bot", L("Two: Half-sleeve polo (olive) — 3 left, Kids' kurta set — 0 left. Want a restock reminder?", "দুটো: হাফ-স্লিভ পোলো (অলিভ) — ৩টা আছে, কিডস কুর্তা সেট — শেষ। রিস্টক রিমাইন্ডার দেব?"), 11.0],
      ];
      let applyBtn;
      items.forEach(([k, html, at]) => {
        const b = el(`<div class="b ${k === "card" ? "card" : k}" style="display:block;font-size:17px;${k === "me" ? "align-self:flex-end;max-width:70%" : "max-width:78%"}">${html}</div>`);
        overlay.append(b);
        c.tl.fromTo(b, { opacity: 0, y: 12, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "back.out(1.6)" }, c.T(at));
        cue(c.T(at), k === "me" ? "pop" : "swoosh");
        if (k === "card") applyBtn = b.querySelector(".apply");
      });
      chips(c, [{ text: L("Products", "পণ্য") }, { text: L("Prices & stock", "দাম ও স্টক") }, { text: L("Offers", "অফার") }, { text: L("Bargaining", "দরদাম") }, { text: L("Bot training", "বটের ট্রেনিং") }], { x: 110, y: 340, at: 13.6, stagger: 0.35, width: 460 });
      // the click
      c.tl.to(applyBtn, { scale: 0.92, duration: 0.12, yoyo: true, repeat: 1 }, c.T(18.6));
      cue(c.T(18.6), "click");
      const done = el(`<div class="chip mint" style="position:absolute;left:110px;top:640px;font-size:22px">${ico("check", 24, "#0B7A5D")}${L("Applied — nothing changed before you pressed it", "Apply হলো — তার আগে কিছুই বদলায়নি")}</div>`);
      c.content.append(done);
      c.tl.fromTo(done, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.8)" }, c.T(19.0));
      cue(c.T(19.0), "chime");
    },

    handoff(c) {
      headline(c, { x: 110, y: 110, w: 1000, size: 50, sub: false });
      const lp = laptop(c, "conversations", { x: 620, y: 330, w: 1220, h: 620 });
      const k = 1220 / 1280;
      const tg = el(`<div class="toggle" style="left:${1034 * k}px;top:${53 * k}px;width:${42 * k}px;height:${26 * k}px"><i style="width:${20 * k}px;height:${20 * k}px;left:${19 * k}px"></i></div>`);
      lp.pan.append(tg);
      c.tl.set(tg, { opacity: 0 }, c.T(0));
      c.tl.to(tg, { opacity: 1, duration: 0.2 }, c.T(6.0));
      c.tl.to(tg, { backgroundColor: "#C9C0C5", boxShadow: "0 0 0 4px rgba(18,17,22,.08)", duration: 0.35 }, c.T(6.4));
      c.tl.to(tg.querySelector("i"), { x: -16 * k, duration: 0.35, ease: "power2.inOut" }, c.T(6.4));
      cue(c.T(6.4), "click");
      lp.callout([1020, 46, 1130, 88], L("Manual — you take over", "Manual — আপনি সামলান"), 6.9, { hide: 11.5, pos: "below right" });
      lp.callout([483, 678, 586, 710], L("Reply here: photo, voice, text", "এখান থেকে উত্তর: ছবি, ভয়েস, লেখা"), 12.4, { hide: 16.5 });
      const alerts = [
        [1.4, "bell", L("Needs a person", "একজন মানুষ দরকার"), L("Tasnim asked for someone", "তাসনিম একজনকে চেয়েছেন")],
        [2.9, "device-mobile", L("Push · Android app", "পুশ · Android অ্যাপ"), L("the same alert on your phone", "একই সতর্কতা আপনার ফোনে")],
        [4.4, "mail", L("Email", "ইমেইল"), L("with a link to the chat", "চ্যাটের লিংকসহ")],
      ];
      alerts.forEach(([at, icn, b, s], i) => {
        const t = el(`<div class="toast" style="position:absolute;left:110px;top:${330 + i * 96}px;width:470px"><span class="ic">${ico(icn, 22)}</span><div><b>${b}</b><span>${s}</span></div></div>`);
        c.content.append(t);
        c.tl.fromTo(t, { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.55 }, c.T(at));
        cue(c.T(at), "ding");
      });
      chips(c, [{ text: L("Dashboard", "ড্যাশবোর্ড") }, { text: L("Messenger app", "Messenger অ্যাপ") }, { text: "Business Suite" }, { text: L("WhatsApp on your phone", "ফোনের WhatsApp") }], { x: 110, y: 640, at: 15.0, stagger: 0.3, width: 480 });
      const mem = el(`<div class="chip gold" style="position:absolute;left:110px;top:800px;font-size:21px">${ico("bolt", 22, "#3A2A06")}${L("Remembers what you said — never contradicts your price", "আপনার কথা মনে রাখে — আপনার দামের উল্টো বলে না")}</div>`);
      c.content.append(mem);
      c.tl.fromTo(mem, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 }, c.T(20.4));
      cue(c.T(20.4), "chime");
    },

    grow(c) {
      headline(c, { x: 110, y: 110, w: 620, size: 52, sub: false });
      const lp = laptop(c, "broadcast", { x: 700, y: 200, w: 1140 });
      lp.callout([150, 138, 1130, 240], L("Your message", "আপনার মেসেজ"), 1.6, { hide: 4.2, pos: "below" });
      lp.callout([150, 288, 1130, 349], L("Channel · last active · order history · tag", "চ্যানেল · কখন লিখেছে · অর্ডার · ট্যাগ"), 4.4, { hide: 9.6, pos: "below" });
      lp.callout([150, 365, 435, 403], L("Check who will get it, then send", "কে পাবে দেখুন, তারপর পাঠান"), 7.6, { hide: 11.0, pos: "below" });
      lp.callout([131, 477, 1149, 666], L("148 sent · 3 failed · 22 skipped", "১৪৮ গেল · ৩ ব্যর্থ · ২২ বাদ"), 11.2, { hide: 14.6, pos: "below" });
      const ring = el(`<div class="chip gold" style="position:absolute;left:110px;top:330px;font-size:20px">${ico("clock", 22, "#3A2A06")}${L("Inside Meta's 24-hour window — your Page stays safe", "Meta-র ২৪ ঘণ্টার ভেতরে — পেজ নিরাপদ")}</div>`);
      c.content.append(ring);
      c.tl.fromTo(ring, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 }, c.T(9.2));
      cue(c.T(9.2), "pop");
      const fu = el(`<div style="position:absolute;left:110px;top:460px;width:560px"><div class="eyebrow"><i></i>${L("Follow-ups", "ফলো-আপ")}</div><div class="fu1 chip" style="margin-top:16px">${ico("clock", 22)}${L("20 hours later, no reply…", "২০ ঘণ্টা পরেও উত্তর নেই…")}</div><div class="fu2 b bot" style="display:block;margin-top:14px;font-size:18px;max-width:100%">${L("Still thinking about the navy panjabi? It's in stock in M and L 🙂", "নেভি পাঞ্জাবিটা নিয়ে এখনো ভাবছেন? M আর L-এ আছে 🙂")}</div><div class="fu3 chip mint" style="margin-top:14px">${ico("check", 22, "#0B7A5D")}${L("Your words · your hour · one per customer a month", "আপনার কথা · আপনার সময় · কাস্টমারপ্রতি মাসে একটা")}</div></div>`);
      c.content.append(fu);
      c.tl.fromTo(fu.querySelector(".eyebrow"), { opacity: 0 }, { opacity: 1, duration: 0.4 }, c.T(14.2));
      c.tl.fromTo(fu.querySelector(".fu1"), { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.5 }, c.T(14.6));
      c.tl.fromTo(fu.querySelector(".fu2"), { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.8)" }, c.T(16.4));
      c.tl.fromTo(fu.querySelector(".fu3"), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5 }, c.T(18.6));
      cue(c.T(14.6), "pop"); cue(c.T(16.4), "swoosh"); cue(c.T(18.6), "chime");
    },

    analytics(c) {
      headline(c, { x: 110, y: 104, w: 1300, size: 48, sub: false });
      const lp = laptop(c, "analytics", { x: 380, y: 300, w: 1300, h: 660, tilt: -3 });
      lp.zoom(1.06, 1.0, 12, 40, 20);
      lp.callout([131, 83, 1149, 211], L("Messages · customers · conversations · bot resolved · revenue", "মেসেজ · কাস্টমার · কথোপকথন · বট সামলাল · আয়"), 1.4, { hide: 5.4 });
      lp.callout([752, 83, 941, 211], L("81% resolved by the bot alone", "৮১% বট একাই সামলেছে"), 5.8, { hide: 8.6, pos: "below" });
      lp.panTo(140, 8.2);
      lp.callout([131, 230, 1149, 442], L("Message volume, day by day", "দিনে দিনে মেসেজ"), 8.8, { hide: 11.4 });
      lp.callout([650, 461, 1149, 717], L("New vs returning · photos · voice notes", "নতুন বনাম পুরনো · ছবি · ভয়েস"), 11.6, { pos: "below" });
      chips(c, [{ icon: "clock", text: L("Busiest hours", "ব্যস্ততম সময়") }, { icon: "chart-bar", text: L("Channels", "চ্যানেল") }, { icon: "message-2", text: L("What they ask about", "কী নিয়ে জিজ্ঞেস করে") }], { x: 110, y: 230, at: 12.4, stagger: 0.3 });
    },

    website(c) {
      headline(c, { x: 110, y: 104, w: 1100, size: 48, sub: false });
      const lp = laptop(c, "website-widget", { x: 80, y: 300, w: 860, h: 400, tilt: 5 });
      lp.callout([150, 154, 1130, 195], L("One line of code", "এক লাইন কোড"), 1.8, { hide: 6.5, pos: "below" });
      const site = el(`<div class="site" style="left:1060px;top:300px;width:760px;height:470px"><div class="sb"></div><div class="ln" style="width:300px"></div><div class="ln" style="width:520px"></div><div class="ln" style="width:420px"></div><div style="display:flex;gap:16px;margin:24px 22px"><div style="flex:1;height:150px;border-radius:12px;background:#F3EEF1"></div><div style="flex:1;height:150px;border-radius:12px;background:#F3EEF1"></div><div style="flex:1;height:150px;border-radius:12px;background:#F3EEF1"></div></div><div class="wbtn">${ico("message-2", 28, "#fff")}</div><div class="wpanel"><div class="wh">${ico("message-2", 18, "#fff")}${L("Chat with us", "আমাদের সাথে কথা বলুন")}</div><div class="wm">${L("Hi! Ask me anything about our products 🙂", "হাই! পণ্য নিয়ে যা খুশি জিজ্ঞেস করুন 🙂")}</div><div class="wm me">${L("Do you ship to Sylhet?", "সিলেটে পাঠান?")}</div><div class="wm">${L("Yes — 2–3 days, ৳120.", "জি — ২–৩ দিন, ৳১২০।")}</div></div></div>`);
      c.content.append(site);
      c.tl.fromTo(site, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.8 }, c.T(0.8));
      const btn = site.querySelector(".wbtn"), panel = site.querySelector(".wpanel");
      c.tl.fromTo(btn, { scale: 0 }, { scale: 1, duration: 0.5, ease: "back.out(2)" }, c.T(3.6)); cue(c.T(3.6), "pop");
      c.tl.set(panel, { opacity: 0, scale: 0.6 }, c.T(0));
      c.tl.to(panel, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.6)" }, c.T(5.2)); cue(c.T(5.2), "swoosh");
      c.tl.fromTo(panel.querySelectorAll(".wm"), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.7 }, c.T(5.7));
      chips(c, [{ icon: "language", text: L("Dashboard: English / বাংলা", "ড্যাশবোর্ড: English / বাংলা") }, { icon: "key", text: L("Your own AI key → lower price", "নিজের AI কী → দাম কম") }, { icon: "device-mobile", text: L("Android app — inbox & alerts in your pocket", "Android অ্যাপ — ইনবক্স ও সতর্কতা পকেটে") }], { x: 110, y: 800, at: 9.0, stagger: 3.0 });
    },

    pricing(c) {
      headline(c, { x: 110, y: 104, w: 1400, size: lang === "bn" ? 40 : 44, sub: false });
      const check = ico("check", 16, "currentColor", 2.4);
      const plans = script.brand && [
        { biz: "shop", nm: "Shop Basic", price: "৳2,699", byok: "৳1,999", feats: L(["2,000 bot replies / month", "2 channels + website widget", "500 products added / month", "100 AI Assistant questions"], ["২,০০০ বট-উত্তর / মাস", "২ চ্যানেল + ওয়েবসাইট উইজেট", "৫০০ পণ্য যোগ / মাস", "১০০ AI Assistant প্রশ্ন"]) },
        { biz: "shop", nm: "Shop Pro", hl: true, price: "৳5,999", byok: "৳4,499", feats: L(["5,500 bot replies / month", "All 3 channels + widget", "1,000 products added / month", "400 AI Assistant questions"], ["৫,৫০০ বট-উত্তর / মাস", "৩ চ্যানেলই + উইজেট", "১,০০০ পণ্য যোগ / মাস", "৪০০ AI Assistant প্রশ্ন"]) },
        { biz: "shop", nm: "Shop Enterprise", price: "৳11,999", byok: "৳8,999", feats: L(["12,000 bot replies / month", "All 3 channels + widget", "2,500 products added / month", "Priority support · custom limits"], ["১২,০০০ বট-উত্তর / মাস", "৩ চ্যানেলই + উইজেট", "২,৫০০ পণ্য যোগ / মাস", "অগ্রাধিকার সহায়তা · নিজের সীমা"]) },
        { biz: "svc", nm: "Service Basic", price: "৳2,299", byok: "৳1,699", feats: L(["2,000 bot replies / month", "2 channels + website widget", "20 documents added / month", "100 AI Assistant questions"], ["২,০০০ বট-উত্তর / মাস", "২ চ্যানেল + ওয়েবসাইট উইজেট", "২০ নথি যোগ / মাস", "১০০ AI Assistant প্রশ্ন"]) },
        { biz: "svc", nm: "Service Pro", hl: true, price: "৳4,999", byok: "৳3,499", feats: L(["5,500 bot replies / month", "All 3 channels + widget", "60 documents added / month", "400 AI Assistant questions"], ["৫,৫০০ বট-উত্তর / মাস", "৩ চ্যানেলই + উইজেট", "৬০ নথি যোগ / মাস", "৪০০ AI Assistant প্রশ্ন"]) },
        { biz: "svc", nm: "Service Enterprise", price: "৳9,999", byok: "৳7,499", feats: L(["12,000 bot replies / month", "All 3 channels + widget", "150 documents added / month", "Priority support · custom limits"], ["১২,০০০ বট-উত্তর / মাস", "৩ চ্যানেলই + উইজেট", "১৫০ নথি যোগ / মাস", "অগ্রাধিকার সহায়তা · নিজের সীমা"]) },
      ];
      const trial = el(`<div class="plan" style="left:110px;top:268px;width:280px"><div class="nm">${L("Free trial", "ফ্রি ট্রায়াল")}</div><div class="pr">${L("Free", "ফ্রি")}<small> · ${L("3 days", "৩ দিন")}</small></div><ul><li>${check}${L("Every feature switched on", "সব ফিচার চালু")}</li><li>${check}${L("30 bot replies a day", "দিনে ৩০টা বট-উত্তর")}</li><li>${check}${L("1 channel of your choice", "১টা চ্যানেল")}</li><li>${check}${L("No card needed", "কার্ড লাগে না")}</li></ul></div>`);
      c.content.append(trial);
      c.tl.fromTo(trial, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.7 }, c.T(0.8));
      cue(c.T(0.8), "pop");
      const tabs = el(`<div style="position:absolute;left:430px;top:206px;display:flex;gap:6px;padding:5px;border-radius:14px;background:#fff;border:1px solid var(--line)"><span class="tb chip m" style="font-size:17px;padding:9px 20px;box-shadow:none">${L("For shops", "দোকানের জন্য")}</span><span class="tb chip" style="font-size:17px;padding:9px 20px;box-shadow:none;border-color:transparent">${L("For services", "সেবার জন্য")}</span></div>`);
      c.content.append(tabs);
      c.tl.fromTo(tabs, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.5 }, c.T(1.4));
      const [tbA, tbB] = tabs.querySelectorAll(".tb");
      const cards = plans.map((p, i) => {
        const col = i % 3;
        const card = el(`<div class="plan${p.hl ? " hl" : ""}" style="left:${430 + col * 325}px;top:${268 + (p.hl ? -14 : 0)}px;width:305px">${p.hl ? `<span class="badge">${L("Most popular", "সবচেয়ে জনপ্রিয়")}</span>` : ""}<div class="nm">${p.nm}</div><div class="pr">${p.price}<small>/${L("mo", "মাস")}</small></div><div style="font-size:14px;opacity:.8">${L("with your own AI key", "নিজের AI কী থাকলে")} <b>${p.byok}</b></div><ul>${p.feats.map((f) => `<li>${check}${f}</li>`).join("")}</ul></div>`);
        c.content.append(card);
        return card;
      });
      cards.slice(0, 3).forEach((card, i) => { c.tl.fromTo(card, { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.7 }, c.T(2.0 + i * 0.35)); cue(c.T(2.0 + i * 0.35), "pop"); });
      cards.slice(3).forEach((card) => c.tl.set(card, { opacity: 0 }, c.T(0)));
      // switch to services
      const SW = 11.8;
      c.tl.to(cards.slice(0, 3), { opacity: 0, x: -40, duration: 0.45, stagger: 0.08, ease: "power2.in" }, c.T(SW));
      c.tl.fromTo(cards.slice(3), { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.6, stagger: 0.1 }, c.T(SW + 0.45));
      c.tl.to(tbA, { backgroundColor: "#ffffff", color: "#121116", borderColor: "transparent", duration: 0.3 }, c.T(SW));
      c.tl.to(tbB, { backgroundColor: "#7B1C3E", color: "#ffffff", duration: 0.3 }, c.T(SW));
      cue(c.T(SW), "swoosh");
      chips(c, [{ icon: "check", text: L("Every plan has every feature", "প্রতিটা প্যাকেজে সব ফিচার"), cls: "mint" }, { icon: "calendar-event", text: L("Yearly = 2 months free", "বছরে নিলে ২ মাস ফ্রি") }, { icon: "key", text: L("Own AI key → lower price", "নিজের AI কী → দাম কম") }, { text: "bKash · Nagad · " + L("card", "কার্ড") }, { icon: "tag", text: L("Launch prices until 31 Dec 2026", "লঞ্চ দাম, ৩১ ডিসেম্বর ২০২৬ পর্যন্ত"), cls: "gold" }], { x: 110, y: 760, at: 15.0, stagger: 1.9, width: 1700 });
    },

    outro(c) {
      const st = makeStage(c.content);
      const logo = logoProto.clone(); logo.position.set(-430, 40, 0); st.scene.add(logo);
      const t0 = c.t0, D = c.D;
      frames3d.push({ from: t0 - 0.5, to: t0 + D + 1, fn(t) {
        const s = t - t0; const intro = ease.outCubic(Math.min(1, s / 1.4));
        logo.scale.setScalar(0.9 * intro); logo.rotation.y = -0.6 + 0.6 * intro + 0.35 * Math.sin(s * 0.45); logo.rotation.x = 0.1 * Math.sin(s * 0.5);
        logo.position.y = 40 + 12 * Math.sin(s * 0.8);
        st.render();
      } });
      const right = el(`<div style="position:absolute;left:1000px;top:200px;width:860px"><div class="eyebrow"><i></i>${L("Start today", "আজই শুরু করুন")}</div><div class="url" style="font-weight:900;font-size:78px;letter-spacing:-.04em;margin-top:14px;color:#F2EEF1">tellmoreai.com</div><div class="cta" style="margin-top:26px">${ico("bolt", 26, "#7B1C3E")}${L("Start your free trial — 3 days, no card", "ফ্রি ট্রায়াল শুরু করুন — ৩ দিন, কার্ড লাগে না")}</div><div class="auto" style="margin-top:40px;display:flex;align-items:center;gap:14px;font-size:22px;color:#B5ADB4"><span class="chip m">${ico("building-store", 20, "#fff")}${L("An Autolinium product", "একটি Autolinium পণ্য")}</span>${L("built in Chattogram, Bangladesh", "চট্টগ্রাম, বাংলাদেশে তৈরি")}</div><div class="cts" style="margin-top:30px;display:grid;gap:16px"><div class="contact"><span class="ic">${ico("world", 24)}</span>${script.company.url}</div><div class="contact"><span class="ic">${ico("mail", 24)}</span>${script.company.email}</div><div class="contact"><span class="ic">${ico("phone", 24)}</span>${script.company.phone}</div><div class="contact" style="font-size:19px;color:#B5ADB4"><span class="ic">${ico("map-pin", 24)}</span>${script.company.address}</div></div></div>`);
      c.content.append(right);
      c.tl.fromTo(right.querySelector(".eyebrow"), { opacity: 0 }, { opacity: 1, duration: 0.5 }, c.T(0.6));
      c.tl.fromTo(right.querySelector(".url"), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8 }, c.T(0.9));
      c.tl.fromTo(right.querySelector(".cta"), { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.6)" }, c.T(1.8));
      c.tl.fromTo(right.querySelector(".auto"), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6 }, c.T(3.2));
      c.tl.fromTo(right.querySelectorAll(".contact"), { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: 0.55, stagger: 0.5 }, c.T(6.0));
      cue(c.T(0.9), "chime"); cue(c.T(1.8), "pop"); [6, 6.5, 7, 7.5].forEach((x) => cue(c.T(x), "click"));
      const tag = el(`<div style="position:absolute;left:110px;top:900px;font-size:30px;font-weight:700;color:#F2EEF1;letter-spacing:-.01em">${c.text.title} <span style="color:#E08BA6">${L("You handle the growth.", "আপনি সামলান ব্যবসার বৃদ্ধি।")}</span></div>`);
      c.content.append(tag);
      c.tl.fromTo(tag, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7 }, c.T(D - 7));
      c.tl.to(c.content, { opacity: 0, duration: 1.2, ease: "power2.in" }, c.T(D - 1.3));
      c.tl.to("#chrome, #progWrap", { opacity: 0, duration: 0.8 }, c.T(D - 1.3));
    },
  };

  // ── assemble ─────────────────────────────────────────────────────────────
  gsap.set("#blobA", { width: 900, height: 900, left: 1200, top: -400, background: "rgba(123,28,62,.16)" });
  gsap.set("#blobB", { width: 800, height: 800, left: -300, top: 600, background: "rgba(192,74,114,.10)" });
  tl.to("#blobA", { x: -260, y: 200, duration: total / 4, ease: "sine.inOut", repeat: 3, yoyo: true }, 0);
  tl.to("#blobB", { x: 300, y: -180, duration: total / 3, ease: "sine.inOut", repeat: 2, yoyo: true }, 0);
  tl.fromTo("#prog", { scaleX: 0 }, { scaleX: 1, duration: total, ease: "none" }, 0);

  scenes.forEach((sc, i) => {
    const section = el(`<section class="scene${DARK.has(sc.template) ? " dark" : ""}" data-id="${sc.id}"><div class="content"></div></section>`);
    scenesRoot.append(section);
    const ctx = { i, sc, text: sc.text, t0: sc.t0, D: sc.D, tl, cue, content: section.querySelector(".content"), T: (x) => sc.t0 + x };
    const dark = DARK.has(sc.template);
    const B = sc.t0;
    tl.set(section, { autoAlpha: 1 }, B);
    if (i < scenes.length - 1) tl.set(section, { autoAlpha: 0 }, sc.t0 + sc.D);
    tl.set("#stage", { backgroundColor: dark ? "#121116" : "#F7F5F7", color: dark ? "#F2EEF1" : "#121116" }, B);
    tl.set("#bgDark", { autoAlpha: dark ? 1 : 0 }, B);
    tl.set("#blobA, #blobB", { opacity: dark ? 0 : 1 }, B);
    tl.set("#count", { textContent: `${String(i + 1).padStart(2, "0")} / ${scenes.length}` }, B);
    if (i > 0) {
      // Explicit sets around the sweep, so the panel is parked off-screen at
      // every other time no matter which way the playhead came from.
      const dir = i % 2 ? 1 : -1;
      tl.set("#wipe", { xPercent: -140 * dir }, B - 0.4);
      tl.to("#wipe", { xPercent: 140 * dir, duration: 0.8, ease: "power2.inOut" }, B - 0.4);
      tl.set("#wipe", { xPercent: -140 }, B + 0.41);
      cue(B - 0.34, "whoosh");
      const prev = scenesRoot.children[i - 1].querySelector(".content");
      tl.to(prev, { scale: 0.96, opacity: 0.5, duration: 0.4, ease: "power2.in" }, B - 0.4);
      tl.fromTo(ctx.content, { scale: 1.04 }, { scale: 1, duration: 0.7, ease: "power3.out" }, B);
    }
    if (i === 2) tl.fromTo("#chrome", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8 }, B + 0.3);
    build[sc.template](ctx);
  });

  // Fonts, images and the 3D warm-up must all be ready before the first frame.
  await document.fonts.ready;
  await Promise.all([...document.images].map((im) => im.complete ? Promise.resolve() : new Promise((r) => { im.onload = r; im.onerror = r; })));
  await Promise.all([...document.images].map((im) => im.decode?.().catch(() => {})));

  window.__seek = (t) => {
    tl.seek(t, false);
    drawParticles(t);
    for (const f of frames3d) if (t >= f.from && t <= f.to) f.fn(t);
  };
  window.__scenes = scenes.map((s) => ({ id: s.id, t0: +s.t0.toFixed(3), D: +s.D.toFixed(3) }));
  window.__cues = cues.filter((c) => c.t >= 0 && c.t < total);
  window.__vo = vo;
  window.__total = total;
  window.__seek(0);
  window.__ready = true;
} catch (e) {
  console.error(e);
  window.__error = String(e && e.stack || e);
}
