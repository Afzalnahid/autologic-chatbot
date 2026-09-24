// What the platform owner is told, and how loudly.
//
// Owner, 2026-09-24: "From the admin panel I don't get any notifications when
// any customer enters, or any error occurs, or something happens — it is bad
// for me."
//
// Before this there were two emails in the whole product — a payment request
// and a new admin signing up. A business could register, a bot could stop
// replying, an AI key could die and a channel could fall off, and the console
// said nothing at all.
//
// The rule for what belongs here is the same one the client's own alerts
// follow: an event earns a line only if the owner could DO something about it,
// or if it is money. An alert for something nobody can act on teaches people to
// ignore all of them, and then the urgent ones are lost too.
//
// EVENTS is pure and tested in tests/t-platform-events.mjs; `logEvent` below is
// the database.
import { supabase } from "@/lib/supabase.js";

export const SEVERITIES = ["info", "warn", "urgent"];

/**
 * Every kind of event, with how loudly it is announced.
 *
 *   bell   — always; that is what the console's bell is for.
 *   push   — also to the owner's phone.
 *   email  — also by email, for the ones that must not be missed.
 */
export const EVENTS = {
  // ── money and growth ────────────────────────────────────────────────────
  client_signup:    { severity: "info",   push: true,  email: false, icon: "🎉", label: "A new business signed up" },
  trial_started:    { severity: "info",   push: false, email: false, icon: "🌱", label: "A trial started" },
  payment_request:  { severity: "urgent", push: true,  email: true,  icon: "💰", label: "A payment is waiting for your decision" },
  plan_activated:   { severity: "info",   push: true,  email: false, icon: "✅", label: "A plan was activated" },
  // A paying client going quiet is the one worth a phone call.
  plan_expired:     { severity: "warn",   push: true,  email: false, icon: "⏳", label: "A plan expired" },

  // ── something is broken for a client ────────────────────────────────────
  bot_blocked:      { severity: "warn",   push: true,  email: false, icon: "🤖", label: "A bot stopped replying" },
  key_failing:      { severity: "warn",   push: true,  email: false, icon: "🔑", label: "A client's AI key stopped working" },
  channel_expired:  { severity: "warn",   push: true,  email: false, icon: "🔌", label: "A channel needs reconnecting" },

  // ── the platform itself ─────────────────────────────────────────────────
  // Errors are rate-limited before they get here (see logEvent): a route that
  // fails a thousand times in a minute must not write a thousand rows and send
  // a thousand buzzes, or the bell becomes the thing you turn off.
  server_error:     { severity: "urgent", push: true,  email: false, icon: "🔥", label: "A server error" },
  admin_signup:     { severity: "warn",   push: true,  email: true,  icon: "🛡️", label: "Someone asked for admin access" },
  provider_switched:{ severity: "warn",   push: true,  email: false, icon: "🔀", label: "The platform's AI provider changed" },
  client_deleted:   { severity: "warn",   push: false, email: false, icon: "🗑️", label: "A business was deleted" },
};

export const EVENT_KINDS = Object.keys(EVENTS);

/** A kind we recognise, or null. Never guesses. */
export function normaliseKind(k) {
  const s = String(k || "").trim();
  return EVENT_KINDS.includes(s) ? s : null;
}

/** How an unknown kind is treated, so a typo is visible rather than silent. */
export const UNKNOWN_EVENT = { severity: "info", push: false, email: false, icon: "•", label: "Something happened" };

export function eventMeta(kind) {
  return EVENTS[normaliseKind(kind)] || UNKNOWN_EVENT;
}

/** The three groups the bell shows, newest first within each. */
export function groupEvents(rows) {
  const out = { urgent: [], warn: [], info: [] };
  for (const r of rows || []) {
    const sev = SEVERITIES.includes(r?.severity) ? r.severity : "info";
    out[sev].push(r);
  }
  return out;
}

/** How many of these has this admin not seen? */
export function unreadCount(rows, readIds) {
  const seen = new Set(readIds || []);
  return (rows || []).filter((r) => r && !seen.has(r.id)).length;
}

// Repeats of the same thing inside this window collapse into one row. A route
// that starts failing fails a lot, and the point of the bell is that it stays
// worth looking at.
const QUIET_MS = { server_error: 10 * 60 * 1000, bot_blocked: 60 * 60 * 1000, key_failing: 60 * 60 * 1000, channel_expired: 60 * 60 * 1000 };

/** Should this be written, given when the same thing was last written? */
export function shouldLog(kind, lastAt, now = Date.now()) {
  const quiet = QUIET_MS[normaliseKind(kind)];
  if (!quiet || !lastAt) return true;
  return now - new Date(lastAt).getTime() >= quiet;
}

/**
 * Record something the platform owner should know. Never throws and never
 * blocks the thing that called it — a customer's reply must not wait on a
 * notification, and a failure to notify must not become a second failure.
 */
export async function logEvent({ kind, title, body, clientId, clientName, url, severity }) {
  try {
    const k = normaliseKind(kind);
    if (!k) { console.error("[platform-events] unknown kind:", kind); return null; }
    const meta = EVENTS[k];

    // Collapse a storm into one line.
    if (QUIET_MS[k]) {
      let q = supabase.from("platform_events").select("created_at").eq("kind", k).order("created_at", { ascending: false }).limit(1);
      if (clientId) q = q.eq("client_id", clientId);
      const { data: last } = await q;
      if (!shouldLog(k, last?.[0]?.created_at)) return null;
    }

    const row = {
      kind: k,
      severity: severity || meta.severity,
      title: String(title || meta.label).slice(0, 200),
      body: body ? String(body).slice(0, 500) : null,
      client_id: clientId || null,
      client_name: clientName ? String(clientName).slice(0, 120) : null,
      url: url ? String(url).slice(0, 300) : null,
    };
    const { data, error } = await supabase.from("platform_events").insert(row).select("id").single();
    if (error) { console.error("[platform-events] insert:", error.message); return null; }

    if (meta.push) pushToAdmins(meta, row).catch(() => {});
    if (meta.email) emailAdmins(meta, row).catch(() => {});
    return data?.id || null;
  } catch (e) {
    console.error("[platform-events]", String(e?.message || e).slice(0, 160));
    return null;
  }
}

// Who runs the platform. Pending and blocked admins are not told anything.
async function adminEmails() {
  const { data: admins } = await supabase.from("admin_users").select("email,role");
  return (admins || [])
    .filter((a) => a.role && a.role !== "pending" && a.role !== "blocked")
    .map((a) => String(a.email || "").trim().toLowerCase())
    .filter(Boolean);
}

// Platform alerts go to the ADMIN app and the admin console's browsers, never
// to the user app.
//
// This used to address an admin by their own CLIENT id, because an admin
// usually also runs a business here. The result was that a new signup or a
// server error arrived in the same app as that business's customer messages,
// and tapping it opened /admin inside the user app — the owner's words on
// 2026-09-24: "my native app which is for users automatically converted to
// admin app". Admin devices now have their own table, keyed by email, so the
// two audiences cannot reach each other's devices at all.
async function pushToAdmins(meta, row) {
  const { notifyAdmin } = await import("@/lib/admin-push.js");
  const emails = await adminEmails();
  const title = `${meta.icon} ${row.title}`;
  const body = row.client_name ? `${row.client_name}${row.body ? " — " + row.body : ""}` : (row.body || "");
  for (const email of emails) {
    // tag by kind so a second event of the same kind replaces the first on the
    // phone instead of stacking, exactly as the customer alerts do.
    notifyAdmin(email, { title, body, url: "/admin", tag: "admin-" + row.kind }).catch(() => {});
  }
}

async function emailAdmins(meta, row) {
  const { notifyPlatformEvent } = await import("@/lib/email.js");
  const list = String(process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!list.length) return;
  for (const to of list) await notifyPlatformEvent(to, { ...row, icon: meta.icon, label: meta.label });
}
