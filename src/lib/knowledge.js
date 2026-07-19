import { supabase } from "@/lib/supabase.js";
import { generateEmbedding } from "@/lib/gemini.js";
import { createRequire } from "module";

const nodeRequire = createRequire(import.meta.url);

// ---- Text extraction (PDF / DOCX / TXT) ----
export async function extractText(buffer, fileType, fileName = "") {
  const type = (fileType || "").toLowerCase();
  const name = (fileName || "").toLowerCase();

  if (type.includes("pdf") || name.endsWith(".pdf")) {
    const pdfParse = nodeRequire("pdf-parse");
    const data = await pdfParse(buffer);
    return data.text || "";
  }
  if (
    type.includes("wordprocessingml") ||
    type.includes("msword") ||
    name.endsWith(".docx") ||
    name.endsWith(".doc")
  ) {
    const mammoth = nodeRequire("mammoth");
    const { value } = await mammoth.extractRawText({ buffer });
    return value || "";
  }
  // Plain text / markdown / csv fallback
  return buffer.toString("utf-8");
}

// ---- Chunking ----
export function chunkText(text, chunkSize = 1200, overlap = 150) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + chunkSize, clean.length);
    // try to break on a sentence boundary near the end
    if (end < clean.length) {
      const slice = clean.slice(start, end);
      const lastStop = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("? "), slice.lastIndexOf("! "));
      if (lastStop > chunkSize * 0.5) end = start + lastStop + 1;
    }
    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push(piece);
    start = end - overlap;
    if (start < 0) start = 0;
    if (end >= clean.length) break;
  }
  return chunks;
}

// ---- Ingest one file into the knowledge base ----
// Returns { chunks: number }
export async function ingestFile({ clientId, fileId, fileName, fileUrl, fileType, buffer }) {
  const raw = await extractText(buffer, fileType, fileName);
  const pieces = chunkText(raw);
  if (!pieces.length) throw new Error("No readable text found in file");

  // Remove any previous chunks for this file (re-upload / re-sync)
  await supabase.from("knowledge_base").delete().eq("file_id", fileId).eq("client_id", clientId);

  const rows = [];
  for (let i = 0; i < pieces.length; i++) {
    const content = pieces[i];
    const embedding = await generateEmbedding(content);
    rows.push({
      client_id: clientId,
      file_id: fileId,
      content,
      embedding,
      metadata: {
        client_id: String(clientId),
        file_id: fileId,
        file_name: fileName,
        file_url: fileUrl,
        chunk_index: i,
      },
    });
  }

  // Insert in batches to stay well under payload limits
  const BATCH = 20;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { error } = await supabase.from("knowledge_base").insert(slice);
    if (error) throw new Error("KB insert failed: " + error.message);
  }

  await supabase.from("file_registry").upsert(
    {
      file_id: fileId,
      client_id: clientId,
      file_name: fileName,
      file_url: fileUrl,
      file_type: fileType,
      chunks: pieces.length,
      status: "ready",
      last_synced: new Date().toISOString(),
    },
    { onConflict: "file_id" }
  );

  return { chunks: pieces.length };
}

// ---- Semantic search over the knowledge base ----
export async function searchKnowledge(clientId, query, k = 5) {
  try {
    const emb = await generateEmbedding(query);
    const { data, error } = await supabase.rpc("match_knowledge", {
      query_embedding: emb,
      match_count: k,
      filter: { client_id: String(clientId) },
    });
    if (error) {
      console.error("match_knowledge:", error.message);
      return [];
    }
    return data || [];
  } catch (e) {
    console.error("searchKnowledge:", e.message);
    return [];
  }
}

// ---- Delete a file and all its chunks ----
export async function deleteFile(clientId, fileId) {
  // Remove the original file from storage too (path: clientId/fileId.ext)
  try {
    const { data: objs } = await supabase.storage.from("knowledge-files").list(String(clientId));
    const targets = (objs || [])
      .filter((o) => o.name.startsWith(fileId))
      .map((o) => `${clientId}/${o.name}`);
    if (targets.length) await supabase.storage.from("knowledge-files").remove(targets);
  } catch (e) {
    console.error("storage cleanup:", e.message);
  }
  await supabase.from("knowledge_base").delete().eq("file_id", fileId).eq("client_id", clientId);
  await supabase.from("file_registry").delete().eq("file_id", fileId).eq("client_id", clientId);
}
