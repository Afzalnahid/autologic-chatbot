// The faces the public pages are set in.
//
// They used to be pulled by an @import at the top of each page's inline CSS.
// A browser cannot see an @import until the stylesheet holding it has arrived
// and been parsed, so the fonts were always one round trip late — which is what
// made text re-flow after paint (0.15 layout shift on a solution page,
// Lighthouse 2026-09-18). As a <link> in the head they start downloading with
// the page itself.
export default function PublicFonts() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600;700;800&family=Anek+Bangla:wght@400;600;700&display=swap" />
    </>
  );
}
