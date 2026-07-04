export const metadata = { title: "Privacy Policy - Chatbot Platform" };

export default function Privacy() {
  const S = { maxWidth: 720, margin: "0 auto", padding: "40px 20px", color: "#e8e8ec", fontFamily: "sans-serif", lineHeight: 1.7, fontSize: 14 };
  const H = { fontSize: 18, marginTop: 28 };
  return (
    <div style={{ background: "#05080f", minHeight: "100vh" }}>
      <div style={S}>
        <h1 style={{ fontSize: 24 }}>Privacy Policy</h1>
        <p>Last updated: July 4, 2026</p>
        <p>AutoLogic Systems ("we") operates the Chatbot Platform at autologic-chatbot.vercel.app. This policy explains how we handle data when businesses connect their Facebook Pages, Instagram or WhatsApp accounts to our AI customer service platform.</p>
        <h2 style={H}>Data We Collect</h2>
        <p>Account email and business name at signup. Facebook Page ID, Page name and Page access token when a Page is connected. Customer messages, sender IDs and public profile names received through connected channels, used only to generate replies and show conversations to the business owner. Product and order data entered by the business.</p>
        <h2 style={H}>How We Use Data</h2>
        <p>To deliver automated AI replies on behalf of the connected business, display live conversations in the business dashboard, and store orders created by customers. We do not sell personal data. We do not use customer messages for advertising.</p>
        <h2 style={H}>Data Storage</h2>
        <p>Data is stored in Supabase (PostgreSQL) with row level isolation per business. Access tokens are stored server side and never exposed to other clients.</p>
        <h2 style={H}>Data Sharing</h2>
        <p>Messages are processed by Google Gemini to generate replies. Facebook Graph API is used to send and receive messages. No other third parties receive personal data.</p>
        <h2 style={H}>Data Retention and Deletion</h2>
        <p>Businesses can delete conversations from the dashboard at any time. Disconnecting a channel stops all processing. To request full deletion of your data, email nahidafzal97@gmail.com or use the data deletion process described below. Requests are honored within 30 days.</p>
        <h2 style={H}>Facebook Data Deletion</h2>
        <p>If you remove our app from your Facebook settings, Facebook notifies us and we delete data associated with your account automatically. You may also email us for manual deletion.</p>
        <h2 style={H}>Contact</h2>
        <p>AutoLogic Systems, Savar, Dhaka, Bangladesh. Email: nahidafzal97@gmail.com</p>
      </div>
    </div>
  );
}
