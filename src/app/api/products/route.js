export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { supabase } from "@/lib/supabase.js";

export async function GET(request) {
  const { client, error: authErr } = await requireClient(request);
  if (authErr || !client) return NextResponse.json([], { status: authErr ? 401 : 200 });
  const { data: rows } = await supabase.from("products").select("id,metadata,client_id").limit(1000);
  const products = (rows || []).filter(r => r.client_id === client.id).map(r => ({ id: r.id, ...(r.metadata || {}) }));
  return NextResponse.json(products);
}

export async function DELETE(request) {
  const { client } = await requireClient(request);
  if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await request.json();
  const { error } = await supabase.from("products").delete().eq("id", id).eq("client_id", client.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: "deleted" });
}
