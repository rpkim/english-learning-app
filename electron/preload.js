const { contextBridge } = require("electron")

// Reserved bridge namespace for future desktop-only features.
contextBridge.exposeInMainWorld("desktop", {
  platform: process.platform,
  isElectron: true,
})
