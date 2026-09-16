"use client";
// The Android hardware/gesture back button, inside the installed app. Without
// this Capacitor drops the owner straight out of the app on the first back press.
// Now: if there is somewhere to go back to (a previous tab, an open drawer), go
// there; only at the very first screen does it ask before exiting — the way a
// real app behaves. All no-ops in a browser.
import { isNativeApp, initNativePush } from "./native-push.js";
import { requestAllNativePermissions } from "./native-permissions.js";

let _inited = false;

export function initNativeBack() {
  if (_inited || !isNativeApp()) return;
  const App = window.Capacitor?.Plugins?.App;
  if (!App) return;
  _inited = true;
  App.addListener("backButton", async ({ canGoBack }) => {
    // Somewhere to go back to — the shell keeps one history entry per tab and its
    // drawers push one when they open, so this returns to the previous tab or
    // closes the open drawer (via the shell's own popstate handler).
    if (canGoBack) { try { window.history.back(); } catch {} return; }

    // At the root: confirm before leaving, with a native dialog. Cancel keeps the
    // owner in the app; only Exit closes it. If the dialog is unavailable for any
    // reason, do nothing rather than hard-exit.
    const Dialog = window.Capacitor?.Plugins?.Dialog;
    if (!Dialog) return;
    try {
      const { value } = await Dialog.confirm({
        title: "Exit TellMore AI",
        message: "Do you want to exit the app?",
        okButtonTitle: "Exit",
        cancelButtonTitle: "Cancel",
      });
      if (value) App.exitApp();
    } catch { /* leave the owner in the app on any dialog error */ }
  });
}

// One call the dashboard shell makes on mount to wire everything the native app
// needs — the back button, push tap-navigation, and (first launch only) the
// permission prompts. Inert in a browser.
export function initNativeApp() {
  try {
    initNativeBack();
    initNativePush();
    requestAllNativePermissions().catch(() => {});
  } catch { /* never break the shell */ }
}
