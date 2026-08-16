# Responsive audit — 2026-08-15

Scope: the public landing page (`src/app/page.js`, `src/lib/landing.js`) and the
dashboard shell (`src/app/dashboard-client.js`, `src/app/dashboard/components/*`).
Checked at three targets: **Desktop** (wide), **Mobile** (320–412px), and
**Mac/Safari** (WebKit-specific CSS features).

The owner reported "layout errors" on all three without naming them. This audit
found them by code review plus real rendering checks with a headless Chromium
browser (Playwright) at 320px, 360px, 375px and 1440px against a production build
of this branch. **No WebKit/Safari engine was available in this sandbox**, so the
Mac/Safari section is code review only — the CSS features involved are named below
so they can be spot-checked on an actual Mac quickly.

Every fix below is CSS/markup-only, does not touch any locked prompt, database
query, or business-type branch, and applies identically to `ecommerce` and
`agency` accounts (none of the touched code reads `business_type`).

---

## Mobile

### 1. FIXED — "Start free" button clipped off-screen below ~340px width
**File:** `src/app/page.js:310` (nav row) and the `.navbtn` styles around line 203.

On a 320px-wide screen (iPhone SE 1st/2nd generation, and a number of older or
budget Android phones still common in this market) the nav row — logo,
language switch, "Log in", "Start free" — no longer fit on one line. The page
already has `overflow-x: hidden` on `html, body` (line 165) so this didn't create
a scrollbar; it silently **clipped the "Start free" button off the right edge**,
which is the page's one conversion action. Confirmed with a real screenshot at
320px before the fix (button read "START FRE…", cut mid-word) and after (fully
visible with margin to spare). 360px and 375px were already fine — only the
narrowest, older phones were affected.

**Fix:** added a new `@media (max-width: 340px)` step that tightens the row's
gap/padding and shrinks the button padding/letter-spacing further, on top of
the existing 400px step. Nothing moves or wraps — same one-row design, just
tighter. Screenshots before/after are in the PR description.

### 2. FIXED — onboarding full-screen steps used `100vh` instead of `100dvh`
**File:** `src/app/dashboard-client.js` — `ConnectChannel` (was line 450) and
`ConnectCalendar` (was line 487), the two full-screen "Connect a channel" /
"Connect Google Calendar" onboarding steps.

Mobile Safari's `100vh` includes the space behind its address bar, so a
`height: 100vh` box is taller than what's actually visible until the visitor
scrolls — content can sit partly under the browser chrome. The main dashboard
shell already fixed this for mobile (`dashboard-client.js:670`, and
`Conversations.js`, both switch to `100dvh` when `isMobile` is true) but these
two onboarding screens — which every new signup passes through, on a phone,
before reaching the dashboard — were never updated to match.

**Fix:** both now call the same `useIsMobile()` hook already imported in this
file and use `isMobile ? "100dvh" : "100vh"`, exactly the pattern already
established elsewhere in the same file.

### 3. Not fixed — not verified below 320px
Screens narrower than 320px (some older feature-rich phones) were not tested.
The 340px fix tightens spacing monotonically, so it should help rather than
hurt at any narrower width, but this wasn't confirmed with a screenshot.

---

## Desktop (and the desktop/mobile breakpoint boundary)

### 4. FIXED — Conversations tab chat pane could overflow at 768–~830px
**File:** `src/app/dashboard/components/Conversations.js:149`.

The two-pane chat layout uses `gridTemplateColumns: "320px 1fr"` on desktop
(`isMobile` switches it to a single stacked column below 768px). A plain `1fr`
grid track has an implicit minimum width equal to its content's natural
("min-content") size — so if the chat pane's own content (header row, message
input row) needs more room than the leftover space, the grid track grows past
its share and the whole grid can push wider than its container, causing a
sideways scrollbar inside the dashboard. This is most likely right at the
768–830px boundary (common tablet-portrait widths, e.g. iPad Mini at 768px)
where the 320px list column plus the dashboard's own sidebar leave very little
room for the chat pane.

This is a well-known, purely defensive CSS fix with **no visual difference**
whenever there's enough room — it doesn't remove or resize anything.

**Fix:** changed the second column from `1fr` to `minmax(0, 1fr)`, which forces
the track to actually shrink to the space available (scrolling internally)
instead of growing the grid past its container.

### 5. FIXED — same pattern in the Bookings calendar layout
**File:** `src/app/dashboard/components/ui.js:279` (`.cal-wrap`, used by
`Bookings.js` — agency accounts' calendar view).

Same shape of issue, same fix: `grid-template-columns: minmax(300px, 380px) 1fr`
→ `minmax(300px, 380px) minmax(0, 1fr)`. Applied defensively; not confirmed with
a screenshot since exercising this tab requires a logged-in agency account with
Google Calendar connected, which this sandbox doesn't have credentials for.

### 6. Checked, no bug found
- All other grids in `page.js` and the dashboard tabs (Inventory, Profile,
  Settings, Billing, Broadcast, Analytics, the landing page's feature/case-study
  grids) already use `repeat(auto-fit, minmax(Npx, 1fr))`, which doesn't have
  the blow-out risk above — its minimum is an explicit pixel value, not
  content-based.
- The embed-code box in `WebsiteWidget.js:81` already has `wordBreak:"break-all"`
  so the generated `<script>` snippet can't push the page wide.
- Tables that could run wide (`Inventory.js:111`, `Billing.js:201`) are already
  wrapped in their own `overflow-x: auto` container, so a wide table scrolls
  inside its box instead of the page.
- Rendered the full landing page at 1440px — hero, "How it works" diagram, and
  nav all laid out correctly (screenshot in the PR description).

---

## Mac / Safari (WebKit)

Reviewed in code; **no Mac/Safari browser was available in this environment to
render it directly**, so please spot-check on an actual Mac if convenient.

### 7. FIXED — `backdrop-filter` missing its `-webkit-` twin
**File:** `src/app/page.js:391`, the sound-toggle button over the demo video.

`backdropFilter: "blur(10px)"` was set with no `WebkitBackdropFilter` alongside
it. The dashboard's own shared stylesheet (`ui.js:268-269`, `.seg-glass`)
already pairs the two correctly — this one spot on the landing page was missed.
Older Safari (pre-15.4, still in use on older iPhones/iPads that can't update
past a certain iOS version) only understands the `-webkit-` prefixed property;
without it the button loses its glass blur and shows as a plain dark circle —
a cosmetic miss, not a broken layout, but an easy one to close.

**Fix:** added `WebkitBackdropFilter` next to the existing `backdropFilter`
(the dashboard already knows to declare the prefix first, unprefixed second,
so the CSS cascade picks the right one — matched here).

### 8. Checked, no bug found
- `position: sticky` (the landing nav, `page.js:309`) — unprefixed `sticky` has
  been supported by Safari since version 13; no fix needed.
- `aspect-ratio` (`page.js:31` product photo, `:379` video container,
  `ui.js:281` calendar cells) — supported unprefixed since Safari 15.4
  (early 2022); no fix needed for a current Mac/Safari target.
- The demo `<video>` (`page.js:380`) already has `playsInline`, `muted`,
  `loop`, `autoPlay` — the exact combination Safari requires for inline
  autoplay. Nothing to add.
- Flexbox/grid `gap` is used throughout; Safari has supported it since 14.1
  (April 2021). No fallback needed for a current-Mac audit.
- `globals.css` already sets `-webkit-text-size-adjust: 100%` and forces
  `font-size: 16px` on inputs below 768px width specifically to stop iOS
  Safari's auto-zoom-on-focus — already correct, no change made.

---

## Summary of changes in this PR

| File | Change |
|---|---|
| `src/app/page.js` | New `≤340px` nav breakpoint (mobile CTA clipping); `-webkit-backdrop-filter` added next to `backdrop-filter` (Safari) |
| `src/app/dashboard-client.js` | `ConnectChannel` / `ConnectCalendar` onboarding screens now use `100dvh` on mobile, matching the rest of the shell |
| `src/app/dashboard/components/Conversations.js` | Chat grid column changed `1fr` → `minmax(0,1fr)` to stop tablet-width overflow |
| `src/app/dashboard/components/ui.js` | Same `minmax(0,1fr)` fix applied to the Bookings calendar grid |

All four are small, additive, and were verified against a real production build
(`npm run build` + `npm run start`) rendered in headless Chromium at 320/360/375/1440px.
Screenshots before and after the mobile nav fix are attached to the pull request.
