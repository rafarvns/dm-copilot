function listSceneNotes(db, sceneId) {
  return db
    .prepare(
      `SELECT id, scene_id, title, content, position, created_at, updated_at
       FROM scene_notes
       WHERE scene_id = ?
       ORDER BY position ASC, id ASC`
    )
    .all(sceneId);
}

function createSceneNote(db, sceneId, { title } = {}) {
  const max = db
    .prepare("SELECT COALESCE(MAX(position), -1) AS m FROM scene_notes WHERE scene_id = ?")
    .get(sceneId);
  const position = (max?.m ?? -1) + 1;
  const count = db
    .prepare("SELECT COUNT(*) AS c FROM scene_notes WHERE scene_id = ?")
    .get(sceneId).c;
  const finalTitle = title && String(title).trim() ? String(title).trim() : `Nota ${count + 1}`;

  const result = db
    .prepare(
      `INSERT INTO scene_notes (scene_id, title, content, position)
       VALUES (?, ?, '', ?)`
    )
    .run(sceneId, finalTitle, position);

  return db.prepare("SELECT * FROM scene_notes WHERE id = ?").get(result.lastInsertRowid);
}

function updateSceneNote(db, id, { title, content } = {}) {
  const fields = [];
  const values = [];
  if (title !== undefined) {
    fields.push("title = ?");
    values.push(String(title));
  }
  if (content !== undefined) {
    fields.push("content = ?");
    values.push(String(content));
  }
  if (fields.length === 0) return false;
  fields.push("updated_at = datetime('now')");
  values.push(id);
  const sql = `UPDATE scene_notes SET ${fields.join(", ")} WHERE id = ?`;
  return db.prepare(sql).run(...values).changes > 0;
}

function deleteSceneNote(db, id) {
  return db.prepare("DELETE FROM scene_notes WHERE id = ?").run(id).changes > 0;
}

function reorderSceneNotes(db, sceneId, orderedIds) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return false;
  const stmt = db.prepare("UPDATE scene_notes SET position = ? WHERE id = ? AND scene_id = ?");
  const tx = db.transaction((ids) => {
    ids.forEach((id, idx) => stmt.run(idx, id, sceneId));
  });
  tx(orderedIds);
  return true;
}

module.exports = {
  listSceneNotes,
  createSceneNote,
  updateSceneNote,
  deleteSceneNote,
  reorderSceneNotes,
};
