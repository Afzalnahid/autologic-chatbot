import { T, FEATURES, COPY, wrap, Head, Nav, Footer, Eyebrow, Proof, Switch, shell } from "../shared.js";
export const metadata = { title: "C · Product — Autologic preview", robots: { index: false, follow: false } };

// VARIANT C — product-forward. The page proves rather than claims: real
// conversations, on all three channels, for both kinds of business.
//
// The channel colours below are the platforms' own. They are the one place brand
// colour comes from outside the palette, because a Messenger blue that is not
// Messenger blue stops being recognisable — which is the entire point of showing it.
const CH = {
  whatsapp:  { icon: "ti-brand-whatsapp",  name: "WhatsApp Business", tint: "#25D366", short: "WhatsApp" },
  messenger: { icon: "ti-brand-messenger", name: "Facebook Messenger", tint: "#0084FF", short: "Messenger" },
  instagram: { icon: "ti-brand-instagram", name: "Instagram Business", tint: "#E1306C", short: "Instagram" },
  website:   { icon: "ti-world",             name: "Your website",       tint: "#5B8CFF", short: "Website" },
};

function Bubble({ me, text }) {
  return (
    <div style={{ display: "flex", justifyContent: me ? "flex-end" : "flex-start" }}>
      <div style={{
        maxWidth: "84%", fontSize: 13, lineHeight: 1.62, padding: "9px 12px", borderRadius: 13,
        background: me ? T.gold : "#151B29", color: me ? "#0A0D14" : T.text,
        borderBottomRightRadius: me ? 4 : 13, borderBottomLeftRadius: me ? 13 : 4,
        border: me ? "none" : `1px solid ${T.border}`,
      }}>{text}</div>
    </div>
  );
}

function Chat({ channel, kind, lines, note, delay = 0, big = false }) {
  const c = CH[channel];
  return (
    <div className="al-card" data-reveal={delay} style={{ background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 16, padding: 15, boxShadow: big ? "0 24px 60px rgba(0,0,0,.45)" : "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, paddingBottom: 11, marginBottom: 13,
        borderBottom: `1px solid ${T.border}` }}>
        <i className={`ti ${c.icon}`} style={{ fontSize: 17, color: c.tint }} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</span>
        <span style={{ marginLeft: "auto", fontSize: 10.5, color: T.dim, border: `1px solid ${T.border}`,
          borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap" }}>{kind}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {lines.map((l, i) => <Bubble key={i} me={l[0] === "me"} text={l[1]} />)}
      </div>
      {note && (
        <div style={{ marginTop: 13, paddingTop: 11, borderTop: `1px solid ${T.border}`, fontSize: 11.5,
          color: T.dim, display: "flex", alignItems: "center", gap: 7 }}>
          <i className={`ti ${note[0]}`} style={{ color: T.gold, fontSize: 14 }} />{note[1]}
        </div>
      )}
    </div>
  );
}

export default function C() {
  return (
    <div style={shell}>
      <Head />
      <Nav />

      <section style={{ ...wrap, padding: "clamp(48px, 9vw, 88px) 22px clamp(36px, 6vw, 56px)" }}>
        <div className="al-two" style={{ display: "grid", gridTemplateColumns: "1.05fr .95fr",
          gap: "clamp(32px, 6vw, 64px)", alignItems: "center" }}>
          <div>
            <Eyebrow style={{ marginBottom: 24 }} />
            <h1 className="al-rise" style={{ animationDelay: ".08s", fontSize: "clamp(30px, 6.6vw, 46px)",
              fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.026em", margin: "0 0 18px" }}>
              One AI chatbot for all your customer channels
            </h1>
            <p className="al-rise" style={{ animationDelay: ".16s", fontSize: "clamp(15.5px, 2.6vw, 17.5px)",
              lineHeight: 1.65, color: T.muted, margin: "0 0 26px", maxWidth: 520 }}>{COPY.lead}</p>

            {/* The three channels, named and recognisable, before any feature talk. */}
            <div className="al-rise" style={{ animationDelay: ".2s", display: "flex", gap: 9, flexWrap: "wrap", marginBottom: 28 }}>
              {Object.values(CH).map((c) => (
                <span key={c.name} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5,
                  color: T.muted, background: T.card, border: `1px solid ${T.border}`, borderRadius: 999, padding: "7px 13px" }}>
                  <i className={`ti ${c.icon}`} style={{ fontSize: 15, color: c.tint }} />
                  {c.short}
                </span>
              ))}
            </div>

            <div className="al-rise" style={{ animationDelay: ".24s", display: "flex", gap: 12, flexWrap: "wrap" }}>
              <a href="/dashboard?auth=signup" className="al-cta" style={{ padding: "14px 30px", background: T.gold,
                color: "#0A0D14", borderRadius: 11, fontWeight: 700, fontSize: 15.5, textDecoration: "none" }}>{COPY.cta}</a>
              <a href="/pricing" className="al-btn" style={{ padding: "14px 28px", color: T.text,
                border: `1px solid ${T.border}`, borderRadius: 11, fontWeight: 600, fontSize: 15.5, textDecoration: "none" }}>{COPY.cta2}</a>
            </div>
            <Proof align="flex-start" />
          </div>

          <div className="al-rise" style={{ animationDelay: ".2s" }}>
            <Chat channel="whatsapp" kind="Service business" big
              lines={[
                ["me", "আপনাদের সার্ভিস প্যাকেজ কত?"],
                ["bot", "আমাদের তিনটি প্যাকেজ আছে — স্টার্টার ১,৫০০৳, প্রো ৩,৫০০৳ এবং এজেন্সি ৬,০০০৳ প্রতি মাসে।"],
                ["me", "বৃহস্পতিবার একটা মিটিং করা যাবে?"],
                ["bot", "বৃহস্পতিবার বিকেল ৪টা খালি আছে। মিটিং বুক করে দিলাম — লিংক পাঠিয়ে দিয়েছি। ✅"],
              ]}
              note={["ti-calendar-check", "Added to Google Calendar automatically"]} />
          </div>
        </div>
      </section>

      {/* Both kinds of business, on the channels they actually use. */}
      <section style={{ ...wrap, padding: "clamp(28px, 5vw, 48px) 22px clamp(48px, 8vw, 72px)" }}>
        <div data-reveal="0" style={{ marginBottom: 26, maxWidth: 620 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase",
            color: T.gold, marginBottom: 12 }}>Real conversations</div>
          <h2 style={{ fontSize: "clamp(22px, 4.6vw, 30px)", fontWeight: 700, lineHeight: 1.25,
            letterSpacing: "-0.015em", margin: "0 0 12px" }}>Whether you sell products or services</h2>
          <p style={{ fontSize: 15.5, lineHeight: 1.65, color: T.muted, margin: 0 }}>
            The same assistant, trained on your own catalogue or your own documents. It replies in the language the customer wrote in.
          </p>
        </div>

        <div className="al-rail">
          <Chat channel="messenger" kind="Online shop" delay={0}
            lines={[
              ["me", "এই শাড়িটার দাম কত? স্টকে আছে?"],
              ["bot", "জি আছে। জামদানি শাড়ি — ৩,২০০৳, ফ্রি ডেলিভারি। কোন রঙটা নেবেন?"],
              ["me", "লাল। নাম রাহেলা, কুমিল্লা।"],
              ["bot", "অর্ডার কনফার্ম হলো — কোড #AL2481। ক্যাশ অন ডেলিভারি, ২ দিনে পৌঁছাবে।"],
            ]}
            note={["ti-shopping-bag", "Order saved to your dashboard"]} />

          <Chat channel="instagram" kind="Online shop" delay={80}
            lines={[
              ["me", "📷 এই ড্রেসটা আপনাদের আছে?"],
              ["bot", "হ্যাঁ, ছবির সাথে মিলে গেছে — কটন কুর্তি, ১,৪৫০৳। সাইজ M ও L আছে।"],
              ["me", "Do you deliver outside Dhaka?"],
              ["bot", "Yes, we deliver nationwide. Delivery outside Dhaka takes 2–3 days."],
            ]}
            note={["ti-photo", "Matched the customer's photo to your inventory"]} />

          <Chat channel="whatsapp" kind="Service business" delay={160}
            lines={[
              ["me", "আপনারা কি ওয়েবসাইট বানান?"],
              ["bot", "জি। আমরা ওয়েবসাইট, ব্র্যান্ডিং ও সোশ্যাল মিডিয়া ম্যানেজমেন্ট করি।"],
              ["me", "একটু বিস্তারিত জানতে চাই।"],
              ["bot", "আমাদের টিমের সাথে একটা ফ্রি কনসালটেশন কলে বসতে পারেন — কোন দিন সুবিধা হবে?"],
            ]}
            note={["ti-file-text", "Answered from your uploaded documents"]} />

          <Chat channel="website" kind="Service business" delay={240}
            lines={[
              ["me", "Hi, I run a small clothing store. Can this handle my Facebook page?"],
              ["bot", "Yes — Messenger, Instagram, WhatsApp and this website widget, all from one dashboard."],
              ["me", "How do I add it to my site?"],
              ["bot", "One line of code, copied from your dashboard. It takes about a minute."],
            ]}
            note={["ti-code", "One line of code on your own website"]} />
        </div>

        <div className="al-hint">
          <i className="ti ti-arrow-right" /> Swipe to see every channel
        </div>
      </section>

      <section style={{ ...wrap, padding: "0 22px clamp(64px, 10vw, 96px)" }}>
        <div data-reveal="0" style={{ marginBottom: 26, maxWidth: 560 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase",
            color: T.gold, marginBottom: 12 }}>{COPY.sectionLabel}</div>
          <h2 style={{ fontSize: "clamp(22px, 4.6vw, 30px)", fontWeight: 700, lineHeight: 1.25,
            letterSpacing: "-0.015em", margin: 0 }}>{COPY.sectionTitle}</h2>
        </div>
        <div className="al-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 14 }}>
          {FEATURES.map((f, i) => (
            <div key={f.title} className="al-card" data-reveal={(i % 3) * 80}
              style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 22,
                display: "flex", gap: 14 }}>
              <i className={`ti ${f.icon}`} style={{ fontSize: 19, color: T.gold, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 650, marginBottom: 6, letterSpacing: "-0.01em" }}>{f.title}</div>
                <div style={{ fontSize: 14, lineHeight: 1.7, color: T.muted }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <style>{`@media (max-width: 860px) { .al-two { grid-template-columns: 1fr !important } }`}</style>
      <Footer />
      <Switch active="C" />
    </div>
  );
}
