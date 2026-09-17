// The full Tabler icon font, for this part of the site only.
//
// The public pages ship a 10 KB subset of the same font (public/fonts,
// scripts/make-icon-font.mjs) because a first-time visitor should not download
// 800 KB of icons they will never see. The app behind the login uses hundreds
// of them, and the people here load it once and keep it cached — so it stays on
// the CDN build, added by this layout instead of the root one.
export default function IconFontLayout({ children }) {
  return (
    <>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.6.0/dist/tabler-icons.min.css" />
      {children}
    </>
  );
}
