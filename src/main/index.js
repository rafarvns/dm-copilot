const { app, BrowserWindow, ipcMain, Menu, dialog } = require("electron");
const path = require("path");

// ============================================
// Environment
// ============================================
const isDev = !app.isPackaged;

// ============================================
// App State
// ============================================
let mainWindow;

// Simple in-memory store (will be replaced with persistent storage later)
const store = new Map();

// ============================================
// Window Creation
// ============================================
function createWindow() {
  const iconPath = path.join(__dirname, "..", "assets", "icons", "logo_ico.ico");
  console.log("Icon path:", iconPath);
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "DM Copilot",
    icon: iconPath,
    backgroundColor: "#0f0f14",
    show: false, // Show when ready to avoid flash
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for some Node.js APIs in preload
    },
  });

  // Load renderer: dev server (HMR) or production build
  if (isDev) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  // Show window when content is ready (prevents white flash)
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Build application menu
  const menuTemplate = buildMenuTemplate();
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

// ============================================
// Menu
// ============================================
function buildMenuTemplate() {
  return [
    {
      label: "Arquivo",
      submenu: [
        {
          label: "Nova Campanha",
          accelerator: "CmdOrCtrl+N",
          click: () => sendMenuAction("new-campaign"),
        },
        {
          label: "Abrir Campanha",
          accelerator: "CmdOrCtrl+O",
          click: () => sendMenuAction("open-campaign"),
        },
        {
          label: "Salvar Campanha",
          accelerator: "CmdOrCtrl+S",
          click: () => sendMenuAction("save-campaign"),
        },
        { type: "separator" },
        { role: "quit", label: "Sair" },
      ],
    },
    {
      label: "Editar",
      submenu: [
        { role: "undo", label: "Desfazer" },
        { role: "redo", label: "Refazer" },
        { type: "separator" },
        { role: "cut", label: "Recortar" },
        { role: "copy", label: "Copiar" },
        { role: "paste", label: "Colar" },
        { role: "selectAll", label: "Selecionar Tudo" },
      ],
    },
    {
      label: "Visualizar",
      submenu: [
        { role: "reload", label: "Recarregar" },
        { role: "forceReload", label: "Forçar Recarregamento" },
        { role: "toggleDevTools", label: "Ferramentas de Desenvolvedor" },
        { type: "separator" },
        { role: "resetZoom", label: "Redefinir Zoom" },
        { role: "zoomIn", label: "Aumentar Zoom" },
        { role: "zoomOut", label: "Diminuir Zoom" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Tela Cheia" },
      ],
    },
    {
      label: "Ajuda",
      submenu: [
        {
          label: "Sobre DM Copilot",
          click: () => sendMenuAction("about"),
        },
      ],
    },
  ];
}

function sendMenuAction(action) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("menu-action", action);
  }
}

// ============================================
// IPC Handlers - App Info
// ============================================
ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

// ============================================
// IPC Handlers - Store (simple key-value storage)
// ============================================
ipcMain.handle("store-get", (_event, key) => {
  return store.has(key) ? store.get(key) : null;
});

ipcMain.handle("store-set", (_event, key, value) => {
  store.set(key, value);
  return true;
});

ipcMain.handle("store-delete", (_event, key) => {
  return store.delete(key);
});

ipcMain.handle("store-clear", () => {
  store.clear();
  return true;
});

// ============================================
// IPC Handlers - Dialogs
// ============================================
ipcMain.handle("dialog-open-file", async (_event, options = {}) => {
  if (!mainWindow || mainWindow.isDestroyed()) return null;

  const defaultOptions = {
    title: "Abrir Arquivo",
    properties: ["openFile"],
    filters: [
      { name: "DM Copilot", extensions: ["dmcopilot", "json"] },
      { name: "Todos os Arquivos", extensions: ["*"] },
    ],
  };

  const result = await dialog.showOpenDialog(mainWindow, {
    ...defaultOptions,
    ...options,
  });

  if (result.canceled) return null;
  return result.filePaths;
});

ipcMain.handle("dialog-save-file", async (_event, options = {}) => {
  if (!mainWindow || mainWindow.isDestroyed()) return null;

  const defaultOptions = {
    title: "Salvar Arquivo",
    defaultPath: "campanha.dmcopilot",
    filters: [
      { name: "DM Copilot", extensions: ["dmcopilot", "json"] },
      { name: "Todos os Arquivos", extensions: ["*"] },
    ],
  };

  const result = await dialog.showSaveDialog(mainWindow, {
    ...defaultOptions,
    ...options,
  });

  if (result.canceled) return null;
  return result.filePath;
});

// ============================================
// IPC Handlers - Window Controls
// ============================================
ipcMain.on("window-minimize", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
  }
});

ipcMain.on("window-maximize", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on("window-close", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
});

// ============================================
// App Lifecycle
// ============================================
app.whenReady().then(() => {
  createWindow();

  // macOS: re-create window when dock icon is clicked and no windows are open
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // macOS: apps stay active until user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Security: Prevent new window creation
app.on("web-contents-created", (_event, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: "deny" };
  });
});
