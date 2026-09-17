// What the signed-in app loads on top of the public site's own assets: the
// product's typefaces and the FULL icon font.
//
// Neither belongs in the root layout. A first-time visitor to a marketing page
// would otherwise open two connections to fetch 803 KB of icons and three
// typefaces that page never uses — measured on 2026-09-18, it was most of the
// page's weight. The public pages ship a 10 KB icon subset instead
// (scripts/make-icon-font.mjs) and import their own faces in their own CSS.

export default function AppChrome() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&family=Hind+Siliguri:wght@400;500;600&display=swap"
      />
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.6.0/dist/tabler-icons.min.css" />
    </>
  );
}
