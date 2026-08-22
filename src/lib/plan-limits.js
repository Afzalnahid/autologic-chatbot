// The one place that answers "what is this client actually allowed to do?"
//
// Three layers, most specific wins:
//   1. src/lib/plans.js  — the code constant, used only as a fallback so the
//      product still works if the plans table is empty or unreachable.
//   2. the `plans` table — what the owner edits in the admin panel.
//   3. clients.limit_overrides — a per-client exception ("give THIS shop 20,000
//      messages") that needs no new package.
//
// NULL / undefined on any limit means UNLIMITED, everywhere. A missing plan is
// never treated as "unlimited" though — an unknown plan id falls back to trial.
import { supabase } from "@/lib/supabase.js";
import { PLANS } from "@/lib/plans.js";

const TTL = 60_000;
let _cache = null;

// Shape the code constant like a `plans` row so both paths return one type.
function fromConstant() {
  const out = {};
  for (const [id, p] of Object.entries(PLANS)) {
    out[id] = {
      id, name: p.name, tagline: p.tagline, monthly: p.monthly, yearly: p.yearly,
      messages_per_day: p.messagesPerDay ?? null,
      messages_per_month: p.messagesPerMonth ?? null,
      messages_per_channel: null,
      channels: p.channels ?? 1,
      max_products: null, max_kb_files: null,
      max_scrapes_per_month: null, max_broadcasts_per_month: null,
      features: {}, feature_list: p.features || [], model_chain: null,
      highlight: !!p.highlight, active: true, public: true, sort: 0,
    };
  }
  return out;
}

export async function loadPlans({ force = false } = {}) {
  if (!force && _cache && Date.now() - _cache.at < TTL) return _cache.plans;
  let plans;
  try {
    const { data, error } = await supabase.from("plans").select("*").order("sort");
    if (error) throw error;
    plans = (data || []).length ? Object.fromEntries(data.map((p) => [p.id, p])) : fromConstant();
  } catch (e) {
    console.error("[plans] falling back to the code catalogue:", String(e?.message || e).slice(0, 160));
    plans = fromConstant();
  }
  _cache = { plans, at: Date.now() };
  return plans;
}

// Drop the cache so an admin edit shows up at once instead of up to a minute later.
export function invalidatePlans() { _cache = null; }

// Everything the runtime needs to police one client, plan + overrides merged.
export async function limitsFor(client) {
  const plans = await loadPlans();
  const plan = plans[client?.plan] || plans.trial || Object.values(plans)[0] || {};
  const ov = (client && client.limit_overrides) || {};
  const pick = (key) => (Object.prototype.hasOwnProperty.call(ov, key) ? ov[key] : plan[key]);

  return {
    planId: plan.id || client?.plan || "trial",
    planName: plan.name || "Plan",
    monthly: Number(plan.monthly || 0),
    yearly: Number(plan.yearly || 0),
    messagesPerDay: pick("messages_per_day") ?? null,
    messagesPerMonth: pick("messages_per_month") ?? null,
    messagesPerChannel: pick("messages_per_channel") ?? null,
    channels: pick("channels") ?? 1,
    maxProducts: pick("max_products") ?? null,
    maxKbFiles: pick("max_kb_files") ?? null,
    maxScrapesPerMonth: pick("max_scrapes_per_month") ?? null,
    maxBroadcastsPerMonth: pick("max_broadcasts_per_month") ?? null,
    features: { ...(plan.features || {}), ...(ov.features || {}) },
    // A client-specific chain beats the package's, which beats the platform default.
    modelChain: client?.model_chain || pick("model_chain") || null,
  };
}

// true when the plan allows a capability. Unknown keys default to allowed, so a
// feature added to the product later is not silently switched off for everyone
// until the owner has had a chance to set it per package.
export function can(limits, key) {
  const v = limits?.features?.[key];
  return v === undefined ? true : !!v;
}

export const overLimit = (used, limit) => limit !== null && limit !== undefined && used >= Number(limit);
