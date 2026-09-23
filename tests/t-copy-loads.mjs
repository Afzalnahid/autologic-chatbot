// The written copy — the manual and the solution pages, in both languages —
// must at least still be valid JavaScript with the exports the pages read.
//
// On 2026-09-24 a Bangla paragraph was added to the manual with straight double
// quotes inside a double-quoted string. src/lib/docs/bn.js stopped parsing;
// `npm test` passed 71 out of 71, because no suite had ever imported the copy
// files, and the first thing to notice was Vercel failing the deployment.
//
// These files are big, hand-edited, and full of quotation marks and em dashes
// in two scripts. Importing them is the cheapest guard there is.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const load = (...p) => import(pathToFileURL(join(root, ...p)).href);

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

// Every file is imported, so a syntax error anywhere stops the suite here
// rather than in a deployment.
const docsEn = await load("src", "lib", "docs", "en.js");
const docsBn = await load("src", "lib", "docs", "bn.js");
const docsIx = await load("src", "lib", "docs", "index.js");
const solEn = await load("src", "lib", "solutions", "en.js");
const solBn = await load("src", "lib", "solutions", "bn.js");
const solIx = await load("src", "lib", "solutions", "index.js");

for (const [label, m] of [["the English manual", docsEn], ["the Bangla manual", docsBn]]) {
  ok(`${label} parses and exports its pages`, m.DOCS && typeof m.DOCS === "object");
  ok(`${label} exports the words around them`, m.UI && typeof m.UI === "object");
  ok(`${label} has pages with content`, Object.values(m.DOCS).some((d) => d && (d.lead || d.blocks)));
}
ok("the manual's page list loads", Array.isArray(docsIx.PAGES) && docsIx.PAGES.length > 0);
ok("every listed page has a slug", docsIx.PAGES.every((p) => typeof p.slug === "string" && p.slug));

for (const [label, m] of [["the English solution pages", solEn], ["the Bangla solution pages", solBn]]) {
  ok(`${label} parse and export their pages`, m.PAGES && typeof m.PAGES === "object");
  ok(`${label} export their shared words`, m.UI && typeof m.UI === "object");
}
ok("the solutions list loads", Array.isArray(solIx.SOLUTIONS) && solIx.SOLUTIONS.length > 0);

// Both languages must cover the same manual pages, or a reader who switches to
// Bangla lands on a page that does not exist in their language.
{
  const en = Object.keys(docsEn.DOCS), bn = Object.keys(docsBn.DOCS);
  ok("the Bangla manual has no page the English one lacks", bn.every((k) => en.includes(k)));
  ok("the solution pages match across languages",
    Object.keys(solBn.PAGES).every((k) => Object.keys(solEn.PAGES).includes(k)));
}

// The sitemap and both page routes read these through these helpers; if one of
// them throws, whole sections of the site stop building.
ok("writtenSet-style filtering works on the real copy",
  typeof docsIx.isWritten === "function" && docsIx.PAGES.some((p) => docsIx.isWritten(docsEn.DOCS[p.slug])));
ok("a solution page can be told written from unwritten",
  typeof solIx.isWritten === "function" && Object.values(solEn.PAGES).some((p) => solIx.isWritten(p)));

console.log(`t-copy-loads: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
