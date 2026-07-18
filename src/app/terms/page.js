export const metadata = { title: "Terms of Service - Autologic" };

export default function Terms() {
  const S = { maxWidth: 760, margin: "0 auto", padding: "48px 24px", color: "#e8e8ec", fontFamily: "sans-serif", lineHeight: 1.8, fontSize: 15 };
  const H2 = { fontSize: 18, fontWeight: 600, marginTop: 36, marginBottom: 8, color: "#f0c040" };
  const P = { marginBottom: 12 };
  return (
    <div style={{ background: "#05080f", minHeight: "100vh" }}>
      <div style={S}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Terms of Service</h1>
        <p style={{ color: "#8b9cbd", marginBottom: 32 }}>Last updated: July 18, 2026</p>
        <p style={P}>These Terms of Service ("Terms") govern your use of Autologic ("we", "our", "us"), an AI-powered customer service chatbot platform operated at autologic-chatbot.vercel.app. By creating an account or using the platform, you agree to these Terms.</p>

        <h2 style={H2}>1. The Service</h2>
        <p style={P}>Autologic provides an AI-powered chatbot platform that businesses ("clients") connect to their messaging channels (Facebook, Instagram, WhatsApp) and optionally their Google Calendar to automate customer service, meeting scheduling, and order management.</p>

        <h2 style={H2}>2. Account Registration</h2>
        <p style={P}>You must provide accurate and complete information when creating an account. You are responsible for maintaining the security of your login credentials and for all activity that occurs under your account. You must notify us immediately of any unauthorized access at nahidafzal97@gmail.com.</p>

        <h2 style={H2}>3. Acceptable Use</h2>
        <p style={P}>You may only connect messaging channels and Google accounts that you own or are legally authorized to manage. You agree not to use the platform to send spam, harassing messages, illegal content, or content that violates Meta Platform Terms, WhatsApp Business Policy, or Google API Terms of Service. Violations may result in immediate account termination.</p>

        <h2 style={H2}>4. Google Calendar Integration</h2>
        <p style={P}>When you connect your Google Calendar, you authorize Autologic to check your calendar availability and create meeting events with Google Meet links on your behalf. This access is used solely to automate meeting scheduling for your customers. You may disconnect your Google Calendar at any time from your profile settings, which will immediately revoke our access and delete your stored tokens.</p>

        <h2 style={H2}>5. Trial and Paid Plans</h2>
        <p style={P}>Free trials are provided with message and feature limits as described at signup. Paid plans are billed as agreed at the time of purchase. We reserve the right to modify plan features or pricing with reasonable advance notice. No refunds are provided for partial billing periods unless required by applicable law.</p>

        <h2 style={H2}>6. Data and Privacy</h2>
        <p style={P}>Data handling is described in detail in our <a href="/privacy" style={{ color: "#f0c040" }}>Privacy Policy</a>. You retain ownership of your business data, including uploaded files, product catalogues, and customer conversations. We may permanently delete data associated with terminated or inactive accounts after 30 days notice.</p>

        <h2 style={H2}>7. Intellectual Property</h2>
        <p style={P}>Autologic and its underlying technology remain our intellectual property. You are granted a limited, non-exclusive, non-transferable license to use the platform for your business purposes. You may not copy, reverse-engineer, or resell any part of the platform without written permission.</p>

        <h2 style={H2}>8. Service Availability</h2>
        <p style={P}>We strive to maintain high availability but do not guarantee uninterrupted service. The platform is provided "as is" without warranties of any kind. We are not liable for any downtime caused by third-party services (Meta, Google, Supabase, Vercel) or circumstances beyond our control.</p>

        <h2 style={H2}>9. Limitation of Liability</h2>
        <p style={P}>To the maximum extent permitted by applicable law, our total liability to you for any claim arising from your use of the platform is limited to the fees you paid in the three months preceding the claim. We are not liable for indirect, incidental, or consequential damages.</p>

        <h2 style={H2}>10. Termination</h2>
        <p style={P}>You may terminate your account at any time by contacting us. We reserve the right to suspend or terminate accounts that violate these Terms, with or without notice depending on the severity of the violation.</p>

        <h2 style={H2}>11. Changes to Terms</h2>
        <p style={P}>We may update these Terms from time to time. The "Last updated" date reflects the most recent revision. Continued use of the platform after changes constitutes your acceptance of the updated Terms.</p>

        <h2 style={H2}>12. Governing Law</h2>
        <p style={P}>These Terms are governed by the laws of Bangladesh. Any disputes shall be resolved in the courts of Dhaka, Bangladesh.</p>

        <h2 style={H2}>13. Contact</h2>
        <p style={P}><strong>Autologic</strong> · Kandirpar, Cumilla, Bangladesh<br/>Email: <a href="mailto:nahidafzal97@gmail.com" style={{ color: "#f0c040" }}>nahidafzal97@gmail.com</a></p>
      </div>
    </div>
  );
}
