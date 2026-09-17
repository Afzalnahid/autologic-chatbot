// The capability features a package can grant, and the pure helpers that shape
// them for display AND for enforcement. NO imports on purpose: this is the ONE
// labelled source of features, read by server code (plan-limits.js,
// entitlements.js) AND by client components (the admin console, the client
// dashboard), so it must be safe to bundle anywhere.
//
// Until 2026-09-18 these switches were display only: the admin panel saved
// them, the dashboard showed them, and nothing in the product ever asked. A
// Starter shop got photo matching, a Starter service got comment automation,
// and a shop package with no knowledge base still accepted document uploads.
// Now every key here has a gate in the code — tests/t-feature-gates.mjs fails
// the build if one is added without it.
//
// The used-vs-limit COUNTING lives in entitlements.js (it needs the database);
// everything here is pure and unit-tested.

// Every capability switch, with the one set of human labels used everywhere it
// is shown. `biz` limits a feature to the business type it means anything for —
// a shop has no calendar to book into, a service has no catalogue to match a
// photo against; "both" shows on either side. `what` is the sentence the admin
// panel shows under the switch: what turning it off actually stops.
export const FEATURE_DEFS = [
  // ── What the bot does with a customer's message ───────────────────────────
  { key: "vision",    area: "bot", label: "Photo product matching",      biz: "ecommerce",
    what: "A photo from a customer is read and matched to the catalogue. Off: the bot asks them to type the product name." },
  { key: "voice",     area: "bot", label: "Voice message understanding", biz: "both",
    what: "A voice note is transcribed and answered. Off: the bot asks them to type instead." },
  { key: "comments",  area: "bot", label: "Comment automation",          biz: "both",
    what: "Comments on posts get a public reply and a private message. Off: comments are left alone." },
  { key: "widget",    area: "bot", label: "Website chat widget",         biz: "both",
    what: "The chat bubble on the client's own website. Off: no widget can be created and an existing one stops answering." },
  { key: "broadcast", area: "bot", label: "Broadcasts",                  biz: "both",
    what: "Sending one message to many recent customers. Off: the Broadcast tab refuses to send." },
  { key: "followup",  area: "bot", label: "Follow-up messages",          biz: "both",
    what: "The automatic nudge to a customer who asked and went quiet. Off: no follow-ups go out." },

  // ── Building the catalogue and the knowledge base ─────────────────────────
  { key: "kb",             area: "catalogue", label: "Knowledge Base uploads",      biz: "agency",
    what: "Uploading documents the bot answers from. Off: uploads are refused (the file limit still applies when on)." },
  { key: "photo_import",   area: "catalogue", label: "Add products from photos",   biz: "ecommerce",
    what: "Dropping a batch of photos and letting the AI name and group them into products. Off: products are added one at a time or from a sheet." },
  { key: "website_import", area: "catalogue", label: "Import from a website",      biz: "ecommerce",
    what: "Pasting a shop URL and pulling its products in. Off: the import button refuses." },

  // ── Tools the owner presses ───────────────────────────────────────────────
  { key: "assistant", area: "tools", label: "AI Assistant",             biz: "both",
    what: "The chat assistant in the dashboard that adds products, sets offers and answers questions. Off: the tab says it is not in the package." },
  { key: "calendar",  area: "tools", label: "Google Calendar booking",  biz: "agency",
    what: "Connecting a calendar so the bot books meetings with Meet links. Off: the connect button refuses." },
  { key: "analytics", area: "tools", label: "Analytics dashboard",      biz: "both",
    what: "The Analytics tab. Off: it shows the package that includes it instead of the charts." },
  { key: "byok",      area: "tools", label: "Use your own AI key",      biz: "both",
    what: "Running the bot on the client's own Gemini key at the lower package price. The super admin still grants it per client from AI Keys." },
];

export const FEATURE_KEYS = FEATURE_DEFS.map((d) => d.key);

export const AREA_LABELS = {
  bot: "What the bot does with a customer's message",
  catalogue: "Building the catalogue and the knowledge base",
  tools: "Tools the owner presses",
};

const relevant = (biz, defBiz) => defBiz === "both" || defBiz === (biz || "ecommerce");

// true when a package's feature map allows a capability. Unknown keys default
// to allowed, so a feature added to the product later is not silently switched
// off for everyone until the owner has had a chance to set it per package.
export function featureOn(features, key) {
  const v = features?.[key];
  return v === undefined || v === null ? true : !!v;
}

// The gate's verdict for one feature, from a limits object as limitsFor()
// returns it ({ planName, features }). Pure, so the message can be tested
// without a database. The sentence is written for the person who will read it —
// a shop owner in the dashboard — and names the package they are on.
export function gateMessage(limits, key) {
  const def = FEATURE_DEFS.find((d) => d.key === key);
  const label = def?.label || key;
  if (featureOn(limits?.features, key)) return { ok: true, key, label };
  const plan = limits?.planName || "current";
  return {
    ok: false, key, label,
    message: `${label} is not included in your ${plan} package. Upgrade your package to turn it on.`,
  };
}

// A client's feature EXCEPTIONS, as they should be stored. The admin panel
// sends every switch it shows ("package" / true / false); only a boolean that
// actually differs from what the package already gives is kept. Storing a
// value equal to the package would be a quiet trap — the client would stop
// following the package, and turning the feature on for the package later
// would skip everyone whose panel had once been saved. Pure, so it is tested.
export function cleanFeatureOverrides(planFeatures = {}, requested = {}) {
  const out = {};
  for (const d of FEATURE_DEFS) {
    const v = requested?.[d.key];
    if (v !== true && v !== false) continue;            // "package", null, undefined → follow the package
    if (v === featureOn(planFeatures, d.key)) continue;  // same as the package → not an exception
    out[d.key] = v;
  }
  return out;
}

// The capability list for a client: each feature that applies to their business
// type, with whether their package grants it.
//
// `ownKey` is the one per-CLIENT override: the super admin can grant a client
// their own AI key regardless of the package's byok flag (only Scale sets it),
// so a client actually running on their own key shows "Use your own AI key" as
// ON even when their package does not include it. Package capabilities are still
// read from `features`; only byok takes the client's real key state into account.
export function featureList(features = {}, biz = "ecommerce", { ownKey = false } = {}) {
  return FEATURE_DEFS
    .filter((d) => relevant(biz, d.biz))
    .map((d) => ({
      key: d.key,
      label: d.label,
      area: d.area,
      on: d.key === "byok" ? (features?.byok !== false || !!ownKey) : featureOn(features, d.key),
    }));
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
