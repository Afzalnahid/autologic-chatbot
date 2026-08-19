export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { requireClient } from "@/lib/auth.js";

export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { sender_id, text } = await request.json();
    if (!sender_id || !text) return NextResponse.json({ error: "missing fields" }, { status: 400 });

    const { data: mb } = await supabase.from("message_buffer").select("platform,page_id,client_id,sender_id")
      .eq("client_id", client.id).eq("sender_id", sender_id).order("created_at",{ascending:false}).limit(1);
    const platform = mb?.[0]?.platform || "facebook";
    const pageId = mb?.[0]?.page_id || null;

    // Reply through the SAME page/account/number the conversation lives on.
    // Older messages have no page_id — those fall back to the platform match,
    // which is exact whenever the client has one account per platform.
    const { data: chans } = await supabase.from("channels").select("*").eq("status", "connected").eq("client_id", client.id);
    const ch = (pageId && (chans || []).find(c => c.platform === platform && c.page_id === pageId))
      || (chans || []).find(c => c.platform === platform)
      || (chans || [])[0];
    if (!ch) return NextResponse.json({ error: "no connected channel" }, { status: 400 });

    if (platform === "whatsapp") {
      const wa = await fetch(`https://graph.facebook.com/v24.0/${ch.page_id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ch.access_token}` },
        body: JSON.stringify({ messaging_product: "whatsapp", to: sender_id, type: "text", text: { body: text } }),
      }).then(r => r.json());
      if (wa.error) return NextResponse.json({ error: wa.error.message }, { status: 502 });
    } else {
      const fbData = await fetch(`https://graph.facebook.com/v24.0/me/messages?access_token=${ch.access_token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: { id: sender_id }, messaging_type: "MESSAGE_TAG", tag: "HUMAN_AGENT", message: { text } }),
      }).then(r => r.json());
      if (fbData.error) return NextResponse.json({ error: fbData.error.message }, { status: 502 });
    }

    await supabase.from("message_buffer").insert({
      sender_id, message_content: text, status: "Replied", role: "agent", client_id: client.id, platform, page_id: ch.page_id || null,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
