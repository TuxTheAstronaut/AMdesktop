// Modules to control application life and create native browser window
const { app, components, BrowserWindow, ipcMain } = require("electron");
const gotTheLock = app.requestSingleInstanceLock();
const path = require("node:path");
const fs = require("node:fs");

if (!gotTheLock) {
  app.quit();
}

var windowTransparent = true;

app.commandLine.appendSwitch(
  "enable-features",
  "VaapiVideoDecoder, OverlayScrollbar, UseOzonePlatform",
);
app.commandLine.appendSwitch("enable-zero-copy");

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    minWidth: 1000,
    minHeight: 800,
    transparent: windowTransparent,
    frame: false,
    show: false,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadURL("https://music.apple.com/");

  // Inject custom CSS after the page has finished loading
  const cssOverrides = path.join(__dirname, "override.css");
  const cssWindow = path.join(__dirname, "window.css");
  const insertCustomCSS = () => {
    fs.readFile(cssOverrides, "utf8", (err, data) => {
      mainWindow.webContents.insertCSS(data, { cssOrigin: "user" });
    });

    if (windowTransparent) {
      fs.readFile(cssWindow, "utf8", (err, data) => {
        mainWindow.webContents.insertCSS(data, { cssOrigin: "user" });
      });
    }
  };

  //insertCustomCSS();
  mainWindow.webContents.on("did-finish-load", () => {
    const html = `
      <div class="window-controls">
        <button class="close" id="close-btn"><div class="red"></div></button>
        <button class="minimize" id="minimize-btn"><div class="yellow"></div></button>
        <button class="maximize" id="maximize-btn"><div class="green"></div></button>
      </div>
    `;

    mainWindow.webContents.executeJavaScript(`
      document.body.insertAdjacentHTML('beforeend', \`${html}\`);
      document.getElementById('close-btn').addEventListener('click', () => ipc.send('close-window'));
      document.getElementById('minimize-btn').addEventListener('click', () => ipc.send('minimize-window'));
      document.getElementById('maximize-btn').addEventListener('click', () => ipc.send('maximize-window'));
      `);
    insertCustomCSS();
  });

  ipcMain.on("close-window", () => {
    mainWindow.destroy();
  });

  ipcMain.on("minimize-window", () => {
    mainWindow.minimize();
  });

  ipcMain.on("maximize-window", () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  await components.whenReady();
  console.log("components ready:", components.status());

  //check for command line or env var switch to disable the transparent window
  if (
    process.env.NO_TRANSPARENT == "1" ||
    app.commandLine.getSwitchValue("no-transparent") == "1"
  ) {
    windowTransparent = false;
  }

  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
// IPC handlers for window actions
