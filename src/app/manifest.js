// Web App Manifest. Next serves this at /manifest.webmanifest and injects the
// <link rel="manifest"> automatically, so TellMore AI becomes an installable app:
//   - on a phone browser, "Add to Home Screen" gives it its own icon and opens
//     it full-screen (no address bar), and
//   - a store package (Play Store APK / App Store) is generated from this same
//     manifest by PWABuilder — no separate mobile codebase to maintain.
// Colours follow the brand invariant: crimson #D92632 on the soft-white ground.
export default function manifest() {
  return {
    name: "TellMore AI",
    short_name: "TellMore AI",
    description: "Conversations that convert — the AI assistant that answers your customers on Messenger, Instagram, WhatsApp and your website.",
    // Owners live in the dashboard; open straight there. Not logged in? It sends
    // them to sign in first, then back, exactly like the website does.
    start_url: "/dashboard",
    id: "/dashboard",
    display: "standalone",
    background_color: "#EEF0F5",
    theme_color: "#D92632",
    lang: "en",
    dir: "ltr",
    categories: ["business", "productivity", "shopping"],
    icons: [
      // A scalable mark for browsers that take SVG.
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      // The 512 raster, used both as the plain icon and as the maskable one the
      // launcher crops to its own shape. PWABuilder makes every other size from
      // this when it packages the store apps.
      { src: "/logo.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/logo.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
