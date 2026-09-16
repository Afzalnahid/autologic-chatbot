// The Facebook Page picker must list EVERY Page the person can connect: all
// result pages of /me/accounts, plus Pages reached through a Business
// Portfolio — merged, never duplicated, and a Page without a token still shown.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const { fetchAllPages } = await import(pathToFileURL(join(here, "..", "src", "lib", "fb-pages.js")).href);

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

// A fake Graph API keyed by path (query ignored except the `after` cursor).
function graph(routes) {
  const calls = [];
  const fetchJson = async (url) => {
    calls.push(url);
    const u = new URL(url);
    const key = u.pathname.replace("/v24.0", "") + (u.searchParams.get("after") ? `#${u.searchParams.get("after")}` : "");
    const r = routes[key];
    if (r instanceof Error) throw r;
    return r ?? { error: { message: "not found" } };
  };
  return { fetchJson, calls };
}
const next = (path, after) => `https://graph.facebook.com/v24.0${path}?after=${after}`;
const pages = (from, to, tok = true) => Array.from({ length: to - from + 1 }, (_, i) => ({ id: String(from + i), name: `Page ${from + i}`, ...(tok ? { access_token: `t${from + i}` } : {}) }));

// 1) More Pages than one call returns: every result page is followed.
{
  const { fetchJson } = graph({
    "/me/accounts": { data: pages(1, 25), paging: { next: next("/me/accounts", "A") } },
    "/me/accounts#A": { data: pages(26, 50), paging: { next: next("/me/accounts", "B") } },
    "/me/accounts#B": { data: pages(51, 53) },
    "/me/businesses": { data: [] },
  });
  const list = await fetchAllPages("u", fetchJson);
  ok("53 Pages across three result pages all appear", list.length === 53);
  ok("each keeps its token", list.every((p) => p.access_token === `t${p.id}`));
}

// 2) Business Portfolio Pages are added and de-duplicated with personal ones.
{
  const { fetchJson } = graph({
    "/me/accounts": { data: [{ id: "1", name: "Shop", access_token: "t1" }] },
    "/me/businesses": { data: [{ id: "B1" }, { id: "B2" }] },
    "/B1/owned_pages": { data: [{ id: "1", name: "Shop" }, { id: "2", name: "Agency", access_token: "t2" }] },
    "/B1/client_pages": { data: [{ id: "3", name: "Client Page", access_token: "t3" }] },
    "/B2/owned_pages": { data: [{ id: "2", name: "Agency" }] },
    "/B2/client_pages": { data: [] },
  });
  const list = await fetchAllPages("u", fetchJson);
  ok("personal + owned + client Pages merged to 3, no duplicates", list.length === 3 && new Set(list.map((p) => p.id)).size === 3);
  ok("a duplicate without a token does not wipe the token already found", list.find((p) => p.id === "1")?.access_token === "t1");
  ok("client Page from the portfolio is listed", list.some((p) => p.id === "3" && p.access_token === "t3"));
}

// 3) A Page with no token is asked for one; if none, it is kept (marked) not dropped.
{
  const { fetchJson, calls } = graph({
    "/me/accounts": { data: [] },
    "/me/businesses": { data: [{ id: "B1" }] },
    "/B1/owned_pages": { data: [{ id: "7", name: "Zeta" }, { id: "8", name: "Alpha" }] },
    "/B1/client_pages": { data: [] },
    "/7": { access_token: "t7", id: "7" },
    "/8": { error: { message: "no task" } },
  });
  const list = await fetchAllPages("u", fetchJson);
  ok("token fetched directly for a Page that came without one", list.find((p) => p.id === "7")?.access_token === "t7");
  ok("a Page with no obtainable token is still listed", list.some((p) => p.id === "8" && !p.access_token));
  ok("connectable Pages sort before unconnectable ones", list[0].id === "7" && list[1].id === "8");
  ok("the direct token lookup happened", calls.some((c) => c.includes("/v24.0/8?")));
}

// 4) Failures never throw and never lose what was already found.
{
  const { fetchJson } = graph({
    "/me/accounts": { data: [{ id: "1", name: "Shop", access_token: "t1" }], paging: { next: next("/me/accounts", "X") } },
    "/me/accounts#X": new Error("network down"),
    "/me/businesses": { error: { message: "permission missing" } },
  });
  let list, threw = false;
  try { list = await fetchAllPages("u", fetchJson); } catch { threw = true; }
  ok("a network error mid-way does not throw", !threw);
  ok("Pages read before the error are kept", list?.length === 1 && list[0].id === "1");
}

// 5) Nothing at all → empty list (the callback shows "no Page found").
{
  const { fetchJson } = graph({ "/me/accounts": { data: [] }, "/me/businesses": { data: [] } });
  ok("no Pages → []", (await fetchAllPages("u", fetchJson)).length === 0);
}

// 6) A runaway paging loop stops.
{
  const loop = { data: [{ id: "1", name: "Shop", access_token: "t1" }], paging: { next: next("/me/accounts", "L") } };
  const { fetchJson, calls } = graph({ "/me/accounts": loop, "/me/accounts#L": loop, "/me/businesses": { data: [] } });
  const list = await fetchAllPages("u", fetchJson);
  ok("an endless next-link is capped", calls.length < 60 && list.length === 1);
}

console.log(fail === 0 ? `${pass} passed, 0 failed` : `${pass} passed, ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
