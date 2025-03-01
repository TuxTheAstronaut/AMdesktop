// Modules to control application life and create native browser window
const { app, components, BrowserWindow, Tray, ipcMain } = require("electron");
const gotTheLock = app.requestSingleInstanceLock();
const path = require("node:path");
const fs = require("node:fs");
const { Menu } = require("electron/main");

if (!gotTheLock) {
  app.quit();
}

var systemTray = true;
var windowTransparent = true;

app.commandLine.appendSwitch(
  "enable-features",
  "VaapiVideoDecoder, OverlayScrollbar, CanvasOopRasterization",
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
          // Ugly code to get the JS path of the Previous button since amp-playback-controls-item-skip.previous does not work
          mainWindow.webContents.executeJavaScript(
            'document.querySelector("body > div.body-container > div > div.player-bar.player-bar__floating-player.svelte-nrv2cz > div > amp-chrome-player").shadowRoot.querySelector("div > div.chrome-player__playback-controls > apple-music-playback-controls").shadowRoot.querySelector("div > div.music-controls__main > amp-playback-controls-item-skip.previous").click()',
          );
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

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  await components.whenReady();
  console.log("components ready:", components.status());

  //check for command line or env var switch to disable the transparent window
  if (
    process.env.NO_TRANSPARENT == "true" ||
    app.commandLine.hasSwitch("no-transparent")
  ) {
    windowTransparent = false;
  }

  if (process.env.NO_TRAY == "true" || app.commandLine.hasSwitch("no-tray")) {
    systemTray = false;
  }

  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
