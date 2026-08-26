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
      {
        // The manual reads ?lang=bn out of the query string, and reading the
        // query makes a page dynamic — so Next answers every request with
        // "no-store, private" and Vercel's edge never keeps a copy. Measured
        // in production: /docs and /docs/inbox came back X-Vercel-Cache MISS
        // every time, while /privacy and /terms, which take no query, were
        // already HIT.
        //
        // Nothing on these pages depends on who is asking. There is no login
        // in front of them, no cookie in the answer, and the middleware does
        // not run here — its matcher is the front page and nothing else. The
        // only thing that changes the output is the URL itself, which is what
        // the cache is keyed on.
        //
        // max-age=0 keeps the reader's own browser checking back, so a
        // corrected page is never stale for them; s-maxage lets the edge hold
        // it for an hour, and stale-while-revalidate serves the held copy for
        // a day while a fresh one is fetched behind it.
        source: "/docs/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" },
        ],
      },
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
