// DM Copilot - Scenes View
// Tela do mestre para cadastrar e editar cenas de uma campanha.
// Espelha o padrão de EncountersView (database-views.js).

import { showToast } from "../core/toast.js";
import { icon } from "../core/icons.js";
import { showConfirm } from "../core/confirm-dialog.js";

class ScenesView {
  constructor() {
    this.editingSceneId = null;
    this.currentCampaignId = null;
    this.currentScene = null;
    this.activeScene = null;
    this.presentingSceneId = null;

    this.initDOM();
    this.initEvents();
  }

  initDOM() {
    this.DOM = {
      modal: document.getElementById("scene-modal"),
      modalOverlay: document.getElementById("scene-modal-overlay"),
      modalTitle: document.getElementById("scene-modal-title"),
      form: document.getElementById("scene-form"),
      idInput: document.getElementById("scene-id"),
      nameInput: document.getElementById("scene-name"),
      descInput: document.getElementById("scene-description"),
      btnCancel: document.getElementById("btn-cancel-scene-form"),
      btnClose: document.getElementById("btn-close-scene-modal"),
      btnSave: document.getElementById("btn-save-scene-form"),

      // Background image
      bgInput: document.getElementById("scene-background-image"),
      bgFile: document.getElementById("scene-bg-file"),
      btnBgUpload: document.getElementById("btn-scene-bg-upload"),
      btnBgClear: document.getElementById("btn-scene-bg-clear"),
      bgUploadName: document.getElementById("scene-bg-upload-name"),
      bgPreview: document.getElementById("scene-bg-preview"),
      bgPreviewWrapper: document.getElementById("scene-bg-preview-wrapper"),

      // Music
      musicUrlInput: document.getElementById("scene-music-url"),
      musicFileInput: document.getElementById("scene-music-file"),
      musicStatus: document.getElementById("scene-music-status"),
      btnMusicRemove: document.getElementById("btn-scene-music-remove"),

      // Multi-selects
      relatedScenes: document.getElementById("scene-related-scenes"),
      relatedEncounters: document.getElementById("scene-related-encounters"),

      // Errors
      errorName: document.getElementById("error-scene-name"),
      errorDescription: document.getElementById("error-scene-description"),

      // Detail view (read mode)
      detailView: document.getElementById("scene-detail-view"),
      detailHero: document.getElementById("view-scene-header"),
      detailName: document.getElementById("view-scene-name"),
      detailDescription: document.getElementById("view-scene-description"),
      detailNotesDisplay: document.getElementById("view-scene-notes-display"),
      detailNotesEdit: document.getElementById("view-scene-notes-edit"),
      detailMusicPill: document.getElementById("view-scene-music-pill"),
      detailLinkedScenes: document.getElementById("view-scene-linked-scenes"),
      detailLinkedEncounters: document.getElementById("view-scene-linked-encounters"),
      btnCloseDetail: document.getElementById("btn-back-from-scene"),
      btnEditCurrent: document.getElementById("btn-edit-scene-current"),
      btnPresent: document.getElementById("btn-present-scene"),
      btnEditNotes: document.getElementById("btn-edit-scene-notes"),
      btnSaveNotes: document.getElementById("btn-save-scene-notes"),
      btnCancelNotes: document.getElementById("btn-cancel-scene-notes"),

      // Dice toolbar host (same DOM node moved between scene and encounter views)
      diceToolbar: document.getElementById("dice-toolbar"),
      sceneDiceRow: document.getElementById("scene-dice-row"),
      encounterActions: document.querySelector("#encounter-detail-view .overlay-view__actions"),
    };
  }

  initEvents() {
    this.DOM.form?.addEventListener("submit", (e) => this.handleSubmit(e));
    this.DOM.btnCancel?.addEventListener("click", () => this.closeForm());
    this.DOM.btnClose?.addEventListener("click", () => this.closeForm());
    this.DOM.modalOverlay?.addEventListener("click", () => this.closeForm());

    this.DOM.btnBgUpload?.addEventListener("click", () => this.DOM.bgFile?.click());
    this.DOM.bgFile?.addEventListener("change", (e) => this.handleBgFileSelect(e));
    this.DOM.btnBgClear?.addEventListener("click", () => this.clearBackground());

    this.DOM.btnMusicRemove?.addEventListener("click", () => {
      if (this.DOM.musicUrlInput) this.DOM.musicUrlInput.value = "";
      if (this.DOM.musicFileInput) this.DOM.musicFileInput.value = "";
      this.updateMusicStatusUI();
    });

    this.DOM.nameInput?.addEventListener("input", () => this.clearError("name"));
    this.DOM.descInput?.addEventListener("input", () => this.clearError("description"));

    // Detail view events
    this.DOM.btnCloseDetail?.addEventListener("click", () => this.closeSceneDetail());
    this.DOM.btnEditCurrent?.addEventListener("click", () => {
      if (this.activeScene) this.openForm(this.activeScene);
    });
    this.DOM.btnPresent?.addEventListener("click", () => this.togglePresentation());

    // Notes inline editor
    this.DOM.btnEditNotes?.addEventListener("click", () => this.enterNotesEditMode());
    this.DOM.btnCancelNotes?.addEventListener("click", () => this.cancelNotesEdit());
    this.DOM.btnSaveNotes?.addEventListener("click", () => this.saveNotes());

    // Click on a related-scene chip → navigate to that scene's detail view
    this.DOM.detailLinkedScenes?.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-scene-id]");
      if (!chip) return;
      const id = parseInt(chip.dataset.sceneId, 10);
      if (Number.isInteger(id)) this.openSceneDetail(id);
    });

    // Click on a related-encounter chip → open encounter manager
    this.DOM.detailLinkedEncounters?.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-encounter-id]");
      if (!chip) return;
      const id = parseInt(chip.dataset.encounterId, 10);
      if (Number.isInteger(id) && window.encountersView?.openEncounterManager) {
        this.closeSceneDetail();
        window.encountersView.openEncounterManager(id);
      }
    });
  }

  // ============================================
  // Form open / close
  // ============================================
  async openForm(scene = null, campaignId = null) {
    this.editingSceneId = scene ? scene.id : null;
    this.currentScene = scene;
    this.currentCampaignId = campaignId || (scene ? scene.campaign_id : null);

    if (this.DOM.modalTitle) {
      this.DOM.modalTitle.textContent = scene ? "Editar Cena" : "Nova Cena";
    }

    if (this.DOM.idInput) this.DOM.idInput.value = scene ? scene.id : "";
    if (this.DOM.nameInput) this.DOM.nameInput.value = scene ? scene.name : "";
    if (this.DOM.descInput) this.DOM.descInput.value = scene ? scene.description || "" : "";

    // Background
    this.setSelectedBackground(scene ? scene.background_image || "" : "");
    if (this.DOM.bgUploadName) this.DOM.bgUploadName.textContent = "";
    if (this.DOM.bgFile) this.DOM.bgFile.value = "";

    // Music
    if (this.DOM.musicUrlInput) this.DOM.musicUrlInput.value = scene?.music_url || "";
    if (this.DOM.musicFileInput) this.DOM.musicFileInput.value = scene?.music_file || "";
    this.updateMusicStatusUI();

    // Populate multi-selects with available options for the campaign
    await this.loadRelationOptions(scene);

    this.clearError("name");
    this.clearError("description");

    this.DOM.modal?.classList.remove("hidden");
    this.DOM.nameInput?.focus();
  }

  closeForm() {
    this.DOM.modal?.classList.add("hidden");
    this.editingSceneId = null;
    this.currentScene = null;
  }

  // ============================================
  // Multi-selects (relations)
  // ============================================
  async loadRelationOptions(scene) {
    if (!this.currentCampaignId) return;

    const [allScenes, allEncounters] = await Promise.all([
      window.dmCopilot.db.scenes.getAll(this.currentCampaignId),
      window.dmCopilot.db.encounters.getAll(this.currentCampaignId),
    ]);

    const linkedSceneIds = new Set((scene?.linked_scenes || []).map((s) => s.id));
    const linkedEncounterIds = new Set((scene?.linked_encounters || []).map((e) => e.id));

    if (this.DOM.relatedScenes) {
      const others = (allScenes || []).filter((s) => s.id !== this.editingSceneId);
      this.DOM.relatedScenes.innerHTML = others
        .map((s) => {
          const sel = linkedSceneIds.has(s.id) ? "selected" : "";
          return `<option value="${s.id}" ${sel}>${this.escapeHTML(s.name)}</option>`;
        })
        .join("");
      if (others.length === 0) {
        this.DOM.relatedScenes.innerHTML = `<option disabled>Nenhuma outra cena nesta campanha.</option>`;
      }
    }

    if (this.DOM.relatedEncounters) {
      const list = allEncounters || [];
      this.DOM.relatedEncounters.innerHTML = list
        .map((e) => {
          const sel = linkedEncounterIds.has(e.id) ? "selected" : "";
          return `<option value="${e.id}" ${sel}>${this.escapeHTML(e.name)}</option>`;
        })
        .join("");
      if (list.length === 0) {
        this.DOM.relatedEncounters.innerHTML = `<option disabled>Nenhum encontro nesta campanha.</option>`;
      }
    }
  }

  getSelectedIds(selectEl) {
    if (!selectEl) return [];
    return Array.from(selectEl.selectedOptions)
      .map((o) => parseInt(o.value, 10))
      .filter((n) => Number.isInteger(n));
  }

  // ============================================
  // Background image
  // ============================================
  async handleBgFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (this.DOM.bgUploadName) this.DOM.bgUploadName.textContent = file.name;
    try {
      const buffer = await this.processBackgroundImage(file);
      const relativePath = await window.dmCopilot.db.scenes.saveImage(buffer);
      this.setSelectedBackground(`local-image://${relativePath}`);
    } catch (error) {
      console.error("Erro ao processar imagem da cena:", error);
      showToast("Erro ao salvar imagem", "error");
    }
  }

  processBackgroundImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 1920;
        if (width > MAX_SIZE || height > MAX_SIZE) {
          if (width > height) {
            height = (height / width) * MAX_SIZE;
            width = MAX_SIZE;
          } else {
            width = (width / height) * MAX_SIZE;
            height = MAX_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Falha ao exportar imagem"));
            blob.arrayBuffer().then(resolve);
          },
          "image/webp",
          0.85
        );
      };
      img.onerror = () => reject(new Error("Erro ao carregar imagem"));
      img.src = URL.createObjectURL(file);
    });
  }

  setSelectedBackground(value) {
    if (this.DOM.bgInput) this.DOM.bgInput.value = value || "";
    const url = value ? this.resolveBackgroundUrl(value) : "";
    if (this.DOM.bgPreviewWrapper) {
      this.DOM.bgPreviewWrapper.classList.toggle("hidden", !url);
    }
    if (this.DOM.bgPreview) {
      this.DOM.bgPreview.style.backgroundImage = url ? `url('${url}')` : "";
    }
    if (this.DOM.btnBgClear) {
      this.DOM.btnBgClear.hidden = !value;
    }
  }

  clearBackground() {
    this.setSelectedBackground("");
    if (this.DOM.bgUploadName) this.DOM.bgUploadName.textContent = "";
    if (this.DOM.bgFile) this.DOM.bgFile.value = "";
  }

  resolveBackgroundUrl(value) {
    if (!value) return "";
    return value;
  }

  // ============================================
  // Music status
  // ============================================
  updateMusicStatusUI() {
    const hasFile = !!(this.DOM.musicFileInput && this.DOM.musicFileInput.value);
    if (this.DOM.btnMusicRemove) this.DOM.btnMusicRemove.hidden = !hasFile;
    if (this.DOM.musicStatus) {
      if (hasFile) {
        this.DOM.musicStatus.innerHTML = `${icon("check-circle-2")} Música baixada e pronta para tocar.`;
        this.DOM.musicStatus.className = "form-help form-help--ok";
      } else {
        this.DOM.musicStatus.textContent = "";
        this.DOM.musicStatus.className = "form-help";
      }
    }
  }

  setMusicStatus(text, kind = "") {
    if (!this.DOM.musicStatus) return;
    this.DOM.musicStatus.textContent = text || "";
    this.DOM.musicStatus.className = "form-help" + (kind ? ` form-help--${kind}` : "");
  }

  // ============================================
  // Submit
  // ============================================
  async handleSubmit(e) {
    e.preventDefault();

    const name = (this.DOM.nameInput?.value || "").trim();
    const description = (this.DOM.descInput?.value || "").trim();

    if (!name) {
      this.showError("name", "Nome é obrigatório.");
      return;
    }
    if (!description) {
      this.showError("description", "Descrição é obrigatória.");
      return;
    }

    const newMusicUrl = (this.DOM.musicUrlInput?.value || "").trim();
    const existingMusicFile = this.DOM.musicFileInput?.value || "";
    const previousMusicUrl = this.editingSceneId ? this.currentScene?.music_url || "" : "";
    const musicChanged = newMusicUrl !== previousMusicUrl;

    if (newMusicUrl && musicChanged) {
      try {
        const valid = await window.dmCopilot.db.scenes.validateYouTubeUrl(newMusicUrl);
        if (!valid) {
          this.setMusicStatus("URL do YouTube inválida.", "error");
          return;
        }
      } catch (_err) {
        this.setMusicStatus("Erro ao validar URL.", "error");
        return;
      }
    }

    const sceneData = {
      campaign_id: this.currentCampaignId,
      name,
      description,
      background_image: this.DOM.bgInput?.value || null,
      music_url: newMusicUrl || null,
      music_file: existingMusicFile || null,
    };

    if (musicChanged && existingMusicFile) {
      try {
        await window.dmCopilot.db.scenes.deleteMusic(existingMusicFile);
      } catch (err) {
        console.warn("Falha ao remover música antiga da cena:", err);
      }
      sceneData.music_file = null;
    }

    const submitBtn = this.DOM.btnSave;
    if (submitBtn) submitBtn.disabled = true;

    try {
      let sceneId = this.editingSceneId;
      if (sceneId) {
        await window.dmCopilot.db.scenes.update(sceneId, sceneData);
      } else {
        const created = await window.dmCopilot.db.scenes.create(sceneData);
        sceneId = created?.id;
      }

      if (newMusicUrl && musicChanged && sceneId) {
        this.setMusicStatus(
          `${icon("hourglass")} Baixando música... (pode levar alguns segundos)`,
          ""
        );
        const result = await window.dmCopilot.db.scenes.downloadMusic(newMusicUrl, sceneId);
        if (result?.success) {
          await window.dmCopilot.db.scenes.update(sceneId, { music_file: result.fileName });
          if (this.DOM.musicFileInput) this.DOM.musicFileInput.value = result.fileName;
          this.updateMusicStatusUI();
        } else {
          this.setMusicStatus(
            `${icon("circle-x")} ${result?.error || "Falha ao baixar música."}`,
            "error"
          );
          showToast("Cena salva, mas a música não pôde ser baixada", "error");
          if (submitBtn) submitBtn.disabled = false;
          return;
        }
      }

      // Persist relationships (after the scene exists)
      const sceneIdsToLink = this.getSelectedIds(this.DOM.relatedScenes);
      const encounterIdsToLink = this.getSelectedIds(this.DOM.relatedEncounters);
      await window.dmCopilot.db.scenes.setLinks(sceneId, sceneIdsToLink);
      await window.dmCopilot.db.scenes.setEncounters(sceneId, encounterIdsToLink);

      showToast(this.editingSceneId ? "Cena atualizada!" : "Cena criada!");
      this.closeForm();

      if (window.campaignsView && window.campaignsView.selectedCampaign) {
        window.campaignsView.loadCampaignScenes(this.currentCampaignId);
      }

      // If the edited scene is currently open in the detail view, refresh it
      if (this.activeScene && this.activeScene.id === sceneId) {
        const refreshed = await window.dmCopilot.db.scenes.getById(sceneId);
        if (refreshed) {
          this.activeScene = refreshed;
          this.renderSceneDetail(refreshed);
        }
      }
    } catch (error) {
      console.error("Save scene failed:", error);
      showToast("Erro ao salvar cena", "error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  // ============================================
  // Detail view (full-screen reader)
  // ============================================
  async openSceneDetail(id) {
    try {
      const scene = await window.dmCopilot.db.scenes.getById(id);
      if (!scene) {
        showToast("Cena não encontrada.", "error");
        return;
      }
      this.activeScene = scene;
      this.renderSceneDetail(scene);
      this.attachDiceToolbar();
      this.DOM.detailView?.classList.remove("hidden");
      // reset notes editor to display mode whenever we (re)open
      this.exitNotesEditMode();
    } catch (error) {
      console.error("Erro ao abrir cena:", error);
      showToast("Erro ao abrir cena", "error");
    }
  }

  closeSceneDetail() {
    this.detachDiceToolbar();
    this.DOM.detailView?.classList.add("hidden");
    this.activeScene = null;
    this.exitNotesEditMode();
  }

  // Move the shared #dice-toolbar DOM node into/out of the scene hero.
  // Event listeners survive appendChild, so DiceView keeps working.
  attachDiceToolbar() {
    if (this.DOM.diceToolbar && this.DOM.sceneDiceRow) {
      this.DOM.sceneDiceRow.appendChild(this.DOM.diceToolbar);
    }
  }

  detachDiceToolbar() {
    if (this.DOM.diceToolbar && this.DOM.encounterActions) {
      this.DOM.encounterActions.appendChild(this.DOM.diceToolbar);
    }
  }

  renderSceneDetail(scene) {
    if (this.DOM.detailName) this.DOM.detailName.textContent = scene.name || "Cena";

    if (this.DOM.detailDescription) {
      this.DOM.detailDescription.textContent = scene.description || "Sem descrição.";
    }

    // Hero background
    if (this.DOM.detailHero) {
      const url = scene.background_image ? this.resolveBackgroundUrl(scene.background_image) : "";
      if (url) {
        this.DOM.detailHero.style.setProperty("--scene-bg-url", `url('${url}')`);
        this.DOM.detailHero.classList.add("scene-viewer__header--with-bg");
      } else {
        this.DOM.detailHero.style.removeProperty("--scene-bg-url");
        this.DOM.detailHero.classList.remove("scene-viewer__header--with-bg");
      }
    }

    // Music pill
    if (this.DOM.detailMusicPill) {
      const hasMusic = !!scene.music_file;
      this.DOM.detailMusicPill.classList.toggle("hidden", !hasMusic);
    }

    // Notes display
    this.renderNotesDisplay(scene.notes || "");

    // Linked scenes (chips)
    if (this.DOM.detailLinkedScenes) {
      const links = scene.linked_scenes || [];
      if (links.length === 0) {
        this.DOM.detailLinkedScenes.innerHTML = `<span class="scene-viewer__empty">Nenhuma ligação.</span>`;
      } else {
        this.DOM.detailLinkedScenes.innerHTML = links
          .map(
            (s) => `
          <button class="scene-viewer__chip" data-scene-id="${s.id}" type="button">
            <span class="scene-viewer__chip-name">${this.escapeHTML(s.name)}</span>
            <span class="scene-viewer__chip-meta">→</span>
          </button>
        `
          )
          .join("");
      }
    }

    // Linked encounters (chips)
    if (this.DOM.detailLinkedEncounters) {
      const encs = scene.linked_encounters || [];
      if (encs.length === 0) {
        this.DOM.detailLinkedEncounters.innerHTML = `<span class="scene-viewer__empty">Nenhum encontro vinculado.</span>`;
      } else {
        this.DOM.detailLinkedEncounters.innerHTML = encs
          .map(
            (e) => `
          <button class="scene-viewer__chip" data-encounter-id="${e.id}" type="button">
            <span class="scene-viewer__chip-name">${this.escapeHTML(e.name)}</span>
            <span class="scene-viewer__chip-meta">${this.escapeHTML(e.difficulty || "")}</span>
          </button>
        `
          )
          .join("");
      }
    }

    // Reflect presentation state on the toggle button
    this.updatePresentButton();
  }

  // ============================================
  // Presentation (broadcast scene to player view)
  // ============================================
  async togglePresentation() {
    if (!this.activeScene) return;

    // Already presenting THIS scene → voluntary dismiss
    if (this.presentingSceneId === this.activeScene.id) {
      try {
        window.dmCopilot.combat.broadcast("scene-update", { status: "inactive" });
        this.presentingSceneId = null;
        window.presentationController?.clearPresentation();
        this.updatePresentButton();
        showToast("Apresentação encerrada.");
      } catch (err) {
        console.error("Erro ao encerrar apresentação:", err);
        showToast("Erro ao encerrar apresentação", "error");
      }
      return;
    }

    // Delegate to controller (handles conflict detection)
    const sceneSnapshot = this.activeScene;
    await window.presentationController.requestPresentation({
      type: "scene",
      label: sceneSnapshot.name || "Cena",
      start: () => this._activateScene(sceneSnapshot),
      stop: () => this._stopSceneInternal(),
    });
  }

  async _activateScene(scene) {
    const payload = {
      status: "active",
      name: scene.name,
      description: scene.description || "",
      backgroundImage: this.resolveImageForPlayer(scene.background_image),
      musicFile: scene.music_file ? `/music/${scene.music_file}` : null,
    };

    try {
      const info = await window.dmCopilot.combat.startServer();
      window.dmCopilot.combat.broadcast("scene-update", payload);
      this.presentingSceneId = scene.id;
      this.updatePresentButton();
      showToast(`Cena no ar: http://${info.ip}:${info.port}`);
    } catch (err) {
      console.error("Falha ao apresentar cena:", err);
      showToast("Erro ao apresentar cena", "error");
      window.presentationController?.clearPresentation();
    }
  }

  _stopSceneInternal() {
    try {
      window.dmCopilot.combat.broadcast("scene-update", { status: "inactive" });
    } catch (err) {
      console.warn("Falha ao encerrar cena via controller:", err);
    }
    this.presentingSceneId = null;
    this.updatePresentButton();
  }

  // Background images stored as "local-image://scenes/<file>.webp" need to be
  // rewritten to the HTTP path the player browser can fetch (/images/scenes/...).
  resolveImageForPlayer(bg) {
    if (!bg) return null;
    if (bg.startsWith("local-image://")) {
      return `/images/${bg.slice("local-image://".length)}`;
    }
    return bg;
  }

  updatePresentButton() {
    if (!this.DOM.btnPresent || !this.activeScene) return;
    const isPresenting = this.presentingSceneId === this.activeScene.id;

    this.DOM.btnPresent.disabled = false;
    this.DOM.btnPresent.title = "";
    this.DOM.btnPresent.innerHTML = isPresenting
      ? `${icon("circle-stop")} Encerrar Apresentação`
      : `${icon("monitor-play")} Apresentar aos Jogadores`;
  }

  renderNotesDisplay(notes) {
    if (!this.DOM.detailNotesDisplay) return;
    if (notes && notes.trim()) {
      this.DOM.detailNotesDisplay.textContent = notes;
      this.DOM.detailNotesDisplay.classList.remove("scene-viewer__notes-display--empty");
    } else {
      this.DOM.detailNotesDisplay.innerHTML = `<p class="scene-viewer__notes-empty">Nenhuma anotação ainda. Clique em <strong>Editar</strong> para escrever lembretes, ganchos da cena, segredos do mestre etc.</p>`;
    }
  }

  enterNotesEditMode() {
    if (!this.activeScene) return;
    if (this.DOM.detailNotesEdit) {
      this.DOM.detailNotesEdit.value = this.activeScene.notes || "";
      this.DOM.detailNotesEdit.classList.remove("hidden");
      this.DOM.detailNotesEdit.focus();
    }
    this.DOM.detailNotesDisplay?.classList.add("hidden");
    this.DOM.btnEditNotes?.classList.add("hidden");
    this.DOM.btnSaveNotes?.classList.remove("hidden");
    this.DOM.btnCancelNotes?.classList.remove("hidden");
  }

  exitNotesEditMode() {
    this.DOM.detailNotesEdit?.classList.add("hidden");
    this.DOM.detailNotesDisplay?.classList.remove("hidden");
    this.DOM.btnEditNotes?.classList.remove("hidden");
    this.DOM.btnSaveNotes?.classList.add("hidden");
    this.DOM.btnCancelNotes?.classList.add("hidden");
  }

  cancelNotesEdit() {
    this.exitNotesEditMode();
  }

  async saveNotes() {
    if (!this.activeScene) return;
    const notes = this.DOM.detailNotesEdit?.value || "";
    try {
      await window.dmCopilot.db.scenes.update(this.activeScene.id, { notes });
      this.activeScene.notes = notes;
      this.renderNotesDisplay(notes);
      this.exitNotesEditMode();
      showToast("Anotações salvas.");
    } catch (error) {
      console.error("Erro ao salvar anotações:", error);
      showToast("Erro ao salvar anotações", "error");
    }
  }

  // ============================================
  // Edit / Delete entry points (called from CampaignsView)
  // ============================================
  async loadSceneForEdit(id) {
    try {
      const scene = await window.dmCopilot.db.scenes.getById(id);
      if (scene) await this.openForm(scene);
    } catch (error) {
      console.error("Erro ao carregar cena:", error);
      showToast("Erro ao carregar cena", "error");
    }
  }

  async confirmDelete(id) {
    const ok = await showConfirm({
      title: "Excluir Cena",
      message: "Tem certeza que deseja excluir esta cena? Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      cancelLabel: "Cancelar",
      confirmVariant: "danger",
      confirmIcon: "trash-2",
    });
    if (!ok) return;
    try {
      await window.dmCopilot.db.scenes.delete(id);
      showToast("Cena excluída");
      // If the deleted scene was open in the detail view, dismiss it.
      if (this.activeScene && this.activeScene.id === id) {
        this.closeSceneDetail();
      }
      if (window.campaignsView && window.campaignsView.selectedCampaign) {
        window.campaignsView.loadCampaignScenes(window.campaignsView.selectedCampaign.id);
      }
    } catch (error) {
      console.error("Erro ao excluir cena:", error);
      showToast("Erro ao excluir cena", "error");
    }
  }

  // ============================================
  // Helpers
  // ============================================
  showError(field, message) {
    const el = field === "name" ? this.DOM.errorName : this.DOM.errorDescription;
    if (el) el.textContent = message;
  }

  clearError(field) {
    const el = field === "name" ? this.DOM.errorName : this.DOM.errorDescription;
    if (el) el.textContent = "";
  }

  escapeHTML(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ============================================
  // Player view broadcast (infra para tela do jogador)
  // ============================================
  displayScene(scene) {
    this.activeScene = scene;
    let bgImage = null;
    if (scene.background_image) {
      if (scene.background_image.startsWith("local-image://")) {
        bgImage = `/images/scenes/${scene.background_image.replace("local-image://", "")}`;
      } else {
        bgImage = scene.background_image;
      }
    }
    const musicFile = scene.music_file ? `/music/${scene.music_file}` : null;

    window.dmCopilot.combat.broadcast("scene-update", {
      status: "active",
      sceneId: scene.id,
      name: scene.name,
      description: scene.description || "",
      backgroundImage: bgImage,
      musicFile,
    });
  }

  hideScene() {
    this.activeScene = null;
    window.dmCopilot.combat.broadcast("scene-update", { status: "inactive" });
  }
}

export default ScenesView;
export { ScenesView };
