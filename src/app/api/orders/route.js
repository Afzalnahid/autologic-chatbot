export const dynamic = "force-dynamic";
import { requireClient } from "@/lib/auth.js";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";

export async function GET(request) {
  const { client, error: authErr } = await requireClient(request);
  if (authErr || !client) return NextResponse.json([], { status: authErr ? 401 : 200 });
  try {
    const { data: rows } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(300);
    const data = (rows || []).filter(o => o.client_id === client.id);
    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json([]);
  }
}

export async function PUT(request) {
  try {
    const { id, status } = await request.json();
    const { client: oc } = await requireClient(request);
    if (!oc) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    await supabase.from("orders").update({ status }).eq("id", id).eq("client_id", oc.id);
    return NextResponse.json({ status: "updated" });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
