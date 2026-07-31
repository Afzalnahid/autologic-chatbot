export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { requireClient } from "@/lib/auth.js";

export async function GET(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { data: row } = await supabase
      .from("app_settings")
      .select("*")
      .eq("id", String(client.id))
      .maybeSingle();
    return NextResponse.json(row?.settings || {});
  } catch {
    return NextResponse.json({}, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const settings = await request.json();
    const { error } = await supabase
      .from("app_settings")
      .upsert({ id: String(client.id), settings }, { onConflict: "id" });
    if (error) {
      console.error("[settings POST]", error.message);
      return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
    }
    return NextResponse.json({ status: "saved" });
  } catch (e) {
    console.error("[settings POST]", e.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const patch = await request.json();
    const { data: row } = await supabase
      .from("app_settings")
      .select("*")
      .eq("id", String(client.id))
      .maybeSingle();
    const merged = { ...(row?.settings || {}), ...patch };
    const { error } = await supabase
      .from("app_settings")
      .upsert({ id: String(client.id), settings: merged }, { onConflict: "id" });
    if (error) {
      console.error("[settings PATCH]", error.message);
      return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
    }
    return NextResponse.json({ status: "saved", settings: merged });
  } catch (e) {
    console.error("[settings PATCH]", e.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
