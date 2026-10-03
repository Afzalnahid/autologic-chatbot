import { headers } from "next/headers";
import { notFound } from "next/navigation";
import SiteShell from "../../site-shell.js";
import { BLOG_CSS } from "../blog-css.js";
import { supabase } from "@/lib/supabase.js";
import { brandForHost, isWhiteLabel } from "@/lib/white-label.js";
import { renderMarkdown } from "@/lib/blog-md.js";
import { readingMinutes } from "@/lib/blog.js";
import { SITE, BRAND, pageMeta, faqJsonLd, breadcrumbJsonLd, jsonLdProps } from "@/lib/seo.js";
import { COMPANY } from "@/lib/company.js";

// One published blog post (owner, 2026-10-04). Only status "published" is ever
// read here, so a draft — however finished it looks in the admin tab — has no
// public address. The article is the owner-approved Markdown, rendered by the
// safe renderer (lib/blog-md.js: everything escaped, no HTML, no scripts).
//
// For search: its own title and description, a canonical address, the other
// language's version as an hreflang alternate when there is one, and
// BlogPosting + FAQ + breadcrumb structured data.
export const revalidate = 300;

async function load(slug) {
  const { data } = await supabase.from("blog_posts").select("*").eq("slug", slug).eq("status", "published").maybeSingle();
  if (!data) return { post: null, pair: null };
  let pair = null;
  if (data.pair_id) {
    const { data: p } = await supabase.from("blog_posts").select("slug,lang,title").eq("id", data.pair_id).eq("status", "published").maybeSingle();
    pair = p || null;
  }
  return { post: data, pair };
}

export async function generateMetadata({ params }) {
  if (isWhiteLabel(brandForHost(headers().get("host")))) return { robots: { index: false, follow: false } };
  const { post, pair } = await load(params.slug);
  if (!post) return {};
  const meta = pageMeta({ title: `${post.title} | ${BRAND}`, description: post.meta_description || post.excerpt, path: `/blog/${post.slug}`, lang: post.lang });
  // This page's address carries no ?lang — each language version is its own post.
  meta.alternates = { canonical: `${SITE}/blog/${post.slug}` };
  if (pair) {
    meta.alternates.languages = { [post.lang]: `${SITE}/blog/${post.slug}`, [pair.lang]: `${SITE}/blog/${pair.slug}`, "x-default": `${SITE}/blog/${post.lang === "en" ? post.slug : pair.slug}` };
  }
  meta.openGraph = { ...(meta.openGraph || {}), type: "article", url: `${SITE}/blog/${post.slug}`, publishedTime: post.published_at, modifiedTime: post.updated_at };
  return meta;
}

export default async function BlogPost({ params }) {
  if (isWhiteLabel(brandForHost(headers().get("host")))) notFound();
  const { post, pair } = await load(params.slug);
  if (!post) notFound();
  const bn = post.lang === "bn";
  const { html } = renderMarkdown(post.body_md);
  const faq = Array.isArray(post.faq) ? post.faq.filter((f) => f?.q && f?.a) : [];
  const { data: more } = await supabase.from("blog_posts").select("slug,title").eq("status", "published").eq("lang", post.lang).neq("id", post.id).order("published_at", { ascending: false }).limit(3);
  const date = new Date(post.published_at || post.created_at).toLocaleDateString(bn ? "bn-BD" : "en-GB", { day: "numeric", month: "long", year: "numeric" });

  const article = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.meta_description || post.excerpt,
    inLanguage: bn ? "bn" : "en",
    datePublished: post.published_at,
    dateModified: post.updated_at,
    mainEntityOfPage: `${SITE}/blog/${post.slug}`,
    keywords: post.keyword,
    author: { "@type": "Organization", name: BRAND, url: SITE },
    publisher: { "@type": "Organization", name: COMPANY.legalName, url: COMPANY.parentUrl },
  };

  return (
    <SiteShell eyebrow={bn ? "ব্লগ" : "Blog"} title={post.title}>
      <style dangerouslySetInnerHTML={{ __html: BLOG_CSS }} />
      <script {...jsonLdProps(article)} />
      <script {...jsonLdProps(breadcrumbJsonLd([{ name: "TellMore AI", path: "/" }, { name: "Blog", path: "/blog" }, { name: post.title, path: `/blog/${post.slug}` }]))} />
      {faq.length > 0 && <script {...jsonLdProps(faqJsonLd(faq))} />}

      <div className="bmeta" lang={post.lang}>
        <span>{date}</span>
        <span>{bn ? `${readingMinutes(post.body_md, "bn")} মিনিটে পড়া` : `${readingMinutes(post.body_md)} min read`}</span>
        {pair && <a href={`/blog/${pair.slug}`} style={{ color: "var(--lp-acc)" }}>{pair.lang === "bn" ? "বাংলায় পড়ুন" : "Read in English"}</a>}
      </div>

      <article className="post" lang={post.lang} dangerouslySetInnerHTML={{ __html: html }} />

      {faq.length > 0 && <section className="post" lang={post.lang}>
        <h2>{bn ? "সাধারণ প্রশ্ন" : "Frequently asked questions"}</h2>
        {faq.map((f, i) => <div key={i}><h3>{f.q}</h3><p>{f.a}</p></div>)}
      </section>}

      <div className="bcta" lang={post.lang}>
        <strong style={{ fontSize: 16 }}>{bn ? "TellMore AI তিন দিন ফ্রি চালিয়ে দেখুন" : "Try TellMore AI free for three days"}</strong>
        <div style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--lp-soft)", marginTop: 4 }}>
          {bn ? "ফেসবুক, ইনস্টাগ্রাম, হোয়াটসঅ্যাপ আর ওয়েবসাইটে গ্রাহকের উত্তর দেয় — বাংলা আর ইংরেজিতে। কার্ড লাগবে না।" : "It answers your customers on Facebook, Instagram, WhatsApp and your website — in Bangla and English. No card needed."}
        </div>
        <a className="btn" href="/dashboard?auth=signup">{bn ? "ফ্রি ট্রায়াল শুরু করুন" : "Start the free trial"}</a>
      </div>

      {(more || []).length > 0 && <section style={{ marginTop: 36 }}>
        <div className="lbl" style={{ fontSize: 10, color: "var(--lp-soft)", marginBottom: 10 }}>{bn ? "আরও পড়ুন" : "Keep reading"}</div>
        {more.map((m) => <a key={m.slug} href={`/blog/${m.slug}`} className="bcard"><h2 style={{ fontSize: 16.5, margin: 0 }}>{m.title}</h2></a>)}
      </section>}
    </SiteShell>
  );
}
