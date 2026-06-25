# File Index

## Entry Points

| File | Purpose |
|------|---------|
| `main.js` | Electron main process — window management, tray, IPC handlers, taskbar awareness |
| `src/renderer/index.html` | Main widget HTML — login flow, usage display, settings overlay |
| `src/renderer/tray-popup.html` | Tray hover popup — usage bars, quirky sayings |

## Renderer

| File | Purpose |
|------|---------|
| `src/renderer/app.js` | All widget logic — auth, data fetching, UI updates, charts, settings |
| `src/renderer/format.js` | Pure formatting/trend helpers (`formatTime`, `calculateTrend`, `computeVelocity`); UMD — loaded before `app.js`/`tray-popup.js`, also `require`d by tests. Lives here (not `src/lib/`) so `script-src 'self'` over `file://` can load it. |
| `src/renderer/styles.css` | Full stylesheet — Catppuccin themes, layout, animations |

## Preloads (IPC Bridge)

| File | Purpose | Connects To |
|------|---------|-------------|
| `preload.js` | Main window IPC API — credentials, window controls, settings, tray | `main.js` ↔ `app.js` |
| `preload-tray.js` | Tray popup IPC — usage updates, hover state | `main.js` ↔ `tray-popup.html` |

## Core Modules

| File | Purpose |
|------|---------|
| `src/fetch-via-window.js` | Hidden BrowserWindow fetch — `fetchViaWindow` (single URL) + `fetchManyViaWindow` (one window, many same-origin fetches); Cloudflare-bypass + single-settlement guard |
| `src/lib/errors.js` | Fetch error taxonomy (`classifyFetchError`, `isDestructive`, `isValidUsageShape`, `looksLikeAuthErrorBody`) — pure, unit-tested |
| `src/lib/validate.js` | Settings validators (`validateBool/Int/Enum`, `sanitizeCSS`) — pure, unit-tested |

## Tests

| File | Purpose |
|------|---------|
| `test/errors.test.js` | `node:test` suite for the error taxonomy |
| `test/validate.test.js` | `node:test` suite for settings validators |
| `test/format.test.js` | `node:test` suite for formatters + UMD-global smoke test (`npm test` runs all) |

## Assets & Scripts

| File | Purpose |
|------|---------|
| `assets/icon.ico` | Multi-resolution Windows icon (generated) |
| `assets/logo.png` | 256x256 PNG app icon (generated) |
| `assets/icon.icns` | macOS icon |
| `scripts/generate-icon.js` | Generates `icon.ico` + `logo.png` from radial gauge design |

## Config

| File | Purpose |
|------|---------|
| `package.json` | Dependencies, build config (electron-builder), scripts |
| `.claude/settings.local.json` | Claude Code tool permissions |
