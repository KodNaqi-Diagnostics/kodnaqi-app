const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getDeviceCode: () => ipcRenderer.invoke('get-device-code')
});
