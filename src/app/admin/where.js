"use client";
import { useState, useEffect, useRef } from "react";

// Where the console was, kept in the address bar.
//
// The admin console held its section in plain component state, so every
// refresh threw it back to Overview. That is a small thing until you are
// working — checking a client's cost, changing a limit, reloading to see
// whether it took — and every reload costs two more clicks to get back to
// where you already were.
//
// The address bar is the right place for it rather than localStorage: it
// survives a refresh, it makes the back button work without any extra code,
// and a page reached this way can be sent to another admin as a link.
//
// The shape is "#page/tab" — the section, and the sub-tab inside it for the
// one section that has them.

const clean = (s) => String(s || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 40);

export function parseHash(hash) {
  const [page = "", tab = ""] = String(hash || "").replace(/^#/, "").split("/");
  return { page: clean(page), tab: clean(tab) };
}

export const readWhere = () =>
  (typeof window === "undefined" ? { page: "", tab: "" } : parseHash(window.location.hash));

export const whereHash = (page, tab) => "#" + clean(page) + (tab ? "/" + clean(tab) : "");

// Where the console should actually open, given what the address bar says.
//
// A fragment is typed as easily as it is clicked, so it is a request and not
// an instruction: an unknown page, or one this admin may not see, opens the
// fallback instead. The sub-tab goes with its page — carrying it onto a
// different section would select a tab that section does not have.
export function resolveWhere(hash, fallback, allowed = () => true) {
  const w = parseHash(hash);
  const page = w.page && allowed(w.page) ? w.page : fallback;
  return { page, tab: w.page === page ? w.tab : "" };
}

// Keeps `page`/`tab` and the address bar in step, in both directions.
//
//   allowed(page)  → is this somewhere this admin may actually go? A hash can
//                    be typed by hand, and a page hidden from a non-super
//                    admin must not open because the fragment asked for it.
//
// Returns [page, tab, go]. `go(page, tab)` pushes a history entry, so the
// phone's back gesture retraces the sections visited — the same behaviour the
// customer dashboard has.
export function useWhere(fallback, allowed) {
  const [page, setPage] = useState(fallback);
  const [tab, setTab] = useState("");
  // The effects below run once and must still see the current values; reading
  // them from state would freeze whatever they were on mount.
  const at = useRef({ page: fallback, tab: "" });
  const okRef = useRef(allowed);
  okRef.current = allowed;
  useEffect(() => { at.current = { page, tab }; }, [page, tab]);

  // Read on MOUNT, not in useState: this component is rendered on the server
  // too, and the server cannot see a fragment. Seeding the initial state from
  // it would render one page on the server and another in the browser, which
  // React reports as a hydration mismatch.
  useEffect(() => {
    const at0 = resolveWhere(window.location.hash, fallback, okRef.current);
    setPage(at0.page);
    setTab(at0.tab);
    // Stamped so the first back press has a state to pop to rather than null.
    window.history.replaceState(at0, "", whereHash(at0.page, at0.tab));

    const onPop = (e) => {
      // The pushed state is the reliable answer; the fragment is the fallback
      // for an entry this session did not push — a bookmark, a pasted link.
      const s = e.state && e.state.page
        ? resolveWhere(whereHash(e.state.page, e.state.tab), fallback, okRef.current)
        : resolveWhere(window.location.hash, fallback, okRef.current);
      setPage(s.page);
      setTab(s.tab);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const go = (nextPage, nextTab = "") => {
    const p = clean(nextPage) || fallback;
    const t = clean(nextTab);
    if (p === at.current.page && t === at.current.tab) return;
    setPage(p);
    setTab(t);
    at.current = { page: p, tab: t };
    if (typeof window !== "undefined") {
      window.history.pushState({ page: p, tab: t }, "", whereHash(p, t));
    }
  };

  return [page, tab, go];
}
