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
import { PLANS, PAID_PLANS, TRIAL_DAYS, clampTrialDays } from "@/lib/plans.js";

const TTL = 60_000;
let _cache = null;

// Shape the code constant like a `plans` row so both paths return one type.
function fromConstant() {
  const out = {};
  for (const [id, p] of Object.entries(PLANS)) {
    out[id] = {
      id, name: p.name, tagline: p.tagline, monthly: p.monthly, yearly: p.yearly,
      // Which business the package is for; "both" is the trial. A row read from
      // the database before the biz migration has no value, and everything that
      // reads this treats a missing one as "both" — showing a package to
      // everybody is a smaller mistake than hiding it from the people it is for.
      biz: p.biz || "both",
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
    // null, like every other limit here, and NOT 1. The panel says "Empty means
    // unlimited" over these boxes, and while nothing read this figure the two
    // could disagree without consequence. Now that checkChannelQuota enforces
    // it, an empty box defaulting to 1 would refuse a second channel to a
    // package whose own screen promised no limit. Empty stays what it has
    // effectively been until today: no limit.
    channels: pick("channels") ?? null,
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

// ── Quota gates ─────────────────────────────────────────────────────────────
// Each returns { ok } or { ok:false, message } with a sentence a shop owner can
// act on — never a raw number with no context.

const monthStartISO = () => {
  const now = new Date(Date.now() + 6 * 3600 * 1000);          // Dhaka
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 6 * 3600 * 1000).toISOString();
};

// The single answer to "is this client's plan live, and how many messages may
// they still be charged for?" — read by the bot before it replies AND by
// broadcasts and follow-ups before they send.
//
// It exists because those two had drifted apart. The bot read the plans table
// and the per-client overrides; broadcasts read a hard-coded constant. So an
// allowance the owner raised in the admin panel was invisible to broadcasts,
// and an expired plan could still send them. One function now, so the two can
// never disagree again.
//
//   { active: true,  period: "day"|"month", limit, limits }   limit null = unlimited
//   { active: false, reason, limits }
//     reason: no_client | suspended | trial_expired | plan_expired | no_plan
export async function messageAllowance(client) {
  if (!client) return { active: false, reason: "no_client" };
  if (client.suspended) return { active: false, reason: "suspended" };

  const limits = await limitsFor(client);
  const plan = String(client.plan || "").trim().toLowerCase();
  const now = new Date();

  if (plan === "trial") {
    if (!client.trial_end || new Date(client.trial_end) <= now) {
      return { active: false, reason: "trial_expired", limits };
    }
    return { active: true, period: "day", limit: limits.messagesPerDay ?? null, limits };
  }

  // limitsFor falls back to the trial plan for an id it does not recognise, so
  // planId matching what the client is actually on is the proof the package is
  // real — which is what makes a package created in the admin panel work here.
  const isPackage = PAID_PLANS.includes(plan) || (!!plan && plan !== "none" && limits.planId === client.plan);
  if (isPackage) {
    if (client.plan_expires_at && new Date(client.plan_expires_at) <= now) {
      return { active: false, reason: "plan_expired", limits };
    }
    return { active: true, period: "month", limit: limits.messagesPerMonth ?? null, limits };
  }

  return { active: false, reason: "no_plan", limits };
}

// Said when the count itself could not be read. Deliberately not "you have
// reached your limit": the owner has not, and telling them they have would send
// them to the billing page for nothing.
const COUNT_FAILED = "We could not check your package limit just now. Please try again in a moment.";

// How many products this account may still add.
export async function checkProductQuota(client, adding = 1) {
  const limits = await limitsFor(client);
  const max = limits.maxProducts;
  if (max === null || max === undefined) return { ok: true, limits };
  const { count, error } = await supabase.from("products")
    .select("id", { count: "exact", head: true }).eq("client_id", client.id);
  // A failed count used to read as zero, which passes every limit. A quota that
  // fails OPEN is a quota that does not exist on the day the database hiccups,
  // and nothing anywhere would have said so. It fails closed, and says why.
  if (error) return { ok: false, limits, message: COUNT_FAILED };
  const used = count || 0;
  if (used + adding > Number(max)) {
    return {
      ok: false, used, limit: max, limits,
      message: `Your ${limits.planName} package includes ${Number(max).toLocaleString("en-IN")} products and you already have ${used.toLocaleString("en-IN")}. Remove some, or upgrade for more room.`,
    };
  }
  return { ok: true, used, limit: max, limits };
}

// How long a free trial runs, as the owner has set it.
//
// The trial is something they sell, so changing its length should not need a
// deploy. It is stored beside the exchange rate in app_settings rather than as
// a column on the plans table: there is exactly one trial package, and a key in
// a JSONB column that already exists needs no migration run before the box in
// the panel does anything.
//
// Every failure falls back to TRIAL_DAYS — a missing row, an unreadable table,
// a value somebody typed as "soon". A trial that cannot work out its own length
// must still start.
export async function trialDays() {
  try {
    const { data, error } = await supabase.from("app_settings")
      .select("settings").eq("id", "billing").maybeSingle();
    if (error) return TRIAL_DAYS;
    const set = data?.settings?.trial_days;
    return set === null || set === undefined ? TRIAL_DAYS : clampTrialDays(set);
  } catch {
    return TRIAL_DAYS;
  }
}

// Where a "per month" allowance starts counting for this client.
//
// A calendar month is the right window for a package that is sold by the month.
// It is the wrong one for a three-day trial, which can straddle a month end: a
// trial started on the 30th got its whole monthly allowance again on the 1st,
// so the same trial was worth twice as much depending on the day it began. For
// a trial the window is the trial itself.
export const quotaWindowStart = (client) =>
  (client?.plan === "trial" && client?.trial_start
    ? new Date(client.trial_start).toISOString()
    : monthStartISO());

// Website scrapes in the current window. Counted from the metering table (kind
// "scrape"), which is also what the cost report reads — one source of truth, no
// separate counter to drift.
export async function checkScrapeQuota(client) {
  const limits = await limitsFor(client);
  const max = limits.maxScrapesPerMonth;
  if (max === null || max === undefined) return { ok: true, limits };
  const trial = client?.plan === "trial";
  const { data, error } = await supabase.from("usage_daily")
    .select("calls").eq("client_id", client.id).eq("kind", "scrape")
    .gte("day", quotaWindowStart(client).slice(0, 10)).limit(2000);
  if (error) return { ok: false, limits, message: COUNT_FAILED };
  const used = (data || []).reduce((n, r) => n + (r.calls || 0), 0);
  if (used >= Number(max)) {
    return {
      ok: false, used, limit: max, limits,
      message: trial
        ? `Your ${limits.planName} includes ${Number(max).toLocaleString("en-IN")} website imports and you have used ${used.toLocaleString("en-IN")}. Choose a package for more.`
        : `Your ${limits.planName} package includes ${Number(max).toLocaleString("en-IN")} website imports per month and you have used ${used.toLocaleString("en-IN")}. It resets next month, or upgrade for more.`,
    };
  }
  return { ok: true, used, limit: max, limits };
}

// The website widget is a channel row like any other, but it is not one of the
// channels the "Channels allowed" figure is about.
export const WIDGET_PLATFORM = "website";

// A client row from either a row or an id. Returns null when it cannot be
// read, and every caller treats null as "refuse", never as "allow".
const asClient = async (c) => {
  if (!c) return null;
  if (typeof c === "object") return c;
  const { data } = await supabase.from("clients").select("*").eq("id", c).maybeSingle();
  return data || null;
};

// How many messaging channels this account may connect.
//
// The figure was saved in the admin panel and read by nothing, so a trial
// limited to one channel could connect five. It counts Facebook Pages,
// Instagram accounts and WhatsApp numbers — what the packages describe.
//
// The website widget is deliberately outside it. The widget has its own switch
// in the package ("Website chat widget"), and letting it eat a messaging slot
// would charge a client twice for something already turned on: a Pro account
// with three channels allowed would get its Facebook, Instagram and WhatsApp
// and then be refused a widget it is paying for.
//
// Reconnecting a channel this account already has is never blocked. The row is
// upserted on (client_id, platform, page_id), so it adds nothing to the count —
// and a client at their limit must still be able to repair a channel whose
// token expired.
// Takes the client row OR just an id: the OAuth callbacks that finish a
// connect (fb/select, ig/select, wa/select, wa/finish) hold only the id they
// signed into the state parameter, and making each of them fetch the row would
// be four copies of the same three lines.
export async function checkChannelQuota(clientOrId, platform, pageId) {
  const client = await asClient(clientOrId);
  // The row could not be read, so the allowance is unknown. A quota that fails
  // open is a quota that does not exist on the day the database hiccups.
  if (!client) return { ok: false, message: COUNT_FAILED };

  const limits = await limitsFor(client);
  const max = limits.channels;
  if (max === null || max === undefined) return { ok: true, limits };
  if (String(platform) === WIDGET_PLATFORM) return { ok: true, limits };

  const { data, error } = await supabase.from("channels")
    .select("platform,page_id").eq("client_id", client.id).limit(500);
  if (error) return { ok: false, limits, message: COUNT_FAILED };

  const rows = (data || []).filter((c) => c.platform !== WIDGET_PLATFORM);
  const already = rows.some((c) => c.platform === platform && String(c.page_id) === String(pageId));
  const used = rows.length;
  if (already) return { ok: true, used, limit: max, limits };
  if (used >= Number(max)) {
    const n = Number(max);
    return {
      ok: false, used, limit: max, limits,
      message: `Your ${limits.planName} includes ${n.toLocaleString("en-IN")} channel${n === 1 ? "" : "s"} and you already have ${used.toLocaleString("en-IN")} connected. Disconnect one first, or upgrade for more.`,
    };
  }
  return { ok: true, used, limit: max, limits };
}

// Broadcasts in the current window.
//
// Also saved and read by nothing until now. Counted from the broadcasts table,
// which only gains a row once an audience has been resolved and found — so a
// message with nobody to send it to never costs one.
//
// The window is quotaWindowStart, the same as every other windowed limit: a
// calendar month for a package sold by the month, the trial for a trial.
export async function checkBroadcastQuota(client) {
  const limits = await limitsFor(client);
  const max = limits.maxBroadcastsPerMonth;
  if (max === null || max === undefined) return { ok: true, limits };
  const trial = client?.plan === "trial";
  const { count, error } = await supabase.from("broadcasts")
    .select("id", { count: "exact", head: true })
    .eq("client_id", client.id).gte("created_at", quotaWindowStart(client));
  if (error) return { ok: false, limits, message: COUNT_FAILED };
  const used = count || 0;
  if (used >= Number(max)) {
    const n = Number(max);
    return {
      ok: false, used, limit: max, limits,
      message: trial
        ? `Your ${limits.planName} includes ${n.toLocaleString("en-IN")} broadcast${n === 1 ? "" : "s"} and you have sent ${used.toLocaleString("en-IN")}. Choose a package to send more.`
        : `Your ${limits.planName} package includes ${n.toLocaleString("en-IN")} broadcast${n === 1 ? "" : "s"} per month and you have sent ${used.toLocaleString("en-IN")}. It resets next month, or upgrade for more.`,
    };
  }
  return { ok: true, used, limit: max, limits };
}

// Knowledge-base documents.
export async function checkKbQuota(client, adding = 1) {
  const limits = await limitsFor(client);
  const max = limits.maxKbFiles;
  if (max === null || max === undefined) return { ok: true, limits };
  const { count, error } = await supabase.from("file_registry")
    .select("id", { count: "exact", head: true }).eq("client_id", client.id);
  if (error) return { ok: false, limits, message: COUNT_FAILED };
  const used = count || 0;
  if (used + adding > Number(max)) {
    return {
      ok: false, used, limit: max, limits,
      message: `Your ${limits.planName} package includes ${Number(max).toLocaleString("en-IN")} knowledge documents and you already have ${used.toLocaleString("en-IN")}. Remove one, or upgrade for more.`,
    };
  }
  return { ok: true, used, limit: max, limits };
}
