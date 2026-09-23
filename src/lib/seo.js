// How the site introduces itself to Google, Messenger and WhatsApp.
//
// Before this file existed the public pages carried a title and a description
// and nothing else. Two things followed from that. Google had no name to print
// above a result, so it printed the bare domain — "tellmoreai.com" instead of
// "TellMore AI". And a link pasted into Messenger or WhatsApp — which is where
// this product's customers actually are — unfurled as an empty grey box, with
// no picture, no headline and no sentence.
//
// Every public page builds its metadata here so there is one place that knows
// the canonical host, the share pictures and the shape of the tags.

import { COMPANY } from "@/lib/company.js";

export const SITE = "https://www.tellmoreai.com";
export const BRAND = "TellMore AI";

// Built by scripts/make-og-images.mjs, one per language. A Bangla reader who is
// sent the Bangla page should see a Bangla card.
const CARD = { en: "/og.png", bn: "/og-bn.png" };

const LOCALE = { en: "en_US", bn: "bn_BD" };

/**
 * A complete metadata object for one public page.
 *
 * `bilingual` — pass true only when this exact path really has a Bangla
 * version. hreflang has to be reciprocal and every address in it has to exist;
 * pointing at a Bangla page that was never written is worse than saying
 * nothing, and /pricing, /privacy and /terms are English-only.
 *
 * On the query string: an earlier note here said Next 14 drops it out of
 * `alternates`, so Bangla pages were given no canonical at all and the two
 * languages were declared only in sitemap.xml. Re-measured on 2026-09-24
 * against this Next version with a throwaway route: BOTH `alternates.canonical`
 * and `alternates.languages` came back with "?lang=bn" intact. The old note
 * was wrong, and the pages that worked around it are what Search Console has
 * been complaining about.
 */
export function pageMeta({ title, description, path = "/", lang = "en", robots, bilingual = false }) {
  const suffix = lang === "bn" ? "?lang=bn" : "";
  const url = `${SITE}${path}${suffix}`;
  const image = `${SITE}${CARD[lang] || CARD.en}`;

  return {
    title,
    description,
    // Every page says "this is me" — including the Bangla one. Naming the
    // English page instead told Google the Bangla page was a duplicate to be
    // dropped, and a page with no canonical at all let a scraper's copy be
    // chosen as the original (Search Console, 22 Sep 2026: our /docs/inbox was
    // filed under an unrelated gambling domain).
    alternates: {
      canonical: url,
      ...(bilingual ? {
        languages: {
          en: `${SITE}${path}`,
          bn: `${SITE}${path}?lang=bn`,
          // Which version to show a reader Google cannot place. English, the
          // address without a query, is also what every internal link uses.
          "x-default": `${SITE}${path}`,
        },
      } : {}),
    },
    openGraph: {
      type: "website",
      siteName: BRAND,
      locale: LOCALE[lang] || LOCALE.en,
      url,
      title,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
    ...(robots ? { robots } : {}),
  };
}

/**
 * The structured data that lets Google print "TellMore AI" above a result
 * instead of the domain. It has to sit on the home page to count, so this is
 * used once, in src/app/page.js.
 *
 * The logo has to be a raster file — Google's guidance does not accept an SVG
 * here — which is why public/logo.png exists alongside the SVG favicon.
 */
export function siteJsonLd(lang = "en") {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE}/#website`,
        url: SITE,
        name: BRAND,
        inLanguage: lang === "bn" ? "bn-BD" : "en",
        publisher: { "@id": `${SITE}/#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${SITE}/#organization`,
        name: BRAND,
        url: SITE,
        logo: {
          "@type": "ImageObject",
          url: `${SITE}/logo.png`,
          width: 512,
          height: 512,
        },
        email: COMPANY.email,
        telephone: COMPANY.phoneE164,
        address: {
          "@type": "PostalAddress",
          streetAddress: COMPANY.street,
          addressLocality: COMPANY.city,
          postalCode: COMPANY.postalCode,
          addressCountry: "BD",
        },
        contactPoint: [{
          "@type": "ContactPoint",
          contactType: "customer support",
          email: COMPANY.email,
          telephone: COMPANY.phoneE164,
          areaServed: "BD",
          availableLanguage: ["en", "bn"],
        }],
        // The registered business behind the product. Naming it lets Google
        // connect this site to the company rather than treating them as two
        // unrelated things.
        parentOrganization: {
          "@type": "Organization",
          name: COMPANY.legalName,
          url: COMPANY.parentUrl,
        },
      },
    ],
  };
}

/**
 * A <script type="application/ld+json"> as a string-safe object. Structured
 * data is how a result gets more than a blue link: the price range under the
 * pricing page, a question that opens straight in the results, the breadcrumb
 * trail above a manual page. Google reads it; a visitor never sees it.
 */
export function jsonLdProps(data) {
  return { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(data).replace(/</g, "\\u003c") } };
}

/**
 * The product itself: a piece of software with a price list. `plans` comes
 * from PLANS in plans.js, so a price change on the pricing page changes what
 * Google is told at the same time. Prices are BDT per month — the unit a
 * Bangladeshi business searches in.
 */
export function productJsonLd({ plans, trialDays }) {
  const monthly = plans.map((p) => p.monthly).filter((n) => typeof n === "number" && n > 0);
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE}/#software`,
    name: BRAND,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Customer service chatbot",
    operatingSystem: "Web, Android",
    url: `${SITE}/pricing`,
    description:
      "AI chatbot for Bangladeshi businesses that answers customers on Facebook Messenger, Instagram, WhatsApp and a website widget, in Bangla and English.",
    inLanguage: ["bn-BD", "en"],
    publisher: { "@id": `${SITE}/#organization` },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "BDT",
      lowPrice: Math.min(...monthly),
      highPrice: Math.max(...monthly),
      offerCount: monthly.length,
      availability: "https://schema.org/InStock",
      areaServed: "BD",
      offers: plans
        .filter((p) => typeof p.monthly === "number" && p.monthly > 0)
        .map((p) => ({
          "@type": "Offer",
          name: p.name,
          description: p.tagline,
          price: p.monthly,
          priceCurrency: "BDT",
          url: `${SITE}/pricing`,
          availability: "https://schema.org/InStock",
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: p.monthly,
            priceCurrency: "BDT",
            billingDuration: 1,
            billingIncrement: 1,
            unitText: "MONTH",
          },
        })),
    },
    ...(trialDays
      ? { potentialAction: { "@type": "ConsumeAction", name: `${trialDays}-day free trial`, target: `${SITE}/dashboard` } }
      : {}),
  };
}

/** Questions a page already answers, so the answer can open in the results. */
export function faqJsonLd(pairs) {
  const list = (pairs || []).filter((p) => p?.q && p?.a).slice(0, 20);
  if (!list.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: list.map(({ q, a }) => ({
      "@type": "Question",
      name: String(q),
      acceptedAnswer: { "@type": "Answer", text: String(a) },
    })),
  };
}

/** The trail Google prints above a result: TellMore AI › Manual › Inbox. */
export function breadcrumbJsonLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE}${it.path}`,
    })),
  };
}
