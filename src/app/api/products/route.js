export const dynamic = "force-dynamic";
import { requireClient } from "@/lib/auth.js";
import { NextResponse } from "next/server";
import { getProducts, deleteProduct } from "@/lib/supabase.js";
import { ingestProduct } from "@/lib/vector-pipeline.js";

export async function GET(request) {
  const { client, error: authErr } = await requireClient(request);
  if (authErr || !client) return NextResponse.json([], { status: authErr ? 401 : 200 });
  try {
    const { data: rows } = await (await import("@/lib/supabase.js")).supabase.from("products").select("id,metadata,client_id").limit(500);
    const products = (rows || []).filter(r => r.client_id === client.id).map(r => ({ id: r.id, ...(r.metadata || {}) }));
    return NextResponse.json(products);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const product = await request.json();
    const result = await ingestProduct(product);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { id } = await request.json();
    await deleteProduct(id);
    return NextResponse.json({ status: "deleted" });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
