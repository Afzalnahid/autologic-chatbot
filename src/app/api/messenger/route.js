export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import crypto from "crypto";
import { parseMessengerEvent, parseCommentEvent } from "@/lib/messenger.js";
import { handleIncoming, handleComment } from "@/lib/bot.js";

const VERIFY_TOKENS = [process.env.FACEBOOK_VERIFY_TOKEN].filter(Boolean);

// Facebook and Instagram are two separate Meta apps here, each signing its own
// webhooks with its own secret. A delivery is genuine if it matches either one.
function verifyFBSignature(rawBody, signatureHeader) {
  const secrets = [
    process.env.FB_APP_SECRET || process.env.FACEBOOK_APP_SECRET,
    process.env.IG_APP_SECRET,
  ].filter(Boolean);

  if (!secrets.length) {
    console.warn("[messenger] no app secret set — skipping signature check");
    return true;
  }
  if (!signatureHeader) return false;
  const parts = signatureHeader.split("=");
  if (parts[0] !== "sha256" || !parts[1]) return false;

  let given;
  try { given = Buffer.from(parts[1], "hex"); } catch { return false; }

  return secrets.some((secret) => {
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest();
    if (given.length !== expected.length) return false;
    try { return crypto.timingSafeEqual(given, expected); } catch { return false; }
  });
}

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  if (q.get("hub.mode") === "subscribe" && VERIFY_TOKENS.includes(q.get("hub.verify_token"))) {
    return new Response(q.get("hub.challenge"), { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request) {
  try {
    const rawBody = await request.text();
    const sig = request.headers.get("x-hub-signature-256") || "";

    if (!verifyFBSignature(rawBody, sig)) {
      console.warn("[messenger] Invalid X-Hub-Signature-256 — rejected");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);

    console.log("[webhook] object=", body?.object, "raw=", JSON.stringify(body).slice(0, 800));

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
