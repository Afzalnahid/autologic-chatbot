import { NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/supabase.js";

export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json(settings || {});
  } catch { return NextResponse.json({}); }
}

export async function POST(request) {
  try {
    const settings = await request.json();
    await saveSettings(settings);
    return NextResponse.json({ status: "saved" });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
