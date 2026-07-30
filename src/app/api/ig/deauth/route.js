export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";

// Meta calls this when a user removes the app from their Instagram settings.
// We clear their tokens and mark the channel disconnected.
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const igId = String(body?.user_id || body?.instagram_user_id || "");
    if (igId) {
      await supabase
        .from("channels")
        .update({ status: "disconnected", access_token: null })
        .eq("platform", "instagram")
        .eq("page_id", igId);
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[ig-deauth]", e?.message || e);
    return NextResponse.json({ success: true }); // Always 200 to Meta
  }
}

// Meta also sends a GET to verify the endpoint exists.
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
