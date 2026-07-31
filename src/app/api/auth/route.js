import { NextResponse } from "next/server";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit.js";

export async function POST(request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit(`admin-auth:${ip}`, 5, 60000);
    if (!rl.ok) return tooManyRequests(rl.retryAfter);
    const { password } = await request.json();
    if (password && password === process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false }, { status: 401 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
