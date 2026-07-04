export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth.js";

const N8N_IMPORT_URL = process.env.N8N_IMPORT_WEBHOOK_URL || "https://stylish-lobster.pikapod.net/webhook/import-products";

export async function POST(request) {
  try {
    const { client } = await requireClient(request);
    if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { siteUrl, ck, cs } = await request.json();
    if (!siteUrl || !ck || !cs) return NextResponse.json({ error: "missing fields" }, { status: 400 });
    const r = await fetch(N8N_IMPORT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: String(client.id), siteUrl, ck, cs }),
    });
    const text = await r.text();
    try {
      const d = JSON.parse(text);
      if (d.ok) return NextResponse.json({ ok: true, imported: d.imported || 0 });
      return NextResponse.json({ error: d.message || text || "import failed" }, { status: 502 });
    } catch {
      return NextResponse.json({ error: text || "import failed" }, { status: 502 });
    }
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
