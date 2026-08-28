import { createClient } from "@supabase/supabase-js";

let _supabase = null;

export function getSupabaseClient() {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
    // Next.js patches global fetch and caches GET responses in its Data Cache.
    // Supabase reads go through fetch, so a SELECT could return a stale row for
    // up to the cache lifetime — e.g. a bot on/off toggle that was written a
    // moment earlier read back its OLD value, so the switch "reverted". Force
    // every Supabase request to bypass that cache; this is a backend service
    // client, freshness matters more than caching.
    _supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init = {}) => fetch(input, { ...init, cache: "no-store" }) },
    });
  }
  return _supabase;
}

export const supabase = new Proxy({}, {
  get(_, prop) { return getSupabaseClient()[prop]; }
});

// This file deliberately exports nothing but the client itself.
//
// Thirteen helpers used to live below here — getProducts, deleteProduct,
// upsertProductVector, getSettings, saveSettings, the message_buffer and
// chat_memory pair, matchDocuments — left over from when this was one shop's
// bot. Not one of them filtered client_id, because there was only ever one
// client. getProducts() returned every shop's catalogue; deleteProduct(id)
// deleted by id OR product_id across all of them, with the id pasted straight
// into a PostgREST filter string; getSettings() read one global row.
//
// None had a single caller left. They were removed rather than fixed, because
// a correct-looking helper on the project's own database module is the easiest
// thing in the world to import by accident — and the bug it causes is a shop
// being shown another shop's products, which nobody would see from the outside.
//
// Every query now lives in the route that needs it, next to its .eq("client_id").
