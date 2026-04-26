const { app, BrowserWindow, ipcMain } = require("electron")
const path = require("path")

const isDev = !app.isPackaged
let mainWindow = null
let normalBounds = { width: 1400, height: 920 }

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 920,
    minWidth: 1100,
    minHeight: 760,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  const startUrl = process.env.ELECTRON_START_URL || "http://localhost:3010"
  if (isDev) {
    mainWindow.loadURL(startUrl)
    mainWindow.webContents.openDevTools({ mode: "detach" })
  } else {
    mainWindow.loadURL(startUrl)
  }
}

ipcMain.handle("desktop:set-always-on-top", (_event, value) => {
  if (!mainWindow || mainWindow.isDestroyed()) return false
  mainWindow.setAlwaysOnTop(Boolean(value), "screen-saver")
  return true
})

ipcMain.handle("desktop:set-view-mode", (_event, mode) => {
  if (!mainWindow || mainWindow.isDestroyed()) return false
  if (mode === "compact") {
    const [w, h] = mainWindow.getSize()
    normalBounds = { width: w, height: h }
    mainWindow.setResizable(true)
    mainWindow.setMinimumSize(420, 520)
    mainWindow.setSize(520, 700, true)
    return true
  }
  const width = Math.max(1100, normalBounds.width)
  const height = Math.max(760, normalBounds.height)
  mainWindow.setMinimumSize(1100, 760)
  mainWindow.setSize(width, height, true)
  return true
})

app.whenReady().then(() => {
  createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
