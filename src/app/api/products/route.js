import { NextResponse } from "next/server";
import { getProducts, deleteProduct } from "@/lib/supabase.js";
import { ingestProduct } from "@/lib/vector-pipeline.js";

export async function GET() {
  try {
    const products = await getProducts();
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
