"use client";
import { T } from "./ui.js";
import { useLang, useT } from "./i18n.js";
import { PAGES } from "@/lib/docs/index.js";

// The link from a dashboard tab to that tab's page in the manual.
//
// One control resolved from the open tab rather than one written into each of
// the eleven tabs: it is always in the same place, and a tab added later
// cannot forget it.
//
// Lives in its own file rather than in ui.js because i18n.js already imports
// ui.js — putting a translated component back into ui.js would close the
// import loop.

// Dashboard page key → documentation slug, DERIVED from the manual's own list
// of pages rather than written out again here.
//
// It used to be a hand-written map, and it did what a second copy of anything
// does. The AI Assistant tab was added and its documentation page written, and
// this map was never told — so the one tab the manual leads with was the only
// tab in the dashboard with no "Read docs" link at all. Nothing failed; the
// link simply was not there.
//
// Several keys differ from their slug on purpose — "settings" is the key Bot
// Training kept when it was renamed, "conversations" is the key Inbox kept —
// and PAGES already records every one of them.
//
// Two pages name the same tab (channels, and website-widget). The first wins,
// and PAGES is in reading order, so the link opens the page that introduces
// the tab rather than the one about a corner of it.
const SLUG = {};
for (const p of PAGES) if (p.tab && !SLUG[p.tab]) SLUG[p.tab] = p.slug;

export const docsSlugFor = (page) => SLUG[page] || "";

// Three shapes for three places:
//   plain   — quiet inline text, the way Meta's own console offers "Read docs".
//             Padding plus a matching negative margin keeps a thumb-sized hit
//             area without the text taking up any more room than it looks like.
//   compact — icon only, for a crowded row.
//   default — a small pill, for sitting among the header's buttons.
//
// The dashboard's language is carried into the docs URL, so someone reading the
// dashboard in Bangla lands on the Bangla guide rather than being dropped into
// English. It opens in a new tab: the owner is usually mid-task, and losing the
// tab they were on to read about it would be its own small bug.
export default function LearnMore({ page, slug, compact, plain, iconSize, style }) {
  const lang = useLang();
  const t = useT();
  const target = slug || docsSlugFor(page);
  if (!target) return null;
  const href = `/docs/${target}${lang === "bn" ? "?lang=bn" : ""}`;

  const base = plain
    ? { padding: "13px 8px", margin: "-13px -8px", fontSize: 12.5, fontWeight: 600, borderRadius: 8 }
    : { padding: compact ? 0 : "5px 11px", width: compact ? 36 : undefined, height: compact ? 36 : undefined,
        borderRadius: compact ? 11 : 999, fontSize: 11.5, fontWeight: 600, background: T.goldBg };

  return (
    <a href={href} target="_blank" rel="noreferrer" title={t("docs.learnHint")}
      aria-label={t("docs.learn")}
      style={{ display: "inline-flex", alignItems: "center", gap: plain ? 4 : 5, flexShrink: 0,
        justifyContent: "center", textDecoration: "none", color: T.gold,
        whiteSpace: "nowrap", ...base, ...style }}>
      {!plain && <i className="ti ti-book-2" style={{ fontSize: iconSize || (compact ? 16 : 13) }} />}
      {!compact && t("docs.learn")}
      {/* It opens a new tab — say so without words. */}
      {!compact && <i className="ti ti-external-link"
        style={{ fontSize: plain ? 12 : 12, marginLeft: plain ? 0 : "auto",
          paddingLeft: plain ? 0 : 6, opacity: plain ? .8 : .65 }} />}
    </a>
  );
}
