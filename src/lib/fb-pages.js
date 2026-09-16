// Every Facebook Page the signed-in person can connect — for the Page picker in
// /api/fb/callback.
//
// The picker used to read ONE call, /me/accounts, and missed Pages two ways
// (owner report 2026-09-17: "it is not showing all the pages"):
//   1. Graph API pages its results (25 per call by default) and the code never
//      followed `paging.next`, so an account with more Pages saw only the first
//      page of them.
//   2. /me/accounts lists only Pages where the person has a role of their own.
//      Pages held in a Business Portfolio (owned, or shared to it as a client)
//      and reached through business access do not appear there; they are read
//      from /{business}/owned_pages and /{business}/client_pages instead
//      (business_management is approved for this app).
// Pages are merged by id. A Page that arrives without an access token is asked
// for one directly (/{page-id}?fields=access_token); if the person has no task
// on it that allows messaging, it still comes back — marked without a token —
// so the picker can show it with a reason instead of silently leaving it out.
//
// `fetchJson(url)` is injected so tests/t-fb-pages.mjs can run this without
// the network. Nothing here throws; a failed call just contributes nothing.

const GRAPH = "https://graph.facebook.com/v24.0";
const MAX_PAGES_OF_RESULTS = 50; // 50 × 100 per call — far beyond any real account

async function collect(fetchJson, firstUrl) {
  const out = [];
  let url = firstUrl;
  for (let i = 0; url && i < MAX_PAGES_OF_RESULTS; i++) {
    const j = await fetchJson(url).catch(() => null);
    if (!j || j.error) break;
    if (Array.isArray(j.data)) out.push(...j.data);
    url = j.paging?.next || null;
  }
  return out;
}

export async function fetchAllPages(userToken, fetchJson) {
  const tok = encodeURIComponent(userToken);
  const byId = new Map();
  const add = (p, source) => {
    if (!p?.id) return;
    const id = String(p.id);
    const prev = byId.get(id);
    byId.set(id, {
      id,
      name: String(p.name || prev?.name || "Untitled Page"),
      access_token: p.access_token || prev?.access_token || "",
      source: prev?.source || source,
    });
  };

  // 1) Pages with a personal role, every page of results.
  for (const p of await collect(fetchJson, `${GRAPH}/me/accounts?fields=id,name,access_token&limit=100&access_token=${tok}`)) add(p, "personal");

  // 2) Pages owned by, or shared with, each Business Portfolio the person is in.
  const businesses = await collect(fetchJson, `${GRAPH}/me/businesses?fields=id,name&limit=100&access_token=${tok}`);
  for (const b of businesses) {
    if (!b?.id) continue;
    for (const edge of ["owned_pages", "client_pages"]) {
      for (const p of await collect(fetchJson, `${GRAPH}/${b.id}/${edge}?fields=id,name,access_token&limit=100&access_token=${tok}`)) add(p, "business");
    }
  }

  // 3) Any Page still without a token: ask for it directly.
  for (const p of byId.values()) {
    if (p.access_token) continue;
    const j = await fetchJson(`${GRAPH}/${p.id}?fields=access_token,name&access_token=${tok}`).catch(() => null);
    if (j?.access_token) p.access_token = j.access_token;
  }

  return Array.from(byId.values()).sort((a, b) =>
    (a.access_token ? 0 : 1) - (b.access_token ? 0 : 1) || a.name.localeCompare(b.name));
}
