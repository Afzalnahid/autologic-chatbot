export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { requireClient } from "@/lib/auth.js";
import { withErrors } from "@/lib/route-errors.js";
import { newWidgetKey, normalizeDomain } from "@/lib/widget.js";

const PLATFORM = "website";
const MAX_DOMAINS = 10;

function cleanDomains(list) {
  const out = [];
  for (const d of Array.isArray(list) ? list : []) {
    const n = normalizeDomain(d);
    if (n && !out.includes(n)) out.push(n);
    if (out.length >= MAX_DOMAINS) break;
  }
  return out;
}

async function existing(clientId) {
  const { data } = await supabase
    .from("channels").select("*")
    .eq("client_id", clientId).eq("platform", PLATFORM)
    .maybeSingle();
  return data || null;
}

export const GET = withErrors(async (request) => {
  const { client, error } = await requireClient(request);
  if (error || !client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const row = await existing(client.id);
  if (!row) return NextResponse.json({ channel: null });
  const { access_token, ...safe } = row;
  return NextResponse.json({ channel: safe });
}, "channels-website");

// Creates the widget, or rotates its key. One website channel per tenant.
export const POST = withErrors(async (request) => {
  const { client, error } = await requireClient(request);
  if (error || !client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const domains = cleanDomains(body.allowed_domains);
  const row = await existing(client.id);

  if (row && !body.rotate) {
    return NextResponse.json({ error: "Your website widget already exists." }, { status: 409 });
  }
  if (!row && !domains.length) {
    return NextResponse.json({ error: "Add the website address where the chat will appear." }, { status: 400 });
  }

  const key = newWidgetKey();

  if (row) {
    const { data, error: upErr } = await supabase.from("channels")
      .update({ page_id: key })
      .eq("id", row.id).eq("client_id", client.id)
      .select().single();
    if (upErr) {
      console.error("[widget] rotate:", upErr.message);
      return NextResponse.json({ error: "Could not create a new key. Please try again." }, { status: 500 });
    }
    const { access_token, ...safe } = data;
    return NextResponse.json({ channel: safe, rotated: true });
  }

  const { data, error: insErr } = await supabase.from("channels").insert({
    client_id: client.id,
    platform: PLATFORM,
    page_id: key,
    status: "connected",
    bot_enabled: true,
    allowed_domains: domains,
    connected_at: new Date().toISOString(),
  }).select().single();

  if (insErr) {
    console.error("[widget] create:", insErr.message);
    return NextResponse.json({ error: "Could not create the widget. Please try again." }, { status: 500 });
  }
  const { access_token, ...safe } = data;
  return NextResponse.json({ channel: safe });
}, "channels-website");

// Updates the allowed website list.
export const PATCH = withErrors(async (request) => {
  const { client, error } = await requireClient(request);
  if (error || !client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const domains = cleanDomains(body.allowed_domains);
  if (!domains.length) {
    return NextResponse.json({ error: "Keep at least one website address, or the chat cannot load anywhere." }, { status: 400 });
  }

  const row = await existing(client.id);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data, error: upErr } = await supabase.from("channels")
    .update({ allowed_domains: domains })
    .eq("id", row.id).eq("client_id", client.id)
    .select().single();

  if (upErr) {
    console.error("[widget] domains:", upErr.message);
    return NextResponse.json({ error: "Could not save. Please try again." }, { status: 500 });
  }
  const { access_token, ...safe } = data;
  return NextResponse.json({ channel: safe });
}, "channels-website");
