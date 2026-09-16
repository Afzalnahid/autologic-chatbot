export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { readSignedRequest, verifySignedRequest } from "@/lib/meta-signed-request.js";

// Meta calls this when someone removes TellMore AI from their Instagram
// settings. It posts a form field `signed_request`, signed with the Instagram
// app's secret; only a request that verifies is acted on. (Until 2026-09-17
// this route read a JSON user_id and checked nothing, so anyone who knew an
// account id could disconnect a client's Instagram.)
//
// Action: clear that account's token and mark the channel disconnected, for
// whichever client owns it. The channel is looked up first and then updated by
// its own id AND client_id, so the write stays tenant-scoped.
//
// user_id matching: we store the Instagram professional-account id
// (me.user_id) as channels.page_id. If Meta's user_id is the app-scoped id
// instead, nothing matches — that is logged (with the id) so the mapping can be
// confirmed from the Vercel logs, and nothing is changed by guesswork.
export async function POST(request) {
  const signed = await readSignedRequest(request);
  const v = verifySignedRequest(signed, { instagram: process.env.IG_APP_SECRET, facebook: process.env.FB_APP_SECRET });
  if (!v) return NextResponse.json({ error: "invalid signed_request" }, { status: 400 });

  try {
    const { data: rows, error } = await supabase
      .from("channels")
      .select("id, client_id")
      .eq("platform", "instagram")
      .eq("page_id", v.userId);
    if (error) throw error;
    for (const r of rows || []) {
      await supabase.from("channels")
        .update({ status: "disconnected", access_token: null })
        .eq("id", r.id)
        .eq("client_id", r.client_id);
    }
    console.log("[ig-deauth] app=", v.app, "user_id=", v.userId, "channels disconnected=", (rows || []).length);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[ig-deauth]", e?.message || e);
    // The request was genuine; answer 200 so Meta does not retry forever.
    return NextResponse.json({ success: true });
  }
}

// Meta (or a reviewer) may open the URL to check it exists.
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
