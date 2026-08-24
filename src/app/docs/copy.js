import * as EN from "@/lib/docs/en.js";
import * as BN from "@/lib/docs/bn.js";
import { PAGES, isWritten } from "@/lib/docs/index.js";

// Shared, client-free helpers. Kept out of shell.js so blocks.js can use them
// without dragging the search box's client bundle into its module graph.

// The small all-caps label is a CSS class (.lbl in shell.js), not an object
// spread into inline styles — Bangla needs to override it, and an inline style
// cannot be overridden by a stylesheet.

// ?lang=bn, exactly as the landing and pricing pages read it. Anything else is
// English — an unknown value must never produce a half-translated page.
export const pickLang = (searchParams) => (searchParams?.lang === "bn" ? "bn" : "en");

export const copy = (lang) => (lang === "bn" ? BN : EN);

// Bangla prose with Latin numerals in it reads like a translation someone
// forgot to finish. Step numbers and reading times go through here.
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
export const num = (n, lang) =>
  lang === "bn" ? String(n).replace(/\d/g, (d) => BN_DIGITS[+d]) : String(n);

// Every internal link carries the language forward, or a reader in Bangla
// silently falls back to English on their second click.
export const docHref = (slug, lang) => `/docs${slug ? "/" + slug : ""}${lang === "bn" ? "?lang=bn" : ""}`;

// Which pages actually have copy in this language. Drives the dimmed "being
// written" entries in the sidebar and keeps unwritten pages out of the sitemap.
export const writtenSet = (lang) => {
  const { DOCS } = copy(lang);
  return new Set(PAGES.filter((p) => isWritten(DOCS[p.slug])).map((p) => p.slug));
};
