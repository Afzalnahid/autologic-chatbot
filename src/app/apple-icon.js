import { ImageResponse } from "next/og";
import { markInner, MARK_VIEWBOX } from "@/lib/brand-mark.js";

// iOS home-screen / Safari touch icon. iOS ignores SVG favicons, so it needs a
// PNG. Vercel renders this to a 180x180 PNG at build time (Satori) — no binary
// tooling required. Brand mark: the TellMore AI logo (plum robot-bubble) on
// white, matching icon.svg and the in-app logo tiles. iOS rounds the corners
// itself, so the square is full-bleed.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// The mark from brand-mark.js, embedded so Satori can draw it as an image.
const MARK =
  "data:image/svg+xml;base64," +
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}">${markInner()}</svg>`).toString("base64");

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
          background: "#ffffff",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img width="140" height="140" src={MARK} alt="" />
      </div>
    ),
    size
  );
}
