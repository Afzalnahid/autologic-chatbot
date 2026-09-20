// Patches the Android manifest Capacitor generates. Runs in CI right after
// `npx cap add android`, from the mobile/ folder. Every step is idempotent, and
// a step that cannot find what it needs FAILS THE BUILD rather than shipping an
// app that silently lacks it.
//
//  1. Runtime permissions. Without them Android shows "No permissions
//     requested" and never prompts — notifications (Android 13+), camera and
//     photos for uploads, the microphone for voice messages, location.
//  2. The app's own address, tellmoreai://…  A channel or calendar login runs in
//     a browser sheet over the app (src/lib/app-return.js in the web repo) and
//     ends by redirecting to this address, which Android routes back to the
//     app. MainActivity is singleTask, so the running app receives it and the
//     sheet above it is closed.
//  3. No backup of app data. With allowBackup on, Android restores the
//     WebView's storage — the signed-in session — when the app is reinstalled,
//     so a "fresh install" opened already logged in (owner's report,
//     2026-09-21). Off, with extraction rules that exclude everything, a new
//     install always starts at the sign-in screen. Updating over the installed
//     app keeps the session, as every app does.
//  4. FCM's default notification small icon.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const path = "android/app/src/main/AndroidManifest.xml";
let xml = readFileSync(path, "utf8");
const done = [];

// ── 1. permissions ──────────────────────────────────────────────────────────
const wanted = [
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.CAMERA",
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.RECORD_AUDIO",
  "android.permission.MODIFY_AUDIO_SETTINGS",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_FINE_LOCATION",
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
}
done.push(`${lines.length} permission(s)`);

// ── 2. tellmoreai:// opens the app ──────────────────────────────────────────
const SCHEME = "tellmoreai";
if (!xml.includes(`android:scheme="${SCHEME}"`)) {
  if (!/<\/activity>/.test(xml)) throw new Error("AndroidManifest.xml: no <activity> to add the app address to");
  if (!/android:name="\.MainActivity"/.test(xml)) throw new Error("AndroidManifest.xml: MainActivity not found");
  const filter = [
    "            <intent-filter>",
    '                <action android:name="android.intent.action.VIEW" />',
    '                <category android:name="android.intent.category.DEFAULT" />',
    '                <category android:name="android.intent.category.BROWSABLE" />',
    `                <data android:scheme="${SCHEME}" />`,
    "            </intent-filter>",
  ].join("\n");
  // The first </activity> closes MainActivity — it is the first activity
  // Capacitor's template declares; checked, so a changed template fails loudly.
  const firstActivity = xml.slice(0, xml.indexOf("</activity>"));
  if (!/android:name="\.MainActivity"/.test(firstActivity)) throw new Error("AndroidManifest.xml: the first activity is not MainActivity");
  xml = xml.replace(/<\/activity>/, filter + "\n        </activity>");
  done.push("app address added");
}
if (!/android:launchMode="singleTask"/.test(xml)) throw new Error("AndroidManifest.xml: MainActivity is not singleTask — the app address would open a second copy of the app");

// ── 3. no backup, so a new install starts signed out ────────────────────────
if (!xml.includes("android:dataExtractionRules")) {
  const attrs = 'android:allowBackup="false" android:fullBackupContent="false" android:dataExtractionRules="@xml/data_extraction_rules"';
  if (/android:allowBackup="(true|false)"/.test(xml)) xml = xml.replace(/android:allowBackup="(true|false)"/, attrs);
  else if (/<application\b/.test(xml)) xml = xml.replace(/<application\b/, `<application ${attrs}`);
  else throw new Error("AndroidManifest.xml: <application> not found");
  const domains = ["root", "file", "database", "sharedpref", "external"].map((d) => `        <exclude domain="${d}" path="." />`).join("\n");
  mkdirSync("android/app/src/main/res/xml", { recursive: true });
  writeFileSync("android/app/src/main/res/xml/data_extraction_rules.xml",
    `<?xml version="1.0" encoding="utf-8"?>\n<data-extraction-rules>\n    <cloud-backup>\n${domains}\n    </cloud-backup>\n    <device-transfer>\n${domains}\n    </device-transfer>\n</data-extraction-rules>\n`);
  done.push("backup off");
}

// ── 4. notification small icon ──────────────────────────────────────────────
// Without it Android draws the app icon as the status-bar icon, which —
// flattened to a silhouette — becomes a white square; ic_stat_notify is the
// white-logo-on-transparent drawable CI drops in.
if (!xml.includes("com.google.firebase.messaging.default_notification_icon")) {
  const meta = '        <meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/ic_stat_notify" />';
  if (!/<\/application>/.test(xml)) throw new Error("AndroidManifest.xml: </application> not found");
  xml = xml.replace(/<\/application>/, meta + "\n    </application>");
  done.push("notification icon");
}

writeFileSync(path, xml);
console.log("manifest: " + done.join(", "));
