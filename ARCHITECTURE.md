# Architecture

## Overview

Single-process Electron app with one main window, one tray popup, and hidden BrowserWindows for API fetching. No framework — pure JavaScript, HTML, CSS.

```
┌─────────────────────────────────────────────────────┐
│                   Electron Main Process              │
│                      (main.js)                       │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ MainWindow│  │TrayPopup │  │ Hidden Fetch Win  │  │
│  │ (widget)  │  │ (hover)  │  │ (Cloudflare bypass)│ │
│  └─────┬────┘  └─────┬────┘  └────────┬──────────┘  │
│        │              │                │              │
│   preload.js    preload-tray.js   fetch-via-window   │
└────────┼──────────────┼────────────────┼─────────────┘
         │              │                │
    ┌────▼────┐   ┌─────▼─────┐   ┌─────▼──────┐
    │ app.js  │   │tray-popup │   │ claude.ai  │
    │index.html│  │  .html    │   │   /api/    │
    │styles.css│  └───────────┘   └────────────┘
    └─────────┘
```

## Process Model

### Main Process (`main.js`)

Responsibilities:
- **Window lifecycle** — creates main window, tray popup, login window, hidden fetch windows
- **System tray** — icon with radial gauge, context menu, hover popup show/hide
- **Taskbar awareness** — polls `screen.workArea`, adjusts position when auto-hide taskbar appears
- **IPC hub** — routes all renderer ↔ system calls (credentials, settings, fetch, window controls)
- **Persistent storage** — `electron-store` for credentials, settings, window position, usage history
- **Icon generation** — programmatic PNG/ICO creation for tray gauge icon (updates with usage %)

### Renderer — Main Widget (`src/renderer/`)

| File | Role |
|------|------|
| `index.html` | DOM structure — login steps, usage rows, expand section, settings overlay |
| `app.js` | All UI logic — auth flow, data polling, chart rendering, theme/accent, notifications |
| `styles.css` | Catppuccin Mocha/Latte themes, ~60 CSS custom properties, animations |

### Renderer — Tray Popup (`src/renderer/tray-popup.html`)

Self-contained HTML file with inline CSS and JS. Receives usage data via IPC, renders compact progress bars, displays context-aware quirky sayings (33% random / 67% usage-tier based, refreshes every 10 min). Reports hover state back to main process for popup persistence.

## Data Flow

```
claude.ai/api/organizations/{org}/usage
claude.ai/api/organizations/{org}/overage_spend_limit
claude.ai/api/organizations/{org}/prepaid/credits
         │
         ▼
  fetch-via-window.js  (hidden BrowserWindow on persist:claude-auth, spoofed UA, session cookie)
         │
         ▼
     main.js  (merges usage + overage + prepaid, caches for tray popup)
         │
    IPC invoke ──────────────────── IPC send
         │                              │
         ▼                              ▼
      app.js                     tray-popup.html
   (full UI update)            (compact bars + quip)
         │
         ▼
   electron-store  (usage history snapshots, 24h rolling window)
```

## Authentication

All Claude.ai traffic is isolated to a dedicated session partition, `persist:claude-auth`
(`CLAUDE_PARTITION`). The main widget and tray popup run on the default session and never
have access to the auth cookies.

1. User clicks "Log in" → main process opens a visible `BrowserWindow` on the Claude partition to `claude.ai/login` (`detect-session-key`)
2. User authenticates normally (email, Google, Apple, or Microsoft OAuth — OAuth child windows are explicitly allowlisted)
3. Main process listens for the `sessionKey` cookie via `getClaudeSession().cookies.on('changed')`
4. Cookie captured → stored via **`safeStorage`** (OS keychain: DPAPI on Windows, Keychain on macOS, libsecret on Linux), base64-encoded into `electron-store` under `secure.sessionKey`
5. Organization ID fetched via `/api/organizations`, validated against a UUID regex before storage
6. All subsequent API calls run through `fetchViaWindow` on the Claude partition, riding the stored cookie

The raw session key never leaves the main process — `get-auth-state` returns only `{ hasSession, organizationId }`, never the secret.

### Credential migration & storage hardening

- **Legacy migration** (`migrateCredentials`): older builds stored the key in plaintext-ish `electron-store` (hardcoded `encryptionKey`). On launch, any legacy `sessionKey` is moved into `safeStorage` and **always deleted** from the insecure store — even when `safeStorage` is unavailable (in which case it falls back to a memory-only key that does not persist).
- The `electron-store` `encryptionKey` is retained only for backward-compat with non-secret data (settings, window position, usage history). It is **not** used for secrets.

**Why hidden BrowserWindow for fetches?** Claude.ai sits behind Cloudflare, which blocks
standard Node.js HTTP requests by header fingerprint. Loading the JSON endpoint inside a
hidden Chromium window (with a spoofed Chrome User-Agent and the partition's session cookies)
rides the same path a real browser would, clearing Cloudflare. `fetch-via-window.js` extracts
`document.body.innerText`, screens it against known Cloudflare/HTML block signatures, then
`JSON.parse`s the result. See [Known Limitations](#known-limitations-and-improvement-areas) for
the lighter `session.fetch()` alternative.

## Tray Popup Hover Persistence

```
tray mouse-enter → show popup
tray mouse-leave → start hover bridge (50ms poll, 400ms grace)
                     │
                     ├─ cursor over popup bounds? → keep open
                     ├─ popup DOM mouseenter IPC? → keep open
                     └─ neither after 400ms? → hide popup

popup DOM mouseleave IPC → schedule conditional hide (200ms)
                            └─ re-check cursor position before hiding
```

Uses `screen.getCursorScreenPoint()` with 8px padding around both tray icon and popup bounds to bridge the gap between tray mouse-leave and popup mouse-enter.

## Taskbar Awareness

The widget tracks which screen edges it's snapped to. When `screen.workArea` changes (auto-hide taskbar appears/disappears), snapped edges are re-anchored:

- **Bottom-snapped** → `y = workArea.y + workArea.height - windowHeight`
- **Right-snapped** → `x = workArea.x + workArea.width - windowWidth`
- **Not snapped** → clamp to stay within workArea

Polls every 500ms while visible. Also listens to `display-metrics-changed` for immediate response.

## Window Show Behavior & Z-Order

The main widget is a **persistent desktop widget**, not a tray flyout: it stays where the
user places it, is dragged/snapped manually, and does **not** auto-hide on blur. The tray
icon toggles its visibility.

Showing it from the tray click or the "Show Widget" menu goes through
`showMainWindowFromTray()`, which has to satisfy two competing constraints:

- **Don't steal focus.** Activating the window would reveal an auto-hide taskbar — the reason
  the original code used `showInactive()`.
- **Appear in front.** A non-topmost window shown with `showInactive()` lands at its natural
  z-order, i.e. *behind* the foreground app. This was the long-standing "widget is hidden
  behind everything" bug.

The resolution is a **momentary raise**: `showInactive()` → `setAlwaysOnTop(true)` +
`moveTop()` → after ~100ms revert to the user's saved always-on-top preference. `setAlwaysOnTop`
and `moveTop` change z-order *without* taking keyboard focus, so the window pops to the front
while the taskbar stays put.

> **Root-cause note:** the bug was compounded by `save-settings` applying the *raw* request
> payload. UI actions that do partial saves (`saveSettings({ expanded })` on expand toggle,
> compact-mode toggle) left `alwaysOnTop` undefined, so the handler ran
> `setAlwaysOnTop(undefined)` and silently disabled always-on-top at runtime. The handler now
> applies effective stored values via `applyMainAlwaysOnTopPreference()`.

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| No framework (React, etc.) | Widget is a single screen — framework overhead isn't justified |
| Hidden BrowserWindow for API | Only reliable way to bypass Cloudflare on Claude.ai |
| Isolated `persist:claude-auth` session | Keeps auth cookies off the default session used by the UI |
| `safeStorage` for the session key | OS keychain beats a hardcoded `electron-store` key |
| Programmatic icon generation | No external image tools needed; icons match the UI exactly |
| Momentary always-on-top raise on show | Brings the widget to front without focus (preserves auto-hide taskbar) |
| `showInactive()` for tray popup | Avoids stealing focus and triggering auto-hide taskbar |
| `focusable: false` on tray popup | Popup is display-only, shouldn't interfere with user's workflow |
| Catppuccin theme system | Well-defined palette with both dark (Mocha) and light (Latte) variants |
| Acrylic/vibrancy background | Native frosted glass effect on Windows 11 / macOS |

## Reliability & Standard-Applet Improvements

Implemented in the reliability pass (plan: `.context/docs/PLAN_widget-improvements.md`,
council-reviewed across three batches). The fetch/error layer is the substantive change.

| Area | What it does now |
|------|------------------|
| **Error taxonomy** (`src/lib/errors.js`) | `classifyFetchError` → `auth` / `cloudflare` / `network` / `unknown`. **Only `auth` and `cloudflare` clear credentials** (a Cloudflare challenge needs a visible re-login the hidden window can't perform); `network`/`unknown` are non-destructive and keep the last-known data. A captured DNS/ISP error page no longer logs you out. Mandatory-usage responses are shape-validated so a `{error}`-with-200 body isn't rendered as a false "no usage". |
| **Offline pre-check** | `net.isOnline() === false` short-circuits a refresh (never gates on `true`, which is inconclusive). |
| **Single-window fetch** (`fetchManyViaWindow`) | A refresh spawns **one** hidden window (was three): it navigates to the usage URL, then runs same-origin in-page `fetch()` for overage/prepaid (rides the full cookie jar + `cf_clearance`). Experimental `session.fetch()` path exists behind `USE_SESSION_FETCH=1` (default off) with the full cookie jar pinned. |
| **Single-settlement guard** | `fetchViaWindow`/`fetchManyViaWindow` resolve exactly once; `did-fail-load` ignores subframes; window closed once. |
| **Login window guard** | `detect-session-key` won't open a second login window; fails fast if the initial page can't load. |
| **Credential cleanup** | `clearClaudeCredentials()` clears safeStorage + org id + partition cookies + storage (shared by logout/delete/forced re-login). `validate-stored-session` only wipes on destructive failures — a transient error keeps the saved key (`retryable`). |
| **Win11 tray-bounds fallback** | When `tray.getBounds()` is `{0,0}` (Win11), the popup anchors to the cursor's display (above/below per taskbar half) and clamps into its work area. |
| **Silent auto-start** | Login launch passes `--hidden`; `createMainWindow({startHidden})` starts `show:false`; `activate`/`second-instance` reveal a hidden window. |
| **Auto-update** | `electron-updater` + GitHub Releases, **inert unless `app.isPackaged`**, all errors swallowed; tray "Check for Updates…". |
| **Tests** | `node:test` suites for the pure helpers (`npm test`) — error taxonomy, validators, formatters. |

### Still open / caveats

| Area | Note |
|------|------|
| Code signing | Unsigned builds: Windows auto-update works behind a SmartScreen prompt; **macOS auto-update will not function** without signing (Squirrel.Mac rejects unsigned). Out of scope. |
| macOS 13+ silent login | `openAsHidden` is deprecated on macOS 13+ and we don't pass `--hidden` there, so silent login at startup is Windows-only. A macOS launch agent / `SMAppService` would be needed. |
| `session.fetch()` zero-renderer path | Default off — unverified that it carries `cf_clearance`; needs Windows validation before flipping on (electron/electron#44456). |
| Runtime validation | The fetch/z-order/tray/auto-update behavior is verified by tests + static review + council, but **not yet exercised on Windows** — that's the owner's validation gate. |
