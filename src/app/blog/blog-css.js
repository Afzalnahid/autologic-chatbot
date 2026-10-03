// The blog's own reading styles, on top of SiteShell's .doc: section headings,
// quotes, code, the list of posts. Only the public palette (--lp-*).
export const BLOG_CSS = `
  .post h2 { font-family: Geist, 'Inter Fallback', system-ui, sans-serif; font-weight: 800; letter-spacing: -0.02em;
    font-size: clamp(21px, 3vw, 26px); line-height: 1.25; margin: 34px 0 12px; color: var(--lp-ink); scroll-margin-top: 80px }
  .post h3 { font-weight: 700; font-size: 18.5px; line-height: 1.35; margin: 24px 0 10px; color: var(--lp-ink); scroll-margin-top: 80px }
  .post h4 { font-weight: 700; font-size: 16px; margin: 18px 0 8px; color: var(--lp-ink) }
  .post blockquote { margin: 18px 0; padding: 12px 18px; border-left: 3px solid var(--lp-acc); background: var(--lp-accSoft);
    border-radius: 0 12px 12px 0; font-size: 16px; line-height: 1.7; color: var(--lp-ink) }
  .post code { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: .9em; background: var(--lp-accSoft);
    padding: 1px 6px; border-radius: 6px }
  .post hr { border: 0; border-top: 1px solid var(--lp-line); margin: 28px 0 }
  .bmeta { display: flex; gap: 8px 14px; flex-wrap: wrap; font-size: 13px; color: var(--lp-soft); margin: 4px 0 22px }
  .bcard { display: block; text-decoration: none; color: var(--lp-ink); background: var(--lp-card); border: 1px solid var(--lp-line);
    border-radius: 16px; padding: 18px 20px; margin-bottom: 12px; box-shadow: var(--lp-nm-sm); transition: border-color .15s ease-out }
  .bcard:hover { border-color: color-mix(in srgb, var(--lp-acc) 45%, transparent) }
  .bcard h2 { font-weight: 800; font-size: 19px; line-height: 1.3; margin: 0 0 6px; letter-spacing: -0.01em }
  .bcard p { font-size: 14.5px; line-height: 1.6; color: var(--lp-soft); margin: 0 }
  .btabs { display: inline-flex; gap: 4px; padding: 4px; border: 1px solid var(--lp-line); border-radius: 11px; background: var(--lp-card); margin: 18px 0 20px }
  .btabs a { padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none; color: var(--lp-soft) }
  .btabs a.on { background: var(--lp-fill); color: #fff }
  .bcta { margin-top: 36px; padding: 20px 22px; border-radius: 16px; background: var(--lp-accSoft);
    border: 1px solid color-mix(in srgb, var(--lp-acc) 22%, transparent) }
  .bcta a.btn { display: inline-block; margin-top: 10px; padding: 10px 18px; border-radius: 10px; background: var(--lp-fill);
    color: #fff; font-weight: 700; font-size: 14px; text-decoration: none; border: 0 }
`;
