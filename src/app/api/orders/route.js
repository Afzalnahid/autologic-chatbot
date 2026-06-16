import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";

export async function GET() {
  try {
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(50);
    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json([]);
  }
}

export async function PUT(request) {
  try {
    const { id, status } = await request.json();
    await supabase.from("orders").update({ status }).eq("id", id);
    return NextResponse.json({ status: "updated" });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
