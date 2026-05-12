// Helpers de stats D&D 5e — usados pelo modal de detalhes do combate, form de PC e busca da API.
// Mod = floor((score - 10) / 2). CR fracionário formatado como string (1/8, 1/4, 1/2).

export function modifier(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  return Math.floor((n - 10) / 2);
}

export function formatModifier(score) {
  const m = modifier(score);
  return m >= 0 ? `+${m}` : `${m}`;
}

export function formatCR(cr) {
  if (cr === 0.125 || cr === "0.125") return "1/8";
  if (cr === 0.25 || cr === "0.25") return "1/4";
  if (cr === 0.5 || cr === "0.5") return "1/2";
  if (cr == null || cr === "") return "—";
  return String(cr);
}
