/**
 * Migration: v8_add_dice_rolls
 * Creates the dice_rolls table to store history
 */

const version = 8;
const name = "Add dice roll history table";

function up(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS dice_rolls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notation TEXT NOT NULL,
      total INTEGER NOT NULL,
      details TEXT NOT NULL,
      bonus INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

function down(db) {
  db.prepare(`DROP TABLE IF EXISTS dice_rolls`).run();
}

module.exports = { version, name, up, down };
