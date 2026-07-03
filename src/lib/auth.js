import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase.js";

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

export function trialActive(client) {
  if (!client) return false;
  if (client.plan === "pro") return true;
  if (client.plan === "trial") return client.trial_end && new Date(client.trial_end) > new Date();
  return false;
}
