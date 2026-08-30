import { fileURLToPath as __f } from "node:url";
// Paths are derived from this file's own location so the suite runs
// anywhere — another machine, another checkout, CI.
const __R = (p) => new URL("../" + p, import.meta.url);
const ROOT_SLASH = __f(new URL("../", import.meta.url)).replace(/\\/g, "/");

// where.js decides which admin page a fragment should open. The React hook at
// the bottom of the file needs a DOM; the decisions do not, so they are tested
// here and the hook's behaviour is checked in the studio.
import { readFileSync, writeFileSync } from "node:fs";

// "use client" and the react import are the only things node cannot take.
const src = readFileSync(__R("src/app/admin/where.js"), "utf8")
  .replace(/^"use client";$/m, "")
  .replace(/^import .*from "react";$/m, "const useState=()=>[],useEffect=()=>{},useRef=()=>({});");
if (/from "react"/.test(src)) throw new Error("the react import was left in — the shim needs updating");
const at = new URL("tmp-where.mjs", import.meta.url);
writeFileSync(at, src);
const W = await import(`${at.href}?v=${Date.now()}`);
const { parseHash, whereHash, resolveWhere } = W;

let pass = 0, fail = 0;
const is = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) pass++; else { fail++; console.log(`FAIL ${name}\n  got  ${a}\n  want ${b}`); }
};

const PAGES = ["overview", "clients", "payments", "packages", "ai", "admins"];
const anyone = (p) => ["overview", "clients", "payments", "packages"].includes(p);
const superOnly = (p) => PAGES.includes(p);

// ── reading the address bar ────────────────────────────────────────────────
is("a page on its own", parseHash("#clients"), { page: "clients", tab: "" });
is("a page and its tab", parseHash("#packages/clients"), { page: "packages", tab: "clients" });
is("the hash marker is optional", parseHash("packages/rates"), { page: "packages", tab: "rates" });
is("an empty hash is nothing", parseHash(""), { page: "", tab: "" });
is("no hash at all is nothing", parseHash(undefined), { page: "", tab: "" });
is("a bare marker is nothing", parseHash("#"), { page: "", tab: "" });
// The fragment is user input and goes into the DOM as a key, so it is filtered
// rather than trusted.
is("punctuation is stripped", parseHash("#pack<script>ages"), { page: "packscriptages", tab: "" });
is("and what survives never matches a real page", ["overview", "clients", "payments", "packages", "ai", "admins"].includes(parseHash("#pack<script>ages").page), false);
is("a slash-heavy hash keeps only two parts", parseHash("#a/b/c/d"), { page: "a", tab: "b" });
is("a very long segment is cut", parseHash("#" + "x".repeat(200)).page.length, 40);

// ── writing it ─────────────────────────────────────────────────────────────
is("a page alone", whereHash("clients", ""), "#clients");
is("a page and tab", whereHash("packages", "rates"), "#packages/rates");
is("no tab means no slash", whereHash("packages"), "#packages");
is("what is written reads back", parseHash(whereHash("packages", "clients")), { page: "packages", tab: "clients" });

// ── deciding where to open ─────────────────────────────────────────────────
is("a known page opens", resolveWhere("#clients", "overview", anyone), { page: "clients", tab: "" });
is("with its tab", resolveWhere("#packages/rates", "overview", anyone), { page: "packages", tab: "rates" });
is("nothing in the bar opens the fallback", resolveWhere("", "overview", anyone), { page: "overview", tab: "" });
// A fragment is typed as easily as clicked.
is("an invented page opens the fallback", resolveWhere("#nonsense", "overview", anyone), { page: "overview", tab: "" });
// This is the one that matters: a page hidden from this admin must not open
// because the address asked for it.
is("a page this admin may not see is refused", resolveWhere("#ai", "overview", anyone), { page: "overview", tab: "" });
is("and opens for one who may", resolveWhere("#ai", "overview", superOnly), { page: "ai", tab: "" });
is("admins is refused the same way", resolveWhere("#admins", "overview", anyone), { page: "overview", tab: "" });
// A tab belongs to its page. Refusing the page and keeping the tab would
// select a tab the fallback section does not have.
is("a refused page drops its tab too", resolveWhere("#ai/models", "overview", anyone), { page: "overview", tab: "" });
is("allowed defaults to permissive", resolveWhere("#ai", "overview"), { page: "ai", tab: "" });
is("the fallback is used verbatim", resolveWhere("#nope", "clients", anyone), { page: "clients", tab: "" });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
