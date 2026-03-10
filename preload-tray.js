const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('trayAPI', {
  onUsageUpdate: (callback) => {
    ipcRenderer.on('update-tray-popup', (event, data) => callback(data));
  },
  notifyHover: (hovered) => ipcRenderer.send('tray-popup-hover', hovered),
});
