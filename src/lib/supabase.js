import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function getProducts(limit = 100) {
  const { data, error } = await supabase
    .from("products")
    .select("id, content, metadata, product_id, product_name, category, regular_price, sale_price, stock_status, image_url")
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function deleteProduct(id) {
  const { error } = await supabase.from("products").delete().or(`id.eq.${id},product_id.eq.${id}`);
  if (error) throw error;
}

export async function getConversations(limit = 50) {
  const { data, error } = await supabase
    .from("message_buffer")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function insertMessageBuffer(senderId, content, status = "Pending") {
  const { data, error } = await supabase
    .from("message_buffer")
    .insert({ sender_id: senderId, message_content: content, status })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMessageBuffer(id, updates) {
  const { error } = await supabase.from("message_buffer").update(updates).eq("id", id);
  if (error) throw error;
}

export async function getPendingMessages(senderId) {
  const { data, error } = await supabase
    .from("message_buffer")
    .select("*")
    .eq("sender_id", senderId)
    .eq("status", "Pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function markMessagesReplied(senderId) {
  const { error } = await supabase
    .from("message_buffer")
    .update({ status: "Replied" })
    .eq("sender_id", senderId)
    .eq("status", "Pending");
  if (error) throw error;
}

export async function getChatMemory(sessionId, limit = 20) {
  const { data, error } = await supabase
    .from("chat_memory")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function saveChatMemory(sessionId, message) {
  const { error } = await supabase
    .from("chat_memory")
    .insert({ session_id: sessionId, message });
  if (error) throw error;
}

export async function matchDocuments(queryEmbedding, matchCount = 3, filter = {}) {
  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: queryEmbedding,
    match_count: matchCount,
    filter,
  });
  if (error) throw error;
  return data || [];
}

export async function upsertProductVector(content, metadata, embedding) {
  await supabase.from("products").delete().eq("product_id", metadata.product_id);

  const { error } = await supabase.from("products").insert({
    content,
    metadata,
    embedding,
    product_id: metadata.product_id,
    product_name: metadata.product_name,
    category: metadata.category,
    regular_price: metadata.regular_price ? Number(metadata.regular_price) : null,
    sale_price: metadata.sale_price ? Number(metadata.sale_price) : null,
    stock_status: metadata.stock_status,
    image_url: metadata.image_url,
  });
  if (error) throw error;
}

export async function getSettings() {
  const { data } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", "main")
    .single();
  return data?.settings || null;
}

export async function saveSettings(settings) {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ id: "main", settings }, { onConflict: "id" });
  if (error) throw error;
}
