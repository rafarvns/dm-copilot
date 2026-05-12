// DM Copilot - Scenes View
// Tela do mestre para cadastrar e editar cenas de uma campanha.
// Espelha o padrão de EncountersView (database-views.js).

import { showToast } from "../core/toast.js";
import { icon } from "../core/icons.js";
import { showConfirm } from "../core/confirm-dialog.js";
import { showPrompt } from "../core/prompt-dialog.js";
import EasyMDE from "easymde";
import "easymde/dist/easymde.min.css";
import { marked } from "marked";

class ScenesView {
  constructor() {
    this.editingSceneId = null;
    this.currentCampaignId = null;
    this.currentScene = null;
    this.activeScene = null;
    this.presentingSceneId = null;
    this.notes = [];
    this.activeNoteId = null;
    this.noteEditor = null;
    this.isEditingNote = false;

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
      detailMusicPill: document.getElementById("view-scene-music-pill"),
      detailLinkedScenes: document.getElementById("view-scene-linked-scenes"),
      detailLinkedEncounters: document.getElementById("view-scene-linked-encounters"),
      btnCloseDetail: document.getElementById("btn-back-from-scene"),
      btnOpenPlayerLink: document.getElementById("btn-scene-open-player-link"),
      btnEditCurrent: document.getElementById("btn-edit-scene-current"),
      btnPresent: document.getElementById("btn-present-scene"),
      btnNewNote: document.getElementById("btn-new-scene-note"),
      notesTabsContainer: document.getElementById("scene-notes-tabs"),
      notesEmpty: document.getElementById("scene-notes-empty"),
      notesActive: document.getElementById("scene-notes-active"),
      noteTitleInput: document.getElementById("scene-note-title-input"),
      noteDisplay: document.getElementById("scene-note-display"),
      noteEditorTextarea: document.getElementById("scene-note-editor"),
      btnEditNote: document.getElementById("btn-edit-scene-note"),
      btnSaveNote: document.getElementById("btn-save-scene-note"),
      btnCancelNote: document.getElementById("btn-cancel-scene-note"),
      btnDeleteNote: document.getElementById("btn-delete-scene-note"),

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

    // Open player link in external browser
    this.DOM.btnOpenPlayerLink?.addEventListener("click", () => {
      const url = this.DOM.btnOpenPlayerLink.dataset.url;
      if (url && window.dmCopilot?.openExternal) {
        window.dmCopilot.openExternal(url);
      }
    });

    // Notes (multi-aba)
    this.DOM.btnNewNote?.addEventListener("click", () => this.createNote());
    this.DOM.btnEditNote?.addEventListener("click", () => this.enterNoteEditMode());
    this.DOM.btnSaveNote?.addEventListener("click", () => this.saveActiveNote());
    this.DOM.btnCancelNote?.addEventListener("click", () => this.cancelNoteEdit());
    this.DOM.btnDeleteNote?.addEventListener("click", () => this.deleteActiveNote());
    this.DOM.noteTitleInput?.addEventListener("change", () => this.saveActiveNoteTitle());
    this.DOM.notesTabsContainer?.addEventListener("click", (e) => {
      const tab = e.target.closest("[data-note-id]");
      if (!tab) return;
      const id = parseInt(tab.dataset.noteId, 10);
      if (Number.isInteger(id)) this.selectNote(id);
    });

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
      await this.loadNotes();
      this.attachDiceToolbar();
      this.DOM.detailView?.classList.remove("hidden");
    } catch (error) {
      console.error("Erro ao abrir cena:", error);
      showToast("Erro ao abrir cena", "error");
    }
  }

  closeSceneDetail() {
    this.detachDiceToolbar();
    this.DOM.detailView?.classList.add("hidden");
    this.activeScene = null;
    this.exitNoteEditModeUI();
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
      this._setPlayerLinkUrl(`http://${info.ip}:${info.port}`);
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

  _setPlayerLinkUrl(url) {
    if (!url) return;
    this._playerLinkUrl = url;
    if (this.DOM.btnOpenPlayerLink) {
      this.DOM.btnOpenPlayerLink.dataset.url = url;
    }
  }

  updatePresentButton() {
    if (!this.DOM.btnPresent || !this.activeScene) return;
    const isPresenting = this.presentingSceneId === this.activeScene.id;

    this.DOM.btnPresent.disabled = false;
    if (isPresenting) {
      this.DOM.btnPresent.innerHTML = icon("circle-stop");
      this.DOM.btnPresent.setAttribute("title", "Encerrar Apresentação");
      this.DOM.btnPresent.classList.remove("btn--success");
      this.DOM.btnPresent.classList.add("btn--danger");
    } else {
      this.DOM.btnPresent.innerHTML = icon("monitor-play");
      this.DOM.btnPresent.setAttribute("title", "Apresentar aos Jogadores");
      this.DOM.btnPresent.classList.remove("btn--danger");
      this.DOM.btnPresent.classList.add("btn--success");
    }

    if (this.DOM.btnOpenPlayerLink) {
      if (isPresenting && this.DOM.btnOpenPlayerLink.dataset.url) {
        this.DOM.btnOpenPlayerLink.removeAttribute("hidden");
      } else {
        this.DOM.btnOpenPlayerLink.setAttribute("hidden", "");
      }
    }
  }

  async loadNotes() {
    if (!this.activeScene) {
      this.notes = [];
      this.activeNoteId = null;
      this.renderNotesUI();
      return;
    }
    try {
      this.notes = (await window.dmCopilot.db.sceneNotes.list(this.activeScene.id)) || [];
    } catch (err) {
      console.error("Erro ao carregar anotações:", err);
      this.notes = [];
    }
    if (this.notes.length > 0 && !this.notes.find((n) => n.id === this.activeNoteId)) {
      this.activeNoteId = this.notes[0].id;
    } else if (this.notes.length === 0) {
      this.activeNoteId = null;
    }
    this.renderNotesUI();
  }

  renderNotesUI() {
    if (!this.DOM.notesTabsContainer) return;

    this.DOM.notesTabsContainer.innerHTML = this.notes
      .map(
        (n) => `
        <button class="scene-notes__tab ${n.id === this.activeNoteId ? "scene-notes__tab--active" : ""}"
                type="button" role="tab" data-note-id="${n.id}">
          <span class="scene-notes__tab-label">${this.escapeHtmlNote(n.title)}</span>
        </button>
      `
      )
      .join("");

    if (this.notes.length === 0) {
      this.DOM.notesEmpty?.classList.remove("hidden");
      this.DOM.notesActive?.classList.add("hidden");
      return;
    }
    this.DOM.notesEmpty?.classList.add("hidden");
    this.DOM.notesActive?.classList.remove("hidden");

    const active = this.notes.find((n) => n.id === this.activeNoteId);
    if (!active) return;

    if (this.DOM.noteTitleInput) this.DOM.noteTitleInput.value = active.title;
    this.renderActiveNoteContent(active.content);
    this.exitNoteEditModeUI();
  }

  renderActiveNoteContent(content) {
    if (!this.DOM.noteDisplay) return;
    this.DOM.noteDisplay.innerHTML = marked.parse(content || "");
  }

  async createNote() {
    if (!this.activeScene) return;
    try {
      const created = await window.dmCopilot.db.sceneNotes.create(this.activeScene.id, {});
      this.notes.push(created);
      this.activeNoteId = created.id;
      this.renderNotesUI();
      this.DOM.noteTitleInput?.focus();
      this.DOM.noteTitleInput?.select();
    } catch (err) {
      console.error("Erro ao criar anotação:", err);
      showToast("Erro ao criar anotação", "error");
    }
  }

  selectNote(id) {
    if (this.isEditingNote) {
      this.cancelNoteEdit();
    }
    this.activeNoteId = id;
    this.renderNotesUI();
  }

  enterNoteEditMode() {
    const active = this.notes.find((n) => n.id === this.activeNoteId);
    if (!active) return;
    this.isEditingNote = true;
    this.DOM.noteDisplay?.classList.add("hidden");
    this.DOM.noteEditorTextarea?.classList.remove("hidden");
    this.DOM.btnEditNote?.classList.add("hidden");
    this.DOM.btnSaveNote?.classList.remove("hidden");
    this.DOM.btnCancelNote?.classList.remove("hidden");

    if (this.DOM.noteEditorTextarea) this.DOM.noteEditorTextarea.value = active.content || "";

    this.noteEditor = new EasyMDE({
      element: this.DOM.noteEditorTextarea,
      spellChecker: false,
      autofocus: true,
      status: false,
      autoDownloadFontAwesome: false,
      minHeight: "200px",
      initialValue: active.content || "",
      toolbar: [
        "bold",
        "italic",
        "strikethrough",
        "heading",
        "|",
        "unordered-list",
        "ordered-list",
        "quote",
        "|",
        "code",
        "link",
        "horizontal-rule",
        "|",
        {
          name: "image-url",
          action: async (editor) => {
            const values = await showPrompt({
              title: "Inserir Imagem",
              fields: [
                { name: "url", label: "URL da imagem", placeholder: "https://...", required: true },
                {
                  name: "alt",
                  label: "Texto alternativo",
                  placeholder: "Descreva a imagem (opcional)",
                },
              ],
              confirmLabel: "Inserir",
              confirmIcon: "image",
            });
            if (!values) return;
            const cm = editor.codemirror;
            cm.replaceSelection(`![${values.alt || ""}](${values.url})`);
            cm.focus();
          },
          className: "image-url",
          title: "Inserir Imagem por URL",
        },
      ],
    });
  }

  exitNoteEditModeUI() {
    this.isEditingNote = false;
    this.DOM.noteDisplay?.classList.remove("hidden");
    this.DOM.noteEditorTextarea?.classList.add("hidden");
    this.DOM.btnEditNote?.classList.remove("hidden");
    this.DOM.btnSaveNote?.classList.add("hidden");
    this.DOM.btnCancelNote?.classList.add("hidden");
    if (this.noteEditor) {
      try {
        this.noteEditor.toTextArea();
      } catch (_e) {
        // ignora erros de desmontagem do editor
      }
      this.noteEditor = null;
    }
  }

  cancelNoteEdit() {
    this.exitNoteEditModeUI();
  }

  async saveActiveNote() {
    const active = this.notes.find((n) => n.id === this.activeNoteId);
    if (!active || !this.noteEditor) return;
    const content = this.noteEditor.value();
    try {
      await window.dmCopilot.db.sceneNotes.update(active.id, { content });
      active.content = content;
      this.exitNoteEditModeUI();
      this.renderActiveNoteContent(content);
      showToast("Anotação salva.");
    } catch (err) {
      console.error("Erro ao salvar anotação:", err);
      showToast("Erro ao salvar anotação", "error");
    }
  }

  async saveActiveNoteTitle() {
    const active = this.notes.find((n) => n.id === this.activeNoteId);
    if (!active || !this.DOM.noteTitleInput) return;
    const title = (this.DOM.noteTitleInput.value || "").trim() || active.title;
    if (title === active.title) return;
    try {
      await window.dmCopilot.db.sceneNotes.update(active.id, { title });
      active.title = title;
      this.renderNotesUI();
    } catch (err) {
      console.error("Erro ao renomear anotação:", err);
      showToast("Erro ao renomear anotação", "error");
    }
  }

  async deleteActiveNote() {
    const active = this.notes.find((n) => n.id === this.activeNoteId);
    if (!active) return;
    const confirmed = await showConfirm({
      title: "Excluir anotação?",
      message: `Excluir "${active.title}" permanentemente?`,
      confirmText: "Excluir",
      cancelText: "Cancelar",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await window.dmCopilot.db.sceneNotes.delete(active.id);
      this.notes = this.notes.filter((n) => n.id !== active.id);
      this.activeNoteId = this.notes[0]?.id ?? null;
      this.exitNoteEditModeUI();
      this.renderNotesUI();
      showToast("Anotação excluída.");
    } catch (err) {
      console.error("Erro ao excluir anotação:", err);
      showToast("Erro ao excluir anotação", "error");
    }
  }

  escapeHtmlNote(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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
