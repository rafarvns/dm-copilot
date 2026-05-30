const { contextBridge, ipcRenderer } = require("electron");

// Expõe APIs seguras do main process para o renderer process
// através do contextBridge, seguindo as melhores práticas do Electron

contextBridge.exposeInMainWorld("dmCopilot", {
  // --- Plataforma ---
  platform: process.platform,

  // --- Versão do App ---
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),

  // --- URLs Externas ---
  openExternal: (url) => ipcRenderer.invoke("app-open-external", url),

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
      getRecent: (limit) => ipcRenderer.invoke("db-campaigns-recent", limit),
      saveImage: (buffer) => ipcRenderer.invoke("app-save-campaign-image", buffer),
      getStats: (id) => ipcRenderer.invoke("db-campaigns-stats", id),
    },

    // Characters
    characters: {
      create: (data) => ipcRenderer.invoke("db-characters-create", data),
      getAll: () => ipcRenderer.invoke("db-characters-read-all"),
      getBySystem: (system) => ipcRenderer.invoke("db-characters-read-system", system),
      getByCampaign: (campaignId) => ipcRenderer.invoke("db-characters-read-campaign", campaignId),
      getById: (id) => ipcRenderer.invoke("db-characters-read-id", id),
      update: (id, data) => ipcRenderer.invoke("db-characters-update", id, data),
      delete: (id) => ipcRenderer.invoke("db-characters-delete", id),
      linkToCampaign: (charId, campId) =>
        ipcRenderer.invoke("db-characters-link-campaign", charId, campId),
      unlinkFromCampaign: (charId, campId) =>
        ipcRenderer.invoke("db-characters-unlink-campaign", charId, campId),
      getAvailableForCampaign: (campId, system) =>
        ipcRenderer.invoke("db-characters-available-campaign", campId, system),
      saveImage: (data) => ipcRenderer.invoke("app-save-character-image", data),
      getRecent: (limit) => ipcRenderer.invoke("db-characters-recent", limit),
      count: () => ipcRenderer.invoke("db-characters-count"),
    },

    // Encounters
    encounters: {
      create: (data) => ipcRenderer.invoke("db-encounters-create", data),
      getAll: (campaignId) => ipcRenderer.invoke("db-encounters-read-all", campaignId),
      getById: (id) => ipcRenderer.invoke("db-encounters-read-id", id),
      update: (id, data) => ipcRenderer.invoke("db-encounters-update", id, data),
      delete: (id) => ipcRenderer.invoke("db-encounters-delete", id),
      saveImage: (data) => ipcRenderer.invoke("app-save-encounter-image", data),
      listPresets: () => ipcRenderer.invoke("app-list-encounter-presets"),
      validateYouTubeUrl: (url) => ipcRenderer.invoke("app-validate-youtube-url", url),
      downloadMusic: (url, encounterId) =>
        ipcRenderer.invoke("app-download-encounter-music", { url, encounterId }),
      deleteMusic: (fileName) => ipcRenderer.invoke("app-delete-encounter-music", fileName),
    },

    // Scenes
    scenes: {
      create: (data) => ipcRenderer.invoke("db-scenes-create", data),
      getAll: (campaignId) => ipcRenderer.invoke("db-scenes-read-all", campaignId),
      getById: (id) => ipcRenderer.invoke("db-scenes-read-id", id),
      update: (id, data) => ipcRenderer.invoke("db-scenes-update", id, data),
      delete: (id) => ipcRenderer.invoke("db-scenes-delete", id),
      setLinks: (sceneId, otherSceneIds) =>
        ipcRenderer.invoke("db-scenes-set-links", sceneId, otherSceneIds),
      setEncounters: (sceneId, encounterIds) =>
        ipcRenderer.invoke("db-scenes-set-encounters", sceneId, encounterIds),
      saveImage: (data) => ipcRenderer.invoke("app-save-scene-image", data),
      validateYouTubeUrl: (url) => ipcRenderer.invoke("app-validate-youtube-url", url),
      downloadMusic: (url, sceneId) =>
        ipcRenderer.invoke("app-download-scene-music", { url, sceneId }),
      deleteMusic: (fileName) => ipcRenderer.invoke("app-delete-scene-music", fileName),
    },

    sceneNotes: {
      list: (sceneId) => ipcRenderer.invoke("db-scene-notes-list", sceneId),
      create: (sceneId, data) => ipcRenderer.invoke("db-scene-notes-create", sceneId, data),
      update: (id, data) => ipcRenderer.invoke("db-scene-notes-update", id, data),
      delete: (id) => ipcRenderer.invoke("db-scene-notes-delete", id),
      reorder: (sceneId, orderedIds) =>
        ipcRenderer.invoke("db-scene-notes-reorder", sceneId, orderedIds),
    },

    // Notes
    notes: {
      create: (data) => ipcRenderer.invoke("db-notes-create", data),
      getAll: (campaignId) => ipcRenderer.invoke("db-notes-read-all", campaignId),
      getById: (id) => ipcRenderer.invoke("db-notes-read-id", id),
      update: (id, data) => ipcRenderer.invoke("db-notes-update", id, data),
      delete: (id) => ipcRenderer.invoke("db-notes-delete", id),
    },

    // Dice Rolls
    diceRolls: {
      save: (data) => ipcRenderer.invoke("db-dice-rolls-save", data),
      getAll: (options) => ipcRenderer.invoke("db-dice-rolls-read-all", options),
      clear: () => ipcRenderer.invoke("db-dice-rolls-clear"),
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

  // --- Combat Server ---
  combat: {
    startServer: () => ipcRenderer.invoke("combat-server-start"),
    stopServer: () => ipcRenderer.invoke("combat-server-stop"),
    getInfo: () => ipcRenderer.invoke("combat-server-get-info"),
    broadcast: (event, data) => ipcRenderer.send("combat-server-broadcast", { event, data }),
    onPlayerConnected: (callback) =>
      ipcRenderer.on("player-connected", (event, socketId) => callback(socketId)),
  },

  // --- Auto Updater ---
  updater: {
    download: () => ipcRenderer.invoke("updater:download"),
    install: () => ipcRenderer.invoke("updater:install"),
    onEvent: (callback) => {
      ipcRenderer.on("updater:event", (event, payload) => callback(payload));
    },
  },
});
