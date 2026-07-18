export const metadata = { title: "Privacy Policy - Autologic" };

export default function Privacy() {
  const S = { maxWidth: 760, margin: "0 auto", padding: "48px 24px", color: "#e8e8ec", fontFamily: "sans-serif", lineHeight: 1.8, fontSize: 15 };
  const H2 = { fontSize: 18, fontWeight: 600, marginTop: 36, marginBottom: 8, color: "#f0c040" };
  const P = { marginBottom: 12 };
  return (
    <div style={{ background: "#05080f", minHeight: "100vh" }}>
      <div style={S}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Privacy Policy</h1>
        <p style={{ color: "#8b9cbd", marginBottom: 32 }}>Last updated: July 18, 2026</p>
        <p style={P}>Autologic ("we", "our", "us") operates an AI-powered chatbot platform at autologic-chatbot.vercel.app. This Privacy Policy explains how we collect, use, store, and protect data.</p>
        <h2 style={H2}>1. Information We Collect</h2>
        <p style={P}><strong>From clients (business owners):</strong> Email and business name at registration. Facebook, Instagram, and WhatsApp access tokens and account IDs when channels are connected. Google Calendar OAuth tokens (access token and refresh token) when a client connects their Google Calendar — used exclusively to check availability and create meeting events on that client's own calendar. Business logo, product catalogue, and knowledge base documents uploaded by the client.</p>
        <p style={P}><strong>From end users (customers):</strong> Messages sent through connected channels. Sender ID and public profile name as provided by the respective platform. Order or booking information provided during a conversation.</p>
        <h2 style={H2}>2. Google Calendar Data — Limited Use Disclosure</h2>
        <p style={P}>Autologic's use of data obtained from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.</p>
        <p style={P}>When a client connects Google Calendar, we use that access only to:</p>
        <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
          <li style={{ marginBottom: 6 }}>Check the client's calendar availability (free/busy) when a customer requests a meeting.</li>
          <li style={{ marginBottom: 6 }}>Create calendar events with a Google Meet link on the client's behalf when a booking is confirmed.</li>
          <li style={{ marginBottom: 6 }}>Send the Google Meet link to the customer via the connected messaging channel.</li>
        </ul>
        <p style={P}>We do <strong>not</strong> read, store, share, or use Google Calendar data for any purpose beyond the above. We do not use it for advertising, profiling, or any secondary purpose. When a client disconnects Google Calendar, all stored OAuth tokens are immediately deleted.</p>
        <h2 style={H2}>3. How We Use Data</h2>
        <p style={P}>To deliver AI-generated replies to customer messages on behalf of connected businesses. To display conversations and analytics in the client dashboard. To store orders and bookings created during customer conversations. We do not sell personal data. We do not use customer messages or calendar data for advertising.</p>
        <h2 style={H2}>4. Data Storage and Security</h2>
        <p style={P}>All data is stored in Supabase (PostgreSQL) on AWS ap-southeast-2. Row-Level Security (RLS) policies ensure each client's data is fully isolated. Access tokens and OAuth credentials are stored server-side only and never exposed to browsers or other clients. HTTPS is enforced for all connections.</p>
        <h2 style={H2}>5. Data Sharing</h2>
        <p style={P}>Customer messages are processed by Google Gemini API to generate AI replies. Meta Graph API (Facebook, Instagram, WhatsApp) is used to send and receive messages. Google Calendar API is used to create events and check availability. Supabase is used for database and file storage. No other third parties receive personal data.</p>
        <h2 style={H2}>6. Data Retention and Deletion</h2>
        <p style={P}>Clients can delete conversations and files from the dashboard at any time. Disconnecting a channel immediately stops all data processing for that channel. To request full deletion of your account and all associated data, email nahidafzal97@gmail.com. All requests are honored within 30 days.</p>
        <h2 style={H2}>7. Facebook and Instagram Data Deletion</h2>
        <p style={P}>If you remove our app from Facebook or Instagram settings, we receive an automated deletion callback and delete all associated data automatically within 24 hours.</p>
        <h2 style={H2}>8. Children's Privacy</h2>
        <p style={P}>Our platform is intended for business use only and is not directed at children under 13. We do not knowingly collect personal data from children.</p>
        <h2 style={H2}>9. Changes to This Policy</h2>
        <p style={P}>We may update this Privacy Policy from time to time. The date at the top reflects the most recent revision. Continued use after changes constitutes acceptance.</p>
        <h2 style={H2}>10. Contact</h2>
        <p style={P}><strong>Autologic</strong> · Savar, Dhaka, Bangladesh<br/>Email: <a href="mailto:nahidafzal97@gmail.com" style={{ color: "#f0c040" }}>nahidafzal97@gmail.com</a></p>
        <div style={{ marginTop: 48, padding: "16px 20px", background: "rgba(240,192,64,0.06)", borderRadius: 8, border: "1px solid rgba(240,192,64,0.15)", fontSize: 13, color: "#8b9cbd" }}>
          Autologic's use of information received from Google APIs will adhere to the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer" style={{ color: "#f0c040" }}>Google API Services User Data Policy</a>, including the Limited Use requirements.
        </div>
      </div>
    </div>
  );
}
