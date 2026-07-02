export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";

export async function GET() {
  try {
    const { data } = await supabase.from("channels").select("id, platform, page_id, status, connected_at").order("created_at", { ascending: false });
    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json([]);
  }
}

export async function PUT(request) {
  try {
    const { id, status } = await request.json();
    await supabase.from("channels").update({ status }).eq("id", id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
