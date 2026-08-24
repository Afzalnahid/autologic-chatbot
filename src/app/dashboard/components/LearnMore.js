"use client";
import { T } from "./ui.js";
import { useLang, useT } from "./i18n.js";

// The link from a dashboard tab to that tab's page in the manual.
//
// One button in the top bar rather than a pill on each of the eleven tabs: it
// is always in the same place, it cannot be forgotten when a tab is added, and
// there is a single code path to keep correct.
//
// Lives in its own file rather than in ui.js because i18n.js already imports
// ui.js — putting a translated component back into ui.js would close the
// import loop.

// Dashboard page key → documentation slug. Two of them differ on purpose:
// "settings" is the page key that Bot Training kept when it was renamed, and
// "ai" is shorter than the docs page it explains.
const SLUG = {
  analytics: "analytics", conversations: "conversations", comments: "comments",
  broadcast: "broadcast", inventory: "inventory", orders: "orders",
  channels: "channels", billing: "billing", profile: "profile",
  settings: "bot-training", ai: "ai-engine",
};

export const docsSlugFor = (page) => SLUG[page] || "";

// The dashboard's language is carried into the docs URL, so someone reading the
// dashboard in Bangla lands on the Bangla guide rather than being dropped into
// English. It opens in a new tab: the owner is usually mid-task, and losing the
// tab they were on to read about it would be its own small bug.
export default function LearnMore({ page, slug, compact, iconSize, style }) {
  const lang = useLang();
  const t = useT();
  const target = slug || docsSlugFor(page);
  if (!target) return null;
  const href = `/docs/${target}${lang === "bn" ? "?lang=bn" : ""}`;

  return (
    <a href={href} target="_blank" rel="noreferrer" title={t("docs.learnHint")}
      aria-label={t("docs.learn")}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
        padding: compact ? 0 : "5px 11px", width: compact ? 36 : undefined, height: compact ? 36 : undefined,
        justifyContent: "center", borderRadius: compact ? 11 : 999, textDecoration: "none",
        fontSize: 11.5, fontWeight: 600, color: T.gold, background: T.goldBg,
        whiteSpace: "nowrap", ...style }}>
      <i className="ti ti-book-2" style={{ fontSize: iconSize || (compact ? 16 : 13) }} />
      {!compact && t("docs.learn")}
      {/* It opens a new tab, and in the sidebar it sits among rows that switch
          tabs — so it has to say, without words, that it leaves the page. */}
      {!compact && <i className="ti ti-external-link"
        style={{ fontSize: 12, marginLeft: "auto", paddingLeft: 6, opacity: .65 }} />}
    </a>
  );
}
