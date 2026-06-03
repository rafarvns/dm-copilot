// Exporta uma campanha completa para um arquivo .dmcopilot (ZIP).

const path = require("path");
const fs = require("fs");
const AdmZip = require("adm-zip");
const { collectCampaignBundle } = require("../database/queries/campaigns-bundle");

/**
 * Exporta a campanha `campaignId` para o arquivo `outputPath`.
 * Retorna { ok: true, path, sizeBytes, counts } ou lança erro.
 *
 * @param {import("better-sqlite3").Database} db
 * @param {number} campaignId
 * @param {string} outputPath
 * @param {{ userDataDir: string, appVersion: string }} opts
 */
async function exportCampaign(db, campaignId, outputPath, { userDataDir, appVersion }) {
  const bundle = collectCampaignBundle(db, campaignId);
  if (!bundle) {
    throw new Error(`Campanha ${campaignId} não encontrada`);
  }

  const zip = new AdmZip();

  // --- manifest.json ---
  const manifest = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    appVersion: appVersion || "0.0.0",
    originalCampaignId: bundle.campaign.id,
    name: bundle.campaign.name,
  };
  zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf8"));

  // --- campaign.json ---
  zip.addFile("campaign.json", Buffer.from(JSON.stringify(bundle, null, 2), "utf8"));

  // --- imagens ---
  let imageCount = 0;
  const imagePaths = new Set();

  // Coleta todos os paths de imagem referenciados
  if (bundle.campaign.image_path) imagePaths.add(bundle.campaign.image_path);
  for (const char of bundle.characters) {
    if (char.image_path) imagePaths.add(char.image_path);
  }
  for (const enc of bundle.encounters) {
    if (enc.background_image) imagePaths.add(enc.background_image);
  }
  for (const scene of bundle.scenes) {
    if (scene.background_image) imagePaths.add(scene.background_image);
  }

  for (const relPath of imagePaths) {
    const absPath = path.join(userDataDir, "images", relPath);
    if (!fs.existsSync(absPath)) continue; // ignora silenciosamente se não existir

    // relPath exemplo: "characters/char_123.webp"
    // entryName dentro do zip: "images/characters/char_123.webp"
    const zipFolder = path.posix.join("images", path.dirname(relPath).replace(/\\/g, "/"));
    try {
      const fileBuffer = fs.readFileSync(absPath);
      const fileName = path.basename(relPath);
      zip.addFile(`${zipFolder}/${fileName}`, fileBuffer);
      imageCount++;
    } catch (_) {
      // falha na leitura: ignora silenciosamente
    }
  }

  zip.writeZip(outputPath);

  const stats = fs.statSync(outputPath);

  return {
    ok: true,
    path: outputPath,
    sizeBytes: stats.size,
    counts: {
      characters: bundle.characters.length,
      encounters: bundle.encounters.length,
      scenes: bundle.scenes.length,
      notes: bundle.notes.length,
      sceneNotes: bundle.scene_notes.length,
      images: imageCount,
    },
  };
}

module.exports = { exportCampaign };
