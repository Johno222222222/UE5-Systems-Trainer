"use strict";

// Desktop shell. Starts the local API on 127.0.0.1 and opens the workspace.
// The window never gets Node access. AI keys stay in the main process.

const { app, BrowserWindow, shell, safeStorage } = require("electron");
const path = require("path");
const fs = require("fs");
const { startServer } = require("./server");

app.setName("UE5 System Architect");

if (process.env.UE5_NO_SANDBOX === "1") {
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-dev-shm-usage");
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on("second-instance", () => {
  const windows = BrowserWindow.getAllWindows();
  if (windows[0]) {
    if (windows[0].isMinimized()) windows[0].restore();
    windows[0].focus();
  }
});

function staticDir() {
  const candidates = [
    path.join(__dirname, "..", "frontend", "build"),
    path.join(process.resourcesPath || "", "app", "frontend", "build"),
  ];
  return candidates.find((dir) => fs.existsSync(path.join(dir, "index.html"))) || candidates[0];
}

function codec() {
  return {
    available() {
      try { return safeStorage.isEncryptionAvailable(); } catch { return false; }
    },
    encrypt(plain) {
      try {
        if (!safeStorage.isEncryptionAvailable()) return null;
        return { encoding: "safe", payload: safeStorage.encryptString(plain).toString("base64") };
      } catch (exc) {
        console.error(`OS key store encrypt failed, using a local key file. ${exc.message}`);
        return null;
      }
    },
    decrypt(blob) {
      if (!blob || blob.encoding !== "safe") return null;
      return safeStorage.decryptString(Buffer.from(blob.payload, "base64"));
    },
  };
}

let serverHandle = null;

async function openWorkspace() {
  const ui = staticDir();
  if (!fs.existsSync(path.join(ui, "index.html"))) {
    console.error(`The workspace UI is missing at ${ui}. Build the frontend first.`);
  }
  serverHandle = await startServer({
    dataDir: app.getPath("userData"),
    staticDir: ui,
    port: process.env.UE5_PORT || 0,
    codec: codec(),
    openPath: (folder) => shell.openPath(folder),
  });
  console.log(`UE5_ARCHITECT_PORT=${serverHandle.port}`);
  console.log(`UE5_ARCHITECT_DATA=${serverHandle.dataDir}`);

  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#0B0E14",
    title: "UE5 System Architect",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    const local = `http://127.0.0.1:${serverHandle.port}`;
    if (!url.startsWith(local)) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });

  await window.loadURL(`http://127.0.0.1:${serverHandle.port}/`);
}

if (gotLock) {
  app.whenReady().then(openWorkspace).catch((exc) => {
    console.error(exc);
    app.quit();
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (!gotLock) return;
  if (BrowserWindow.getAllWindows().length === 0) openWorkspace().catch((exc) => console.error(exc));
});

app.on("before-quit", () => {
  if (serverHandle) serverHandle.server.close();
});
