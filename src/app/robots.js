// robots.txt for getvoicium.com — tells search engines what they may crawl.
// Next.js App Router serves this automatically at /robots.txt.
// Canonical host is www (the apex 308-redirects to it), so we point there.
const BASE = "https://www.getvoicium.com";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep login-gated, admin and utility routes out of search results.
      disallow: ["/api/", "/admin", "/dashboard", "/reset", "/preview-dash"],
    },
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
