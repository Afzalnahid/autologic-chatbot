export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase.js";

const SUPER_ADMIN = "nahidafzal97@gmail.com";

async function callerEmail(request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cchvsgouqqxibhubioch.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_L0-ea26IunVN_BET5SPXOw_VY_KwGZg"
  );
  const { data } = await anon.auth.getUser(token);
  return (data?.user?.email || "").toLowerCase() || null;
}

// GET: show exactly what the app's service-role client sees in file_registry + knowledge_base
export async function GET(request) {
  const email = await callerEmail(request);
  if (email !== SUPER_ADMIN) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const [fr, kb] = await Promise.all([
    supabase.from("file_registry").select("*"),
    supabase.from("knowledge_base").select("id,client_id,file_id,metadata"),
  ]);
  return NextResponse.json({
    file_registry: fr.data || [],
    file_registry_error: fr.error?.message || null,
    knowledge_base_count: (kb.data || []).length,
    knowledge_base: kb.data || [],
    knowledge_base_error: kb.error?.message || null,
  }, { headers: { "Cache-Control": "no-store" } });
}

// POST: delete ALL rows from file_registry and knowledge_base (super admin only, hard reset)
export async function POST(request) {
  const email = await callerEmail(request);
  if (email !== SUPER_ADMIN) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { confirm } = await request.json().catch(() => ({}));
  if (confirm !== "WIPE") return NextResponse.json({ error: "need confirm:WIPE" }, { status: 400 });

  // Delete every row using a always-true filter on the app's service-role client.
  const kbDel = await supabase.from("knowledge_base").delete().neq("id", 0);
  const frDel = await supabase.from("file_registry").delete().neq("file_id", "___never___");

  return NextResponse.json({
    ok: true,
    knowledge_base_error: kbDel.error?.message || null,
    file_registry_error: frDel.error?.message || null,
  }, { headers: { "Cache-Control": "no-store" } });
}
