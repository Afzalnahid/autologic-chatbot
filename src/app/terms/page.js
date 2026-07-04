export const metadata = { title: "Terms of Service - Chatbot Platform" };

export default function Terms() {
  const S = { maxWidth: 720, margin: "0 auto", padding: "40px 20px", color: "#e8e8ec", fontFamily: "sans-serif", lineHeight: 1.7, fontSize: 14 };
  const H = { fontSize: 18, marginTop: 28 };
  return (
    <div style={{ background: "#05080f", minHeight: "100vh" }}>
      <div style={S}>
        <h1 style={{ fontSize: 24 }}>Terms of Service</h1>
        <p>Last updated: July 4, 2026</p>
        <h2 style={H}>1. Service</h2>
        <p>AutoLogic Systems provides an AI customer service chatbot platform that businesses connect to their own Facebook Pages, Instagram or WhatsApp accounts to reply to their customers automatically.</p>
        <h2 style={H}>2. Accounts</h2>
        <p>You must provide accurate information at signup and keep your credentials secure. You are responsible for activity under your account.</p>
        <h2 style={H}>3. Acceptable Use</h2>
        <p>You may only connect Pages and accounts you own or manage. Spam, harassment, illegal content and violation of Meta Platform Terms are prohibited and lead to termination.</p>
        <h2 style={H}>4. Trials and Billing</h2>
        <p>Free trials last 3 days with a limit of 30 messages per day. Paid plans are billed as agreed at purchase. We may change plan features with notice.</p>
        <h2 style={H}>5. Data</h2>
        <p>Data handling is described in our Privacy Policy at /privacy. You retain ownership of your business data. We may delete data of terminated accounts after 30 days.</p>
        <h2 style={H}>6. Availability and Liability</h2>
        <p>The service is provided as is without warranties. Our liability is limited to fees paid in the last 3 months.</p>
        <h2 style={H}>7. Contact</h2>
        <p>AutoLogic Systems, Savar, Dhaka, Bangladesh. Email: nahidafzal97@gmail.com</p>
      </div>
    </div>
  );
}
