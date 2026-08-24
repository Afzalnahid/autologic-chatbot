"use client";
import { useState } from "react";

// Filters the sidebar as you type.
//
// It walks the rendered links rather than owning the list, because the sidebar
// is server-rendered — real <a> tags that Google can follow and that work with
// JavaScript switched off. Search is the enhancement, not the source of truth,
// so a reader who never types sees the whole menu either way.
export default function DocsSearch({ placeholder, empty }) {
  const [none, setNone] = useState(false);

  const run = (raw) => {
    const q = raw.trim().toLowerCase();
    let hits = 0;
    document.querySelectorAll("[data-doc-name]").forEach((a) => {
      const show = !q || a.getAttribute("data-doc-name").includes(q);
      a.style.display = show ? "" : "none";
      if (show) hits++;
    });
    // A group heading with nothing under it is just noise.
    document.querySelectorAll(".dgrp").forEach((h) => {
      const links = [];
      let n = h.nextElementSibling;
      while (n && n.hasAttribute && n.hasAttribute("data-doc-name")) { links.push(n); n = n.nextElementSibling; }
      h.style.display = links.some((l) => l.style.display !== "none") ? "" : "none";
    });
    setNone(!!q && hits === 0);
  };

  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ position: "relative" }}>
        <i className="ti ti-search" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
          fontSize: 14, color: "var(--lp-soft)", pointerEvents: "none" }} />
        <input type="search" placeholder={placeholder} onChange={(e) => run(e.target.value)}
          aria-label={placeholder}
          style={{ width: "100%", padding: "9px 12px 9px 32px", borderRadius: 10,
            border: "1px solid var(--lp-line)", background: "var(--lp-card)", color: "var(--lp-ink)",
            fontSize: 13, fontFamily: "inherit", outline: "none" }} />
      </div>
      {none && <div style={{ fontSize: 12, color: "var(--lp-soft)", padding: "9px 10px 0" }}>{empty}</div>}
    </div>
  );
}
