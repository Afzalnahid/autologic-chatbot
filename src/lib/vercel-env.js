// Optional mirror of the platform AI key into the Vercel environment variable,
// so the key you set in the admin panel also shows up in Vercel → Settings →
// Environment Variables.
//
// This is OPT-IN and safe by default: with no VERCEL_TOKEN configured it does
// nothing and returns a clear reason, so the app behaves exactly as before.
//
// Two honest limits, surfaced to the caller so the UI can say them plainly:
//   1. Changing an env var does NOT take effect on the running app until the
//      next deploy — which is the whole reason the key is ALSO stored in the
//      database (that one is live within a minute). Vercel env is a synced copy,
//      not the live source.
//   2. A Vercel API token grants broad account access, so it is read only from
//      an env var and never logged.

const API = "https://api.vercel.com";
// Project and team are known constants for this deployment; still overridable by
// env for safety and for anyone forking the project.
const PROJECT = process.env.VERCEL_PROJECT_ID || "prj_xGVnXbbzOPPDiqqwLGjnnwMJzv3V";
const TEAM = process.env.VERCEL_TEAM_ID || "team_EH2oK3NTVjHRAqGHvohVbxAa";
const KEY_NAME = "GEMINI_API_KEY";

function token() {
  return process.env.VERCEL_TOKEN || process.env.VERCEL_API_TOKEN || "";
}

export function vercelSyncConfigured() {
  return !!token();
}

async function vfetch(path, init = {}) {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${API}${path}${sep}teamId=${encodeURIComponent(TEAM)}`;
  const r = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const body = await r.text().catch(() => "");
  let json = null;
  try { json = body ? JSON.parse(body) : null; } catch {}
  return { ok: r.ok, status: r.status, json, body };
}

// Create the env var if missing, update it if present. Applies to all three
// targets so production, preview and local pulls agree.
export async function syncPlatformKeyToVercel(value) {
  if (!token()) return { ok: false, skipped: true, reason: "No VERCEL_TOKEN set — env sync is off." };
  if (!value) return { ok: false, reason: "No key value to sync." };
  try {
    const list = await vfetch(`/v9/projects/${PROJECT}/env`);
    if (!list.ok) return { ok: false, reason: `Vercel list failed (HTTP ${list.status}). Check the token.` };
    const existing = (list.json?.envs || list.json?.env || []).find((e) => e.key === KEY_NAME);
    const target = ["production", "preview", "development"];

    if (existing?.id) {
      const up = await vfetch(`/v9/projects/${PROJECT}/env/${existing.id}`, {
        method: "PATCH", body: JSON.stringify({ value, target }),
      });
      if (!up.ok) return { ok: false, reason: `Vercel update failed (HTTP ${up.status}).` };
    } else {
      const cr = await vfetch(`/v10/projects/${PROJECT}/env`, {
        method: "POST", body: JSON.stringify({ key: KEY_NAME, value, type: "encrypted", target }),
      });
      if (!cr.ok) return { ok: false, reason: `Vercel create failed (HTTP ${cr.status}).` };
    }
    // Env changes only reach the running app after a new deployment.
    return { ok: true, redeployNeeded: true };
  } catch (e) {
    return { ok: false, reason: String(e?.message || e).slice(0, 160) };
  }
}
