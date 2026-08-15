export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { requireClient, trialActive } from "@/lib/auth.js";
import { notifyExpiringSoon } from "@/lib/email.js";
import { withErrors } from "@/lib/route-errors.js";
import { startOfDayDhaka } from "@/lib/time.js";

// Warn the owner when a trial or paid plan ends within 3 days, at most once per
// plan period (tracked by expiry_warned_at against the current expiry date).
async function maybeWarnExpiry(client) {
  if (!client?.owner_email) return;
  const expiry = client.plan === "trial" ? client.trial_end : client.plan_expires_at;
  if (!expiry) return;

  const end = new Date(expiry);
  const now = new Date();
  const daysLeft = Math.ceil((end - now) / 86400000);
  if (daysLeft < 0 || daysLeft > 3) return; // only in the final 3-day window

  // Skip if we already warned for this exact expiry date.
  const warned = client.expiry_warned_at ? new Date(client.expiry_warned_at) : null;
  if (warned && Math.abs(warned - end) < 24 * 3600 * 1000) return;

  await notifyExpiringSoon(client.owner_email, {
    business: client.business_name,
    plan: client.plan,
    daysLeft: Math.max(0, daysLeft),
    expiresAt: expiry,
  });
  await supabase.from("clients").update({ expiry_warned_at: end.toISOString() }).eq("id", client.id);
}

export const GET = withErrors(async (request) => {
  const { client, email, error } = await requireClient(request);
  if (error) return NextResponse.json({ error }, { status: 401 });
  if (!client) return NextResponse.json({ client: null, email });

  // client_id filtered at the DB (not in JS afterwards — see lessons.md #14),
  // "today" anchored to Dhaka midnight (not UTC midnight / 6am Dhaka time).
  const today = startOfDayDhaka();
  const { count } = await supabase.from("message_buffer").select("id", { count: "exact", head: true })
    .eq("client_id", client.id).eq("role", "customer").gte("created_at", today.toISOString());
  const used = count || 0;

  // Lazy expiry warning: when the owner opens the dashboard and their plan ends
  // within 3 days, email them once per plan period. No cron needed.
  maybeWarnExpiry(client).catch(() => {});

  return NextResponse.json({
    client: { id: client.id, business_name: client.business_name, plan: client.plan, trial_end: client.trial_end, business_type: client.business_type || "ecommerce", item_label: client.item_label || "", logo_url: client.logo_url || "" },
    email,
    active: trialActive(client),
    usage: { today: used, limit: client.plan === "trial" ? 30 : null },
  });
}, "me");

export const POST = withErrors(async (request) => {
  const { client, email, error } = await requireClient(request);
  if (error) return NextResponse.json({ error }, { status: 401 });
  const body = await request.json();

  if (body.action === "register") {
    if (client) return NextResponse.json({ ok: true, client_id: client.id });
    const businessName = body.business_name || "My Business";
    const { data, error: e } = await supabase.from("clients")
      .insert({ business_name: businessName, owner_email: email, plan: "none" })
      .select().single();
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });

    // Seed settings from the new client's own name. Copying a shared "default"
    // row leaked one tenant's brand, prompt and greeting into every new signup,
    // so the starting point is now generated per client and stays neutral until
    // they describe their business in onboarding.
    await supabase.from("app_settings").upsert({
      id: String(data.id),
      settings: {
        botName: `${businessName} Assistant`,
        businessName,
        greeting: `Hello! Welcome to ${businessName}. How can I help you today?`,
        systemPrompt: "",
        tone: "Friendly and helpful",
        languages: "Bangla and English",
      },
    }, { onConflict: "id" });

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
}, "me");
