// Queries para Encounters
// CRUD operations for encounter management

// ============================================
// CREATE
// ============================================
function createEncounter(db, encounterData) {
  const stmt = db.prepare(`
    INSERT INTO encounters (campaign_id, name, description, difficulty, monsters, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  const result = stmt.run(
    encounterData.campaign_id,
    encounterData.name,
    encounterData.description || null,
    encounterData.difficulty || null,
    encounterData.monsters ? JSON.stringify(encounterData.monsters) : null,
    now
  );

  return {
    id: result.lastInsertRowid,
    ...encounterData,
    created_at: now
  };
}

// ============================================
// READ
// ============================================
function getEncounterById(db, id) {
  const row = db.prepare(`SELECT * FROM encounters WHERE id = ?`).get(id);
  if (row && row.monsters) {
    row.monsters = JSON.parse(row.monsters);
  }
  return row;
}

function getEncountersByCampaign(db, campaignId) {
  const rows = db.prepare(`SELECT * FROM encounters WHERE campaign_id = ? ORDER BY created_at DESC`).all(campaignId);
  return rows.map(encounter => {
    if (encounter.monsters) {
      encounter.monsters = JSON.parse(encounter.monsters);
    }
    return encounter;
  });
}

function getAllEncounters(db) {
  const rows = db.prepare(`SELECT * FROM encounters ORDER BY created_at DESC`).all();
  return rows.map(encounter => {
    if (encounter.monsters) {
      encounter.monsters = JSON.parse(encounter.monsters);
    }
    return encounter;
  });
}

// ============================================
// UPDATE
// ============================================
function updateEncounter(db, id, encounterData) {
  const stmt = db.prepare(`
    UPDATE encounters 
    SET campaign_id = ?, name = ?, description = ?, difficulty = ?, 
        monsters = ?, updated_at = ?
    WHERE id = ?
  `);

  const now = new Date().toISOString();
  const result = stmt.run(
    encounterData.campaign_id,
    encounterData.name,
    encounterData.description || null,
    encounterData.difficulty || null,
    encounterData.monsters ? JSON.stringify(encounterData.monsters) : null,
    now,
    id
  );

  return result.changes > 0;
}

// ============================================
// DELETE
// ============================================
function deleteEncounter(db, id) {
  const result = db.prepare(`DELETE FROM encounters WHERE id = ?`).run(id);
  return result.changes > 0;
}

// ============================================
// COUNT
// ============================================
function countEncountersByCampaign(db, campaignId) {
  const row = db.prepare(`SELECT COUNT(*) as count FROM encounters WHERE campaign_id = ?`).get(campaignId);
  return row.count;
}

module.exports = {
  createEncounter,
  getEncounterById,
  getEncountersByCampaign,
  getAllEncounters,
  updateEncounter,
  deleteEncounter,
  countEncountersByCampaign
};
