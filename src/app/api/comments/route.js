export const dynamic = "force-dynamic";
export const revalidate = 0;
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { supabase } from "@/lib/supabase.js";
import { withErrors } from "@/lib/route-errors.js";

export const GET = withErrors(async (request) => {
  const { client, error: authErr } = await requireClient(request);
  if (authErr || !client) return NextResponse.json([], { status: authErr ? 401 : 200 });

  const { data } = await supabase
    .from("comments")
    .select("*")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false })
    .limit(300);

  return NextResponse.json(data || [], {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "CDN-Cache-Control": "no-store",
    },
  });
}, "comments");

// Remove a comment record from the dashboard. This deletes only our own row —
// the comment stays on Facebook or Instagram, which we cannot and should not
// touch. Clients need this to clear failed or test entries from their history.
export const DELETE = withErrors(async (request) => {
  const { client, error: authErr } = await requireClient(request);
  if (authErr || !client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // Scope by client_id so one tenant can never delete another tenant's row.
  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", id)
    .eq("client_id", client.id);

  if (error) {
    console.error("[comments] delete failed:", error.message);
    return NextResponse.json({ error: "Could not delete" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}, "comments-delete");
