const version = 16;
const name = "Add image_path column to campaigns";

function up(db) {
  try {
    db.prepare(`ALTER TABLE campaigns ADD COLUMN image_path TEXT`).run();
  } catch (e) {
    console.warn("Migration v16: image_path column already exists");
  }
}

function down(db) {
  // SQLite doesn't support dropping columns easily.
}

module.exports = { version, name, up, down };
