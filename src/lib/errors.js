/**
 * errors.js — fetch error taxonomy (pure, unit-testable, no Electron deps).
 *
 * The widget must distinguish three outcomes when a usage fetch fails:
 *   - 'auth'       → session is invalid; clear credentials and prompt re-login.
 *   - 'cloudflare' → Cloudflare challenge; the hidden fetch window CANNOT solve
 *                    a CAPTCHA, so the only recovery is a visible login window.
 *                    Treated like 'auth' at the top level (force re-login).
 *   - 'network'    → transient connectivity (offline, DNS, timeout, load fail).
 *                    NON-destructive: keep the last known data, retry later.
 *   - 'unknown'    → anything we can't confidently place. NON-destructive.
 *
 * The historical bug this fixes: a captured DNS/ISP error page matched the HTML
 * block signature and silently logged the user out. Only 'auth'/'cloudflare'
 * may clear credentials now.
 */

// Error-message prefixes thrown across the fetch layer.
const ERROR_PREFIXES = {
  CLOUDFLARE_BLOCKED: 'CloudflareBlocked',
  CLOUDFLARE_CHALLENGE: 'CloudflareChallenge',
  UNEXPECTED_HTML: 'UnexpectedHTML',
  INVALID_JSON: 'InvalidJSON',
  LOAD_FAILED: 'LoadFailed',
  TIMEOUT: 'Request timeout',
  UNEXPECTED_REDIRECT: 'UnexpectedRedirect',
  SESSION_EXPIRED: 'SessionExpired',
  UNEXPECTED_RESPONSE: 'UnexpectedResponse',
};

// Only the SPECIFIC Cloudflare prefixes are destructive. Generic `UnexpectedHTML`
// is deliberately NOT here: a captive portal, ISP block, or 5xx proxy page is
// also HTML, and must not wipe a valid session. It falls through to 'unknown'
// (non-destructive). Real Cloudflare pages are caught by the specific signatures
// in fetch-via-window.js's BLOCKED_SIGNATURES (CloudflareBlocked/Challenge).
const CLOUDFLARE_SIGNATURES = [
  ERROR_PREFIXES.CLOUDFLARE_BLOCKED,
  ERROR_PREFIXES.CLOUDFLARE_CHALLENGE,
];

// Substrings that indicate a Chromium/Node network-layer failure.
const NETWORK_SIGNATURES = [
  ERROR_PREFIXES.LOAD_FAILED,
  ERROR_PREFIXES.TIMEOUT,
  'net::ERR',
  'ERR_',
  'ENOTFOUND',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'getaddrinfo',
  'ERR_INTERNET_DISCONNECTED',
  'ERR_NAME_NOT_RESOLVED',
  'ERR_NETWORK_CHANGED',
  'Failed to fetch',
  'NetworkOffline',
  'offline',
];

// Substrings that indicate an authentication/authorization failure.
const AUTH_SIGNATURES = [
  ERROR_PREFIXES.SESSION_EXPIRED,
  'Unauthorized',
  'Forbidden',
  'HTTP 401',
  'HTTP 403',
];

function toMessage(err) {
  if (err == null) return '';
  if (typeof err === 'string') return err;
  if (typeof err.message === 'string') return err.message;
  return String(err);
}

function matchesAny(message, signatures) {
  return signatures.some((sig) => message.includes(sig));
}

/**
 * Classify a fetch error into one of: 'auth' | 'cloudflare' | 'network' | 'unknown'.
 * Cloudflare is checked before network/auth because its pages can masquerade as
 * HTML/redirects. Auth is checked before the generic network bucket.
 */
function classifyFetchError(err) {
  const message = toMessage(err);
  if (!message) return 'unknown';

  if (matchesAny(message, CLOUDFLARE_SIGNATURES)) return 'cloudflare';
  if (matchesAny(message, AUTH_SIGNATURES)) return 'auth';
  if (matchesAny(message, NETWORK_SIGNATURES)) return 'network';
  return 'unknown';
}

/** True when an error classification should clear credentials + force re-login. */
function isDestructive(classification) {
  return classification === 'auth' || classification === 'cloudflare';
}

/**
 * Validate the mandatory usage response shape. A `{ error: ... }` body or a
 * non-object returned with HTTP 200 must NOT be rendered as a (false) "no usage"
 * state — callers should classify and surface it instead.
 */
function isUsageWindow(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isValidUsageShape(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  if ('error' in data) return false;
  // At least one recognized usage window must be a real (non-null) object.
  return isUsageWindow(data.five_hour) || isUsageWindow(data.seven_day);
}

/**
 * Given a parsed body that failed isValidUsageShape, decide whether it looks
 * like an auth failure (→ force re-login) versus an unexpected/transient
 * response (→ keep cached data). Conservative: only auth-signalled bodies
 * trigger logout.
 */
function looksLikeAuthErrorBody(data) {
  if (!data || typeof data !== 'object') return false;
  // Inspect common error shapes: { error }, { detail }, { message }, or the
  // whole body. Only reached when isValidUsageShape() already returned false.
  const src = data.error ?? data.detail ?? data.message ?? data;
  const text = (typeof src === 'string' ? src : JSON.stringify(src)).toLowerCase();
  return (
    text.includes('unauth') ||
    text.includes('forbidden') ||
    text.includes('permission') ||
    text.includes('not_authenticated') ||
    text.includes('invalid_session') ||
    text.includes('authentication credentials') ||
    text.includes('401') ||
    text.includes('403')
  );
}

module.exports = {
  ERROR_PREFIXES,
  CLOUDFLARE_SIGNATURES,
  classifyFetchError,
  isDestructive,
  isValidUsageShape,
  looksLikeAuthErrorBody,
};
