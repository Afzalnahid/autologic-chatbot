"use client";
import { T } from "./ui.js";
import { useLang, useT } from "./i18n.js";

// The link from a dashboard tab to that tab's page in the manual.
//
// Lives in its own file rather than in ui.js because i18n.js already imports
// ui.js — putting a translated component back into ui.js would close the
// import loop.
//
// The dashboard's language is carried into the docs URL, so someone reading
// the dashboard in Bangla lands on the Bangla guide rather than being dropped
// into English. It opens in a new tab: the owner is usually mid-task, and
// losing the tab they were on to read about it would be its own small bug.
export default function LearnMore({ slug, style }) {
  const lang = useLang();
  const t = useT();
  const href = `/docs/${slug}${lang === "bn" ? "?lang=bn" : ""}`;

  return (
    <a href={href} target="_blank" rel="noreferrer" title={t("docs.learnHint")}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
        padding: "5px 11px", borderRadius: 999, textDecoration: "none",
        fontSize: 11.5, fontWeight: 600, color: T.gold, background: T.goldBg,
        whiteSpace: "nowrap", ...style }}>
      <i className="ti ti-book-2" style={{ fontSize: 13 }} />
      {t("docs.learn")}
    </a>
  );
}
