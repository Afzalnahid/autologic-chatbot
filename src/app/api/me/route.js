export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { requireClient, trialActive } from "@/lib/auth.js";
import { warnIfExpiringSoon } from "@/lib/expiry.js";
import { withErrors } from "@/lib/route-errors.js";
import { startOfDayDhaka } from "@/lib/time.js";
import { trialDays, limitsFor } from "@/lib/plan-limits.js";
import { countBillableMessages } from "@/lib/message-usage.js";

export const GET = withErrors(async (request) => {
  const { client, email, error } = await requireClient(request);
  if (error) return NextResponse.json({ error }, { status: 401 });
  if (!client) return NextResponse.json({ client: null, email });

  // client_id filtered at the DB (not in JS afterwards — see lessons.md #14),
  // "today" anchored to Dhaka midnight (not UTC midnight / 6am Dhaka time).
  // Today's usage = bot replies today (owner's rule), matching what the trial's
  // daily limit actually enforces in botAllowed.
  const used = await countBillableMessages(client.id, startOfDayDhaka().toISOString());

  // The daily cron (/api/cron/expiry) is what really sends this. Opening the
  // dashboard checks too, as a safety net for a missed run — the same function,
  // and it refuses to send twice for one expiry date, so there is no risk of a
  // duplicate email.
  warnIfExpiringSoon(client).catch(() => {});

  return NextResponse.json({
    client: { id: client.id, business_name: client.business_name, plan: client.plan, trial_end: client.trial_end, business_type: client.business_type || "ecommerce", item_label: client.item_label || "", logo_url: client.logo_url || "" },
    email,
    active: trialActive(client),
    // The daily ceiling comes from the package (and any per-client override),
    // the same merge the bot enforces. It was written here as a literal 30,
    // so raising the trial's daily allowance in the admin panel changed what
    // the bot allowed and not what the header told the owner they had.
    usage: { today: used, limit: (await limitsFor(client)).messagesPerDay ?? null },
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
    // Somebody already on a paid package must not be dropped back onto a trial
    // by pressing "start free trial" again. This tested one id — "pro" — so
    // every OTHER paid package could restart a trial and lose its expiry date.
    // Anything that is not the trial and not "no plan" is a live package.
    if (client.plan && client.plan !== "trial" && client.plan !== "none") {
      return NextResponse.json({ ok: true });
    }
    const now = new Date();
    const days = await trialDays();
    const end = new Date(now.getTime() + days * 24 * 3600 * 1000);
    await supabase.from("clients").update({ plan: "trial", trial_start: now.toISOString(), trial_end: end.toISOString(), trial_notified: false }).eq("id", client.id);
    return NextResponse.json({ ok: true, trial_end: end.toISOString() });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}, "me");
