// Queries para Encounters
// CRUD operations for encounter management

// ============================================
// CREATE
// ============================================
function createEncounter(db, encounterData) {
  const stmt = db.prepare(`
    INSERT INTO encounters (campaign_id, name, description, difficulty, location, monsters, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  const result = stmt.run(
    encounterData.campaign_id,
    encounterData.name,
    encounterData.description || null,
    encounterData.difficulty || null,
    encounterData.location || null,
    encounterData.monsters ? JSON.stringify(encounterData.monsters) : null,
    now,
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
  const fields = [];
  const values = [];

  // Map of object keys to table columns
  const columnMap = {
    campaign_id: 'campaign_id',
    name: 'name',
    description: 'description',
    difficulty: 'difficulty',
    location: 'location',
    monsters: 'monsters',
    status: 'status',
    current_round: 'current_round',
    current_turn_index: 'current_turn_index'
  };

  for (const [key, column] of Object.entries(columnMap)) {
    if (encounterData[key] !== undefined) {
      fields.push(`${column} = ?`);
      let val = encounterData[key];
      if (key === 'monsters' && val !== null) {
        val = JSON.stringify(val);
      }
      values.push(val);
    }
  }

  if (fields.length === 0) return false;

  const now = new Date().toISOString();
  fields.push("updated_at = ?");
  values.push(now);
  values.push(id);

  const sql = `UPDATE encounters SET ${fields.join(", ")} WHERE id = ?`;
  console.log("SQL Update Encontro:", sql);
  console.log("Valores:", values);
  
  const stmt = db.prepare(sql);
  const result = stmt.run(...values);

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
