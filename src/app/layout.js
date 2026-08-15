import "./globals.css";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export const metadata = {
  title: "Autologic Chatbot Dashboard",
  description: "AI-powered chatbot management dashboard",
};

export default function RootLayout({ children }) {
  // suppressHydrationWarning: the public pages' theme boot script sets
  // data-theme on <html> before React hydrates, on purpose.
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.6.0/dist/tabler-icons.min.css" />
      </head>
      <body><main>{children}</main></body>
    </html>
  );
}
