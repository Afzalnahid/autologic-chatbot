export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { supabase } from "@/lib/supabase.js";

// Temporary diagnostic: shows exactly which permissions Facebook has actually
// granted the stored page token. Delete once the inbox-reply issue is resolved.
export async function GET(request) {
  const { client } = await requireClient(request);
  if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: channels } = await supabase
    .from("channels").select("*").eq("client_id", client.id).eq("platform", "facebook");

  const ch = (channels || [])[0];
  if (!ch) return NextResponse.json({ error: "no facebook channel connected" });

  const perms = await fetch(
    `https://graph.facebook.com/v24.0/me/permissions?access_token=${ch.access_token}`
  ).then(r => r.json()).catch(e => ({ error: e.message }));

  const debugToken = await fetch(
    `https://graph.facebook.com/v24.0/debug_token?input_token=${ch.access_token}&access_token=${ch.access_token}`
  ).then(r => r.json()).catch(e => ({ error: e.message }));

  const subs = await fetch(
    `https://graph.facebook.com/v24.0/${ch.page_id}/subscribed_apps?access_token=${ch.access_token}`
  ).then(r => r.json()).catch(e => ({ error: e.message }));

  return NextResponse.json({
    page_id: ch.page_id,
    granted: (perms.data || []).filter(p => p.status === "granted").map(p => p.permission),
    declined: (perms.data || []).filter(p => p.status !== "granted").map(p => p.permission),
    token_scopes: debugToken?.data?.scopes || null,
    token_type: debugToken?.data?.type || null,
    subscribed_fields: subs?.data?.[0]?.subscribed_fields || null,
    raw_permission_error: perms.error || null,
  }, { headers: { "Cache-Control": "no-store" } });
}
