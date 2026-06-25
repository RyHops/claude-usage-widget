/**
 * fetch-via-window.js
 *
 * Fetches JSON from a URL using a hidden BrowserWindow.
 *
 * Why this exists:
 * Claude.ai uses Cloudflare protection and detects Electron's default
 * request headers, blocking standard Node.js fetch/http requests.
 * By loading the URL in a hidden BrowserWindow with a spoofed Chrome
 * User-Agent, we ride on the browser session cookies and bypass
 * Cloudflare's bot detection. This is the simplest reliable approach
 * after the previous cookie-database-reading strategy proved too
 * fragile and OS-specific.
 *
 * Security:
 * - Only allows requests to https://claude.ai/api/
 * - Uses an isolated session partition (passed by caller)
 * - Verifies final URL before extracting content
 * - Navigation guards prevent redirects to untrusted origins
 * - Sandbox enabled for defense-in-depth
 */
const { BrowserWindow } = require('electron');

/**
 * Known error signatures returned when Claude.ai blocks or changes behaviour.
 * If the extracted body matches one of these patterns we throw a specific error
 * so callers can react (e.g. prompt re-login).
 */
// Order matters: SPECIFIC Cloudflare signatures first (these are destructive →
// force re-login, since the hidden window can't solve a CAPTCHA), then the
// generic `<html` catch-all LAST. Generic HTML (captive portal, ISP block, 5xx
// proxy page) maps to UnexpectedHTML, which the error taxonomy treats as a
// NON-destructive 'unknown' so it never wipes a valid session.
const BLOCKED_SIGNATURES = [
  { pattern: 'Just a moment', error: 'CloudflareBlocked' },
  { pattern: 'Enable JavaScript and cookies to continue', error: 'CloudflareChallenge' },
  { pattern: 'Attention Required! | Cloudflare', error: 'CloudflareChallenge' },
  { pattern: 'cf-chl-', error: 'CloudflareChallenge' },
  { pattern: 'challenge-platform', error: 'CloudflareChallenge' },
  { pattern: 'cf-mitigated', error: 'CloudflareChallenge' },
  { pattern: 'Cloudflare Ray ID', error: 'CloudflareChallenge' },
  { pattern: '<html', error: 'UnexpectedHTML' },
];

/**
 * Screen a response body for Cloudflare/HTML block signatures, then JSON.parse.
 * Throws a prefixed Error (CloudflareBlocked/Challenge, UnexpectedHTML, InvalidJSON)
 * that the error taxonomy (src/lib/errors.js) can classify. Pure.
 */
function screenAndParse(bodyText) {
  const text = typeof bodyText === 'string' ? bodyText : String(bodyText ?? '');
  for (const sig of BLOCKED_SIGNATURES) {
    if (text.includes(sig.pattern)) {
      throw new Error(`${sig.error}: ${text.substring(0, 200)}`);
    }
  }
  try {
    return JSON.parse(text);
  } catch (parseErr) {
    throw new Error('InvalidJSON: ' + text.substring(0, 200));
  }
}

// Guard: every fetched URL must target the Claude API (prevents cookie leakage).
function assertClaudeApiUrl(url) {
  if (typeof url !== 'string' || !url.startsWith('https://claude.ai/api/')) {
    throw new Error(`Blocked: URL must start with https://claude.ai/api/, got: ${url}`);
  }
}

function fetchViaWindow(url, { timeoutMs = 30000, partition = null } = {}) {
  // Only allow requests to the Claude.ai API to prevent session cookie leakage
  try {
    assertClaudeApiUrl(url);
  } catch (err) {
    return Promise.reject(err);
  }

  return new Promise((resolve, reject) => {
    const webPrefs = {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    };
    if (partition) webPrefs.partition = partition;

    const win = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      webPreferences: webPrefs
    });

    // Single-settlement guard: timeout, did-fail-load, did-finish-load, the
    // executeJavaScript path, and loadURL rejection can all race. `done()`
    // ensures we resolve/reject exactly once, clear the timer once, and close
    // the window once (never after it's already destroyed).
    let settled = false;
    let timeout = null;
    const done = (err, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (!win.isDestroyed()) win.close();
      if (err) reject(err); else resolve(value);
    };

    // Navigation guards — prevent redirects away from Claude.ai
    win.webContents.on('will-navigate', (event, navUrl) => {
      if (!navUrl.startsWith('https://claude.ai/')) {
        event.preventDefault();
      }
    });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    timeout = setTimeout(() => done(new Error('Request timeout')), timeoutMs);

    win.webContents.on('did-finish-load', async () => {
      if (settled) return;
      try {
        // Verify final URL is still on claude.ai before extracting content
        const finalUrl = win.webContents.getURL();
        if (!finalUrl.startsWith('https://claude.ai/')) {
          done(new Error(`UnexpectedRedirect: navigated to ${finalUrl}`));
          return;
        }

        const bodyText = await win.webContents.executeJavaScript(
          'document.body.innerText || document.body.textContent'
        );
        if (settled) return; // window may have closed during executeJavaScript

        // Screen for Cloudflare/HTML signatures, then parse (throws on block).
        try {
          done(null, screenAndParse(bodyText));
        } catch (parseErr) {
          done(parseErr);
        }
      } catch (err) {
        done(err);
      }
    });

    win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      // Ignore subframe failures (e.g. a Cloudflare challenge iframe) — only the
      // main document load failing should fail the request.
      if (isMainFrame === false) return;
      done(new Error(`LoadFailed: ${errorCode} ${errorDescription}`));
    });

    // loadURL rejects on aborted/failed navigation — funnel it through done()
    // too (guarded, so a late rejection after success is ignored).
    win.loadURL(url).catch((err) => {
      done(new Error(`LoadFailed: ${err && err.message ? err.message : String(err)}`));
    });
  });
}

/**
 * Fetch several Claude API JSON endpoints using a SINGLE hidden window.
 *
 * `urls[0]` is mandatory: the window navigates to it (a JSON document on the
 * claude.ai origin), which clears Cloudflare and establishes cf_clearance in
 * that browsing context. `urls[1..]` are optional: fetched via same-origin
 * in-page `fetch()` from inside that already-cleared context, so they ride the
 * full cookie jar + clearance without spawning extra windows.
 *
 * Resolves (never rejects) with settled-style results in the SAME ORDER as
 * `urls`, so callers keep Promise.allSettled-shaped merge logic:
 *   [{ status:'fulfilled', value } | { status:'rejected', reason: Error }, ...]
 * If the mandatory navigation/parse fails, EVERY entry rejects with that error
 * (so the caller classifies it and may force re-login).
 */
function fetchManyViaWindow(urls, { timeoutMs = 30000, partition = null } = {}) {
  if (!Array.isArray(urls) || urls.length === 0) {
    return Promise.reject(new Error('fetchManyViaWindow: urls must be a non-empty array'));
  }
  try {
    urls.forEach(assertClaudeApiUrl);
  } catch (err) {
    return Promise.reject(err);
  }

  const [primaryUrl, ...restUrls] = urls;

  return new Promise((resolve) => {
    const webPrefs = { nodeIntegration: false, contextIsolation: true, sandbox: true };
    if (partition) webPrefs.partition = partition;
    const win = new BrowserWindow({ width: 800, height: 600, show: false, webPreferences: webPrefs });

    let settled = false;
    let timeout = null;

    const finishAll = (results) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (!win.isDestroyed()) win.close();
      resolve(results);
    };
    // Mandatory failure → reject every entry with the same error.
    const rejectAll = (err) => finishAll(urls.map(() => ({ status: 'rejected', reason: err })));

    win.webContents.on('will-navigate', (event, navUrl) => {
      if (!navUrl.startsWith('https://claude.ai/')) event.preventDefault();
    });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    timeout = setTimeout(() => rejectAll(new Error('Request timeout')), timeoutMs);

    win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (isMainFrame === false) return; // ignore subframe failures
      rejectAll(new Error(`LoadFailed: ${errorCode} ${errorDescription}`));
    });

    win.webContents.on('did-finish-load', async () => {
      if (settled) return;
      try {
        const finalUrl = win.webContents.getURL();
        if (!finalUrl.startsWith('https://claude.ai/')) {
          rejectAll(new Error(`UnexpectedRedirect: navigated to ${finalUrl}`));
          return;
        }

        // 1) Mandatory result from the rendered document body.
        const primaryBody = await win.webContents.executeJavaScript(
          'document.body.innerText || document.body.textContent'
        );
        if (settled) return;
        let primaryResult;
        try {
          primaryResult = { status: 'fulfilled', value: screenAndParse(primaryBody) };
        } catch (e) {
          rejectAll(e); // cloudflare/invalid on mandatory → whole batch rejects
          return;
        }

        // 2) Optional results via same-origin in-page fetch (rides cookies + cf_clearance).
        const restResults = [];
        if (restUrls.length > 0) {
          const script = `Promise.all(${JSON.stringify(restUrls)}.map(function (u) {
            return fetch(u, { credentials: 'include', cache: 'no-store' })
              .then(function (r) { return r.text().then(function (t) { return { status: r.status, body: t }; }); })
              .catch(function (e) { return { fetchError: String(e) }; });
          }))`;
          let raw;
          try {
            raw = await win.webContents.executeJavaScript(script);
          } catch (e) {
            raw = restUrls.map(() => ({ fetchError: String(e) }));
          }
          if (settled) return;
          // Defend the shape: a non-array or wrong-length result must NOT turn a
          // successful mandatory fetch into a total batch failure, nor leave the
          // caller with fewer results than urls (→ undefined.status downstream).
          if (!Array.isArray(raw) || raw.length !== restUrls.length) {
            raw = restUrls.map(() => ({ fetchError: 'in-page fetch returned unexpected shape' }));
          }
          for (const item of raw) {
            if (item && item.fetchError) {
              restResults.push({ status: 'rejected', reason: new Error(`LoadFailed: ${item.fetchError}`) });
              continue;
            }
            if (item && (item.status === 401 || item.status === 403)) {
              restResults.push({ status: 'rejected', reason: new Error(`SessionExpired: HTTP ${item.status}`) });
              continue;
            }
            try {
              restResults.push({ status: 'fulfilled', value: screenAndParse(item.body) });
            } catch (e) {
              restResults.push({ status: 'rejected', reason: e });
            }
          }
        }

        finishAll([primaryResult, ...restResults]);
      } catch (err) {
        rejectAll(err);
      }
    });

    win.loadURL(primaryUrl).catch((err) => {
      rejectAll(new Error(`LoadFailed: ${err && err.message ? err.message : String(err)}`));
    });
  });
}

module.exports = { fetchViaWindow, fetchManyViaWindow, screenAndParse, assertClaudeApiUrl, BLOCKED_SIGNATURES };
