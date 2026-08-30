// Read every row, not the first thousand.
//
// PostgREST caps an unbounded select at `db-max-rows` and says nothing about
// it: the response is a normal 200 with a short array. So a client with more
// contacts than the cap sees a contact list that is simply missing people,
// and there is no error, no flag and no way for the screen to know.
//
// That is the shape of the worst bugs in this codebase — a partial answer
// wearing a complete one's clothes. Anywhere a table can grow with a client's
// traffic (contacts, messages, orders), the read is paged rather than trusted.
//
// The caller hands in a function that takes a row range, because the filters
// differ everywhere this is used and only the paging is the same:
//
//   const rows = await pageAll((from, to) =>
//     supabase.from("contacts").select("*").eq("client_id", id).range(from, to));
//
// Returns { rows, truncated }. `truncated` is true only if the hard ceiling was
// reached — a runaway is stopped rather than paged forever, and the caller is
// told so it can say so instead of quietly showing part of the answer.

// There is a second pageAll in src/app/api/admin/packages/route.js, and it is
// NOT this one duplicated. It returns { rows, truncated, error } instead of
// throwing, because the admin panel wants to draw the partial month AND say the
// read failed, side by side. These callers want the opposite: a client's
// contact list must never render half of itself with no explanation. Same
// paging, deliberately different answer to "what if it fails".

const PAGE = 1000;
const CEILING = 50000;

export async function pageAll(query, { page = PAGE, ceiling = CEILING } = {}) {
  const rows = [];
  for (let from = 0; from < ceiling; from += page) {
    const { data, error } = await query(from, from + page - 1);
    // An error mid-way is not "the end of the rows". Returning what arrived so
    // far would be the same partial-looking-complete answer this exists to
    // prevent, so it is raised.
    if (error) throw new Error(error.message || "read failed");
    const got = data || [];
    rows.push(...got);
    if (got.length < page) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}
