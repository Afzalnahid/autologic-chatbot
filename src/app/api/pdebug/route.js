export const dynamic = "force-dynamic";
export const revalidate = 0;
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";

export async function GET() {
  const { data } = await supabase.from("clients").select("business_name,phone,address,website,business_type,plan").eq("owner_email","nahidafzal97@gmail.com");
  return NextResponse.json({ rows: data, at: Date.now() }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } });
}
