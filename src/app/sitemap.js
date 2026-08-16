// Sitemap for getvoicium.com — the list of public pages we want Google to find
// and index. Next.js App Router serves this automatically at /sitemap.xml.
// Canonical host is www (the apex 308-redirects to it).
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
  ];
  return pages.map((p) => ({
    url: `${BASE}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
