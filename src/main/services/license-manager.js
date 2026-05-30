"use strict";

const path = require("path");
const fs = require("fs");
const { machineIdSync } = require("node-machine-id");

// ============================================
// Limites do plano trial
// ============================================
const TRIAL_LIMITS = {
  campaign: 1,
  character: 10,
  encounter: 1,
  encounter_participants: 8,
  scene: 1,
};

// ============================================
// Estado interno do módulo
// ============================================
let _app = null;
let _db = null;
let _machineId = null;
let _status = "trial"; // "dev" | "trial" | "licensed"
let _licenseKey = null;

// ============================================
// Helpers internos
// ============================================

function _licensePath() {
  return path.join(_app.getPath("userData"), "license.json");
}

function _loadState() {
  _status = _app.isPackaged ? "trial" : "dev";
  _licenseKey = null;

  if (!_app.isPackaged) return; // modo dev: nada a verificar

  try {
    const raw = fs.readFileSync(_licensePath(), "utf8");
    const data = JSON.parse(raw);

    if (data && data.key && data.machineId && data.machineId === _machineId) {
      _status = "licensed";
      _licenseKey = data.key;
    }
    // Se machineId não casar, ignora — status permanece "trial"
  } catch (_) {
    // Arquivo não existe ou JSON inválido — status permanece "trial"
  }
}

// TODO: trocar por POST /activate quando a API estiver pronta. Mantenha
// o mesmo retorno (true/false) pra não quebrar o caller.
function _validateKeyStub(key) {
  return /^DMC-[A-Z0-9-]{8,}$/i.test(key);
}

function _counts() {
  const { countCampaigns } = require("../database/queries/campaigns");
  const { countCharacters } = require("../database/queries/characters");
  const { countEncounters } = require("../database/queries/encounters");
  const { countScenes } = require("../database/queries/scenes");
  return {
    campaigns: countCampaigns(_db),
    characters: countCharacters(_db),
    encounters: countEncounters(_db),
    scenes: countScenes(_db),
  };
}

// ============================================
// API pública
// ============================================

const licenseManager = {
  init({ app, db }) {
    _app = app;
    _db = db;
    _machineId = machineIdSync({ original: false });
    _loadState();

    const short = _machineId.substring(0, 8);
    console.log(`[license] status=${_status} machineId=${short}`);
  },

  getMachineId() {
    return _machineId;
  },

  getStatus() {
    const isTrial = _status === "trial";
    const counts = _counts();
    return {
      status: _status,
      machineId: _machineId,
      info: {
        campaigns: { used: counts.campaigns, limit: isTrial ? TRIAL_LIMITS.campaign : null },
        characters: { used: counts.characters, limit: isTrial ? TRIAL_LIMITS.character : null },
        encounters: { used: counts.encounters, limit: isTrial ? TRIAL_LIMITS.encounter : null },
        scenes: { used: counts.scenes, limit: isTrial ? TRIAL_LIMITS.scene : null },
      },
    };
  },

  canCreate(entity, payload) {
    if (_status === "dev" || _status === "licensed") {
      return { ok: true };
    }

    // Modo trial — verifica quota por entidade
    const counts = _counts();

    if (entity === "campaign") {
      if (counts.campaigns < TRIAL_LIMITS.campaign) return { ok: true };
      return { ok: false, code: "QUOTA_EXCEEDED", entity, limit: TRIAL_LIMITS.campaign, current: counts.campaigns };
    }

    if (entity === "character") {
      if (counts.characters < TRIAL_LIMITS.character) return { ok: true };
      return { ok: false, code: "QUOTA_EXCEEDED", entity, limit: TRIAL_LIMITS.character, current: counts.characters };
    }

    if (entity === "encounter") {
      if (counts.encounters < TRIAL_LIMITS.encounter) return { ok: true };
      return { ok: false, code: "QUOTA_EXCEEDED", entity, limit: TRIAL_LIMITS.encounter, current: counts.encounters };
    }

    if (entity === "scene") {
      if (counts.scenes < TRIAL_LIMITS.scene) return { ok: true };
      return { ok: false, code: "QUOTA_EXCEEDED", entity, limit: TRIAL_LIMITS.scene, current: counts.scenes };
    }

    if (entity === "encounter_participants") {
      const monstersLength = payload && Array.isArray(payload.monstersLength)
        ? payload.monstersLength
        : (payload && typeof payload.monstersLength === "number" ? payload.monstersLength : 0);
      if (monstersLength <= TRIAL_LIMITS.encounter_participants) return { ok: true };
      return {
        ok: false,
        code: "QUOTA_EXCEEDED",
        entity,
        limit: TRIAL_LIMITS.encounter_participants,
        current: monstersLength,
      };
    }

    // Entidade desconhecida — libera por segurança
    return { ok: true };
  },

  activate(key) {
    const trimmed = (key || "").trim();

    if (!_validateKeyStub(trimmed)) {
      return { ok: false, error: "INVALID_FORMAT" };
    }

    if (_status === "licensed" && _licenseKey === trimmed) {
      return { ok: false, error: "ALREADY_ACTIVATED" };
    }

    const data = {
      key: trimmed,
      machineId: _machineId,
      activatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(_licensePath(), JSON.stringify(data, null, 2));
    _loadState();

    return { ok: true };
  },

  deactivate() {
    try {
      fs.unlinkSync(_licensePath());
    } catch (_) {
      // Arquivo já não existia — sem problema
    }
    _loadState();
    return { ok: true };
  },
};

module.exports = licenseManager;
