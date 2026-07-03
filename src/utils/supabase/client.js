import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cchvsgouqqxibhubioch.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_L0-ea26IunVN_BET5SPXOw_VY_KwGZg";

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseKey);
}
