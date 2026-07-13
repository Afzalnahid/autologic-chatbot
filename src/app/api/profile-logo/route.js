export const dynamic = "force-dynamic";
export const maxDuration = 30;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { supabase } from "@/lib/supabase.js";

export async function POST(request) {
  const { client, error: authErr } = await requireClient(request);
  if (authErr) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!client) return NextResponse.json({ error: "client_not_found" }, { status: 404 });
  try {
    const form = await request.formData();
    const file = form.get("logo");
    if (!file || typeof file === "string") return NextResponse.json({ error: "no file" }, { status: 400 });
    const ext = (file.name?.split(".").pop() || "png").toLowerCase();
    const path = `${client.id}/logo_${Date.now()}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage.from("logos").upload(path, buf, { contentType: file.type || "image/png", upsert: true });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    const url = supabase.storage.from("logos").getPublicUrl(path).data.publicUrl;
    const { error } = await supabase.from("clients").update({ logo_url: url }).eq("id", client.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, logo_url: url }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const { client, error: authErr } = await requireClient(request);
  if (authErr) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!client) return NextResponse.json({ error: "client_not_found" }, { status: 404 });
  await supabase.from("clients").update({ logo_url: null }).eq("id", client.id);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
