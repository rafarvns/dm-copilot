const { contextBridge, ipcRenderer } = require("electron");

// Expõe APIs seguras do main process para o renderer process
// através do contextBridge, seguindo as melhores práticas do Electron

contextBridge.exposeInMainWorld("dmCopilot", {
  // --- Plataforma ---
  platform: process.platform,

  // --- Versão do App ---
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),

  // --- Database ---
  db: {
    init: () => ipcRenderer.invoke("db-init"),
    isReady: () => ipcRenderer.invoke("db-is-ready"),
    
    // Campaigns
    campaigns: {
      create: (data) => ipcRenderer.invoke("db-campaigns-create", data),
      getAll: () => ipcRenderer.invoke("db-campaigns-read-all"),
      getById: (id) => ipcRenderer.invoke("db-campaigns-read-id", id),
      update: (id, data) => ipcRenderer.invoke("db-campaigns-update", id, data),
      delete: (id) => ipcRenderer.invoke("db-campaigns-delete", id),
    },
    
    // Characters
    characters: {
      create: (data) => ipcRenderer.invoke("db-characters-create", data),
      getAll: (campaignId) => ipcRenderer.invoke("db-characters-read-all", campaignId),
      getById: (id) => ipcRenderer.invoke("db-characters-read-id", id),
      update: (id, data) => ipcRenderer.invoke("db-characters-update", id, data),
      delete: (id) => ipcRenderer.invoke("db-characters-delete", id),
    },
    
    // Encounters
    encounters: {
      create: (data) => ipcRenderer.invoke("db-encounters-create", data),
      getAll: (campaignId) => ipcRenderer.invoke("db-encounters-read-all", campaignId),
      getById: (id) => ipcRenderer.invoke("db-encounters-read-id", id),
      update: (id, data) => ipcRenderer.invoke("db-encounters-update", id, data),
      delete: (id) => ipcRenderer.invoke("db-encounters-delete", id),
    },
    
    // Notes
    notes: {
      create: (data) => ipcRenderer.invoke("db-notes-create", data),
      getAll: (campaignId) => ipcRenderer.invoke("db-notes-read-all", campaignId),
      getById: (id) => ipcRenderer.invoke("db-notes-read-id", id),
      update: (id, data) => ipcRenderer.invoke("db-notes-update", id, data),
      delete: (id) => ipcRenderer.invoke("db-notes-delete", id),
    },
    
    // Backup
    backup: (path) => ipcRenderer.invoke("db-backup", path),
  },

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
