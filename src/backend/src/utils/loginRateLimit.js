// Per-IP login brute-force protection (spec: "Security"). In-memory is fine
// for this app's single-container deployment — no separate store exists, and
// losing the counters on a restart is an acceptable trade-off.
const MAX_FAILED_ATTEMPTS = 10;
const BLOCK_DURATION_MS = 10 * 60 * 1000;
// Entries for an IP that never got blocked and hasn't been seen again are
// dropped after this long, so a long-running process doesn't accumulate one
// entry per distinct IP that ever mistyped a password.
const ENTRY_TTL_MS = 60 * 60 * 1000;

const attemptsByIp = new Map();

function sweepStaleEntries() {
  const now = Date.now();
  for (const [ip, entry] of attemptsByIp) {
    const stillBlocked = entry.blockedUntil && entry.blockedUntil > now;
    if (!stillBlocked && now - entry.lastAttempt > ENTRY_TTL_MS) {
      attemptsByIp.delete(ip);
    }
  }
}

setInterval(sweepStaleEntries, ENTRY_TTL_MS).unref();

// Extracts the caller's real IP. Behind the Cloudflare Tunnel used in
// production, `cloudflared` sets `Cf-Connecting-Ip` to the actual visitor
// IP as seen at Cloudflare's edge — more reliable than `req.ip`, which would
// otherwise resolve to the tunnel daemon's own docker-network address.
export function getClientIp(req) {
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp) return cfIp;
  return req.ip;
}

// Returns how many seconds the given IP is still blocked for, or 0 if it
// isn't blocked.
export function getBlockedRetryAfterSeconds(ip) {
  const entry = attemptsByIp.get(ip);
  if (!entry || !entry.blockedUntil) return 0;
  const remainingMs = entry.blockedUntil - Date.now();
  if (remainingMs <= 0) {
    attemptsByIp.delete(ip);
    return 0;
  }
  return Math.ceil(remainingMs / 1000);
}

export function recordFailedLogin(ip) {
  const entry = attemptsByIp.get(ip) || { count: 0, blockedUntil: null, lastAttempt: 0 };
  entry.count += 1;
  entry.lastAttempt = Date.now();
  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    entry.blockedUntil = Date.now() + BLOCK_DURATION_MS;
  }
  attemptsByIp.set(ip, entry);
}

export function recordSuccessfulLogin(ip) {
  attemptsByIp.delete(ip);
}
