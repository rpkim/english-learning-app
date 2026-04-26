const { contextBridge, ipcRenderer } = require("electron")

// Reserved bridge namespace for future desktop-only features.
contextBridge.exposeInMainWorld("desktop", {
  platform: process.platform,
  isElectron: true,
  setAlwaysOnTop: (value) => ipcRenderer.invoke("desktop:set-always-on-top", value),
  setViewMode: (mode) => ipcRenderer.invoke("desktop:set-view-mode", mode),
})
