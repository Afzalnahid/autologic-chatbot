import "./globals.css";
import { THEME_BOOT_JS } from "@/lib/landing.js";
import { SITE } from "@/lib/seo.js";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export const metadata = {
  // The title here is the dashboard's — it is the one page that does not set
  // its own. Every public page overrides both of these through pageMeta().
  title: "getvoicium Chatbot Dashboard",
  description: "AI-powered chatbot management dashboard",
  // Without this Next cannot turn a relative share-image path into the absolute
  // URL that Facebook and WhatsApp require, and it warns on every build.
  metadataBase: new URL(SITE),
  // Makes iOS open the home-screen icon full-screen, like a native app, instead
  // of inside Safari's chrome (Android reads this from the manifest instead).
  appleWebApp: { capable: true, title: "getvoicium", statusBarStyle: "default" },
};

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: the theme boot script sets data-theme on <html>
    // before React hydrates, on purpose, so the page never flashes the wrong
    // palette. React would otherwise flag that attribute as a mismatch.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Three <meta http-equiv> cache tags used to sit here — Cache-Control,
            Pragma and Expires, all saying "never store this". They were on
            EVERY page, the public marketing pages included.

            They did not do the job they looked like they were doing. Only the
            server can set a real caching rule; a meta tag cannot, and Pragma
            and Expires have been obsolete for years. What they could still do
            is stop a browser keeping the page it had just downloaded, so a
            reader moving between pages re-fetched the same markup every time.

            The real headers come from Next and from next.config.js, which is
            where a change of mind about caching belongs. */}
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.6.0/dist/tabler-icons.min.css" />
        {/* Runs while the HTML is still parsing, before first paint, so the page
            never flashes the wrong palette. Bare <script> in the root layout's
            <head> is the one place an inline script is guaranteed to execute in
            the App Router (inside a page's tree it is inserted by React and
            never run). It only sets data-theme; the toggle button is wired by
            delegation on document, so hydration replacing the button is fine. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_JS }} />
        {/* Register the service worker for every visitor, not only those who
            turn on push. Its presence (with the fetch handler in sw.js) is what
            makes the whole site an installable app and lets the phone show
            "Add to Home Screen". Registering the same URL twice is a no-op, so
            the push toggle re-registering later is harmless. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "if('serviceWorker' in navigator){addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}",
          }}
        />
      </head>
      <body><main>{children}</main></body>
    </html>
  );
}
