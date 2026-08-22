// Admin identity and permission checks, shared by every /api/admin/* route.
// Lifted out of src/app/api/admin/route.js unchanged so a second admin route
// cannot drift from the first on something as important as who may edit what.
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase.js";
import { notifyNewAdminSignup } from "@/lib/email.js";

export const SUPER_ADMIN = "nahidafzal97@gmail.com";
export const CAN_EDIT = ["super", "full", "editor"];
export const CAN_DELETE = ["super", "full"];

export async function callerEmail(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cchvsgouqqxibhubioch.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_L0-ea26IunVN_BET5SPXOw_VY_KwGZg"
  );
  const { data } = await anon.auth.getUser(token);
  return (data?.user?.email || "").toLowerCase() || null;
}

export async function callerRole(email) {
  if (!email) return null;
  if (email === SUPER_ADMIN) return "super";
  const { data } = await supabase.from("admin_users").select("role").eq("email", email).maybeSingle();
  if (!data) {
    await supabase.from("admin_users").insert({ email, role: "pending" });
    notifyNewAdminSignup(email).catch(() => {});
    return "pending";
  }
  return data.role;
}

// The super admin's second factor. Distinguishes the two failure modes so the
// owner can act on the error instead of retyping the key forever: a missing env
// var means EVERY attempt fails as "invalid key" no matter what is typed.
export function checkSuperKey(request) {
  if (!process.env.ADMIN_PASSWORD) {
    return "The server has no ADMIN_PASSWORD configured. Add it in Vercel → Settings → Environment Variables, redeploy, then try again.";
  }
  const key = request.headers.get("x-admin-key") || "";
  if (key !== process.env.ADMIN_PASSWORD) return "The secret admin key you entered is wrong.";
  return null;
}
