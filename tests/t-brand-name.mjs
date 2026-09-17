// The old product name must not reach a customer. The rename to TellMore AI
// missed the client email header for a day because the name was written as two
// tags there — "get" + a coloured "voicium" — so no search for the brand found
// it, while every notification a client received still carried the dead name
// (owner, 2026-09-18). This walks the app source and fails on any surviving
// mention, with a short allow-list for the Firebase identifiers Google will not
// let us rename and for comments that record the history on purpose.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OLD = /voicium/i;
// path → why a mention is allowed to stay there.
const ALLOWED = {
  "src/lib/fcm.js": "Firebase project id (Google never lets a project be renamed)",
  "src/lib/company.js": "a comment recording the rename",
  "src/app/api/admin/webhooks/route.js": "a comment naming the retired host",
};
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "android", "www"]);
const TEXT = /\.(js|jsx|mjs|ts|tsx|json|md|html|css|svg|txt|yml|yaml)$/;

const hits = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (SKIP_DIRS.has(entry)) continue;
    if (statSync(full).isDirectory()) { walk(full); continue; }
    if (!TEXT.test(entry)) continue;
    const rel = relative(ROOT, full).replace(/\\/g, "/");
    if (ALLOWED[rel]) continue;
    const src = readFileSync(full, "utf8");
    src.split("\n").forEach((line, i) => { if (OLD.test(line)) hits.push(`${rel}:${i + 1}: ${line.trim().slice(0, 100)}`); });
  }
})(join(ROOT, "src"));

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

ok("no trace of the old product name anywhere under src/", hits.length === 0);
if (hits.length) hits.forEach((h) => console.error("   ", h));

// The email header is built from COMPANY.name, not typed, so the next rename
// carries into it by itself.
const email = readFileSync(join(ROOT, "src", "lib", "email.js"), "utf8");
ok("the client email header renders BRAND_HTML", email.includes("${BRAND_HTML}</div>"));
ok("BRAND_HTML is derived from COMPANY.name", /BRAND_HTML[\s\S]{0,300}COMPANY\.name/.test(email));

console.log(fail === 0 ? `${pass} passed, 0 failed` : `${pass} passed, ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
