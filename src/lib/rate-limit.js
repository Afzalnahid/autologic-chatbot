// A minimal fixed-window rate limiter.
//
// This runs in-process, so on serverless it limits per warm instance rather than
// globally. That is deliberate: it costs nothing, adds no dependency, and still
// stops the realistic abuse case — one client hammering an expensive endpoint in
// a loop. A distributed limiter (Redis/Upstash) is the right upgrade once there
// is real paid traffic.

const buckets = new Map();
const SWEEP_EVERY = 5 * 60 * 1000;
let lastSweep = Date.now();

function sweep(now) {
  if (now - lastSweep < SWEEP_EVERY) return;
  lastSweep = now;
  for (const [key, b] of buckets) {
    if (b.resetAt < now) buckets.delete(key);
  }
}

/**
 * @param {string} key    Caller identity, e.g. `generate-prompt:${clientId}`
 * @param {number} limit  Requests allowed per window
 * @param {number} windowMs
 * @returns {{ok: boolean, remaining: number, retryAfter: number}}
 */
export function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: limit - bucket.count, retryAfter: 0 };
}

// Standard 429 with Retry-After so clients can back off politely.
export function tooManyRequests(retryAfter, message) {
  return new Response(
    JSON.stringify({ error: message || "Too many requests. Please wait a moment and try again." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter || 60),
      },
    }
  );
}
