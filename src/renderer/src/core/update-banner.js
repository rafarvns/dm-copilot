import { mountIcons } from "./icons.js";
import { showToast } from "./toast.js";

const BANNER_ID = "update-banner";

const TEMPLATE = `
<aside class="update-banner update-banner--hidden" id="update-banner" role="status" aria-live="polite">
  <header class="update-banner__header">
    <span class="update-banner__icon"><i data-icon="download-cloud"></i></span>
    <div class="update-banner__title-group">
      <strong class="update-banner__title">Atualização disponível</strong>
      <span class="update-banner__subtitle" id="update-banner-subtitle"></span>
    </div>
  </header>
  <div class="update-banner__progress" id="update-banner-progress" hidden>
    <div class="update-banner__progress-bar" id="update-banner-progress-bar" style="width: 0%"></div>
  </div>
  <div class="update-banner__actions" id="update-banner-actions">
    <button type="button" class="btn btn--ghost btn--sm" id="update-banner-dismiss">Ignorar</button>
    <button type="button" class="btn btn--primary btn--sm" id="update-banner-accept">Atualizar</button>
  </div>
</aside>
`.trim();

function setState(banner, state) {
  const subtitle = banner.querySelector("#update-banner-subtitle");
  const progress = banner.querySelector("#update-banner-progress");
  const progressBar = banner.querySelector("#update-banner-progress-bar");
  const actions = banner.querySelector("#update-banner-actions");

  banner.className = banner.className.replace(/update-banner--\S+/g, "").trim();

  switch (state.type) {
    case "available":
      subtitle.textContent = `v${state.version} — baixar agora?`;
      actions.hidden = false;
      progress.hidden = true;
      banner.classList.add("update-banner", "update-banner--available");
      break;

    case "downloading": {
      const pct = Math.round(state.percent ?? 0);
      subtitle.textContent = `Baixando… ${pct}%`;
      progressBar.style.width = `${pct}%`;
      actions.hidden = true;
      progress.hidden = false;
      banner.classList.add("update-banner", "update-banner--downloading");
      break;
    }

    case "ready":
      subtitle.textContent = "Pronto! Reiniciando…";
      actions.hidden = true;
      progress.hidden = true;
      banner.classList.add("update-banner", "update-banner--ready");
      break;

    case "hidden":
      banner.classList.add("update-banner", "update-banner--hidden");
      break;
  }
}

export function mountUpdateBanner() {
  if (document.getElementById(BANNER_ID)) return;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = TEMPLATE;
  const banner = wrapper.firstElementChild;
  document.body.appendChild(banner);
  mountIcons(banner);

  banner.querySelector("#update-banner-dismiss").addEventListener("click", () => {
    setState(banner, { type: "hidden" });
  });

  banner.querySelector("#update-banner-accept").addEventListener("click", () => {
    window.dmCopilot?.updater?.download?.();
    setState(banner, { type: "downloading", percent: 0 });
  });

  if (!window.dmCopilot?.updater?.onEvent) return;

  window.dmCopilot.updater.onEvent(({ type, payload }) => {
    switch (type) {
      case "update-available":
        setState(banner, { type: "available", version: payload?.version });
        break;

      case "download-progress":
        setState(banner, { type: "downloading", percent: payload?.percent ?? 0 });
        break;

      case "update-downloaded":
        setState(banner, { type: "ready" });
        // UX confirmada: reinicia automaticamente ao concluir o download, sem ação do usuário.
        window.dmCopilot.updater.install();
        break;

      case "error":
        showToast(payload?.message || "Falha na atualização", "error");
        setState(banner, { type: "hidden" });
        break;

      case "checking-for-update":
      case "update-not-available":
      default:
        break;
    }
  });
}
