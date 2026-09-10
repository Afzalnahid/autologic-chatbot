export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";
import { notify, pushEnabled } from "@/lib/push.js";
import { fcmEnabled } from "@/lib/fcm.js";

// "Send a test notification" from the Profile card. It runs the exact same path
// a real order/booking/message uses, so if this arrives on the phone the whole
// chain works — and if it does not, the JSON says why (the server has no VAPID
// keys, or this device has no saved subscription) instead of failing silently.
export async function POST(request) {
  const { client } = await requireClient(request);
  if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!pushEnabled() && !fcmEnabled()) {
    return NextResponse.json({ ok: false, reason: "not_configured", sent: 0 }, { status: 200 });
  }

  // Same path a real order/booking/message takes — both channels (browser Web
  // Push and the native app's FCM), so the test proves whichever the owner uses.
  const r = await notify(client.id, {
    title: "🔔 getvoicium",
    body: "Test notification — if you can see this, alerts are working.",
    url: "/dashboard",
    tag: "gv-test",
  });
  return NextResponse.json({ ok: (r.sent || 0) > 0, ...r }, { status: 200 });
}
