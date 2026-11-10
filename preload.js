const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getDeviceCode: () => ipcRenderer.invoke('get-device-code'),
  getTrialStatus: () => ipcRenderer.invoke('get-trial-status') // قناة جديدة للتجربة
});
