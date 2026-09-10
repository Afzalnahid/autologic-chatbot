// What a client's package actually gives them, in one place: the capability
// features it grants, and every metered allowance with how much is used and how
// much is left. The admin client drawer AND the client's own dashboard both read
// this, so the two can never show different numbers for the same account.
//
// The pure display logic (feature labels, the meter shape) lives in features.js
// so client components can use it without bundling the database; this module adds
// the USAGE half (one cheap count per meter) and the single assembler the API
// routes call.
import { supabase } from "@/lib/supabase.js";
import { limitsFor, quotaWindowStart, WIDGET_PLATFORM } from "@/lib/plan-limits.js";
import { countBillableMessages } from "@/lib/message-usage.js";
import { startOfDayDhaka, startOfMonthDhaka } from "@/lib/time.js";
import { featureList, shapeMeter } from "@/lib/features.js";

export { FEATURE_DEFS, featureList, shapeMeter } from "@/lib/features.js";

// How much of each allowance this client has used — one cheap count per meter,
// run in parallel. Fine for a SINGLE client (a drawer, or their own dashboard);
// never call it per row of the admin client list (that would be a count storm).
// Every count fails soft to null (shown as "—"), so a database hiccup on one
// meter never blanks the panel.
export async function usageMeters(client, limits) {
  const biz = client?.business_type || "ecommerce";
  const trial = String(client?.plan || "") === "trial";
  const msgSince = (trial ? startOfDayDhaka() : startOfMonthDhaka()).toISOString();
  const winSince = quotaWindowStart(client); // trial → the trial window, else the month

  const soft = async (p) => { try { return await p; } catch { return null; } };
  const countOf = (table) => soft(
    supabase.from(table).select("id", { count: "exact", head: true }).eq("client_id", client.id)
      .then((r) => (r.error ? null : (r.count || 0))));

  const [messages, products, documents, channelRows, broadcasts, scrapeRows] = await Promise.all([
    soft(countBillableMessages(client.id, msgSince)),
    biz === "ecommerce" ? countOf("products") : Promise.resolve(null),
    biz === "agency" ? countOf("file_registry") : Promise.resolve(null),
    soft(supabase.from("channels").select("platform,page_id").eq("client_id", client.id).limit(500)
      .then((r) => (r.error ? null : r.data))),
    soft(supabase.from("broadcasts").select("id", { count: "exact", head: true })
      .eq("client_id", client.id).gte("created_at", winSince).then((r) => (r.error ? null : (r.count || 0)))),
    soft(supabase.from("usage_daily").select("calls").eq("client_id", client.id).eq("kind", "scrape")
      .gte("day", String(winSince).slice(0, 10)).limit(2000).then((r) => (r.error ? null : r.data))),
  ]);

  const channelsUsed = Array.isArray(channelRows)
    ? channelRows.filter((c) => c.platform !== WIDGET_PLATFORM).length : null;
  const scrapesUsed = Array.isArray(scrapeRows)
    ? scrapeRows.reduce((n, r) => n + (r.calls || 0), 0) : null;

  const meters = [
    shapeMeter("messages", "Customer messages", messages, trial ? limits.messagesPerDay : limits.messagesPerMonth),
  ];
  if (biz === "ecommerce") meters.push(shapeMeter("products", "Products", products, limits.maxProducts));
  if (biz === "agency") meters.push(shapeMeter("documents", "Knowledge documents", documents, limits.maxKbFiles));
  meters.push(shapeMeter("channels", "Channels", channelsUsed, limits.channels));
  meters.push(shapeMeter("broadcasts", "Broadcasts", broadcasts, limits.maxBroadcastsPerMonth));
  meters.push(shapeMeter("scrapes", "Website imports", scrapesUsed, limits.maxScrapesPerMonth));

  return { period: trial ? "day" : "month", meters };
}

// Everything one client's package gives them: features (on/off) + metered
// allowances (used/limit/remaining). One call, for one client.
export async function entitlementsFor(client) {
  const limits = await limitsFor(client);
  const { period, meters } = await usageMeters(client, limits);
  return {
    planId: limits.planId,
    planName: limits.planName,
    period,
    features: featureList(limits.features, client?.business_type),
    meters,
  };
}
