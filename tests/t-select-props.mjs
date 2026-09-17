// Every <Select> in the app must pass `options`. On 2026-08-31 the package
// editor passed `items` instead; nothing complained until the owner pressed
// Edit on a package, when Select read `undefined.find` and the whole admin
// console went blank with "Application error: a client-side exception". A prop
// name is not something React checks, so this does — at test time, over the
// source, before anyone presses anything.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");

const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) { if (!["node_modules", ".next"].includes(e)) walk(full); continue; }
    if ([".js", ".jsx"].includes(extname(e))) files.push(full);
  }
})(join(ROOT, "src"));

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

// The shared Select lives in ui.js and takes `options`. A file that defines its
// OWN Select (a native <select> wrapper, say) is not held to it.
const usesShared = (src) => /import\s*\{[^}]*\bSelect\b[^}]*\}\s*from\s*"[^"]*components\/ui\.js"/.test(src);

let seen = 0;
for (const f of files) {
  const src = readFileSync(f, "utf8");
  if (!usesShared(src)) continue;
  // One tag = from "<Select" to the next ">" that is not inside a {...} prop.
  const re = /<Select\b/g;
  let m;
  while ((m = re.exec(src))) {
    seen++;
    let i = m.index + 7, depth = 0;
    while (i < src.length) {
      const ch = src[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (ch === ">" && depth === 0) break;
      i++;
    }
    const tag = src.slice(m.index, i);
    const line = src.slice(0, m.index).split("\n").length;
    const rel = f.slice(ROOT.length + 1).replace(/\\/g, "/");
    ok(`${rel}:${line} <Select> passes options=`, /\boptions=/.test(tag));
    ok(`${rel}:${line} <Select> does not use the old items= name`, !/\bitems=/.test(tag));
  }
}
ok("the scan found the Selects it is meant to guard", seen >= 4);

console.log(fail === 0 ? `${pass} passed, 0 failed` : `${pass} passed, ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
