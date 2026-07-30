export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { parseMessengerEvent, parseCommentEvent } from "@/lib/messenger.js";
import { handleIncoming, handleComment } from "@/lib/bot.js";

const VERIFY_TOKENS = [process.env.FACEBOOK_VERIFY_TOKEN].filter(Boolean);

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

    // Diagnostic: log the raw shape so channel-matching failures are visible.
    console.log("[webhook] object=", body?.object, "raw=", JSON.stringify(body).slice(0, 800));

    // A Page comment ("feed" change) rather than a direct message.
    const comment = parseCommentEvent(body);
    if (comment) {
      console.log("[webhook] comment event pageId=", comment.pageId, "platform=", comment.platform);
      await handleComment(comment);
      return NextResponse.json({ status: "ok" });
    }

    const event = parseMessengerEvent(body);
    if (!event) {
      console.log("[webhook] no event parsed — ignored");
      return NextResponse.json({ status: "ignored" });
    }
    console.log("[webhook] msg event platform=", event.platform, "pageId=", event.pageId, "senderId=", event.senderId);
    await handleIncoming(event);
    return NextResponse.json({ status: "ok" });
  } catch (e) {
    console.error("messenger route:", e.message);
    return NextResponse.json({ status: "error" });
  }
}
