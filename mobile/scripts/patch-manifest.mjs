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
//  5. System bars that follow the phone's light/dark mode. The web app inside
//     follows it (src/lib/theme-pref.js); without this the status bar above it
//     and the navigation bar below stayed the template's grey in both modes —
//     a light strip over a dark app. The bars take the page's own background
//     (#FCFCFD / #0B0B0E) with dark or light icons to match, from values/ and
//     values-night/, which Android reads when the app starts.
//  6. …and while the app is OPEN. The template lists uiMode in configChanges, so
//     the activity is not restarted when the phone flips to dark at sunset (a
//     restart would reload the page and lose the owner's place). The theme in
//     step 5 is therefore only read at launch; MainActivity repaints the bars
//     itself when the mode changes. The page follows on its own.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const path = "android/app/src/main/AndroidManifest.xml";
let xml = readFileSync(path, "utf8");
const done = [];

// ── 1. permissions ──────────────────────────────────────────────────────────
// TM_PERMS=notifications builds an app that asks Android for NOTHING but
// notifications. The ADMIN app sets it (2026-09-24): the console never takes a
// photo, records a voice note, reads the gallery or asks where the phone is, and
// the owner saw Camera / Location / Microphone / Storage listed against it in
// Android's settings — permissions it inherited from the user app's list and
// would never use. An app should ask for what it uses and nothing else.
const NOTIFY_ONLY = process.env.TM_PERMS === "notifications";
const wanted = NOTIFY_ONLY ? [
  "android.permission.POST_NOTIFICATIONS",
] : [
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
if (!NOTIFY_ONLY && !xml.includes("READ_EXTERNAL_STORAGE")) {
  lines.push('    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />');
}
if (lines.length) {
  if (!/<\/manifest>\s*$/.test(xml)) throw new Error("AndroidManifest.xml: closing </manifest> not found");
  xml = xml.replace(/<\/manifest>\s*$/, lines.join("\n") + "\n</manifest>\n");
}
done.push(`${lines.length} permission(s)`);

// ── 2. tellmoreai:// opens the app ──────────────────────────────────────────
// TM_APP_SCHEME lets the admin app claim its own address (2026-09-24): two apps
// registering the SAME scheme makes Android ask the person which one to open,
// every time. The user app keeps "tellmoreai" — that is the address the channel
// and calendar logins already come back to, and changing it would break them.
const SCHEME = process.env.TM_APP_SCHEME || "tellmoreai";
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

// ── 5. system bars follow light / dark ──────────────────────────────────────
const res = "android/app/src/main/res";
const stylesPath = `${res}/values/styles.xml`;
let styles = readFileSync(stylesPath, "utf8");
if (!styles.includes("@color/tm_bar")) {
  // The activity's theme. It must be a DayNight theme: that is also what makes
  // the WebView report the phone's mode to the page (prefers-color-scheme).
  const open = /<style name="AppTheme\.NoActionBar" parent="([^"]+)">/.exec(styles);
  if (!open) throw new Error("styles.xml: AppTheme.NoActionBar not found");
  if (!/DayNight/.test(open[1])) throw new Error(`styles.xml: AppTheme.NoActionBar is ${open[1]}, not a DayNight theme — the app could not follow the phone's dark mode`);
  const items = [
    '        <item name="android:statusBarColor">@color/tm_bar</item>',
    '        <item name="android:navigationBarColor">@color/tm_bar</item>',
    '        <item name="android:windowLightStatusBar">@bool/tm_light_bars</item>',
    '        <item name="android:windowLightNavigationBar">@bool/tm_light_bars</item>',
  ].join("\n");
  styles = styles.replace(open[0], open[0] + "\n" + items);
  writeFileSync(stylesPath, styles);
  done.push("system bars");
}
const bars = (color, light) => `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="tm_bar">${color}</color>\n    <bool name="tm_light_bars">${light}</bool>\n</resources>\n`;
mkdirSync(`${res}/values-night`, { recursive: true });
writeFileSync(`${res}/values/tm_bars.xml`, bars("#FCFCFD", true));
writeFileSync(`${res}/values-night/tm_bars.xml`, bars("#0B0B0E", false));

// ── 6. the bars follow a mode change while the app is open ──────────────────
const find = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? find(p) : n === "MainActivity.java" ? [p] : []; });
const activities = find("android/app/src/main/java");
if (activities.length !== 1) throw new Error(`MainActivity.java: expected one, found ${activities.length}`);
let java = readFileSync(activities[0], "utf8");
if (!java.includes("applyBars")) {
  const pkg = /^package\s+([\w.]+);/m.exec(java);
  if (!pkg) throw new Error("MainActivity.java: no package line");
  // Only the untouched template is replaced — anything else is someone's work.
  if (!/public class MainActivity extends BridgeActivity\s*\{\s*\}/.test(java)) throw new Error("MainActivity.java is not Capacitor's empty template — merge applyBars() by hand");
  java = `package ${pkg[1]};

import android.content.res.Configuration;
import android.os.Bundle;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

// Written by mobile/scripts/patch-manifest.mjs (step 6): the status bar and the
// navigation bar take the page's background, light or dark with the phone.
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applyBars(getResources().getConfiguration());
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        applyBars(newConfig);
    }

    private void applyBars(Configuration config) {
        boolean night = (config.uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        int color = night ? 0xFF0B0B0E : 0xFFFCFCFD;
        Window window = getWindow();
        window.setStatusBarColor(color);
        window.setNavigationBarColor(color);
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(window, window.getDecorView());
        bars.setAppearanceLightStatusBars(!night);
        bars.setAppearanceLightNavigationBars(!night);
    }
}
`;
  writeFileSync(activities[0], java);
  done.push("bars follow a live mode change");
}
if (!/uiMode/.test(xml)) throw new Error("AndroidManifest.xml: uiMode is no longer in configChanges — a mode change would now restart the app and reload the page");

console.log("manifest: " + done.join(", "));
