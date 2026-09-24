// Two apps, and the things that keep them apart.
//
// Owner, 2026-09-24: "my native app which is for users automatically converted
// to admin app — the admin app and the user app will be separated. There will
// be two separated apps, one is for user where the user notification comes, and
// an admin app where the admin panel notifications come."
//
// The separation lives in a handful of small facts spread over a Capacitor
// config, a Firebase config and a build workflow — the kind of thing that is
// quietly wrong for weeks and only shows up as "the app won't install" or
// "notifications never arrive". Each one is checked here instead.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (...p) => readFileSync(join(root, ...p), "utf8");
const json = (...p) => JSON.parse(read(...p));

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

const user = json("mobile", "capacitor.config.json");
const admin = json("mobile-admin", "capacitor.config.json");

// ── the two apps are actually two apps ─────────────────────────────────────
ok("the user app is com.tellmoreai.app", user.appId === "com.tellmoreai.app");
ok("the admin app is com.tellmoreai.admin", admin.appId === "com.tellmoreai.admin");
// Same package id would mean one app REPLACES the other on the phone.
ok("their package ids differ, so both install side by side", user.appId !== admin.appId);
ok("their names differ, so they can be told apart in the launcher", user.appName !== admin.appName);

// ── each opens its own half of the site ────────────────────────────────────
ok("the user app opens the dashboard", user.server.url === "https://www.tellmoreai.com/dashboard");
ok("the admin app opens the console", admin.server.url === "https://www.tellmoreai.com/admin");
ok("both go to the www host, which is the one that answers", [user, admin].every((c) => c.server.url.startsWith("https://www.tellmoreai.com/")));

// ── Firebase, or notifications never arrive ────────────────────────────────
// The Gradle plugin refuses to build unless the package being built has a
// client entry in this file, and a file from the wrong project would build and
// then simply never deliver anything.
{
  const path = ["mobile-admin", "google-services.json"];
  ok("the admin app has a Firebase config", existsSync(join(root, ...path)));
  if (existsSync(join(root, ...path))) {
    const g = json(...path);
    const pkgs = (g.client || []).map((c) => c?.client_info?.android_client_info?.package_name);
    ok("it lists the admin package", pkgs.includes("com.tellmoreai.admin"));

    // One Firebase project for both apps: that is why FIREBASE_SERVICE_ACCOUNT
    // on the server can send to either without a second service account.
    const u = json("mobile", "google-services.json");
    ok("both apps are in the SAME Firebase project",
      g.project_info.project_number === u.project_info.project_number &&
      g.project_info.project_id === u.project_info.project_id);
    ok("…which is the project the server sends from", g.project_info.project_id === "getvoicium");
  }
}

// ── the app address ────────────────────────────────────────────────────────
// Two apps claiming one scheme makes Android ask the person which to open,
// every time. The user app must keep "tellmoreai": the channel and calendar
// logins already come back to it.
{
  const patch = read("mobile", "scripts", "patch-manifest.mjs");
  ok("the scheme can be overridden per app", patch.includes("process.env.TM_APP_SCHEME"));
  ok("and defaults to the user app's, which must not change", patch.includes('|| "tellmoreai"'));
  const wf = read(".github", "workflows", "android-build-admin.yml");
  ok("the admin build sets its own scheme", /TM_APP_SCHEME:\s*tellmoreai-admin/.test(wf));
}

// ── the build ──────────────────────────────────────────────────────────────
{
  const wf = read(".github", "workflows", "android-build-admin.yml");
  ok("the admin app has its own workflow", /name:\s*Build Admin Android APK/.test(wf));
  ok("it is manual only, so a push never rebuilds an app", /workflow_dispatch/.test(wf) && !/on:\s*\n\s*push/.test(wf));
  ok("it builds from mobile-admin", /working-directory:\s*mobile-admin/.test(wf));
  ok("it signs with the same stable key, so updates install over each other", /mobile\/debug\.keystore/.test(wf));
  // The icon is drawn once, in the user app's generator, and only recoloured
  // here — two copies of the logo would drift apart.
  ok("the icon artwork comes from the one generator", /mobile\/scripts\/gen-assets\.mjs|scripts\/gen-assets\.mjs/.test(wf));
  ok("the admin icon is the deep shade of the brand maroon", /#5C1430/.test(wf));
  ok("and the user app's baked background is left out so that colour applies", /rm -f mobile-admin\/assets\/icon-background\.png/.test(wf));

  const userWf = read(".github", "workflows", "android-build.yml");
  ok("the two workflows produce differently named artifacts",
    /tellmoreai-admin-android-apk/.test(wf) && /name: tellmoreai-android-apk/.test(userWf));
}

// ── the admin app carries no client-only plugins ───────────────────────────
// The console never takes a photo, records a voice note or asks for a location,
// and a permission an app does not need is a permission it should not ask for.
{
  const p = json("mobile-admin", "package.json");
  const deps = Object.keys(p.dependencies || {});
  ok("no camera in the admin app", !deps.includes("@capacitor/camera"));
  ok("no voice recorder in the admin app", !deps.includes("capacitor-voice-recorder"));
  ok("no geolocation in the admin app", !deps.includes("@capacitor/geolocation"));
  ok("but it can receive notifications", deps.includes("@capacitor/push-notifications"));
  ok("and it can read its own package id, which is how it proves it is the admin app",
    deps.includes("@capacitor/app"));
}

console.log(`t-two-apps: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
