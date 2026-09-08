export const dynamic = "force-dynamic";
export const maxDuration = 30;
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { requireClient } from "@/lib/auth.js";
import { pageAll } from "@/lib/page.js";
import { shapeMessage } from "@/lib/messages-view.js";

// The FULL history of ONE conversation, oldest → newest. The list endpoint
// (/api/conversations) reads only a recent window across the whole account, so a
// long chat loses its older messages there. This is fetched when the owner opens
// a conversation, so — like Messenger — every message is there. Paged, so nothing
// is silently dropped at the PostgREST row cap.
export async function GET(request) {
  const { client } = await requireClient(request);
  if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sid = new URL(request.url).searchParams.get("sender_id");
  if (!sid) return NextResponse.json({ error: "missing sender_id" }, { status: 400 });
  try {
    const { rows } = await pageAll((from, to) => supabase
      .from("message_buffer")
      .select("role,message_content,attachments,created_at,status")
      .eq("client_id", client.id).eq("sender_id", sid)
      .order("created_at", { ascending: true }).range(from, to));
    return NextResponse.json({ messages: rows.map(shapeMessage) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
