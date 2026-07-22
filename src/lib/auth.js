import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase.js";
import { planActive } from "@/lib/plans.js";

const authClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export async function requireClient(request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return { error: "unauthorized" };
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user?.email) return { error: "unauthorized" };
  const email = data.user.email;
  const { data: rows } = await supabase.from("clients").select("*");
  const client = (rows || []).find(c => c.owner_email === email);
  return { client: client || null, email };
}

// Kept under the old name so existing callers keep working.
export function trialActive(client) {
  return planActive(client);
}
