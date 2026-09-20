"use client";
// First launch of the installed app: ask for every permission it needs, one
// after another, the way a real app does — notifications (and register the
// device for push the moment it is granted), camera + photos, microphone,
// location. Runs once per install (a localStorage flag), never in a browser.
import { isNativeApp, enableNativePush } from "./native-push.js";

const DONE_KEY = "gv_native_perms_v1";

export async function requestAllNativePermissions() {
  if (!isNativeApp()) return;
  try { if (localStorage.getItem(DONE_KEY) === "done") return; } catch {}
  const P = (window.Capacitor && window.Capacitor.Plugins) || {};

  // 1. Notifications — the OS prompt, then the FCM token is saved (see
  //    native-push.js), so push works with no further step from the owner.
  try { await enableNativePush(); } catch {}

  // 2. Camera + photos (product photo uploads).
  try {
    if (P.Camera && P.Camera.requestPermissions) await P.Camera.requestPermissions({ permissions: ["camera", "photos"] });
  } catch {}

  // 3. Location.
  try {
    if (P.Geolocation && P.Geolocation.requestPermissions) await P.Geolocation.requestPermissions();
  } catch {}

  // 4. Microphone — the WebView raises the RECORD_AUDIO prompt on the first audio
  //    capture; open and immediately release it so the prompt shows now.
  try {
    // The app records voice with the phone's own recorder (the VoiceRecorder
    // plugin), so that is the permission to ask for; an older APK without the
    // plugin still gets the WebView's prompt.
    if (P.VoiceRecorder && P.VoiceRecorder.requestAudioRecordingPermission) await P.VoiceRecorder.requestAudioRecordingPermission();
    else if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
    }
  } catch {}

  try { localStorage.setItem(DONE_KEY, "done"); } catch {}
}
