const RELATIVE_TIME = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

export function pluralize(qty, sing, plur) {
  return `${qty} ${qty === 1 ? sing : plur}`;
}

export function formatRelativeTime(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const diffMs = then - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  if (Math.abs(diffMin) < 1) return "agora há pouco";
  if (Math.abs(diffMin) < 60) return RELATIVE_TIME.format(diffMin, "minute");
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return RELATIVE_TIME.format(diffHour, "hour");
  const diffDay = Math.round(diffHour / 24);
  if (Math.abs(diffDay) < 30) return RELATIVE_TIME.format(diffDay, "day");
  const diffMonth = Math.round(diffDay / 30);
  return RELATIVE_TIME.format(diffMonth, "month");
}

export function truncate(text, max) {
  if (!text) return "";
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

export function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

export function normalizeDifficulty(s) {
  if (!s) return "unknown";
  const k = String(s).toLowerCase().trim();
  if (["easy", "fácil", "facil"].includes(k)) return "easy";
  if (["medium", "médio", "medio"].includes(k)) return "medium";
  if (["hard", "difícil", "dificil"].includes(k)) return "hard";
  if (["deadly", "mortal"].includes(k)) return "deadly";
  return "unknown";
}
