const { contextBridge, ipcRenderer } = require("electron");

// Expõe APIs seguras do main process para o renderer process
// através do contextBridge, seguindo as melhores práticas do Electron

contextBridge.exposeInMainWorld("dmCopilot", {
  // --- Plataforma ---
  platform: process.platform,

  // --- Versão do App ---
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),

  // --- Armazenamento ---
  store: {
    get: (key) => ipcRenderer.invoke("store-get", key),
    set: (key, value) => ipcRenderer.invoke("store-set", key, value),
    delete: (key) => ipcRenderer.invoke("store-delete", key),
    clear: () => ipcRenderer.invoke("store-clear"),
  },

  // --- Diálogos ---
  dialogs: {
    openFile: (options) => ipcRenderer.invoke("dialog-open-file", options),
    saveFile: (options) => ipcRenderer.invoke("dialog-save-file", options),
  },

  // --- Eventos do Main Process ---
  onMenuAction: (callback) => {
    ipcRenderer.on("menu-action", (event, action) => callback(action));
  },

  // --- Utilitários ---
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),
});
