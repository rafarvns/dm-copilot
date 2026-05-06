/**
 * Migration: v15_add_roll_history
 * Adds a JSON column to encounters to persist the live roll history of an
 * active combat, so the DM can resume an encounter (banners, current_round,
 * recent rolls) after closing/reopening the app.
 */

const version = 15;
const name = "Add roll_history column to encounters";

function up(db) {
  try {
    db.prepare(`ALTER TABLE encounters ADD COLUMN roll_history TEXT DEFAULT '[]'`).run();
  } catch (e) {
    console.warn("Migration v15: roll_history column already exists");
  }
}

function down(db) {
  // SQLite doesn't support dropping columns easily.
}

module.exports = { version, name, up, down };
