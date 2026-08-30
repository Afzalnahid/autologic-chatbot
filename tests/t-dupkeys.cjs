// Paths are derived from this file's own location so the suite runs
// anywhere — another machine, another checkout, CI.
const __R = (p) => require("node:path").join(__dirname, "..", p);
const ROOT_SLASH = require("node:path").join(__dirname, "..").replace(/\\/g, "/") + "/";

// A duplicate key in an object literal is silent: the LAST one wins, and
// nothing — not the parser, not the browser, not a test that reads the first
// one — says a word. It is how `messages` in the admin API came to be set twice
// and read 0 while the split beside it read correctly.
//
// Walked as an AST rather than matched with a regex, because "the same key
// twice" is a question about NESTING, and a regex cannot see nesting.
const { parse } = require(__R("node_modules/next/dist/compiled/babel/parser.js"));
const fs = require("node:fs");
const path = require("node:path");

const ROOT = __R("src");
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".js")) files.push(p);
  }
})(ROOT);

const PLUGINS = ["jsx", "objectRestSpread", "optionalChaining", "nullishCoalescingOperator", "classProperties", "dynamicImport", "topLevelAwait"];
const hits = [];

for (const file of files) {
  const rel = file.replace(/\\/g, "/").replace(__R(""), "");
  let ast;
  try { ast = parse(fs.readFileSync(file, "utf8"), { sourceType: "module", plugins: PLUGINS }); }
  catch (e) { console.log(`SKIP ${rel}: ${e.message}`); continue; }

  (function visit(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(visit); return; }

    if (node.type === "ObjectExpression") {
      const seen = new Map();
      for (const p of node.properties) {
        if (p.type !== "ObjectProperty" || p.computed) continue;
        const k = p.key.name ?? p.key.value;
        if (k === undefined) continue;
        // A spread between two identical keys is a deliberate override —
        // { ...defaults, x: 1 } is the normal shape — but the same LITERAL key
        // twice with nothing between them is always a mistake.
        if (seen.has(k)) hits.push(`${rel}:${p.loc.start.line}  duplicate key "${k}" (first at line ${seen.get(k)})`);
        else seen.set(k, p.loc.start.line);
      }
    }
    for (const key of Object.keys(node)) {
      if (key === "loc" || key === "leadingComments" || key === "trailingComments") continue;
      visit(node[key]);
    }
  })(ast.program);
}

if (hits.length) {
  console.log(`\n${hits.length} duplicate key(s):`);
  for (const h of hits) console.log("  " + h);
} else {
  console.log(`\nNo object literal in ${files.length} files sets the same key twice.`);
}
process.exit(hits.length ? 1 : 0);
