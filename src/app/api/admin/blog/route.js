export const dynamic = "force-dynamic";
export const revalidate = 0;
// Writing a draft is one OpenAI call that can take most of a minute.
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase.js";
import { callerEmail, callerRole, CAN_EDIT, CAN_DELETE, checkSuperKey } from "@/lib/admin-auth.js";
import { encryptSecret, decryptSecret, maskKey } from "@/lib/crypt.js";
import { listModels } from "@/lib/model-catalog.js";
import { blogSettings, writeDraft, DEFAULT_BLOG_MODEL } from "@/lib/blog-writer.js";
import { cleanEdit, uniqueSlug, LANGS } from "@/lib/blog.js";
import { logEvent } from "@/lib/platform-events.js";

// The admin Blog tab (owner, 2026-10-04).
//
//   keyword + language → "Write draft" → a DRAFT row (never public)
//   the owner edits it → "Approve & publish" → status published, on /blog
//   "Unpublish" takes it down again; a draft can be discarded.
//
// Anyone who can edit in the console may write, edit and publish. The OpenAI key
// is guarded like the platform's own key: full access AND the secret admin key,
// checked with OpenAI before it is saved, stored encrypted, and only ever sent
// back as a mask.

const LIST_COLS = "id,slug,lang,keyword,title,status,pair_id,model,tokens_in,tokens_out,created_at,updated_at,published_at,published_by";
const json = (b, status = 200) => NextResponse.json(b, { status, headers: { "Cache-Control": "no-store" } });

function refreshPublic(slug) {
  try { revalidatePath("/blog"); if (slug) revalidatePath(`/blog/${slug}`); revalidatePath("/sitemap.xml"); } catch { /* the pages also refresh on their own timer */ }
}

async function takenSlugs(exceptId) {
  const { data } = await supabase.from("blog_posts").select("id,slug");
  return (data || []).filter((r) => r.id !== exceptId).map((r) => r.slug);
}

export async function GET(request) {
  const email = await callerEmail(request);
  if (!email) return json({ error: "unauthorized" }, 401);
  const role = await callerRole(email);
  if (!role || role === "pending" || role === "blocked") return json({ error: "forbidden" }, 403);
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const { data } = await supabase.from("blog_posts").select("*").eq("id", id).maybeSingle();
    if (!data) return json({ error: "That post does not exist." }, 404);
    return json({ post: data });
  }
  const [s, postsQ] = await Promise.all([
    blogSettings(),
    supabase.from("blog_posts").select(LIST_COLS).order("created_at", { ascending: false }).limit(300),
  ]);
  return json({
    role,
    can_edit: CAN_EDIT.includes(role),
    can_key: CAN_DELETE.includes(role),
    settings: { has_key: !!s.api_key_enc, key_mask: s.key_mask || null, model: s.model || DEFAULT_BLOG_MODEL, updated_at: s.updated_at || null, updated_by: s.updated_by || null },
    posts: postsQ.data || [],
  });
}

export async function POST(request) {
  const email = await callerEmail(request);
  if (!email) return json({ error: "unauthorized" }, 401);
  const role = await callerRole(email);
  const body = await request.json().catch(() => ({}));
  const action = body.action;

  // ── the OpenAI key and the model ─────────────────────────────────────────
  if (["list_models", "save_key", "remove_key", "set_model"].includes(action)) {
    if (!CAN_DELETE.includes(role)) return json({ error: "Only a full-access admin can change the blog's AI settings." }, 403);

    if (action === "list_models") {
      let key = String(body.api_key || "").trim();
      if (!key) {
        const s = await blogSettings();
        if (s.api_key_enc) { try { key = decryptSecret(s.api_key_enc); } catch { key = ""; } }
      }
      if (!key) return json({ error: "Paste your OpenAI key first." }, 400);
      try {
        const models = await listModels("openai", key);
        if (!models.length) return json({ error: "This key has no usable chat models." }, 400);
        return json({ ok: true, models });
      } catch (e) {
        return json({ error: "OpenAI refused the key: " + String(e?.message || "unknown").slice(0, 160) }, 400);
      }
    }

    if (action === "set_model") {
      const model = String(body.model || "").trim().slice(0, 80);
      if (!model) return json({ error: "Choose a model." }, 400);
      const { error } = await supabase.from("blog_settings").update({ model, updated_by: email, updated_at: new Date().toISOString() }).eq("id", 1);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    // Changing or removing the key needs the secret admin key too.
    const keyErr = checkSuperKey(request);
    if (keyErr) return json({ error: keyErr }, 403);

    if (action === "remove_key") {
      const { error } = await supabase.from("blog_settings").update({ api_key_enc: null, key_mask: null, updated_by: email, updated_at: new Date().toISOString() }).eq("id", 1);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    // save_key: proven with OpenAI first, so a mistyped key is never saved.
    const key = String(body.api_key || "").trim();
    if (!/^sk-[A-Za-z0-9_\-]{20,}$/.test(key)) return json({ error: "That does not look like an OpenAI key (it starts with sk-)." }, 400);
    let models;
    try { models = await listModels("openai", key); } catch (e) { return json({ error: "OpenAI refused the key: " + String(e?.message || "unknown").slice(0, 160) }, 400); }
    if (!models?.length) return json({ error: "This key has no usable chat models." }, 400);
    const wanted = String(body.model || "").trim();
    const model = models.some((m) => m.id === wanted) ? wanted : (models.find((m) => m.id === DEFAULT_BLOG_MODEL)?.id || models[0].id);
    const { error } = await supabase.from("blog_settings").update({
      api_key_enc: encryptSecret(key), key_mask: maskKey(key), model, updated_by: email, updated_at: new Date().toISOString(),
    }).eq("id", 1);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, key_mask: maskKey(key), model, models });
  }

  // ── posts ────────────────────────────────────────────────────────────────
  if (!CAN_EDIT.includes(role)) return json({ error: "forbidden" }, 403);

  if (action === "generate" || action === "rewrite") {
    let keyword = String(body.keyword || "").trim().slice(0, 140);
    let lang = body.lang === "bn" ? "bn" : "en";
    let notes = String(body.notes || "").trim().slice(0, 600);
    let existing = null;
    if (action === "rewrite") {
      const { data } = await supabase.from("blog_posts").select("*").eq("id", body.id).maybeSingle();
      if (!data) return json({ error: "That post does not exist." }, 404);
      if (data.status === "published") return json({ error: "Unpublish the post before rewriting it." }, 409);
      existing = data; keyword = data.keyword; lang = data.lang; notes = String(body.notes ?? data.notes ?? "").trim().slice(0, 600);
    }
    if (keyword.length < 3) return json({ error: "Write a keyword of at least three letters." }, 400);

    const w = await writeDraft({ keyword, lang, notes });
    if (!w.ok) return json({ error: w.error }, 400);
    const d = w.draft;
    const fields = {
      title: d.title, meta_description: d.meta_description, excerpt: d.excerpt, body_md: d.body_md, faq: d.faq,
      model: w.model, tokens_in: w.usage.in, tokens_out: w.usage.out, notes: notes || null, updated_at: new Date().toISOString(),
    };
    if (existing) {
      const { data, error } = await supabase.from("blog_posts").update(fields).eq("id", existing.id).select("*").single();
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, post: data });
    }
    // The other language's draft of the same keyword, when both were asked for.
    const pair = body.pair_of ? String(body.pair_of) : null;
    const slug = uniqueSlug(lang === "bn" ? `${d.slug}-bn` : d.slug, await takenSlugs());
    const { data, error } = await supabase.from("blog_posts").insert({ ...fields, slug, lang, keyword, status: "draft", pair_id: pair, created_by: email }).select("*").single();
    if (error) return json({ error: error.message }, 500);
    if (pair) await supabase.from("blog_posts").update({ pair_id: data.id }).eq("id", pair).is("pair_id", null);
    return json({ ok: true, post: data });
  }

  const { data: post } = await supabase.from("blog_posts").select("*").eq("id", body.id).maybeSingle();
  if (!post) return json({ error: "That post does not exist." }, 404);

  if (action === "save") {
    const c = cleanEdit(body.post || {});
    if (!c.ok) return json({ error: c.error }, 400);
    const taken = await takenSlugs(post.id);
    if (taken.includes(c.edit.slug)) return json({ error: `Another post already uses the address /blog/${c.edit.slug}. Change the slug.` }, 409);
    const { data, error } = await supabase.from("blog_posts").update({ ...c.edit, updated_at: new Date().toISOString() }).eq("id", post.id).select("*").single();
    if (error) return json({ error: error.message }, 500);
    if (post.status === "published") { refreshPublic(post.slug); refreshPublic(data.slug); }
    return json({ ok: true, post: data });
  }

  if (action === "publish") {
    const now = new Date().toISOString();
    const { data, error } = await supabase.from("blog_posts")
      .update({ status: "published", published_at: post.published_at || now, published_by: email, updated_at: now })
      .eq("id", post.id).select("*").single();
    if (error) return json({ error: error.message }, 500);
    refreshPublic(data.slug);
    logEvent({ kind: "blog_published", title: `Blog post published (${LANGS[data.lang]})`, body: data.title, url: `/blog/${data.slug}` }).catch(() => {});
    return json({ ok: true, post: data });
  }

  if (action === "unpublish") {
    const { data, error } = await supabase.from("blog_posts").update({ status: "unpublished", updated_at: new Date().toISOString() }).eq("id", post.id).select("*").single();
    if (error) return json({ error: error.message }, 500);
    refreshPublic(post.slug);
    return json({ ok: true, post: data });
  }

  if (action === "discard") {
    // Only something that was never public; a published post is unpublished instead.
    if (post.status === "published") return json({ error: "Unpublish the post first." }, 409);
    const { error } = await supabase.from("blog_posts").delete().eq("id", post.id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  return json({ error: "unknown action" }, 400);
}
