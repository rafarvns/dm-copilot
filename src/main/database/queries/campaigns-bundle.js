// Agrega todos os dados de uma campanha em um único objeto serializável.
// Usado pela feature de export/import.

const { getCampaignById } = require("./campaigns");
const { getCharactersByCampaign } = require("./characters");
const { getEncountersByCampaign } = require("./encounters");
const { getScenesByCampaign } = require("./scenes");
const { getNotesByCampaign } = require("./notes");
const { listSceneNotes } = require("./scene-notes");

function collectCampaignBundle(db, campaignId) {
  const campaign = getCampaignById(db, campaignId);
  if (!campaign) return null;

  const characters = getCharactersByCampaign(db, campaignId);
  const campaign_characters = db
    .prepare(`SELECT character_id FROM campaign_characters WHERE campaign_id = ?`)
    .all(campaignId)
    .map((r) => r.character_id);

  const encounters = getEncountersByCampaign(db, campaignId);
  const scenes = getScenesByCampaign(db, campaignId);
  const sceneIds = scenes.map((s) => s.id);

  let scene_links = [];
  let scene_encounters = [];
  const scene_notes = [];

  if (sceneIds.length > 0) {
    const placeholders = sceneIds.map(() => "?").join(",");
    scene_links = db
      .prepare(
        `SELECT scene_id_a, scene_id_b FROM scene_links
         WHERE scene_id_a IN (${placeholders}) AND scene_id_b IN (${placeholders})`
      )
      .all(...sceneIds, ...sceneIds);
    scene_encounters = db
      .prepare(
        `SELECT scene_id, encounter_id FROM scene_encounters WHERE scene_id IN (${placeholders})`
      )
      .all(...sceneIds);
    for (const sid of sceneIds) scene_notes.push(...listSceneNotes(db, sid));
  }

  const notes = getNotesByCampaign(db, campaignId);

  return {
    campaign,
    characters,
    campaign_characters,
    encounters,
    scenes,
    scene_links,
    scene_encounters,
    scene_notes,
    notes,
  };
}

module.exports = { collectCampaignBundle };
