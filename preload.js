const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Auth state — returns { hasSession, organizationId } (never the raw key)
  getAuthState: () => ipcRenderer.invoke('get-auth-state'),
  deleteCredentials: () => ipcRenderer.invoke('delete-credentials'),
  validateAndSaveSessionKey: (sessionKey) => ipcRenderer.invoke('validate-and-save-session-key', sessionKey),
  validateStoredSession: () => ipcRenderer.invoke('validate-stored-session'),
  detectSessionKey: () => ipcRenderer.invoke('detect-session-key'),

  // Window controls
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  resizeWindow: (height, width) => ipcRenderer.send('resize-window', height, width),

  // Window position
  getWindowPosition: () => ipcRenderer.invoke('get-window-position'),
  setWindowPosition: (position) => ipcRenderer.invoke('set-window-position', position),

  // Event listeners
  onRefreshUsage: (callback) => {
    ipcRenderer.on('refresh-usage', () => callback());
  },
  onSessionExpired: (callback) => {
    ipcRenderer.on('session-expired', () => callback());
  },

  // API
  fetchUsageData: () => ipcRenderer.invoke('fetch-usage-data'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  showNotification: (data) => ipcRenderer.send('show-notification', data),
  saveUsageSnapshot: (data) => ipcRenderer.invoke('save-usage-snapshot', data),
  getUsageHistory: () => ipcRenderer.invoke('get-usage-history'),
  setOpacity: (value) => ipcRenderer.send('set-opacity', value),
  setClickThrough: (enabled) => ipcRenderer.send('set-click-through', enabled),
  updateTrayTooltip: (text) => ipcRenderer.send('update-tray-tooltip', text),
  updateTrayIcon: (level, utilization) => ipcRenderer.send('update-tray-icon', level, utilization),
  updateTheme: (isLight) => ipcRenderer.send('theme-updated', isLight),
  exportUsageHistory: () => ipcRenderer.invoke('export-usage-history'),

  // Platform
  platform: process.platform,
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings)
});
