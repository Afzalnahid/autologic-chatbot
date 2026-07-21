export const metadata = { title: "How Autologic uses Google Calendar" };

export default function GoogleCalendar() {
  const S = { maxWidth: 760, margin: "0 auto", padding: "48px 24px", color: "#e8e8ec", fontFamily: "sans-serif", lineHeight: 1.8, fontSize: 15 };
  const H2 = { fontSize: 18, fontWeight: 600, marginTop: 36, marginBottom: 8, color: "#f0c040" };
  const P = { marginBottom: 12 };
  return (
    <div style={{ background: "#05080f", minHeight: "100vh" }}>
      <div style={S}>
        <a href="/" style={{ color: "#8b9cbd", fontSize: 13.5, textDecoration: "none" }}>← Back to home</a>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginTop: 18, marginBottom: 4 }}>How Autologic uses Google Calendar</h1>
        <p style={{ color: "#8b9cbd", marginBottom: 32 }}>Google Calendar integration & Limited Use disclosure</p>

        <p style={P}>Autologic is an AI-powered customer service platform for businesses. For service businesses and agencies, Autologic offers an optional Google Calendar integration that automates meeting scheduling with their customers.</p>

        <h2 style={H2}>What we access</h2>
        <p style={P}>When a business owner chooses to connect their Google Calendar, Autologic requests permission to view their calendar availability and to create calendar events on their behalf. This connection is entirely optional and is only initiated by the business owner from their dashboard.</p>

        <h2 style={H2}>How we use it</h2>
        <p style={P}>Autologic uses this access solely to automate meeting scheduling for the business owner's customers. Specifically, Autologic will:</p>
        <ul style={{ paddingLeft: 22, marginBottom: 12 }}>
          <li style={{ marginBottom: 6 }}>Check the business owner's calendar availability (free/busy) when a customer requests a meeting.</li>
          <li style={{ marginBottom: 6 }}>Create a calendar event with a Google Meet link on the owner's behalf when a booking is confirmed.</li>
          <li style={{ marginBottom: 6 }}>Send the Google Meet link to the customer through the connected messaging channel (Facebook, Instagram, or WhatsApp).</li>
        </ul>

        <h2 style={H2}>What we do not do</h2>
        <p style={P}>Autologic does not read, store, or share Google Calendar data for any purpose beyond the scheduling actions described above. We never use calendar data for advertising, profiling, or any secondary purpose, and we never sell it. Calendar tokens are stored securely on our servers and are never shared with third parties or with other businesses on the platform.</p>

        <h2 style={H2}>Your control</h2>
        <p style={P}>A business owner can disconnect Google Calendar at any time from their dashboard. Disconnecting immediately revokes Autologic's access and deletes all stored Google OAuth tokens for that account.</p>

        <h2 style={H2}>Limited Use compliance</h2>
        <p style={P}>Autologic's use of information received from Google APIs adheres to the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer" style={{ color: "#f0c040" }}>Google API Services User Data Policy</a>, including the Limited Use requirements.</p>

        <div style={{ marginTop: 40, display: "flex", gap: 20, fontSize: 13.5 }}>
          <a href="/privacy" style={{ color: "#8b9cbd", textDecoration: "none" }}>Privacy Policy</a>
          <a href="/terms" style={{ color: "#8b9cbd", textDecoration: "none" }}>Terms of Service</a>
          <a href="/contact" style={{ color: "#8b9cbd", textDecoration: "none" }}>Contact</a>
        </div>
      </div>
    </div>
  );
}
