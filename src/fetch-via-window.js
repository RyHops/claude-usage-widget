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
const BLOCKED_SIGNATURES = [
  { pattern: 'Just a moment', error: 'CloudflareBlocked' },
  { pattern: 'Enable JavaScript and cookies to continue', error: 'CloudflareChallenge' },
  { pattern: '<html', error: 'UnexpectedHTML' },
];

function fetchViaWindow(url, { timeoutMs = 30000, partition = null } = {}) {
  // Only allow requests to the Claude.ai API to prevent session cookie leakage
  if (!url.startsWith('https://claude.ai/api/')) {
    return Promise.reject(new Error(`Blocked: URL must start with https://claude.ai/api/, got: ${url}`));
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

    // Navigation guards — prevent redirects away from Claude.ai
    win.webContents.on('will-navigate', (event, navUrl) => {
      if (!navUrl.startsWith('https://claude.ai/')) {
        event.preventDefault();
      }
    });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    const timeout = setTimeout(() => {
      win.close();
      reject(new Error('Request timeout'));
    }, timeoutMs);

    win.webContents.on('did-finish-load', async () => {
      try {
        // Verify final URL is still on claude.ai before extracting content
        const finalUrl = win.webContents.getURL();
        if (!finalUrl.startsWith('https://claude.ai/')) {
          clearTimeout(timeout);
          win.close();
          reject(new Error(`UnexpectedRedirect: navigated to ${finalUrl}`));
          return;
        }

        const bodyText = await win.webContents.executeJavaScript(
          'document.body.innerText || document.body.textContent'
        );
        clearTimeout(timeout);
        win.close();

        // Detect known block/failure signatures before attempting JSON parse.
        // This provides explicit errors when Claude.ai modifies their API or CSP.
        for (const sig of BLOCKED_SIGNATURES) {
          if (bodyText.includes(sig.pattern)) {
            reject(new Error(`${sig.error}: ${bodyText.substring(0, 200)}`));
            return;
          }
        }

        try {
          const data = JSON.parse(bodyText);
          resolve(data);
        } catch (parseErr) {
          reject(new Error('InvalidJSON: ' + bodyText.substring(0, 200)));
        }
      } catch (err) {
        clearTimeout(timeout);
        win.close();
        reject(err);
      }
    });

    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      clearTimeout(timeout);
      win.close();
      reject(new Error(`LoadFailed: ${errorCode} ${errorDescription}`));
    });

    win.loadURL(url);
  });
}

module.exports = { fetchViaWindow };
