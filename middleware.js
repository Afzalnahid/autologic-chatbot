import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/middleware";

export async function middleware(request) {
  // The middleware runs on every page. If Supabase env is missing or auth throws,
  // it must NOT take the whole site down — fall through and let the page render,
  // where the client-side auth gate handles login.
  try {
    const { supabase, supabaseResponse } = createClient(request);
    await supabase.auth.getUser();
    return supabaseResponse;
  } catch (e) {
    console.error("[middleware]", e?.message || e);
    return NextResponse.next({ request: { headers: request.headers } });
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
