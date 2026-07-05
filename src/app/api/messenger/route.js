export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { parseMessengerEvent } from "@/lib/messenger.js";
import { handleIncoming } from "@/lib/bot.js";

const VERIFY_TOKENS = [process.env.FACEBOOK_VERIFY_TOKEN, "autologic"].filter(Boolean);

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  if (q.get("hub.mode") === "subscribe" && VERIFY_TOKENS.includes(q.get("hub.verify_token"))) {
    return new Response(q.get("hub.challenge"), { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const event = parseMessengerEvent(body);
    if (!event) return NextResponse.json({ status: "ignored" });
    await handleIncoming(event);
    return NextResponse.json({ status: "ok" });
  } catch (e) {
    console.error("messenger route:", e.message);
    return NextResponse.json({ status: "error" });
  }
}
