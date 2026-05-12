const { app, BrowserWindow, ipcMain, Menu, dialog, protocol, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const os = require("os");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

// ============================================
// Environment
// ============================================
const isDev = !app.isPackaged;

// ============================================
// App State
// ============================================
let mainWindow;

// ============================================
// Database Manager (inline para evitar require)
// ============================================
// ============================================
// Network Discovery Utility
// ============================================
function getNetworkIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

// ============================================
// Combat Server Manager
// ============================================
class CombatServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new Server(this.server);
    this.port = 3000;
    this.isRunning = false;
    this.lastCombatUpdate = null;
    this.lastSceneUpdate = null;

    this.setupRoutes();
    this.setupWebSockets();
  }

  setupRoutes() {
    this.app.get("/", (req, res) => {
      const possiblePaths = [
        path.join(__dirname, "server", "player-view.html"),
        path.join(__dirname, "..", "..", "src", "main", "server", "player-view.html"),
        path.join(app.getAppPath(), "src", "main", "server", "player-view.html"),
      ];

      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          return res.sendFile(p);
        }
      }
      res.status(404).send("Player view file not found");
    });

    // Serve other static files if needed
    const staticPath = fs.existsSync(path.join(__dirname, "server"))
      ? path.join(__dirname, "server")
      : path.join(__dirname, "..", "..", "src", "main", "server");
    this.app.use(express.static(staticPath));

    // Serve character images from userData (cria pasta antes para garantir mount mesmo no primeiro boot)
    const imagesPath = path.join(app.getPath("userData"), "images", "characters");
    fs.mkdirSync(imagesPath, { recursive: true });
    this.app.use("/images/characters", express.static(imagesPath));

    // Serve encounter background uploads from userData
    const encounterImagesPath = path.join(app.getPath("userData"), "images", "encounters");
    fs.mkdirSync(encounterImagesPath, { recursive: true });
    this.app.use("/images/encounters", express.static(encounterImagesPath));

    // Serve scene background uploads from userData
    const sceneImagesPath = path.join(app.getPath("userData"), "images", "scenes");
    fs.mkdirSync(sceneImagesPath, { recursive: true });
    this.app.use("/images/scenes", express.static(sceneImagesPath));

    // Serve encounter music files (downloaded from YouTube) from userData
    const musicPath = path.join(app.getPath("userData"), "music");
    fs.mkdirSync(musicPath, { recursive: true });
    this.app.use("/music", express.static(musicPath));

    // Serve encounter preset backgrounds bundled with the app (dev path)
    const encounterPresetsPath = path.join(
      app.getAppPath(),
      "src",
      "renderer",
      "src",
      "assets",
      "images",
      "encounters-presets"
    );
    this.app.use("/encounter-presets", express.static(encounterPresetsPath));

    // Serve dice-box assets from renderer public
    const diceAssetsPath = path.join(app.getAppPath(), "src", "renderer", "public", "dice-box");
    if (fs.existsSync(diceAssetsPath)) {
      this.app.use("/dice-box", express.static(diceAssetsPath));
    }

    // Serve dice-box library from node_modules
    const diceLibPath = path.join(app.getAppPath(), "node_modules", "@3d-dice", "dice-box", "dist");
    if (fs.existsSync(diceLibPath)) {
      this.app.use("/dice-box-lib", express.static(diceLibPath));
      // Fallback for /dice-box: serves the JS workers (world.onscreen.js,
      // world.offscreen.js, Dice.js) that DiceBox loads from `assetPath`.
      // express.static falls through when a file is not found, so graphical
      // assets (ammo/, themes/) keep coming from the public/ mount above.
      this.app.use("/dice-box", express.static(diceLibPath));
    }

    // Serve dice-box-threejs (predeterministic rolling support)
    const dice3jsPath = path.join(app.getAppPath(), "node_modules", "@3d-dice", "dice-box-threejs");
    if (fs.existsSync(dice3jsPath)) {
      this.app.use("/dice-box-threejs", express.static(dice3jsPath));
      // The lib loads textures/sounds from relative paths — also expose its
      // public/ folder at root level so the lib finds them by default.
      const dice3jsPublic = path.join(dice3jsPath, "public");
      if (fs.existsSync(dice3jsPublic)) {
        this.app.use(express.static(dice3jsPublic));
      }
    }

    // Serve renderer assets for dice icons etc.
    const rendererAssetsPath = path.join(app.getAppPath(), "src", "renderer", "src", "assets");
    if (fs.existsSync(rendererAssetsPath)) {
      this.app.use("/src/assets", express.static(rendererAssetsPath));
    }

    // Serve SFX assets for the player view
    const sfxAssetsPath = path.join(app.getAppPath(), "src", "assets", "sfx");
    if (fs.existsSync(sfxAssetsPath)) {
      this.app.use("/sfx", express.static(sfxAssetsPath));
    }
  }

  setupWebSockets() {
    this.io.on("connection", (socket) => {
      console.log("Player connected to combat view:", socket.id);

      // Request current state from DM when someone connects
      if (mainWindow) {
        mainWindow.webContents.send("player-connected", socket.id);
      }

      // Send current view state to the newly connected player
      if (this.lastCombatUpdate?.status === "active") {
        socket.emit("combat-update", this.lastCombatUpdate);
      } else if (this.lastSceneUpdate?.status === "active") {
        socket.emit("scene-update", this.lastSceneUpdate);
      }

      socket.on("disconnect", () => {
        console.log("Player disconnected");
      });
    });

    // Handle dice roll broadcast from DM
    ipcMain.on("db-dice-broadcast", (event, rollData) => {
      console.log("Broadcasting dice roll to players:", rollData.notation);
      if (this.isRunning) {
        this.io.emit("dice-roll", rollData);
      }
    });
  }

  start() {
    if (this.isRunning) return;

    this.server.once("error", (err) => {
      console.error(`[CombatServer] Failed to bind on port ${this.port}:`, err.code || err.message);
      console.error(
        `[CombatServer] Likely cause: another instance of the app is still running and holding port ${this.port}. Close it (Task Manager → kill electron.exe) and restart.`
      );
      this.isRunning = false;
    });

    this.server.listen(this.port, () => {
      this.isRunning = true;
      console.log(`Combat server running at http://${getNetworkIP()}:${this.port}`);
    });
  }

  stop() {
    if (!this.isRunning) return;

    this.server.close(() => {
      this.isRunning = false;
      console.log("Combat server stopped");
    });
  }

  broadcast(event, data) {
    if (this.isRunning) {
      if (event === "combat-update") this.lastCombatUpdate = data;
      if (event === "scene-update") this.lastSceneUpdate = data;
      const clientsCount = this.io?.sockets?.sockets?.size ?? 0;
      if (event === "dice-roll") {
        console.log(
          `[Server] io.emit dice-roll → ${clientsCount} client(s) | notation=${JSON.stringify(data?.notation)}`
        );
      }
      this.io.emit(event, data);
    } else if (event === "dice-roll") {
      console.warn("[Server] dice-roll IGNORED — server not running");
    }
  }
}

const combatServer = new CombatServer();

// ============================================
// Database Manager (inline para evitar require)
// ============================================
class DatabaseManager {
  constructor() {
    this.db = null;
    this.dbPath = null;
    this.migrations = [];
    this.isInitialized = false;
  }

  // ============================================
  // Inicialização
  // ============================================
  init() {
    try {
      const userDataPath = app.getPath("userData");
      this.dbPath = path.join(userDataPath, "dm-copilot.db");

      console.log("Database path:", this.dbPath);

      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
      }

      // Criar conexão SQLite (síncrona com better-sqlite3)
      this.db = new Database(this.dbPath);

      // Habilitar foreign keys
      this.db.pragma("foreign_keys = ON");

      // Habilitar WAL mode para melhor concorrência
      this.db.pragma("journal_mode = WAL");

      // Carregar migrations
      this.loadMigrations();

      // Executar migrations
      this.runMigrations();

      this.isInitialized = true;
      console.log(`Database initialized successfully [v${app.getVersion()}]`);
      return true;
    } catch (error) {
      console.error("Failed to initialize database:", error);
      throw error;
    }
  }

  // ============================================
  // Carregar migrations
  // ============================================
  loadMigrations() {
    const migrationsDir = path.join(__dirname, "database", "migrations");

    if (!fs.existsSync(migrationsDir)) {
      console.warn("Migrations directory not found");
      return;
    }

    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".js"));

    for (const file of files) {
      const migration = require(path.join(migrationsDir, file));
      this.migrations.push(migration);
    }

    this.migrations.sort((a, b) => a.version - b.version);
  }

  // ============================================
  // Executar migrations
  // ============================================
  runMigrations() {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          migrated_at TEXT NOT NULL
        )
      `);

      const appliedRows = this.db.prepare("SELECT version FROM schema_migrations").all();
      const appliedVersionNumbers = appliedRows.map((row) => row.version);

      for (const migration of this.migrations) {
        if (!appliedVersionNumbers.includes(migration.version)) {
          console.log(`Applying migration v${migration.version}: ${migration.name}`);

          const runMigration = this.db.transaction(() => {
            migration.up(this.db);
            this.db
              .prepare("INSERT INTO schema_migrations (version, migrated_at) VALUES (?, ?)")
              .run(migration.version, new Date().toISOString());
          });

          runMigration();
        }
      }

      console.log("All migrations completed");
    } catch (error) {
      console.error("Failed to run migrations:", error);
      throw error;
    }
  }

  // ============================================
  // Executar query (INSERT, UPDATE, DELETE)
  // ============================================
  runQuery(sql, params = []) {
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...params);
    return { lastInsertRowid: result.lastInsertRowid, changes: result.changes };
  }

  // ============================================
  // Executar query e obter uma linha
  // ============================================
  getRow(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return stmt.get(...params);
  }

  // ============================================
  // Executar query e obter todas as linhas
  // ============================================
  getAllRows(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  // ============================================
  // Executar transação
  // ============================================
  runTransaction(callback) {
    const transaction = this.db.transaction(callback);
    transaction();
  }

  // ============================================
  // Backup do banco de dados
  // ============================================
  backup(destinationPath = null) {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const backupPath =
      destinationPath || path.join(app.getPath("userData"), `backup-${Date.now()}.db`);

    this.db.backup(backupPath);
    console.log(`Database backed up to: ${backupPath}`);
    return backupPath;
  }

  // ============================================
  // Obter conexão
  // ============================================
  getConnection() {
    if (!this.db) {
      throw new Error("Database not initialized. Call init() first.");
    }
    return this.db;
  }

  // ============================================
  // Fechar conexão
  // ============================================
  close() {
    if (this.db) {
      this.db.close();
      console.log("Database connection closed");
      this.db = null;
      this.isInitialized = false;
    }
  }

  // ============================================
  // Verificar se está inicializado
  // ============================================
  isReady() {
    return this.isInitialized && this.db !== null;
  }

  // ============================================
  // Obter caminho do banco
  // ============================================
  getPath() {
    return this.dbPath;
  }
}

// Singleton instance
const databaseManager = new DatabaseManager();

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

  // Maximize before showing so the window doesn't flash from windowed
  // to maximized on first paint.
  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // No application menu — the app uses its own in-window navigation.
  Menu.setApplicationMenu(null);
}

// ============================================
// IPC Handlers - App Info
// ============================================
ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

ipcMain.handle("app-open-external", async (_event, url) => {
  try {
    const safe = String(url || "").trim();
    if (!safe.startsWith("http://") && !safe.startsWith("https://")) {
      return { success: false, error: "URL inválida" };
    }
    await shell.openExternal(safe);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("app-save-encounter-image", async (_event, imageData) => {
  try {
    const userDataPath = app.getPath("userData");
    const imagesDir = path.join(userDataPath, "images", "encounters");

    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    const fileName = `enc_${Date.now()}.webp`;
    const filePath = path.join(imagesDir, fileName);

    fs.writeFileSync(filePath, Buffer.from(imageData));

    return `encounters/${fileName}`;
  } catch (error) {
    console.error("Erro ao salvar imagem de encontro:", error);
    throw error;
  }
});

ipcMain.handle("app-validate-youtube-url", (_event, url) => {
  const { validateYouTubeUrl } = require("./services/youtube-downloader");
  return validateYouTubeUrl(url);
});

ipcMain.handle("app-download-encounter-music", async (_event, { url, encounterId }) => {
  try {
    const { downloadAudio } = require("./services/youtube-downloader");
    const { fileName } = await downloadAudio(url, `encounter_${encounterId}`);
    return { success: true, fileName };
  } catch (error) {
    console.error("Erro ao baixar música:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("app-delete-encounter-music", (_event, fileName) => {
  try {
    const { removeAudio } = require("./services/youtube-downloader");
    return { success: removeAudio(fileName) };
  } catch (error) {
    console.error("Erro ao remover música:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("app-save-scene-image", async (_event, imageData) => {
  try {
    const userDataPath = app.getPath("userData");
    const imagesDir = path.join(userDataPath, "images", "scenes");

    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    const fileName = `scene_${Date.now()}.webp`;
    const filePath = path.join(imagesDir, fileName);

    fs.writeFileSync(filePath, Buffer.from(imageData));

    return `scenes/${fileName}`;
  } catch (error) {
    console.error("Erro ao salvar imagem de cena:", error);
    throw error;
  }
});

ipcMain.handle("app-download-scene-music", async (_event, { url, sceneId }) => {
  try {
    const { downloadAudio } = require("./services/youtube-downloader");
    const { fileName } = await downloadAudio(url, `scene_${sceneId}`);
    return { success: true, fileName };
  } catch (error) {
    console.error("Erro ao baixar música da cena:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("app-delete-scene-music", (_event, fileName) => {
  try {
    const { removeAudio } = require("./services/youtube-downloader");
    return { success: removeAudio(fileName) };
  } catch (error) {
    console.error("Erro ao remover música da cena:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("app-list-encounter-presets", () => {
  try {
    const presetsDir = path.join(
      app.getAppPath(),
      "src",
      "renderer",
      "src",
      "assets",
      "images",
      "encounters-presets"
    );

    if (!fs.existsSync(presetsDir)) {
      return [];
    }

    const allowed = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
    return fs
      .readdirSync(presetsDir)
      .filter((file) => allowed.has(path.extname(file).toLowerCase()))
      .sort();
  } catch (error) {
    console.error("Erro ao listar presets de encontro:", error);
    return [];
  }
});

ipcMain.handle("app-save-character-image", async (_event, imageData) => {
  try {
    const userDataPath = app.getPath("userData");
    const imagesDir = path.join(userDataPath, "images", "characters");

    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    const fileName = `char_${Date.now()}.webp`;
    const filePath = path.join(imagesDir, fileName);

    // imageData chega como Buffer ou Uint8Array
    fs.writeFileSync(filePath, Buffer.from(imageData));

    return `characters/${fileName}`;
  } catch (error) {
    console.error("Erro ao salvar imagem:", error);
    throw error;
  }
});

// ============================================
// IPC Handlers - Database
// ============================================
ipcMain.handle("db-init", () => {
  try {
    databaseManager.init();
    return { success: true, path: databaseManager.getPath() };
  } catch (error) {
    console.error("Database initialization failed:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("db-is-ready", () => {
  return databaseManager.isReady();
});

// ============================================
// IPC Handlers - Campaigns
// ============================================
ipcMain.handle("db-campaigns-create", (_event, campaignData) => {
  const db = databaseManager.getConnection();
  const { createCampaign } = require("./database/queries/campaigns");
  return createCampaign(db, campaignData);
});

ipcMain.handle("db-campaigns-read-all", () => {
  const db = databaseManager.getConnection();
  const { getAllCampaigns } = require("./database/queries/campaigns");
  return getAllCampaigns(db);
});

ipcMain.handle("db-campaigns-read-id", (_event, id) => {
  const db = databaseManager.getConnection();
  const { getCampaignById } = require("./database/queries/campaigns");
  return getCampaignById(db, id);
});

ipcMain.handle("db-campaigns-update", (_event, id, campaignData) => {
  const db = databaseManager.getConnection();
  const { updateCampaign } = require("./database/queries/campaigns");
  return updateCampaign(db, id, campaignData);
});

ipcMain.handle("db-campaigns-delete", (_event, id) => {
  const db = databaseManager.getConnection();
  const { deleteCampaign } = require("./database/queries/campaigns");
  return deleteCampaign(db, id);
});

ipcMain.handle("db-campaigns-recent", (_event, limit) => {
  const db = databaseManager.getConnection();
  return require("./database/queries/campaigns").getRecentCampaigns(db, limit);
});

ipcMain.handle("app-save-campaign-image", async (_event, imageData) => {
  try {
    const userDataPath = app.getPath("userData");
    const imagesDir = path.join(userDataPath, "images", "campaigns");

    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    const fileName = `camp_${Date.now()}.webp`;
    const filePath = path.join(imagesDir, fileName);

    fs.writeFileSync(filePath, Buffer.from(imageData));

    return `campaigns/${fileName}`;
  } catch (error) {
    console.error("Erro ao salvar imagem de campanha:", error);
    throw error;
  }
});

ipcMain.handle("db-campaigns-stats", (_event, id) => {
  const db = databaseManager.getConnection();
  const characters = require("./database/queries/characters").countCharactersByCampaign(db, id);
  const encounters = require("./database/queries/encounters").countEncountersByCampaign(db, id);
  const scenes = require("./database/queries/scenes").countScenesByCampaign(db, id);
  return { characters, encounters, scenes };
});

// ============================================
// IPC Handlers - Characters
// ============================================
ipcMain.handle("db-characters-create", (_event, characterData) => {
  const db = databaseManager.getConnection();
  const { createCharacter } = require("./database/queries/characters");
  return createCharacter(db, characterData);
});

ipcMain.handle("db-characters-read-all", () => {
  const db = databaseManager.getConnection();
  const { getAllCharacters } = require("./database/queries/characters");
  return getAllCharacters(db);
});

ipcMain.handle("db-characters-read-system", (_event, system) => {
  const db = databaseManager.getConnection();
  const { getCharactersBySystem } = require("./database/queries/characters");
  return getCharactersBySystem(db, system);
});

ipcMain.handle("db-characters-read-campaign", (_event, campaignId) => {
  const db = databaseManager.getConnection();
  const { getCharactersByCampaign } = require("./database/queries/characters");
  return getCharactersByCampaign(db, campaignId);
});

ipcMain.handle("db-characters-read-id", (_event, id) => {
  const db = databaseManager.getConnection();
  const { getCharacterById } = require("./database/queries/characters");
  return getCharacterById(db, id);
});

ipcMain.handle("db-characters-update", (_event, id, characterData) => {
  const db = databaseManager.getConnection();
  const { updateCharacter } = require("./database/queries/characters");
  return updateCharacter(db, id, characterData);
});

ipcMain.handle("db-characters-delete", (_event, id) => {
  const db = databaseManager.getConnection();
  const { deleteCharacter } = require("./database/queries/characters");
  return deleteCharacter(db, id);
});

ipcMain.handle("db-characters-link-campaign", (_event, characterId, campaignId) => {
  const db = databaseManager.getConnection();
  const { linkToCampaign } = require("./database/queries/characters");
  return linkToCampaign(db, characterId, campaignId);
});

ipcMain.handle("db-characters-unlink-campaign", (_event, characterId, campaignId) => {
  const db = databaseManager.getConnection();
  const { unlinkFromCampaign } = require("./database/queries/characters");
  return unlinkFromCampaign(db, characterId, campaignId);
});

ipcMain.handle("db-characters-available-campaign", (_event, campaignId, system) => {
  const db = databaseManager.getConnection();
  const { getAvailableCharactersForCampaign } = require("./database/queries/characters");
  return getAvailableCharactersForCampaign(db, campaignId, system);
});

ipcMain.handle("db-characters-recent", (_event, limit) => {
  const db = databaseManager.getConnection();
  return require("./database/queries/characters").getRecentCharacters(db, limit);
});

ipcMain.handle("db-characters-count", () => {
  const db = databaseManager.getConnection();
  return require("./database/queries/characters").countCharacters(db);
});

// ============================================
// IPC Handlers - Encounters
// ============================================
ipcMain.handle("db-encounters-create", (_event, encounterData) => {
  const db = databaseManager.getConnection();
  const { createEncounter } = require("./database/queries/encounters");
  return createEncounter(db, encounterData);
});

ipcMain.handle("db-encounters-read-all", (_event, campaignId) => {
  const db = databaseManager.getConnection();
  const { getEncountersByCampaign } = require("./database/queries/encounters");
  return getEncountersByCampaign(db, campaignId);
});

ipcMain.handle("db-encounters-read-id", (_event, id) => {
  const db = databaseManager.getConnection();
  const { getEncounterById } = require("./database/queries/encounters");
  return getEncounterById(db, id);
});

ipcMain.handle("db-encounters-update", (_event, id, encounterData) => {
  const db = databaseManager.getConnection();
  const { updateEncounter } = require("./database/queries/encounters");
  return updateEncounter(db, id, encounterData);
});

ipcMain.handle("db-encounters-delete", (_event, id) => {
  const db = databaseManager.getConnection();
  const { getEncounterById, deleteEncounter } = require("./database/queries/encounters");
  const { removeAudio } = require("./services/youtube-downloader");

  const existing = getEncounterById(db, id);
  if (existing && existing.music_file) {
    removeAudio(existing.music_file);
  }
  return deleteEncounter(db, id);
});

// ============================================
// IPC Handlers - Scenes
// ============================================
ipcMain.handle("db-scenes-create", (_event, sceneData) => {
  const db = databaseManager.getConnection();
  const { createScene } = require("./database/queries/scenes");
  return createScene(db, sceneData);
});

ipcMain.handle("db-scenes-read-all", (_event, campaignId) => {
  const db = databaseManager.getConnection();
  const { getScenesByCampaign } = require("./database/queries/scenes");
  return getScenesByCampaign(db, campaignId);
});

ipcMain.handle("db-scenes-read-id", (_event, id) => {
  const db = databaseManager.getConnection();
  const { getSceneById } = require("./database/queries/scenes");
  return getSceneById(db, id);
});

ipcMain.handle("db-scenes-update", (_event, id, sceneData) => {
  const db = databaseManager.getConnection();
  const { updateScene } = require("./database/queries/scenes");
  return updateScene(db, id, sceneData);
});

ipcMain.handle("db-scenes-delete", (_event, id) => {
  const db = databaseManager.getConnection();
  const { getSceneById, deleteScene } = require("./database/queries/scenes");
  const { removeAudio } = require("./services/youtube-downloader");

  const existing = getSceneById(db, id);
  if (existing && existing.music_file) {
    removeAudio(existing.music_file);
  }
  return deleteScene(db, id);
});

ipcMain.handle("db-scenes-set-links", (_event, sceneId, otherSceneIds) => {
  const db = databaseManager.getConnection();
  const { setSceneLinks } = require("./database/queries/scenes");
  return setSceneLinks(db, sceneId, otherSceneIds);
});

ipcMain.handle("db-scenes-set-encounters", (_event, sceneId, encounterIds) => {
  const db = databaseManager.getConnection();
  const { setSceneEncounters } = require("./database/queries/scenes");
  return setSceneEncounters(db, sceneId, encounterIds);
});

// Scene Notes (múltiplas anotações por cena)
ipcMain.handle("db-scene-notes-list", (_event, sceneId) => {
  const db = databaseManager.getConnection();
  const { listSceneNotes } = require("./database/queries/scene-notes");
  return listSceneNotes(db, sceneId);
});

ipcMain.handle("db-scene-notes-create", (_event, sceneId, data) => {
  const db = databaseManager.getConnection();
  const { createSceneNote } = require("./database/queries/scene-notes");
  return createSceneNote(db, sceneId, data || {});
});

ipcMain.handle("db-scene-notes-update", (_event, id, data) => {
  const db = databaseManager.getConnection();
  const { updateSceneNote } = require("./database/queries/scene-notes");
  return updateSceneNote(db, id, data || {});
});

ipcMain.handle("db-scene-notes-delete", (_event, id) => {
  const db = databaseManager.getConnection();
  const { deleteSceneNote } = require("./database/queries/scene-notes");
  return deleteSceneNote(db, id);
});

ipcMain.handle("db-scene-notes-reorder", (_event, sceneId, orderedIds) => {
  const db = databaseManager.getConnection();
  const { reorderSceneNotes } = require("./database/queries/scene-notes");
  return reorderSceneNotes(db, sceneId, orderedIds);
});

// ============================================
// IPC Handlers - Dice Rolls
// ============================================
ipcMain.handle("db-dice-rolls-save", (_event, rollData) => {
  const db = databaseManager.getConnection();
  const { saveDiceRoll } = require("./database/queries/dice-rolls");
  return saveDiceRoll(db, rollData);
});

ipcMain.handle("db-dice-rolls-read-all", (_event, options) => {
  const db = databaseManager.getConnection();
  const { getDiceHistory, getDiceHistoryCount } = require("./database/queries/dice-rolls");
  const rolls = getDiceHistory(db, options);
  const total = getDiceHistoryCount(db);
  return { rolls, total };
});

ipcMain.handle("db-dice-rolls-clear", () => {
  const db = databaseManager.getConnection();
  const { clearDiceHistory } = require("./database/queries/dice-rolls");
  return clearDiceHistory(db);
});

// ============================================
// IPC Handlers - Notes
// ============================================
ipcMain.handle("db-notes-create", (_event, noteData) => {
  const db = databaseManager.getConnection();
  const { createNote } = require("./database/queries/notes");
  return createNote(db, noteData);
});

ipcMain.handle("db-notes-read-all", (_event, campaignId) => {
  const db = databaseManager.getConnection();
  const { getNotesByCampaign } = require("./database/queries/notes");
  return getNotesByCampaign(db, campaignId);
});

ipcMain.handle("db-notes-read-id", (_event, id) => {
  const db = databaseManager.getConnection();
  const { getNoteById } = require("./database/queries/notes");
  return getNoteById(db, id);
});

ipcMain.handle("db-notes-update", (_event, id, noteData) => {
  const db = databaseManager.getConnection();
  const { updateNote } = require("./database/queries/notes");
  return updateNote(db, id, noteData);
});

ipcMain.handle("db-notes-delete", (_event, id) => {
  const db = databaseManager.getConnection();
  const { deleteNote } = require("./database/queries/notes");
  return deleteNote(db, id);
});

// ============================================
// IPC Handlers - Backup
// ============================================
ipcMain.handle("db-backup", (_event, destinationPath) => {
  try {
    return databaseManager.backup(destinationPath);
  } catch (error) {
    console.error("Database backup failed:", error);
    return { success: false, error: error.message };
  }
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

ipcMain.handle("combat-server-start", () => {
  combatServer.start();
  return { ip: getNetworkIP(), port: combatServer.port };
});

ipcMain.handle("combat-server-stop", () => {
  combatServer.stop();
  return true;
});

ipcMain.handle("combat-server-get-info", () => {
  return {
    isRunning: combatServer.isRunning,
    ip: getNetworkIP(),
    port: combatServer.port,
  };
});

ipcMain.on("combat-server-broadcast", (_event, { event, data }) => {
  if (event === "dice-roll") {
    console.log(
      `[Main IPC] combat-server-broadcast received: event=${event}, isRunning=${combatServer.isRunning}, notation=${JSON.stringify(data?.notation)}`
    );
  }
  combatServer.broadcast(event, data);
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
  // Registrar protocolo para imagens locais
  protocol.registerFileProtocol("local-image", (request, callback) => {
    const url = request.url.replace("local-image://", "");
    try {
      const decodedUrl = decodeURI(url);
      const fullPath = path.join(app.getPath("userData"), "images", decodedUrl);
      return callback(fullPath);
    } catch (error) {
      console.error("Erro no protocolo local-image:", error);
      return callback({ error: -6 }); // NET_ERROR(FILE_NOT_FOUND, -6)
    }
  });

  // Initialize database
  try {
    databaseManager.init();
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Failed to initialize database:", error);
    // Continue anyway for graceful degradation
  }

  createWindow();
  combatServer.start();

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

// Close database and stop server on app quit
app.on("before-quit", () => {
  databaseManager.close();
  combatServer.stop();
});

// Security: Prevent new window creation
app.on("web-contents-created", (_event, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: "deny" };
  });
});
