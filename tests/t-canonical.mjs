// Which address each public page tells Google is the real one, and how the two
// languages are declared to each other.
//
// Both got this wrong at once, and Search Console found it (report, 24 Sep
// 2026). Bangla pages named the ENGLISH address as their canonical — the exact
// instruction that means "I am a duplicate, drop me" — and a page that had no
// canonical at all let a scraper's copy be chosen as the original: our
// /docs/inbox was filed under an unrelated gambling domain.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { loadPure } from "./shim.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const { pageMeta, SITE } = await loadPure(join(root, "src", "lib", "seo.js"), "tmp-seo-canon.mjs");

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

const en = pageMeta({ title: "t", description: "d", path: "/docs/inbox", lang: "en", bilingual: true });
const bn = pageMeta({ title: "t", description: "d", path: "/docs/inbox", lang: "bn", bilingual: true });
const only = pageMeta({ title: "t", description: "d", path: "/pricing", lang: "en" });

// Every page points at itself — including the Bangla one.
ok("the English page is its own canonical", en.alternates.canonical === `${SITE}/docs/inbox`);
ok("the Bangla page is its own canonical, query and all", bn.alternates.canonical === `${SITE}/docs/inbox?lang=bn`);
ok("the Bangla page never names the English address as canonical", bn.alternates.canonical !== `${SITE}/docs/inbox`);
ok("a page with no Bangla version still has a canonical", only.alternates.canonical === `${SITE}/pricing`);
ok("no public page is left without one", [en, bn, only].every((m) => typeof m.alternates?.canonical === "string" && m.alternates.canonical.startsWith(SITE)));

// hreflang has to be reciprocal: both versions carry the SAME set, each naming
// itself. A set where one side is missing is a set Google throws away.
const want = { en: `${SITE}/docs/inbox`, bn: `${SITE}/docs/inbox?lang=bn`, "x-default": `${SITE}/docs/inbox` };
ok("the English page declares both languages and a default", JSON.stringify(en.alternates.languages) === JSON.stringify(want));
ok("the Bangla page declares exactly the same set", JSON.stringify(bn.alternates.languages) === JSON.stringify(want));
ok("x-default is the English address", en.alternates.languages["x-default"] === `${SITE}/docs/inbox`);
ok("each language names itself in the set",
  en.alternates.languages.en === en.alternates.canonical && bn.alternates.languages.bn === bn.alternates.canonical);

// A page that has no Bangla copy must not advertise a Bangla address.
ok("an English-only page declares no languages at all", only.alternates.languages === undefined);

// The pages that used to override the canonical with the English address.
const src = (...p) => readFileSync(join(root, ...p), "utf8");
for (const [label, file] of [
  ["the manual hub", ["src", "app", "docs", "page.js"]],
  ["a manual page", ["src", "app", "docs", "[slug]", "page.js"]],
  ["a solution page", ["src", "app", "solutions", "[slug]", "page.js"]],
]) {
  ok(`${label} no longer forces a canonical of its own`, !/alternates:\s*\{\s*canonical/.test(src(...file)));
  ok(`${label} asks pageMeta for the language pair`, /bilingual:/.test(src(...file)));
}

// The sitemap: reciprocal too, and no build-time lastmod pretending to be a
// content date.
const sm = src("src", "app", "sitemap.js");
ok("the sitemap lists every language, itself included", /languages:\s*\{[\s\S]{0,200}en:[\s\S]{0,120}bn:[\s\S]{0,140}"x-default":/.test(sm));
ok("the sitemap no longer stamps every page with the build time", !/lastModified:/.test(sm));

// The Bangla pages served <html lang="en">, which screen readers take at face
// value. Set before first paint by the boot script.
ok("the boot script sets the page language for Bangla", /lang=bn[\s\S]{0,120}documentElement\.lang\s*=\s*"bn"/.test(src("src", "lib", "landing.js")));

console.log(`t-canonical: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
