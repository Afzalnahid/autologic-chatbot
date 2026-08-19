import { D, mono, SAMPLE as S, TAG_TONE, STATUS_TONE } from "./kit.js";
import { Badge, Card, Btn, Field, Input, Toggle, Table, Spark, Stat, Empty, grid } from "./parts.js";

const CH = Object.fromEntries(S.channels.map((c) => [c.id, c]));

function ChIcon({ id, size = 15 }) {
  return <i className={`ti ${CH[id]?.icon || "ti-message"}`} style={{ fontSize: size, color: D.inkSoft }} />;
}

// A plain SVG line chart. Two series, a grid, and labels — everything the reference
// shows, without pulling in a charting library for four hundred kilobytes.
function LineChart({ labels, a, b }) {
  const W = 720, H = 210, pad = { l: 34, r: 8, t: 10, b: 22 };
  const max = Math.ceil(Math.max(...a, ...b) / 50) * 50 || 50;
  const x = (i) => pad.l + (i / (labels.length - 1)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const path = (d) => d.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const ticks = [0, max / 2, max];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={D.lineSoft} strokeWidth="1" />
          <text x="0" y={y(t) + 3.5} style={{ ...mono, fontSize: 9 }} fill={D.inkFaint}>{t}</text>
        </g>
      ))}
      <path d={`${path(a)} L${x(a.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} fill={D.blue} opacity=".07" />
      <path d={path(a)} fill="none" stroke={D.blue} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d={path(b)} fill="none" stroke={D.amber} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray="5 5" />
      {a.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3" fill={D.surface} stroke={D.blue} strokeWidth="2" />)}
      {labels.map((l, i) => (
        <text key={l} x={x(i)} y={H - 6} textAnchor="middle" style={{ ...mono, fontSize: 9 }} fill={D.inkFaint}>{l}</text>
      ))}
    </svg>
  );
}

function Legend() {
  return (
    <div style={{ display: "flex", gap: 16, fontSize: 12.5, color: D.inkSoft }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <i style={{ width: 14, height: 2, background: D.blue, borderRadius: 2 }} />Bot
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <i style={{ width: 14, height: 2, background: D.amber, borderRadius: 2 }} />Human
      </span>
    </div>
  );
}

function ConvoRow({ c, active }) {
  return (
    <div className="row" style={{ display: "flex", gap: 12, padding: "13px 16px", cursor: "pointer",
      borderBottom: `1px solid ${D.lineSoft}`, background: active ? D.blueSoft : "transparent",
      borderLeft: `2px solid ${active ? D.blue : "transparent"}` }}>
      <div style={{ width: 34, height: 34, borderRadius: "50%", background: D.lineSoft, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, color: D.inkSoft }}>
        {c.name.slice(0, 1)}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
          <ChIcon id={c.ch} size={13} />
          <span style={{ fontSize: 13.5, fontWeight: 600, color: D.ink, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
          <span style={{ marginLeft: "auto", ...mono, fontSize: 9, color: D.inkFaint }}>{c.at}</span>
        </div>
        <div style={{ fontSize: 12.5, color: D.inkSoft, overflow: "hidden", textOverflow: "ellipsis",
          whiteSpace: "nowrap", marginBottom: 7 }}>{c.last}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Badge tone={TAG_TONE[c.tag]}>{c.tag}</Badge>
          {c.unread > 0 && (
            <span style={{ background: D.blue, color: "#fff", fontSize: 10.5, fontWeight: 700,
              minWidth: 18, height: 18, borderRadius: 9, display: "inline-flex", alignItems: "center",
              justifyContent: "center", padding: "0 5px" }}>{c.unread}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- the tabs ---------------------------------------------------------------

function Overview() {
  return (
    <>
      <div style={{ ...grid(210), marginBottom: 16 }}>
        {S.kpis.map((k) => <Stat key={k.label} {...k} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 16, marginBottom: 16 }} className="two">
        <Card title="Conversations answered" action={<Legend />} pad={16}>
          <LineChart labels={S.series.labels} a={S.series.bot} b={S.series.human} />
        </Card>

        <Card title="Where they came from" pad={18}>
          {S.channels.map((c) => (
            <div key={c.id} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                <i className={`ti ${c.icon}`} style={{ fontSize: 15, color: D.blue }} />
                <span style={{ fontSize: 13, color: D.ink, fontWeight: 500 }}>{c.name}</span>
                <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: D.ink }}>{c.share}%</span>
              </div>
              <div style={{ height: 5, background: D.lineSoft, borderRadius: 3 }}>
                <div style={{ width: `${c.share}%`, height: "100%", background: D.blue, borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="two">
        <Card title="Latest conversations" pad={0}
          action={<Btn kind="quiet" icon="ti-arrow-right">Open inbox</Btn>}>
          {S.convos.slice(0, 4).map((c, i) => <ConvoRow key={i} c={c} />)}
        </Card>

        <Card title="Busiest hours" pad={18}
          action={<span style={{ ...mono, color: D.inkFaint }}>Peak 18:00</span>}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 120 }}>
            {S.hours.map((h, i) => (
              <div key={i} title={`${i}:00 — ${h}`} style={{ flex: 1, height: `${Math.max(4, (h / 31) * 100)}%`,
                background: i === 18 ? D.blue : D.blueSoft, borderRadius: 3,
                border: `1px solid ${i === 18 ? D.blue : D.line}` }} />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", ...mono, color: D.inkFaint, marginTop: 10 }}>
            <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
          </div>
        </Card>
      </div>
    </>
  );
}

function Conversations() {
  const tags = ["All", "Order", "Product Inquiry", "Complaint", "Booking", "Other"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16 }} className="two">
      <Card pad={0}>
        <div style={{ padding: 14, borderBottom: `1px solid ${D.lineSoft}` }}>
          <Input placeholder="Search name or message" />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
            {tags.map((t, i) => (
              <span key={t} className="chip" style={{ fontSize: 12, fontWeight: 600, padding: "5px 10px",
                borderRadius: 7, cursor: "pointer", border: `1px solid ${i === 0 ? D.blue : D.line}`,
                background: i === 0 ? D.blue : D.surface, color: i === 0 ? "#fff" : D.inkSoft }}>{t}</span>
            ))}
          </div>
        </div>
        {S.convos.map((c, i) => <ConvoRow key={i} c={c} active={i === 0} />)}
      </Card>

      <Card pad={0} style={{ display: "flex", flexDirection: "column", minHeight: 520 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 18px",
          borderBottom: `1px solid ${D.lineSoft}` }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: D.lineSoft,
            display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, color: D.inkSoft }}>র</div>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: D.ink }}>রাহেলা আক্তার</div>
            <div style={{ fontSize: 12, color: D.inkFaint, display: "flex", alignItems: "center", gap: 6 }}>
              <ChIcon id="messenger" size={12} /> Messenger · replied 2m ago
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <Badge tone="blue">Order</Badge>
            <Btn kind="ghost" icon="ti-robot">Bot on</Btn>
          </div>
        </div>

        <div style={{ flex: 1, padding: 18, display: "flex", flexDirection: "column", gap: 10, background: D.canvas }}>
          {[["them", "এই শাড়িটার দাম কত? স্টকে আছে?"],
            ["bot", "জি আছে। জামদানি শাড়ি — ৩,২০০৳, ফ্রি ডেলিভারি। কোন রঙটা নেবেন?"],
            ["them", "লাল রঙটাই নেব। ঠিকানা কুমিল্লা।"],
            ["bot", "অর্ডার কনফার্ম হলো — কোড #AL2481। ক্যাশ অন ডেলিভারি, ২ দিনে পৌঁছাবে।"]].map(([who, t], i) => (
            <div key={i} style={{ alignSelf: who === "bot" ? "flex-start" : "flex-end", maxWidth: "76%",
              background: who === "bot" ? D.surface : D.blue, color: who === "bot" ? D.ink : "#fff",
              border: who === "bot" ? `1px solid ${D.line}` : "none", padding: "10px 13px", borderRadius: 12,
              fontSize: 13.5, lineHeight: 1.6 }}>{t}</div>
          ))}
          <div style={{ alignSelf: "flex-start", ...mono, color: D.inkFaint, marginTop: 4 }}>
            ⌗ Order #AL2481 saved to your dashboard
          </div>
        </div>

        <div style={{ display: "flex", gap: 9, padding: 14, borderTop: `1px solid ${D.lineSoft}` }}>
          <Input placeholder="Write a reply — the bot is handling this one" />
          <Btn kind="primary" icon="ti-send">Send</Btn>
        </div>
      </Card>
    </div>
  );
}

function Analytics() {
  return (
    <>
      <div style={{ ...grid(210), marginBottom: 16 }}>{S.kpis.map((k) => <Stat key={k.label} {...k} />)}</div>
      <Card title="Bot versus human, last 7 days" action={<Legend />} pad={16} style={{ marginBottom: 16 }}>
        <LineChart labels={S.series.labels} a={S.series.bot} b={S.series.human} />
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="two">
        <Card title="How conversations ended" pad={18}>
          {[["Handled by bot alone", 91, D.mint], ["Needed a human agent", 7, D.amber], ["Never answered", 2, D.rose]]
            .map(([label, pct, tone]) => (
            <div key={label} style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", marginBottom: 7, fontSize: 13 }}>
                <span style={{ color: D.ink }}>{label}</span>
                <span style={{ marginLeft: "auto", fontWeight: 700 }}>{pct}%</span>
              </div>
              <div style={{ height: 6, background: D.lineSoft, borderRadius: 3 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: tone, borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </Card>
        <Card title="Where your customers are" pad={18}>
          {S.countries.map((c) => (
            <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <span style={{ fontSize: 13, color: D.ink, minWidth: 92 }}>{c.name}</span>
              <span style={{ flex: 1, height: 6, background: D.lineSoft, borderRadius: 3 }}>
                <span style={{ display: "block", width: `${c.pct}%`, height: "100%", background: D.blue, borderRadius: 3 }} />
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, minWidth: 34, textAlign: "right" }}>{c.pct}%</span>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}

function Channels() {
  return (
    <div style={grid(300)}>
      {S.channels.map((c) => (
        <div key={c.id} className="card" style={{ background: D.surface, border: `1px solid ${D.line}`,
          borderRadius: 14, padding: 20, boxShadow: "0 1px 2px rgba(19,23,34,.04)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: D.blueSoft,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className={`ti ${c.icon}`} style={{ fontSize: 20, color: D.blue }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: D.ink }}>{c.name}</div>
              <div style={{ fontSize: 12.5, color: D.inkFaint, marginTop: 2 }}>{c.handle}</div>
            </div>
            <span style={{ marginLeft: "auto" }}>
              {c.state === "live"
                ? <Badge tone="mint"><i className="ti ti-circle-filled" style={{ fontSize: 7 }} />Live</Badge>
                : <Badge tone="amber">Paused</Badge>}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontSize: 12.5, color: D.inkSoft }}>Bot replies</span>
            <Toggle on={c.state === "live"} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <Btn kind="ghost" icon="ti-refresh">Reconnect</Btn>
            <Btn kind="danger">Disconnect</Btn>
          </div>
        </div>
      ))}
    </div>
  );
}

function Broadcast() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }} className="two">
      <Card title="Write your message" pad={20}>
        <p style={{ margin: "0 0 16px", fontSize: 13, lineHeight: 1.65, color: D.inkSoft }}>
          You can only message people who wrote to you in the last 24 hours. That is Meta's rule,
          not ours — sending outside it can get your Page blocked.
        </p>
        <textarea readOnly className="inp" rows={5} defaultValue="ঈদের অফার — সব শাড়িতে ২০% ছাড়, শুধু এই সপ্তাহে।"
          style={{ width: "100%", padding: 12, borderRadius: 9, border: `1px solid ${D.line}`,
            fontSize: 13.5, lineHeight: 1.6, resize: "vertical", color: D.ink, fontFamily: "inherit" }} />
        <div style={{ ...grid(150), marginTop: 16 }}>
          <Field label="Channel"><Input value="All connected channels" /></Field>
          <Field label="Who"><Input value="Active in the last 24 hours" /></Field>
          <Field label="Tag"><Input value="Any tag" /></Field>
        </div>
        <div style={{ display: "flex", gap: 9 }}>
          <Btn kind="ghost" icon="ti-users">Check who will get it</Btn>
          <Btn kind="primary" icon="ti-send">Send now</Btn>
        </div>
      </Card>

      <Card title="Audience" pad={20}>
        <div style={{ display: "flex", gap: 26, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 30, fontWeight: 700, color: D.mint }}>142</div>
            <div style={{ ...mono, color: D.inkFaint, marginTop: 4 }}>Will receive it</div>
          </div>
          <div>
            <div style={{ fontSize: 30, fontWeight: 700, color: D.inkFaint }}>38</div>
            <div style={{ ...mono, color: D.inkFaint, marginTop: 4 }}>Cannot be messaged</div>
          </div>
        </div>
        <div style={{ ...mono, color: D.inkFaint, marginBottom: 10 }}>Why some are left out</div>
        {[["31 people", "Outside Meta's 24-hour window"], ["7 people", "That channel is paused"]].map(([a, b]) => (
          <div key={a} style={{ display: "flex", gap: 10, padding: "10px 0", borderTop: `1px solid ${D.lineSoft}`, fontSize: 13 }}>
            <span style={{ fontWeight: 600, color: D.ink, whiteSpace: "nowrap" }}>{a}</span>
            <span style={{ color: D.inkSoft }}>{b}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

function Comments() {
  return (
    <Card title="Comments the bot answered" pad={0}>
      {S.comments.map((c, i) => (
        <div key={i} style={{ padding: 18, borderBottom: i < S.comments.length - 1 ? `1px solid ${D.lineSoft}` : "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
            <ChIcon id={c.ch} size={14} />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: D.ink }}>{c.name}</span>
            <span style={{ marginLeft: "auto", ...mono, color: D.inkFaint }}>{c.at}</span>
          </div>
          <div style={{ fontSize: 13.5, color: D.ink, marginBottom: 10 }}>{c.text}</div>
          <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: D.canvas,
            border: `1px solid ${D.line}`, borderRadius: 10, padding: "10px 12px" }}>
            <i className="ti ti-corner-down-right" style={{ fontSize: 15, color: D.blue, marginTop: 2 }} />
            <div style={{ fontSize: 13, color: D.inkSoft, lineHeight: 1.6 }}>
              {c.reply}
              <div style={{ ...mono, color: D.inkFaint, marginTop: 7 }}>⌗ Replied publicly, then in private</div>
            </div>
          </div>
        </div>
      ))}
    </Card>
  );
}

function Widget() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }} className="two">
      <Card title="Add it to your website" pad={20}>
        <p style={{ margin: "0 0 16px", fontSize: 13.5, lineHeight: 1.7, color: D.inkSoft }}>
          Copy this line into your site, just before the closing <code>&lt;/body&gt;</code> tag.
          Nothing else to install.
        </p>
        <div style={{ background: D.rail, borderRadius: 10, padding: 14, fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 12, color: "#C8D3EA", lineHeight: 1.7, overflowX: "auto", marginBottom: 14 }}>
          &lt;script src=&quot;https://www.getvoicium.com/widget.js&quot;<br />
          &nbsp;&nbsp;data-client=&quot;wk_FxRNUxXx-05kbCbnZZX4KT_kn5wVugqd&quot;&gt;&lt;/script&gt;
        </div>
        <Btn kind="primary" icon="ti-copy">Copy the line</Btn>
        <div style={{ marginTop: 24 }}>
          <Field label="Allowed websites" hint="The widget only answers on these domains.">
            <Input value="autologic.com.bd, nahid-afzal-portfolio.vercel.app" />
          </Field>
        </div>
      </Card>

      <Card title="How it will look" pad={20}>
        <div style={{ background: D.rail, borderRadius: 12, padding: 16, minHeight: 260,
          display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 9 }}>
          <div style={{ alignSelf: "flex-start", background: "#151B29", border: "1px solid #1F2839",
            color: "#E7EAF2", padding: "9px 12px", borderRadius: 12, fontSize: 12.5, maxWidth: "84%" }}>
            আসসালামু আলাইকুম! কীভাবে সাহায্য করতে পারি?
          </div>
          <div style={{ alignSelf: "flex-end", background: D.blue, color: "#0A0D14", padding: "9px 12px",
            borderRadius: 12, fontSize: 12.5, maxWidth: "84%" }}>Do you deliver to Sylhet?</div>
          <div style={{ alignSelf: "flex-start", background: "#151B29", border: "1px solid #1F2839",
            color: "#E7EAF2", padding: "9px 12px", borderRadius: 12, fontSize: 12.5, maxWidth: "84%" }}>
            Yes — nationwide, 2–3 days outside Dhaka.
          </div>
        </div>
        <div style={{ ...mono, color: D.inkFaint, marginTop: 12 }}>⌗ The widget keeps the dark theme</div>
      </Card>
    </div>
  );
}

function Orders() {
  return (
    <Card title="Orders" pad={20}
      action={<div style={{ display: "flex", gap: 8 }}><Btn kind="ghost" icon="ti-filter">Status</Btn>
        <Btn kind="ghost" icon="ti-download">Export</Btn></div>}>
      <Table head={["Order", "Customer", "Item", "Total", "Status", "Placed"]}
        rows={S.orders.map((o) => [
          <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>#{o.code}</span>,
          o.name, o.item, o.total, <Badge tone={STATUS_TONE[o.status]}>{o.status}</Badge>, o.at,
        ])} />
    </Card>
  );
}

function Inventory() {
  return (
    <Card title="Products the bot can sell from" pad={20}
      action={<Btn kind="primary" icon="ti-plus">Add product</Btn>}>
      <Table head={["Product", "Code", "Price", "In stock", ""]}
        rows={S.products.map((p) => [
          p.name,
          <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{p.code}</span>,
          p.price,
          p.stock === 0 ? <Badge tone="rose">Out of stock</Badge>
            : p.stock < 10 ? <Badge tone="amber">{p.stock} left</Badge> : `${p.stock}`,
          <Btn kind="quiet" icon="ti-pencil">Edit</Btn>,
        ])} />
    </Card>
  );
}

function Bookings() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }} className="two">
      <Card title="Upcoming meetings" pad={0}>
        {S.bookings.map((b, i) => (
          <div key={i} style={{ display: "flex", gap: 13, padding: 17,
            borderBottom: i < S.bookings.length - 1 ? `1px solid ${D.lineSoft}` : "none" }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: D.blueSoft, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="ti ti-calendar-check" style={{ fontSize: 19, color: D.blue }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: D.ink }}>{b.name}</div>
              <div style={{ fontSize: 12.5, color: D.inkSoft, marginTop: 2 }}>{b.topic}</div>
              <div style={{ ...mono, color: D.inkFaint, marginTop: 7 }}>{b.when}</div>
            </div>
            <span style={{ marginLeft: "auto" }}><Badge tone={STATUS_TONE[b.state]}>{b.state}</Badge></span>
          </div>
        ))}
      </Card>
      <Card title="Google Calendar" pad={20}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <Badge tone="mint"><i className="ti ti-circle-filled" style={{ fontSize: 7 }} />Connected</Badge>
          <span style={{ fontSize: 13, color: D.inkSoft }}>nahidafzal97@gmail.com</span>
        </div>
        <Field label="Meeting length"><Input value="30 minutes" /></Field>
        <Field label="Working hours" hint="The bot only offers times inside this window.">
          <Input value="10:00 — 19:00, Sunday to Thursday" />
        </Field>
        <Btn kind="ghost" icon="ti-refresh">Reconnect calendar</Btn>
      </Card>
    </div>
  );
}

function Knowledge() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }} className="two">
      <Card title="Your documents" pad={0}>
        {S.docs.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 13, padding: 16,
            borderBottom: i < S.docs.length - 1 ? `1px solid ${D.lineSoft}` : "none" }}>
            <i className="ti ti-file-text" style={{ fontSize: 20, color: D.blue }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: D.ink, overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
              <div style={{ ...mono, color: D.inkFaint, marginTop: 4 }}>{d.size} · {d.chunks} pieces · {d.at}</div>
            </div>
            <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <Badge tone="mint">Indexed</Badge>
              <Btn kind="quiet" icon="ti-trash" />
            </span>
          </div>
        ))}
      </Card>
      <Card pad={0}>
        <Empty icon="ti-cloud-upload" title="Add a document"
          body="PDF, Word or text. The bot reads it and answers from it — you do not have to write any rules."
          cta={<Btn kind="primary" icon="ti-upload">Choose a file</Btn>} />
      </Card>
    </div>
  );
}

function Settings() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="two">
      <Card title="How the bot speaks" pad={20}>
        <Field label="Bot name"><Input value="Autologic Assistant" /></Field>
        <Field label="Tone"><Input value="Friendly and helpful" /></Field>
        <Field label="Customer languages"
          hint="Follow the customer's language · Bangla only · English only">
          <Input value="Follow the customer's language" />
        </Field>
        <Field label="Greeting">
          <Input value="আসসালামু আলাইকুম! কীভাবে সাহায্য করতে পারি?" />
        </Field>
      </Card>
      <Card title="Automation" pad={20}>
        {[["Auto-tag conversations", true, "Sorts every chat into one label so you can filter the inbox."],
          ["Follow-up message", true, "Sends one nudge if a customer goes quiet, inside Meta's window."],
          ["Reply to comments", true, "Answers publicly, then continues in private."],
          ["Pause bot when you reply", false, "Hands the conversation to you the moment you type."]]
          .map(([label, on, hint]) => (
          <div key={label} style={{ display: "flex", gap: 14, padding: "14px 0",
            borderBottom: `1px solid ${D.lineSoft}` }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: D.ink }}>{label}</div>
              <div style={{ fontSize: 12.5, color: D.inkSoft, marginTop: 4, lineHeight: 1.6 }}>{hint}</div>
            </div>
            <span style={{ marginLeft: "auto", paddingTop: 2 }}><Toggle on={on} /></span>
          </div>
        ))}
      </Card>
    </div>
  );
}

function Billing() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 16 }} className="two">
      <Card title="Your plan" pad={20}>
        <div style={{ background: D.blueSoft, border: `1px solid ${D.blue}33`, borderRadius: 12,
          padding: 18, marginBottom: 18 }}>
          <div style={{ ...mono, color: D.blue, marginBottom: 8 }}>Current plan</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: D.ink }}>Pro — ৩,৫০০৳ / month</div>
          <div style={{ fontSize: 13, color: D.inkSoft, marginTop: 6 }}>Renews in {S.planDays} days</div>
        </div>
        {[["Messages this month", "8,412 of 10,000"], ["Channels", "4 of 4"], ["Team members", "2 of 3"]]
          .map(([a, b]) => (
          <div key={a} style={{ display: "flex", padding: "11px 0", borderTop: `1px solid ${D.lineSoft}`, fontSize: 13.5 }}>
            <span style={{ color: D.inkSoft }}>{a}</span>
            <span style={{ marginLeft: "auto", fontWeight: 600, color: D.ink }}>{b}</span>
          </div>
        ))}
        <div style={{ marginTop: 18 }}><Btn kind="primary" icon="ti-arrow-up">Upgrade to Agency</Btn></div>
      </Card>
      <Card title="Invoices" pad={20}>
        <Table head={["Invoice", "Date", "Amount", "Status", ""]}
          rows={S.invoices.map((v) => [
            <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{v.id}</span>,
            v.date, v.amount, <Badge tone="mint">{v.state}</Badge>,
            <Btn kind="quiet" icon="ti-download">PDF</Btn>,
          ])} />
      </Card>
    </div>
  );
}

function Profile() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="two">
      <Card title="Your business" pad={20}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: D.blue, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700 }}>A</div>
          <Btn kind="ghost" icon="ti-photo">Change logo</Btn>
        </div>
        <Field label="Business name"><Input value="Autologic Systems" /></Field>
        <Field label="Business type" hint="This decides whether the bot sells products or books meetings.">
          <Input value="Agency — services and bookings" />
        </Field>
        <Field label="Address"><Input value="Kandirpar, Cumilla, Bangladesh" /></Field>
      </Card>
      <Card title="Account" pad={20}>
        <Field label="Email"><Input value="nahidafzal97@gmail.com" /></Field>
        <Field label="Password"><Input value="••••••••••••" /></Field>
        <div style={{ paddingTop: 8 }}><Btn kind="ghost" icon="ti-key">Change password</Btn></div>
        <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${D.lineSoft}` }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: D.ink, marginBottom: 6 }}>Delete this account</div>
          <p style={{ margin: "0 0 14px", fontSize: 12.5, color: D.inkSoft, lineHeight: 1.65 }}>
            Every conversation, product and document is removed. This cannot be undone.
          </p>
          <Btn kind="danger" icon="ti-trash">Delete account</Btn>
        </div>
      </Card>
    </div>
  );
}

export const TABS = {
  overview: { title: "Dashboard", sub: "Everything at a glance", render: Overview },
  conversations: { title: "Conversations", sub: "Every channel in one inbox", render: Conversations },
  analytics: { title: "Analytics", sub: "How the bot is performing", render: Analytics },
  channels: { title: "Channels", sub: "Connect Facebook, Instagram, WhatsApp and your site", render: Channels },
  broadcast: { title: "Broadcast", sub: "Message everyone who wrote in the last 24 hours", render: Broadcast },
  comments: { title: "Comments", sub: "Public replies on your posts", render: Comments },
  widget: { title: "Website widget", sub: "One line of code on your own site", render: Widget },
  orders: { title: "Orders", sub: "Everything the bot recorded", render: Orders },
  inventory: { title: "Inventory", sub: "What the bot can sell from", render: Inventory },
  bookings: { title: "Bookings", sub: "Meetings the bot arranged", render: Bookings },
  knowledge: { title: "Knowledge base", sub: "Documents the bot answers from", render: Knowledge },
  settings: { title: "Settings", sub: "How the bot behaves", render: Settings },
  billing: { title: "Billing", sub: "Plan, usage and invoices", render: Billing },
  profile: { title: "Profile", sub: "Your business and account", render: Profile },
};
