"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { T, taka } from "./ui.js";
import { findAll, flatten } from "@/lib/global-search.js";

// The search box in every page's header ("Search customers, orders…", the
// owner's design deck of 2026-09-20). It looks through what the dashboard has
// already loaded and jumps to the pick: a customer opens their chat, an order
// opens in Orders, a product opens Inventory with that search filled in. The
// matching itself is src/lib/global-search.js.

const PCOLOR = { facebook: "#1877f2", instagram: "#e1306c", whatsapp: "#25d366" };

export default function GlobalSearch({ convos = [], orders = [], products = [], isAgency = false, onGo, t, autoFocus = false, onClose, style }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const box = useRef(null);
  const groups = useMemo(() => findAll(q, { convos, orders, products, isAgency }), [q, convos, orders, products, isAgency]);
  const rows = flatten(groups);
  useEffect(() => { setHi(0); }, [q]);
  // A click anywhere else closes the list.
  useEffect(() => {
    const h = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const pick = (r) => {
    if (!r) return;
    onGo?.(r.kind, r.id, q);
    setQ(""); setOpen(false); onClose?.();
  };
  const onKey = (e) => {
    if (e.key === "Escape") { setOpen(false); onClose?.(); return; }
    if (!rows.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((i) => (i + 1) % rows.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((i) => (i - 1 + rows.length) % rows.length); }
    else if (e.key === "Enter") { e.preventDefault(); pick(rows[hi]); }
  };

  const showList = open && q.trim().length > 0;
  let idx = -1;
  const group = (title, items, render) => items.length ? <div key={title}>
    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: T.textDim, padding: "8px 12px 4px" }}>{title}</div>
    {items.map((r) => { idx++; const on = idx === hi; return <button key={r.kind + r.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(r)}
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 12px", border: "none", cursor: "pointer", textAlign: "left",
        background: on ? T.goldBg : "transparent", color: T.text, fontFamily: "inherit", minHeight: 40 }}>
      {render(r)}
    </button>; })}
  </div> : null;

  return <div ref={box} style={{ position: "relative", ...style }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, height: 42, padding: "0 12px", borderRadius: 10, background: T.card, border: `1px solid ${T.border}` }}>
      <i className="ti ti-search" style={{ fontSize: 16, color: T.textDim, flexShrink: 0 }} />
      <input value={q} autoFocus={autoFocus} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey}
        placeholder={t(isAgency ? "shell.searchAgency" : "shell.search")} aria-label={t("shell.searchAria")}
        style={{ flex: 1, minWidth: 0, background: "none", border: "none", outline: "none", color: T.text, fontSize: 13.5 }} />
      {q && <button type="button" onClick={() => { setQ(""); setOpen(false); }} aria-label="Clear" style={{ background: "none", border: "none", cursor: "pointer", color: T.textDim, padding: 2, display: "flex" }}><i className="ti ti-x" style={{ fontSize: 14 }} /></button>}
    </div>
    {showList && <div role="listbox" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 60, background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 12, boxShadow: T.nmOut, padding: "4px 0", maxHeight: "min(60vh, 420px)", overflowY: "auto" }}>
      {rows.length ? <>
        {group(t("search.customers"), groups.customers, (r) => <>
          <span style={{ position: "relative", width: 30, height: 30, borderRadius: "50%", background: T.goldBg, color: T.gold, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>
            {String(r.title || "?").trim().replace(/^\+/, "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?"}
            <span style={{ position: "absolute", right: -1, bottom: -1, width: 9, height: 9, borderRadius: "50%", background: PCOLOR[r.platform] || T.textDim, border: `2px solid ${T.card}` }} />
          </span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
            {r.sub && <span style={{ display: "block", fontSize: 11.5, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.sub}</span>}
          </span>
        </>)}
        {group(t("search.orders"), groups.orders, (r) => <>
          <span style={{ width: 30, height: 30, borderRadius: 9, background: T.inset, color: T.textMuted, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><i className="ti ti-shopping-cart" style={{ fontSize: 15 }} /></span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
            <span style={{ display: "block", fontSize: 11.5, color: T.textMuted }}>{r.sub}{r.total != null ? ` · ${taka(r.total)}` : ""}</span>
          </span>
        </>)}
        {group(t("search.products"), groups.products, (r) => <>
          <span style={{ width: 30, height: 30, borderRadius: 9, background: T.inset, color: T.textMuted, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><i className="ti ti-package" style={{ fontSize: 15 }} /></span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
            <span style={{ display: "block", fontSize: 11.5, color: T.textMuted }}>{[r.sub, r.price != null && r.price !== "" ? taka(r.price) : null].filter(Boolean).join(" · ")}</span>
          </span>
        </>)}
      </> : <div style={{ padding: "14px 12px", fontSize: 12.5, color: T.textMuted }}>{t("search.none", { q: q.trim() })}</div>}
    </div>}
  </div>;
}
