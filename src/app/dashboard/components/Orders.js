"use client";
import { useState, useMemo, useEffect } from "react";
import { T, Card, Btn, Badge, Inp, Select, Segmented, KStat, useIsMobile, taka, shortDate, fmtNum } from "./ui.js";
import { api } from "./session.js";

// The Orders tab: every order the bot recorded, with what the owner needs to
// ship it — who, where, what (with photos, sizes and quantities), the money
// split (subtotal / delivery / total), how they pay, and a status flow that
// runs Pending → Confirmed → Shipped → Delivered. Each card opens into a
// drawer for the full record, corrections and a private note.

const FLOW = ["Pending", "Confirmed", "Shipped", "Delivered"];
const STATUS = {
  Pending:   { color: T.warn,     icon: "ti-clock",          next: "Confirmed", verb: "Confirm" },
  Confirmed: { color: T.info,     icon: "ti-circle-check",   next: "Shipped",   verb: "Mark shipped" },
  Shipped:   { color: T.purple,   icon: "ti-truck-delivery", next: "Delivered", verb: "Mark delivered" },
  Delivered: { color: T.success,  icon: "ti-package-export", next: null },
  Cancelled: { color: T.danger,   icon: "ti-circle-x",       next: null },
  Returned:  { color: T.textDim,  icon: "ti-arrow-back-up",  next: null },
};
const PLAT = { facebook: { icon: "ti-brand-facebook", color: "#1877F2", label: "Messenger" }, instagram: { icon: "ti-brand-instagram", color: "#E1306C", label: "Instagram" }, whatsapp: { icon: "ti-brand-whatsapp", color: "#25D366", label: "WhatsApp" }, website: { icon: "ti-world", color: "#6D3FD9", label: "Website" } };
const ago = (iso) => { if (!iso) return ""; const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000); if (s < 60) return "just now"; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; if (s < 30 * 86400) return `${Math.floor(s / 86400)}d ago`; return shortDate(iso); };
const money = (n) => taka(Number(n) || 0);
const sameDay = (iso, d) => { const a = new Date(iso), b = d; return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); };

function StatusBadge({ s }) { const m = STATUS[s] || STATUS.Pending; return <Badge color={m.color}><i className={`ti ${m.icon}`} style={{ fontSize: 11, marginRight: 4 }} />{s}</Badge>; }
function Thumb({ url, size = 44 }) {
  return <div style={{ width: size, height: size, borderRadius: 12, background: T.bgAlt, boxShadow: T.nmIn, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
    {url ? <img src={url} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <i className="ti ti-package" style={{ color: T.textDim, fontSize: size * 0.45 }} />}
  </div>;
}
function Money({ o, compact }) {
  const hasSplit = o.delivery_charge !== null && o.delivery_charge !== undefined;
  return <div style={{ fontSize: compact ? 12 : 13, color: T.textMuted, display: "flex", flexDirection: "column", gap: 3 }}>
    {!compact && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal</span><span style={{ color: T.text }}>{money(o.subtotal)}</span></div>}
    {!compact && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Delivery</span><span style={{ color: hasSplit ? T.text : T.warn }}>{hasSplit ? money(o.delivery_charge) : "to confirm"}</span></div>}
    {!compact && o.discount > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Discount</span><span style={{ color: T.success }}>− {money(o.discount)}</span></div>}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: compact ? "none" : `1px solid ${T.border}`, paddingTop: compact ? 0 : 5, marginTop: compact ? 0 : 2 }}><span style={{ fontWeight: 600, color: T.text }}>Total</span><span style={{ fontWeight: 700, color: T.gold, fontSize: compact ? 15 : 17 }}>{money(o.total)}</span></div>
  </div>;
}

export default function Orders({ orders, refresh }) {
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState("All");
  const [q, setQ] = useState("");
  const [range, setRange] = useState("all");
  const [sort, setSort] = useState("newest");
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2800); return () => clearTimeout(t); }, [toast]);

  const update = async (id, patch) => {
    setBusy(id);
    const r = await api("/api/orders", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...patch }) }).then(r => r.json()).catch(() => ({ error: "network" }));
    setBusy("");
    if (r.error) { setToast("Could not save: " + r.error); return null; }
    if (open && open.id === id && r.order) setOpen(r.order);
    refresh(); return r.order;
  };
  const remove = async (o) => {
    if (!confirm(`Delete order #${o.order_code}? This cannot be undone.`)) return;
    await api("/api/orders", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: o.id }) }).catch(() => {});
    setOpen(null); setToast("Order deleted"); refresh();
  };

  const now = new Date();
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    let l = orders.filter(o => (filter === "All" || o.status === filter) &&
      (range === "all" || (range === "today" && sameDay(o.created_at, now)) || (range === "7d" && Date.now() - new Date(o.created_at).getTime() < 7 * 86400000) || (range === "30d" && Date.now() - new Date(o.created_at).getTime() < 30 * 86400000)) &&
      (!s || [o.order_code, o.customer_name, o.phone_number, o.address, o.product_names, ...(o.items || []).map(i => `${i.name} ${i.code} ${i.variant}`)].join(" ").toLowerCase().includes(s)));
    if (sort === "oldest") l = [...l].reverse();
    else if (sort === "amount") l = [...l].sort((a, b) => (b.total || 0) - (a.total || 0));
    return l;
  }, [orders, filter, q, range, sort]);

  const stats = useMemo(() => {
    const by = (s) => orders.filter(o => o.status === s).length;
    const today = orders.filter(o => sameDay(o.created_at, now));
    const delivered = orders.filter(o => o.status === "Delivered");
    return { total: orders.length, pending: by("Pending"), confirmed: by("Confirmed"), shipped: by("Shipped"), delivered: delivered.length, cancelled: by("Cancelled") + by("Returned"),
      today: today.length, todayAmt: today.reduce((n, o) => n + (o.total || 0), 0), revenue: delivered.reduce((n, o) => n + (o.total || 0), 0), open: by("Pending") + by("Confirmed") + by("Shipped") };
  }, [orders]);

  const chips = [{ value: "All", label: "All", badge: orders.length || undefined }, ...FLOW.map(s => ({ value: s, label: s, badge: orders.filter(o => o.status === s).length || undefined })), { value: "Cancelled", label: "Cancelled", badge: stats.cancelled || undefined }];

  const exportCsv = () => {
    const head = ["Order", "Date", "Status", "Customer", "Phone", "Address", "Items", "Qty", "Subtotal", "Delivery", "Discount", "Total", "Payment", "Channel", "Notes"];
    const rows = list.map(o => [o.order_code, new Date(o.created_at).toLocaleString("en-GB"), o.status, o.customer_name, o.phone_number, o.address, (o.items || []).map(i => `${i.name}${i.variant ? ` (${i.variant})` : ""} x${i.qty}`).join("; "), o.qty_total, o.subtotal, o.delivery_charge ?? "", o.discount || "", o.total, o.payment_method || "", o.platform || "", o.notes || ""]);
    const csv = [head, ...rows].map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" })); a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  return <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
    {orders.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
      <KStat icon="ti-clock" label="Needs action" value={stats.open} color={stats.pending ? T.warn : T.textDim} sub={`${stats.pending} pending · ${stats.confirmed} confirmed · ${stats.shipped} shipped`} />
      <KStat icon="ti-sun" label="Today" value={stats.today} color={T.gold} sub={money(stats.todayAmt)} />
      <KStat icon="ti-package-export" label="Delivered" value={stats.delivered} color={T.success} sub={`${money(stats.revenue)} collected`} />
      <KStat icon="ti-shopping-bag" label="All orders" value={stats.total} sub={`${stats.cancelled} cancelled / returned`} />
    </div>}

    <Card style={{ padding: isMobile ? "10px" : "10px 12px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <div style={{ position: "relative", flex: "1 1 200px", minWidth: 0 }}>
        <i className="ti ti-search" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textDim, fontSize: 16 }} />
        <input placeholder="Search order, name, phone, product…" value={q} onChange={e => setQ(e.target.value)} className="ui-inp" style={{ width: "100%", background: T.bgAlt, boxShadow: T.nmIn, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 12px 10px 36px", color: T.text, fontSize: 13.5, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
      </div>
      <Select value={range} onChange={setRange} options={[{ value: "all", label: "All time", icon: "ti-calendar" }, { value: "today", label: "Today", icon: "ti-sun" }, { value: "7d", label: "Last 7 days", icon: "ti-calendar-week" }, { value: "30d", label: "Last 30 days", icon: "ti-calendar-month" }]} />
      <Select value={sort} onChange={setSort} options={[{ value: "newest", label: "Newest first", icon: "ti-clock" }, { value: "oldest", label: "Oldest first", icon: "ti-history" }, { value: "amount", label: "Highest amount", icon: "ti-coin-taka" }]} />
      <Btn onClick={exportCsv} disabled={!list.length} style={{ marginLeft: "auto", borderRadius: 12 }}><i className="ti ti-download" style={{ marginRight: 6 }} />CSV</Btn>
    </Card>
    <div style={{ overflowX: "auto", margin: "0 -2px", padding: 2 }}><Segmented size="sm" value={filter} onChange={setFilter} items={chips} style={{ flexWrap: "nowrap", width: "max-content" }} /></div>

    {list.length === 0
      ? <Card style={{ padding: "clamp(24px,5vw,44px) 20px", textAlign: "center" }}>
          <div style={{ width: 66, height: 66, borderRadius: 20, background: T.card, boxShadow: T.nmSm, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}><i className="ti ti-shopping-bag" style={{ fontSize: 30, color: T.gold }} /></div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{orders.length ? "No orders match" : "No orders yet"}</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6, lineHeight: 1.6 }}>{orders.length ? "Try another filter or search." : "When a customer confirms an order in chat, the bot records it here with the items, address, phone and total."}</div>
        </Card>
      : <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
          {list.map(o => { const st = STATUS[o.status] || STATUS.Pending; const pl = PLAT[o.platform]; return <Card key={o.id} className="ui-card" style={{ padding: 0, overflow: "hidden", cursor: "pointer", display: "flex", flexDirection: "column" }} onClick={() => setOpen(o)}>
            <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${T.border}` }}>
              <span style={{ width: 34, height: 34, borderRadius: 11, background: `color-mix(in srgb, ${st.color} 12%, transparent)`, color: st.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}><i className={`ti ${st.icon}`} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13.5 }}>#{o.order_code}</span><StatusBadge s={o.status} /></div>
                <div style={{ fontSize: 11.5, color: T.textDim, marginTop: 2 }}>{ago(o.created_at)}{pl ? <> · <i className={`ti ${pl.icon}`} style={{ color: pl.color }} /> {pl.label}</> : null}</div>
              </div>
              <i className="ti ti-chevron-right" style={{ color: T.textDim }} />
            </div>
            <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ width: 30, height: 30, borderRadius: 10, background: T.accGrad, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{(o.customer_name || "?").trim().slice(0, 1).toUpperCase()}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.customer_name || "Customer"}</div>
                  <div style={{ fontSize: 12, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.phone_number ? <a href={`tel:${o.phone_number}`} onClick={e => e.stopPropagation()} style={{ color: T.gold, textDecoration: "none", fontWeight: 600 }}>{o.phone_number}</a> : "no phone"}{o.address ? ` · ${o.address}` : ""}</div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(o.items || []).slice(0, 3).map((it, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Thumb url={it.image_url} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name || it.code || "Item"}</div><div style={{ fontSize: 11.5, color: T.textDim }}>{[it.variant, it.code].filter(Boolean).join(" · ")}</div></div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}><div style={{ fontSize: 13, fontWeight: 600 }}>×{it.qty || 1}</div>{it.unit_price > 0 && <div style={{ fontSize: 11.5, color: T.textMuted }}>{money(it.unit_price)}</div>}</div>
                </div>)}
                {(o.items || []).length > 3 && <div style={{ fontSize: 11.5, color: T.textDim }}>+{o.items.length - 3} more item{o.items.length - 3 > 1 ? "s" : ""}</div>}
                {!(o.items || []).length && <div style={{ fontSize: 12.5, color: T.textDim }}>{o.product_names || "No items recorded"}</div>}
              </div>
              <div style={{ marginTop: "auto", paddingTop: 8, borderTop: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: T.textMuted }}>{o.qty_total || 0} item{o.qty_total === 1 ? "" : "s"}{o.payment_method ? ` · ${o.payment_method}` : ""}{o.delivery_charge === null || o.delivery_charge === undefined ? <span style={{ color: T.warn }}> · delivery to confirm</span> : ""}</span>
                <span style={{ fontWeight: 700, color: T.gold, fontSize: 16 }}>{money(o.total)}</span>
              </div>
            </div>
            {st.next && <div style={{ padding: "0 14px 12px" }} onClick={e => e.stopPropagation()}>
              <Btn gold small onClick={() => update(o.id, { status: st.next })} disabled={busy === o.id} style={{ width: "100%", borderRadius: 11, padding: "8px 14px" }}><i className={`ti ${STATUS[st.next].icon}`} style={{ marginRight: 6 }} />{busy === o.id ? "Saving…" : st.verb}</Btn>
            </div>}
          </Card>; })}
        </div>}

    {toast && <div style={{ position: "fixed", left: "50%", top: 14, transform: "translateX(-50%)", zIndex: 90, background: T.text, color: T.bg, borderRadius: 12, padding: "9px 14px", fontSize: 13, fontWeight: 500, boxShadow: T.nmOut }}>{toast}</div>}
    {open && <OrderDrawer o={orders.find(x => x.id === open.id) || open} onClose={() => setOpen(null)} update={update} remove={remove} busy={busy} isMobile={isMobile} />}
  </div>;
}

function OrderDrawer({ o, onClose, update, remove, busy, isMobile }) {
  const [note, setNote] = useState(o.owner_note || "");
  const [edit, setEdit] = useState(null); // {phone_number, address, delivery_charge, payment_method}
  useEffect(() => { const k = (e) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", k); document.body.style.overflow = "hidden"; return () => { document.removeEventListener("keydown", k); document.body.style.overflow = ""; }; }, []);
  const st = STATUS[o.status] || STATUS.Pending; const pl = PLAT[o.platform];
  const copy = (t) => { try { navigator.clipboard.writeText(t); } catch {} };
  const H = ({ icon, children, right }) => <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><span style={{ width: 28, height: 28, borderRadius: 9, background: T.goldBg, color: T.gold, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}><i className={`ti ${icon}`} /></span><span style={{ fontSize: 13.5, fontWeight: 700, flex: 1 }}>{children}</span>{right}</div>;
  const stepIdx = FLOW.indexOf(o.status);
  return <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(17,19,24,.45)", backdropFilter: "blur(3px)", display: "flex", justifyContent: "flex-end" }}>
    <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" style={{ width: isMobile ? "100%" : "min(560px, 100%)", height: "100%", background: T.bg, display: "flex", flexDirection: "column", boxShadow: "-12px 0 40px rgba(0,0,0,.25)", animation: "ord-slide .28s cubic-bezier(.16,1,.3,1) both" }}>
      <div style={{ padding: isMobile ? "12px 14px" : "16px 22px", display: "flex", alignItems: "center", gap: 12, background: T.card, boxShadow: T.nmSm, flexShrink: 0, position: "relative", zIndex: 1 }}>
        <span style={{ width: 42, height: 42, borderRadius: 13, background: `color-mix(in srgb, ${st.color} 12%, transparent)`, color: st.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}><i className={`ti ${st.icon}`} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, fontFamily: "monospace" }}>#{o.order_code}</div>
          <div style={{ fontSize: 11.5, color: T.textDim, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}><StatusBadge s={o.status} />{new Date(o.created_at).toLocaleString("en-GB")}{pl ? <> · <i className={`ti ${pl.icon}`} style={{ color: pl.color }} /> {pl.label}</> : null}</div>
        </div>
        <button onClick={onClose} className="pbtn" aria-label="Close" style={{ width: 36, height: 36, borderRadius: 11 }}><i className="ti ti-x" style={{ fontSize: 17 }} /></button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "14px 12px 24px" : "18px 22px 30px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Progress */}
        {o.status !== "Cancelled" && o.status !== "Returned" && <Card style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            {FLOW.map((s, i) => { const done = i <= stepIdx; return <div key={s} style={{ display: "flex", alignItems: "center", flex: i < FLOW.length - 1 ? 1 : "0 0 auto" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}><span style={{ width: 26, height: 26, borderRadius: "50%", background: done ? T.accGrad : T.bgAlt, boxShadow: done ? T.accGlow : T.nmIn, color: done ? "#fff" : T.textDim, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}><i className={`ti ${done ? "ti-check" : STATUS[s].icon}`} /></span><span style={{ fontSize: 10, color: done ? T.text : T.textDim, fontWeight: done ? 600 : 400, whiteSpace: "nowrap" }}>{s}</span></div>
              {i < FLOW.length - 1 && <div style={{ flex: 1, height: 3, margin: "0 6px 16px", borderRadius: 2, background: i < stepIdx ? T.gold : T.border }} />}
            </div>; })}
          </div>
        </Card>}
        {/* Customer */}
        <Card>
          <H icon="ti-user" right={!edit && <button onClick={() => setEdit({ customer_name: o.customer_name || "", phone_number: o.phone_number || "", address: o.address || "", delivery_charge: o.delivery_charge ?? "", payment_method: o.payment_method || "", delivery_area: o.delivery_area || "" })} style={{ background: "none", border: "none", color: T.gold, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}><i className="ti ti-pencil" style={{ marginRight: 4 }} />Edit</button>}>Customer & delivery</H>
          {!edit ? <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}><i className="ti ti-user-circle" style={{ color: T.textDim, width: 18 }} /><b>{o.customer_name || "—"}</b></div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}><i className="ti ti-phone" style={{ color: T.textDim, width: 18 }} />{o.phone_number ? <><a href={`tel:${o.phone_number}`} style={{ color: T.gold, fontWeight: 600, textDecoration: "none" }}>{o.phone_number}</a><button onClick={() => copy(o.phone_number)} title="Copy" style={{ background: "none", border: "none", color: T.textDim, cursor: "pointer", fontSize: 14, padding: 2 }}><i className="ti ti-copy" /></button></> : "—"}</div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}><i className="ti ti-map-pin" style={{ color: T.textDim, width: 18, marginTop: 2 }} /><span style={{ flex: 1, lineHeight: 1.5 }}>{o.address || "—"}{o.delivery_area ? <span style={{ color: T.textMuted }}> · {o.delivery_area}</span> : ""}</span>{o.address && <button onClick={() => copy(`${o.customer_name || ""}\n${o.phone_number || ""}\n${o.address || ""}`)} title="Copy name, phone, address" style={{ background: "none", border: "none", color: T.textDim, cursor: "pointer", fontSize: 14, padding: 2 }}><i className="ti ti-copy" /></button>}</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}><i className="ti ti-credit-card" style={{ color: T.textDim, width: 18 }} />{o.payment_method || <span style={{ color: T.textDim }}>payment not recorded</span>}</div>
            {o.notes && <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 10px", borderRadius: 10, background: T.warnBg, fontSize: 12.5, lineHeight: 1.5 }}><i className="ti ti-message-2" style={{ color: T.warn, marginTop: 2 }} /><span><b>Customer says:</b> {o.notes}</span></div>}
          </div> : <div>
            <Inp emb label="Customer name" value={edit.customer_name} onChange={e => setEdit({ ...edit, customer_name: e.target.value })} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><Inp emb label="Phone" value={edit.phone_number} onChange={e => setEdit({ ...edit, phone_number: e.target.value })} /><Inp emb label="Delivery area" value={edit.delivery_area} onChange={e => setEdit({ ...edit, delivery_area: e.target.value })} placeholder="inside / outside Dhaka" /></div>
            <Inp emb textarea label="Address" value={edit.address} onChange={e => setEdit({ ...edit, address: e.target.value })} inputStyle={{ minHeight: 70 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><Inp emb label="Delivery charge (৳)" inputMode="decimal" value={edit.delivery_charge} onChange={e => setEdit({ ...edit, delivery_charge: e.target.value })} placeholder="0" /><Inp emb label="Payment method" value={edit.payment_method} onChange={e => setEdit({ ...edit, payment_method: e.target.value })} placeholder="Cash on delivery" /></div>
            <div style={{ display: "flex", gap: 8 }}><Btn gold small disabled={busy === o.id} onClick={async () => { const r = await update(o.id, { ...edit, delivery_charge: edit.delivery_charge === "" ? 0 : edit.delivery_charge }); if (r) setEdit(null); }}>Save</Btn><Btn small onClick={() => setEdit(null)}>Cancel</Btn></div>
          </div>}
        </Card>
        {/* Items */}
        <Card>
          <H icon="ti-package" right={<span style={{ fontSize: 11.5, color: T.textDim }}>{o.qty_total} item{o.qty_total === 1 ? "" : "s"}</span>}>Items</H>
          {(o.items || []).length ? (o.items).map((it, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderTop: i ? `1px solid ${T.border}` : "none" }}>
            <Thumb url={it.image_url} size={52} />
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 600 }}>{it.name || "Item"}</div><div style={{ fontSize: 12, color: T.textMuted }}>{[it.variant && `Variant: ${it.variant}`, it.code && `Code ${it.code}`].filter(Boolean).join(" · ")}</div></div>
            <div style={{ textAlign: "right" }}><div style={{ fontSize: 13.5, fontWeight: 700 }}>{it.unit_price > 0 ? money(it.unit_price * (it.qty || 1)) : "—"}</div><div style={{ fontSize: 11.5, color: T.textMuted }}>×{it.qty || 1}{it.unit_price > 0 ? ` @ ${money(it.unit_price)}` : ""}</div></div>
          </div>) : <div style={{ fontSize: 13, color: T.textMuted }}>{o.product_names || "No items recorded."}</div>}
          <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 14, background: T.bgAlt, boxShadow: T.nmIn }}><Money o={o} /></div>
        </Card>
        {/* Status actions */}
        <Card>
          <H icon="ti-adjustments">Update status</H>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {st.next && <Btn gold onClick={() => update(o.id, { status: st.next })} disabled={busy === o.id} style={{ borderRadius: 12 }}><i className={`ti ${STATUS[st.next].icon}`} style={{ marginRight: 6 }} />{st.verb}</Btn>}
            {FLOW.filter(s => s !== o.status && s !== st.next).map(s => <Btn key={s} small onClick={() => update(o.id, { status: s })} disabled={busy === o.id} style={{ borderRadius: 10 }}>{s}</Btn>)}
            {o.status !== "Cancelled" && <Btn small onClick={() => update(o.id, { status: "Cancelled" })} disabled={busy === o.id} style={{ borderRadius: 10, color: T.danger, background: T.dangerBg }}>Cancel order</Btn>}
            {o.status === "Delivered" && <Btn small onClick={() => update(o.id, { status: "Returned" })} disabled={busy === o.id} style={{ borderRadius: 10 }}>Returned</Btn>}
          </div>
        </Card>
        {/* Private note */}
        <Card>
          <H icon="ti-note">Your private note <span style={{ fontWeight: 400, color: T.textDim, fontSize: 12 }}>— never shown to the customer</span></H>
          <Inp emb textarea value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Courier: Pathao, tracking 12345. Customer asked for evening delivery." inputStyle={{ minHeight: 70 }} style={{ marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}><Btn small gold disabled={busy === o.id || note === (o.owner_note || "")} onClick={() => update(o.id, { owner_note: note })}>Save note</Btn>{o.updated_at && <span style={{ fontSize: 11.5, color: T.textDim }}>updated {ago(o.updated_at)}</span>}</div>
        </Card>
        <button onClick={() => remove(o)} className="ui-btn" style={{ alignSelf: "flex-start", background: "none", border: "none", color: T.danger, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", padding: 6 }}><i className="ti ti-trash" style={{ marginRight: 5 }} />Delete this order</button>
      </div>
    </div>
    <style dangerouslySetInnerHTML={{ __html: `@keyframes ord-slide { from { transform: translateX(40px); opacity: 0 } to { transform: none; opacity: 1 } }` }} />
  </div>;
}
