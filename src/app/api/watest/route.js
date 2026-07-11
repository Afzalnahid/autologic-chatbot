export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { getChannelByPage } from "@/lib/bot.js";

export async function GET() {
  const out = {};
  const ch = await getChannelByPage("1136966472839695");
  out.channel = ch ? { platform: ch.platform, page_id: ch.page_id, client_id: ch.client_id, hasToken: !!ch.access_token } : null;
  if (ch) {
    const r = await fetch(`https://graph.facebook.com/v24.0/${ch.page_id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ch.access_token}` },
      body: JSON.stringify({ messaging_product: "whatsapp", to: "8801690000732", type: "text", text: { body: "test from server" } }),
    });
    out.send = await r.json();
  }
  return NextResponse.json(out);
}
