import { pageMeta } from "@/lib/seo.js";
import SiteShell, { Section, Note } from "../site-shell.js";

export const metadata = pageMeta({
  title: "How getvoicium uses Google Calendar",
  description: "What getvoicium reads and writes in a connected Google Calendar when the chatbot books a meeting, and the Limited Use disclosure that covers it.",
  path: "/google-calendar",
});

// Google reads this page as part of its OAuth verification, so the wording is
// carried over exactly; only the frame around it changed.
export default function GoogleCalendar() {
  return (
    <SiteShell
      eyebrow="Google Calendar integration"
      title="How getvoicium uses Google Calendar"
      lead="getvoicium is an AI-powered customer service platform for businesses. For service businesses and agencies, getvoicium offers an optional Google Calendar integration that automates meeting scheduling with their customers."
    >
      <Section title="What we access">
        <p>When a business owner chooses to connect their Google Calendar, getvoicium requests permission to view their calendar availability and to create calendar events on their behalf. This connection is entirely optional and is only initiated by the business owner from their dashboard.</p>
      </Section>

      <Section title="How we use it">
        <p>getvoicium uses this access solely to automate meeting scheduling for the business owner's customers. Specifically, getvoicium will:</p>
        <ul>
          <li>Check the business owner's calendar availability (free/busy) when a customer requests a meeting.</li>
          <li>Create a calendar event with a Google Meet link on the owner's behalf when a booking is confirmed.</li>
          <li>Send the Google Meet link to the customer through the connected messaging channel (Facebook, Instagram, or WhatsApp).</li>
        </ul>
      </Section>

      <Section title="What we do not do">
        <p>getvoicium does not read, store, or share Google Calendar data for any purpose beyond the scheduling actions described above. We never use calendar data for advertising, profiling, or any secondary purpose, and we never sell it. Calendar tokens are stored securely on our servers and are never shared with third parties or with other businesses on the platform.</p>
      </Section>

      <Section title="How a business connects it">
        <p>The whole connection happens through Google's own sign-in screen. There is nothing to install, and no keys or IDs to copy.</p>
        <ol>
          <li>Open the Bookings tab in the getvoicium dashboard and press <strong>Connect now</strong>.</li>
          <li>Sign in with the Google account that holds the calendar you take meetings in.</li>
          <li>If Google shows a notice that the app is not yet verified, choose <strong>Advanced</strong> and then <strong>Go to getvoicium</strong>. Our Google review is in progress; the notice is not a sign of a problem with your account.</li>
          <li>Press <strong>Continue</strong> to grant the two permissions described above.</li>
          <li>The window closes on its own and the bot begins offering your real free times.</li>
        </ol>
        <p>To disconnect at any time, press <strong>Disconnect</strong> at the top of the Bookings tab (or remove getvoicium from <strong>myaccount.google.com → Security → Third-party access</strong>). Existing bookings stay in your dashboard; only the automatic Meet links stop.</p>
      </Section>

      <Section title="Your control">
        <p>A business owner can disconnect Google Calendar at any time from their dashboard. Disconnecting immediately revokes getvoicium's access and deletes all stored Google OAuth tokens for that account.</p>
      </Section>

      <Note>
        getvoicium's use of information received from Google APIs adheres to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer"
          style={{ color: "var(--lp-acc)" }}>Google API Services User Data Policy</a>, including the Limited Use requirements.
      </Note>
    </SiteShell>
  );
}
