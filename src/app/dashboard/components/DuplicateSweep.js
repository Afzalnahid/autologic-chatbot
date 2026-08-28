"use client";
import { useState } from "react";
import { T, Card, Btn, taka } from "./ui.js";
import { apiJson } from "./session.js";
import { twinReason } from "@/lib/duplicate-keys.js";

// The twins a catalogue is already carrying.
//
// Every door now refuses to add the same product twice, but that does nothing
// about the pairs already sitting there — and those are the ones confusing the
// bot today. It answers "how much is the box t-shirt" by searching and reading
// back what it finds; with two rows it picks whichever scores higher and quotes
// a price that may be from the wrong one.
//
// Nothing here is automatic. The pile is shown with everything that differs
// between its rows — price, stock, photo, when it was added — one is marked to
// keep, and the owner changes that or leaves it. Deleting is permanent, so it
// happens on a press and never on a scan.
export default function DuplicateSweep({ groups, isMobile, onClose, onDone }) {
  // Which row survives each pile. Seeded with the fullest one, which is what
  // findTwins already sorted to the front.
  const [keep, setKeep] = useState(() => Object.fromEntries(groups.map((g) => [g.id, g.keep])));
  const [skip, setSkip] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const live = groups.filter((g) => !skip[g.id]);
  const doomed = live.flatMap((g) => g.items.filter((p) => p.id !== keep[g.id]).map((p) => p.id));

  const run = async () => {
    if (!doomed.length || busy) return;
    setBusy(true); setErr(""); setMsg(`Removing ${doomed.length}…`);
    // One request. The route already scopes the delete to this client at the
    // database, and a half-finished sweep would be worse than none.
    const r = await apiJson("/api/products", {
      method: "DELETE", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: doomed }),
    });
    setBusy(false); setMsg("");
    if (r.error) { setErr(r.error); return; }
    onDone(`Removed ${doomed.length} duplicate${doomed.length > 1 ? "s" : ""}. Your bot now has one answer for each product.`);
    onClose();
  };

  return <div onClick={() => !busy && onClose()} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(17,19,24,.45)", backdropFilter: "blur(3px)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 16 }}>
    <div onClick={(e) => e.stopPropagation()} className="ui-page" role="dialog" aria-modal="true" aria-label="Duplicate products"
      style={{ width: "100%", maxWidth: 780, maxHeight: isMobile ? "94dvh" : "90vh", background: T.bg, borderRadius: isMobile ? "22px 22px 0 0" : 22, boxShadow: T.nmOut, border: `1px solid ${T.border}`, display: "flex", flexDirection: "column" }}>

      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 20px 12px", flexShrink: 0 }}>
        <div style={{ width: 42, height: 42, borderRadius: 13, background: T.card, boxShadow: T.nmSm, display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ti ti-copy" style={{ fontSize: 20, color: T.warn }} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700 }}>{groups.length} product{groups.length > 1 ? "s appear" : " appears"} more than once</div>
          <div style={{ fontSize: 12, color: T.textMuted }}>Keep one of each. The bot cannot tell them apart, so it answers from whichever it happens to find.</div>
        </div>
        <button onClick={onClose} disabled={busy} className="pbtn" aria-label="Close" style={{ width: 36, height: 36, borderRadius: 11 }}><i className="ti ti-x" style={{ fontSize: 17 }} /></button>
      </div>

      <div style={{ padding: "0 20px", overflowY: "auto", flex: 1, minHeight: 0 }}>
        {groups.map((g) => {
          const off = !!skip[g.id];
          return <Card key={g.id} style={{ padding: 12, marginBottom: 10, opacity: off ? .5 : 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ flex: 1, fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: .7 }}>
                {g.items.length} rows · {twinReason(g.reasons)}
              </span>
              <button type="button" onClick={() => setSkip((s) => ({ ...s, [g.id]: !s[g.id] }))} disabled={busy} className="ui-btn"
                style={{ background: "none", border: "none", color: T.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "inherit", minHeight: 44, minWidth: 74, padding: "0 6px" }}>
                {off ? "Include" : "Leave alone"}
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {g.items.map((p) => {
                const on = keep[g.id] === p.id;
                return <label key={p.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: 10, borderRadius: 11, cursor: off || busy ? "default" : "pointer",
                  background: on ? T.goldBg : T.bgAlt, border: `1px solid ${on ? T.gold : "transparent"}` }}>
                  <input type="radio" name={`keep-${g.id}`} checked={on} disabled={off || busy} onChange={() => setKeep((s) => ({ ...s, [g.id]: p.id }))}
                    style={{ width: 17, height: 17, flexShrink: 0, accentColor: T.gold }} />
                  {p.image_url
                    ? <img src={p.image_url} alt="" style={{ width: 44, height: 44, flexShrink: 0, objectFit: "cover", borderRadius: 9, border: `1px solid ${T.border}` }} />
                    : <span style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 9, background: T.inset, display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ti ti-photo-off" style={{ fontSize: 17, color: T.textDim }} /></span>}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.product_name || "(no name)"}</span>
                    <span style={{ display: "block", fontSize: 11.5, color: T.textMuted, marginTop: 2 }}>
                      {[
                        p.product_code,
                        p.regular_price ? taka(p.regular_price) : "no price",
                        p.stock_qty === undefined || p.stock_qty === null ? "no stock count" : `${p.stock_qty} in stock`,
                        (p.images || []).length > 1 ? `${p.images.length} photos` : (p.image_url ? "" : "no photo"),
                        p.created_at ? `added ${String(p.created_at).slice(0, 10)}` : "",
                      ].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: on ? T.gold : T.danger }}>{off ? "" : on ? "KEEP" : "REMOVE"}</span>
                </label>;
              })}
            </div>
          </Card>;
        })}
      </div>

      <div style={{ padding: "12px 20px calc(16px + env(safe-area-inset-bottom))", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
        {err && <div style={{ fontSize: 12.5, color: T.danger, display: "flex", gap: 6, marginBottom: 8 }}><i className="ti ti-alert-circle" style={{ fontSize: 15, flexShrink: 0 }} /><span>{err}</span></div>}
        {msg && <div style={{ fontSize: 12.5, color: T.textMuted, marginBottom: 8 }}>{msg}</div>}
        <div style={{ fontSize: 11.5, color: T.textDim, marginBottom: 10, lineHeight: 1.6 }}>
          {doomed.length
            ? <>Keeping {live.length} product{live.length > 1 ? "s" : ""}, removing {doomed.length}. This cannot be undone — the removed rows and their photos are gone from the catalogue.</>
            : "Nothing selected for removal."}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <Btn onClick={onClose} disabled={busy} style={{ borderRadius: 12 }}>Cancel</Btn>
          <Btn gold onClick={run} disabled={busy || !doomed.length} style={{ borderRadius: 12, padding: "9px 20px" }}>
            {busy ? "Removing…" : `Remove ${doomed.length} duplicate${doomed.length === 1 ? "" : "s"}`}
          </Btn>
        </div>
      </div>
    </div>
  </div>;
}
