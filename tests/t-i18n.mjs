import { fileURLToPath as __f } from "node:url";
// Paths are derived from this file's own location so the suite runs
// anywhere — another machine, another checkout, CI.
const __R = (p) => new URL("../" + p, import.meta.url);
const ROOT_SLASH = __f(new URL("../", import.meta.url)).replace(/\\/g, "/");

import { readFileSync } from "node:fs";

// Both dictionaries must carry the same keys. A key present in English and
// missing in Bangla is a line that silently reverts to English mid-sentence —
// which is exactly the failure this whole pass is meant to end.
const src = readFileSync(__R("src/app/dashboard/components/i18n.js"), "utf8");

function block(lang) {
  const start = src.indexOf(`\n  ${lang}: {`);
  if (start < 0) throw new Error(`no ${lang} block`);
  let i = src.indexOf("{", start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (!depth) break; }
  }
  return src.slice(start, i);
}

const keys = (text) => {
  const out = [];
  const re = /"([a-zA-Z][\w.]*)"\s*:/g;
  let m;
  while ((m = re.exec(text))) out.push(m[1]);
  return out;
};

const en = keys(block("en"));
const bn = keys(block("bn"));
const dupes = (list) => list.filter((k, i) => list.indexOf(k) !== i);

const missing = en.filter((k) => !bn.includes(k));
const extra = bn.filter((k) => !en.includes(k));
const dEn = [...new Set(dupes(en))];
const dBn = [...new Set(dupes(bn))];

// Every {placeholder} in the English string must exist in the Bangla one, or a
// name or a number is dropped out of the sentence with nothing to show for it.
const pairs = (text) => {
  const out = {};
  const re = /"([a-zA-Z][\w.]*)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(text))) out[m[1]] = m[2];
  return out;
};
const pEn = pairs(block("en")), pBn = pairs(block("bn"));
const vars = (s) => [...new Set([...String(s).matchAll(/\{(\w+)\}/g)].map((x) => x[1]))].sort();
const badVars = Object.keys(pEn)
  .filter((k) => pBn[k] !== undefined)
  .filter((k) => JSON.stringify(vars(pEn[k])) !== JSON.stringify(vars(pBn[k])))
  .map((k) => `${k}: en{${vars(pEn[k])}} bn{${vars(pBn[k])}}`);

console.log(`en keys: ${en.length}   bn keys: ${bn.length}`);
if (dEn.length) console.log("DUPLICATE in en:", dEn);
if (dBn.length) console.log("DUPLICATE in bn:", dBn);
if (missing.length) console.log("MISSING from bn:", missing);
if (extra.length) console.log("EXTRA in bn:", extra);
if (badVars.length) console.log("PLACEHOLDER MISMATCH:", badVars);
const bad = dEn.length + dBn.length + missing.length + extra.length + badVars.length;
console.log(bad ? `\n${bad} problem(s)` : "\nboth dictionaries agree");
process.exit(bad ? 1 : 0);
