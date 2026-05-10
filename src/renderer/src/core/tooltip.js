// Tooltip global por event delegation — sem delay, sem fade.
// Funciona com DOM dinâmico sem precisar re-hidratar.

/** @type {HTMLElement | null} */
let tooltipRoot = null;

/** @type {HTMLElement | null} */
let currentTarget = null;

/** @returns {HTMLElement} */
function getOrCreateRoot() {
  if (tooltipRoot) return tooltipRoot;

  tooltipRoot = document.createElement("div");
  tooltipRoot.id = "tooltip-root";
  tooltipRoot.className = "tooltip";
  tooltipRoot.hidden = true;
  document.body.appendChild(tooltipRoot);
  return tooltipRoot;
}

const PLACEMENTS = ["top", "bottom", "left", "right"];

/** @param {HTMLElement} tip @param {string} placement */
function applyPlacementClass(tip, placement) {
  PLACEMENTS.forEach((p) => tip.classList.remove(`tooltip--${p}`));
  tip.classList.add(`tooltip--${placement}`);
}

/**
 * @param {DOMRect} targetRect
 * @param {DOMRect} tipRect
 * @param {string} placement
 * @returns {{ top: number, left: number }}
 */
function calcPosition(targetRect, tipRect, placement) {
  let top = 0;
  let left = 0;

  if (placement === "top") {
    top = targetRect.top - tipRect.height - 8;
    left = targetRect.left + (targetRect.width - tipRect.width) / 2;
  } else if (placement === "bottom") {
    top = targetRect.bottom + 8;
    left = targetRect.left + (targetRect.width - tipRect.width) / 2;
  } else if (placement === "left") {
    left = targetRect.left - tipRect.width - 8;
    top = targetRect.top + (targetRect.height - tipRect.height) / 2;
  } else if (placement === "right") {
    left = targetRect.right + 8;
    top = targetRect.top + (targetRect.height - tipRect.height) / 2;
  }

  return { top, left };
}

/** @param {HTMLElement} el */
function show(el) {
  const text =
    el.dataset.tooltip || el.getAttribute("aria-label") || el.getAttribute("title") || "";
  if (!text) return;

  // Suprime o tooltip nativo do browser salvando e removendo o title
  if (el.hasAttribute("title")) {
    el.dataset._origTitle = el.getAttribute("title");
    el.removeAttribute("title");
  }

  currentTarget = el;

  const tip = getOrCreateRoot();
  tip.textContent = text;
  tip.hidden = false;

  const placement = el.dataset.tooltipPlacement || "top";
  applyPlacementClass(tip, placement);

  requestAnimationFrame(() => {
    // Aborta se o elemento foi removido do DOM enquanto o frame estava pendente
    if (!el.isConnected) {
      hide();
      return;
    }

    const targetRect = el.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();

    let { top, left } = calcPosition(targetRect, tipRect, placement);
    let resolvedPlacement = placement;

    // Inverte de top pra bottom se sair pelo topo da viewport
    if (placement === "top" && top < 8) {
      resolvedPlacement = "bottom";
      ({ top, left } = calcPosition(targetRect, tipRect, "bottom"));
      applyPlacementClass(tip, "bottom");
    }

    // Clamp horizontal
    left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));
    // Clamp vertical
    top = Math.max(8, Math.min(top, window.innerHeight - tipRect.height - 8));

    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;

    void resolvedPlacement; // silencia lint de variável não usada
  });
}

function hide() {
  if (!tooltipRoot) return;

  tooltipRoot.hidden = true;
  PLACEMENTS.forEach((p) => tooltipRoot.classList.remove(`tooltip--${p}`));

  // Restaura o title original se houver
  if (currentTarget && currentTarget.dataset._origTitle !== undefined) {
    currentTarget.setAttribute("title", currentTarget.dataset._origTitle);
    delete currentTarget.dataset._origTitle;
  }

  currentTarget = null;
}

/** Evita anexar listeners duplicados em chamadas subsequentes */
let mounted = false;

/**
 * Inicializa o sistema de tooltip global por event delegation.
 * Idempotente — chamadas subsequentes são no-op.
 *
 * @param {Document | HTMLElement} _root — reservado pra uso futuro; delegação sempre no body.
 */
export function mountTooltips(_root = document) {
  if (mounted) return;
  mounted = true;

  getOrCreateRoot();

  document.body.addEventListener("mouseover", (e) => {
    const el = e.target.closest("[data-tooltip]");
    if (!el) return;
    show(el);
  });

  document.body.addEventListener("mouseout", (e) => {
    if (!currentTarget) return;
    // Ignora mouseout em filhos internos do alvo atual
    if (currentTarget.contains(e.relatedTarget)) return;
    if (e.target === currentTarget || currentTarget.contains(e.target)) {
      hide();
    }
  });

  document.body.addEventListener("focusin", (e) => {
    const el = e.target.closest("[data-tooltip]");
    if (!el) return;
    show(el);
  });

  document.body.addEventListener("focusout", (e) => {
    if (!currentTarget) return;
    if (e.target === currentTarget || currentTarget.contains(e.target)) {
      hide();
    }
  });

  // Esconde se a página rolar ou redimensionar — tooltip "trava" na posição antiga
  window.addEventListener("scroll", hide, { capture: true, passive: true });
  window.addEventListener("resize", hide, { passive: true });
}
