export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { requireClient } from "@/lib/auth.js";

export async function GET(request) {
  const out = {};
  const { data: cl, error: e1 } = await supabase.from("clients").select("*");
  out.clients = e1 ? e1.message : (cl || []).map(c => c.owner_email);
  const r = await requireClient(request);
  out.auth = r.error || null;
  out.email = r.email || null;
  out.client_found = !!r.client;
  const { data: mb } = await supabase.from("message_buffer").select("client_id").limit(3);
  out.mb_sample = (mb || []).map(m => m.client_id);
  return NextResponse.json(out);
}
