// Queries para Notes
// CRUD operations for note management

// ============================================
// CREATE
// ============================================
export function createNote(db, noteData) {
  const stmt = db.prepare(`
    INSERT INTO notes (campaign_id, title, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  const result = stmt.run(
    noteData.campaign_id,
    noteData.title,
    noteData.content || null,
    now,
    now
  );

  return {
    id: result.lastInsertRowid,
    ...noteData,
    created_at: now,
    updated_at: now
  };
}

// ============================================
// READ
// ============================================
export function getNoteById(db, id) {
  return db.prepare(`SELECT * FROM notes WHERE id = ?`).get(id);
}

export function getNotesByCampaign(db, campaignId) {
  return db.prepare(`SELECT * FROM notes WHERE campaign_id = ? ORDER BY updated_at DESC`).all(campaignId);
}

export function getAllNotes(db) {
  return db.prepare(`SELECT * FROM notes ORDER BY updated_at DESC`).all();
}

// ============================================
// UPDATE
// ============================================
export function updateNote(db, id, noteData) {
  const stmt = db.prepare(`
    UPDATE notes 
    SET campaign_id = ?, title = ?, content = ?, updated_at = ?
    WHERE id = ?
  `);

  const now = new Date().toISOString();
  const result = stmt.run(
    noteData.campaign_id,
    noteData.title,
    noteData.content || null,
    now,
    id
  );

  return result.changes > 0;
}

// ============================================
// DELETE
// ============================================
export function deleteNote(db, id) {
  const result = db.prepare(`DELETE FROM notes WHERE id = ?`).run(id);
  return result.changes > 0;
}

// ============================================
// COUNT
// ============================================
export function countNotesByCampaign(db, campaignId) {
  const row = db.prepare(`SELECT COUNT(*) as count FROM notes WHERE campaign_id = ?`).get(campaignId);
  return row.count;
}
