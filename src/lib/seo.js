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

/** A complete metadata object for one public page. */
export function pageMeta({ title, description, path = "/", lang = "en", robots }) {
  const suffix = lang === "bn" ? "?lang=bn" : "";
  const url = `${SITE}${path}${suffix}`;
  const image = `${SITE}${CARD[lang] || CARD.en}`;

  return {
    title,
    description,
    // Next 14 strips the query string out of anything it resolves for
    // alternates — measured, with a plain string and again with a URL object:
    // "?lang=bn" came back as the bare address both times. So a Bangla page
    // cannot say "this is me" here, and hreflang links would all three have
    // pointed at the English page, which is worse than saying nothing.
    //
    // The English page still gets its canonical. The Bangla one deliberately
    // gets none: it is indexed today, and a canonical pointing at the English
    // page is exactly the instruction that would remove it. The two languages
    // are declared to Google in sitemap.xml instead, which serialises the
    // query string correctly.
    ...(lang === "bn" ? {} : { alternates: { canonical: url } }),
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
