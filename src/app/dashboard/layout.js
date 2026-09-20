import AppChrome from "../app-chrome.js";

// See src/app/app-chrome.js: the signed-in app's typefaces and the full icon
// font are loaded here rather than in the root layout, so the public pages stay
// light.
// The page's background BEFORE the dashboard's script has loaded. The root
// stylesheet paints body in an old dark navy (#0A0D14) whatever the mode, and
// the dashboard is client-only, so on a phone the opening went: light splash →
// a navy page while the script downloaded → light launch screen. These are the
// two page backgrounds of PALETTE in components/ui.js, keyed on the data-theme
// the root layout's boot script sets before first paint; <Theme/> takes over
// with the same colours once the app is running.
const FIRST_PAINT_CSS = `html,body{background:#FCFCFD}html[data-theme="dark"],html[data-theme="dark"] body{background:#0B0B0E}`;

export default function DashboardLayout({ children }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: FIRST_PAINT_CSS }} />
      <AppChrome />
      {children}
    </>
  );
}
