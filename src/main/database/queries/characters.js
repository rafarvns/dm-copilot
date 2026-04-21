// Queries para Characters
// CRUD operations for character management (Refactored for independent characters)

// ============================================
// CREATE
// ============================================
function createCharacter(db, characterData) {
  const stmt = db.prepare(`
    INSERT INTO characters (name, description, system, hp, ac, ini, image_path, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  const result = stmt.run(
    characterData.name,
    characterData.description || null,
    characterData.system,
    characterData.hp || 0,
    characterData.ac || 10,
    characterData.ini || 0,
    characterData.image_path || null,
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
  return row;
}

function getAllCharacters(db) {
  const rows = db.prepare(`SELECT * FROM characters ORDER BY name`).all();
  return rows;
}

function getCharactersBySystem(db, system) {
  const rows = db.prepare(`SELECT * FROM characters WHERE system = ? ORDER BY name`).all(system);
  return rows;
}

// ============================================
// UPDATE
// ============================================
function updateCharacter(db, id, characterData) {
  const stmt = db.prepare(`
    UPDATE characters 
    SET name = ?, description = ?, system = ?, hp = ?, ac = ?, ini = ?, image_path = ?, updated_at = ?
    WHERE id = ?
  `);

  const now = new Date().toISOString();
  const result = stmt.run(
    characterData.name,
    characterData.description || null,
    characterData.system,
    characterData.hp || 0,
    characterData.ac || 10,
    characterData.ini || 0,
    characterData.image_path || null,
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
// CAMPAIGN LINKS (Many-to-Many)
// ============================================

function linkToCampaign(db, characterId, campaignId) {
  try {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO campaign_characters (campaign_id, character_id)
      VALUES (?, ?)
    `);
    const result = stmt.run(campaignId, characterId);
    return result.changes > 0;
  } catch (error) {
    console.error('Error linking character to campaign:', error);
    return false;
  }
}

function unlinkFromCampaign(db, characterId, campaignId) {
  const result = db.prepare(`
    DELETE FROM campaign_characters 
    WHERE campaign_id = ? AND character_id = ?
  `).run(campaignId, characterId);
  return result.changes > 0;
}

function getCharactersByCampaign(db, campaignId) {
  const rows = db.prepare(`
    SELECT c.* FROM characters c
    JOIN campaign_characters cc ON c.id = cc.character_id
    WHERE cc.campaign_id = ?
    ORDER BY c.name
  `).all(campaignId);
  return rows;
}

function getAvailableCharactersForCampaign(db, campaignId, system) {
  const rows = db.prepare(`
    SELECT * FROM characters 
    WHERE system = ? 
    AND id NOT IN (SELECT character_id FROM campaign_characters WHERE campaign_id = ?)
    ORDER BY name
  `).all(system, campaignId);
  return rows;
}

function countCharactersByCampaign(db, campaignId) {
  const row = db.prepare(`
    SELECT COUNT(*) as count 
    FROM campaign_characters 
    WHERE campaign_id = ?
  `).get(campaignId);
  return row.count;
}

module.exports = {
  createCharacter,
  getCharacterById,
  getAllCharacters,
  getCharactersBySystem,
  updateCharacter,
  deleteCharacter,
  linkToCampaign,
  unlinkFromCampaign,
  getCharactersByCampaign,
  getAvailableCharactersForCampaign,
  countCharactersByCampaign
};
