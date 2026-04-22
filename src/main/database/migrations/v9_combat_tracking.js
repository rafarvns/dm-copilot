/**
 * Migration: v9_combat_tracking
 * Adds combat state fields to encounters table
 */

const version = 9;
const name = "Add combat tracking fields to encounters";

function up(db) {
  // 1. Update encounters table
  // status: 'pending', 'active', 'finished'
  try {
    db.prepare(`ALTER TABLE encounters ADD COLUMN status TEXT DEFAULT 'pending'`).run();
  } catch (e) {
    console.warn("Migration v9: status column already exists");
  }
  
  try {
    db.prepare(`ALTER TABLE encounters ADD COLUMN current_round INTEGER DEFAULT 1`).run();
  } catch (e) {
    console.warn("Migration v9: current_round column already exists");
  }
  
  try {
    db.prepare(`ALTER TABLE encounters ADD COLUMN current_turn_index INTEGER DEFAULT 0`).run();
  } catch (e) {
    console.warn("Migration v9: current_turn_index column already exists");
  }
}

function down(db) {
  // SQLite doesn't support dropping columns easily.
}

module.exports = { version, name, up, down };
