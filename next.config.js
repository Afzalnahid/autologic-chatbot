/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  env: {
    SUPABASE_URL: process.env.SUPABASE_URL || "https://cchvsgouqqxibhubioch.supabase.co",
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjaHZzZ291cXF4aWJodWJpb2NoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDkzMTg1NywiZXhwIjoyMDk2NTA3ODU3fQ.7TzrrgIK-7_orHpDsYczscGgN2WNbDCHs5AaUw700Ow",
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || "AIzaSyCRka_qsOFg0BCTeG0Eufcn3O17uMS04Yk",
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "8776824445:AAGsURyO7iYF9GZ6R9eXAzbs66HyRafeb2A",
    FACEBOOK_PAGE_ACCESS_TOKEN: process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "EAAMZCgI44ZBcwBRtGgVLiWhfGZCmXA1LWSGZB6KX5dDcRbfPDQvlAzTz83CIWErZB3oQ0tTLveBucvNrrm9DzeZBFn9ii5uQxsLrnVwZBH8wbJfkhZBGKzVY1zOhMKTpTAXMzIpbaIgS2znU8wbxcyZBfZCK78MYUiSZCue5Wlfbs03LZBSRLaF5R1ysLek68oaPZBgnrMh3hf520WpagVoyEZBVUnvEsdEQZDZD",
    FACEBOOK_VERIFY_TOKEN: process.env.FACEBOOK_VERIFY_TOKEN || "https://stylish-lobster.pikapod.net/webhook/autologic",
  },
};
module.exports = nextConfig;
