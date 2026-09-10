// The capability features a package can grant, and the pure helpers that shape
// them for display. NO imports on purpose: this is the ONE labelled source of
// features, read by server code (entitlements.js) AND by client components (the
// admin console, the client dashboard), so it must be safe to bundle anywhere.
//
// The used-vs-limit COUNTING lives in entitlements.js (it needs the database);
// everything here is pure and unit-tested.

// Every capability switch, with the one set of human labels used everywhere it
// is shown. `biz` limits a feature to the business type it means anything for —
// a shop has no calendar to book into, a service has no catalogue to match a
// photo against; "both" shows on either side.
export const FEATURE_DEFS = [
  { key: "vision",    label: "Photo product matching",      biz: "ecommerce" },
  { key: "voice",     label: "Voice message understanding", biz: "both" },
  { key: "kb",        label: "Knowledge Base uploads",      biz: "agency" },
  { key: "calendar",  label: "Google Calendar booking",     biz: "agency" },
  { key: "comments",  label: "Comment automation",          biz: "both" },
  { key: "widget",    label: "Website chat widget",         biz: "both" },
  { key: "broadcast", label: "Broadcasts",                  biz: "both" },
  { key: "followup",  label: "Follow-up messages",          biz: "both" },
  { key: "byok",      label: "Use your own AI key",         biz: "both" },
];

const relevant = (biz, defBiz) => defBiz === "both" || defBiz === (biz || "ecommerce");

// The capability list for a client: each feature that applies to their business
// type, with whether their package grants it. An unknown key defaults ON, the
// same as can() in plan-limits.js — a feature added to the product later is not
// silently off for everyone until the owner has set it per package.
export function featureList(features = {}, biz = "ecommerce") {
  return FEATURE_DEFS
    .filter((d) => relevant(biz, d.biz))
    .map((d) => ({ key: d.key, label: d.label, on: features?.[d.key] !== false }));
}

// Shape one metered allowance for display. `limit` null/undefined = unlimited;
// `used` null = the count could not be read, shown as "—" and never as 0 (which
// would tell someone at their ceiling they had used nothing).
export function shapeMeter(key, label, used, limit) {
  const lim = limit === null || limit === undefined ? null : Number(limit);
  const u = used === null || used === undefined ? null : Number(used);
  const remaining = lim === null || u === null ? null : Math.max(0, lim - u);
  const pct = lim && u !== null ? Math.min(100, Math.round((u / lim) * 100)) : null;
  return { key, label, used: u, limit: lim, remaining, unlimited: lim === null, pct };
}
