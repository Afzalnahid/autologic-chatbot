export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase.js";
import { getClientAI } from "@/lib/ai.js";
import { embedProduct } from "@/lib/products.js";

// Re-embeds what a change of AI provider left in the wrong vector space.
//
// Owner's requirement (2026-09-24): "the embedding method has to be as per your
// plan — that has to happen automatically, not give me any hassle." This is the
// automatic part.
//
// Why it has to exist at all. Search compares a question's 768 numbers with a
// product's 768 numbers. Gemini and OpenAI both produce 768 numbers and they
// mean COMPLETELY different things — comparing across the two returns confident
// nonsense rather than an error. So two things happen the moment a provider
// changes: search starts skipping rows in the old space (the embed_model filter
// in match_documents / match_knowledge), and this sweep quietly rebuilds them.
// Between the two, the worst case is a bot that finds fewer products for a few
// minutes. It can never be a bot that finds the WRONG ones.
//
// Bounded on purpose: a fixed number of rows per run, so one enormous catalogue
// cannot run the function out of time or spend an unexpected amount on a new
// key in one go. Whatever is left is picked up on the next run — nightly, or
// whenever this is called.
const ROWS_PER_RUN = 120;      // per table, per run
const CLIENTS_PER_RUN = 25;

function authorised(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) { console.warn("[cron/embeddings] CRON_SECRET is not set — this endpoint is open."); return true; }
  return (request.headers.get("authorization") || "") === `Bearer ${secret}`;
}

// Rows whose stored vector was made by a different model, or that were flagged
// when a key changed. `null` means "embedded before the column existed", which
// is Gemini's — that is all there was.
async function staleRows(table, clientId, model, limit) {
  const { data, error } = await supabase
    .from(table)
    .select(table === "products" ? "id,embedding_model,embedding_stale_at" : "id,content,embedding_model,embedding_stale_at")
    .eq("client_id", clientId)
    .limit(500);
  if (error) throw new Error(`${table}: ${error.message}`);
  const want = String(model || "");
  return (data || [])
    .filter((r) => (r.embedding_model || "gemini-embedding-001") !== want || r.embedding_stale_at)
    .slice(0, limit);
}

async function redoProducts(clientId, ai, rows) {
  let done = 0;
  for (const row of rows) {
    try {
      // Rebuilt through the same helper every other path uses, so the text
      // that gets embedded is identical to what a fresh product would get —
      // and so embedding_model is written by the one place that knows it.
      const { data: p } = await supabase.from("products").select("metadata").eq("id", row.id).eq("client_id", clientId).maybeSingle();
      if (!p?.metadata) continue;
      const embedded = await embedProduct(p.metadata, clientId);
      const { error } = await supabase.from("products")
        .update(embedded).eq("id", row.id).eq("client_id", clientId);
      if (error) throw new Error(error.message);
      done++;
    } catch (e) {
      console.error(`[cron/embeddings] product ${row.id}:`, String(e?.message || e).slice(0, 160));
      // One bad row must not stop the sweep; it is tried again next run.
    }
  }
  return done;
}

async function redoKnowledge(clientId, ai, rows) {
  let done = 0;
  for (const row of rows) {
    try {
      if (!row.content) continue;
      const embedding = await ai.embed(row.content);
      const { error } = await supabase.from("knowledge_base")
        .update({ embedding, embedding_model: ai.embedModel, embedding_stale_at: null })
        .eq("id", row.id).eq("client_id", clientId);
      if (error) throw new Error(error.message);
      done++;
    } catch (e) {
      console.error(`[cron/embeddings] knowledge ${row.id}:`, String(e?.message || e).slice(0, 160));
    }
  }
  return done;
}

async function sweep() {
  const { data: clients, error } = await supabase.from("clients").select("id,business_name").limit(500);
  if (error) throw new Error("clients: " + error.message);

  const report = { clients: 0, products: 0, knowledge: 0, left: 0, failures: [] };
  for (const c of (clients || []).slice(0, CLIENTS_PER_RUN)) {
    try {
      // The provider answering for THIS client — their own key, or the
      // platform's. getClientAI already knows the whole rule.
      const ai = await getClientAI(c.id, "knowledge");
      const model = ai.embedModel;
      const [pRows, kRows] = await Promise.all([
        staleRows("products", c.id, model, ROWS_PER_RUN),
        staleRows("knowledge_base", c.id, model, ROWS_PER_RUN),
      ]);
      if (!pRows.length && !kRows.length) continue;
      report.clients++;
      console.log(`[cron/embeddings] ${c.business_name || c.id}: ${pRows.length} products, ${kRows.length} documents → ${model}`);
      report.products += await redoProducts(c.id, ai, pRows);
      report.knowledge += await redoKnowledge(c.id, ai, kRows);
      if (pRows.length === ROWS_PER_RUN || kRows.length === ROWS_PER_RUN) report.left++;
    } catch (e) {
      const msg = String(e?.message || e).slice(0, 160);
      console.error(`[cron/embeddings] client ${c.id}:`, msg);
      report.failures.push({ client: c.id, error: msg });
    }
  }
  return report;
}

export async function GET(request) {
  if (!authorised(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const report = await sweep();
    console.log("[cron/embeddings]", JSON.stringify(report));
    return NextResponse.json({ ok: true, ...report });
  } catch (e) {
    console.error("[cron/embeddings]", String(e?.message || e).slice(0, 200));
    return NextResponse.json({ error: String(e?.message || e).slice(0, 200) }, { status: 500 });
  }
}

// The admin panel calls this after switching the platform's provider, so the
// rebuild starts at once instead of waiting for the night.
export const POST = GET;
