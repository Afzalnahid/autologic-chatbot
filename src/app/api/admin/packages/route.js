export const dynamic = "force-dynamic";
export const revalidate = 0;
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { callerEmail, callerRole, CAN_EDIT, CAN_DELETE } from "@/lib/admin-auth.js";
import { loadPrices, summarise, dhakaDay } from "@/lib/usage.js";
import { invalidatePlans, loadPlans } from "@/lib/plan-limits.js";
import { getPlatformAI } from "@/lib/platform-ai.js";

// The economics side of the admin panel: packages (what we sell), the model
// price book (what the AI costs us), fixed platform costs, and the real usage
// each client generated — so "am I making money on this client?" has an answer
// instead of a guess.

const BILLING_SETTINGS = "billing";
const DEFAULTS = { usd_bdt: 120 };

async function billingSettings() {
  const { data } = await supabase.from("app_settings").select("settings").eq("id", BILLING_SETTINGS).maybeSingle();
  return { ...DEFAULTS, ...(data?.settings || {}) };
}

// Read every row a query would return, a page at a time.
//
// PostgREST answers an unbounded select with at most its configured max-rows
// and says nothing about the ones it left behind, so a plain `.select()` used
// for COUNTING is a number that is right until the platform gets busy and then
// silently wrong. Paging asks for exactly what it gets.
//
// `truncated` is the honest half: past the ceiling the answer is a floor, and
// the panel is told so rather than being handed a smaller number that looks
// like a quiet month.
const PAGE = 1000;
const MAX_MSGS = 200000;
async function pageAll(fetchPage, max = MAX_MSGS) {
  const rows = [];
  for (let from = 0; from < max; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) return { rows, truncated: false, error: error.message };
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < PAGE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

const daysAgo = (n) => {
  const d = new Date(Date.now() - n * 86400000);
  return dhakaDay(d);
};

export async function GET(request) {
  const email = await callerEmail(request);
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = await callerRole(email);
  if (!CAN_EDIT.includes(role)) return NextResponse.json({ error: "forbidden", role }, { status: 403 });

  const days = Math.min(365, Math.max(1, Number(new URL(request.url).searchParams.get("days")) || 30));
  const since = daysAgo(days);

  const [plansQ, pricesMap, costsQ, usageQ, clientsQ, channelsQ, settings] = await Promise.all([
    supabase.from("plans").select("*").order("sort"),
    loadPrices(),
    supabase.from("platform_costs").select("*").order("id"),
    // Paged for the same reason as the messages below: every cost figure on
    // the screen is a sum of these rows, and a capped read is a cost report
    // that is quietly too low.
    pageAll((from, to) => supabase.from("usage_daily").select("*").gte("day", since).order("day", { ascending: true }).range(from, to)),
    supabase.from("clients").select("id,business_name,owner_email,plan,suspended,plan_expires_at,limit_overrides,model_chain,business_type"),
    supabase.from("channels").select("id,client_id,platform,page_id,name,status,msg_limit_monthly"),
    billingSettings(),
  ]);

  const plans = plansQ.data || [];
  const usage = usageQ.rows || [];
  const clients = clientsQ.data || [];
  const channels = channelsQ.data || [];

  // Messages actually received in the window, per client, per channel and per
  // platform — the number packages are sold on, kept separate from AI calls
  // (one message can cost several calls: transcribe + vision + chat).
  //
  // Read in PAGES. It used to be one unbounded select, which PostgREST answers
  // with at most `db-max-rows` and no complaint — so past that line every
  // number on this screen was quietly short, and short in a way that looks like
  // a quiet month rather than a bug. Paging also puts a ceiling on it: a
  // platform busy enough to pass MAX_MSGS says so out loud instead of
  // pretending, and the panel shows that it is a floor.
  const msgs = await pageAll((from, to) => supabase
    .from("message_buffer").select("client_id,page_id,platform,role,created_at")
    .eq("role", "customer").gte("created_at", new Date(Date.now() - days * 86400000).toISOString())
    .order("created_at", { ascending: true }).range(from, to));

  const msgByClient = new Map();
  const msgByChannel = new Map();
  const msgByPlatform = {};
  for (const m of msgs.rows) {
    msgByClient.set(m.client_id, (msgByClient.get(m.client_id) || 0) + 1);
    // A message whose channel cannot be named is still a message. It is counted
    // for the client and for the platform, and only the per-channel line
    // cannot have it — saying "unknown" is better than losing the row.
    const p = m.platform || "unknown";
    msgByPlatform[p] = (msgByPlatform[p] || 0) + 1;
    if (m.page_id) {
      const k = `${m.client_id}|${m.page_id}`;
      msgByChannel.set(k, (msgByChannel.get(k) || 0) + 1);
    }
  }

  const usageByClient = new Map();
  for (const u of usage) {
    if (!usageByClient.has(u.client_id)) usageByClient.set(u.client_id, []);
    usageByClient.get(u.client_id).push(u);
  }

  const planOf = Object.fromEntries(plans.map((p) => [p.id, p]));
  const rows = clients.map((c) => {
    const s = summarise(usageByClient.get(c.id) || [], pricesMap);
    const messages = msgByClient.get(c.id) || 0;
    const p = planOf[c.plan] || null;
    // Revenue is pro-rated to the window so cost and income compare like for like.
    const revenueBdt = (Number(p?.monthly || 0) / 30) * days;
    return {
      client_id: c.id,
      business_name: c.business_name,
      owner_email: c.owner_email,
      plan: c.plan,
      suspended: !!c.suspended,
      limit_overrides: c.limit_overrides || null,
      model_chain: c.model_chain || null,
      business_type: c.business_type || "ecommerce",
      messages,
      calls: s.calls,
      tokens: s.tokens,
      tokens_in: s.tokensIn,
      tokens_out: s.tokensOut,
      cost_usd: s.platformCost,
      own_key_cost_usd: s.clientKeyCost,
      by_kind: s.byKind,
      // The three-part split the admin panel shows: platform tools, catalogue
      // indexing, and the bot's own per-message work.
      by_area: s.byArea,
      by_feature: s.byFeature,
      by_model: s.byModel,
      unpriced: s.unpriced,
      revenue_bdt: revenueBdt,
      channels: channels.filter((ch) => ch.client_id === c.id).map((ch) => ({
        ...ch, messages: msgByChannel.get(`${c.id}|${ch.page_id}`) || 0,
      })),
    };
  });

  const totals = summarise(usage, pricesMap);
  const fixedMonthlyUsd = (costsQ.data || []).reduce((n, r) => n + Number(r.monthly_usd || 0), 0);

  return NextResponse.json({
    role, days,
    plans,
    // What the AI model boxes fall back to when neither the client nor their
    // package sets one. The panel shows it so an empty box is still readable.
    platform_model_chain: (await getPlatformAI().catch(() => ({}))).modelChain || null,
    prices: Object.entries(pricesMap).map(([k, v]) => {
      const i = k.indexOf("/");
      return { provider: k.slice(0, i), model: k.slice(i + 1), input_per_1m: v.in, output_per_1m: v.out };
    }),
    platform_costs: costsQ.data || [],
    settings,
    clients: rows,
    totals: {
      calls: totals.calls, tokens: totals.tokens,
      tokens_in: totals.tokensIn, tokens_out: totals.tokensOut,
      ai_cost_usd: totals.platformCost,
      own_key_cost_usd: totals.clientKeyCost,
      by_kind: totals.byKind,
      by_area: totals.byArea,
      by_feature: totals.byFeature,
      by_model: totals.byModel,
      // Customer messages across the whole platform, and where they arrived.
      // This is what packages are sold on, so it is worth its own number rather
      // than being reachable only by opening every client in turn.
      messages: msgs.rows.length,
      messages_by_platform: msgByPlatform,
      // True when the read hit its ceiling, which makes every message figure a
      // FLOOR. Said out loud: a number that is quietly short reads as a quiet
      // month, which is the wrong thing to conclude from it.
      messages_truncated: msgs.truncated,
      usage_truncated: usageQ.truncated,
      // Models being charged at the fallback rate — every dollar under one of
      // these is a house guess, and the panel says so instead of hiding it.
      unpriced: totals.unpriced,
      fixed_monthly_usd: fixedMonthlyUsd,
      // The fixed bill pro-rated to the same window as the AI cost.
      fixed_window_usd: (fixedMonthlyUsd / 30) * days,
      messages: (msgs || []).length,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request) {
  const email = await callerEmail(request);
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = await callerRole(email);
  if (!CAN_EDIT.includes(role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const { action } = body;

  // Pricing and packaging are money decisions — narrower than general editing.
  const needsOwner = ["save_plan", "delete_plan", "save_price", "save_platform_cost", "save_settings"];
  if (needsOwner.includes(action) && !CAN_DELETE.includes(role)) {
    return NextResponse.json({ error: "Only a full-access admin can change packages or pricing." }, { status: 403 });
  }

  const int = (v) => (v === "" || v === null || v === undefined ? null : Math.max(0, Math.round(Number(v) || 0)));

  if (action === "save_plan") {
    const p = body.plan || {};
    if (!p.id) return NextResponse.json({ error: "A package needs an id." }, { status: 400 });
    const row = {
      id: String(p.id).trim().toLowerCase().replace(/[^a-z0-9_-]/g, ""),
      name: String(p.name || p.id).slice(0, 60),
      tagline: p.tagline ? String(p.tagline).slice(0, 120) : null,
      sort: Number(p.sort) || 0,
      active: p.active !== false,
      public: p.public !== false,
      monthly: Number(p.monthly) || 0,
      yearly: Number(p.yearly) || 0,
      messages_per_day: int(p.messages_per_day),
      messages_per_month: int(p.messages_per_month),
      messages_per_channel: int(p.messages_per_channel),
      channels: int(p.channels) ?? 1,
      max_products: int(p.max_products),
      max_kb_files: int(p.max_kb_files),
      max_scrapes_per_month: int(p.max_scrapes_per_month),
      max_broadcasts_per_month: int(p.max_broadcasts_per_month),
      features: p.features || {},
      feature_list: Array.isArray(p.feature_list) ? p.feature_list : [],
      model_chain: p.model_chain ? String(p.model_chain).slice(0, 120) : null,
      highlight: !!p.highlight,
      updated_at: new Date().toISOString(),
    };
    if (!row.id) return NextResponse.json({ error: "That package id is not usable." }, { status: 400 });
    const { error } = await supabase.from("plans").upsert(row, { onConflict: "id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    invalidatePlans();
    return NextResponse.json({ ok: true });
  }

  if (action === "delete_plan") {
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
    // Refuse while anyone is still on it — deleting would silently drop them to
    // the trial limits with no warning.
    const { count } = await supabase.from("clients").select("id", { count: "exact", head: true }).eq("plan", id);
    if (count) return NextResponse.json({ error: `${count} client(s) are on this package. Move them first, or just switch it off instead of deleting.` }, { status: 409 });
    const { error } = await supabase.from("plans").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    invalidatePlans();
    return NextResponse.json({ ok: true });
  }

  if (action === "save_price") {
    const { provider, model, input_per_1m, output_per_1m } = body;
    if (!provider || !model) return NextResponse.json({ error: "missing provider/model" }, { status: 400 });
    const { error } = await supabase.from("model_prices").upsert({
      provider: String(provider), model: String(model),
      input_per_1m: Number(input_per_1m) || 0, output_per_1m: Number(output_per_1m) || 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: "provider,model" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "save_platform_cost") {
    const { id, label, monthly_usd } = body;
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
    const { error } = await supabase.from("platform_costs").upsert({
      id: String(id), label: String(label || id), monthly_usd: Number(monthly_usd) || 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "save_settings") {
    const next = { ...(await billingSettings()), ...(body.settings || {}) };
    const { error } = await supabase.from("app_settings")
      .upsert({ id: BILLING_SETTINGS, settings: next, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, settings: next });
  }

  // Per-client exception: extra messages / products, or a different AI model,
  // without inventing a whole package for one shop.
  if (action === "save_overrides") {
    const { client_id, overrides, model_chain } = body;
    if (!client_id) return NextResponse.json({ error: "missing client_id" }, { status: 400 });

    // The panel now shows every box already filled in with the package's own
    // value, so most of what arrives here is simply the package repeated back.
    // Storing that would be a quiet trap: the client would stop following the
    // package, and raising the Pro allowance later would skip everyone whose
    // panel had once been saved. So a value is only kept when it actually
    // DIFFERS from the package — an override should mean an exception, nothing
    // else. This is decided here rather than in the browser because it is the
    // rule that protects the data, not a display choice.
    const { data: cl } = await supabase.from("clients").select("plan").eq("id", client_id).maybeSingle();
    const plan = (await loadPlans())[cl?.plan] || {};
    const clean = {};
    for (const k of ["messages_per_day", "messages_per_month", "messages_per_channel", "channels",
                     "max_products", "max_kb_files", "max_scrapes_per_month", "max_broadcasts_per_month"]) {
      const raw = overrides ? overrides[k] : undefined;
      if (raw === "" || raw === null || raw === undefined) continue;   // empty = follow the package
      const v = int(raw);
      const fromPlan = plan[k];
      if (fromPlan !== null && fromPlan !== undefined && Number(fromPlan) === v) continue;
      clean[k] = v;
    }
    const { error } = await supabase.from("clients").update({
      limit_overrides: Object.keys(clean).length ? clean : null,
      model_chain: model_chain ? String(model_chain).slice(0, 120) : null,
    }).eq("id", client_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "save_channel_limit") {
    const { channel_id, msg_limit_monthly } = body;
    if (!channel_id) return NextResponse.json({ error: "missing channel_id" }, { status: 400 });
    const { error } = await supabase.from("channels")
      .update({ msg_limit_monthly: int(msg_limit_monthly) }).eq("id", channel_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
