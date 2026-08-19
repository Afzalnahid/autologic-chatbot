import { createBrowserClient } from "@supabase/ssr";
import { createClient as createJsClient } from "@supabase/supabase-js";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    // Fail loudly in the console but don't crash the render; the UI can show a
    // friendly message instead of a blank screen.
    console.error("Supabase browser env missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }
  return createBrowserClient(url, key);
}

// The admin console's OWN auth client. The default client above keeps its
// session in domain-wide cookies, so signing in on /admin used to sign the
// same browser into the client dashboard too (and one logout killed both).
// This one keeps its session in localStorage under its own key instead:
// the two logins can no longer see each other. detectSessionInUrl stays off
// so an email-confirmation link meant for the dashboard is never swallowed
// by the admin page.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error("Supabase browser env missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }
  return createJsClient(url, key, {
    auth: {
      storageKey: "al-admin-auth",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
}
