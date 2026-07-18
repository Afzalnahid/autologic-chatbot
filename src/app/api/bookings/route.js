export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { supabase } from "@/lib/supabase.js";

export async function GET(request) {
  const { client, error: authErr } = await requireClient(request);
  if (authErr || !client) return NextResponse.json([], { status: authErr ? 401 : 200 });
  const { data } = await supabase
    .from("bookings")
    .select("*")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false })
    .limit(500);
  return NextResponse.json(data || []);
}

export async function PUT(request) {
  const { client } = await requireClient(request);
  if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, status } = await request.json();
  const { error } = await supabase.from("bookings").update({ status }).eq("id", id).eq("client_id", client.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
