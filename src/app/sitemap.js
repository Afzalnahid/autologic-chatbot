// Sitemap for getvoicium.com — the list of public pages we want Google to find
// and index. Next.js App Router serves this automatically at /sitemap.xml.
// Canonical host is www (the apex 308-redirects to it).
import { PAGES } from "@/lib/docs/index.js";
import { writtenSet } from "./docs/copy.js";

const BASE = "https://www.getvoicium.com";

export default function sitemap() {
  const now = new Date();
  // Only public marketing / legal pages belong here. Login-gated routes
  // (dashboard, admin, reset) and API routes are intentionally left out.
  const pages = [
    { path: "/", priority: 1.0, changeFrequency: "weekly" },
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

  return [...pages, ...docs].map((p) => ({
    url: `${BASE}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
    ...(p.bn ? { alternates: { languages: { bn: `${BASE}${p.path}?lang=bn` } } } : {}),
  }));
}
