// Every feature switch a package can carry must be ENFORCED somewhere in the
// code, and the message a locked feature shows must name the package. Until
// 2026-09-18 the switches were display only — saved by the admin panel, shown
// in the dashboard, and never asked by the product — so a Starter shop got the
// photo matching that Growth pays for. This suite makes that impossible to
// repeat: a key added to FEATURE_DEFS without a gate call fails the build.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, extname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const { FEATURE_DEFS, FEATURE_KEYS, AREA_LABELS, gateMessage, featureOn, featureList } =
  await import(pathToFileURL(join(ROOT, "src", "lib", "features.js")).href + "?v=" + Date.now());

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

// ── The registry itself ──────────────────────────────────────────────────────
ok("thirteen switches, no duplicates", FEATURE_KEYS.length === 13 && new Set(FEATURE_KEYS).size === 13);
ok("every switch has a label, an area and a sentence saying what it stops",
  FEATURE_DEFS.every((d) => d.label && AREA_LABELS[d.area] && typeof d.what === "string" && d.what.length > 20));
ok("every switch names a business side or both", FEATURE_DEFS.every((d) => ["both", "ecommerce", "agency"].includes(d.biz)));

// ── Every key is enforced somewhere in src/ ──────────────────────────────────
// A gate is `featureGate(client, "<key>")` or `can(limits, "<key>")`.
const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) { if (!["node_modules", ".next"].includes(e)) walk(full); continue; }
    if ([".js", ".mjs"].includes(extname(e))) files.push(full);
  }
})(join(ROOT, "src"));
const source = files.map((f) => readFileSync(f, "utf8")).join("\n");
for (const key of FEATURE_KEYS) {
  // byok is granted per client by the super admin (client_ai row), which is
  // its gate; the package switch only prices it. Everything else must ask.
  if (key === "byok") { ok("byok is gated by the admin grant (client_ai)", source.includes('from("client_ai")')); continue; }
  const re = new RegExp(`(featureGate\\([^)]*,\\s*"${key}"\\)|can\\([^)]*,\\s*"${key}"\\))`);
  ok(`"${key}" has a gate in the code`, re.test(source));
}

// ── The verdict and its message ──────────────────────────────────────────────
const limits = { planName: "Shop Starter", features: { vision: false, comments: false, voice: true } };
ok("an on switch passes", gateMessage(limits, "voice").ok === true);
ok("an unset switch passes (a new feature is never off by surprise)", gateMessage(limits, "assistant").ok === true);
const v = gateMessage(limits, "vision");
ok("an off switch is refused", v.ok === false);
ok("the refusal names the feature and the package",
  v.message === "Photo product matching is not included in your Shop Starter package. Upgrade your package to turn it on.");
ok("an unknown key is allowed, and labelled by its key", gateMessage(limits, "made_up").ok === true && gateMessage(limits, "made_up").label === "made_up");
ok("a missing limits object never throws", gateMessage(undefined, "vision").ok === true && gateMessage(null, "vision").ok === true);
ok("a missing plan name falls back to 'current'", gateMessage({ features: { vision: false } }, "vision").message.includes("your current package"));

// featureOn is the one truth both can() and featureList read.
ok("featureOn: false is off", featureOn({ x: false }, "x") === false);
ok("featureOn: true, undefined and null are on", featureOn({ x: true }, "x") && featureOn({}, "x") && featureOn({ x: null }, "x"));
ok("featureOn: a string 'false' is truthy and therefore ON — the admin saves booleans", featureOn({ x: "false" }, "x") === true);

// ── The dashboard list carries the new switches on the right side ────────────
const shop = featureList({}, "ecommerce").map((f) => f.key);
const svc = featureList({}, "agency").map((f) => f.key);
ok("a shop sees photo import and website import", shop.includes("photo_import") && shop.includes("website_import"));
ok("a service does not", !svc.includes("photo_import") && !svc.includes("website_import"));
ok("both see the assistant and analytics", ["assistant", "analytics"].every((k) => shop.includes(k) && svc.includes(k)));
ok("every listed feature carries its area", featureList({}, "ecommerce").every((f) => AREA_LABELS[f.area]));

console.log(fail === 0 ? `${pass} passed, 0 failed` : `${pass} passed, ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
