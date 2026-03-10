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
  fetch-via-window.js  (hidden BrowserWindow, spoofed UA, session cookie)
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

1. User clicks "Login to Claude" → main process opens a visible `BrowserWindow` to `claude.ai/login`
2. User authenticates normally in the browser window
3. Main process listens for `sessionKey` cookie via `session.defaultSession.cookies.on('changed')`
4. Cookie captured → stored encrypted in `electron-store` → set on `defaultSession` for future requests
5. Organization ID fetched via `/api/organizations` endpoint
6. All subsequent API calls use `fetchViaWindow` which rides the session cookie in a hidden BrowserWindow

**Why hidden BrowserWindow?** Claude.ai uses Cloudflare protection that blocks standard Node.js HTTP requests. Loading URLs in a hidden Chromium window with session cookies bypasses this.

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

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| No framework (React, etc.) | Widget is a single screen — framework overhead isn't justified |
| Hidden BrowserWindow for API | Only reliable way to bypass Cloudflare on Claude.ai |
| Programmatic icon generation | No external image tools needed; icons match the UI exactly |
| `showInactive()` for tray popup | Avoids stealing focus and triggering auto-hide taskbar |
| `focusable: false` on tray popup | Popup is display-only, shouldn't interfere with user's workflow |
| Catppuccin theme system | Well-defined palette with both dark (Mocha) and light (Latte) variants |
| Acrylic/vibrancy background | Native frosted glass effect on Windows 11 / macOS |
