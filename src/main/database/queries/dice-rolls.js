/**
 * Database queries for dice roll history
 */

/**
 * Save a new dice roll
 */
function saveDiceRoll(db, rollData) {
  const { notation, total, details, bonus } = rollData;
  const stmt = db.prepare(`
    INSERT INTO dice_rolls (notation, total, details, bonus, created_at)
    VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
  `);
  const result = stmt.run(notation, total, details, bonus);
  return result.lastInsertRowid;
}

/**
 * Get dice roll history with pagination
 */
function getDiceHistory(db, options = {}) {
  const { limit = 20, offset = 0 } = options;
  const stmt = db.prepare(`
    SELECT * FROM dice_rolls 
    ORDER BY created_at DESC 
    LIMIT ? OFFSET ?
  `);
  return stmt.all(limit, offset);
}

/**
 * Get total count of rolls
 */
function getDiceHistoryCount(db) {
  const stmt = db.prepare(`SELECT COUNT(*) as count FROM dice_rolls`);
  return stmt.get().count;
}

/**
 * Clear all dice roll history
 */
function clearDiceHistory(db) {
  const stmt = db.prepare(`DELETE FROM dice_rolls`);
  return stmt.run().changes;
}

module.exports = {
  saveDiceRoll,
  getDiceHistory,
  getDiceHistoryCount,
  clearDiceHistory
};
