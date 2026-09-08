export const dynamic = "force-dynamic";
export const maxDuration = 30;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { supabase } from "@/lib/supabase.js";

// Uploads one category-overview cover image and returns its public URL. The
// owner pastes that URL into a collection in Inventory → Overview image, which
// is saved (with the intro) into app_settings.settings.collections. Kept in the
// `logos` bucket, deliberately away from `product-images`: a collection cover is
// not a product photo and must never be swept by the product-image cleanup that
// runs when a product is deleted.
export async function POST(request) {
  const { client, error: authErr } = await requireClient(request);
  if (authErr) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!client) return NextResponse.json({ error: "client_not_found" }, { status: 404 });
  try {
    const form = await request.formData();
    const file = form.get("cover");
    if (!file || typeof file === "string") return NextResponse.json({ error: "no file" }, { status: 400 });
    const ext = (file.name?.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `${client.id}/collection_${Date.now()}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage.from("logos").upload(path, buf, { contentType: file.type || "image/png", upsert: true });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    const url = supabase.storage.from("logos").getPublicUrl(path).data.publicUrl;
    return NextResponse.json({ ok: true, cover_url: url }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
