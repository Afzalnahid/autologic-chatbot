import { fileURLToPath as __f } from "node:url";
// Paths are derived from this file's own location so the suite runs
// anywhere — another machine, another checkout, CI.
const __R = (p) => new URL("../" + p, import.meta.url);
const ROOT_SLASH = __f(new URL("../", import.meta.url)).replace(/\\/g, "/");

// .env.example is the only list of what this app needs to run. A variable the
// code reads but the file does not mention is a setting somebody deploying
// this cannot know about — CRON_SECRET was exactly that, and the cron it locks
// had been shipped in vercel.json for weeks.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = ROOT_SLASH;   // a string, for path.join

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|mjs|cjs|jsx)$/.test(name)) out.push(p);
  }
  return out;
};

const files = [...walk(join(ROOT, "src")), ...walk(join(ROOT, "scripts"))];
const used = new Set();
for (const f of files) {
  for (const m of readFileSync(f, "utf8").matchAll(/process\.env\.([A-Z0-9_]+)/g)) used.add(m[1]);
}

// Set by the platform, never written into a file.
const AUTOMATIC = new Set(["NODE_ENV", "VERCEL_ENV"]);

const example = readFileSync(join(ROOT, ".env.example"), "utf8");
// Commented lines count: an alias documented as "# VERCEL_API_TOKEN=" is
// documented, and requiring it to be uncommented would be worse advice.
const listed = new Set([...example.matchAll(/^#?\s*([A-Z0-9_]+)=/gm)].map((m) => m[1]));

let bad = 0;
const say = (ok, msg) => { if (!ok) { bad++; console.log("FAIL " + msg); } };

for (const v of [...used].sort()) {
  if (AUTOMATIC.has(v)) continue;
  say(listed.has(v), `${v} is read by the code but is not in .env.example`);
}
// The other direction is a weaker signal — a variable can be documented ahead
// of the code that will read it — but a name nobody reads is usually a rename
// that only got done on one side.
for (const v of [...listed].sort()) {
  say(used.has(v), `.env.example lists ${v}, which no code reads — renamed?`);
}

// The two the app cannot start without say so, so nobody has to find out by
// watching it crash.
for (const v of ["SUPABASE_URL", "SUPABASE_SERVICE_KEY"]) {
  say(new RegExp(`^${v}=.*\\[required\\]`, "m").test(example), `${v} is not marked [required]`);
}
// NEXT_PUBLIC_ values reach the browser. A secret in one is a published secret.
for (const v of [...listed].filter((x) => x.startsWith("NEXT_PUBLIC_"))) {
  const line = example.split("\n").find((l) => l.trim().startsWith(v + "="));
  say(!/SECRET/.test(line || ""), `${v} is browser-visible and marked SECRET — one of the two is wrong`);
}

console.log(`\n${used.size} variables read, ${listed.size} documented`);
console.log(bad ? `${bad} problem(s)` : "every variable the code reads is documented in .env.example");
process.exit(bad ? 1 : 0);
