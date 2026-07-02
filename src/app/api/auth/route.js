import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { password } = await request.json();
    if (password && password === process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false }, { status: 401 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
