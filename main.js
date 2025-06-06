// Modules to control application life and create native browser window
const { app, components, BrowserWindow, Tray, ipcMain } = require("electron");
const gotTheLock = app.requestSingleInstanceLock();
const path = require("node:path");
const fs = require("node:fs");
const { Menu } = require("electron/main");
const https = require("https");

if (!gotTheLock) {
  app.quit();
}

var systemTray = true;
var windowTransparent = true;
var windowOutline = true;

app.commandLine.appendSwitch(
  "enable-features",
  "VaapiVideoDecoder, FluentOverlayScrollbar, CanvasOopRasterization",
);
app.commandLine.appendSwitch("enable-zero-copy");

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    minWidth: 1000,
    minHeight: 800,
    icon: path.join(__dirname, "amdesktop.png"),
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
  const insertCustomCSS = () => {
    fetchCSS(
      mainWindow,
      "https://raw.githubusercontent.com/TuxTheAstronaut/AMdesktop/refs/heads/main/css/override.css",
    );

    if (windowTransparent) {
      fetchCSS(
        mainWindow,
        "https://raw.githubusercontent.com/TuxTheAstronaut/AMdesktop/refs/heads/main/css/window.css",
      );
    }
  };

  mainWindow.webContents.on("did-finish-load", () => {
    const windowControls = `
      <div class="window-controls">
        <button class="close" id="close-btn"><div class="red"></div></button>
        <button class="minimize" id="minimize-btn"><div class="yellow"></div></button>
        <button class="maximize" id="maximize-btn"><div class="green"></div></button>
      </div>
    `;

    mainWindow.webContents.executeJavaScript(`
      document.body.insertAdjacentHTML('beforeend', \`${windowControls}\`);
      document.getElementById('close-btn').addEventListener('click', () => ipc.send('close-window'));
      document.getElementById('minimize-btn').addEventListener('click', () => ipc.send('minimize-window'));
      document.getElementById('maximize-btn').addEventListener('click', () => ipc.send('maximize-window'));
      `);

    if (windowOutline) {
      const outline = `
        <div class="window-outline"></div>
      `;

      mainWindow.webContents.executeJavaScript(`
        document.body.insertAdjacentHTML('beforeend', \`${outline}\`);
      `);
    }

    insertCustomCSS();
  });

  ipcMain.on("close-window", () => {
    if (systemTray) {
      mainWindow.hide();
    } else {
      mainWindow.destroy();
      app.quit();
    }
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

  mainWindow.on("close", (event) => {
    if (systemTray && !app.isQuiting) {
      event.preventDefault();
      mainWindow.hide(); // Hide window to tray
    }
  });

  if (systemTray) {
    var trayIcon = path.join(__dirname, "tray-icon.png");
    var appTray = new Tray(trayIcon);

    var contextMenu = Menu.buildFromTemplate([
      {
        label: "Apple Music Desktop",
        enabled: false,
      },
      { type: "separator" },
      {
        label: "Open",
        click: function () {
          mainWindow.show();
        },
      },
      { type: "separator" },
      {
        label: "Play/Pause",
        click: function () {
          mainWindow.webContents.executeJavaScript(
            "document.querySelector('amp-playback-controls-play').click()",
          );
        },
      },
      {
        label: "Previous",
        click: function () {
          // More work has to be done to find amp-playback-controls-item-skip.previous
          mainWindow.webContents.executeJavaScript(`
            (() => {
              const chromePlayer = document.querySelector('amp-chrome-player')?.shadowRoot;
              const playbackControls = chromePlayer?.querySelector('apple-music-playback-controls')?.shadowRoot;
              const previousButton = playbackControls?.querySelector('amp-playback-controls-item-skip.previous');
              previousButton?.click();
            })()
          `);
        },
      },
      {
        label: "Next",
        click: function () {
          mainWindow.webContents.executeJavaScript(
            "document.querySelector('amp-playback-controls-item-skip.next').click()",
          );
        },
      },
      { type: "separator" },
      {
        label: "Quit",
        click: function () {
          mainWindow.destroy();
          app.quit();
        },
      },
    ]);

    appTray.on("click", () => {
      mainWindow.show();
    });

    appTray.setToolTip("Apple Music Desktop");
    appTray.setContextMenu(contextMenu);
  }
}

// This function fetches CSS from a URL and injects it into a window's webContents.
function fetchCSS(win, cssUrl) {
  https
    .get(cssUrl, (res) => {
      let data = "";

      // Check for successful response
      if (res.statusCode !== 200) {
        console.error(`Failed to fetch CSS. Status code: ${res.statusCode}`);
        return;
      }

      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        win.webContents
          .insertCSS(data)
          .then(() => console.log("CSS injected successfully."))
          .catch((err) => console.error("Failed to inject CSS:", err));
      });
    })
    .on("error", (err) => {
      console.error("Error fetching CSS:", err);
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(async () => {
  await components.whenReady();
  console.log("components ready:", components.status());

  //check for command line or env var switch to disable the transparent window
  if (
    process.env.NO_TRANSPARENT == "1" ||
    app.commandLine.hasSwitch("no-transparent")
  ) {
    windowTransparent = false;
  }

  if (
    process.env.NO_OUTLINE == "1" ||
    app.commandLine.hasSwitch("no-outline")
  ) {
    windowOutline = false;
  }

  if (process.env.NO_TRAY == "1" || app.commandLine.hasSwitch("no-tray")) {
    systemTray = false;
  }

  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
