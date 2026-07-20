export const metadata = {
  title: "Autologic — AI Chatbot for Facebook, Instagram & WhatsApp",
  description: "Autologic is an AI-powered customer service chatbot platform that connects to Facebook, Instagram, and WhatsApp, and automates meeting scheduling with Google Calendar.",
};

const T = {
  bg: "#05080f", card: "#0d1529", gold: "#f0c040", goldBg: "rgba(240,192,64,0.08)",
  text: "#e8e8ec", muted: "#8b9cbd", border: "#1a2744", green: "#22c55e",
};

function Feature({ icon, title, desc }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.7 }}>{desc}</div>
    </div>
  );
}

export default function Home() {
  const wrap = { maxWidth: 1080, margin: "0 auto", padding: "0 24px" };
  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: "system-ui, sans-serif" }}>
      {/* Nav */}
      <nav style={{ borderBottom: `1px solid ${T.border}` }}>
        <div style={{ ...wrap, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: T.goldBg, border: `1px solid ${T.gold}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🤖</div>
            <span style={{ fontSize: 19, fontWeight: 700 }}>Autologic</span>
          </div>
          <a href="/dashboard" style={{ padding: "9px 20px", background: T.gold, color: "#0a0a0a", borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: "none" }}>Login</a>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ ...wrap, textAlign: "center", padding: "72px 24px 56px" }}>
        <div style={{ display: "inline-block", fontSize: 12.5, color: T.gold, background: T.goldBg, border: `1px solid ${T.gold}33`, borderRadius: 20, padding: "5px 14px", marginBottom: 22 }}>
          AI Customer Service Automation
        </div>
        <h1 style={{ fontSize: 42, fontWeight: 800, lineHeight: 1.2, margin: "0 0 18px", letterSpacing: -0.5 }}>
          One AI chatbot for<br />all your customer channels
        </h1>
        <p style={{ fontSize: 17, color: T.muted, maxWidth: 620, margin: "0 auto 32px", lineHeight: 1.7 }}>
          Autologic connects to your Facebook, Instagram, and WhatsApp, answers customer questions automatically with AI, and books meetings straight into your Google Calendar — 24/7, in your own voice.
        </p>
        <a href="/dashboard" style={{ display: "inline-block", padding: "13px 30px", background: T.gold, color: "#0a0a0a", borderRadius: 10, fontWeight: 700, fontSize: 15.5, textDecoration: "none" }}>Get started</a>
      </section>

      {/* Features */}
      <section style={{ ...wrap, padding: "20px 24px 64px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
          <Feature icon="💬" title="Multi-channel messaging" desc="Connect Facebook Messenger, Instagram Direct, and WhatsApp Business. All your customer conversations, handled by one AI assistant in a single dashboard." />
          <Feature icon="🧠" title="Smart AI replies" desc="The bot understands customer questions and answers using your own products or uploaded knowledge base — accurate, on-brand, and available around the clock." />
          <Feature icon="📅" title="Google Calendar booking" desc="For service businesses, the bot checks your Google Calendar availability, creates meetings, generates a Google Meet link, and sends it to the customer automatically." />
          <Feature icon="🛍️" title="Product & order handling" desc="For online shops, the bot recommends products, matches customer photos to your inventory, and records orders — turning chats into sales." />
          <Feature icon="📚" title="Knowledge base" desc="Upload PDFs, Word documents, or text files. Agencies can turn their documents into an instant, searchable knowledge base the bot answers from." />
          <Feature icon="🔒" title="Secure & private" desc="Each business's data is fully isolated. Access tokens are stored securely and never shared. Your customer data stays yours." />
        </div>
      </section>

      {/* Google Calendar usage disclosure — important for verification */}
      <section style={{ ...wrap, padding: "0 24px 64px" }}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "36px 32px" }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginTop: 0, marginBottom: 14 }}>How Autologic uses Google Calendar</h2>
          <p style={{ fontSize: 15, color: T.muted, lineHeight: 1.8, marginBottom: 14 }}>
            When a business owner connects their Google Calendar to Autologic, the app uses that access solely to automate meeting scheduling for their customers. Specifically, Autologic will:
          </p>
          <ul style={{ fontSize: 15, color: T.muted, lineHeight: 1.9, paddingLeft: 22, marginBottom: 14 }}>
            <li>Check the business owner's calendar availability when a customer requests a meeting.</li>
            <li>Create a calendar event with a Google Meet link on the owner's behalf when a booking is confirmed.</li>
            <li>Send the Google Meet link to the customer through the connected messaging channel.</li>
          </ul>
          <p style={{ fontSize: 15, color: T.muted, lineHeight: 1.8 }}>
            Autologic does not read, store, or share calendar data for any other purpose, and never uses it for advertising. Our use of information received from Google APIs adheres to the{" "}
            <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer" style={{ color: T.gold }}>Google API Services User Data Policy</a>, including the Limited Use requirements. You can disconnect Google Calendar at any time from your dashboard, which immediately revokes access.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${T.border}` }}>
        <div style={{ ...wrap, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, padding: "26px 24px", fontSize: 13.5, color: T.muted }}>
          <div>© 2026 Autologic · Kandirpar, Cumilla, Bangladesh</div>
          <div style={{ display: "flex", gap: 20 }}>
            <a href="/privacy" style={{ color: T.muted, textDecoration: "none" }}>Privacy Policy</a>
            <a href="/terms" style={{ color: T.muted, textDecoration: "none" }}>Terms of Service</a>
            <a href="mailto:nahidafzal97@gmail.com" style={{ color: T.muted, textDecoration: "none" }}>Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
