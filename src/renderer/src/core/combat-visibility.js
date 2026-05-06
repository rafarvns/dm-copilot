/**
 * Combat Visibility Helper
 *
 * Configura quais campos de cada participante são visíveis na tela do jogador,
 * por afinidade (ally / neutral / enemy). Imagem e affinity bar sempre visíveis.
 *
 * Esquema:
 *   {
 *     ally:    { name, initiative, hp, ca },
 *     neutral: { name, initiative, hp, ca },
 *     enemy:   { name, initiative, hp, ca }
 *   }
 *
 * Resolução: encounter.combat_visibility_override || campaign.combat_visibility || DEFAULT.
 */

export const VISIBILITY_FIELDS = ["name", "initiative", "hp", "ca"];
export const VISIBILITY_AFFINITIES = ["ally", "neutral", "enemy"];

const baseRow = () => ({ name: true, initiative: true, hp: false, ca: false });

export const DEFAULT_VISIBILITY = Object.freeze({
  ally: baseRow(),
  neutral: baseRow(),
  enemy: baseRow()
});

export function makeDefaultVisibility() {
  return {
    ally: baseRow(),
    neutral: baseRow(),
    enemy: baseRow()
  };
}

export function parseVisibility(jsonStrOrObj) {
  if (!jsonStrOrObj) return null;
  try {
    const obj = typeof jsonStrOrObj === "string" ? JSON.parse(jsonStrOrObj) : jsonStrOrObj;
    if (!obj || typeof obj !== "object") return null;
    // Mesclar com default para preencher campos ausentes
    const out = makeDefaultVisibility();
    for (const aff of VISIBILITY_AFFINITIES) {
      if (obj[aff] && typeof obj[aff] === "object") {
        for (const f of VISIBILITY_FIELDS) {
          if (typeof obj[aff][f] === "boolean") out[aff][f] = obj[aff][f];
        }
      }
    }
    return out;
  } catch (_) {
    return null;
  }
}

export function resolveEffectiveVisibility(encounter, campaign) {
  return (
    parseVisibility(encounter?.combat_visibility_override) ||
    parseVisibility(campaign?.combat_visibility) ||
    makeDefaultVisibility()
  );
}

/**
 * Aplica o filtro de visibilidade a um participante, retornando uma cópia
 * com campos ocultos substituídos por null. Mantém id, image, affinity,
 * has_acted e deathSaves intactos para a tela do jogador renderizar
 * corretamente o estado da arena.
 */
export function applyVisibilityToParticipant(p, visForAffinity) {
  if (!visForAffinity) return { ...p };
  return {
    ...p,
    name: visForAffinity.name ? p.name : null,
    initiative: visForAffinity.initiative ? p.initiative : null,
    hp: visForAffinity.hp ? p.hp : null,
    current_hp: visForAffinity.hp ? p.current_hp : null,
    ca: visForAffinity.ca ? p.ca : null
  };
}
