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
  title: "Autologic Chatbot Dashboard",
  description: "AI-powered chatbot management dashboard",
  // Without this Next cannot turn a relative share-image path into the absolute
  // URL that Facebook and WhatsApp require, and it warns on every build.
  metadataBase: new URL(SITE),
};

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: the theme boot script sets data-theme on <html>
    // before React hydrates, on purpose, so the page never flashes the wrong
    // palette. React would otherwise flag that attribute as a mismatch.
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.6.0/dist/tabler-icons.min.css" />
        {/* Runs while the HTML is still parsing, before first paint, so the page
            never flashes the wrong palette. Bare <script> in the root layout's
            <head> is the one place an inline script is guaranteed to execute in
            the App Router (inside a page's tree it is inserted by React and
            never run). It only sets data-theme; the toggle button is wired by
            delegation on document, so hydration replacing the button is fine. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_JS }} />
      </head>
      <body><main>{children}</main></body>
    </html>
  );
}
