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
      // A Cache-Control rule for the manual was tried here and did not work:
      // Next writes its own "no-store, private" for a dynamically rendered
      // page and that wins over anything set in this file. Measured on
      // production, not assumed — /docs still came back MISS. The rule now
      // lives in src/middleware.js, which runs after Next has decided.
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
