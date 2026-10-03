import { headers } from "next/headers";
import { notFound } from "next/navigation";
import SiteShell from "../site-shell.js";
import { BLOG_CSS } from "./blog-css.js";
import { supabase } from "@/lib/supabase.js";
import { brandForHost, isWhiteLabel } from "@/lib/white-label.js";
import { pageMeta, breadcrumbJsonLd, jsonLdProps } from "@/lib/seo.js";

// tellmoreai.com/blog — every published post, newest first (owner, 2026-10-04).
// A post exists here only after the owner approved its draft in the admin Blog
// tab. ?lang=bn shows the Bangla posts, ?lang=en the English ones.
//
// Re-read at most every five minutes; publishing also refreshes it at once
// (revalidatePath in api/admin/blog).
export const revalidate = 300;

const pickLang = (sp) => (sp?.lang === "bn" ? "bn" : sp?.lang === "en" ? "en" : null);

export function generateMetadata({ searchParams }) {
  const lang = pickLang(searchParams);
  return pageMeta({
    title: lang === "bn" ? "ব্লগ — ফেসবুক, হোয়াটসঅ্যাপ ও অনলাইন ব্যবসার গাইড | TellMore AI" : "Blog — guides for Facebook, WhatsApp and online business | TellMore AI",
    description: lang === "bn"
      ? "বাংলাদেশের অনলাইন দোকান আর সেবা ব্যবসার জন্য চ্যাটবট, কাস্টমার সার্ভিস আর বিক্রি বাড়ানোর সহজ গাইড।"
      : "Practical guides for Bangladeshi online shops and service businesses: chatbots, customer service on Messenger, Instagram and WhatsApp, and selling more.",
    path: "/blog",
    lang: lang || "en",
  });
}

export default async function BlogIndex({ searchParams }) {
  if (isWhiteLabel(brandForHost(headers().get("host")))) notFound();
  const lang = pickLang(searchParams);
  let q = supabase.from("blog_posts").select("slug,lang,title,excerpt,published_at").eq("status", "published").order("published_at", { ascending: false }).limit(200);
  if (lang) q = q.eq("lang", lang);
  const { data } = await q;
  const posts = data || [];
  const date = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <SiteShell eyebrow="Blog" title={lang === "bn" ? "ব্লগ" : "Blog"}
      lead={lang === "bn" ? "অনলাইন দোকান আর সেবা ব্যবসার জন্য সহজ, কাজের গাইড।" : "Practical guides for online shops and service businesses in Bangladesh."}>
      <style dangerouslySetInnerHTML={{ __html: BLOG_CSS }} />
      <script {...jsonLdProps(breadcrumbJsonLd([{ name: "TellMore AI", path: "/" }, { name: "Blog", path: "/blog" }]))} />
      <nav className="btabs" aria-label="Language">
        <a href="/blog" className={!lang ? "on" : ""}>All</a>
        <a href="/blog?lang=en" className={lang === "en" ? "on" : ""}>English</a>
        <a href="/blog?lang=bn" className={lang === "bn" ? "on" : ""}>বাংলা</a>
      </nav>
      {posts.length === 0
        ? <p style={{ color: "var(--lp-soft)" }}>{lang === "bn" ? "শিগগিরই নতুন লেখা আসছে।" : "New articles are on their way."}</p>
        : posts.map((p) => (
          <a key={p.slug} href={`/blog/${p.slug}`} className="bcard" lang={p.lang}>
            <h2>{p.title}</h2>
            {p.excerpt && <p>{p.excerpt}</p>}
            <div className="bmeta" style={{ margin: "10px 0 0" }}>
              <span>{date(p.published_at)}</span><span>{p.lang === "bn" ? "বাংলা" : "English"}</span>
            </div>
          </a>
        ))}
    </SiteShell>
  );
}
