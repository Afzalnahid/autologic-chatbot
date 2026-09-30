// Builds whole tutorials, start to finish, and files them the way the owner
// asked (2026-09-30): one folder per language, and inside it one per screen.
//
//   node build.mjs 02-first-setup            → one tutorial, all four versions
//   node build.mjs 02-first-setup 03-channels
//   node build.mjs all                       → every script in scripts/
//   flags: --no-capture  --no-voice  --only=desktop-bn,phone-en
//
// Steps per tutorial: capture (desktop, phone) → voice (bn, en) → listen to every
// take and redo the ones that do not match the script (twice at most) →
// render + mix the four versions → copy to
//   Claude outputs/Tutorials/<Bangla|English>/<Desktop|Mobile>/<NN> - <title>.mp4
// Needs `next dev` on :3000 for the capture.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { HERE, loadScript, scriptIds } from "./script.mjs";

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const only = (args.find((a) => a.startsWith("--only="))?.slice(7) || "").split(",").filter(Boolean);
let ids = args.filter((a) => !a.startsWith("--"));
if (ids.includes("all")) ids = scriptIds();
if (!ids.length) throw new Error("which tutorial? e.g. node build.mjs 02-first-setup   (or: all)");

const ROOT = path.resolve(HERE, "../..");
const DELIVER = path.join(ROOT, "Claude outputs", "Tutorials");
const LANG = { bn: "Bangla", en: "English" }, DEV = { desktop: "Desktop", phone: "Mobile" };

function run(file, argv, env, tries = 4) {
  for (let a = 1; a <= tries; a++) {
    const r = spawnSync("node", [file, ...argv], { cwd: HERE, env: { ...process.env, ...env }, encoding: "utf8", maxBuffer: 64 << 20 });
    const out = (r.stdout || "") + (r.stderr || "");
    if (r.status === 0) return out;
    console.error(`  ${file} ${argv.join(" ")} failed (try ${a}): ${out.trim().split("\n").slice(-3).join(" | ")}`);
  }
  throw new Error(`${file} ${argv.join(" ")} kept failing`);
}
// file names may not carry : / \ ? * " < > |
const safe = (s) => s.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();

for (const id of ids) {
  const s = loadScript(id);
  const env = { TUT: id };
  console.log(`\n=== ${id} — ${s.title.en}`);
  if (!flag("--no-capture")) for (const d of ["desktop", "phone"]) console.log(" ", run("capture.mjs", [d], env).trim().split("\n").pop());
  if (!flag("--no-voice")) {
    for (const l of ["bn", "en"]) {
      run("tts.mjs", [l], env);
      // listen, and redo what does not match (a take can repeat or skip words)
      for (let pass = 1; pass <= 3; pass++) {
        const check = run("check_voice.mjs", [l], env);
        const bad = [...check.matchAll(/^\w+ (\d\d) BAD/gm)].map((m) => m[1]);
        if (!bad.length) { console.log(`  voice ${l}: all lines match the script`); break; }
        if (pass === 3) { console.log(`  voice ${l}: STILL DIFFERENT after two redos: ${bad.join(" ")} — check by ear`); break; }
        console.log(`  voice ${l}: redoing ${bad.join(" ")}`);
        run("tts.mjs", [l, ...bad], env);
      }
    }
  }
  for (const l of ["bn", "en"]) for (const d of ["desktop", "phone"]) {
    if (only.length && !only.includes(`${d}-${l}`)) continue;
    run("render.mjs", [d, l], env);
    run("mix.mjs", [d, l], env);
    const made = path.join(HERE, "out", id, `tutorial-${id}-${d}-${l}.mp4`);
    const dir = path.join(DELIVER, LANG[l], DEV[d]);
    fs.mkdirSync(dir, { recursive: true });
    const to = path.join(dir, `${id.slice(0, 2)} - ${safe(s.title[l])}.mp4`);
    fs.copyFileSync(made, to);
    console.log(`  ${d}-${l} → ${path.relative(ROOT, to)}`);
  }
}
console.log("\nALL DONE");
