// Sitemap for tellmoreai.com — the list of public pages we want Google to find
// and index. Next.js App Router serves this automatically at /sitemap.xml.
// Canonical host is www (the apex 308-redirects to it).
import { PAGES } from "@/lib/docs/index.js";
import { SOLUTIONS } from "@/lib/solutions/index.js";
import * as SOL_BN from "@/lib/solutions/bn.js";
import { writtenSet } from "./docs/copy.js";
import { SITE as BASE } from "@/lib/seo.js";

export default function sitemap() {
  const now = new Date();
  // Only public marketing / legal pages belong here. Login-gated routes
  // (dashboard, admin, reset) and API routes are intentionally left out.
  const pages = [
    // The home page is the one marketing page with a full Bangla version, and
    // Google already indexes it separately, so it is declared as an alternate
    // rather than left to look like a duplicate. /pricing has no Bangla copy.
    { path: "/", priority: 1.0, changeFrequency: "weekly", bn: true },
    { path: "/pricing", priority: 0.8, changeFrequency: "weekly" },
    { path: "/contact", priority: 0.5, changeFrequency: "monthly" },
    { path: "/google-calendar", priority: 0.4, changeFrequency: "yearly" },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
    { path: "/docs", priority: 0.7, changeFrequency: "weekly" },
  ];

  // Documentation pages, but only the ones that have actually been written.
  // A page that still says "being written" is noindex (see docs/[slug]/page.js)
  // and listing it here would ask Google to crawl something we do not want in
  // the results — the two settings have to agree.
  const en = writtenSet("en"), bn = writtenSet("bn");
  const docs = PAGES.filter((p) => en.has(p.slug)).map((p) => ({
    path: `/docs/${p.slug}`,
    priority: 0.6,
    changeFrequency: "monthly",
    // Google is told about the Bangla version of the same page rather than
    // treating it as a duplicate.
    bn: bn.has(p.slug),
  }));

  // The solution pages — one per search someone types. Both languages are
  // written, so each is declared with its Bangla alternate.
  const solutions = SOLUTIONS.map((s) => ({
    path: `/solutions/${s.slug}`,
    priority: 0.9,
    changeFrequency: "monthly",
    bn: !!SOL_BN.PAGES[s.slug],
  }));

  return [...pages, ...solutions, ...docs].map((p) => ({
    url: `${BASE}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
    ...(p.bn ? { alternates: { languages: { bn: `${BASE}${p.path}?lang=bn` } } } : {}),
  }));
}
