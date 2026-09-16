// The TellMore AI logo mark (owner's final logo, 2026-09-17): a friendly robot
// head whose face is a speech bubble — plum ring with a white visor split by a
// thin line, two smiling "^ ^" eyes, side ears, an antenna, and the bubble's
// tail at the bottom left.
//
// This file is the ONE source of the drawing for everything that renders it as
// a string: the favicon/app-icon tiles, the OAuth "connected" pages, and the
// React <BotMark> in brand.js. Plain strings, no JSX and no hooks, so server
// routes, client components and node scripts can all use it. Two node scripts
// keep their own copy because they run outside the Next build
// (scripts/make-og-images.mjs, mobile/scripts/gen-assets.mjs) — change those
// too when the drawing changes.
//
// The logo keeps its OWN colours (plum + near-black ink) — the owner decided
// the product UI stays crimson and only the logo changes. The face is a real
// hole in the ring, so whatever sits behind the mark shows through it.

export const PLUM = "#722B4D";
export const INK = "#1E1A1D";

// The drawing lives in a 1024 canvas; this crops it to the mark with a small
// margin, so a <svg> using it can be sized like any icon.
export const MARK_VIEWBOX = "267 259 490 490";

// Ring top half + bottom half (the gap between them is the visor line), ears,
// antenna, eyes. `color` paints the body; `ink` the eyes and the antenna.
export function markInner(color = PLUM, ink = INK) {
  return (
    `<path fill="${color}" d="M330 522V517A115 115 0 0 1 445 402H580A115 115 0 0 1 695 517V522H632.6A74 74 0 0 0 559 456H466A74 74 0 0 0 392.4 522Z"/>` +
    `<path fill="${color}" d="M330 538V545A115 115 0 0 0 375 636V674L446 660H580A115 115 0 0 0 695 545V538H632.6A74 74 0 0 1 559 604H466A74 74 0 0 1 392.4 538Z"/>` +
    `<path fill="${color}" d="M322 458A47 67 0 0 0 322 592Z"/>` +
    `<path fill="${color}" d="M703 458A47 67 0 0 1 703 592Z"/>` +
    `<rect x="510" y="362" width="4" height="42" fill="${ink}"/>` +
    `<circle cx="512" cy="350" r="14" fill="${ink}"/>` +
    `<path d="M424 514Q447 481 470 514M554 514Q577 481 600 514" stroke="${ink}" stroke-width="13" stroke-linecap="round" fill="none"/>`
  );
}

// A complete <svg> string. `tile` puts the mark on a white rounded square (the
// app-icon look); without it the mark sits on nothing.
export function markSvg({ size = 26, color = PLUM, ink = INK, tile = false, style = "" } = {}) {
  const st = style ? ` style="${style}"` : "";
  if (!tile) {
    return `<svg width="${size}" height="${size}" viewBox="${MARK_VIEWBOX}" xmlns="http://www.w3.org/2000/svg"${st} aria-hidden="true">${markInner(color, ink)}</svg>`;
  }
  return `<svg width="${size}" height="${size}" viewBox="192 184 640 640" xmlns="http://www.w3.org/2000/svg"${st} aria-hidden="true"><rect x="192" y="184" width="640" height="640" rx="144" fill="#fff"/>${markInner(color, ink)}</svg>`;
}
