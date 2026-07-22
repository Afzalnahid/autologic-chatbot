export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { requireClient } from "@/lib/auth.js";

export async function GET(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({});
    const { data: rows } = await supabase.from("app_settings").select("*");
    const row = (rows || []).find(r => r.id === String(client.id));
    return NextResponse.json(row?.settings || {});
  } catch { return NextResponse.json({}); }
}

export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const settings = await request.json();
    const { error } = await supabase.from("app_settings").upsert({ id: String(client.id), settings }, { onConflict: "id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ status: "saved" });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Merge a few keys without overwriting the rest of the settings object.
export async function PATCH(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const patch = await request.json();
    const { data: rows } = await supabase.from("app_settings").select("*");
    const row = (rows || []).find(r => r.id === String(client.id));
    const merged = { ...(row?.settings || {}), ...patch };
    const { error } = await supabase.from("app_settings").upsert({ id: String(client.id), settings: merged }, { onConflict: "id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ status: "saved", settings: merged });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
