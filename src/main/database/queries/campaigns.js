// Queries para Campaigns
// CRUD operations for campaign management

// ============================================
// CREATE
// ============================================
function createCampaign(db, campaignData) {
  const stmt = db.prepare(`
    INSERT INTO campaigns (name, description, system, combat_visibility, image_path, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  const result = stmt.run(
    campaignData.name,
    campaignData.description || null,
    campaignData.system || null,
    campaignData.combat_visibility || null,
    campaignData.image_path || null,
    now,
    now
  );

  return {
    id: result.lastInsertRowid,
    ...campaignData,
    created_at: now,
    updated_at: now,
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

function getRecentCampaigns(db, limit = 5) {
  return db.prepare(`SELECT * FROM campaigns ORDER BY updated_at DESC LIMIT ?`).all(limit);
}

// ============================================
// UPDATE
// ============================================
function updateCampaign(db, id, campaignData) {
  const fields = [];
  const values = [];

  const columnMap = {
    name: "name",
    description: "description",
    system: "system",
    combat_visibility: "combat_visibility",
    image_path: "image_path",
  };

  for (const [key, column] of Object.entries(columnMap)) {
    if (campaignData[key] !== undefined) {
      fields.push(`${column} = ?`);
      values.push(campaignData[key] === "" && key !== "name" ? null : campaignData[key]);
    }
  }

  if (fields.length === 0) return false;

  const now = new Date().toISOString();
  fields.push("updated_at = ?");
  values.push(now);
  values.push(id);

  const sql = `UPDATE campaigns SET ${fields.join(", ")} WHERE id = ?`;
  const stmt = db.prepare(sql);
  const result = stmt.run(...values);

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
  getRecentCampaigns,
  updateCampaign,
  deleteCampaign,
  countCampaigns,
  campaignExists,
};
