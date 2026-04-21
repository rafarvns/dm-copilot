// Queries para Characters
// CRUD operations for character management

// ============================================
// CREATE
// ============================================
function createCharacter(db, characterData) {
  const stmt = db.prepare(`
    INSERT INTO characters (campaign_id, name, class, level, race, hp, max_hp, attributes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  const result = stmt.run(
    characterData.campaign_id,
    characterData.name,
    characterData.class || null,
    characterData.level || 1,
    characterData.race || null,
    characterData.hp || null,
    characterData.max_hp || null,
    characterData.attributes ? JSON.stringify(characterData.attributes) : null,
    now
  );

  return {
    id: result.lastInsertRowid,
    ...characterData,
    created_at: now
  };
}

// ============================================
// READ
// ============================================
function getCharacterById(db, id) {
  const row = db.prepare(`SELECT * FROM characters WHERE id = ?`).get(id);
  if (row && row.attributes) {
    row.attributes = JSON.parse(row.attributes);
  }
  return row;
}

function getCharactersByCampaign(db, campaignId) {
  const rows = db.prepare(`SELECT * FROM characters WHERE campaign_id = ? ORDER BY name`).all(campaignId);
  return rows.map(char => {
    if (char.attributes) {
      char.attributes = JSON.parse(char.attributes);
    }
    return char;
  });
}

function getAllCharacters(db) {
  const rows = db.prepare(`SELECT * FROM characters ORDER BY name`).all();
  return rows.map(char => {
    if (char.attributes) {
      char.attributes = JSON.parse(char.attributes);
    }
    return char;
  });
}

// ============================================
// UPDATE
// ============================================
function updateCharacter(db, id, characterData) {
  const stmt = db.prepare(`
    UPDATE characters 
    SET campaign_id = ?, name = ?, class = ?, level = ?, race = ?, 
        hp = ?, max_hp = ?, attributes = ?, updated_at = ?
    WHERE id = ?
  `);

  const now = new Date().toISOString();
  const result = stmt.run(
    characterData.campaign_id,
    characterData.name,
    characterData.class || null,
    characterData.level || 1,
    characterData.race || null,
    characterData.hp || null,
    characterData.max_hp || null,
    characterData.attributes ? JSON.stringify(characterData.attributes) : null,
    now,
    id
  );

  return result.changes > 0;
}

// ============================================
// DELETE
// ============================================
function deleteCharacter(db, id) {
  const result = db.prepare(`DELETE FROM characters WHERE id = ?`).run(id);
  return result.changes > 0;
}

// ============================================
// COUNT
// ============================================
function countCharactersByCampaign(db, campaignId) {
  const row = db.prepare(`SELECT COUNT(*) as count FROM characters WHERE campaign_id = ?`).get(campaignId);
  return row.count;
}

module.exports = {
  createCharacter,
  getCharacterById,
  getCharactersByCampaign,
  getAllCharacters,
  updateCharacter,
  deleteCharacter,
  countCharactersByCampaign
};
