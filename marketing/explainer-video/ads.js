// The short ads (40–60 s), built from the same helpers as the explainer. A
// builder here reads its words AND its timings from the scene object in the
// film's script.json, so a new ad is a new script under films/, not new code.
// Times are seconds from the start of the scene; text comes as {en, bn} pairs
// (and sub_en/sub_bn, price_en/… for secondary lines).
export function adBuilders(H) {
  const { el, ico, L, lang, headline, chips, laptop, phone, voiceNote, makeStage, makeCoin, glyph, logoProto, icons, frames3d, ease, cue, script } = H;
  const tx = (o, k = "") => (o && (o[k + lang] ?? o[k + "en"])) ?? "";
  const head = (c, d) => { const h = { ...d, ...(c.sc.head || {}) }; return headline(c, { x: h.x, y: h.y, w: h.w, size: h.size, sub: !!c.text.sub, at: h.at ?? 0.2, eyebrow: c.text.eyebrow }); };

  const chipGroup = (c, g) => chips(c, g.items.map((it) => ({ icon: it.icon, cls: it.cls || "", text: tx(it) })), { x: g.x ?? 110, y: g.y ?? 700, at: g.at ?? 1, stagger: g.stagger ?? 0.3, width: g.width, dir: g.dir || "row" });
  const chipGroups = (c, g) => (Array.isArray(g) ? g : g ? [g] : []).forEach((x) => chipGroup(c, x));

  function tiles(c, g) {
    if (!g) return;
    const cols = g.cols ?? 2, w = g.w ?? 340, gx = g.gx ?? 20, gy = g.gy ?? 104;
    g.items.forEach((it, i) => {
      const t = el(`<div class="tile" style="position:absolute;left:${(g.x ?? 110) + (i % cols) * (w + gx)}px;top:${(g.y ?? 290) + Math.floor(i / cols) * gy}px;width:${w}px"><span class="ic">${ico(it.icon || "check", 24)}</span><span style="font-size:${g.size ?? 20}px;line-height:1.3">${tx(it)}${it.sub_en ? `<small>${tx(it, "sub_")}</small>` : ""}</span></div>`);
      c.content.append(t);
      const at = c.T((g.at ?? 1) + i * (g.stagger ?? 0.8));
      c.tl.fromTo(t, { opacity: 0, y: 24, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: "back.out(1.5)" }, at);
      cue(at, "pop");
    });
  }

  function steps(c, g) {
    if (!g) return;
    g.items.forEach((it, i) => {
      const st = el(`<div class="step" style="position:absolute;left:${g.x ?? 110}px;top:${(g.y ?? 340) + i * (g.gy ?? 130)}px;width:${g.w ?? 600}px"><span class="n">${i + 1}</span><div><b>${tx(it)}</b><span>${tx(it, "sub_")}</span></div></div>`);
      c.content.append(st);
      const at = c.T((g.at ?? 0.8) + i * (g.gap ?? 3));
      c.tl.fromTo(st, { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.6 }, at);
      cue(at, "pop");
    });
  }

  function toast(c, g) {
    if (!g) return;
    const t = el(`<div class="toast" style="position:absolute;left:${g.x}px;top:${g.y}px;width:${g.w ?? 470}px"><span class="ic">${ico(g.icon || "bell", 22)}</span><div><b>${tx(g)}</b><span>${tx(g, "sub_")}</span></div></div>`);
    c.content.append(t);
    c.tl.fromTo(t, { opacity: 0, y: -30, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "back.out(1.6)" }, c.T(g.at));
    cue(c.T(g.at), "ding");
  }

  function feats(c, list, { x = 1060, y = 400, w = 760, gy = 100 } = {}) {
    (list || []).forEach((f, i) => {
      const r = el(`<div class="tile" style="position:absolute;left:${x}px;top:${y + i * gy}px;width:${w}px"><span class="ic">${ico(f.icon || "check", 24)}</span><span style="font-size:20px">${tx(f)}</span></div>`);
      c.content.append(r);
      c.tl.fromTo(r, { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.6 }, c.T(f.at));
      cue(c.T(f.at), "chime");
    });
  }

  return {
    // Dark. The clock, the questions raining in, the "sold" stamp near the end.
    adHook(c) {
      const clock = el(`<div class="mono" style="position:absolute;left:110px;top:150px;font-size:112px;font-weight:600;letter-spacing:-.02em;color:#F2EEF1;line-height:1">12:07<span style="font-size:36px;margin-left:16px;color:#E08BA6">AM</span></div>`);
      c.content.append(clock);
      c.tl.fromTo(clock, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8 }, c.T(0.15));
      headline(c, { x: 110, y: 420, w: 900, eyebrow: c.text.eyebrow || L("Tonight", "আজ রাতে"), at: 0.7 });
      const texts = L(["Dam koto?", "Is this in stock?", "Delivery to Cumilla?", "Size M ache?", "Hello? Anyone?", "Price please 🙏"],
                      ["দাম কত?", "স্টকে আছে?", "কুমিল্লায় ডেলিভারি?", "M সাইজ আছে?", "হ্যালো? কেউ আছেন?", "দামটা বলবেন 🙏"]);
      const icons4 = ["brand-messenger", "brand-instagram", "brand-whatsapp", "world"];
      texts.forEach((t, i) => {
        const b = el(`<div class="bub" style="left:${1000 + (i % 3) * 270 + (i % 2) * 40}px;top:-120px">${ico(icons4[i % 4], 20, "#E08BA6")} ${t}</div>`);
        c.content.append(b);
        const at = c.T(0.5 + i * 0.6), land = 560 + (i % 4) * 95 + Math.floor(i / 4) * 40;
        c.tl.fromTo(b, { y: 0, rotationX: -40, rotationZ: -8 + (i % 3) * 8, opacity: 0 }, { y: land, rotationX: 0, rotationZ: (i % 2 ? 3 : -3), opacity: 1, duration: 1.1, ease: "bounce.out" }, at);
        cue(at + 0.8, "pop");
      });
      const stamp = el(`<div class="stamp" style="left:1010px;top:340px">${L("Sold — by whoever answered first", "বিক্রি হলো — যে আগে উত্তর দিল, তার কাছে")}</div>`);
      c.content.append(stamp);
      const sAt = c.T(Math.max(5.2, c.D - 3.4));
      c.tl.fromTo(stamp, { opacity: 0, scale: 2.2, rotation: -14 }, { opacity: 1, scale: 1, rotation: -8, duration: 0.45, ease: "power4.in" }, sAt);
      cue(sAt + 0.4, "ding");
    },

    // Dark. The 3D logo with the four channel coins orbiting, docking into one inbox.
    adAnswer(c) {
      const st = makeStage(c.content);
      const logo = logoProto.clone(); logo.position.set(0, 40, 0); st.scene.add(logo);
      const coinDefs = [["brand-messenger", "#0084FF"], ["brand-instagram", "#E1306C"], ["brand-whatsapp", "#25D366"], ["world", "#7B1C3E"]];
      const coins = coinDefs.map(([n, col]) => { const co = makeCoin(glyph(icons[n], col), { rim: col, size: 64 }); st.scene.add(co); return co; });
      const t0 = c.t0, D = c.D;
      frames3d.push({ from: t0 - 0.5, to: t0 + D + 0.5, fn(t) {
        const s = t - t0;
        const intro = ease.outCubic(Math.min(1, s / 1.1));
        logo.scale.setScalar(0.62 * intro);
        logo.rotation.y = 0.18 * Math.sin(s * 0.7); logo.rotation.x = 0.08 * Math.sin(s * 0.5);
        const conv = ease.inOut(Math.min(1, Math.max(0, (s - (D - 3.4)) / 1.8)));
        coins.forEach((co, k) => {
          const a = s * 0.7 + k * Math.PI / 2 + 1;
          const rx = 560 * (1 - conv) + 120 * conv, rz = 170 * (1 - conv) + 60 * conv;
          co.position.set(Math.cos(a) * rx, 40 + Math.sin(a * 2) * 28 * (1 - conv) - 330 * conv, Math.sin(a) * rz + 40 * (1 - conv));
          co.rotation.z = 0.25 * Math.sin(s * 1.1 + k); co.rotation.y = 0.35 * Math.sin(s * 0.9 + k * 2);
          co.scale.setScalar(Math.max(0.001, intro * (1 - 0.7 * conv)));
        });
        st.render();
      } });
      headline(c, { x: 110, y: 700, w: 900, size: 56, at: 0.6, eyebrow: c.text.eyebrow || L("The answer", "সমাধান") });
      chips(c, [{ icon: "clock", text: "24/7" }, { text: "বাংলা" }, { text: "English" }, { text: "Banglish" }], { x: 1280, y: 120, at: 2.2, stagger: 0.22 });
      const tray = el(`<div style="position:absolute;left:760px;top:790px;width:400px;height:150px;border-radius:26px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;gap:12px;font-weight:700;font-size:26px;color:#F2EEF1;backdrop-filter:blur(6px)">${ico("mail", 30, "#E08BA6")}${L("One inbox", "একটা ইনবক্স")}</div>`);
      c.content.append(tray);
      c.tl.fromTo(tray, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.7 }, c.T(D - 3.0));
      c.tl.fromTo(tray, { boxShadow: "0 0 0 0 rgba(46,211,167,0)" }, { boxShadow: "0 0 0 18px rgba(46,211,167,0)", duration: 0.9, ease: "power2.out" }, c.T(D - 1.4));
      cue(c.T(D - 1.5), "chime");
    },

    // Light. A phone with a scripted exchange, feature tiles landing beside it.
    adChat(c) {
      head(c, { x: 1060, y: 150, w: 760, size: 54 });
      const pp = c.sc.phone || {};
      const p = phone(c, { x: pp.x ?? 560, y: pp.y ?? 120, name: pp.name ?? "Tasnim", channel: pp.channel ?? "Messenger", chIcon: pp.chIcon ?? "brand-messenger", scale: pp.scale ?? 1, at: 0.25 });
      for (const m of c.sc.chat || []) {
        if (m.k === "typing") p.typing(m.at, m.dur ?? 1.1);
        else if (m.k === "clear") p.clear(m.at);
        else if (m.k === "photo") p.bubble("me", `<div class="photo">${ico("photo", 40, "#fff")}</div><div style="margin-top:6px">${tx(m)}</div>`, m.at);
        else if (m.k === "voice") p.bubble("me", voiceNote(m.secs || "0:07"), m.at);
        else if (m.k === "card") { p.bubble("bot card", `<b style="font-size:16px">${tx(m)}</b>${m.sub_en ? `<div style="margin-top:6px;color:var(--soft)">${tx(m, "sub_")}</div>` : ""}`, m.at); cue(c.T(m.at + 0.1), "ding"); }
        else p.bubble(m.k, tx(m), m.at);
      }
      const f = c.sc.featsAt || {};
      feats(c, c.sc.feats, { x: f.x ?? 1060, y: f.y ?? 400, w: f.w ?? 760, gy: f.gy ?? 100 });
    },

    // Light. A real dashboard screen with callouts, plus any of: steps, tiles, chips, a toast.
    adScreen(c) {
      head(c, { x: 110, y: 120, w: 700, size: 52 });
      const w = c.sc.win || {};
      const lp = laptop(c, c.sc.shot, { x: w.x ?? 760, y: w.y ?? 200, w: w.w ?? 1080, h: w.h ?? 640, tilt: w.tilt ?? -6, at: w.at ?? 0.3 });
      for (const co of c.sc.callouts || []) lp.callout(co.r, tx(co), co.at, { hide: co.hide, pos: co.pos || "" });
      for (const pn of c.sc.pans || []) lp.panTo(pn.y, pn.at, pn.dur ?? 1.2);
      if (c.sc.zoom) lp.zoom(c.sc.zoom.scale, c.sc.zoom.at, c.sc.zoom.dur, c.sc.zoom.ox, c.sc.zoom.oy);
      steps(c, c.sc.steps); tiles(c, c.sc.tiles); chipGroups(c, c.sc.chips); toast(c, c.sc.toast);
    },

    // Light. Up to three price cards side by side, chips under them.
    adPrice(c) {
      head(c, { x: 110, y: 110, w: 1200, size: 52 });
      const check = ico("check", 16, "currentColor", 2.4);
      (c.sc.cards || []).forEach((p, i) => {
        // Larger type than the explainer's six-card grid: only three cards, and an ad is watched on a phone.
        const card = el(`<div class="plan${p.hl ? " hl" : ""}" style="left:${110 + i * 580}px;top:${320 + (p.hl ? -14 : 0)}px;width:540px;padding:30px 30px 26px">${p.hl ? `<span class="badge" style="font-size:14px;padding:6px 14px">${tx(p, "badge_")}</span>` : ""}<div class="nm" style="font-size:${lang === "bn" ? 19 : 15}px">${tx(p)}</div><div class="pr" style="font-size:56px">${tx(p, "price_")}<small style="font-size:18px"> ${tx(p, "small_")}</small></div><div style="font-size:17px;opacity:.85">${tx(p, "sub_")}</div><ul style="font-size:19px;gap:10px;margin-top:18px">${(p.feats || []).map((f) => `<li>${check}${tx(f)}</li>`).join("")}</ul></div>`);
        c.content.append(card);
        const at = c.T((c.sc.cardsAt ?? 0.8) + i * 0.4);
        c.tl.fromTo(card, { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.7 }, at); cue(at, "pop");
      });
      chipGroups(c, c.sc.chips);
    },

    // Dark. Logo, the site, the trial CTA, the Autolinium credit and contacts; fades to black.
    adOutro(c) {
      const st = makeStage(c.content);
      const logo = logoProto.clone(); logo.position.set(-430, 40, 0); st.scene.add(logo);
      const t0 = c.t0, D = c.D;
      frames3d.push({ from: t0 - 0.5, to: t0 + D + 1, fn(t) {
        const s = t - t0; const intro = ease.outCubic(Math.min(1, s / 1.2));
        logo.scale.setScalar(0.9 * intro); logo.rotation.y = -0.6 + 0.6 * intro + 0.35 * Math.sin(s * 0.45); logo.rotation.x = 0.1 * Math.sin(s * 0.5);
        logo.position.y = 40 + 12 * Math.sin(s * 0.8);
        st.render();
      } });
      const price = c.sc.price ? `<div class="price chip gold" style="margin-top:22px;font-size:22px">${ico("tag", 22, "#3A2A06")}${tx(c.sc.price)}</div>` : "";
      const right = el(`<div style="position:absolute;left:1000px;top:200px;width:860px"><div class="eyebrow"><i></i>${L("Start today", "আজই শুরু করুন")}</div><div class="url" style="font-weight:900;font-size:78px;letter-spacing:-.04em;margin-top:14px;color:#F2EEF1">tellmoreai.com</div><div class="cta" style="margin-top:26px">${ico("bolt", 26, "#7B1C3E")}${L("Start your free trial — 3 days, no card", "ফ্রি ট্রায়াল শুরু করুন — ৩ দিন, কার্ড লাগে না")}</div>${price}<div class="auto" style="margin-top:34px;display:flex;align-items:center;gap:14px;font-size:22px;color:#B5ADB4"><span class="chip m">${ico("building-store", 20, "#fff")}${L("An Autolinium product", "একটি Autolinium পণ্য")}</span>${L("built in Chattogram, Bangladesh", "চট্টগ্রাম, বাংলাদেশে তৈরি")}</div><div class="cts" style="margin-top:26px;display:grid;gap:14px"><div class="contact"><span class="ic">${ico("world", 24)}</span>${script.company.url}</div><div class="contact"><span class="ic">${ico("mail", 24)}</span>${script.company.email}</div><div class="contact"><span class="ic">${ico("phone", 24)}</span>${script.company.phone}</div></div></div>`);
      c.content.append(right);
      c.tl.fromTo(right.querySelector(".eyebrow"), { opacity: 0 }, { opacity: 1, duration: 0.5 }, c.T(0.4));
      c.tl.fromTo(right.querySelector(".url"), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8 }, c.T(0.6));
      c.tl.fromTo(right.querySelector(".cta"), { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.6)" }, c.T(1.4));
      if (price) c.tl.fromTo(right.querySelector(".price"), { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.5 }, c.T(2.0));
      c.tl.fromTo(right.querySelector(".auto"), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6 }, c.T(2.6));
      c.tl.fromTo(right.querySelectorAll(".contact"), { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: 0.55, stagger: 0.4 }, c.T(3.4));
      cue(c.T(0.6), "chime"); cue(c.T(1.4), "pop"); [3.4, 3.8, 4.2].forEach((x) => cue(c.T(x), "click"));
      const tag = el(`<div style="position:absolute;left:110px;top:900px;font-size:30px;font-weight:700;color:#F2EEF1;letter-spacing:-.01em">${c.text.title} <span style="color:#E08BA6">${c.text.sub || ""}</span></div>`);
      c.content.append(tag);
      c.tl.fromTo(tag, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7 }, c.T(Math.max(4.5, D - 5)));
      c.tl.to(c.content, { opacity: 0, duration: 1.2, ease: "power2.in" }, c.T(D - 1.3));
      c.tl.to("#chrome, #progWrap", { opacity: 0, duration: 0.8 }, c.T(D - 1.3));
    },
  };
}
