// Importa uma campanha a partir de um arquivo .dmcopilot (ZIP).

const path = require("path");
const fs = require("fs");
const AdmZip = require("adm-zip");

const SCHEMA_VERSION = 1;

/**
 * Inspeciona o arquivo de import sem gravar nada no banco.
 * Retorna { ok: true, manifest, existsLocally } ou { ok: false, error }.
 *
 * @param {string} filePath
 * @param {import("better-sqlite3").Database} db
 */
function inspectImport(filePath, db) {
  let zip;
  try {
    zip = new AdmZip(filePath);
  } catch (err) {
    return { ok: false, error: "Arquivo inválido ou corrompido" };
  }

  const manifestEntry = zip.getEntry("manifest.json");
  if (!manifestEntry) {
    return { ok: false, error: "Arquivo não contém manifest.json — não é um export válido" };
  }

  let manifest;
  try {
    manifest = JSON.parse(manifestEntry.getData().toString("utf8"));
  } catch (_) {
    return { ok: false, error: "manifest.json corrompido" };
  }

  if (manifest.schemaVersion !== SCHEMA_VERSION) {
    return { ok: false, error: "Versão de arquivo incompatível" };
  }

  // Verifica duplicata por id ou nome
  const byId = db.prepare(`SELECT id FROM campaigns WHERE id = ?`).get(manifest.originalCampaignId);
  const byName = db
    .prepare(`SELECT id FROM campaigns WHERE lower(trim(name)) = lower(trim(?))`)
    .get(manifest.name);
  const existsLocally = !!(byId || byName);

  return {
    ok: true,
    manifest: {
      schemaVersion: manifest.schemaVersion,
      name: manifest.name,
      exportedAt: manifest.exportedAt,
      originalCampaignId: manifest.originalCampaignId,
    },
    existsLocally,
  };
}

/**
 * Importa a campanha do arquivo .dmcopilot no banco.
 * Retorna { ok: true, newCampaignId, counts, mediaWarnings } ou { ok: false, error }.
 *
 * @param {import("better-sqlite3").Database} db
 * @param {string} filePath
 * @param {{ mode: "new"|"replace", userDataDir: string }} opts
 */
async function importCampaign(db, filePath, { mode, userDataDir }) {
  let zip;
  try {
    zip = new AdmZip(filePath);
  } catch (err) {
    return { ok: false, error: "Arquivo inválido ou corrompido" };
  }

  let manifest, bundle;
  try {
    manifest = JSON.parse(zip.getEntry("manifest.json").getData().toString("utf8"));
    bundle = JSON.parse(zip.getEntry("campaign.json").getData().toString("utf8"));
  } catch (_) {
    return { ok: false, error: "Arquivo corrompido — não foi possível ler os dados" };
  }

  if (manifest.schemaVersion !== SCHEMA_VERSION) {
    return { ok: false, error: "Versão de arquivo incompatível" };
  }

  // Paths de imagens da campanha antiga para remoção posterior (modo replace)
  let orphanImagePaths = [];

  // IDs remapeados
  const mapCharId = {};
  const mapEncId = {};
  const mapSceneId = {};

  let newCampaignId;

  try {
    db.transaction(() => {
      // --- Modo replace: localizar e deletar campanha existente ---
      if (mode === "replace") {
        let existingId = null;

        const byId = db
          .prepare(`SELECT id FROM campaigns WHERE id = ?`)
          .get(manifest.originalCampaignId);
        if (byId) {
          existingId = byId.id;
        } else {
          const byName = db
            .prepare(`SELECT id FROM campaigns WHERE lower(trim(name)) = lower(trim(?))`)
            .get(manifest.name);
          if (byName) existingId = byName.id;
        }

        if (existingId !== null) {
          // Coletar paths de imagens órfãs antes de deletar
          const oldCampaign = db.prepare(`SELECT image_path FROM campaigns WHERE id = ?`).get(existingId);
          if (oldCampaign?.image_path) orphanImagePaths.push(oldCampaign.image_path);

          const oldChars = db
            .prepare(
              `SELECT c.image_path FROM characters c
               JOIN campaign_characters cc ON c.id = cc.character_id
               WHERE cc.campaign_id = ?`
            )
            .all(existingId);
          for (const c of oldChars) {
            if (c.image_path) orphanImagePaths.push(c.image_path);
          }

          const oldEncs = db
            .prepare(`SELECT background_image FROM encounters WHERE campaign_id = ?`)
            .all(existingId);
          for (const e of oldEncs) {
            if (e.background_image) orphanImagePaths.push(e.background_image);
          }

          const oldScenes = db
            .prepare(`SELECT background_image FROM scenes WHERE campaign_id = ?`)
            .all(existingId);
          for (const s of oldScenes) {
            if (s.background_image) orphanImagePaths.push(s.background_image);
          }

          db.prepare(`DELETE FROM campaigns WHERE id = ?`).run(existingId);
        }
      }

      // --- Inserir campanha ---
      const c = bundle.campaign;
      const campResult = db
        .prepare(
          `INSERT INTO campaigns (name, description, system, combat_visibility, image_path, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          c.name,
          c.description || null,
          c.system || null,
          c.combat_visibility || null,
          c.image_path || null,
          c.created_at || new Date().toISOString(),
          c.updated_at || new Date().toISOString()
        );
      newCampaignId = Number(campResult.lastInsertRowid);

      // --- Characters ---
      for (const char of bundle.characters) {
        const existing = db
          .prepare(
            `SELECT id FROM characters
             WHERE lower(trim(name)) = lower(trim(?)) AND COALESCE(system,'') = COALESCE(?,'')
             LIMIT 1`
          )
          .get(char.name, char.system || null);

        let newCharId;
        if (existing) {
          newCharId = existing.id;
        } else {
          const actions =
            typeof char.actions === "string"
              ? char.actions
              : JSON.stringify(Array.isArray(char.actions) ? char.actions : []);

          const charResult = db
            .prepare(
              `INSERT INTO characters
               (name, description, system, hp, ac, ini, image_path,
                cr, str, dex, con, "int", wis, cha, actions, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .run(
              char.name,
              char.description || null,
              char.system || null,
              char.hp || 0,
              char.ac || 10,
              char.ini || 0,
              char.image_path || null,
              char.cr ?? null,
              char.str ?? null,
              char.dex ?? null,
              char.con ?? null,
              char.int ?? null,
              char.wis ?? null,
              char.cha ?? null,
              actions,
              char.created_at || new Date().toISOString(),
              char.updated_at || new Date().toISOString()
            );
          newCharId = Number(charResult.lastInsertRowid);
        }

        mapCharId[char.id] = newCharId;
        db.prepare(
          `INSERT OR IGNORE INTO campaign_characters (campaign_id, character_id) VALUES (?, ?)`
        ).run(newCampaignId, newCharId);
      }

      // --- Encounters ---
      for (const enc of bundle.encounters) {
        const monsters =
          enc.monsters !== null && enc.monsters !== undefined
            ? typeof enc.monsters === "string"
              ? enc.monsters
              : JSON.stringify(enc.monsters)
            : null;

        const encResult = db
          .prepare(
            `INSERT INTO encounters
             (campaign_id, name, description, difficulty, location, background_image,
              music_url, music_file, combat_visibility_override, monsters,
              status, current_round, current_turn_index, roll_history,
              created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 'pending', 0, NULL, NULL, ?, ?)`
          )
          .run(
            newCampaignId,
            enc.name,
            enc.description || null,
            enc.difficulty || null,
            enc.location || null,
            enc.background_image || null,
            enc.music_url || null,
            enc.combat_visibility_override || null,
            monsters,
            enc.created_at || new Date().toISOString(),
            enc.updated_at || new Date().toISOString()
          );
        mapEncId[enc.id] = Number(encResult.lastInsertRowid);
      }

      // --- Scenes ---
      for (const scene of bundle.scenes) {
        const sceneResult = db
          .prepare(
            `INSERT INTO scenes
             (campaign_id, name, description, background_image, music_url, music_file, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`
          )
          .run(
            newCampaignId,
            scene.name,
            scene.description || null,
            scene.background_image || null,
            scene.music_url || null,
            scene.created_at || new Date().toISOString(),
            scene.updated_at || new Date().toISOString()
          );
        mapSceneId[scene.id] = Number(sceneResult.lastInsertRowid);
      }

      // --- Scene links ---
      const insertLink = db.prepare(
        `INSERT OR IGNORE INTO scene_links (scene_id_a, scene_id_b) VALUES (?, ?)`
      );
      for (const link of bundle.scene_links) {
        const a = mapSceneId[link.scene_id_a];
        const b = mapSceneId[link.scene_id_b];
        if (a === undefined || b === undefined) continue;
        const minId = Math.min(a, b);
        const maxId = Math.max(a, b);
        insertLink.run(minId, maxId);
      }

      // --- Scene encounters ---
      const insertSceneEnc = db.prepare(
        `INSERT OR IGNORE INTO scene_encounters (scene_id, encounter_id) VALUES (?, ?)`
      );
      for (const se of bundle.scene_encounters) {
        const newSceneId = mapSceneId[se.scene_id];
        const newEncId = mapEncId[se.encounter_id];
        if (newSceneId === undefined || newEncId === undefined) continue;
        insertSceneEnc.run(newSceneId, newEncId);
      }

      // --- Scene notes ---
      const insertSceneNote = db.prepare(
        `INSERT INTO scene_notes (scene_id, title, content, position, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      for (const sn of bundle.scene_notes) {
        const newSceneId = mapSceneId[sn.scene_id];
        if (newSceneId === undefined) continue;
        insertSceneNote.run(
          newSceneId,
          sn.title || "",
          sn.content || "",
          sn.position ?? 0,
          sn.created_at || new Date().toISOString(),
          sn.updated_at || new Date().toISOString()
        );
      }

      // --- Notes ---
      const insertNote = db.prepare(
        `INSERT INTO notes (campaign_id, title, content, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      );
      for (const note of bundle.notes) {
        insertNote.run(
          newCampaignId,
          note.title,
          note.content || null,
          note.created_at || new Date().toISOString(),
          note.updated_at || new Date().toISOString()
        );
      }
    })();
  } catch (err) {
    console.error("Falha na transação de import:", err);
    return { ok: false, error: err.message || "Erro ao importar campanha" };
  }

  // --- Copiar imagens do zip para userData/images/ (fora da transação) ---
  for (const entry of zip.getEntries()) {
    if (!entry.entryName.startsWith("images/") || entry.isDirectory) continue;
    const destPath = path.join(userDataDir, entry.entryName);
    try {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, entry.getData());
    } catch (_) {
      // falha na escrita: ignora silenciosamente
    }
  }

  // --- Remover imagens órfãs da campanha substituída (best effort) ---
  for (const relPath of orphanImagePaths) {
    try {
      const absPath = path.join(userDataDir, "images", relPath);
      if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
    } catch (_) {
      // ignora
    }
  }

  // --- Re-download de áudio (best effort, fora da transação) ---
  const mediaWarnings = [];
  const { downloadAudio, validateYouTubeUrl } = require("./youtube-downloader");

  for (const enc of bundle.encounters) {
    const newEncId = mapEncId[enc.id];
    if (!enc.music_url || !validateYouTubeUrl(enc.music_url)) continue;
    try {
      const { fileName } = await downloadAudio(enc.music_url, `encounter_${newEncId}`);
      db.prepare(`UPDATE encounters SET music_file = ? WHERE id = ?`).run(fileName, newEncId);
    } catch (err) {
      mediaWarnings.push({
        kind: "encounter",
        id: newEncId,
        name: enc.name,
        url: enc.music_url,
        error: err.message,
      });
    }
  }

  for (const scene of bundle.scenes) {
    const newSceneId = mapSceneId[scene.id];
    if (!scene.music_url || !validateYouTubeUrl(scene.music_url)) continue;
    try {
      const { fileName } = await downloadAudio(scene.music_url, `scene_${newSceneId}`);
      db.prepare(`UPDATE scenes SET music_file = ? WHERE id = ?`).run(fileName, newSceneId);
    } catch (err) {
      mediaWarnings.push({
        kind: "scene",
        id: newSceneId,
        name: scene.name,
        url: scene.music_url,
        error: err.message,
      });
    }
  }

  return {
    ok: true,
    newCampaignId,
    counts: {
      characters: Object.keys(mapCharId).length,
      encounters: Object.keys(mapEncId).length,
      scenes: Object.keys(mapSceneId).length,
      notes: bundle.notes.length,
      sceneNotes: bundle.scene_notes.length,
    },
    mediaWarnings,
  };
}

module.exports = { inspectImport, importCampaign };
