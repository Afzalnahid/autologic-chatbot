// Writes one blog draft with the owner's OWN OpenAI key (blog_settings), never
// the platform's key and never a client's (owner, 2026-10-04: "I will use a
// separate GPT API key for this"). This is the one AI call in the product that
// does not go through getClientAI: it is not a bot reply, it bills the owner's
// writing account, and the bot's one-provider rule (CLAUDE.md) is about the bot.
//
// The prompt and the checks on the answer are pure (lib/blog.js); this file only
// loads the live facts, calls the API and reports plainly when it cannot.
import { supabase } from "@/lib/supabase.js";
import { decryptSecret } from "@/lib/crypt.js";
import { loadPlans, trialDays } from "@/lib/plan-limits.js";
import { SOLUTIONS } from "@/lib/solutions/index.js";
import * as SOL_EN from "@/lib/solutions/en.js";
import { buildPrompt, factsSheet, parseDraft } from "@/lib/blog.js";

export const DEFAULT_BLOG_MODEL = "gpt-4o-mini";

export async function blogSettings() {
  const { data } = await supabase.from("blog_settings").select("api_key_enc,key_mask,model,updated_at,updated_by").eq("id", 1).maybeSingle();
  return data || {};
}

async function liveFacts() {
  const [plans, days] = await Promise.all([loadPlans().catch(() => ({})), trialDays().catch(() => 3)]);
  const solutions = SOLUTIONS.map((s) => ({ slug: s.slug, title: SOL_EN.PAGES?.[s.slug]?.title || "" }));
  return factsSheet({ plans: Object.values(plans || {}), solutions, trialDays: days });
}

// → { ok:true, draft, model, usage:{in,out} } | { ok:false, error }
export async function writeDraft({ keyword, lang = "en", notes = "" }) {
  const s = await blogSettings();
  if (!s.api_key_enc) return { ok: false, error: "Add your OpenAI key in the Blog tab first." };
  let key;
  try { key = decryptSecret(s.api_key_enc); } catch { return { ok: false, error: "The saved OpenAI key could not be read. Paste it again." }; }
  const model = s.model || DEFAULT_BLOG_MODEL;
  const { system, user } = buildPrompt({ keyword, lang, notes, facts: await liveFacts() });

  let res, j;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      // No temperature and max_completion_tokens (not max_tokens): the newer
      // models refuse the old names, and every current model accepts these.
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        response_format: { type: "json_object" },
        max_completion_tokens: 8000,
      }),
      signal: AbortSignal.timeout(55000),
    });
    j = await res.json().catch(() => ({}));
  } catch (e) {
    return { ok: false, error: /timeout|abort/i.test(String(e?.name || e)) ? "OpenAI took too long. Try again, or choose a faster model." : "Could not reach OpenAI. Try again." };
  }
  if (!res.ok) {
    const msg = String(j?.error?.message || "").slice(0, 200);
    if (res.status === 401) return { ok: false, error: "OpenAI refused the key. Paste a working key in the Blog tab." };
    if (res.status === 429) return { ok: false, error: "OpenAI says the key is out of credit or rate-limited. Check billing on platform.openai.com." };
    return { ok: false, error: `OpenAI could not write the draft${msg ? `: ${msg}` : "."}` };
  }
  const text = j?.choices?.[0]?.message?.content || "";
  const parsed = parseDraft(text, { keyword });
  if (!parsed.ok) return parsed;
  return { ok: true, draft: parsed.draft, model, usage: { in: j?.usage?.prompt_tokens ?? null, out: j?.usage?.completion_tokens ?? null } };
}
