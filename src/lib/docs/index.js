// The documentation site's map: which pages exist, what order they read in,
// and which dashboard tab each one explains.
//
// Kept apart from the copy (en.js / bn.js) so a new page is declared once here
// and both languages follow. If a page has no entry in a language's copy file
// it renders an honest "being written" state instead of a broken page, and is
// left out of the sitemap — an empty page in Google is worse than no page.

// Sidebar groups, in reading order. The labels themselves are translated; only
// the ids live here.
export const GROUPS = ["start", "daily", "outreach", "business", "teach", "account", "help"];

// tab  — the dashboard page key, so "Open this tab" can deep-link to
//        /dashboard#<tab>. The dashboard already reads that hash on load.
// biz  — "both" unless the tab only exists for one business type. Pages marked
//        "both" must answer for ecommerce AND agency, which is why several of
//        them carry blocks tagged with a single business type.
export const PAGES = [
  { slug: "getting-started", group: "start",    icon: "ti-rocket",            tab: null,            biz: "both" },
  { slug: "channels",        group: "start",    icon: "ti-plug",              tab: "channels",      biz: "both" },
  { slug: "website-widget",  group: "start",    icon: "ti-world",             tab: "channels",      biz: "both" },
  { slug: "conversations",   group: "daily",    icon: "ti-messages",          tab: "conversations", biz: "both" },
  { slug: "comments",        group: "daily",    icon: "ti-message-circle-2",  tab: "comments",      biz: "both" },
  { slug: "analytics",       group: "daily",    icon: "ti-chart-bar",         tab: "analytics",     biz: "both" },
  { slug: "broadcast",       group: "outreach", icon: "ti-speakerphone",      tab: "broadcast",     biz: "both" },
  { slug: "inventory",       group: "business", icon: "ti-package",           tab: "inventory",     biz: "both" },
  { slug: "orders",          group: "business", icon: "ti-shopping-cart",     tab: "orders",        biz: "both" },
  { slug: "bot-training",    group: "teach",    icon: "ti-wand",              tab: "settings",      biz: "both" },
  { slug: "ai-engine",       group: "teach",    icon: "ti-cpu",               tab: "ai",            biz: "both" },
  { slug: "billing",         group: "account",  icon: "ti-credit-card",       tab: "billing",       biz: "both" },
  { slug: "profile",         group: "account",  icon: "ti-user",              tab: "profile",       biz: "both" },
  { slug: "faq",             group: "help",     icon: "ti-help-circle",       tab: null,            biz: "both" },
];

export const bySlug = (slug) => PAGES.find((p) => p.slug === slug) || null;

// Reading order for the "next page" link at the foot of every page — the same
// order the sidebar shows, so "next" always means "the one below this one".
export function neighbours(slug) {
  const i = PAGES.findIndex((p) => p.slug === slug);
  return { prev: i > 0 ? PAGES[i - 1] : null, next: i >= 0 && i < PAGES.length - 1 ? PAGES[i + 1] : null };
}

// A page counts as written when its copy has at least one content block. The
// shell renders the rest as "being written" rather than pretending.
export const isWritten = (doc) => !!(doc && Array.isArray(doc.blocks) && doc.blocks.length);
