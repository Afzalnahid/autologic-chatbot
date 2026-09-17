// AI usage metering — the foundation for every cost, package and limit number
// in the admin panel.
//
// Every AI call (chat, vision, voice, embedding) reports how many tokens it
// burned. We aggregate that per client per Dhaka-day into usage_daily, and the
// money is worked out at READ time from the model_prices book — so fixing a
// wrong rate corrects history instead of leaving bad numbers behind.
//
// Two rules this file must never break:
//   1. Recording is fire-and-forget. A customer's reply must never be delayed
//      or broken because bookkeeping failed.
//   2. own_key usage is the CLIENT's money, not ours. It is still recorded (the
//      owner wants to see it) but every platform-cost total must exclude it.
import { supabase } from "@/lib/supabase.js";

// Bangladesh is UTC+6 year-round, so the local day is a fixed offset away.
export function dhakaDay(d = new Date()) {
  return new Date(d.getTime() + 6 * 3600 * 1000).toISOString().slice(0, 10);
}

// The feature registry lives in its own dependency-free file so the admin panel
// can import the same list without pulling the database client into the browser
// bundle. Re-exported here so every server caller keeps one import.
import { AREAS, FEATURES, featureId, areaOf, featureLabel } from "@/lib/usage-features.js";
export { AREAS, FEATURES, featureId, areaOf, featureLabel };

// Whether the database has the channel column yet.
//
// `page_id` arrived on usage_daily in a migration the owner runs by hand (see
// docs/sql/2026-08-30-usage-page-id.sql), and the code has to keep recording
// on both sides of that. So the first call sends it; if the function does not
// take it, that is remembered for the life of the process and every later call
// goes without. It heals itself the next time the process starts after the
// migration — no flag to set, no deploy to sequence.
//
// Without this the two have to be released in lockstep, and getting the order
// wrong stops usage being counted at all: silently, because recording is
// fire-and-forget by design.
let channelColumn = true;
const NO_COLUMN = /page_id|could not find the function|schema cache|does not exist/i;

// Fire-and-forget. Never throws, never awaited by a reply path.
export function recordUsage({ clientId, kind, feature, provider, model, ownKey = false, tokensIn = 0, tokensOut = 0, tokensCached = 0, calls = 1, pageId = "" }) {
  if (!clientId || !kind) return;
  const tin = Math.max(0, Math.round(Number(tokensIn) || 0));
  const tout = Math.max(0, Math.round(Number(tokensOut) || 0));
  // Gemini bills a repeated prompt prefix at a tenth of the input rate
  // (implicit caching). Those tokens are INCLUDED in promptTokenCount, so
  // without recording them separately every report charged them in full and
  // nobody could tell whether caching was working. Never more than tokens_in.
  const tcache = Math.min(tin, Math.max(0, Math.round(Number(tokensCached) || 0)));
  const args = {
    p_client_id: clientId,
    p_day: dhakaDay(),
    p_kind: String(kind),
    p_feature: featureId(feature, kind),
    p_provider: String(provider || "google"),
    p_model: String(model || "unknown"),
    p_own_key: !!ownKey,
    p_calls: calls,
    p_tokens_in: tin,
    p_tokens_out: tout,
    p_tokens_cached: tcache,
  };
  // "" is the honest value for a call that had no channel — an embedding for a
  // product, the owner pressing a button — and it groups where NULL vanishes.
  const withChannel = { ...args, p_page_id: String(pageId || "") };

  const send = (payload, retry) => supabase.rpc("record_ai_usage", payload).then(
    ({ error }) => {
      if (!error) return;
      if (retry && NO_COLUMN.test(error.message || "")) {
        channelColumn = false;
        console.warn("[usage] usage_daily has no page_id yet — recording without it. Run docs/sql/2026-08-30-usage-page-id.sql.");
        return send(args, false);
      }
      console.error("[usage] record failed:", error.message);
    },
    (e) => console.error("[usage] record threw:", String(e?.message || e).slice(0, 160))
  );

  send(channelColumn ? withChannel : args, channelColumn);
}

// Pulls a token count out of Gemini's response (usageMetadata). Optional — a
// missing count is recorded as zero rather than guessed.
export function geminiTokens(response) {
  const u = response?.usageMetadata || {};
  return {
    tokensIn: u.promptTokenCount || 0,
    tokensOut: u.candidatesTokenCount || 0,
    // How much of that input Gemini served from its own cache, at 10% of the
    // price. Absent on a miss, and on models that do not cache.
    tokensCached: u.cachedContentTokenCount || 0,
  };
}

// Ready-made opts for the direct gemini.js callers that do not go through
// src/lib/ai.js — product import, catalogue sync, knowledge-base upload and
// search. These are the biggest embedding costs we pay, so they must be metered
// too; embeddings always run on the platform key, hence ownKey:false always.
export function embedMeter(clientId, feature = "product") {
  return {
    onUsage: (kind, model, response) => {
      const t = geminiTokens(response);
      recordUsage({ clientId, kind, feature, provider: "google", model, ownKey: false, tokensIn: t.tokensIn, tokensOut: t.tokensOut, tokensCached: t.tokensCached });
    },
  };
}

// ── Cost ────────────────────────────────────────────────────────────────────

// The price book, as { "provider/model": {in, out} } plus a per-provider
// __default__ fallback so a brand-new model id still costs something sane
// instead of silently costing zero.
export async function loadPrices() {
  const { data } = await supabase.from("model_prices").select("provider,model,input_per_1m,output_per_1m");
  const map = {};
  for (const r of data || []) map[`${r.provider}/${r.model}`] = { in: Number(r.input_per_1m) || 0, out: Number(r.output_per_1m) || 0 };
  return map;
}

export function rateFor(prices, provider, model) {
  return prices[`${provider}/${model}`] || prices[`${provider}/__default__`] || { in: 0, out: 0 };
}

// The share of the input rate a cached token costs. Gemini's implicit cache
// bills the repeated prefix at a tenth of the fresh rate.
export const CACHED_RATE = 0.10;

// USD cost of one usage_daily row. tokens_cached is a SUBSET of tokens_in, so
// the fresh part is the difference — charging both in full would double-count.
export function rowCost(prices, row) {
  const r = rateFor(prices, row.provider, row.model);
  const tin = Number(row.tokens_in) || 0;
  const cached = Math.min(tin, Number(row.tokens_cached) || 0);
  return ((tin - cached) / 1e6) * r.in + (cached / 1e6) * r.in * CACHED_RATE + ((Number(row.tokens_out) || 0) / 1e6) * r.out;
}

// Whether a row's model has its own line in the price book. A model that falls
// through to __default__ is still costed, but the number is a house guess — the
// admin panel says so out loud rather than presenting it as measured.
export function isPriced(prices, provider, model) {
  return !!prices[`${provider}/${model}`];
}

// Sums usage rows into a report. Platform cost deliberately EXCLUDES own_key
// rows: those tokens are billed to the client by their own provider.
//
// Four buckets come out of one pass:
//   byKind    — chat / vision / voice / embed / scrape (what sort of call)
//   byFeature — bot.tag, product.embed, … (who asked for it)
//   byArea    — bot / catalogue / platform (the three-part split)
//   byChannel — which channel the message arrived on, "" for calls that had none
//
// byChannel is empty on every row written before the page_id migration, and on
// every call that genuinely has no channel. `measured` says how much of the
// spend actually named one, so a reader is never shown an apportioned figure
// dressed up as a reading.
export function summarise(rows, prices) {
  let calls = 0, tokensIn = 0, tokensOut = 0, tokensCached = 0, platformCost = 0, clientKeyCost = 0;
  const byKind = {}, byFeature = {}, byArea = {}, byModel = {}, byChannel = {};
  const bucket = (map, key) => {
    // tokensCached rides in every bucket, not just the grand total: the
    // per-model table exists so the arithmetic can be checked against the
    // provider bill, and cached input is charged at a tenth — a table without
    // it stops adding up the moment caching starts working.
    if (!map[key]) map[key] = { calls: 0, tokensIn: 0, tokensOut: 0, tokensCached: 0, tokens: 0, cost: 0, ownKeyCost: 0 };
    return map[key];
  };
  for (const r of rows || []) {
    const c = rowCost(prices, r);
    const tin = Number(r.tokens_in) || 0, tout = Number(r.tokens_out) || 0;
    const tcached = Math.min(tin, Number(r.tokens_cached) || 0);
    const n = r.calls || 0;
    calls += n; tokensIn += tin; tokensOut += tout; tokensCached += tcached;
    if (r.own_key) clientKeyCost += c; else platformCost += c;

    const feature = r.feature || "legacy";
    for (const b of [bucket(byKind, r.kind || "other"), bucket(byFeature, feature), bucket(byArea, areaOf(feature)), bucket(byChannel, r.page_id || "")]) {
      b.calls += n; b.tokensIn += tin; b.tokensOut += tout; b.tokensCached += tcached; b.tokens += tin + tout;
      if (r.own_key) b.ownKeyCost += c; else b.cost += c;
    }

    const mk = `${r.provider}/${r.model}`;
    const m = bucket(byModel, mk);
    m.calls += n; m.tokensIn += tin; m.tokensOut += tout; m.tokensCached += tcached; m.tokens += tin + tout;
    if (r.own_key) m.ownKeyCost += c; else m.cost += c;
    m.provider = r.provider; m.model = r.model;
    m.priced = isPriced(prices, r.provider, r.model);
    const rate = rateFor(prices, r.provider, r.model);
    m.input_per_1m = rate.in; m.output_per_1m = rate.out;
  }
  // How much of the spend named a channel. Everything under "" either predates
  // the page_id migration or never had one, and a panel that cannot tell the
  // difference will present a guess as a measurement.
  const named = Object.entries(byChannel).reduce((n, [k, v]) => k ? n + v.cost + v.ownKeyCost : n, 0);
  const allCost = platformCost + clientKeyCost;

  return {
    calls, tokensIn, tokensOut, tokensCached, tokens: tokensIn + tokensOut,
    // What share of the input arrived from Gemini's cache at a tenth of the
    // price. 0 means the repeated part of our prompt is not being reused —
    // which is a prompt-shape problem, not a billing one.
    cacheHitRate: tokensIn > 0 ? tokensCached / tokensIn : 0,
    platformCost, clientKeyCost, byKind, byFeature, byArea, byModel, byChannel,
    // 0 before the migration, 1 once every call carries its channel.
    channelMeasured: allCost > 0 ? named / allCost : 0,
    // Models being charged at the fallback rate. Every dollar under one of
    // these is an estimate, so the panel can say how much of the total is.
    unpriced: Object.values(byModel).filter((m) => !m.priced)
      .map((m) => ({ provider: m.provider, model: m.model, calls: m.calls, cost: m.cost })),
  };
}
