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

// Fire-and-forget. Never throws, never awaited by a reply path.
export function recordUsage({ clientId, kind, feature, provider, model, ownKey = false, tokensIn = 0, tokensOut = 0, calls = 1 }) {
  if (!clientId || !kind) return;
  const tin = Math.max(0, Math.round(Number(tokensIn) || 0));
  const tout = Math.max(0, Math.round(Number(tokensOut) || 0));
  supabase.rpc("record_ai_usage", {
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
  }).then(
    ({ error }) => { if (error) console.error("[usage] record failed:", error.message); },
    (e) => console.error("[usage] record threw:", String(e?.message || e).slice(0, 160))
  );
}

// Pulls a token count out of Gemini's response (usageMetadata). Optional — a
// missing count is recorded as zero rather than guessed.
export function geminiTokens(response) {
  const u = response?.usageMetadata || {};
  return { tokensIn: u.promptTokenCount || 0, tokensOut: u.candidatesTokenCount || 0 };
}

// Ready-made opts for the direct gemini.js callers that do not go through
// src/lib/ai.js — product import, catalogue sync, knowledge-base upload and
// search. These are the biggest embedding costs we pay, so they must be metered
// too; embeddings always run on the platform key, hence ownKey:false always.
export function embedMeter(clientId, feature = "product") {
  return {
    onUsage: (kind, model, response) => {
      const t = geminiTokens(response);
      recordUsage({ clientId, kind, feature, provider: "google", model, ownKey: false, tokensIn: t.tokensIn, tokensOut: t.tokensOut });
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

// USD cost of one usage_daily row.
export function rowCost(prices, row) {
  const r = rateFor(prices, row.provider, row.model);
  return (Number(row.tokens_in) / 1e6) * r.in + (Number(row.tokens_out) / 1e6) * r.out;
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
// Three buckets come out of one pass:
//   byKind    — chat / vision / voice / embed / scrape (what sort of call)
//   byFeature — bot.tag, product.embed, … (who asked for it)
//   byArea    — bot / catalogue / platform (the three-part split)
export function summarise(rows, prices) {
  let calls = 0, tokensIn = 0, tokensOut = 0, platformCost = 0, clientKeyCost = 0;
  const byKind = {}, byFeature = {}, byArea = {}, byModel = {};
  const bucket = (map, key) => {
    if (!map[key]) map[key] = { calls: 0, tokensIn: 0, tokensOut: 0, tokens: 0, cost: 0, ownKeyCost: 0 };
    return map[key];
  };
  for (const r of rows || []) {
    const c = rowCost(prices, r);
    const tin = Number(r.tokens_in) || 0, tout = Number(r.tokens_out) || 0;
    const n = r.calls || 0;
    calls += n; tokensIn += tin; tokensOut += tout;
    if (r.own_key) clientKeyCost += c; else platformCost += c;

    const feature = r.feature || "legacy";
    for (const b of [bucket(byKind, r.kind || "other"), bucket(byFeature, feature), bucket(byArea, areaOf(feature))]) {
      b.calls += n; b.tokensIn += tin; b.tokensOut += tout; b.tokens += tin + tout;
      if (r.own_key) b.ownKeyCost += c; else b.cost += c;
    }

    const mk = `${r.provider}/${r.model}`;
    const m = bucket(byModel, mk);
    m.calls += n; m.tokensIn += tin; m.tokensOut += tout; m.tokens += tin + tout;
    if (r.own_key) m.ownKeyCost += c; else m.cost += c;
    m.provider = r.provider; m.model = r.model;
    m.priced = isPriced(prices, r.provider, r.model);
    const rate = rateFor(prices, r.provider, r.model);
    m.input_per_1m = rate.in; m.output_per_1m = rate.out;
  }
  return {
    calls, tokensIn, tokensOut, tokens: tokensIn + tokensOut,
    platformCost, clientKeyCost, byKind, byFeature, byArea, byModel,
    // Models being charged at the fallback rate. Every dollar under one of
    // these is an estimate, so the panel can say how much of the total is.
    unpriced: Object.values(byModel).filter((m) => !m.priced)
      .map((m) => ({ provider: m.provider, model: m.model, calls: m.calls, cost: m.cost })),
  };
}
