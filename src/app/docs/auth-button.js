"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

// The one button in the manual's header that depends on who is reading. The
// manual is public — a business deciding whether to sign up reads it too —
// so a visitor gets "Log in". A client who is already signed in should not
// be asked to log in from inside their own manual (owner, 2026-09-11): they
// get "Open dashboard" instead. Rendered as "Log in" on the server and
// swapped once the browser knows the session, so nothing flashes for visitors.
export default function DocsAuthButton({ login, dashboard }) {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let alive = true;
    try {
      createClient().auth.getSession()
        .then(({ data }) => { if (alive && data?.session) setSignedIn(true); })
        .catch(() => {});
    } catch { /* no supabase config in this build — stay a visitor */ }
    return () => { alive = false; };
  }, []);
  return signedIn
    ? <a href="/dashboard" className="navbtn navcta">{dashboard}</a>
    : <a href="/dashboard?auth=signin" className="navbtn navcta">{login}</a>;
}
