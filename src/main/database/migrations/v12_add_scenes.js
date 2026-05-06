// Migration v12: Cria tabelas de Cenas, ligações entre cenas e ligações cena↔encontro
const version = 12;
const name = "Add scenes, scene_links, scene_encounters tables";

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scenes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      background_image TEXT,
      music_url TEXT,
      music_file TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_scenes_campaign_id ON scenes(campaign_id)`);

  // Ligações simétricas entre cenas. Canonicaliza com a < b para evitar duplicatas.
  db.exec(`
    CREATE TABLE IF NOT EXISTS scene_links (
      scene_id_a INTEGER NOT NULL,
      scene_id_b INTEGER NOT NULL,
      PRIMARY KEY (scene_id_a, scene_id_b),
      CHECK (scene_id_a < scene_id_b),
      FOREIGN KEY (scene_id_a) REFERENCES scenes(id) ON DELETE CASCADE,
      FOREIGN KEY (scene_id_b) REFERENCES scenes(id) ON DELETE CASCADE
    )
  `);

  // Ligação N:N entre cenas e encontros.
  db.exec(`
    CREATE TABLE IF NOT EXISTS scene_encounters (
      scene_id INTEGER NOT NULL,
      encounter_id INTEGER NOT NULL,
      PRIMARY KEY (scene_id, encounter_id),
      FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE,
      FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE
    )
  `);
}

function down(db) {
  db.exec("DROP TABLE IF EXISTS scene_encounters");
  db.exec("DROP TABLE IF EXISTS scene_links");
  db.exec("DROP INDEX IF EXISTS idx_scenes_campaign_id");
  db.exec("DROP TABLE IF EXISTS scenes");
}

module.exports = { version, name, up, down };
