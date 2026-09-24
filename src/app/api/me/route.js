export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { logEvent } from "@/lib/platform-events.js";
import { supabase } from "@/lib/supabase.js";
import { requireClient, trialActive } from "@/lib/auth.js";
import { warnIfExpiringSoon } from "@/lib/expiry.js";
import { withErrors } from "@/lib/route-errors.js";
import { startOfDayDhaka } from "@/lib/time.js";
import { trialDays, limitsFor } from "@/lib/plan-limits.js";
import { countBillableMessages } from "@/lib/message-usage.js";
import { inboxLocked, lockedSince } from "@/lib/inbox-lock.js";

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

  // A lapsed plan locks the inbox, but every message is still saved. Say how
  // many different customers have written since the lock began, so the lock
  // screen can tell the owner what is waiting for them. One query, and only
  // for a locked account; client_id filtered at the database.
  let inbox = { locked: false };
  if (inboxLocked(client)) {
    const since = lockedSince(client);
    let waiting = null;
    try {
      let q = supabase.from("message_buffer").select("sender_id").eq("client_id", client.id).eq("role", "customer").limit(5000);
      if (since) q = q.gte("created_at", since);
      const { data } = await q;
      waiting = new Set((data || []).map((r) => r.sender_id)).size;
    } catch { /* the lock screen simply leaves the count out */ }
    inbox = { locked: true, since, waiting };
  }

  // Does this person also run the platform? Only so the dashboard can offer a
  // way into the admin console — every admin action is guarded where it is
  // done, so this flag grants nothing by itself. Without it an admin on the
  // phone could reach /admin only by tapping a notification or typing the
  // address (owner, 2026-09-24: "should I need an admin app?" — no, but there
  // has to be a door).
  let isAdmin = false;
  try {
    const { data: a } = await supabase.from("admin_users").select("role").eq("email", email).maybeSingle();
    isAdmin = !!(a?.role && a.role !== "pending" && a.role !== "blocked");
  } catch { /* the dashboard simply shows no admin door */ }

  return NextResponse.json({
    client: { id: client.id, business_name: client.business_name, plan: client.plan, trial_end: client.trial_end, business_type: client.business_type || "ecommerce", item_label: client.item_label || "", logo_url: client.logo_url || "" },
    email,
    is_admin: isAdmin,
    active: trialActive(client),
    inbox,
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
    // The platform owner asked to be told when a business arrives (2026-09-24).
    // Fire-and-forget: a signup must never wait on, or fail because of, a bell.
    logEvent({
      kind: "client_signup",
      title: "A new business signed up",
      body: email,
      clientId: data.id,
      clientName: businessName,
    }).catch(() => {});

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
