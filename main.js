const { app, BrowserWindow, ipcMain, Tray, Menu, session, shell, Notification, screen, dialog, nativeImage, nativeTheme, safeStorage, net } = require('electron');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const Store = require('electron-store');
const { fetchViaWindow, fetchManyViaWindow, screenAndParse, assertClaudeApiUrl } = require('./src/fetch-via-window');
const { classifyFetchError, isDestructive, isValidUsageShape, looksLikeAuthErrorBody } = require('./src/lib/errors');
const { validateBool, validateInt, validateEnum, sanitizeCSS } = require('./src/lib/validate');

// Non-sensitive settings store (settings, window position, usage history).
// The encryptionKey is kept for backward-compat with existing installs — it is
// NOT used for secrets. All secrets use safeStorage (OS keychain) below.
const store = new Store({
  encryptionKey: 'claude-widget-secure-key-2024'
});

// --- Secure credential storage via OS keychain (safeStorage) ---
// Credentials are encrypted with the OS credential manager (DPAPI on Windows,
// Keychain on macOS, libsecret on Linux) instead of a hardcoded key.
let inMemorySessionKey = null; // Fallback when safeStorage unavailable

function getSessionKey() {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = store.get('secure.sessionKey');
    if (!encrypted) return null;
    try {
      return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
    } catch { return null; }
  }
  return inMemorySessionKey;
}

function setSessionKeySecure(key) {
  if (safeStorage.isEncryptionAvailable()) {
    store.set('secure.sessionKey', safeStorage.encryptString(key).toString('base64'));
  } else {
    inMemorySessionKey = key;
  }
}

function deleteSessionKeySecure() {
  store.delete('secure.sessionKey');
  inMemorySessionKey = null;
}

// Clear credentials and tell the renderer to show the login screen. Used when a
// fetch failure is classified as destructive (auth or an unsolvable Cloudflare
// challenge — the hidden fetch window cannot complete a CAPTCHA).
async function forceReLogin() {
  await clearClaudeCredentials();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('session-expired');
  }
}

// Migrate legacy sessionKey from electron-store to safeStorage on first run.
// The legacy key is ALWAYS deleted from disk — never leave weakly-encrypted
// secrets around. If safeStorage is unavailable, the user must re-login.
function migrateCredentials() {
  const legacyKey = store.get('sessionKey');
  if (!legacyKey) return;

  if (safeStorage.isEncryptionAvailable()) {
    // Write secure copy FIRST, then delete legacy — avoids data loss on crash
    setSessionKeySecure(legacyKey);
    store.delete('sessionKey');
    debugLog('Migrated sessionKey to safeStorage');
  } else {
    // safeStorage unavailable — load into memory for this session,
    // then delete from disk. User will need to re-login on next restart.
    inMemorySessionKey = legacyKey;
    store.delete('sessionKey');
    debugLog('safeStorage unavailable — session key is memory-only (will not persist)');
  }
}

// --- Isolated session partition for Claude API traffic ---
// All Claude.ai cookies and network traffic use a dedicated session partition,
// so the main window and tray popup never have access to auth cookies.
const CLAUDE_PARTITION = 'persist:claude-auth';

function getClaudeSession() {
  return session.fromPartition(CLAUDE_PARTITION);
}

// Clear ALL stored credentials: the safeStorage key, the org id, AND the
// partition's Claude cookies + cached storage. The sessionKey also lives as an
// httpOnly cookie in the partition, so deleting only safeStorage would leave a
// usable auth credential on disk. Used by logout, delete, and forced re-login.
async function clearClaudeCredentials() {
  deleteSessionKeySecure();
  store.delete('organizationId');
  try {
    const claudeSession = getClaudeSession();
    const cookies = await claudeSession.cookies.get({ url: 'https://claude.ai' });
    for (const cookie of cookies) {
      await claudeSession.cookies.remove('https://claude.ai', cookie.name);
    }
    await claudeSession.clearStorageData({
      storages: ['localstorage', 'sessionstorage', 'cachestorage'],
      origin: 'https://claude.ai'
    });
  } catch (err) {
    debugLog('clearClaudeCredentials cleanup failed:', err.message);
  }
}

// Debug mode: set DEBUG_LOG=1 env var or pass --debug flag to see verbose logs.
// Regular users will only see critical errors in the console.
const DEBUG = process.env.DEBUG_LOG === '1' || process.argv.includes('--debug');
function debugLog(...args) {
  if (DEBUG) console.log('[Debug]', ...args);
}

const CHROME_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Experimental zero-renderer fetch via session.fetch (default OFF). Set
// USE_SESSION_FETCH=1 to trial it. It avoids spawning a hidden window entirely,
// but session.fetch may not carry the partition's cf_clearance cookie reliably
// (see electron/electron#44456), so it falls back to the single hidden window
// on any Cloudflare signal. Left off until validated on Windows.
const USE_SESSION_FETCH = process.env.USE_SESSION_FETCH === '1';

// --- PNG icon generator (pure JS, no external deps) ---
// Generates actual PNG buffers for tray/app icons. SVG data URLs are unreliable
// on Windows — nativeImage only supports PNG/JPEG reliably across platforms.

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[i] = c;
}
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

// Create a PNG buffer with a colored filled circle (with anti-aliased edges)
function createColoredCirclePNG(size, r, g, b, alpha = 230) {
  const cx = size / 2, cy = size / 2, radius = size / 2 - 1;
  const rowBytes = 1 + size * 4;
  const raw = Buffer.alloc(rowBytes * size);
  for (let y = 0; y < size; y++) {
    const off = y * rowBytes;
    raw[off] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx + 0.5) ** 2 + (y - cy + 0.5) ** 2);
      const idx = off + 1 + x * 4;
      if (dist <= radius - 0.5) {
        raw[idx] = r; raw[idx + 1] = g; raw[idx + 2] = b; raw[idx + 3] = alpha;
      } else if (dist <= radius + 0.5) {
        const aa = Math.round(alpha * (radius + 0.5 - dist));
        raw[idx] = r; raw[idx + 1] = g; raw[idx + 2] = b; raw[idx + 3] = aa;
      }
    }
  }
  const compressed = zlib.deflateSync(raw);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', compressed), pngChunk('IEND', Buffer.alloc(0))]);
}

// App icon: use icon.ico on Windows (multi-resolution), logo.png elsewhere.
// Both are generated by scripts/generate-icon.js with the radial gauge design.
// Falls back to a programmatic purple gauge if files are missing.
function createAppIcon() {
  const ext = process.platform === 'win32' ? 'icon.ico' : 'logo.png';
  try {
    const iconPath = path.join(__dirname, 'assets', ext);
    const img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) return img;
  } catch { /* fall through */ }
  return nativeImage.createFromBuffer(createGaugeIconPNG(256, 50, 203, 166, 247));
}

let mainWindow = null;
let tray = null;
let trayPopup = null;
let trayPopupHideTimer = null;
let trayPopupHoverPoll = null;
let isTrayHovered = false;
let isPopupHovered = false;
let latestUsageDataMain = null;
let transientRaiseTimer = null; // momentary always-on-top raise on tray show
let loginWindow = null; // single in-flight login window (detect-session-key)

const WIDGET_WIDTH = 530;
const WIDGET_HEIGHT = 155;
const SNAP_DISTANCE = 20;

// Taskbar awareness: track snap state and adjust when workArea changes
let isSnapping = false;
let snappedEdges = { top: false, bottom: false, left: false, right: false };
let taskbarPollInterval = null;
let lastWorkArea = null;

// Ensure saved window position is on a visible display
function ensureOnScreen(opts) {
  const displays = screen.getAllDisplays();
  const isVisible = displays.some(d => {
    const wa = d.workArea;
    return opts.x < wa.x + wa.width &&
           opts.x + opts.width > wa.x &&
           opts.y < wa.y + wa.height &&
           opts.y + opts.height > wa.y;
  });

  if (!isVisible) {
    const primary = screen.getPrimaryDisplay().workArea;
    opts.x = Math.round(primary.x + (primary.width - opts.width) / 2);
    opts.y = Math.round(primary.y + (primary.height - opts.height) / 2);
  }
}

// Taskbar watcher: poll workArea while visible and adjust window position
// so the widget moves with the auto-hide taskbar instead of being covered.
function adjustForTaskbar() {
  if (!mainWindow || !mainWindow.isVisible()) return;

  const bounds = mainWindow.getBounds();
  const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
  const wa = display.workArea;

  // Skip if workArea hasn't changed
  if (lastWorkArea && lastWorkArea.x === wa.x && lastWorkArea.y === wa.y &&
      lastWorkArea.width === wa.width && lastWorkArea.height === wa.height) {
    return;
  }
  lastWorkArea = { x: wa.x, y: wa.y, width: wa.width, height: wa.height };

  let newX = bounds.x, newY = bounds.y;
  let adjusted = false;

  // If snapped to an edge, re-anchor to that edge of the new workArea
  if (snappedEdges.bottom) {
    const target = wa.y + wa.height - bounds.height;
    if (newY !== target) { newY = target; adjusted = true; }
  }
  if (snappedEdges.top) {
    if (newY !== wa.y) { newY = wa.y; adjusted = true; }
  }
  if (snappedEdges.right) {
    const target = wa.x + wa.width - bounds.width;
    if (newX !== target) { newX = target; adjusted = true; }
  }
  if (snappedEdges.left) {
    if (newX !== wa.x) { newX = wa.x; adjusted = true; }
  }

  // Even if not snapped, clamp to workArea so the widget isn't hidden behind taskbar
  if (!adjusted) {
    if (bounds.y + bounds.height > wa.y + wa.height) {
      newY = wa.y + wa.height - bounds.height;
      adjusted = true;
    }
    if (bounds.y < wa.y) { newY = wa.y; adjusted = true; }
    if (bounds.x + bounds.width > wa.x + wa.width) {
      newX = wa.x + wa.width - bounds.width;
      adjusted = true;
    }
    if (bounds.x < wa.x) { newX = wa.x; adjusted = true; }
  }

  if (adjusted) {
    isSnapping = true;
    mainWindow.setPosition(newX, newY);
    store.set('windowPosition', { x: newX, y: newY });
    setTimeout(() => { isSnapping = false; }, 200);
  }
}

function startTaskbarWatcher() {
  if (taskbarPollInterval) return;
  lastWorkArea = null; // reset so first poll always runs
  taskbarPollInterval = setInterval(() => {
    if (!mainWindow || !mainWindow.isVisible()) {
      stopTaskbarWatcher();
      return;
    }
    adjustForTaskbar();
  }, 500);
}

function stopTaskbarWatcher() {
  if (taskbarPollInterval) {
    clearInterval(taskbarPollInterval);
    taskbarPollInterval = null;
  }
  lastWorkArea = null;
}

// Apply the user's saved always-on-top preference to the main window.
// Centralized so partial settings saves can't accidentally toggle it off.
function applyMainAlwaysOnTopPreference() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const alwaysOnTop = store.get('settings.alwaysOnTop', true);
  mainWindow.setAlwaysOnTop(alwaysOnTop, alwaysOnTop ? 'pop-up-menu' : 'normal');
}

// Show the widget from a tray click / "Show Widget" menu item.
//
// Z-order: showInactive() preserves the original intent of NOT activating the
// window (which would reveal an auto-hide taskbar), but on its own it leaves a
// non-topmost window buried behind the foreground app. We therefore raise it
// with a momentary always-on-top + moveTop(), then revert to the user's saved
// preference after the compositor has painted it in front. setAlwaysOnTop/
// moveTop change z-order without taking keyboard focus, so the taskbar stays put.
function showMainWindowFromTray() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
  }
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (mainWindow.isMinimized()) mainWindow.restore();

  mainWindow.showInactive();
  adjustForTaskbar();

  clearTimeout(transientRaiseTimer);
  mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
  mainWindow.moveTop();

  transientRaiseTimer = setTimeout(() => {
    transientRaiseTimer = null;
    if (!mainWindow || mainWindow.isDestroyed()) return;
    // Revert to the saved preference. If the user wants it off, drop topmost
    // but keep it at the top of the normal z-order so it stays visible now.
    applyMainAlwaysOnTopPreference();
    if (!store.get('settings.alwaysOnTop', true)) mainWindow.moveTop();
  }, 100);

  startTaskbarWatcher();
}

// Set Windows App User Model ID so the taskbar shows our icon, not Electron's.
// Must be called before app is ready.
if (process.platform === 'win32') {
  app.setAppUserModelId('com.claudeusage.widget');
}

// Set session-level User-Agent on the Claude partition to avoid Electron detection.
// Only the Claude session needs spoofing — the local UI doesn't make external requests.
app.on('ready', () => {
  getClaudeSession().setUserAgent(CHROME_USER_AGENT);
});

// Set sessionKey as a cookie in the isolated Claude session (NOT defaultSession)
async function setSessionCookie(sessionKey) {
  await getClaudeSession().cookies.set({
    url: 'https://claude.ai',
    name: 'sessionKey',
    value: sessionKey,
    domain: '.claude.ai',
    path: '/',
    secure: true,
    httpOnly: true
  });
  debugLog('sessionKey cookie set in Claude session partition');
}

// --- Navigation guards ---
// Prevent any BrowserWindow from navigating to unexpected URLs or opening popups.
function applyNavigationGuards(win, allowedOrigins = []) {
  win.webContents.on('will-navigate', (event, url) => {
    // Allow same-origin navigation for local files
    if (url.startsWith('file://')) return;
    const allowed = allowedOrigins.some(origin => url.startsWith(origin));
    if (!allowed) {
      event.preventDefault();
      debugLog('Blocked navigation to:', url);
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    // Open external links in the system browser if they're on the allowlist
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' &&
          ALLOWED_EXTERNAL_DOMAINS.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d))) {
        shell.openExternal(url);
      }
    } catch { /* invalid URL */ }
    return { action: 'deny' };
  });
}

function createMainWindow({ startHidden = false } = {}) {
  const savedPosition = store.get('windowPosition');
  const windowOptions = {
    width: WIDGET_WIDTH,
    height: WIDGET_HEIGHT,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: false,
    // When launched at login with --hidden, the window must start invisible
    // (BrowserWindow defaults to show:true). The tray remains available.
    show: !startHidden,
    icon: createAppIcon(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  };

  if (savedPosition) {
    windowOptions.x = savedPosition.x;
    windowOptions.y = savedPosition.y;
    ensureOnScreen(windowOptions);
  }

  mainWindow = new BrowserWindow(windowOptions);

  // Block all navigation — this window only shows local files
  applyNavigationGuards(mainWindow, []);

  // Acrylic blur on Windows 11, vibrancy on macOS.
  // Light mode disables acrylic to prevent dark-tint bleed-through.
  const savedTheme = store.get('settings.theme', 'dark');
  const isLightTheme = savedTheme === 'light';
  if (process.platform === 'win32') {
    nativeTheme.themeSource = isLightTheme ? 'light' : 'dark';
    try { mainWindow.setBackgroundMaterial(isLightTheme ? 'none' : 'acrylic'); } catch { /* Electron < 30 or unsupported */ }
  } else if (process.platform === 'darwin') {
    try { mainWindow.setVibrancy('under-window'); } catch { /* unsupported */ }
  }

  mainWindow.loadFile('src/renderer/index.html');

  // Snap-to-edge on drag release
  let moveTimeout = null;

  mainWindow.on('move', () => {
    if (isSnapping) return;
    const position = mainWindow.getBounds();
    store.set('windowPosition', { x: position.x, y: position.y });

    clearTimeout(moveTimeout);
    moveTimeout = setTimeout(() => {
      const bounds = mainWindow.getBounds();
      const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
      const wa = display.workArea;

      let newX = bounds.x, newY = bounds.y;
      let snapped = false;

      // Reset edge tracking on drag
      snappedEdges = { top: false, bottom: false, left: false, right: false };

      if (Math.abs(bounds.x - wa.x) < SNAP_DISTANCE) { newX = wa.x; snapped = true; snappedEdges.left = true; }
      if (Math.abs((bounds.x + bounds.width) - (wa.x + wa.width)) < SNAP_DISTANCE) { newX = wa.x + wa.width - bounds.width; snapped = true; snappedEdges.right = true; }
      if (Math.abs(bounds.y - wa.y) < SNAP_DISTANCE) { newY = wa.y; snapped = true; snappedEdges.top = true; }
      if (Math.abs((bounds.y + bounds.height) - (wa.y + wa.height)) < SNAP_DISTANCE) { newY = wa.y + wa.height - bounds.height; snapped = true; snappedEdges.bottom = true; }

      if (snapped) {
        isSnapping = true;
        mainWindow.setPosition(newX, newY);
        store.set('windowPosition', { x: newX, y: newY });
        setTimeout(() => { isSnapping = false; }, 200);
      }
    }, 150);
  });

  mainWindow.on('closed', () => {
    clearTimeout(transientRaiseTimer);
    transientRaiseTimer = null;
    stopTaskbarWatcher();
    mainWindow = null;
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

function createTray() {
  try {
    // Generate a radial gauge tray icon (starts at 0%)
    tray = new Tray(createTrayIcon('normal', 0));

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Widget',
        click: () => {
          showMainWindowFromTray();
        }
      },
      {
        label: 'Refresh',
        click: () => {
          if (mainWindow) {
            mainWindow.webContents.send('refresh-usage');
          }
        }
      },
      {
        label: 'Check for Updates…',
        click: () => checkForUpdates(),
      },
      { type: 'separator' },
      {
        label: 'Log Out',
        click: async () => {
          await forceReLogin();
        }
      },
      { type: 'separator' },
      {
        label: 'Exit',
        click: () => {
          app.quit();
        }
      }
    ]);

    // No native tooltip — the custom hover popup replaces it.
    // Native tooltips overlap with the popup on Windows 11.

    // Do NOT use tray.setContextMenu() — it steals mouse events on Windows,
    // preventing mouse-enter/mouse-move from firing for the tray popup.
    // Instead, show the context menu manually on right-click.
    tray.on('right-click', () => {
      tray.popUpContextMenu(contextMenu);
    });

    tray.on('click', () => {
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
        mainWindow.hide();
        stopTaskbarWatcher();
      } else {
        showMainWindowFromTray();
      }
    });

    // Tray popup on hover (works on macOS; may not fire on Windows 11)
    tray.on('mouse-enter', () => {
      isTrayHovered = true;
      cancelTrayPopupHide();
      showTrayPopup();
    });
    tray.on('mouse-move', () => {
      isTrayHovered = true;
      cancelTrayPopupHide();
      if (!trayPopup || !trayPopup.isVisible()) showTrayPopup();
    });
    tray.on('mouse-leave', () => {
      isTrayHovered = false;
      beginPopupHoverBridge();
    });
  } catch (error) {
    console.error('Failed to create tray:', error);
  }
}

// Tray popup — small window anchored above the system tray icon
function createTrayPopup() {
  if (trayPopup) return;

  trayPopup = new BrowserWindow({
    width: 320,
    height: 110,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload-tray.js')
    }
  });

  // Block all navigation — tray popup only shows local files
  applyNavigationGuards(trayPopup, []);

  trayPopup.loadFile('src/renderer/tray-popup.html');

  trayPopup.on('closed', () => { trayPopup = null; });
}

function showTrayPopup() {
  clearTimeout(trayPopupHideTimer);

  if (!trayPopup) {
    createTrayPopup();
    // Wait for the page to finish loading before sending data
    trayPopup.webContents.once('did-finish-load', () => {
      positionAndShowTrayPopup();
    });
    return;
  }

  positionAndShowTrayPopup();
}

function positionAndShowTrayPopup() {
  if (!trayPopup || !tray) return;

  try {
    const trayBounds = tray.getBounds();
    const popupBounds = trayPopup.getBounds();
    // Win11 sometimes reports {0,0,0} for tray bounds. When that happens, anchor
    // to the cursor (the user just clicked/hovered the tray) on whatever display
    // the cursor is on — this keeps the popup on the correct monitor for setups
    // with a secondary taskbar instead of dumping it on the primary display.
    const invalidTrayBounds = !trayBounds || trayBounds.width <= 0 || trayBounds.height <= 0;

    let x, y, anchorPoint;
    if (invalidTrayBounds) {
      // Place relative to the cursor's position on its display: below the cursor
      // if it's in the top half (top taskbar), above it otherwise (bottom taskbar).
      const cursor = screen.getCursorScreenPoint();
      const wa = screen.getDisplayNearestPoint(cursor).workArea;
      const cursorInTopHalf = cursor.y < wa.y + wa.height / 2;
      x = Math.round(cursor.x - popupBounds.width / 2);
      y = Math.round(cursorInTopHalf ? cursor.y + 16 : cursor.y - popupBounds.height - 16);
      anchorPoint = cursor;
    } else {
      x = Math.round(trayBounds.x - popupBounds.width / 2 + trayBounds.width / 2);
      y = Math.round(trayBounds.y - popupBounds.height - 4);
      anchorPoint = { x: trayBounds.x + trayBounds.width / 2, y: trayBounds.y };
    }

    // Clamp into the work area of the display the popup is anchored to, so it
    // never lands off-screen (e.g. a tray near a screen edge, or mixed-DPI).
    const wa = screen.getDisplayNearestPoint(anchorPoint).workArea;
    x = Math.max(wa.x, Math.min(x, wa.x + wa.width - popupBounds.width));
    y = Math.max(wa.y, Math.min(y, wa.y + wa.height - popupBounds.height));
    trayPopup.setPosition(x, y);

    trayPopup.setAlwaysOnTop(true, 'screen-saver');
    trayPopup.showInactive();

    // Send latest data
    if (latestUsageDataMain && trayPopup.webContents) {
      trayPopup.webContents.send('update-tray-popup', latestUsageDataMain);
    }
  } catch (err) {
    debugLog('Tray popup positioning failed:', err.message);
  }
}

// Check if the cursor is over the tray icon or popup (bounds + padding)
function isCursorOverTrayArea() {
  try {
    const pt = screen.getCursorScreenPoint();
    const pad = 8;
    if (trayPopup && trayPopup.isVisible()) {
      const pb = trayPopup.getBounds();
      if (pt.x >= pb.x - pad && pt.x <= pb.x + pb.width + pad &&
          pt.y >= pb.y - pad && pt.y <= pb.y + pb.height + pad) return true;
    }
    if (tray) {
      const tb = tray.getBounds();
      if (tb.width > 0 &&
          pt.x >= tb.x - pad && pt.x <= tb.x + tb.width + pad &&
          pt.y >= tb.y - pad && pt.y <= tb.y + tb.height + pad) return true;
    }
  } catch { /* ignore */ }
  return false;
}

function shouldKeepPopupOpen() {
  return isTrayHovered || isPopupHovered || isCursorOverTrayArea();
}

function cancelTrayPopupHide() {
  clearTimeout(trayPopupHideTimer);
  clearInterval(trayPopupHoverPoll);
  trayPopupHoverPoll = null;
}

// Short-lived poll to bridge the gap between tray-leave and popup-enter
function beginPopupHoverBridge() {
  cancelTrayPopupHide();
  if (!trayPopup || !trayPopup.isVisible()) return;

  const started = Date.now();
  trayPopupHoverPoll = setInterval(() => {
    if (shouldKeepPopupOpen()) return; // still hovered, keep alive
    // Grace period expired — hide
    if (Date.now() - started > 400) {
      cancelTrayPopupHide();
      if (trayPopup && trayPopup.isVisible()) trayPopup.hide();
    }
  }, 50);
}

function scheduleConditionalHide() {
  clearTimeout(trayPopupHideTimer);
  trayPopupHideTimer = setTimeout(() => {
    if (!shouldKeepPopupOpen() && trayPopup && trayPopup.isVisible()) {
      trayPopup.hide();
    }
  }, 200);
}

// IPC: popup DOM reports mouseenter/mouseleave
ipcMain.on('tray-popup-hover', (event, hovered) => {
  isPopupHovered = hovered;
  if (hovered) {
    cancelTrayPopupHide();
  } else {
    scheduleConditionalHide();
  }
});

// IPC Handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// Return auth state WITHOUT the raw session key — renderer only needs to know
// whether a session exists, not the actual secret.
ipcMain.handle('get-auth-state', () => {
  return {
    hasSession: !!getSessionKey(),
    organizationId: store.get('organizationId')
  };
});

ipcMain.handle('delete-credentials', async () => {
  await clearClaudeCredentials();
  return true;
});

// Validate a sessionKey and persist it securely. The renderer sends the key
// (from manual input) but never gets it back — it stays in main process.
ipcMain.handle('validate-and-save-session-key', async (event, sessionKey) => {
  debugLog('Validating session key: [redacted]');
  try {
    // Set the cookie in the isolated Claude session
    await setSessionCookie(sessionKey);

    // Fetch organizations using hidden BrowserWindow (bypasses Cloudflare)
    const data = await fetchViaWindow('https://claude.ai/api/organizations', {
      partition: CLAUDE_PARTITION
    });

    if (data && Array.isArray(data) && data.length > 0) {
      const orgId = data[0].uuid || data[0].id;
      // Validate org ID format before storing
      if (!/^[a-f0-9-]{36}$/i.test(orgId)) {
        await getClaudeSession().cookies.remove('https://claude.ai', 'sessionKey').catch(() => {});
        return { success: false, error: 'Invalid organization ID format' };
      }
      debugLog('Session key validated, org ID:', orgId);
      // Store credentials securely in main process
      setSessionKeySecure(sessionKey);
      store.set('organizationId', orgId);
      return { success: true, organizationId: orgId };
    }

    // Validation failed — clean up the cookie
    await getClaudeSession().cookies.remove('https://claude.ai', 'sessionKey');

    if (data && data.error) {
      return { success: false, error: data.error.message || data.error };
    }

    return { success: false, error: 'No organization found' };
  } catch (error) {
    console.error('Session key validation failed:', error.message);
    // Clean up the invalid cookie from Claude session
    await getClaudeSession().cookies.remove('https://claude.ai', 'sessionKey').catch(() => {});
    return { success: false, error: error.message };
  }
});

// Validate a previously stored session key (used after auto-detect login)
ipcMain.handle('validate-stored-session', async () => {
  const sessionKey = getSessionKey();
  if (!sessionKey) return { success: false, error: 'No stored session' };

  try {
    await setSessionCookie(sessionKey);
    const data = await fetchViaWindow('https://claude.ai/api/organizations', {
      partition: CLAUDE_PARTITION
    });

    if (data && Array.isArray(data) && data.length > 0) {
      const orgId = data[0].uuid || data[0].id;
      // Validate org ID format before storing
      if (!/^[a-f0-9-]{36}$/i.test(orgId)) {
        await clearClaudeCredentials();
        return { success: false, error: 'Invalid organization ID format' };
      }
      store.set('organizationId', orgId);
      return { success: true, organizationId: orgId };
    }

    // Empty/error response. Only clear the stored key if it looks like an auth
    // failure; an unexpected non-auth body is treated as retryable (keep key).
    if (looksLikeAuthErrorBody(data)) {
      await clearClaudeCredentials();
      return { success: false, error: data?.error?.message || 'Session invalid' };
    }
    return { success: false, error: 'No organization found', retryable: true };
  } catch (error) {
    console.error('Stored session validation failed:', error.message);
    // Only destructive (auth/cloudflare) failures clear the saved session.
    // Transient network/unknown failures must NOT wipe a valid stored key —
    // otherwise opening the app offline logs the user out.
    const kind = classifyFetchError(error);
    if (isDestructive(kind)) {
      await clearClaudeCredentials();
      return { success: false, error: error.message };
    }
    return { success: false, error: error.message, retryable: true };
  }
});

ipcMain.on('minimize-window', () => {
  if (mainWindow) { mainWindow.hide(); stopTaskbarWatcher(); }
});

ipcMain.on('close-window', () => {
  if (mainWindow) { mainWindow.hide(); stopTaskbarWatcher(); }
});

ipcMain.on('resize-window', (event, height, width) => {
  if (mainWindow) {
    mainWindow.setContentSize(width || WIDGET_WIDTH, height);
  }
});

ipcMain.handle('get-window-position', () => {
  if (mainWindow) {
    return mainWindow.getBounds();
  }
  return null;
});

ipcMain.handle('set-window-position', (event, { x, y }) => {
  if (mainWindow) {
    mainWindow.setPosition(x, y);
    return true;
  }
  return false;
});

const ALLOWED_EXTERNAL_DOMAINS = ['claude.ai', 'paypal.me', 'github.com', 'buymeacoffee.com'];

ipcMain.on('open-external', (event, url) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return;
    if (!ALLOWED_EXTERNAL_DOMAINS.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d))) return;
    shell.openExternal(url);
  } catch {
    // Invalid URL — ignore silently
  }
});

// Usage history
ipcMain.handle('save-usage-snapshot', (event, snapshot) => {
  const history = store.get('usageHistory', []);
  history.push(snapshot);
  // Keep only last 24 hours
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const trimmed = history.filter(h => h.timestamp > cutoff);
  store.set('usageHistory', trimmed);
  return true;
});

ipcMain.handle('get-usage-history', () => {
  return store.get('usageHistory', []);
});

// Export usage history as CSV
ipcMain.handle('export-usage-history', async () => {
  const history = store.get('usageHistory', []);
  if (history.length === 0) return { success: false, error: 'No history data to export' };

  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: 'claude-usage-history.csv',
    filters: [{ name: 'CSV Files', extensions: ['csv'] }]
  });

  if (result.canceled || !result.filePath) return { success: false };

  const csv = 'Timestamp,Session %,Weekly %\n' +
    history.map(h => {
      const date = new Date(h.timestamp).toISOString();
      return `${date},${h.session.toFixed(1)},${h.weekly.toFixed(1)}`;
    }).join('\n');

  fs.writeFileSync(result.filePath, csv, 'utf8');
  return { success: true, path: result.filePath };
});

// Live opacity change — handled in renderer CSS (background-only).
// Keep IPC stub so preload doesn't error, but no window-level opacity.
ipcMain.on('set-opacity', () => {});

// Theme sync: toggle acrylic material based on light/dark mode.
// Acrylic has a dark luminosity tint that makes light-mode backgrounds
// look like a negative image at low opacity. Disabling it for light mode
// prevents this while dark mode keeps its frosted glass effect.
ipcMain.on('theme-updated', (event, isLight) => {
  nativeTheme.themeSource = isLight ? 'light' : 'dark';
  if (mainWindow) {
    try {
      mainWindow.setBackgroundMaterial(isLight ? 'none' : 'acrylic');
    } catch { /* Electron < 30 or unsupported */ }
  }
});

// Click-through toggle — mouse events pass through the widget
ipcMain.on('set-click-through', (event, enabled) => {
  if (mainWindow) mainWindow.setIgnoreMouseEvents(enabled, { forward: true });
});

// Create a PNG buffer with a radial gauge arc (like the app logo).
// Shows a track ring with a filled arc proportional to utilization %.
function createGaugeIconPNG(size, utilization, r, g, b) {
  const cx = size / 2, cy = size / 2;
  const outerR = size / 2 - 0.5;
  const innerR = outerR - Math.max(2, size / 8);
  const progressAngle = (Math.min(utilization, 100) / 100) * 2 * Math.PI;
  const rowBytes = 1 + size * 4;
  const raw = Buffer.alloc(rowBytes * size);

  for (let y = 0; y < size; y++) {
    const off = y * rowBytes;
    raw[off] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const dx = x - cx + 0.5, dy = y - cy + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const idx = off + 1 + x * 4;

      // Check if pixel is within the ring band (with AA)
      if (dist < innerR - 0.5 || dist > outerR + 0.5) continue;

      // Anti-alias at inner and outer edges
      let ringAlpha = 1;
      if (dist > outerR - 0.5) ringAlpha = Math.max(0, outerR + 0.5 - dist);
      else if (dist < innerR + 0.5) ringAlpha = Math.max(0, dist - (innerR - 0.5));

      // Angle from 12 o'clock, clockwise [0, 2π)
      let angle = Math.atan2(dx, -dy);
      if (angle < 0) angle += 2 * Math.PI;

      if (angle <= progressAngle) {
        // Filled arc — accent color
        const a = Math.round(240 * ringAlpha);
        raw[idx] = r; raw[idx + 1] = g; raw[idx + 2] = b; raw[idx + 3] = a;
      } else {
        // Track — dim gray
        const a = Math.round(80 * ringAlpha);
        raw[idx] = 100; raw[idx + 1] = 100; raw[idx + 2] = 110; raw[idx + 3] = a;
      }
    }
  }

  // Add a small dot at the progress tip
  if (utilization > 0 && utilization < 100) {
    const midR = (innerR + outerR) / 2;
    const tipAngle = progressAngle - Math.PI / 2; // convert to standard angle
    // Tip is at progressAngle from 12 o'clock clockwise
    const tipX = cx + midR * Math.sin(progressAngle);
    const tipY = cy - midR * Math.cos(progressAngle);
    const dotR = Math.max(1.2, size / 12);
    for (let y = Math.max(0, Math.floor(tipY - dotR - 1)); y <= Math.min(size - 1, Math.ceil(tipY + dotR + 1)); y++) {
      for (let x = Math.max(0, Math.floor(tipX - dotR - 1)); x <= Math.min(size - 1, Math.ceil(tipX + dotR + 1)); x++) {
        const d = Math.sqrt((x + 0.5 - tipX) ** 2 + (y + 0.5 - tipY) ** 2);
        if (d <= dotR + 0.5) {
          const idx = y * rowBytes + 1 + x * 4;
          const aa = d <= dotR - 0.5 ? 255 : Math.round(255 * (dotR + 0.5 - d));
          raw[idx] = r; raw[idx + 1] = g; raw[idx + 2] = b; raw[idx + 3] = Math.max(raw[idx + 3], aa);
        }
      }
    }
  }

  const compressed = zlib.deflateSync(raw);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', compressed), pngChunk('IEND', Buffer.alloc(0))]);
}

// Generate tray icon as a radial gauge showing current utilization
function createTrayIcon(level, utilization) {
  const colors = {
    normal:  [166, 227, 161], // green
    warning: [245, 158, 11],  // yellow
    danger:  [239, 68, 68],   // red
  };
  const [r, g, b] = colors[level] || colors.normal;
  return nativeImage.createFromBuffer(createGaugeIconPNG(16, utilization || 0, r, g, b));
}

// Tray tooltip disabled — custom hover popup replaces it.
// Keep the IPC stub so the renderer preload doesn't error.
ipcMain.on('update-tray-tooltip', () => {
});

// Update tray icon gauge based on usage level + utilization %
ipcMain.on('update-tray-icon', (event, level, utilization) => {
  if (!tray) return;
  try {
    tray.setImage(createTrayIcon(level, utilization));
  } catch { /* ignore icon update failures */ }
});

// Notification handler
ipcMain.on('show-notification', (event, { title, body }) => {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title,
      body,
      icon: createAppIcon()
    });
    notification.show();
    notification.on('click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  }
});

// Settings handlers
ipcMain.handle('get-settings', () => {
  return {
    autoStart: store.get('settings.autoStart', false),
    minimizeToTray: store.get('settings.minimizeToTray', false),
    alwaysOnTop: store.get('settings.alwaysOnTop', true),
    theme: store.get('settings.theme', 'dark'),
    accent: store.get('settings.accent', 'mauve'),
    customCSS: store.get('settings.customCSS', ''),
    expanded: store.get('settings.expanded', false),
    warnThreshold: store.get('settings.warnThreshold', 75),
    dangerThreshold: store.get('settings.dangerThreshold', 90),
    notifications: store.get('settings.notifications', true),
    compact: store.get('settings.compact', false),
    opacity: store.get('settings.opacity', 100),
    refreshInterval: store.get('settings.refreshInterval', 5)
  };
});

// --- Settings validation schema ---
// Validators live in src/lib/validate.js (pure + unit-tested). The allowed-value
// sets stay here as domain config passed into validateEnum.
const VALID_THEMES = ['dark', 'light', 'system'];
const VALID_ACCENTS = ['mauve', 'blue', 'sapphire', 'teal', 'green', 'yellow', 'peach', 'red', 'pink', 'lavender'];
const VALID_INTERVALS = [1, 2, 5, 10, 15];

ipcMain.handle('save-settings', (event, settings) => {
  if (!settings || typeof settings !== 'object') return false;

  // Validate and save each field with strict type/range checks
  const autoStart = validateBool(settings.autoStart);
  if (autoStart !== undefined) store.set('settings.autoStart', autoStart);

  const minimizeToTray = validateBool(settings.minimizeToTray);
  if (minimizeToTray !== undefined) store.set('settings.minimizeToTray', minimizeToTray);

  const alwaysOnTop = validateBool(settings.alwaysOnTop);
  if (alwaysOnTop !== undefined) store.set('settings.alwaysOnTop', alwaysOnTop);

  const theme = validateEnum(settings.theme, VALID_THEMES);
  if (theme) store.set('settings.theme', theme);

  const accent = validateEnum(settings.accent, VALID_ACCENTS);
  if (accent) store.set('settings.accent', accent);

  if (settings.customCSS !== undefined) {
    store.set('settings.customCSS', sanitizeCSS(settings.customCSS || ''));
  }

  const expanded = validateBool(settings.expanded);
  if (expanded !== undefined) store.set('settings.expanded', expanded);

  const warn = validateInt(settings.warnThreshold, 1, 99);
  if (warn !== undefined) store.set('settings.warnThreshold', warn);

  const danger = validateInt(settings.dangerThreshold, 1, 99);
  if (danger !== undefined) store.set('settings.dangerThreshold', danger);

  const notifications = validateBool(settings.notifications);
  if (notifications !== undefined) store.set('settings.notifications', notifications);

  const compact = validateBool(settings.compact);
  if (compact !== undefined) store.set('settings.compact', compact);

  const interval = validateEnum(settings.refreshInterval, VALID_INTERVALS);
  if (interval) store.set('settings.refreshInterval', interval);

  const opacity = validateInt(settings.opacity, 10, 100);
  if (opacity !== undefined) store.set('settings.opacity', opacity);

  // Apply side effects from the EFFECTIVE stored values, never the raw payload.
  // A partial save (e.g. saveSettings({ expanded: true }) on expand toggle)
  // leaves these fields undefined; applying them raw would silently disable
  // open-at-login, toggle skipTaskbar, and switch off always-on-top at runtime.
  const effectiveAutoStart = store.get('settings.autoStart', false);
  const effectiveMinimizeToTray = store.get('settings.minimizeToTray', false);

  app.setLoginItemSettings({
    openAtLogin: effectiveAutoStart,
    // Launch silently into the tray at login (Windows). macOS uses openAsHidden.
    openAsHidden: true,
    ...(process.platform !== 'darwin' && { path: app.getPath('exe'), args: ['--hidden'] })
  });

  if (mainWindow) {
    if (process.platform === 'darwin') {
      if (effectiveMinimizeToTray) { app.dock.hide(); } else { app.dock.show(); }
    } else {
      mainWindow.setSkipTaskbar(effectiveMinimizeToTray);
    }
    applyMainAlwaysOnTopPreference();
  }

  return true;
});

// Open a visible BrowserWindow for the user to log in to Claude.ai.
//
// Why we don't embed login directly in the app:
// Claude.ai (via Cloudflare) detects and blocks Electron-embedded logins.
// Instead, we open a standalone browser window, let the user authenticate
// normally, then capture the sessionKey cookie once login completes.
// Do NOT attempt to "fix" this back to an embedded login without verifying
// that Claude.ai/Cloudflare no longer blocks it.
ipcMain.handle('detect-session-key', async () => {
  // In-flight guard: if a login window is already open, focus it instead of
  // opening a second one (concurrent windows share the partition + cookie
  // listener and race each other).
  if (loginWindow && !loginWindow.isDestroyed()) {
    if (loginWindow.isMinimized()) loginWindow.restore();
    loginWindow.focus();
    return { success: false, error: 'Login already in progress' };
  }

  const claudeSession = getClaudeSession();

  // Clear any leftover sessionKey cookie from Claude partition
  try {
    await claudeSession.cookies.remove('https://claude.ai', 'sessionKey');
  } catch (e) { /* ignore */ }

  return new Promise((resolve) => {
    const loginWin = new BrowserWindow({
      width: 1000,
      height: 700,
      title: 'Log in to Claude',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        partition: CLAUDE_PARTITION // Use isolated session for login
      }
    });
    loginWindow = loginWin; // mark in-flight

    // Navigation guards — only allow Claude.ai during login
    loginWin.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith('https://claude.ai/') && !url.startsWith('https://accounts.google.com/') &&
          !url.startsWith('https://appleid.apple.com/') && !url.startsWith('https://login.microsoftonline.com/')) {
        event.preventDefault();
        debugLog('Blocked login navigation to:', url);
      }
    });
    const OAUTH_ORIGINS = ['https://accounts.google.com/', 'https://appleid.apple.com/', 'https://login.microsoftonline.com/'];
    loginWin.webContents.setWindowOpenHandler(({ url }) => {
      // Allow OAuth popups in the login flow
      if (OAUTH_ORIGINS.some(o => url.startsWith(o))) {
        return { action: 'allow' };
      }
      return { action: 'deny' };
    });
    // Harden OAuth child windows that are opened via setWindowOpenHandler
    loginWin.webContents.on('did-create-window', (childWin) => {
      childWin.webContents.on('will-navigate', (event, navUrl) => {
        const allowed = navUrl.startsWith('https://claude.ai/') ||
                        OAUTH_ORIGINS.some(o => navUrl.startsWith(o));
        if (!allowed) event.preventDefault();
      });
      childWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    });

    let resolved = false;

    // Listen for sessionKey cookie on the Claude partition
    const onCookieChanged = (event, cookie, cause, removed) => {
      if (
        cookie.name === 'sessionKey' &&
        cookie.domain.includes('claude.ai') &&
        !removed &&
        cookie.value
      ) {
        resolved = true;
        claudeSession.cookies.removeListener('changed', onCookieChanged);
        // Store the session key securely — do NOT return it to renderer
        setSessionKeySecure(cookie.value);
        loginWin.close();
        resolve({ success: true });
      }
    };

    claudeSession.cookies.on('changed', onCookieChanged);

    loginWin.on('closed', () => {
      claudeSession.cookies.removeListener('changed', onCookieChanged);
      // Identity check: only clear the marker if THIS window is still the
      // in-flight one (a later window may have replaced it during a close gap).
      if (loginWindow === loginWin) loginWindow = null;
      if (!resolved) {
        resolve({ success: false, error: 'Login window closed' });
      }
    });

    // Fail fast if the INITIAL login page can't load (offline/DNS). We ignore
    // ERR_ABORTED (-3) and any failure after the first successful load, so the
    // normal multi-navigation OAuth flow isn't killed mid-login.
    let firstLoadOk = false;
    loginWin.webContents.on('did-finish-load', () => { firstLoadOk = true; });
    loginWin.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (isMainFrame === false || firstLoadOk || errorCode === -3) return;
      if (!resolved && !loginWin.isDestroyed()) {
        resolved = true;
        loginWin.close(); // 'closed' handler clears the marker + resolves are guarded
        resolve({ success: false, error: `LoadFailed: ${errorCode} ${errorDescription}` });
      }
    });

    loginWin.loadURL('https://claude.ai/login').catch(() => { /* surfaced via did-fail-load */ });
  });
});

// Experimental: fetch one Claude API JSON endpoint via session.fetch (no window).
// Pins the FULL partition cookie jar (sessionKey + cf_clearance/__cf_bm) as a
// Cookie header — mitigates electron#44456 where session.fetch may use default-
// session cookies. Treats 3xx as a Cloudflare signal (don't trust response.url).
async function fetchClaudeApiViaSession(url) {
  assertClaudeApiUrl(url);
  const claudeSession = getClaudeSession();
  if (typeof claudeSession.fetch !== 'function') {
    throw new Error('SessionFetchUnavailable: session.fetch not supported');
  }
  const cookies = await claudeSession.cookies.get({ url: 'https://claude.ai' });
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  const resp = await claudeSession.fetch(url, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    redirect: 'manual',
    headers: { accept: 'application/json, text/plain, */*', Cookie: cookieHeader }
  });
  // Never log cookieHeader. 3xx → route to the window fallback (likely a CF/login redirect).
  if (resp.status >= 300 && resp.status < 400) {
    throw new Error(`CloudflareChallenge: redirect HTTP ${resp.status}`);
  }
  // Screen the body BEFORE treating 401/403 as auth: Cloudflare challenges are
  // often served as 403 + HTML, which must route to the window fallback (so the
  // real browser can clear the challenge) rather than logging the user out.
  const text = await resp.text();
  try {
    const parsed = screenAndParse(text);
    if (resp.status === 401 || resp.status === 403) {
      throw new Error(`SessionExpired: HTTP ${resp.status}`);
    }
    return parsed;
  } catch (err) {
    if (classifyFetchError(err) === 'cloudflare') throw err; // → window fallback
    if (resp.status === 401 || resp.status === 403) {
      throw new Error(`SessionExpired: HTTP ${resp.status}`);
    }
    throw err;
  }
}

// Fetch usage (mandatory) + overage + prepaid. Default path uses ONE hidden
// window (fetchManyViaWindow). The experimental session.fetch path is tried
// first only when USE_SESSION_FETCH=1, and falls back to the window batch when
// the mandatory endpoint hits Cloudflare or session.fetch is unavailable.
async function fetchUsageEndpoints(urls) {
  const fetchOpts = { partition: CLAUDE_PARTITION };
  if (USE_SESSION_FETCH) {
    const results = await Promise.allSettled(urls.map((u) => fetchClaudeApiViaSession(u)));
    const usage = results[0];
    if (usage.status === 'fulfilled') return results;
    const kind = classifyFetchError(usage.reason);
    const unavailable = /SessionFetchUnavailable/.test(usage.reason?.message || '');
    if (kind === 'cloudflare' || unavailable) {
      debugLog('session.fetch fell back to window batch (%s)', unavailable ? 'unavailable' : 'cloudflare');
      return fetchManyViaWindow(urls, fetchOpts);
    }
    return results; // auth/network — window fallback wouldn't help
  }
  return fetchManyViaWindow(urls, fetchOpts);
}

ipcMain.handle('fetch-usage-data', async () => {
  const sessionKey = getSessionKey();
  const organizationId = store.get('organizationId');

  if (!sessionKey || !organizationId) {
    throw new Error('Missing credentials');
  }

  // Validate organizationId is a UUID to prevent URL path traversal
  if (!/^[a-f0-9-]{36}$/i.test(organizationId)) {
    throw new Error('Invalid organization ID format');
  }

  // Offline pre-check. net.isOnline() returning false is reliable; true is
  // inconclusive (so we never gate on true). Skipping the fetch when offline
  // avoids misclassifying a captured error page as an auth failure.
  if (net.isOnline && net.isOnline() === false) {
    throw new Error('NetworkOffline: no internet connection');
  }

  // Ensure cookie is set in the isolated Claude session
  await setSessionCookie(sessionKey);

  const usageUrl = `https://claude.ai/api/organizations/${organizationId}/usage`;
  const overageUrl = `https://claude.ai/api/organizations/${organizationId}/overage_spend_limit`;
  const prepaidUrl = `https://claude.ai/api/organizations/${organizationId}/prepaid/credits`;

  // Fetch usage (mandatory) + overage + prepaid. One hidden window by default;
  // returns settled-style results in [usage, overage, prepaid] order.
  const [usageResult, overageResult, prepaidResult] =
    await fetchUsageEndpoints([usageUrl, overageUrl, prepaidUrl]);

  // Usage endpoint is mandatory. Classify the failure: only 'auth' and
  // 'cloudflare' clear credentials (cloudflare needs a visible re-login the
  // hidden window can't perform). 'network'/'unknown' are non-destructive —
  // we rethrow so the renderer keeps showing the last known data.
  if (usageResult.status === 'rejected') {
    const error = usageResult.reason;
    const kind = classifyFetchError(error);
    debugLog('Usage fetch failed (%s):', kind, error.message);
    if (isDestructive(kind)) {
      await forceReLogin();
      throw new Error('SessionExpired');
    }
    throw error;
  }

  const data = usageResult.value;

  // Guard against a 200-with-error or malformed body being rendered as a false
  // "no usage" state. An auth-signalled error body forces re-login; anything
  // else is treated as a transient unexpected response (keep cached data).
  if (!isValidUsageShape(data)) {
    debugLog('Usage response failed shape validation:', JSON.stringify(data).slice(0, 200));
    if (looksLikeAuthErrorBody(data)) {
      await forceReLogin();
      throw new Error('SessionExpired');
    }
    throw new Error('UnexpectedResponse: usage payload missing expected fields');
  }

  // Merge overage spending data into data.extra_usage
  if (overageResult.status === 'fulfilled' && overageResult.value) {
    const overage = overageResult.value;
    const limit = overage.monthly_credit_limit ?? overage.spend_limit_amount_cents;
    const used = overage.used_credits ?? overage.balance_cents;
    const enabled = overage.is_enabled !== undefined ? overage.is_enabled : (limit != null);

    if (enabled && typeof limit === 'number' && limit > 0 && typeof used === 'number') {
      data.extra_usage = {
        utilization: (used / limit) * 100,
        resets_at: null,
        used_cents: used,
        limit_cents: limit,
      };
    }
  } else {
    debugLog('Overage fetch skipped or failed:', overageResult.reason?.message || 'no data');
  }

  // Merge prepaid balance into data.extra_usage
  if (prepaidResult.status === 'fulfilled' && prepaidResult.value) {
    const prepaid = prepaidResult.value;
    if (typeof prepaid.amount === 'number') {
      if (!data.extra_usage) data.extra_usage = {};
      data.extra_usage.balance_cents = prepaid.amount;
    }
  } else {
    debugLog('Prepaid fetch skipped or failed:', prepaidResult.reason?.message || 'no data');
  }

  // Cache for tray popup
  latestUsageDataMain = data;
  if (trayPopup && trayPopup.webContents) {
    trayPopup.webContents.send('update-tray-popup', data);
  }

  return data;
});

// --- Auto-update (electron-updater + GitHub Releases) ---
// Inert in development (app.isPackaged === false) and never crashes the widget:
// every updater interaction is wrapped so failures only log. Unsigned Windows
// builds still update (with a SmartScreen prompt); macOS auto-update requires a
// signed build + the zip target, so it won't function on unsigned builds.
let autoUpdaterRef; // undefined=untried, false=unavailable, object=ready
function getAutoUpdater() {
  if (autoUpdaterRef !== undefined) return autoUpdaterRef || null;
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.on('error', (err) => debugLog('autoUpdater error:', err?.message || err));
    autoUpdaterRef = autoUpdater;
  } catch (err) {
    debugLog('electron-updater unavailable:', err?.message || err);
    autoUpdaterRef = false;
  }
  return autoUpdaterRef || null;
}

function checkForUpdates() {
  if (!app.isPackaged) {
    debugLog('Update check skipped (dev build, not packaged)');
    return;
  }
  const updater = getAutoUpdater();
  if (!updater) return;
  try {
    // Returns a promise that REJECTS on offline / GitHub rate-limit / bad
    // release metadata. Without .catch() that's an unhandled rejection, which
    // can crash the app — so swallow it (errors are advisory for a widget).
    const p = updater.checkForUpdatesAndNotify();
    if (p && typeof p.catch === 'function') {
      p.catch((err) => debugLog('checkForUpdatesAndNotify failed:', err?.message || err));
    }
  } catch (err) {
    debugLog('checkForUpdatesAndNotify threw:', err?.message || err);
  }
}

// App lifecycle
app.whenReady().then(async () => {
  // Migrate legacy credentials from electron-store to safeStorage
  migrateCredentials();

  // Restore session cookie in the isolated Claude session
  const sessionKey = getSessionKey();
  if (sessionKey) {
    await setSessionCookie(sessionKey);
  }

  // Auto-start launches inject --hidden so the widget boots silently into the
  // tray instead of popping the window open over the user's login.
  const startHidden = process.argv.includes('--hidden');

  createMainWindow({ startHidden });
  createTray();
  createTrayPopup(); // Pre-create hidden popup so it appears instantly on hover/click

  // React to display/taskbar changes (e.g. auto-hide taskbar appearing/disappearing)
  screen.on('display-metrics-changed', () => {
    lastWorkArea = null; // force re-check
    adjustForTaskbar();
  });

  // Only watch the taskbar when the window is actually visible (skip on hidden start).
  if (!startHidden) startTaskbarWatcher();

  // Check for updates on launch (no-op in dev / on failure).
  checkForUpdates();

  // Apply persisted settings
  const minimizeToTray = store.get('settings.minimizeToTray', false);
  if (mainWindow) {
    if (process.platform === 'darwin') {
      if (minimizeToTray) app.dock.hide();
    } else {
      if (minimizeToTray) mainWindow.setSkipTaskbar(true);
    }
    applyMainAlwaysOnTopPreference();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Keep running in tray
  }
});

app.on('activate', () => {
  // Dock click (macOS): create if gone, otherwise reveal — handles the case
  // where the window exists but is hidden (started via --hidden / openAsHidden).
  showMainWindowFromTray();
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, argv) => {
    // A normal relaunch should reveal the widget. Ignore a --hidden auto-start
    // relaunch so it doesn't pop the window open. showMainWindowFromTray()
    // reveals a hidden/minimized window (plain focus() can't unhide show:false).
    if (Array.isArray(argv) && argv.includes('--hidden')) return;
    showMainWindowFromTray();
  });
}
