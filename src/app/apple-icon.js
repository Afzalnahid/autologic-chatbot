import { ImageResponse } from "next/og";

// iOS home-screen / Safari touch icon. iOS ignores SVG favicons, so it needs a
// PNG. Vercel renders this to a 180x180 PNG at build time (Satori) — no binary
// tooling required. Brand mark: a white bolt on the crimson gradient, matching
// icon.svg and the in-app logo tile.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// White bolt (same path as icon.svg), embedded so Satori can draw it as an image.
const BOLT =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2ZmZmZmZiI+PHBhdGggZD0iTTEzIDNsMCA3bDYgMGwtOCAxMWwwIC03bC02IDBsOCAtMTF6Ii8+PC9zdmc+";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #D92632, #B01824)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img width="112" height="112" src={BOLT} alt="" />
      </div>
    ),
    size
  );
}
