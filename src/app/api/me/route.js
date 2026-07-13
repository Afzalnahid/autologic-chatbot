export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { requireClient, trialActive } from "@/lib/auth.js";

export async function GET(request) {
  const { client, email, error } = await requireClient(request);
  if (error) return NextResponse.json({ error }, { status: 401 });
  if (!client) return NextResponse.json({ client: null, email });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const { data: msgs } = await supabase.from("message_buffer").select("id,client_id,role,created_at");
  const used = (msgs || []).filter(m => m.client_id === client.id && (m.role || "customer") === "customer" && new Date(m.created_at) >= today).length;

  return NextResponse.json({
    client: { id: client.id, business_name: client.business_name, plan: client.plan, trial_end: client.trial_end, business_type: client.business_type || "ecommerce", item_label: client.item_label || "", logo_url: client.logo_url || "" },
    email,
    active: trialActive(client),
    usage: { today: used, limit: client.plan === "trial" ? 30 : null },
  });
}

export async function POST(request) {
  const { client, email, error } = await requireClient(request);
  if (error) return NextResponse.json({ error }, { status: 401 });
  const body = await request.json();

  if (body.action === "register") {
    if (client) return NextResponse.json({ ok: true, client_id: client.id });
    const { data, error: e } = await supabase.from("clients")
      .insert({ business_name: body.business_name || "My Business", owner_email: email, plan: "none" })
      .select().single();
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
    const { data: def } = await supabase.from("app_settings").select("settings").eq("id", "default").single();
    if (def?.settings) await supabase.from("app_settings").upsert({ id: String(data.id), settings: def.settings }, { onConflict: "id" });
    return NextResponse.json({ ok: true, client_id: data.id });
  }

  if (body.action === "start_trial") {
    if (!client) return NextResponse.json({ error: "no client" }, { status: 400 });
    if (client.plan === "pro") return NextResponse.json({ ok: true });
    const now = new Date();
    const end = new Date(now.getTime() + 3 * 24 * 3600 * 1000);
    await supabase.from("clients").update({ plan: "trial", trial_start: now.toISOString(), trial_end: end.toISOString(), trial_notified: false }).eq("id", client.id);
    return NextResponse.json({ ok: true, trial_end: end.toISOString() });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
