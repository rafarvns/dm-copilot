const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const { app } = require("electron");

// ============================================
// Database Manager
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
      this.db = new Database(this.dbPath, { verbose: console.log });

      // Habilitar foreign keys
      this.db.pragma("foreign_keys = ON");

      // Habilitar WAL mode para melhor concorrência
      this.db.pragma("journal_mode = WAL");

      // Carregar migrations
      this.loadMigrations();

      // Executar migrations
      this.runMigrations();

      this.isInitialized = true;
      console.log("Database initialized successfully");
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
    const migrationsDir = path.join(__dirname, "migrations");

    if (!fs.existsSync(migrationsDir)) {
      console.warn("Migrations directory not found");
      return;
    }

    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".js"));

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
      const appliedVersionNumbers = appliedRows.map(row => row.version);

      for (const migration of this.migrations) {
        if (!appliedVersionNumbers.includes(migration.version)) {
          console.log(`Applying migration v${migration.version}: ${migration.name}`);

          const runMigration = this.db.transaction(() => {
            migration.up(this.db);
            this.db.prepare(
              "INSERT INTO schema_migrations (version, migrated_at) VALUES (?, ?)"
            ).run(migration.version, new Date().toISOString());
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

    const backupPath = destinationPath ||
      path.join(app.getPath("userData"), `backup-${Date.now()}.db`);

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

module.exports = databaseManager;
