// Which theme to show: the device's, unless the person chose otherwise — and
// their choice lasts only while the device stays as it was when they chose.
//
// The old rule was "a saved choice wins for ever". One tap on the moon, months
// ago, and the app never followed the phone again: light at midnight on a phone
// that had gone dark (owner's report, 2026-09-21). Phones flip by themselves at
// sunset; a choice made at noon says nothing about what is wanted at night. So a
// choice is stored WITH the device mode it was made under, and it is dropped the
// moment the device moves on. A choice saved the old way (no device mode beside
// it) is treated as expired — that is what un-sticks every existing install.
//
// Pure, so tests/t-theme-pref.mjs can hold it. The same rule is written out by
// hand in src/lib/landing.js (an inline script that cannot import).

export const THEME_KEY = "al-theme";         // "light" | "dark" — the choice
export const THEME_SYS_KEY = "al-theme-sys"; // the device mode when it was made

const ok = (m) => m === "light" || m === "dark";

/** → { mode, keep }: what to show, and whether the saved choice still stands. */
export function resolveTheme({ saved, savedSys, system }) {
  const sys = ok(system) ? system : "light";
  if (ok(saved) && ok(savedSys) && savedSys === sys && saved !== sys) return { mode: saved, keep: true };
  return { mode: sys, keep: false };
}

/**
 * The toggle was pressed. → { mode, store }: `store` is what to save, or null
 * when the new mode is simply the device's own — then there is nothing to
 * remember and the app is back to following the device.
 */
export function toggleTheme({ current, system }) {
  const sys = ok(system) ? system : "light";
  const mode = current === "dark" ? "light" : "dark";
  return { mode, store: mode === sys ? null : { saved: mode, savedSys: sys } };
}
