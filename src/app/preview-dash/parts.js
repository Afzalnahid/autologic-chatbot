import { D, FONT, mono } from "./kit.js";

// Small, boring, reusable. The reference's polish comes from every card, badge and
// table looking identical everywhere — which only happens if there is one of each.

const TONE = {
  blue: [D.blue, D.blueSoft], mint: [D.mint, D.mintSoft],
  amber: [D.amber, D.amberSoft], rose: [D.rose, D.roseSoft],
  grey: [D.inkSoft, D.lineSoft],
};

export function Badge({ tone = "grey", children }) {
  const [fg, bg] = TONE[tone] || TONE.grey;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: bg, color: fg,
      fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 6, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

export function Card({ title, action, pad = 20, children, style }) {
  return (
    <section style={{ background: D.surface, border: `1px solid ${D.line}`, borderRadius: 14,
      boxShadow: "0 1px 2px rgba(19,23,34,.04)", ...style }}>
      {title && (
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, padding: "15px 20px", borderBottom: `1px solid ${D.lineSoft}` }}>
          <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: D.ink }}>{title}</h2>
          {action}
        </header>
      )}
      <div style={{ padding: pad }}>{children}</div>
    </section>
  );
}

export function Btn({ kind = "ghost", icon, children, style }) {
  const base = { display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 600,
    padding: "9px 14px", borderRadius: 9, cursor: "pointer", whiteSpace: "nowrap",
    border: `1px solid ${D.line}`, background: D.surface, color: D.ink, textDecoration: "none" };
  const kinds = {
    primary: { background: D.blue, borderColor: D.blue, color: "#fff" },
    ghost: {},
    quiet: { background: "transparent", borderColor: "transparent", color: D.inkSoft },
    danger: { background: D.surface, borderColor: D.line, color: D.rose },
  };
  return (
    <button className="btn" style={{ ...base, ...kinds[kind], ...style }}>
      {icon && <i className={`ti ${icon}`} style={{ fontSize: 15 }} />}
      {children}
    </button>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label style={{ display: "block", marginBottom: 18 }}>
      <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: D.ink, marginBottom: 6 }}>{label}</span>
      {children}
      {hint && <span style={{ display: "block", fontSize: 12, color: D.inkFaint, marginTop: 6 }}>{hint}</span>}
    </label>
  );
}

export function Input({ value, placeholder, mono: isMono }) {
  return (
    <input className="inp" defaultValue={value} placeholder={placeholder} readOnly
      style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${D.line}`,
        background: D.surface, color: D.ink, fontSize: 13.5,
        fontFamily: isMono ? FONT.mono : FONT.ui }} />
  );
}

export function Toggle({ on }) {
  return (
    <span style={{ width: 38, height: 22, borderRadius: 11, background: on ? D.blue : D.line,
      display: "inline-flex", alignItems: "center", padding: 3, transition: "background .18s ease-out" }}>
      <span style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff",
        transform: on ? "translateX(16px)" : "none", transition: "transform .2s cubic-bezier(.16,1,.3,1)",
        boxShadow: "0 1px 3px rgba(19,23,34,.3)" }} />
    </span>
  );
}

export function Table({ head, rows }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} style={{ ...mono, color: D.inkFaint, textAlign: "left", padding: "0 14px 10px 0",
                borderBottom: `1px solid ${D.line}`, fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="row">
              {r.map((cell, j) => (
                <td key={j} style={{ padding: "13px 14px 13px 0", borderBottom: `1px solid ${D.lineSoft}`,
                  color: j === 0 ? D.ink : D.inkSoft, fontWeight: j === 0 ? 600 : 400, whiteSpace: "nowrap" }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// A sparkline is drawn, not charted: no library, and it scales to whatever it is given.
export function Spark({ data, tone = D.blue, w = 84, h = 26 }) {
  const max = Math.max(...data), min = Math.min(...data), span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - ((v - min) / span) * (h - 3) - 1.5]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${d} L${w} ${h} L0 ${h} Z`;
  const id = `sp${Math.round(data[0] * 1000 + data.length)}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tone} stopOpacity=".22" />
          <stop offset="1" stopColor={tone} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={tone} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Stat({ label, value, delta, spark }) {
  const up = delta >= 0;
  // "Needed a human" falling is good news, so the arrow follows the number and the
  // colour follows the meaning — decided by the caller, not guessed here.
  const good = label === "Needed a human" ? !up : up;
  return (
    <div className="card" style={{ background: D.surface, border: `1px solid ${D.line}`, borderRadius: 14,
      padding: "16px 18px", boxShadow: "0 1px 2px rgba(19,23,34,.04)" }}>
      <div style={{ ...mono, color: D.inkFaint, marginBottom: 12 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 27, fontWeight: 700, color: D.ink, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{value}</div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 7,
            fontSize: 12.5, fontWeight: 600, color: good ? D.mint : D.rose }}>
            <i className={`ti ti-arrow-${up ? "up" : "down"}-right`} style={{ fontSize: 14 }} />
            {Math.abs(delta)}%
          </div>
        </div>
        <Spark data={spark} tone={good ? D.mint : D.rose} />
      </div>
    </div>
  );
}

export function Empty({ icon, title, body, cta }) {
  return (
    <div style={{ textAlign: "center", padding: "44px 20px" }}>
      <div style={{ width: 46, height: 46, borderRadius: 12, background: D.blueSoft, margin: "0 auto 14px",
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        <i className={`ti ${icon}`} style={{ fontSize: 22, color: D.blue }} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: D.ink, marginBottom: 6 }}>{title}</div>
      <p style={{ fontSize: 13.5, lineHeight: 1.65, color: D.inkSoft, maxWidth: 380, margin: "0 auto 18px" }}>{body}</p>
      {cta}
    </div>
  );
}

export const grid = (min) => ({ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))`, gap: 16 });
