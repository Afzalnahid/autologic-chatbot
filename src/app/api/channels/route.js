export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { requireClient } from "@/lib/auth.js";

export async function GET(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json([]);
    const { data } = await supabase.from("channels").select("*").order("created_at", { ascending: false });
    return NextResponse.json((data || []).filter(c => c.client_id === client.id).map(({ access_token, ...r }) => r));
  } catch {
    return NextResponse.json([]);
  }
}

export async function PUT(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { id, status, comment_reply_enabled, comment_dm_enabled } = await request.json();
    const patch = {};
    if (status !== undefined) patch.status = status;
    if (comment_reply_enabled !== undefined) patch.comment_reply_enabled = comment_reply_enabled;
    if (comment_dm_enabled !== undefined) patch.comment_dm_enabled = comment_dm_enabled;
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: "nothing to update" }, { status: 400 });
    await supabase.from("channels").update(patch).eq("id", id).eq("client_id", client.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
    const { error } = await supabase.from("channels").delete().eq("id", id).eq("client_id", client.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { platform, page_id, access_token } = await request.json();
    if (!platform || !page_id || !access_token) return NextResponse.json({ error: "missing fields" }, { status: 400 });
    const { error } = await supabase.from("channels").upsert(
      { client_id: client.id, platform, page_id, access_token, status: "connected", connected_at: new Date().toISOString() },
      { onConflict: "client_id,platform,page_id" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
