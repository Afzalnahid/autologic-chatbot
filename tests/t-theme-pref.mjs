// The app follows the phone's light/dark mode. It did not: one tap on the moon
// was saved for ever, so a phone that went dark at sunset kept a white app
// (owner's report, 2026-09-21). The rule is in src/lib/theme-pref.js — a choice
// stands only while the device stays in the mode it was made under — and the
// same rule is hand-written in the inline boot script, which is checked here
// too, because a script that cannot import is the copy that drifts.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const { resolveTheme, toggleTheme, THEME_KEY, THEME_SYS_KEY } =
  await import(pathToFileURL(join(root, "src", "lib", "theme-pref.js")).href);

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Following the device.
ok("nothing saved, dark phone → dark", same(resolveTheme({ saved: null, savedSys: null, system: "dark" }), { mode: "dark", keep: false }));
ok("nothing saved, light phone → light", same(resolveTheme({ saved: null, savedSys: null, system: "light" }), { mode: "light", keep: false }));
ok("an unknown device mode falls back to light", resolveTheme({ system: undefined }).mode === "light");

// A choice, and how long it lasts.
ok("chose dark on a light phone, phone still light → dark, kept",
  same(resolveTheme({ saved: "dark", savedSys: "light", system: "light" }), { mode: "dark", keep: true }));
ok("…then the phone goes dark at sunset → follow it, choice dropped",
  same(resolveTheme({ saved: "dark", savedSys: "light", system: "dark" }), { mode: "dark", keep: false }));
ok("chose light on a dark phone, phone goes light in the morning → light, choice dropped",
  same(resolveTheme({ saved: "light", savedSys: "dark", system: "light" }), { mode: "light", keep: false }));
ok("…and the next night the phone goes dark → the app goes dark (the old bug)",
  resolveTheme({ saved: null, savedSys: null, system: "dark" }).mode === "dark");

// Every install from before this rule has a bare "al-theme" and nothing beside it.
ok("an old-style saved 'light' on a dark phone is expired → dark",
  same(resolveTheme({ saved: "light", savedSys: null, system: "dark" }), { mode: "dark", keep: false }));
ok("an old-style saved 'dark' on a light phone is expired → light",
  same(resolveTheme({ saved: "dark", savedSys: null, system: "light" }), { mode: "light", keep: false }));
ok("rubbish in storage is ignored",
  same(resolveTheme({ saved: "blue", savedSys: "light", system: "light" }), { mode: "light", keep: false }) &&
  same(resolveTheme({ saved: "dark", savedSys: "purple", system: "light" }), { mode: "light", keep: false }));
ok("a choice equal to the device is not a choice", resolveTheme({ saved: "dark", savedSys: "dark", system: "dark" }).keep === false);

// The toggle.
ok("toggle away from the device stores the choice with the device mode",
  same(toggleTheme({ current: "light", system: "light" }), { mode: "dark", store: { saved: "dark", savedSys: "light" } }));
ok("toggle back to the device's own mode stores nothing — following again",
  same(toggleTheme({ current: "dark", system: "light" }), { mode: "light", store: null }));
ok("same on a dark phone",
  same(toggleTheme({ current: "dark", system: "dark" }), { mode: "light", store: { saved: "light", savedSys: "dark" } }) &&
  same(toggleTheme({ current: "light", system: "dark" }), { mode: "dark", store: null }));
{
  const t = toggleTheme({ current: "light", system: "light" });
  ok("what the toggle stores is what resolve keeps", same(resolveTheme({ ...t.store, system: "light" }), { mode: "dark", keep: true }));
}

// The hand-written copies. Run the boot script against a fake browser.
const landing = readFileSync(join(root, "src", "lib", "landing.js"), "utf8");
const boot = landing.slice(landing.indexOf("THEME_BOOT_JS = `") + "THEME_BOOT_JS = `".length);
const bootJs = boot.slice(0, boot.indexOf("`;"));
function runBoot(store, systemDark) {
  const html = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; } };
  const listeners = {};
  const mq = { matches: systemDark, addEventListener: (e, f) => { listeners.mq = f; } };
  const win = { matchMedia: () => mq, addEventListener() {} };
  const doc = { documentElement: html, readyState: "complete", getElementById: () => null, addEventListener: (e, f) => { listeners[e] = f; } };
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  new Function("window", "document", "localStorage", "setTimeout", bootJs)(win, doc, ls, () => {});
  return { html, mq, listeners, store };
}
ok("the keys in the boot script are the library's", bootJs.includes(`"${THEME_KEY}"`) && bootJs.includes(`"${THEME_SYS_KEY}"`));
ok("boot: nothing saved, dark phone → dark", runBoot({}, true).html.attrs["data-theme"] === "dark");
{
  const r = runBoot({ "al-theme": "light" }, true);
  ok("boot: an old-style saved 'light' on a dark phone → dark, and it is cleared",
    r.html.attrs["data-theme"] === "dark" && !("al-theme" in r.store));
}
ok("boot: a standing choice is honoured", runBoot({ "al-theme": "dark", "al-theme-sys": "light" }, false).html.attrs["data-theme"] === "dark");
{
  const r = runBoot({ "al-theme": "dark", "al-theme-sys": "light" }, false);
  r.mq.matches = true; r.listeners.mq();
  const afterSunset = r.html.attrs["data-theme"];
  r.mq.matches = false; r.listeners.mq();
  ok("boot: the phone changes mode with the page open → the page follows, both ways",
    afterSunset === "dark" && r.html.attrs["data-theme"] === "light" && !("al-theme" in r.store));
}
{
  const r = runBoot({}, false);
  const btn = { closest: (sel) => (sel === "#al-mode" ? {} : null) };
  r.listeners.click({ target: btn });
  const chose = { ...r.store }, shown = r.html.attrs["data-theme"];
  r.listeners.click({ target: btn });
  ok("boot: the toggle stores the choice with the device mode, and un-stores it on the way back",
    shown === "dark" && same(chose, { "al-theme": "dark", "al-theme-sys": "light" }) && same(r.store, {}) && r.html.attrs["data-theme"] === "light");
}

// The one-line copies on the login-result pages.
for (const p of [["src", "lib", "connect-page.js"], ["src", "app", "api", "fb", "callback", "route.js"],
  ["src", "app", "api", "wa", "callback", "route.js"], ["src", "app", "api", "wa", "embedded", "route.js"]]) {
  const src = readFileSync(join(root, ...p), "utf8");
  ok(`${p.at(-2)}/${p.at(-1)} checks the device mode beside the saved choice`, src.includes(`localStorage.getItem("al-theme-sys")===s`));
}
ok("the dashboard hook listens for the device changing mode",
  /addEventListener\("change", apply\)/.test(readFileSync(join(root, "src", "app", "dashboard", "components", "ui.js"), "utf8")));

console.log(`t-theme-pref: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
