# Search Console report, 24 Sep 2026 — what was true, and what was fixed

The owner supplied a Search Console review listing six issues. Each was checked
against the live site before anything was changed; two of the six turned out not
to be real. This is the result, in the report's own order.

## 1. Google chose a spam domain (`747live.bet`) as our canonical — REAL, fixed

Affected: `/docs/inbox`, `/docs/website-widget?lang=bn`.

A page that declares no canonical invites Google to pick one, and a scraper's
copy can win. Our English pages did declare one; the **Bangla ones did not, and
then declared the wrong one** (issue 2), which is the same hole. Both are closed
below. The site itself is clean — the raw HTML of `/`, `/docs/inbox` and six
other pages contains no `747live`, `.bet` or `casino` string.

The report also asked for host-header hardening against mirrors. **Not needed:**
a request to the live site with `Host: evil-mirror.example` already answers
`404` at the edge, checked with curl. No middleware change was made.

## 2. Bangla `?lang=bn` pages — REAL, and the root of it all

`/docs/website-widget?lang=bn` served
`<link rel="canonical" href="https://www.tellmoreai.com/docs/website-widget">`
— the **English** address. That is the instruction "I am a duplicate of that
page, drop me", which is precisely what Search Console then reported.

Three files forced it, each carrying a comment that said `alternates` could not
hold a query string in Next 14. **That was re-measured on 24 Sep with a
throwaway route and is wrong:** both `alternates.canonical` and
`alternates.languages` keep `?lang=bn` intact. There is one real exception,
described at the end of this section.

Fixed:

- `src/lib/seo.js` — `pageMeta` now gives **every** page a self-referencing
  canonical, and takes `bilingual: true` to emit the reciprocal hreflang trio
  (`en`, `bn`, `x-default`). English-only pages such as `/pricing` declare no
  languages at all, because hreflang must never name an address that does not
  exist.
- `src/app/docs/page.js`, `src/app/docs/[slug]/page.js`,
  `src/app/solutions/[slug]/page.js` — the three forced canonicals are gone. A
  manual page is `bilingual` only when its Bangla copy is actually written; a
  solution page only when `BN.PAGES[slug]` is written.
- `src/app/sitemap.js` — hreflang is now reciprocal (`en`, `bn`, `x-default` on
  each bilingual URL, itself included). `lastmod` is **removed**: it was the
  build timestamp, identical on every URL and new on every deploy, which says
  nothing true about when a page's words changed, and Google ignores a `lastmod`
  it cannot trust. Nothing in the project records a real per-page date to put in
  its place.
- `src/lib/landing.js` — the theme boot script now sets
  `document.documentElement.lang = "bn"` before first paint when the URL carries
  `?lang=bn`. This is an **accessibility** fix (screen readers were reading
  Bangla with English pronunciation rules), not an SEO one: Google determines
  language from the visible words and from hreflang, not from this attribute.

Verified on the dev server:

| URL | canonical | hreflang | `<html lang>` |
|---|---|---|---|
| `/docs/inbox` | `…/docs/inbox` | en · bn · x-default | en |
| `/docs/inbox?lang=bn` | `…/docs/inbox?lang=bn` | en · bn · x-default | **bn** |
| `/solutions/website-chatbot?lang=bn` | `…?lang=bn` | en · bn · x-default | **bn** |
| `/pricing` | `…/pricing` | none, correctly | en |

**The one exception — the home page.** Next's metadata resolver collapses any
URL whose path is exactly `/` down to the bare origin: `…/?lang=bn` comes back
as `https://www.tellmoreai.com`, while `/index?lang=bn` keeps its query. On that
page the three hreflang links would therefore all point at English, which is
worse than none. The home page emits its canonical and no hreflang, and
`sitemap.xml` declares the language pair instead — it serialises the root's
query correctly, and a sitemap is one of Google's three accepted places for
hreflang.

**Follow-up, not done:** give the Bangla home page a real `/bn` route, which
removes the exception entirely. That changes routing and the language toggle, so
it is its own task, not a side effect of this one.

## 3. "Home page is an empty client-side shell" — NOT TRUE

Fetched as Googlebot, `https://www.tellmoreai.com/` returns **222 KB** with
`<title>TellMore AI — AI Chatbot for Facebook, Instagram & WhatsApp</title>`,
one `<h1>`, a canonical, and six `/solutions/*` links. It is a fully
server-rendered marketing page.

The report's fetch was made from a logged-in browser, and the explanation is in
`src/middleware.js`: a signed-in visitor opening `/` is redirected to
`/dashboard`. What was measured was the dashboard's client shell — hence the
13 KB and the title "TellMore AI Chatbot Dashboard". Googlebot is never signed
in and never sees it. **No change made.**

## 4. Discovered – currently not indexed (10 pages) — REAL, mostly time

Google knows these URLs and has not crawled them yet. Crawl budget on a young
domain is the main cause and cannot be forced. What the site can do, it now
does: the duplicate-canonical confusion of issues 1 and 2 is gone, and every
page already carries a unique title, description and H1, with the six
`/solutions/*` pages linked from the footer of every page. Requesting indexing
for the most important few is the owner's step below.

## 5. "Indexed, though blocked by robots.txt" — ALREADY CORRECT

`https://tellmoreai.com/` answers **308 Permanent Redirect** to the www host,
and `http://www.tellmoreai.com/` does the same. 308 is a permanent redirect and
Google treats it as 301. The state Search Console recorded on 16 Sep no longer
exists, so this needs **Validate fix** in Search Console and nothing else.

The report suggested removing the `Host:` line from `robots.txt`. It is
non-standard and ignored rather than harmful, and removing it changes a file
Google re-reads on its own schedule, so it was left alone.

## 6. Page with redirect (`http://` versions) — expected, no action

## What the owner does in Search Console

Do these **after** the deploy is live — check first that the Bangla page's
canonical ends in `?lang=bn`.

1. **URL Inspection** → `https://www.tellmoreai.com/docs/inbox` → **Request
   indexing**. Repeat for
   `https://www.tellmoreai.com/docs/website-widget?lang=bn`.
2. On the **Page indexing** report, press **Validate fix** on the rows
   *Duplicate without user-selected canonical* and *Indexed, though blocked by
   robots.txt*.
3. **Sitemaps** — already submitted and reading Success. Nothing to resubmit.
4. Request indexing for three or four of the uncrawled pages, for example
   `/docs/getting-started`, `/solutions/website-chatbot`,
   `/solutions/facebook-messenger-chatbot`.
5. Optional: report `747live.bet` to Google as spam, and/or send a copyright
   removal request for the copied pages.

Google re-crawls on its own schedule. A few days to two weeks is normal, and
nothing forces it sooner.

## Verify (any time)

```bash
for p in / /docs/inbox "/docs/inbox?lang=bn" /pricing; do
  echo "== $p"
  curl -sA Googlebot "https://www.tellmoreai.com$p" | grep -oiE '<link[^>]+(rel="canonical"|hreflang="[a-z-]+")[^>]*>'
done
curl -sI https://tellmoreai.com/ | head -1
curl -sI -H "Host: evil-mirror.example" https://www.tellmoreai.com/ | head -1
```

Expect a self-referencing canonical on every page, the hreflang trio on the
bilingual ones, `308` for the apex and `404` for the unknown host.

Held by `tests/t-canonical.mjs` (19 checks).

## Master prompt

> In the TellMore AI repo, fix how public pages declare their canonical URL and
> their two languages. Read `src/lib/seo.js`, `src/app/sitemap.js` and
> `tests/t-canonical.mjs` first. Rules: every indexable page carries a
> SELF-referencing absolute canonical, including `?lang=bn` pages — naming the
> English address on a Bangla page is what de-indexes it; hreflang is emitted
> only for paths that really have both languages, as a reciprocal `en` / `bn` /
> `x-default` set present on both versions and in the sitemap; no page-level
> override may reintroduce `alternates: { canonical: … }`. Next's resolver
> collapses a URL whose path is exactly `/` to the bare origin, so the home page
> is the one place hreflang cannot be expressed in the head — leave it to the
> sitemap until a real `/bn` route exists. Never put a build timestamp in
> `lastmod`. Verify by rendering each page shape on the dev server and reading
> the emitted `<link>` tags, not by reasoning about the code.
