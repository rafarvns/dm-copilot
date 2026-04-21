// Queries para Campaigns
// CRUD operations for campaign management

// ============================================
// CREATE
// ============================================
function createCampaign(db, campaignData) {
  const stmt = db.prepare(`
    INSERT INTO campaigns (name, description, system, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  const result = stmt.run(
    campaignData.name,
    campaignData.description || null,
    campaignData.system || null,
    now,
    now
  );

  return {
    id: result.lastInsertRowid,
    ...campaignData,
    created_at: now,
    updated_at: now
  };
}

// ============================================
// READ
// ============================================
function getCampaignById(db, id) {
  return db.prepare(`SELECT * FROM campaigns WHERE id = ?`).get(id);
}

function getAllCampaigns(db) {
  return db.prepare(`SELECT * FROM campaigns ORDER BY updated_at DESC`).all();
}

function getCampaignsBySystem(db, system) {
  return db.prepare(`SELECT * FROM campaigns WHERE system = ? ORDER BY name`).all(system);
}

// ============================================
// UPDATE
// ============================================
function updateCampaign(db, id, campaignData) {
  const stmt = db.prepare(`
    UPDATE campaigns 
    SET name = ?, description = ?, system = ?, updated_at = ?
    WHERE id = ?
  `);

  const now = new Date().toISOString();
  const result = stmt.run(
    campaignData.name,
    campaignData.description || null,
    campaignData.system || null,
    now,
    id
  );

  return result.changes > 0;
}

// ============================================
// DELETE
// ============================================
function deleteCampaign(db, id) {
  const result = db.prepare(`DELETE FROM campaigns WHERE id = ?`).run(id);
  return result.changes > 0;
}

// ============================================
// COUNT
// ============================================
function countCampaigns(db) {
  const row = db.prepare(`SELECT COUNT(*) as count FROM campaigns`).get();
  return row.count;
}

// ============================================
// EXISTS
// ============================================
function campaignExists(db, id) {
  const row = db.prepare(`SELECT EXISTS(SELECT 1 FROM campaigns WHERE id = ?) as exists`).get(id);
  return row.exists === 1;
}

module.exports = {
  createCampaign,
  getCampaignById,
  getAllCampaigns,
  getCampaignsBySystem,
  updateCampaign,
  deleteCampaign,
  countCampaigns,
  campaignExists
};
