/** @type {import('next').NextConfig} */

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
    serverComponentsExternalPackages: ["pdf-parse", "mammoth"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      // Do not try to edge-cache /docs or "/" from here. It was tried and
      // measured on production twice, and neither way worked:
      //
      //   1. A Cache-Control rule in this file. Next writes its own
      //      "no-store, private" for a dynamically rendered page and that wins.
      //   2. The same header set from src/middleware.js, which runs later.
      //      Also overridden; /docs still answered MISS afterwards.
      //
      // The cause is not the header, it is the render mode. Those pages read
      // ?lang=bn out of the query string, and reading the query is what makes
      // Next render them per request. Nothing bolted on afterwards changes
      // that. The real fix would be to carry the language in the path instead
      // of the query — which moves URLs Google has already indexed, so it is
      // an SEO decision, not a caching one.
    ];
  },
  async redirects() {
    return [
      // The Conversations tab became Inbox (2026-08-25). Anyone holding the
      // old manual link still lands on the page. Not permanent: a 308 would
      // be cached in browsers forever, and this rename should stay undoable.
      { source: "/docs/conversations", destination: "/docs/inbox", permanent: false },
    ];
  },
};
module.exports = nextConfig;
