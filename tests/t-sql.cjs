// Count the values in each row of the INSERT, respecting quotes and brackets,
// and compare against the column list. A miscount is the one error that costs
// a round trip to Supabase and back.
const fs = require("fs");
const path = require("node:path");
const sql = fs.readFileSync(path.join(__dirname, "..", "docs/sql/2026-08-31-plans-biz.sql"), "utf8");

const cols = sql.match(/insert into public\.plans(?:\s+as\s+\w+)?\s*\(([\s\S]*?)\)\s*values/i)[1]
  .split(",").map((s) => s.trim()).filter(Boolean);
console.log(`column list: ${cols.length}`);

// Everything between `values` and `on conflict`.
const body = sql.slice(sql.search(/\)\s*values/i) + sql.match(/\)\s*values/i)[0].length,
  sql.search(/on conflict/i));

// Walk it, splitting top-level ( … ) groups, ignoring anything inside a string.
let depth = 0, inStr = false, cur = "", rows = [];
for (let i = 0; i < body.length; i++) {
  const c = body[i];
  if (inStr) { cur += c; if (c === "'" && body[i + 1] === "'") { cur += body[++i]; } else if (c === "'") inStr = false; continue; }
  if (c === "'") { inStr = true; cur += c; continue; }
  if (c === "(") { depth++; if (depth === 1) { cur = ""; continue; } }
  if (c === ")") { depth--; if (depth === 0) { rows.push(cur); continue; } }
  if (depth > 0) cur += c;
}

let bad = 0;
rows.forEach((r, n) => {
  // Split on commas that are not inside a string or nested parens.
  let d = 0, s = false, parts = [], buf = "";
  for (let i = 0; i < r.length; i++) {
    const c = r[i];
    if (s) { buf += c; if (c === "'" && r[i + 1] === "'") buf += r[++i]; else if (c === "'") s = false; continue; }
    if (c === "'") { s = true; buf += c; continue; }
    if (c === "(") d++;
    if (c === ")") d--;
    if (c === "," && d === 0) { parts.push(buf.trim()); buf = ""; continue; }
    buf += c;
  }
  if (buf.trim()) parts.push(buf.trim());
  const id = (parts[0] || "").replace(/'/g, "");
  const ok = parts.length === cols.length;
  if (!ok) bad++;
  console.log(`  ${ok ? "ok  " : "BAD "} row ${n + 1} ${id.padEnd(14)} ${parts.length} values`);
});

// The on-conflict SET list must only name real columns.
const sets = [...sql.matchAll(/^\s{2}(\w+)\s*=\s*/gm)].map((m) => m[1]);
const unknown = sets.filter((s) => !cols.includes(s) && s !== "updated_at");
console.log(`\non-conflict sets ${sets.length} columns; unknown: ${unknown.length ? unknown.join(", ") : "none"}`);
// /api/plans draws the pricing cards from feature_list. Seeding it empty ships
// seven packages with a price and no reasons to buy any of them — which is what
// this file did until somebody read it before running it.
// Only inside VALUES — the on-conflict CASE legitimately compares against '[]'.
const empties = (body.match(/'\[\]'::jsonb/g) || []).length;
if (empties) { bad++; console.log(`  BAD  ${empties} package(s) still have an empty feature_list`); }
else console.log("  ok   every package carries its pricing bullets");

console.log(bad ? `\n${bad} problem(s)` : "\nevery row matches the column list, and every package has bullets");
process.exit(bad || unknown.length ? 1 : 0);
