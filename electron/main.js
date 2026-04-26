const { app, BrowserWindow } = require("electron")
const path = require("path")

const isDev = !app.isPackaged

function createWindow() {
  const mainWindow = new BrowserWindow({
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

app.whenReady().then(() => {
  createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
