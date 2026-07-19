export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
export async function GET() {
  const key = process.env.SUPABASE_SERVICE_KEY || "";
  return NextResponse.json({
    SUPABASE_URL: process.env.SUPABASE_URL || "NOT SET",
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "NOT SET",
    service_key_prefix: key.slice(0, 12),
    service_key_length: key.length,
  }, { headers: { "Cache-Control": "no-store" } });
}
