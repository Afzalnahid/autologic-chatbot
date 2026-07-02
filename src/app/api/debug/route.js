export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";

export async function GET() {
  const key = process.env.SUPABASE_SERVICE_KEY || "";
  let role = "unknown";
  try { role = JSON.parse(Buffer.from(key.split(".")[1], "base64").toString()).role; } catch {}
  const out = { key_role: role };
  for (const t of ["contacts", "channels", "message_buffer", "products", "orders"]) {
    const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
    out[t] = error ? error.message : count;
  }
  const { data: mb } = await supabase.from("message_buffer").select("role").limit(5);
  out.sample_roles = (mb || []).map(r => r.role);
  const { data: f1, error: fe1 } = await supabase.from("message_buffer").select("sender_id").eq("role", "customer");
  out.filter_test = fe1 ? fe1.message : (f1 || []).length;
  const { data: f2, error: fe2 } = await supabase.from("contacts").select("sender_id, name, bot_enabled");
  out.contacts_sel = fe2 ? fe2.message : (f2 || []).length;
  return NextResponse.json(out);
}
