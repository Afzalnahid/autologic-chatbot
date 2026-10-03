"use client";
import { useState } from "react";
import { quotePlan, planPrice, UNIT_DEFAULTS } from "@/lib/pricing.js";
import { formatMoney } from "@/lib/plans.js";

// One paid package on the public pages — the home page and /pricing use this
// same card (owner, 2026-10-04: "both pages need everything"), so the two can
// never show a different price or a different rule.
//
// The card shows the package as it is. "Need more? Set your numbers" opens a
// slider for each countable allowance — bot replies, products (shops) or
// knowledge files (services), AI Assistant questions — that only goes UP, and at
// most half the way to the next package (lib/pricing.js). The price on the card
// follows, and Buy carries the numbers into the dashboard
// (/dashboard?upgrade=…&c=replies.500,products.100), where the server prices
// them again with the same code. Own key (BYOK) is half of everything.
//
// Styled only with the public palette (--lp-*) and currentColor, so it reads on
// a plain card and on the maroon "most popular" card alike, in both themes.

const NAME = {
  en: { replies: "Bot replies a month", products: "Products", docs: "Knowledge files", assistant: "AI Assistant questions a month" },
  bn: { replies: "মাসে বট-উত্তর", products: "পণ্য", docs: "নলেজ ফাইল", assistant: "মাসে AI Assistant প্রশ্ন" },
};
// Which feature line describes which slider, so a raised number is not left
// saying the package's old figure.
const LINE = { replies: /bot repl|বট-উত্তর|রিপ্লাই/i, products: /product|পণ্য/i, docs: /document|file|নথি|ফাইল/i, assistant: /assistant/i };
const fmt = (n) => Number(n || 0).toLocaleString("en-IN");
const mix = (pct) => `color-mix(in srgb, currentColor ${pct}%, transparent)`;

export function customParam(custom) {
  return Object.entries(custom || {}).filter(([, v]) => Number(v) > 0).map(([k, v]) => `${k}.${v}`).join(",");
}

export default function PublicPlanCard({
  plan, plans = [], units = UNIT_DEFAULTS, byok = false, cycle = "monthly", bn = false,
  className, style, btnClass, btnStyle, badge, extra, showYearlyNote = false,
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState({});
  const lang = bn ? "bn" : "en";
  const yearly = cycle === "yearly";
  const per = bn ? (yearly ? "/বছর" : "/মাস") : (yearly ? "/year" : "/mo");
  const q = quotePlan({ plan, cycle, byok, custom, units, plans });
  const sliders = q.ok ? q.sliders : [];
  const base = planPrice(plan, { cycle, byok }) || 0;
  const std = planPrice(plan, { cycle }) || 0;
  const total = q.ok ? q.total : base;
  const raised = q.ok && Object.keys(q.custom).length > 0;
  const href = `/dashboard?upgrade=${encodeURIComponent(plan.id)}&cycle=${cycle}${byok ? "&byok=1" : ""}${raised ? `&c=${customParam(q.custom)}` : ""}`;

  // The package's feature lines, with any raised number written in.
  const features = (plan.feature_list || plan.features || []).map((f) => {
    for (const s of sliders) {
      const d = Number(custom[s.kind]) || 0;
      if (d > 0 && LINE[s.kind].test(f)) return f.replace(/[\d,]+/, fmt(s.base + d));
    }
    return f;
  });

  const set = (s, v) => setCustom((c) => ({ ...c, [s.kind]: Math.max(0, Math.min(s.max, v)) }));
  const sq = { width: 28, height: 28, borderRadius: 8, border: `1px solid ${mix(30)}`, background: "transparent", color: "inherit", cursor: "pointer", fontSize: 15, lineHeight: 1, flexShrink: 0, padding: 0 };

  return <div className={className} style={style}>
    {badge}
    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: bn ? 0 : ".08em", textTransform: bn ? "none" : "uppercase", opacity: .8 }}>
      {plan.name}{byok ? (bn ? " · নিজের কী" : " · Own key") : ""}
    </div>
    <div style={{ margin: "10px 0 4px", display: "flex", alignItems: "baseline", gap: 4, flexWrap: "wrap" }}>
      <span className="fr" style={{ fontSize: 34, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{formatMoney(total)}</span>
      <span style={{ fontSize: 13, opacity: .75 }}>{per}</span>
    </div>
    {raised && <div style={{ fontSize: 12, opacity: .8, marginBottom: 4 }}>
      {bn ? `প্যাকেজ ${formatMoney(base)} + বাড়তি ${formatMoney(total - base)}` : `Package ${formatMoney(base)} + ${formatMoney(total - base)} for your numbers`}
    </div>}
    {byok && std > base && <div style={{ fontSize: 12, opacity: .75, marginBottom: 4 }}>
      {bn ? `আমাদের AI দিয়ে প্যাকেজ ${formatMoney(std)} — অর্ধেক দাম` : `${formatMoney(std)} with our AI — half price`}
    </div>}
    {showYearlyNote && !yearly && <div style={{ fontSize: 11.5, opacity: .65, marginBottom: 4 }}>{bn ? `বা বছরে ${formatMoney(planPrice(plan, { cycle: "yearly", byok }))}` : `or ${formatMoney(planPrice(plan, { cycle: "yearly", byok }))}/year`}</div>}
    {plan.tagline && <div style={{ fontSize: 13, opacity: .8, minHeight: 38, lineHeight: 1.5 }}>{plan.tagline}</div>}
    {extra}

    {/* Set your own numbers — only up, priced as you go. */}
    {sliders.length > 0 && <div style={{ margin: "14px 0 0" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "9px 12px", borderRadius: 10,
          border: `1px dashed ${mix(35)}`, background: "transparent", color: "inherit", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
        <span><i className="ti ti-adjustments-horizontal" style={{ marginRight: 6 }} />{bn ? "আরও লাগবে? সংখ্যা বাড়িয়ে নিন" : "Need more? Set your numbers"}</span>
        <i className={open ? "ti ti-chevron-up" : "ti ti-chevron-down"} />
      </button>
      {open && <div style={{ padding: "6px 2px 0" }}>
        {sliders.map((s) => {
          const d = Number(custom[s.kind]) || 0;
          const line = q.lines.find((l) => l.kind === s.kind);
          return <div key={s.kind} style={{ padding: "10px 0", borderBottom: `1px solid ${mix(14)}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, fontSize: 12.5, marginBottom: 6 }}>
              <span style={{ opacity: .8 }}>{NAME[lang][s.kind] || s.name}</span>
              <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {fmt(s.base + d)}{d > 0 && line ? <span style={{ fontWeight: 600, opacity: .8, marginLeft: 5 }}>+{formatMoney(line.amount)}</span> : null}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button type="button" aria-label={bn ? "কমান" : "Less"} disabled={d <= 0} onClick={() => set(s, d - s.step)} style={{ ...sq, opacity: d <= 0 ? .35 : 1 }}>−</button>
              <input type="range" aria-label={NAME[lang][s.kind] || s.name} min={s.base} max={s.base + s.max} step={s.step} value={s.base + d}
                onChange={(e) => set(s, Number(e.target.value) - s.base)} style={{ flex: 1, minWidth: 0, accentColor: "currentColor", cursor: "pointer" }} />
              <button type="button" aria-label={bn ? "বাড়ান" : "More"} disabled={d >= s.max} onClick={() => set(s, d + s.step)} style={{ ...sq, opacity: d >= s.max ? .35 : 1 }}>+</button>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, opacity: .6, marginTop: 3, padding: "0 36px", fontVariantNumeric: "tabular-nums" }}>
              <span>{bn ? "প্যাকেজ" : "package"} {fmt(s.base)}</span><span>{bn ? "সর্বোচ্চ" : "up to"} {fmt(s.base + s.max)}</span>
            </div>
          </div>;
        })}
        {raised && <button type="button" onClick={() => setCustom({})} style={{ background: "none", border: "none", color: "inherit", opacity: .75, cursor: "pointer", fontSize: 12, padding: "8px 0 0", fontFamily: "inherit" }}>
          <i className="ti ti-refresh" style={{ marginRight: 4 }} />{bn ? "প্যাকেজের মানে ফেরত" : "Back to the package"}
        </button>}
        {q.better && <div style={{ fontSize: 12, lineHeight: 1.5, marginTop: 8, padding: "8px 10px", borderRadius: 9, background: mix(8) }}>
          {bn ? `আর মাত্র ${formatMoney(q.better.more)} বেশিতে ${q.better.name} — এর চেয়ে অনেক বেশি পাবেন।` : `${q.better.name} is only ${formatMoney(q.better.more)} more — and gives you much more.`}
        </div>}
      </div>}
    </div>}

    <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 22px", display: "grid", gap: 9, flex: 1, alignContent: "start" }}>
      {byok && <li style={{ display: "flex", gap: 8, fontSize: 13.5, lineHeight: 1.45, fontWeight: 600 }}>
        <i className="ti ti-key" style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} />{bn ? "আপনার নিজের Gemini বা OpenAI কী-তে চলে" : "Runs on your own Gemini or OpenAI key"}
      </li>}
      {features.map((f) => <li key={f} style={{ display: "flex", gap: 8, fontSize: 13.5, lineHeight: 1.45 }}>
        <i className="ti ti-check" style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} />{f}
      </li>)}
    </ul>
    <a href={href} className={btnClass} style={btnStyle}>
      {bn ? `${plan.name}${byok ? " (নিজের কী)" : ""} কিনুন${raised ? ` · ${formatMoney(total)}` : ""}` : `Buy ${plan.name}${byok ? " (own key)" : ""}${raised ? ` · ${formatMoney(total)}` : ""}`}
    </a>
  </div>;
}
