import "./globals.css";
import { THEME_BOOT_JS } from "@/lib/landing.js";
import { SITE } from "@/lib/seo.js";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  // The browser's own bar (mobile Chrome, an installed web app) takes the page's
  // background in the device's mode, so it reads as one surface with the page —
  // the same thing the Android app does natively (mobile/scripts/patch-manifest.mjs).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FCFCFD" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0B0E" },
  ],
};

export const metadata = {
  // The title here is the dashboard's — it is the one page that does not set
  // its own. Every public page overrides both of these through pageMeta().
  title: "TellMore AI Chatbot Dashboard",
  description: "AI-powered chatbot management dashboard",
  // Without this Next cannot turn a relative share-image path into the absolute
  // URL that Facebook and WhatsApp require, and it warns on every build.
  metadataBase: new URL(SITE),
  // Makes iOS open the home-screen icon full-screen, like a native app, instead
  // of inside Safari's chrome (Android reads this from the manifest instead).
  appleWebApp: { capable: true, title: "TellMore AI", statusBarStyle: "default" },
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
        {/* Icons. The public pages get a subset built from the same font —
            about fifty icons, 10 KB, from our own domain — because the CDN build
            is 803 KB of glyphs a visitor never sees and it cost every first
            view a second connection and most of its page weight (Lighthouse,
            2026-09-18). The dashboard, admin, /shots and /preview-dash pull the
            full font in their own layout. Rebuild the subset with
            scripts/make-icon-font.mjs after adding an icon to a public page. */}
        <link rel="stylesheet" href="/fonts/tabler-subset.css" />
        {/* The marketing pages' faces come from Google Fonts through an @import
            inside the page CSS, which the browser can only find after that CSS
            has arrived. Opening the connections early saves a round trip. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
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
