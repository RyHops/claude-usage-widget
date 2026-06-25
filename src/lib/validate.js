/**
 * validate.js — settings validators for the save-settings IPC handler (pure,
 * unit-testable, no Electron deps). Each validator returns the coerced value
 * when valid, or `undefined` so the caller can skip writing the field (this is
 * what makes partial settings saves safe — see main.js save-settings).
 */

const MAX_CSS_LENGTH = 10000;
// Patterns that could exfiltrate data or load remote resources via injected CSS.
const CSS_DANGEROUS_PATTERNS = [/@import/i, /url\s*\(/i, /expression\s*\(/i, /javascript:/i, /-moz-binding/i];

function validateBool(v) {
  return typeof v === 'boolean' ? v : undefined;
}

function validateInt(v, min, max) {
  const n = typeof v === 'number' ? Math.round(v) : parseInt(v, 10);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

function validateEnum(v, allowed) {
  return allowed.includes(v) ? v : undefined;
}

function sanitizeCSS(css) {
  if (typeof css !== 'string' || css.length > MAX_CSS_LENGTH) return '';
  for (const pat of CSS_DANGEROUS_PATTERNS) {
    if (pat.test(css)) return '';
  }
  return css;
}

module.exports = {
  MAX_CSS_LENGTH,
  CSS_DANGEROUS_PATTERNS,
  validateBool,
  validateInt,
  validateEnum,
  sanitizeCSS,
};
