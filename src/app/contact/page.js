export const metadata = { title: "Contact — Autologic" };

export default function Contact() {
  const S = { maxWidth: 760, margin: "0 auto", padding: "48px 24px", color: "#e8e8ec", fontFamily: "sans-serif", lineHeight: 1.8, fontSize: 15 };
  const card = { background: "#0d1529", border: "1px solid #1a2744", borderRadius: 14, padding: "22px 24px", marginBottom: 16, display: "flex", gap: 16, alignItems: "flex-start" };
  const icon = { width: 44, height: 44, borderRadius: 11, background: "rgba(240,192,64,0.08)", border: "1px solid rgba(240,192,64,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 };
  const label = { fontSize: 12.5, color: "#8b9cbd", marginBottom: 3 };
  const val = { fontSize: 15.5, fontWeight: 600 };
  return (
    <div style={{ background: "#05080f", minHeight: "100vh" }}>
      <div style={S}>
        <a href="/" style={{ color: "#8b9cbd", fontSize: 13.5, textDecoration: "none" }}>← Back to home</a>
        <h1 style={{ fontSize: 30, fontWeight: 700, marginTop: 18, marginBottom: 6 }}>Get in touch</h1>
        <p style={{ color: "#8b9cbd", marginBottom: 32, fontSize: 15.5 }}>Have a question about Autologic, need help setting up, or want to talk about your business? We're here to help.</p>

        <div style={card}>
          <div style={icon}>✉️</div>
          <div>
            <div style={label}>Email</div>
            <a href="mailto:nahidafzal97@gmail.com" style={{ ...val, color: "#f0c040", textDecoration: "none" }}>nahidafzal97@gmail.com</a>
            <div style={{ fontSize: 13.5, color: "#8b9cbd", marginTop: 4 }}>For support, sales, and general questions. We usually reply within 24 hours.</div>
          </div>
        </div>

        <div style={card}>
          <div style={icon}>📍</div>
          <div>
            <div style={label}>Address</div>
            <div style={val}>Kandirpar, Cumilla</div>
            <div style={{ fontSize: 13.5, color: "#8b9cbd", marginTop: 4 }}>Bangladesh</div>
          </div>
        </div>

        <div style={card}>
          <div style={icon}>🕐</div>
          <div>
            <div style={label}>Support hours</div>
            <div style={val}>Saturday – Thursday, 10:00 AM – 7:00 PM (GMT+6)</div>
            <div style={{ fontSize: 13.5, color: "#8b9cbd", marginTop: 4 }}>The AI chatbot itself runs 24/7 — these are our human support hours.</div>
          </div>
        </div>

        <div style={card}>
          <div style={icon}>💬</div>
          <div>
            <div style={label}>Existing customer?</div>
            <div style={val}>Sign in to your dashboard</div>
            <div style={{ fontSize: 13.5, color: "#8b9cbd", marginTop: 4 }}>Manage your channels, knowledge base, and bookings anytime from your <a href="/dashboard" style={{ color: "#f0c040", textDecoration: "none" }}>Autologic dashboard</a>.</div>
          </div>
        </div>

        <div style={{ marginTop: 36, display: "flex", gap: 20, fontSize: 13.5, flexWrap: "wrap" }}>
          <a href="/privacy" style={{ color: "#8b9cbd", textDecoration: "none" }}>Privacy Policy</a>
          <a href="/terms" style={{ color: "#8b9cbd", textDecoration: "none" }}>Terms of Service</a>
          <a href="/google-calendar" style={{ color: "#8b9cbd", textDecoration: "none" }}>Google Calendar</a>
        </div>
      </div>
    </div>
  );
}
