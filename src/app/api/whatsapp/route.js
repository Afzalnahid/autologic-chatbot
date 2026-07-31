export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import crypto from "crypto";
import { parseWhatsAppEvent, parseWhatsAppStatus } from "@/lib/messenger.js";
import { handleIncoming } from "@/lib/bot.js";

const VERIFY_TOKENS = [process.env.FACEBOOK_VERIFY_TOKEN].filter(Boolean);

function verifyFBSignature(rawBody, signatureHeader) {
  const secret = process.env.FB_APP_SECRET || process.env.FACEBOOK_APP_SECRET;
  if (!secret) {
    console.warn("[whatsapp] FB_APP_SECRET not set — skipping signature check");
    return true;
  }
  if (!signatureHeader) return false;
  const parts = signatureHeader.split("=");
  if (parts[0] !== "sha256" || !parts[1]) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(parts[1], "hex"), Buffer.from(expected, "hex"));
  } catch { return false; }
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
      console.warn("[whatsapp] Invalid X-Hub-Signature-256 — rejected");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);

    const status = parseWhatsAppStatus(body);
    if (status) {
      if (status.status === "read") {
        console.log(`[wa] message ${status.msgId} read by ${status.recipientId}`);
      }
      return NextResponse.json({ status: "ok" });
    }

    const event = parseWhatsAppEvent(body);
    if (!event) return NextResponse.json({ status: "ignored" });
    await handleIncoming(event);
    return NextResponse.json({ status: "ok" });
  } catch (e) {
    console.error("whatsapp route:", e.message);
    return NextResponse.json({ status: "error" });
  }
}
