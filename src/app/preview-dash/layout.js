import AppChrome from "../app-chrome.js";

// See src/app/app-chrome.js: the signed-in app's typefaces and the full icon
// font are loaded here rather than in the root layout, so the public pages stay
// light.
export default function PreviewDashLayout({ children }) {
  return (
    <>
      <AppChrome />
      {children}
    </>
  );
}
