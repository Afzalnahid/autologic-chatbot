export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabase } from "@/lib/supabase.js";

const APP_SECRET = process.env.FB_APP_SECRET;

function parseSignedRequest(signedRequest) {
  if (!APP_SECRET) return null;
  const [encodedSig, payload] = signedRequest.split(".");
  const sig = Buffer.from(encodedSig.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const data = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
  const expected = crypto.createHmac("sha256", APP_SECRET).update(payload).digest();
  if (!crypto.timingSafeEqual(sig, expected)) return null;
  return data;
}

export async function POST(request) {
  try {
    const form = await request.formData();
    const data = parseSignedRequest(String(form.get("signed_request") || ""));
    if (!data) return NextResponse.json({ error: "invalid signature" }, { status: 400 });
    const userId = data.user_id;
    const code = "del_" + crypto.randomBytes(8).toString("hex");
    await supabase.from("message_buffer").delete().eq("sender_id", userId);
    await supabase.from("contacts").delete().eq("sender_id", userId);
    await supabase.from("chat_memory").delete().eq("session_id", userId);
    const origin = new URL(request.url).origin;
    return NextResponse.json({ url: `${origin}/privacy`, confirmation_code: code });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
