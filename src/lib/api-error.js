// Turns any answer from the server into something a shop owner can act on.
//
// Every screen in the dashboard used to do this:
//
//     .then((r) => r.json()).catch(() => ({ error: "the one word" }))
//
// which reads as "the connection failed" and almost never meant that. .json()
// throws whenever the answer is not JSON, and the answers that are not JSON are
// exactly the interesting ones: Vercel's 413 when the photos are too big, a 504
// when a request outran its time, a crash page from the platform. All twenty of
// them arrived as the same word, so "network" meant "something happened and
// nobody wrote down what".
//
// These strings are what a failure looks like to a customer, so they are
// written to the same standard as the rest of the product (lessons.md #4): say
// what went wrong, and say what to do about it. The status number is kept on
// the end — small, but it is the difference between "it broke" and a report
// somebody can act on.

export function httpMessage(status) {
  switch (status) {
    case 401: return "Your session has expired. Please sign in again.";
    case 403: return "You do not have permission to do that.";
    case 404: return "That is no longer there. Refresh the page and try again.";
    case 413: return "Those files are too large to send together. Remove one or two and try again.";
    case 429: return "Too many requests just now. Wait a moment and try again.";
    case 408:
    case 504: return "The server took too long to answer. Please try again.";
    case 502:
    case 503: return "The service is busy right now. Please try again in a moment.";
    default:
      if (status >= 500) return "Something went wrong on our side. Please try again.";
      if (status >= 400) return "That request could not be completed.";
      return "Something went wrong. Please try again.";
  }
}

/**
 * Reads a fetch Response and ALWAYS resolves to a plain object. Our own routes
 * answer JSON whether they succeed or fail, so their wording is passed straight
 * through — a plan-limit message written for the owner must not be replaced by
 * a generic one. Anything that is not JSON came from the platform, and gets a
 * sentence built from the status instead.
 */
export async function readJson(res) {
  // Read as text first. Calling .json() on a 413 throws, and that throw is what
  // used to destroy the status code that explained everything.
  let text = "";
  try { text = await res.text(); } catch {}

  if (text) {
    try {
      const body = JSON.parse(text);
      // Arrays count: /api/products, /api/orders, /api/conversations and five
      // others answer with a bare list, and it has to reach the caller intact.
      if (body && typeof body === "object") {
        if (res.ok || body.error) return body;
        return Array.isArray(body)
          ? { error: `${httpMessage(res.status)} (${res.status})` }
          : { ...body, error: `${httpMessage(res.status)} (${res.status})` };
      }
    } catch {}
  }
  // A 2xx whose body is not JSON still succeeded — an empty 204, or a route
  // that answers with plain text. Calling that an error would invent a failure
  // out of a success, which is the same crime as "network" in the other
  // direction.
  if (res.ok) return { ok: true };
  return { error: `${httpMessage(res.status)} (${res.status})` };
}

/** When fetch itself never got an answer — genuinely offline, or DNS failed. */
export const offlineError = () => ({
  error: "Could not reach the server. Check your internet connection and try again.",
});
