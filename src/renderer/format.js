'use strict';
/**
 * format.js — pure formatting/trend helpers shared by the renderer and tests.
 *
 * Lives in src/renderer/ (NOT src/lib/) on purpose: it's the only shared module
 * loaded by the renderer via a <script> tag, and the pages set `script-src
 * 'self'`. Over the file:// scheme, 'self' is directory-scoped, so the script
 * MUST sit beside index.html / tray-popup.html to load. (errors.js / validate.js
 * stay in src/lib/ — they're required by the main process, not CSP-constrained.)
 *
 * UMD-style: exported as CommonJS (`module.exports`) for `node:test`, and as a
 * NAMED global `window.ClaudeUsageFormat` for the renderer. Loaded BEFORE
 * app.js / tray-popup.js.
 */
(function () {
  // Human-readable remaining time from a millisecond delta: "2d 3h", "4h 9m",
  // "12m", or "0m" when already elapsed.
  function formatDuration(ms) {
    if (ms <= 0) return '0m';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h >= 24) {
      const d = Math.floor(h / 24);
      return d + 'd ' + (h % 24) + 'h';
    }
    if (h > 0) return h + 'h ' + m + 'm';
    return m + 'm';
  }

  // Remaining-time string until an ISO `resetsAt`. `now` is injectable for tests
  // (defaults to Date.now()). Returns '--:--' when there's no reset timestamp.
  function formatTime(resetsAt, now) {
    if (!resetsAt) return '--:--';
    const reference = typeof now === 'number' ? now : Date.now();
    return formatDuration(new Date(resetsAt).getTime() - reference);
  }

  // Trend over the last up-to-6 points: 'up' / 'down' / 'flat' (±3% deadband).
  function calculateTrend(dataPoints) {
    if (!dataPoints || dataPoints.length < 3) return 'flat';
    const recent = dataPoints.slice(-6);
    const first = recent[0];
    const last = recent[recent.length - 1];
    const diff = last - first;
    if (diff > 3) return 'up';
    if (diff < -3) return 'down';
    return 'flat';
  }

  // Usage velocity (%/hr) from a list of {timestamp, session, weekly} points.
  // Returns null when there's too little data or too small a time span. Callers
  // do the time-window filtering (Date.now()-based) before calling this.
  function computeVelocity(points) {
    if (!Array.isArray(points) || points.length < 2) return null;
    const first = points[0];
    const last = points[points.length - 1];
    const hours = (last.timestamp - first.timestamp) / 3600000;
    if (hours < 0.01) return null;
    return {
      session: (last.session - first.session) / hours,
      weekly: (last.weekly - first.weekly) / hours,
    };
  }

  const api = { formatDuration, formatTime, calculateTrend, computeVelocity };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.ClaudeUsageFormat = api;
})();
