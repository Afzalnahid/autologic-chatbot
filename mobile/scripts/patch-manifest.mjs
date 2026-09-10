// Declares the runtime permissions the app needs in the generated Android
// manifest. Without these Android shows "No permissions requested" and never
// prompts — so notifications (POST_NOTIFICATIONS on Android 13+), the camera and
// microphone for the web app's uploads/recordings, and location can never be
// granted. Runs in CI right after `npx cap add android`, from the mobile/ folder.
// Idempotent: a permission already present (e.g. declared by a plugin) is skipped.
import { readFileSync, writeFileSync } from "node:fs";

const path = "android/app/src/main/AndroidManifest.xml";
let xml = readFileSync(path, "utf8");

const wanted = [
  // Notifications (required on Android 13+ before any notification can show)
  'android.permission.POST_NOTIFICATIONS',
  // Camera + photos: product photo uploads from the dashboard
  'android.permission.CAMERA',
  'android.permission.READ_MEDIA_IMAGES',
  // Microphone (voice)
  'android.permission.RECORD_AUDIO',
  'android.permission.MODIFY_AUDIO_SETTINGS',
  // Location
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
];

const lines = wanted
  .filter((p) => !xml.includes(`"${p}"`))
  .map((p) => `    <uses-permission android:name="${p}" />`);

// Older Android (≤12) reads photos through the legacy storage permission.
if (!xml.includes("READ_EXTERNAL_STORAGE")) {
  lines.push('    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />');
}

if (lines.length) {
  if (!/<\/manifest>\s*$/.test(xml)) throw new Error("AndroidManifest.xml: closing </manifest> not found");
  xml = xml.replace(/<\/manifest>\s*$/, lines.join("\n") + "\n</manifest>\n");
  writeFileSync(path, xml);
}
console.log(`manifest: ${lines.length} permission(s) added`);
