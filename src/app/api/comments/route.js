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
    headers: { "Cache-Control": "no-store" },
  });
}, "comments");
