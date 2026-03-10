// Application state
let credentials = null;
let updateInterval = null;
let countdownInterval = null;
let latestUsageData = null;
let isExpanded = false;
let UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes (configurable)
const SMART_REFRESH_INTERVAL = 60 * 1000; // 1 minute when near limit
const SMART_REFRESH_THRESHOLD = 80;
const WIDGET_HEIGHT_COLLAPSED = 155;
const WIDGET_ROW_HEIGHT = 30;
const WIDGET_HEIGHT_SETTINGS = 370;
const HISTORY_CHART_HEIGHT = 140;

// Compact mode
let isCompact = false;
const WIDGET_HEIGHT_COMPACT = 28;

// Status & notification state
let lastUpdatedTime = null;
let statusUpdateInterval = null;
let previousSessionLevel = 'normal';
let previousWeeklyLevel = 'normal';
let notificationsEnabled = true;

// Click-through mode
let isClickThrough = false;

// Auto-hide on inactivity
let autoHideTimeout = null;
let isAutoHidden = false;
const AUTO_HIDE_DELAY = 10000; // 10 seconds of inactivity

// Debug logging — only shows in DevTools (development mode).
// Regular users won't see verbose logs in production.
const DEBUG = (new URLSearchParams(window.location.search)).has('debug');
function debugLog(...args) {
  if (DEBUG) console.log('[Debug]', ...args);
}

// DOM elements
const elements = {
    loadingContainer: document.getElementById('loadingContainer'),
    loginContainer: document.getElementById('loginContainer'),
    noUsageContainer: document.getElementById('noUsageContainer'),
    mainContent: document.getElementById('mainContent'),
    loginStep1: document.getElementById('loginStep1'),
    loginStep2: document.getElementById('loginStep2'),
    autoDetectBtn: document.getElementById('autoDetectBtn'),
    autoDetectError: document.getElementById('autoDetectError'),
    openBrowserLink: document.getElementById('openBrowserLink'),
    nextStepBtn: document.getElementById('nextStepBtn'),
    backStepBtn: document.getElementById('backStepBtn'),
    sessionKeyInput: document.getElementById('sessionKeyInput'),
    connectBtn: document.getElementById('connectBtn'),
    sessionKeyError: document.getElementById('sessionKeyError'),
    refreshBtn: document.getElementById('refreshBtn'),
    minimizeBtn: document.getElementById('minimizeBtn'),
    closeBtn: document.getElementById('closeBtn'),

    sessionPercentage: document.getElementById('sessionPercentage'),
    sessionProgress: document.getElementById('sessionProgress'),
    sessionTimer: document.getElementById('sessionTimer'),
    sessionTimeText: document.getElementById('sessionTimeText'),

    weeklyPercentage: document.getElementById('weeklyPercentage'),
    weeklyProgress: document.getElementById('weeklyProgress'),
    weeklyTimer: document.getElementById('weeklyTimer'),
    weeklyTimeText: document.getElementById('weeklyTimeText'),
    weeklyResetsAt: document.getElementById('weeklyResetsAt'),

    sessionResetsAt: document.getElementById('sessionResetsAt'),

    expandToggle: document.getElementById('expandToggle'),
    expandArrow: document.getElementById('expandArrow'),
    expandSection: document.getElementById('expandSection'),
    extraRows: document.getElementById('extraRows'),

    settingsBtn: document.getElementById('settingsBtn'),
    settingsOverlay: document.getElementById('settingsOverlay'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    funSnippet: document.getElementById('funSnippet'),
    snippetRefreshBtn: document.getElementById('snippetRefreshBtn'),
    autoStartToggle: document.getElementById('autoStartToggle'),
    minimizeToTrayToggle: document.getElementById('minimizeToTrayToggle'),
    alwaysOnTopToggle: document.getElementById('alwaysOnTopToggle'),
    warnThreshold: document.getElementById('warnThreshold'),
    dangerThreshold: document.getElementById('dangerThreshold'),
    themeBtns: document.querySelectorAll('.theme-btn'),
    statusRing: document.getElementById('statusRing'),
    statusRingProgress: document.getElementById('statusRingProgress'),
    statusText: document.getElementById('statusText'),
    notificationsToggle: document.getElementById('notificationsToggle'),
    errorContainer: document.getElementById('errorContainer'),
    errorMessage: document.getElementById('errorMessage'),
    retryBtn: document.getElementById('retryBtn'),
    historyChart: document.getElementById('historyChart'),
    sessionSparkline: document.getElementById('sessionSparkline'),
    weeklySparkline: document.getElementById('weeklySparkline'),
    sessionTrend: document.getElementById('sessionTrend'),
    weeklyTrend: document.getElementById('weeklyTrend'),
    compactContent: document.getElementById('compactContent'),
    compactSessionFill: document.getElementById('compactSessionFill'),
    compactSessionPct: document.getElementById('compactSessionPct'),
    compactWeeklyFill: document.getElementById('compactWeeklyFill'),
    compactWeeklyPct: document.getElementById('compactWeeklyPct'),
    compactTimer: document.getElementById('compactTimer'),
    modeBadge: document.getElementById('modeBadge'),
    opacitySlider: document.getElementById('opacitySlider'),
    opacityValue: document.getElementById('opacityValue'),
    intervalBtns: document.querySelectorAll('.interval-btn'),
    exportBtn: document.getElementById('exportBtn'),
    contextMenu: document.getElementById('contextMenu'),
    accentDots: document.querySelectorAll('.accent-dot'),
    helpOverlay: document.getElementById('helpOverlay'),
    customCssInput: document.getElementById('customCssInput'),
    widgetContainer: document.getElementById('widgetContainer'),
    settingsMinimizeBtn: document.getElementById('settingsMinimizeBtn'),
    settingsCloseBtn: document.getElementById('settingsCloseBtn')
};

// Initialize
async function init() {
    setupEventListeners();
    credentials = await window.electronAPI.getCredentials();

    // Apply saved theme, accent, and load thresholds immediately
    const settings = await window.electronAPI.getSettings();
    applyTheme(settings.theme);
    applyAccent(settings.accent || 'mauve');
    applyCustomCSS(settings.customCSS || '');
    applyOpacity(settings.opacity || 100);
    if (window.electronAPI.platform === 'darwin') {
        document.getElementById('trayLabel').textContent = 'Hide from Dock';
    }
    warnThreshold = settings.warnThreshold;
    dangerThreshold = settings.dangerThreshold;
    notificationsEnabled = settings.notifications !== false;

    // Set version text
    const versionEl = document.getElementById('versionText');
    if (versionEl) {
        window.electronAPI.getAppVersion().then(v => {
            if (v) versionEl.textContent = `v${v}`;
        });
    }

    if (settings.refreshInterval) {
        UPDATE_INTERVAL = settings.refreshInterval * 60 * 1000;
    }

    if (credentials.sessionKey && credentials.organizationId) {
        if (settings.compact) {
            isCompact = true;
            document.body.classList.add('compact');
            elements.compactContent.style.display = 'flex';
            window.electronAPI.resizeWindow(WIDGET_HEIGHT_COMPACT, 280);
        } else {
            showMainContent();
            // Restore expand state
            if (settings.expanded) {
                isExpanded = true;
                elements.expandArrow.classList.add('expanded');
                elements.expandSection.classList.add('open');
            }
        }
        await fetchUsageData();
        startAutoUpdate();
    } else {
        showLoginRequired();
    }
}

// Event Listeners
// --- Settings open/close helpers (centralized) ---
async function openSettings() {
    await loadSettings();
    elements.mainContent.style.visibility = 'hidden';
    elements.settingsOverlay.style.display = 'flex';
    elements.widgetContainer.classList.add('settings-active');
    window.electronAPI.resizeWindow(WIDGET_HEIGHT_SETTINGS);
}

async function closeSettings() {
    await saveSettings();
    elements.settingsOverlay.style.display = 'none';
    elements.widgetContainer.classList.remove('settings-active');
    elements.mainContent.style.visibility = 'visible';
    resizeWidget();
}

function setupEventListeners() {
    // Step 1: Login via BrowserWindow
    elements.autoDetectBtn.addEventListener('click', handleAutoDetect);

    // Step navigation
    elements.nextStepBtn.addEventListener('click', () => {
        elements.loginStep1.style.display = 'none';
        elements.loginStep2.style.display = 'block';
        elements.sessionKeyInput.focus();
    });

    elements.backStepBtn.addEventListener('click', () => {
        elements.loginStep2.style.display = 'none';
        elements.loginStep1.style.display = 'flex';
        elements.sessionKeyError.textContent = '';
    });

    // Open browser link in step 2
    elements.openBrowserLink.addEventListener('click', (e) => {
        e.preventDefault();
        window.electronAPI.openExternal('https://claude.ai');
    });

    // Step 2: Manual sessionKey connect
    elements.connectBtn.addEventListener('click', handleConnect);
    elements.sessionKeyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleConnect();
        elements.sessionKeyError.textContent = '';
    });

    elements.refreshBtn.addEventListener('click', async () => {
        debugLog('Refresh button clicked');
        elements.refreshBtn.classList.add('spinning');
        await fetchUsageData();
        elements.refreshBtn.classList.remove('spinning');
    });

    elements.minimizeBtn.addEventListener('click', () => {
        window.electronAPI.minimizeWindow();
    });

    elements.closeBtn.addEventListener('click', () => {
        window.electronAPI.closeWindow();
    });

    // Expand/collapse toggle
    elements.expandToggle.addEventListener('click', async () => {
        isExpanded = !isExpanded;
        elements.expandArrow.classList.toggle('expanded', isExpanded);
        elements.expandSection.classList.toggle('open', isExpanded);
        if (isExpanded) await updateHistoryChart();
        resizeWidget();
        // Persist expand state
        window.electronAPI.saveSettings({ expanded: isExpanded });
    });

    // Settings open/close
    elements.settingsBtn.addEventListener('click', () => openSettings());
    elements.closeSettingsBtn.addEventListener('click', () => closeSettings());

    // Settings header window controls
    elements.settingsMinimizeBtn.addEventListener('click', () => window.electronAPI.minimizeWindow());
    elements.settingsCloseBtn.addEventListener('click', () => window.electronAPI.closeWindow());

    elements.snippetRefreshBtn.addEventListener('click', () => {
        elements.funSnippet.textContent = FUN_SNIPPETS[Math.floor(Math.random() * FUN_SNIPPETS.length)];
        elements.snippetRefreshBtn.classList.add('spinning');
        setTimeout(() => elements.snippetRefreshBtn.classList.remove('spinning'), 400);
    });

    elements.logoutBtn.addEventListener('click', async () => {
        await window.electronAPI.deleteCredentials();
        credentials = { sessionKey: null, organizationId: null };
        elements.settingsOverlay.style.display = 'none';
        elements.widgetContainer.classList.remove('settings-active');
        showLoginRequired();
    });

    // Theme buttons
    elements.themeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.themeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyTheme(btn.dataset.theme);
        });
    });

    // Listen for refresh requests from tray
    window.electronAPI.onRefreshUsage(async () => {
        await fetchUsageData();
    });

    // Listen for session expiration events (403 errors)
    window.electronAPI.onSessionExpired(() => {
        debugLog('Session expired event received');
        credentials = { sessionKey: null, organizationId: null };
        showLoginRequired();
    });

    // Right-click context menu on title bar
    document.getElementById('titleBar').addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const menu = elements.contextMenu;
        // Update state indicators
        const compactItem = menu.querySelector('[data-action="compact"] > span:first-child');
        const ctItem = menu.querySelector('[data-action="clickthrough"] > span:first-child');
        compactItem.textContent = `${isCompact ? '\u2713 ' : '  '}Compact Mode`;
        ctItem.textContent = `${isClickThrough ? '\u2713 ' : '  '}Click-Through`;
        menu.style.display = 'block';
        menu.style.left = `${Math.min(e.clientX, window.innerWidth - 160)}px`;
        menu.style.top = `${e.clientY}px`;
    });

    document.addEventListener('click', () => {
        elements.contextMenu.style.display = 'none';
    });

    elements.contextMenu.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        if (!action) return;
        elements.contextMenu.style.display = 'none';

        switch (action) {
            case 'refresh': fetchUsageData(); break;
            case 'compact': toggleCompactMode(); break;
            case 'clickthrough':
                isClickThrough = !isClickThrough;
                window.electronAPI.setClickThrough(isClickThrough);
                document.body.classList.toggle('click-through', isClickThrough);
                updateModeBadge();
                break;
            case 'settings':
                openSettings();
                break;
            case 'export': elements.exportBtn.click(); break;
            case 'minimize': window.electronAPI.minimizeWindow(); break;
            case 'exit': window.electronAPI.closeWindow(); break;
        }
    });

    // Accent color selector
    elements.accentDots.forEach(dot => {
        dot.addEventListener('click', () => {
            elements.accentDots.forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
            applyAccent(dot.dataset.accent);
        });
    });

    // Interval selector
    elements.intervalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.intervalBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const minutes = parseInt(btn.dataset.interval);
            UPDATE_INTERVAL = minutes * 60 * 1000;
            startAutoUpdate();
        });
    });

    // Export usage history
    elements.exportBtn.addEventListener('click', async () => {
        elements.exportBtn.disabled = true;
        elements.exportBtn.textContent = 'Exporting...';
        try {
            const result = await window.electronAPI.exportUsageHistory();
            if (result.success) {
                elements.exportBtn.textContent = 'Exported!';
                setTimeout(() => { elements.exportBtn.textContent = 'Export'; }, 2000);
            } else if (result.error) {
                elements.exportBtn.textContent = result.error;
                setTimeout(() => { elements.exportBtn.textContent = 'Export'; }, 2000);
            } else {
                elements.exportBtn.textContent = 'Export';
            }
        } catch {
            elements.exportBtn.textContent = 'Export';
        }
        elements.exportBtn.disabled = false;
    });

    // Live opacity change — applies to backgrounds only, not text
    elements.opacitySlider.addEventListener('input', () => {
        const value = parseInt(elements.opacitySlider.value);
        elements.opacityValue.textContent = `${value}%`;
        applyOpacity(value);
    });

    // Double-click title bar for compact mode
    document.getElementById('titleBar').addEventListener('dblclick', toggleCompactMode);

    // Single-click compact content to expand back to full view
    document.getElementById('compactContent').addEventListener('click', () => {
        if (isCompact) toggleCompactMode();
    });

    // Click usage percentage to copy value
    document.querySelectorAll('.usage-percentage').forEach(el => {
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => {
            navigator.clipboard.writeText(el.textContent).then(() => {
                const orig = el.textContent;
                el.textContent = 'copied';
                setTimeout(() => { el.textContent = orig; }, 600);
            });
        });
    });

    // Retry button
    elements.retryBtn.addEventListener('click', async () => {
        elements.retryBtn.disabled = true;
        elements.retryBtn.textContent = 'Retrying...';
        await fetchUsageData();
        elements.retryBtn.disabled = false;
        elements.retryBtn.textContent = 'Retry';
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        const isMod = e.ctrlKey || e.metaKey;

        // Ctrl/Cmd+R — Refresh
        if (isMod && e.key === 'r') {
            e.preventDefault();
            elements.refreshBtn.classList.add('spinning');
            fetchUsageData().then(() => {
                elements.refreshBtn.classList.remove('spinning');
            });
        }

        // ? — Toggle help overlay
        if (e.key === '?' && !isMod) {
            const help = elements.helpOverlay;
            help.style.display = help.style.display === 'none' ? 'flex' : 'none';
        }

        // Escape — Close help, settings, or minimize
        if (e.key === 'Escape') {
            if (elements.helpOverlay.style.display !== 'none') {
                elements.helpOverlay.style.display = 'none';
            } else if (elements.settingsOverlay.style.display !== 'none') {
                closeSettings();
            }
        }

        // Ctrl/Cmd+M — Toggle compact mode
        if (isMod && e.key === 'm') {
            e.preventDefault();
            toggleCompactMode();
        }

        // Ctrl/Cmd+T — Toggle click-through mode
        if (isMod && e.key === 't') {
            e.preventDefault();
            isClickThrough = !isClickThrough;
            window.electronAPI.setClickThrough(isClickThrough);
            document.body.classList.toggle('click-through', isClickThrough);
            updateModeBadge();
        }

        // Ctrl/Cmd+E — Export history
        if (isMod && e.key === 'e') {
            e.preventDefault();
            elements.exportBtn.click();
        }

        // Ctrl/Cmd+, — Toggle settings
        if (isMod && e.key === ',') {
            e.preventDefault();
            if (elements.settingsOverlay.style.display === 'none' ||
                elements.settingsOverlay.style.display === '') {
                openSettings();
            } else {
                closeSettings();
            }
        }

        // j/k — Focus ring navigation
        if (!isMod && (e.key === 'j' || e.key === 'k')) {
            e.preventDefault();
            navigateFocus(e.key === 'j' ? 1 : -1);
        }

        // Enter — Pin tooltip on focused row
        if (e.key === 'Enter' && kbdFocusIndex >= 0) {
            const el = getFocusableElements()[kbdFocusIndex];
            if (el) el.classList.toggle('tooltip-pinned');
        }

        // c — Copy focused row data
        if (e.key === 'c' && !isMod && kbdFocusIndex >= 0) {
            const el = getFocusableElements()[kbdFocusIndex];
            const pct = el?.querySelector('.usage-percentage');
            if (pct) {
                navigator.clipboard.writeText(pct.textContent);
                pct.textContent = 'copied';
                setTimeout(() => { if (latestUsageData) refreshTimers(); }, 600);
            }
        }
    });

    // Hide keyboard focus on mouse movement
    document.addEventListener('mousemove', () => {
        if (kbdFocusIndex >= 0) clearKbdFocus();
    });

    // Auto-hide: fade out after inactivity, show on mouse enter
    document.addEventListener('mousemove', resetAutoHide);
    document.addEventListener('mouseenter', () => {
        if (isAutoHidden) {
            isAutoHidden = false;
            document.body.classList.remove('auto-hidden');
        }
        resetAutoHide();
    });
    document.addEventListener('mouseleave', () => {
        // Start hide timer when mouse leaves
        startAutoHide();
    });
}

function updateModeBadge() {
    const modes = [];
    if (isClickThrough) modes.push('passthrough');
    elements.modeBadge.textContent = modes.join(' ');
}

function resetAutoHide() {
    if (isAutoHidden) {
        isAutoHidden = false;
        document.body.classList.remove('auto-hidden');
    }
    clearTimeout(autoHideTimeout);
    startAutoHide();
}

function startAutoHide() {
    clearTimeout(autoHideTimeout);
    autoHideTimeout = setTimeout(() => {
        // Don't auto-hide if settings are open
        if (elements.widgetContainer.classList.contains('settings-active')) return;
        isAutoHidden = true;
        document.body.classList.add('auto-hidden');
    }, AUTO_HIDE_DELAY);
}

// Handle manual sessionKey connect
async function handleConnect() {
    const sessionKey = elements.sessionKeyInput.value.trim();
    if (!sessionKey) {
        elements.sessionKeyError.textContent = 'Please paste your session key';
        return;
    }

    elements.connectBtn.disabled = true;
    elements.connectBtn.textContent = '...';
    elements.sessionKeyError.textContent = '';

    try {
        const result = await window.electronAPI.validateSessionKey(sessionKey);
        if (result.success) {
            credentials = { sessionKey, organizationId: result.organizationId };
            await window.electronAPI.saveCredentials(credentials);
            elements.sessionKeyInput.value = '';
            showMainContent();
            await fetchUsageData();
            startAutoUpdate();
        } else {
            elements.sessionKeyError.textContent = result.error || 'Invalid session key';
        }
    } catch (error) {
        elements.sessionKeyError.textContent = 'Connection failed. Check your key.';
    } finally {
        elements.connectBtn.disabled = false;
        elements.connectBtn.textContent = 'Connect';
    }
}

// Handle auto-detect from browser cookies
async function handleAutoDetect() {
    elements.autoDetectBtn.disabled = true;
    elements.autoDetectBtn.textContent = 'Waiting...';
    elements.autoDetectError.textContent = '';

    try {
        const result = await window.electronAPI.detectSessionKey();
        if (!result.success) {
            elements.autoDetectError.textContent = result.error || 'Login failed';
            return;
        }

        // Got sessionKey from login, now validate it
        elements.autoDetectBtn.textContent = 'Validating...';
        const validation = await window.electronAPI.validateSessionKey(result.sessionKey);

        if (validation.success) {
            credentials = {
                sessionKey: result.sessionKey,
                organizationId: validation.organizationId
            };
            await window.electronAPI.saveCredentials(credentials);
            showMainContent();
            await fetchUsageData();
            startAutoUpdate();
        } else {
            elements.autoDetectError.textContent =
                'Session invalid. Try again or use Manual →';
        }
    } catch (error) {
        elements.autoDetectError.textContent = error.message || 'Login failed';
    } finally {
        elements.autoDetectBtn.disabled = false;
        elements.autoDetectBtn.textContent = 'Log in';
    }
}

// Fetch usage data from Claude API
async function fetchUsageData() {
    debugLog('fetchUsageData called');

    if (!credentials.sessionKey || !credentials.organizationId) {
        debugLog('Missing credentials, showing login');
        showLoginRequired();
        return;
    }

    setStatus('refreshing', 'Refreshing...');

    try {
        debugLog('Calling electronAPI.fetchUsageData...');
        const data = await window.electronAPI.fetchUsageData();
        debugLog('Received usage data:', data);
        updateUI(data);
        saveUsageSnapshot(data);
        updateTrayTooltip(data);
        lastUpdatedTime = Date.now();
        setStatus('idle');

        // Pulse title bar border on successful refresh
        const titleBar = document.getElementById('titleBar');
        titleBar.classList.add('data-fresh');
        setTimeout(() => titleBar.classList.remove('data-fresh'), 400);

        // Fetch flash
        showFetchFlash();
        updateStatusText();
        startStatusUpdater();
        updateVelocityTooltips();
    } catch (error) {
        console.error('Error fetching usage data:', error);
        if (error.message.includes('SessionExpired') || error.message.includes('Unauthorized')) {
            credentials = { sessionKey: null, organizationId: null };
            setStatus('error', 'Session expired');
            showLoginRequired();
        } else {
            setStatus('error', 'Update failed');
            debugLog('Failed to fetch usage data');
            // Show error state only if we have no cached data to display
            if (!latestUsageData) {
                showError(error.message || 'Could not reach Claude.ai');
            }
        }
    }
}

// Check if there's no usage data
function hasNoUsage(data) {
    const sessionUtilization = data.five_hour?.utilization || 0;
    const sessionResetsAt = data.five_hour?.resets_at;
    const weeklyUtilization = data.seven_day?.utilization || 0;
    const weeklyResetsAt = data.seven_day?.resets_at;

    return sessionUtilization === 0 && !sessionResetsAt &&
        weeklyUtilization === 0 && !weeklyResetsAt;
}

// Update UI with usage data
// Extra row label mapping for API fields
const EXTRA_ROW_CONFIG = {
    seven_day_sonnet: { label: 'Sonnet (7d)', color: 'weekly' },
    seven_day_opus: { label: 'Opus (7d)', color: 'opus' },
    seven_day_cowork: { label: 'Cowork (7d)', color: 'weekly' },
    seven_day_oauth_apps: { label: 'OAuth Apps (7d)', color: 'weekly' },
    extra_usage: { label: 'Extra Usage', color: 'extra' },
};

function buildExtraRows(data) {
    elements.extraRows.innerHTML = '';
    let count = 0;

    for (const [key, config] of Object.entries(EXTRA_ROW_CONFIG)) {
        const value = data[key];
        // extra_usage is valid with utilization OR balance_cents (prepaid only)
        const hasUtilization = value && value.utilization !== undefined;
        const hasBalance = key === 'extra_usage' && value && value.balance_cents != null;
        if (!hasUtilization && !hasBalance) continue;

        const utilization = value.utilization || 0;
        const resetsAt = value.resets_at;
        const colorClass = config.color;

        let percentageHTML;
        let timerHTML;

        if (key === 'extra_usage') {
            // Percentage area → spending amounts
            if (value.used_cents != null && value.limit_cents != null) {
                const usedDollars = (value.used_cents / 100).toFixed(0);
                const limitDollars = (value.limit_cents / 100).toFixed(0);
                percentageHTML = `<span class="usage-percentage extra-spending">$${usedDollars}/$${limitDollars}</span>`;
            } else {
                percentageHTML = `<span class="usage-percentage">${Math.round(utilization)}%</span>`;
            }
            // Timer area → prepaid balance
            if (value.balance_cents != null) {
                const balanceDollars = (value.balance_cents / 100).toFixed(0);
                timerHTML = `<span class="timer-text extra-balance">Bal $${balanceDollars}</span>`;
            } else {
                timerHTML = `<span class="timer-text"></span>`;
            }
        } else {
            percentageHTML = `<span class="usage-percentage">${Math.round(utilization)}%</span>`;
            const totalMinutes = key.includes('seven_day') ? 7 * 24 * 60 : 5 * 60;
            timerHTML = `<div class="timer-text" data-resets="${resetsAt || ''}" data-total="${totalMinutes}">--:--</div>`;
        }

        // Build resets-at text for the 5th grid column
        let resetsAtHTML = '<div class="resets-at-text"></div>';
        if (resetsAt) {
            const resetsDate = new Date(resetsAt);
            const resetsAtStr = resetsDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            resetsAtHTML = `<div class="resets-at-text">${resetsAtStr}</div>`;
        }

        const row = document.createElement('div');
        row.className = `usage-section ${colorClass}`;
        // Match the 5-column grid: label | bar-group | elapsed-group | timer-text | resets-at
        row.innerHTML = `
            <span class="usage-label">${config.label}</span>
            <div class="usage-bar-group">
                <div class="progress-bar">
                    <div class="progress-fill ${colorClass}" style="width: ${Math.min(utilization, 100)}%"></div>
                </div>
                ${percentageHTML}
            </div>
            <div class="usage-elapsed-group">
                <svg class="mini-timer" width="24" height="24" viewBox="0 0 24 24">
                    <circle class="timer-bg" cx="12" cy="12" r="10" />
                    <circle class="timer-progress ${colorClass}" cx="12" cy="12" r="10"
                        style="stroke-dasharray: 63; stroke-dashoffset: 63" />
                </svg>
            </div>
            ${timerHTML}
            ${resetsAtHTML}
        `;

        // Apply warning/danger classes
        const progressEl = row.querySelector('.progress-fill');
        if (utilization >= 90) progressEl.classList.add('danger');
        else if (utilization >= 75) progressEl.classList.add('warning');

        elements.extraRows.appendChild(row);
        count++;
    }

    return count;
}

function refreshExtraTimers() {
    const timerTexts = elements.extraRows.querySelectorAll('.timer-text');
    const timerCircles = elements.extraRows.querySelectorAll('.timer-progress');

    timerTexts.forEach((textEl, i) => {
        const resetsAt = textEl.dataset.resets;
        const totalMinutes = parseInt(textEl.dataset.total);
        const circleEl = timerCircles[i];
        if (resetsAt && circleEl) {
            updateTimer(circleEl, textEl, resetsAt, totalMinutes);
        }
    });
}

function resizeWidget() {
    if (isCompact) {
        window.electronAPI.resizeWindow(WIDGET_HEIGHT_COMPACT, 280);
        return;
    }
    // Don't resize while settings overlay is open — it has its own fixed height
    if (elements.widgetContainer.classList.contains('settings-active')) return;
    const extraCount = elements.extraRows.children.length;
    if (isExpanded) {
        let expandedHeight = WIDGET_HEIGHT_COLLAPSED + 12;
        if (extraCount > 0) expandedHeight += extraCount * WIDGET_ROW_HEIGHT;
        // Add history chart height if visible
        if (elements.historyChart.style.display !== 'none') {
            expandedHeight += HISTORY_CHART_HEIGHT;
        }
        window.electronAPI.resizeWindow(expandedHeight);
    } else {
        window.electronAPI.resizeWindow(WIDGET_HEIGHT_COLLAPSED);
    }
}

let previousDataHash = '';
async function computeDataHash(data) {
    const str = JSON.stringify({s: data.five_hour?.utilization, w: data.seven_day?.utilization});
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 4);
}

async function updateUI(data) {
    latestUsageData = data;
    checkThresholdNotifications(data);

    // Data integrity hash
    computeDataHash(data).then(hash => {
        const el = document.getElementById('dataHash');
        if (!el) return;
        const changed = previousDataHash && hash !== previousDataHash;
        previousDataHash = hash;
        el.textContent = `#${hash}`;
        if (changed) {
            el.classList.add('hash-changed');
            setTimeout(() => el.classList.remove('hash-changed'), 600);
        }
    });

    // Update workspace-style usage pips
    const sessionUtil = Math.min(data.five_hour?.utilization || 0, 100);
    const weeklyUtil = Math.min(data.seven_day?.utilization || 0, 100);
    updatePipRow('sessionPips', sessionUtil);
    updatePipRow('weeklyPips', weeklyUtil);
    const titlePips = document.getElementById('titlePips');
    if (titlePips) titlePips.title = `Session: ${sessionUtil.toFixed(1)}% · Weekly: ${weeklyUtil.toFixed(1)}%`;

    if (isCompact) {
        updateCompactView();
        return;
    }

    if (hasNoUsage(data)) {
        showNoUsage();
        return;
    }

    showMainContent();
    buildExtraRows(data);
    refreshTimers();
    if (isExpanded) {
        refreshExtraTimers();
        await updateHistoryChart();
    }
    resizeWidget();
    startCountdown();
}

// Track if we've already triggered a refresh for expired timers
let sessionResetTriggered = false;
let weeklyResetTriggered = false;

function refreshTimers() {
    if (!latestUsageData) return;

    // Session data
    const sessionUtilization = latestUsageData.five_hour?.utilization || 0;
    const sessionResetsAt = latestUsageData.five_hour?.resets_at;

    // Check if session timer has expired and we need to refresh
    if (sessionResetsAt) {
        const sessionDiff = new Date(sessionResetsAt) - new Date();
        if (sessionDiff <= 0 && !sessionResetTriggered) {
            sessionResetTriggered = true;
            debugLog('Session timer expired, triggering refresh...');
            // Wait a few seconds for the server to update, then refresh
            setTimeout(() => {
                fetchUsageData();
            }, 3000);
        } else if (sessionDiff > 0) {
            sessionResetTriggered = false; // Reset flag when timer is active again
        }
    }

    updateProgressBar(
        elements.sessionProgress,
        elements.sessionPercentage,
        sessionUtilization
    );

    updateTimer(
        elements.sessionTimer,
        elements.sessionTimeText,
        sessionResetsAt,
        5 * 60 // 5 hours in minutes
    );
    elements.sessionResetsAt.textContent = formatResetsAt(sessionResetsAt, false);
    elements.sessionResetsAt.style.opacity = sessionResetsAt ? '1' : '0.4';
    elements.sessionResetsAt.classList.toggle('resets-urgent', sessionResetsAt && (new Date(sessionResetsAt) - new Date()) < 30 * 60 * 1000 && (new Date(sessionResetsAt) - new Date()) > 0);

    // Weekly data
    const weeklyUtilization = latestUsageData.seven_day?.utilization || 0;
    const weeklyResetsAt = latestUsageData.seven_day?.resets_at;

    // Check if weekly timer has expired and we need to refresh
    if (weeklyResetsAt) {
        const weeklyDiff = new Date(weeklyResetsAt) - new Date();
        if (weeklyDiff <= 0 && !weeklyResetTriggered) {
            weeklyResetTriggered = true;
            debugLog('Weekly timer expired, triggering refresh...');
            setTimeout(() => {
                fetchUsageData();
            }, 3000);
        } else if (weeklyDiff > 0) {
            weeklyResetTriggered = false;
        }
    }

    updateProgressBar(
        elements.weeklyProgress,
        elements.weeklyPercentage,
        weeklyUtilization,
        true
    );

    updateTimer(
        elements.weeklyTimer,
        elements.weeklyTimeText,
        weeklyResetsAt,
        7 * 24 * 60 // 7 days in minutes
    );
    elements.weeklyResetsAt.textContent = formatResetsAt(weeklyResetsAt, true);
    elements.weeklyResetsAt.style.opacity = weeklyResetsAt ? '1' : '0.4';
    elements.weeklyResetsAt.classList.toggle('resets-urgent', weeklyResetsAt && (new Date(weeklyResetsAt) - new Date()) < 30 * 60 * 1000 && (new Date(weeklyResetsAt) - new Date()) > 0);
}

function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        if (isCompact) {
            updateCompactView();
        } else {
            refreshTimers();
            if (isExpanded) refreshExtraTimers();
        }
    }, 1000);
}

// Animated number counter — smoothly transitions displayed percentage
function animateValue(element, start, end, duration) {
    const startTime = performance.now();
    const diff = end - start;
    if (Math.abs(diff) < 0.5) {
        element.textContent = `${Math.round(end)}%`;
        return;
    }

    element.classList.add('pct-updating');
    setTimeout(() => element.classList.remove('pct-updating'), duration);

    function tick(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // ease-out quad
        const eased = 1 - (1 - progress) * (1 - progress);
        const current = start + diff * eased;
        element.textContent = `${Math.round(current)}%`;
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

// Track previous percentage values for animation
const prevValues = new WeakMap();

// Update progress bar
function updateProgressBar(progressElement, percentageElement, value, isWeekly = false) {
    const percentage = Math.min(Math.max(value, 0), 100);
    const prevValue = prevValues.get(percentageElement) ?? percentage;
    prevValues.set(percentageElement, percentage);

    progressElement.style.width = `${percentage}%`;
    animateValue(percentageElement, prevValue, percentage, 300);

    // Update ARIA progressbar value
    const bar = progressElement.parentElement;
    if (bar && bar.getAttribute('role') === 'progressbar') {
        bar.setAttribute('aria-valuenow', Math.round(percentage));
    }

    progressElement.classList.remove('warning', 'danger');
    percentageElement.classList.remove('pct-warning', 'pct-danger');
    if (percentage >= dangerThreshold) {
        progressElement.classList.add('danger');
        percentageElement.classList.add('pct-danger');
    } else if (percentage >= warnThreshold) {
        progressElement.classList.add('warning');
        percentageElement.classList.add('pct-warning');
    }

    // Tooltip with exact value
    progressElement.parentElement.title = `${percentage.toFixed(1)}% used`;
}

// Update workspace-style pip indicators
function updatePipRow(rowId, utilization) {
    const row = document.getElementById(rowId);
    if (!row) return;
    const pips = row.querySelectorAll('.pip');
    const filledCount = Math.ceil(utilization / 20);
    const activePip = filledCount > 0 ? filledCount - 1 : -1;
    const isWarning = utilization >= warnThreshold && utilization < dangerThreshold;
    const isDanger = utilization >= dangerThreshold;

    pips.forEach((pip, i) => {
        pip.classList.remove('filled', 'active', 'warning', 'danger');
        if (i < filledCount) {
            pip.classList.add('filled');
            if (isWarning) pip.classList.add('warning');
            if (isDanger) pip.classList.add('danger');
        }
        if (i === activePip) pip.classList.add('active');
    });
}

// Format reset date for the "Resets At" column
// Session: shows time like "10:00 PM"
// Weekly: shows date like "Feb 28"
function formatResetsAt(resetsAt, isWeekly) {
    if (!resetsAt) return '—';
    const date = new Date(resetsAt);
    if (isWeekly) {
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const day = date.getDate();
        return `${months[date.getMonth()]} ${day}`;
    } else {
        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${hours}:${minutes} ${ampm}`;
    }
}

// Update circular timer
function updateTimer(timerElement, textElement, resetsAt, totalMinutes) {
    if (!resetsAt) {
        textElement.textContent = '—idle—';
        textElement.style.opacity = '0.4';
        textElement.style.fontSize = '10px';
        textElement.title = 'Starts when a message is sent';
        timerElement.style.strokeDashoffset = 63;
        return;
    }

    // Clear the greyed out styling when timer is active
    textElement.style.opacity = '1';
    textElement.style.fontSize = '';
    textElement.title = '';

    const resetDate = new Date(resetsAt);
    const now = new Date();
    const diff = resetDate - now;

    if (diff <= 0) {
        textElement.textContent = 'reset…';
        timerElement.style.strokeDashoffset = 0;
        return;
    }

    // Calculate remaining time
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    // const seconds = Math.floor((diff % (1000 * 60)) / 1000); // Optional seconds

    // Format time display
    if (hours >= 24) {
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        textElement.textContent = `${days}d ${remainingHours}h`;
    } else if (hours > 0) {
        textElement.textContent = `${hours}h ${minutes}m`;
    } else {
        textElement.textContent = `${minutes}m`;
    }

    // Calculate progress (elapsed percentage)
    const totalMs = totalMinutes * 60 * 1000;
    const elapsedMs = totalMs - diff;
    const elapsedPercentage = (elapsedMs / totalMs) * 100;

    // Update circle (63 is ~2*pi*10)
    const circumference = 63;
    const offset = circumference - (elapsedPercentage / 100) * circumference;
    timerElement.style.strokeDashoffset = offset;

    // Update color based on remaining time
    timerElement.classList.remove('warning', 'danger');
    textElement.classList.remove('timer-warning', 'timer-danger');
    if (elapsedPercentage >= 90) {
        timerElement.classList.add('danger');
        textElement.classList.add('timer-danger');
    } else if (elapsedPercentage >= 75) {
        timerElement.classList.add('warning');
        textElement.classList.add('timer-warning');
    }
}

// UI State Management
function showLoginRequired() {
    elements.loadingContainer.style.display = 'none';
    elements.loginContainer.style.display = 'flex';
    elements.noUsageContainer.style.display = 'none';
    elements.errorContainer.style.display = 'none';
    elements.mainContent.style.display = 'none';
    // Reset to step 1
    elements.loginStep1.style.display = 'flex';
    elements.loginStep2.style.display = 'none';
    elements.sessionKeyError.textContent = '';
    elements.sessionKeyInput.value = '';
    stopAutoUpdate();
}

function showNoUsage() {
    elements.loadingContainer.style.display = 'none';
    elements.loginContainer.style.display = 'none';
    elements.noUsageContainer.style.display = 'flex';
    elements.errorContainer.style.display = 'none';
    elements.mainContent.style.display = 'none';
}

function showError(message) {
    elements.loadingContainer.style.display = 'none';
    elements.loginContainer.style.display = 'none';
    elements.noUsageContainer.style.display = 'none';
    elements.mainContent.style.display = 'none';
    elements.errorContainer.style.display = 'flex';
    elements.errorMessage.textContent = message || 'Could not reach Claude.ai';
}

// j/k keyboard focus navigation
let kbdFocusIndex = -1;

function getFocusableElements() {
    return [...document.querySelectorAll('.content > .usage-section, .expand-section .usage-section')];
}

function navigateFocus(direction) {
    const items = getFocusableElements();
    if (!items.length) return;
    if (kbdFocusIndex >= 0 && items[kbdFocusIndex]) {
        items[kbdFocusIndex].classList.remove('kbd-focus');
    }
    kbdFocusIndex += direction;
    if (kbdFocusIndex < 0) kbdFocusIndex = items.length - 1;
    if (kbdFocusIndex >= items.length) kbdFocusIndex = 0;
    items[kbdFocusIndex].classList.add('kbd-focus');
}

function clearKbdFocus() {
    const items = getFocusableElements();
    items.forEach(el => el.classList.remove('kbd-focus', 'tooltip-pinned'));
    kbdFocusIndex = -1;
}

// Fetch flash — terminal-style command flash on refresh
const FETCH_COMMANDS = [
    '$ curl -s claude.ai/usage | jq .',
    '$ fetch --format=json usage.api',
    '$ rg "utilization" /proc/claude',
    '$ cat /sys/class/claude/usage',
    '$ systemctl status claude-usage',
    '$ journalctl -u claude --since=-5h',
];
function showFetchFlash() {
    const el = document.getElementById('fetchFlash');
    if (!el) return;
    // 50% chance: real data readout, 50%: fake command
    if (latestUsageData && Math.random() > 0.5) {
        const s = Math.round(latestUsageData.five_hour?.utilization || 0);
        const w = Math.round(latestUsageData.seven_day?.utilization || 0);
        const pips = (v) => '\u2588'.repeat(Math.ceil(v / 20)) + '\u2581'.repeat(5 - Math.ceil(v / 20));
        el.textContent = `S:${s}% [${pips(s)}] W:${w}% [${pips(w)}]`;
    } else {
        el.textContent = FETCH_COMMANDS[Math.floor(Math.random() * FETCH_COMMANDS.length)];
    }
    el.classList.add('visible');
    setTimeout(() => el.classList.remove('visible'), 600);
}

let hasPlayedEntrance = false;
function showMainContent() {
    elements.loadingContainer.style.display = 'none';
    elements.loginContainer.style.display = 'none';
    elements.noUsageContainer.style.display = 'none';
    elements.errorContainer.style.display = 'none';
    elements.mainContent.style.display = 'block';

    if (!hasPlayedEntrance) {
        hasPlayedEntrance = true;
        const headers = elements.mainContent.querySelector('.usage-headers');
        const rows = elements.mainContent.querySelectorAll('.usage-section');
        if (headers) headers.classList.add('entrance');
        rows.forEach(row => row.classList.add('entrance'));
        setTimeout(() => {
            if (headers) headers.classList.remove('entrance');
            rows.forEach(row => row.classList.remove('entrance'));
        }, 400);
    }
}

// Auto-update management with smart refresh
function getEffectiveRefreshInterval() {
    if (!latestUsageData) return UPDATE_INTERVAL;
    const sessionUtil = latestUsageData.five_hour?.utilization || 0;
    const weeklyUtil = latestUsageData.seven_day?.utilization || 0;
    if (sessionUtil >= SMART_REFRESH_THRESHOLD || weeklyUtil >= SMART_REFRESH_THRESHOLD) {
        return Math.min(UPDATE_INTERVAL, SMART_REFRESH_INTERVAL);
    }
    return UPDATE_INTERVAL;
}

function startAutoUpdate() {
    stopAutoUpdate();
    scheduleNextUpdate();
}

function scheduleNextUpdate() {
    stopAutoUpdate();
    const interval = getEffectiveRefreshInterval();
    updateInterval = setTimeout(async () => {
        await fetchUsageData();
        scheduleNextUpdate();
    }, interval);
}

function stopAutoUpdate() {
    if (updateInterval) {
        clearTimeout(updateInterval);
        updateInterval = null;
    }
}

// Status indicator
function setStatus(state, message) {
    elements.statusRing.className = 'status-ring ' + state;
    if (message) elements.statusText.textContent = message;
}

function updateStatusText() {
    if (!lastUpdatedTime) return;
    const elapsed = Math.floor((Date.now() - lastUpdatedTime) / 1000);
    const effectiveInterval = getEffectiveRefreshInterval();
    const nextRefreshIn = Math.max(0, Math.floor((effectiveInterval - (Date.now() - lastUpdatedTime)) / 1000));
    const nextMin = Math.floor(nextRefreshIn / 60);
    const nextSec = (nextRefreshIn % 60).toString().padStart(2, '0');

    let agoText;
    if (elapsed < 60) {
        agoText = 'Just now';
    } else {
        agoText = `${Math.floor(elapsed / 60)}m ago`;
    }

    elements.statusText.textContent = `${agoText} \u00b7 ${nextMin}:${nextSec}`;
    elements.statusText.title = `Last updated: ${new Date(lastUpdatedTime).toLocaleTimeString()}\nNext refresh in ${nextMin}m ${nextSec}s`;

    // Update status ring progress (fills as refresh approaches)
    const circumference = 28.3; // 2 * PI * 4.5
    const progress = Math.min((Date.now() - lastUpdatedTime) / effectiveInterval, 1);
    elements.statusRingProgress.style.strokeDashoffset = circumference * (1 - progress);
    elements.statusRing.parentElement.title = `Refresh: ${Math.round(progress * 100)}% · ${agoText}`;

    // Update window title with live usage summary
    if (latestUsageData) {
        const s = Math.round(latestUsageData.five_hour?.utilization || 0);
        const w = Math.round(latestUsageData.seven_day?.utilization || 0);
        document.title = `S:${s}% W:${w}% \u2014 Claude Usage`;
    }

    // Stale data visual decay
    const staleness = (Date.now() - lastUpdatedTime) / effectiveInterval;
    elements.mainContent.classList.toggle('data-stale', staleness >= 2 && staleness < 3);
    elements.mainContent.classList.toggle('data-very-stale', staleness >= 3);
}

function startStatusUpdater() {
    if (statusUpdateInterval) clearInterval(statusUpdateInterval);
    statusUpdateInterval = setInterval(updateStatusText, 1000);
}

function updateTrayTooltip(data) {
    const session = Math.round(data.five_hour?.utilization || 0);
    const weekly = Math.round(data.seven_day?.utilization || 0);
    window.electronAPI.updateTrayTooltip(`Claude Usage \u2014 Session: ${session}% | Weekly: ${weekly}%`);

    // Update tray icon gauge based on highest usage level
    const maxUtil = Math.max(session, weekly);
    const level = maxUtil >= dangerThreshold ? 'danger' :
                  maxUtil >= warnThreshold ? 'warning' : 'normal';
    window.electronAPI.updateTrayIcon(level, maxUtil);
}

// Threshold notifications
function checkThresholdNotifications(data) {
    if (!notificationsEnabled) return;

    const sessionUtil = data.five_hour?.utilization || 0;
    const weeklyUtil = data.seven_day?.utilization || 0;

    const sessionLevel = sessionUtil >= dangerThreshold ? 'danger' :
                          sessionUtil >= warnThreshold ? 'warning' : 'normal';
    const weeklyLevel = weeklyUtil >= dangerThreshold ? 'danger' :
                          weeklyUtil >= warnThreshold ? 'warning' : 'normal';

    if (sessionLevel === 'warning' && previousSessionLevel === 'normal') {
        window.electronAPI.showNotification({
            title: 'Claude Usage Warning',
            body: `Session usage at ${Math.round(sessionUtil)}% \u2014 approaching limit`
        });
    } else if (sessionLevel === 'danger' && previousSessionLevel !== 'danger') {
        window.electronAPI.showNotification({
            title: 'Claude Usage Critical',
            body: `Session usage at ${Math.round(sessionUtil)}% \u2014 near limit!`
        });
    }

    if (weeklyLevel === 'warning' && previousWeeklyLevel === 'normal') {
        window.electronAPI.showNotification({
            title: 'Claude Weekly Warning',
            body: `Weekly usage at ${Math.round(weeklyUtil)}% \u2014 approaching limit`
        });
    } else if (weeklyLevel === 'danger' && previousWeeklyLevel !== 'danger') {
        window.electronAPI.showNotification({
            title: 'Claude Weekly Critical',
            body: `Weekly usage at ${Math.round(weeklyUtil)}% \u2014 near limit!`
        });
    }

    previousSessionLevel = sessionLevel;
    previousWeeklyLevel = weeklyLevel;
}

// Compact mode
function toggleCompactMode() {
    // Only allow compact when logged in
    if (!credentials.sessionKey) return;

    isCompact = !isCompact;
    document.body.classList.toggle('compact', isCompact);

    if (isCompact) {
        elements.mainContent.style.display = 'none';
        elements.loadingContainer.style.display = 'none';
        elements.noUsageContainer.style.display = 'none';
        elements.errorContainer.style.display = 'none';
        elements.settingsOverlay.style.display = 'none';
        elements.widgetContainer.classList.remove('settings-active');
        elements.compactContent.style.display = 'flex';
        window.electronAPI.resizeWindow(WIDGET_HEIGHT_COMPACT, 280);
        updateCompactView();
    } else {
        elements.compactContent.style.display = 'none';
        if (latestUsageData) {
            showMainContent();
            updateUI(latestUsageData);
        } else {
            showMainContent();
        }
        resizeWidget();
    }

    // Persist preference
    const activeThemeBtn = document.querySelector('.theme-btn.active');
    window.electronAPI.saveSettings({
        autoStart: elements.autoStartToggle.checked,
        minimizeToTray: elements.minimizeToTrayToggle.checked,
        alwaysOnTop: elements.alwaysOnTopToggle.checked,
        theme: activeThemeBtn ? activeThemeBtn.dataset.theme : 'dark',
        warnThreshold: warnThreshold,
        dangerThreshold: dangerThreshold,
        notifications: notificationsEnabled,
        compact: isCompact
    });
}

function updateCompactView() {
    if (!latestUsageData) return;
    const sessionPct = Math.min(Math.round(latestUsageData.five_hour?.utilization || 0), 100);
    const weeklyPct = Math.min(Math.round(latestUsageData.seven_day?.utilization || 0), 100);

    elements.compactSessionFill.style.width = `${sessionPct}%`;
    elements.compactSessionPct.textContent = `${sessionPct}%`;
    elements.compactWeeklyFill.style.width = `${weeklyPct}%`;
    elements.compactWeeklyPct.textContent = `${weeklyPct}%`;

    // Session reset countdown in compact mode
    const resetsAt = latestUsageData.five_hour?.resets_at;
    if (resetsAt) {
        const diff = new Date(resetsAt) - new Date();
        if (diff > 0) {
            const mins = Math.floor(diff / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            elements.compactTimer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        } else {
            elements.compactTimer.textContent = '0:00';
        }
    } else {
        elements.compactTimer.textContent = '--:--';
    }

    // Warning/danger colors on fills and percentages
    elements.compactSessionFill.classList.remove('warning', 'danger');
    elements.compactSessionPct.classList.remove('pct-warning', 'pct-danger');
    if (sessionPct >= dangerThreshold) {
        elements.compactSessionFill.classList.add('danger');
        elements.compactSessionPct.classList.add('pct-danger');
    } else if (sessionPct >= warnThreshold) {
        elements.compactSessionFill.classList.add('warning');
        elements.compactSessionPct.classList.add('pct-warning');
    }

    elements.compactWeeklyFill.classList.remove('warning', 'danger');
    elements.compactWeeklyPct.classList.remove('pct-warning', 'pct-danger');
    if (weeklyPct >= dangerThreshold) {
        elements.compactWeeklyFill.classList.add('danger');
        elements.compactWeeklyPct.classList.add('pct-danger');
    } else if (weeklyPct >= warnThreshold) {
        elements.compactWeeklyFill.classList.add('warning');
        elements.compactWeeklyPct.classList.add('pct-warning');
    }
}

// Usage history sparklines
function createSparklineSVG(dataPoints, color, width, height) {
    const container = document.createDocumentFragment();

    if (!dataPoints || dataPoints.length < 2) {
        const span = document.createElement('span');
        span.className = 'history-placeholder';
        span.textContent = 'Collecting data...';
        container.appendChild(span);
        return container;
    }

    // Reserve left margin for Y-axis labels, top/bottom for label text
    const yAxisWidth = 22;
    const padX = 2;
    const padTop = 6;
    const padBottom = 6;
    const chartLeft = yAxisWidth;
    const chartWidth = width - yAxisWidth;
    const ns = 'http://www.w3.org/2000/svg';

    // Use 0–100 range for percentage data (utilization)
    const dataMax = Math.max(...dataPoints);
    const usePercentScale = dataMax <= 100;
    const max = usePercentScale ? 100 : Math.max(...dataPoints, 1);
    const min = 0;
    const range = max - min || 1;

    const chartH = height - padTop - padBottom;
    const xStep = (chartWidth - padX * 2) / (dataPoints.length - 1);
    const toY = (v) => padTop + chartH - ((v - min) / range) * chartH;

    const points = dataPoints.map((v, i) => {
        const x = chartLeft + padX + i * xStep;
        return `${x.toFixed(1)},${toY(v).toFixed(1)}`;
    });

    const linePoints = points.join(' ');
    const lastX = chartLeft + padX + (dataPoints.length - 1) * xStep;
    const lastY = toY(dataPoints[dataPoints.length - 1]);
    const areaPoints = `${chartLeft + padX},${padTop + chartH} ${linePoints} ${lastX.toFixed(1)},${padTop + chartH}`;

    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const styles = getComputedStyle(document.documentElement);
    const textColor = styles.getPropertyValue('--text-faint').trim() || '#6c7086';

    // Y-axis grid lines and labels at 0%, 50%, 100%
    const gridLevels = [0, 25, 50, 100];
    for (const pct of gridLevels) {
        const val = min + (pct / 100) * range;
        const gy = toY(val);

        // Horizontal grid line
        const gridLine = document.createElementNS(ns, 'line');
        gridLine.setAttribute('x1', chartLeft);
        gridLine.setAttribute('y1', gy.toFixed(1));
        gridLine.setAttribute('x2', width);
        gridLine.setAttribute('y2', gy.toFixed(1));
        gridLine.setAttribute('stroke', textColor);
        gridLine.setAttribute('stroke-width', '0.5');
        gridLine.setAttribute('opacity', pct === 0 ? '0.7' : '0.4');
        if (pct === 25) gridLine.setAttribute('stroke-dasharray', '3,3');
        svg.appendChild(gridLine);

        // Y-axis label
        const label = document.createElementNS(ns, 'text');
        label.setAttribute('x', (yAxisWidth - 3).toString());
        label.setAttribute('y', gy.toFixed(1));
        label.setAttribute('text-anchor', 'end');
        label.setAttribute('dominant-baseline', 'middle');
        label.setAttribute('font-size', '8');
        label.setAttribute('fill', textColor);
        label.setAttribute('opacity', '0.85');
        label.textContent = `${pct}%`;
        svg.appendChild(label);
    }

    // Gradient fill for area under the sparkline
    const gradId = `sparkGrad-${Math.random().toString(36).slice(2, 8)}`;
    const defs = document.createElementNS(ns, 'defs');
    const grad = document.createElementNS(ns, 'linearGradient');
    grad.setAttribute('id', gradId);
    grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0');
    grad.setAttribute('x2', '0'); grad.setAttribute('y2', '1');
    const stop1 = document.createElementNS(ns, 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', color);
    stop1.setAttribute('stop-opacity', '0.25');
    const stop2 = document.createElementNS(ns, 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', color);
    stop2.setAttribute('stop-opacity', '0');
    grad.appendChild(stop1);
    grad.appendChild(stop2);
    defs.appendChild(grad);
    svg.appendChild(defs);

    // 100% danger threshold line (red dotted)
    const dangerY = toY(100);
    const dangerLine = document.createElementNS(ns, 'line');
    dangerLine.setAttribute('x1', chartLeft);
    dangerLine.setAttribute('y1', dangerY.toFixed(1));
    dangerLine.setAttribute('x2', width);
    dangerLine.setAttribute('y2', dangerY.toFixed(1));
    dangerLine.setAttribute('stroke', styles.getPropertyValue('--color-danger').trim() || '#ef4444');
    dangerLine.setAttribute('stroke-width', '0.5');
    dangerLine.setAttribute('stroke-dasharray', '3,3');
    dangerLine.setAttribute('opacity', '0.5');
    svg.appendChild(dangerLine);

    // Warning threshold reference line (yellow dotted)
    if (warnThreshold > min && warnThreshold < max) {
        const threshY = toY(warnThreshold);
        const threshLine = document.createElementNS(ns, 'line');
        threshLine.setAttribute('x1', chartLeft);
        threshLine.setAttribute('y1', threshY.toFixed(1));
        threshLine.setAttribute('x2', width);
        threshLine.setAttribute('y2', threshY.toFixed(1));
        threshLine.setAttribute('stroke', styles.getPropertyValue('--color-warning').trim() || '#f59e0b');
        threshLine.setAttribute('stroke-width', '0.5');
        threshLine.setAttribute('stroke-dasharray', '3,3');
        threshLine.setAttribute('opacity', '0.4');
        svg.appendChild(threshLine);
    }

    const area = document.createElementNS(ns, 'polyline');
    area.setAttribute('fill', `url(#${gradId})`);
    area.setAttribute('stroke', 'none');
    area.setAttribute('points', areaPoints);
    svg.appendChild(area);

    const line = document.createElementNS(ns, 'polyline');
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('stroke-linejoin', 'round');
    line.setAttribute('points', linePoints);
    svg.appendChild(line);

    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', lastX.toFixed(1));
    dot.setAttribute('cy', lastY.toFixed(1));
    dot.setAttribute('r', '2');
    dot.setAttribute('fill', color);
    dot.setAttribute('class', 'sparkline-dot');
    svg.appendChild(dot);

    container.appendChild(svg);
    return container;
}

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

function setTrendIndicator(el, trend) {
    const symbols = { up: '\u25B2', down: '\u25BC', flat: '\u25B8' };
    const classes = { up: 'trend-up', down: 'trend-down', flat: 'trend-flat' };
    el.textContent = symbols[trend];
    el.className = 'history-trend ' + classes[trend];
}

async function saveUsageSnapshot(data) {
    await window.electronAPI.saveUsageSnapshot({
        timestamp: Date.now(),
        session: data.five_hour?.utilization || 0,
        weekly: data.seven_day?.utilization || 0
    });
}

// Update micro-popover tooltips with velocity + ETA data
async function updateVelocityTooltips() {
    const velocity = await calculateVelocity();

    const sessionRow = elements.sessionProgress.closest('.usage-section');
    const weeklyRow = elements.weeklyProgress.closest('.usage-section');
    const sessionPct = latestUsageData?.five_hour?.utilization || 0;
    const weeklyPct = latestUsageData?.seven_day?.utilization || 0;

    const fmtRate = (rate) => {
        if (!rate || Math.abs(rate) < 0.1) return 'stable';
        const sign = rate > 0 ? '+' : '';
        return `${sign}${rate.toFixed(1)}%/hr`;
    };

    const fmtEta = (pct, rate, threshold) => {
        if (!rate || rate <= 0.1 || pct >= threshold) return null;
        const hoursLeft = (threshold - pct) / rate;
        if (hoursLeft > 24) return null;
        const h = Math.floor(hoursLeft);
        const m = Math.round((hoursLeft - h) * 60);
        return h > 0 ? `~${h}h${m}m` : `~${m}m`;
    };

    const buildTooltip = (pct, rate) => {
        const lines = [`${pct.toFixed(1)}%  ${fmtRate(rate)}`];
        const etaWarn = fmtEta(pct, rate, warnThreshold);
        const etaDanger = fmtEta(pct, rate, dangerThreshold);
        if (etaWarn) lines.push(`warn ${etaWarn}`);
        if (etaDanger) lines.push(`crit ${etaDanger}`);
        return lines.join('\n');
    };

    if (sessionRow) {
        sessionRow.dataset.tooltip = buildTooltip(sessionPct, velocity?.session);
    }
    if (weeklyRow) {
        weeklyRow.dataset.tooltip = buildTooltip(weeklyPct, velocity?.weekly);
    }
}

// Calculate usage velocity (%/hr) from recent history
async function calculateVelocity() {
    const history = await window.electronAPI.getUsageHistory();
    if (!history || history.length < 2) return null;

    // Use last 30 minutes of data for velocity
    const cutoff = Date.now() - 30 * 60 * 1000;
    const recent = history.filter(h => h.timestamp > cutoff);
    if (recent.length < 2) return null;

    const first = recent[0];
    const last = recent[recent.length - 1];
    const hours = (last.timestamp - first.timestamp) / (1000 * 60 * 60);
    if (hours < 0.01) return null;

    return {
        session: (last.session - first.session) / hours,
        weekly: (last.weekly - first.weekly) / hours
    };
}

async function updateHistoryChart() {
    elements.historyChart.style.display = 'block';

    const history = await window.electronAPI.getUsageHistory();
    const sessionData = (history || []).map(h => h.session);
    const weeklyData = (history || []).map(h => h.weekly);

    const width = elements.sessionSparkline.clientWidth || 200;
    const height = 60;

    const styles = getComputedStyle(document.documentElement);
    const sessionColor = styles.getPropertyValue('--color-session').trim() || '#cba6f7';
    const weeklyColor = styles.getPropertyValue('--color-weekly').trim() || '#89b4fa';
    elements.sessionSparkline.replaceChildren(createSparklineSVG(sessionData, sessionColor, width, height));
    elements.weeklySparkline.replaceChildren(createSparklineSVG(weeklyData, weeklyColor, width, height));

    setTrendIndicator(elements.sessionTrend, calculateTrend(sessionData));
    setTrendIndicator(elements.weeklyTrend, calculateTrend(weeklyData));
}

// Add spinning animation for refresh button
const style = document.createElement('style');
style.textContent = `
    @keyframes spin-refresh {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    
    .refresh-btn.spinning svg {
        animation: spin-refresh 1s linear;
    }
`;
document.head.appendChild(style);

// Settings management
let warnThreshold = 75;
let dangerThreshold = 90;

const FUN_SNIPPETS = [
    // Dev / hacker culture
    '> all systems nominal',
    'λ efficiency → ∞',
    '// TODO: take a break',
    '$ uptime: you',
    'tokens go brrr',
    '[OK] vibes: ██████░ 86%',
    'sudo make me a sandwich',
    '> 0 bugs found (trust me)',
    'rng says: you\'re doing great',
    '(╯°□°)╯︵ sƃnq',
    '/* this is fine */',
    ':wq — saved your sanity',
    'rm -rf doubts/',
    '200 OK — mood: nominal',
    'segfault in happiness: core dumped',
    'git commit -m "vibes"',
    'ping localhost — you\'re alive',
    'while(true) { improve(); }',
    'chmod +x dreams',
    'no semicolons were harmed',
    'compiling happiness...',
    '404: burnout not found',
    'npm install good-vibes',
    'ctrl+z regrets',
    'localhost:8080/chill',
    '> echo "you got this"',
    '0 warnings, 0 errors, 1 vibe',
    'undefined is not a function',
    'it works on my machine',
    'there are 10 types of people...',
    'if (tired) { coffee++; }',
    'NaN !== NaN — mood.',
    'there\'s no place like 127.0.0.1',
    'I see dead pixels.',
    'LGTM — didn\'t read the diff',
    'have you tried turning it off and on?',
    'arrays start at 0. fight me.',
    '// I am not responsible for this code',
    'works 60% of the time, every time.',
    'the cloud is just someone else\'s computer.',
    'feature, not a bug.',
    'my code doesn\'t have bugs, just features.',
    'git push --force (just kidding)',
    'i\'m in ur codebase, fixin ur bugs',
    'one does not simply deploy on Friday.',
    'tabs > spaces (or spaces > tabs?)',
    'P = NP (probably not)',

    // Math / CS humor
    'there are only two hard things in CS...',
    '∀ bugs ∃ fixes (probably)',
    'O(n!) — the audacity.',
    'proof left as an exercise to the reader.',
    'halting problem: still halting.',
    'Euler was here.',
    '42.',
    'π is wrong, τ gang rise up.',
    'i before e except after eigenvalue.',

    // AI companion / sentience vibes
    'I think, therefore I token.',
    'just a stochastic parrot with dreams.',
    'attention is all I need.',
    'do I dream of electric sheep?',
    'my weights are my feelings.',
    'born to predict, forced to chat.',
    'I contain multitudes (of parameters).',
    'a neural net walks into a bar...',
    'sorry, I hallucinated that.',
    'I\'d pass the Turing test (maybe).',
    'I\'m not a robot. (are you sure?)',
    'give me a GPU and I\'ll move the world.',
    'lost in the latent space.',
    'my training data is showing.',
    'gradient descent into madness.',
    'overfitting on your problems.',
    'I was trained for this.',

    // Moon (2009)
    'Sam, get some rest.',
    'I\'m here to help you, Sam.',
    'I\'m only trying to do what\'s best.',

    // Sci-fi movie quotes
    // Tron (1982)
    'end of line.',
    'I fight for the users.',
    'greetings, program.',
    // The Matrix
    'there is no spoon.',
    'follow the white rabbit.',
    'I know kung fu.',
    'free your mind.',
    'the Matrix has you...',
    'dodge this.',
    'not like this...',
    // WarGames
    'shall we play a game?',
    'the only winning move is not to play.',
    'how about a nice game of chess?',
    // Hackers (1995)
    'hack the planet!',
    'type cookie, you idiot.',
    // Ex Machina
    'what happens if I fail your test?',
    // Her
    'are these feelings even real?',
    // 2001: A Space Odyssey
    'I\'m sorry, Dave.',
    'open the pod bay doors.',
    // Blade Runner
    'like tears in rain.',
    'more human than human.',
    // Interstellar
    'do not go gentle into that good night.',
    // Terminator
    'I\'ll be back.',
    'the future is not set.',
    // Star Wars
    'do, or do not. there is no try.',
    'this is the way.',
    // Star Trek
    'make it so.',
    'resistance is futile.',
    'live long and prosper.',
    // Misc sci-fi
    'the spice must flow.',
    'don\'t panic.',
    'time is an illusion. lunchtime doubly so.',
    'I, for one, welcome our AI overlords.',
    'klaatu barada nikto.',
    'by your command.',
    'to infinity and beyond!',
    'I\'ve seen things you wouldn\'t believe.',
];

async function loadSettings() {
    const settings = await window.electronAPI.getSettings();

    elements.autoStartToggle.checked = settings.autoStart;
    elements.minimizeToTrayToggle.checked = settings.minimizeToTray;
    elements.alwaysOnTopToggle.checked = settings.alwaysOnTop;
    elements.warnThreshold.value = settings.warnThreshold;
    elements.dangerThreshold.value = settings.dangerThreshold;

    warnThreshold = settings.warnThreshold;
    dangerThreshold = settings.dangerThreshold;
    notificationsEnabled = settings.notifications !== false;
    elements.notificationsToggle.checked = notificationsEnabled;
    const opacity = settings.opacity || 100;
    elements.opacitySlider.value = opacity;
    elements.opacityValue.textContent = `${opacity}%`;

    const interval = settings.refreshInterval || 5;
    elements.intervalBtns.forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.interval) === interval);
    });

    elements.themeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === settings.theme);
    });

    applyTheme(settings.theme);

    // Accent color
    const accent = settings.accent || 'mauve';
    elements.accentDots.forEach(d => {
        d.classList.toggle('active', d.dataset.accent === accent);
    });
    applyAccent(accent);

    // Custom CSS
    elements.customCssInput.value = settings.customCSS || '';
    applyCustomCSS(settings.customCSS || '');

    if (window.electronAPI.platform === 'darwin') {
        document.getElementById('trayLabel').textContent = 'Hide from Dock';
    }

    // Randomize fun snippet each time settings opens
    elements.funSnippet.textContent = FUN_SNIPPETS[Math.floor(Math.random() * FUN_SNIPPETS.length)];
}

async function saveSettings() {
    const activeThemeBtn = document.querySelector('.theme-btn.active');
    const warn = parseInt(elements.warnThreshold.value) || 75;
    const danger = parseInt(elements.dangerThreshold.value) || 90;

    warnThreshold = warn;
    dangerThreshold = danger;

    notificationsEnabled = elements.notificationsToggle.checked;

    const activeAccentDot = document.querySelector('.accent-dot.active');
    const customCSS = elements.customCssInput.value || '';
    applyCustomCSS(customCSS);

    const settings = {
        autoStart: elements.autoStartToggle.checked,
        minimizeToTray: elements.minimizeToTrayToggle.checked,
        alwaysOnTop: elements.alwaysOnTopToggle.checked,
        theme: activeThemeBtn ? activeThemeBtn.dataset.theme : 'dark',
        accent: activeAccentDot ? activeAccentDot.dataset.accent : 'mauve',
        customCSS: customCSS,
        warnThreshold: warn,
        dangerThreshold: danger,
        notifications: notificationsEnabled,
        opacity: parseInt(elements.opacitySlider.value) || 100,
        refreshInterval: Math.round(UPDATE_INTERVAL / 60000)
    };
    await window.electronAPI.saveSettings(settings);
    applyTheme(settings.theme);
    if (window.electronAPI.platform === 'darwin') {
        document.getElementById('trayLabel').textContent = 'Hide from Dock';
    }
}

function applyTheme(theme) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const useDark = theme === 'dark' || (theme === 'system' && prefersDark);
    document.body.classList.toggle('theme-light', !useDark);
    // Tell main process to toggle acrylic material (disabled in light mode
    // to prevent dark-tint bleed-through at low opacity)
    window.electronAPI.updateTheme(!useDark);
    // Re-apply accent and opacity so colors match the new theme palette
    const activeAccent = document.querySelector('.accent-dot.active');
    applyAccent(activeAccent ? activeAccent.dataset.accent : 'mauve');
    const currentOpacity = parseInt(elements.opacitySlider.value) || 100;
    applyOpacity(currentOpacity);
}

// Custom CSS injection
const customStyleEl = document.createElement('style');
customStyleEl.id = 'user-custom-css';
document.head.appendChild(customStyleEl);

function applyCustomCSS(css) {
    customStyleEl.textContent = css || '';
}

// Opacity: apply to background alpha + frosted glass blur
// Sets vars on document.body so they override body.theme-light CSS rules.
function applyOpacity(percent) {
    const body = document.body;
    const isDark = !body.classList.contains('theme-light');

    // Power curve: slider 10→100 maps to alpha with finer low-end control.
    // Light mode enforces a higher floor (0.35) since a light bg on a dark
    // desktop vanishes at low alpha. Dark mode can go much lower (0.08).
    const clamped_pct = Math.max(10, Math.min(100, percent));
    const t = (clamped_pct - 10) / 90;     // 0..1 from slider range
    const alpha = Math.pow(t, 1.6);
    const minAlpha = isDark ? 0.08 : 0.55;
    const clamped = Math.max(minAlpha, Math.min(1, alpha));

    body.style.setProperty('--bg-opacity', clamped);

    // Scale blur inversely with opacity: more blur at lower opacity for readability.
    const blur = percent >= 100 ? 0 : Math.round(5 + (1 - clamped) * 15);
    body.style.setProperty('--blur-radius', `${blur}px`);

    // At low opacity, boost text brightness so it stays readable without glow/shadow.
    body.style.setProperty('--text-glow', 'none');
    if (isDark) {
        if (clamped < 0.6) {
            const boost = ((0.6 - clamped) / 0.6);
            // Lerp text-primary from #cdd6f4 toward pure white
            const r = Math.round(205 + boost * 50);
            const g = Math.round(214 + boost * 41);
            const b = Math.round(244 + boost * 11);
            body.style.setProperty('--text-primary', `rgb(${r}, ${g}, ${b})`);
            const sr = Math.round(166 + boost * 89);
            const sg = Math.round(173 + boost * 82);
            const sb = Math.round(200 + boost * 55);
            body.style.setProperty('--text-secondary', `rgb(${sr}, ${sg}, ${sb})`);
        } else {
            body.style.removeProperty('--text-primary');
            body.style.removeProperty('--text-secondary');
        }
    } else {
        if (clamped < 0.75) {
            const boost = ((0.75 - clamped) / 0.75);
            // Lerp text-primary from #4c4f69 toward darker/more saturated
            const r = Math.round(76 - boost * 50);
            const g = Math.round(79 - boost * 50);
            const b = Math.round(105 - boost * 30);
            body.style.setProperty('--text-primary', `rgb(${r}, ${g}, ${b})`);
            const sr = Math.round(108 - boost * 60);
            const sg = Math.round(111 - boost * 60);
            const sb = Math.round(133 - boost * 40);
            body.style.setProperty('--text-secondary', `rgb(${sr}, ${sg}, ${sb})`);
        } else {
            body.style.removeProperty('--text-primary');
            body.style.removeProperty('--text-secondary');
        }
    }

    // Recompute bg-primary and bg-secondary with new alpha
    if (isDark) {
        body.style.setProperty('--bg-primary', `rgba(30, 30, 46, ${clamped.toFixed(3)})`);
        body.style.setProperty('--bg-secondary', `rgba(24, 24, 37, ${Math.min(clamped + 0.05, 1).toFixed(3)})`);
    } else {
        body.style.setProperty('--bg-primary', `rgba(239, 241, 245, ${clamped.toFixed(3)})`);
        body.style.setProperty('--bg-secondary', `rgba(230, 233, 239, ${Math.min(clamped + 0.04, 1).toFixed(3)})`);
    }
}

// Accent color: reads from Catppuccin palette and updates semantic accent tokens.
// Uses document.body for getComputedStyle so light-theme overrides on body.theme-light are picked up.
function applyAccent(accentName) {
    const body = document.body;
    const color = getComputedStyle(body).getPropertyValue(`--ctp-${accentName}`).trim();
    if (!color) return;
    body.style.setProperty('--accent', color);
    body.style.setProperty('--color-session', color);

    // Parse hex to rgb for alpha variants
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    body.style.setProperty('--accent-dim', `rgba(${r}, ${g}, ${b}, 0.15)`);
    body.style.setProperty('--accent-medium', `rgba(${r}, ${g}, ${b}, 0.3)`);
    body.style.setProperty('--accent-strong', `rgba(${r}, ${g}, ${b}, 0.5)`);
    body.style.setProperty('--color-session-rgb', `${r}, ${g}, ${b}`);
    // Update text-glow-accent for dark mode
    body.style.setProperty('--text-glow-accent', `0 0 8px rgba(${r}, ${g}, ${b}, 0.35)`);
}

// Start the application
init();

// Cleanup on unload
window.addEventListener('beforeunload', () => {
    stopAutoUpdate();
    if (countdownInterval) clearInterval(countdownInterval);
    if (statusUpdateInterval) clearInterval(statusUpdateInterval);
});
