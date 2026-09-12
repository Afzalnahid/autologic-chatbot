import { ImageResponse } from "next/og";

// iOS home-screen / Safari touch icon. iOS ignores SVG favicons, so it needs a
// PNG. Vercel renders this to a 180x180 PNG at build time (Satori) — no binary
// tooling required. Brand mark: the Friendly Bot, white on the crimson gradient, matching
// icon.svg and the in-app logo tile.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// White bot (same mark as icon.svg), embedded so Satori can draw it as an image.
const BOT =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIj48ZyBmaWxsPSIjZmZmIj48cmVjdCB4PSIyNDAiIHk9IjcwIiB3aWR0aD0iMzIiIGhlaWdodD0iNDYiIHJ4PSIxNiIvPjxjaXJjbGUgY3g9IjI1NiIgY3k9IjY2IiByPSIyMiIvPjxwYXRoIGQ9Ik0xNzYgMTE4aDE2MGE3NiA3NiAwIDAgMSA3NiA3NnYxMTJhNzYgNzYgMCAwIDEtNzYgNzZIMjIybC01OCA1OGMtOSA5LTI0IDMtMjQtMTB2LTUwYTc2IDc2IDAgMCAxLTQwLTY2VjE5NGE3NiA3NiAwIDAgMSA3Ni03NnoiLz48L2c+PGcgZmlsbD0iI0IwMTgyNCI+PHJlY3QgeD0iMTg2IiB5PSIxOTAiIHdpZHRoPSI0MiIgaGVpZ2h0PSI2NiIgcng9IjIxIi8+PHJlY3QgeD0iMjg0IiB5PSIxOTAiIHdpZHRoPSI0MiIgaGVpZ2h0PSI2NiIgcng9IjIxIi8+PC9nPjxwYXRoIGQ9Ik0yMDQgMzAwcTUyIDQ2IDEwNCAwIiBzdHJva2U9IiNCMDE4MjQiIHN0cm9rZS13aWR0aD0iMjAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgZmlsbD0ibm9uZSIvPjwvc3ZnPg==";

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
        <img width="118" height="118" src={BOT} alt="" />
      </div>
    ),
    size
  );
}
