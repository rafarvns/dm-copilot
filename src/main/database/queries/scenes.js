// Queries para Scenes (Cenas)
// CRUD + ligações cena↔cena (bidirecionais) e cena↔encontro (N:N)

// ============================================
// CREATE
// ============================================
function createScene(db, sceneData) {
  const stmt = db.prepare(`
    INSERT INTO scenes (campaign_id, name, description, background_image, music_url, music_file, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  const result = stmt.run(
    sceneData.campaign_id,
    sceneData.name,
    sceneData.description || null,
    sceneData.background_image || null,
    sceneData.music_url || null,
    sceneData.music_file || null,
    now,
    now
  );

  return {
    id: result.lastInsertRowid,
    ...sceneData,
    created_at: now,
    updated_at: now,
  };
}

// ============================================
// READ
// ============================================
function getSceneById(db, id) {
  const row = db.prepare(`SELECT * FROM scenes WHERE id = ?`).get(id);
  if (!row) return null;
  row.linked_scenes = getSceneLinks(db, id);
  row.linked_encounters = getSceneEncounters(db, id);
  return row;
}

function getScenesByCampaign(db, campaignId) {
  return db
    .prepare(`SELECT * FROM scenes WHERE campaign_id = ? ORDER BY created_at DESC`)
    .all(campaignId);
}

// ============================================
// UPDATE
// ============================================
function updateScene(db, id, sceneData) {
  const fields = [];
  const values = [];

  const columnMap = {
    campaign_id: "campaign_id",
    name: "name",
    description: "description",
    background_image: "background_image",
    music_url: "music_url",
    music_file: "music_file",
    notes: "notes",
  };

  for (const [key, column] of Object.entries(columnMap)) {
    if (sceneData[key] !== undefined) {
      fields.push(`${column} = ?`);
      values.push(sceneData[key]);
    }
  }

  if (fields.length === 0) return false;

  const now = new Date().toISOString();
  fields.push("updated_at = ?");
  values.push(now);
  values.push(id);

  const sql = `UPDATE scenes SET ${fields.join(", ")} WHERE id = ?`;
  const result = db.prepare(sql).run(...values);
  return result.changes > 0;
}

// ============================================
// DELETE
// ============================================
function deleteScene(db, id) {
  const result = db.prepare(`DELETE FROM scenes WHERE id = ?`).run(id);
  return result.changes > 0;
}

// ============================================
// SCENE LINKS (bidirectional)
// ============================================
function getSceneLinks(db, sceneId) {
  // Retorna as cenas conectadas (ambos os lados da ligação simétrica).
  return db
    .prepare(
      `
    SELECT s.id, s.name
    FROM scenes s
    WHERE s.id IN (
      SELECT scene_id_b FROM scene_links WHERE scene_id_a = ?
      UNION
      SELECT scene_id_a FROM scene_links WHERE scene_id_b = ?
    )
    ORDER BY s.name
  `
    )
    .all(sceneId, sceneId);
}

function setSceneLinks(db, sceneId, otherSceneIds) {
  const sid = Number(sceneId);
  const others = (otherSceneIds || []).map(Number).filter((n) => Number.isInteger(n) && n !== sid);

  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM scene_links WHERE scene_id_a = ? OR scene_id_b = ?`).run(sid, sid);
    const insert = db.prepare(
      `INSERT OR IGNORE INTO scene_links (scene_id_a, scene_id_b) VALUES (?, ?)`
    );
    for (const other of others) {
      const a = Math.min(sid, other);
      const b = Math.max(sid, other);
      insert.run(a, b);
    }
  });

  tx();
  return true;
}

// ============================================
// SCENE ↔ ENCOUNTER (N:N)
// ============================================
function getSceneEncounters(db, sceneId) {
  return db
    .prepare(
      `
    SELECT e.id, e.name, e.difficulty
    FROM encounters e
    INNER JOIN scene_encounters se ON se.encounter_id = e.id
    WHERE se.scene_id = ?
    ORDER BY e.name
  `
    )
    .all(sceneId);
}

function setSceneEncounters(db, sceneId, encounterIds) {
  const sid = Number(sceneId);
  const ids = (encounterIds || []).map(Number).filter((n) => Number.isInteger(n));

  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM scene_encounters WHERE scene_id = ?`).run(sid);
    const insert = db.prepare(
      `INSERT OR IGNORE INTO scene_encounters (scene_id, encounter_id) VALUES (?, ?)`
    );
    for (const eid of ids) insert.run(sid, eid);
  });

  tx();
  return true;
}

// ============================================
// COUNT
// ============================================
function countScenesByCampaign(db, campaignId) {
  const row = db
    .prepare(`SELECT COUNT(*) as count FROM scenes WHERE campaign_id = ?`)
    .get(campaignId);
  return row.count;
}

module.exports = {
  createScene,
  getSceneById,
  getScenesByCampaign,
  updateScene,
  deleteScene,
  getSceneLinks,
  setSceneLinks,
  getSceneEncounters,
  setSceneEncounters,
  countScenesByCampaign,
};
