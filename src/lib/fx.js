// What a dollar costs in taka, kept current on its own.
//
// Every cost in the admin panel is measured in dollars — the AI providers bill
// in dollars — and read in taka, because that is the money the owner actually
// thinks in. The conversion was one number typed into settings once. A rate
// that drifts silently makes every margin on the screen wrong in the same
// direction at the same time, which is the worst way for a number to be wrong:
// it still looks internally consistent.
//
// So it refreshes itself, and the manual number stays as an override for the
// day the owner wants to price against something other than the market.

// A published mid-market rate, no key, no account. If it is ever unreachable
// the last good number stands — a stale rate is a small error, and a zero is a
// page full of ৳0.
const SOURCE = "https://open.er-api.com/v6/latest/USD";

// Twelve hours. The rate moves by fractions of a percent in a day and every
// admin page load would otherwise be a call to somebody else's server.
export const MAX_AGE_MS = 12 * 3600 * 1000;

// Sanity bounds. A parser that reads the wrong field, or an API that starts
// answering in a different base currency, produces a number that is off by a
// factor rather than a few percent — and a factor turns every margin upside
// down. USD/BDT has been between 60 and 400 for the whole of this decade and
// anything outside that is a bug, not a currency movement.
const MIN = 60, MAX = 400;

export const plausible = (n) => Number.isFinite(n) && n >= MIN && n <= MAX;

// Fetches the rate. Returns null rather than throwing: the caller always has a
// previous value to fall back on, and an admin page must not fail to load
// because a currency API is down.
export async function fetchUsdBdt(fetchImpl = fetch) {
  try {
    const r = await fetchImpl(SOURCE, { cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    const n = Number(j?.rates?.BDT);
    return plausible(n) ? Math.round(n * 100) / 100 : null;
  } catch {
    return null;
  }
}

// Decide what rate to use, and whether it is worth going to look for a new one.
//
// `settings` carries three things: `usd_bdt` (what the owner typed, or nothing),
// `usd_bdt_auto` (the last rate fetched) and `usd_bdt_at` (when). The owner's
// number always wins while `usd_bdt_manual` is on — otherwise the market does.
export function rateFrom(settings, fallback = 120) {
  const s = settings || {};
  const manual = !!s.usd_bdt_manual;
  const typed = Number(s.usd_bdt);
  const auto = Number(s.usd_bdt_auto);
  if (manual && plausible(typed)) return { rate: typed, source: "manual", at: null };
  if (plausible(auto)) return { rate: auto, source: "market", at: s.usd_bdt_at || null };
  // No market rate yet: whatever was typed, then the house default. Said as
  // "fallback" so the panel can admit the number is not measured.
  if (plausible(typed)) return { rate: typed, source: "manual", at: null };
  return { rate: fallback, source: "fallback", at: null };
}

export function isStale(settings, now = Date.now()) {
  const at = Date.parse(settings?.usd_bdt_at || "");
  if (!Number.isFinite(at)) return true;
  return now - at > MAX_AGE_MS;
}
