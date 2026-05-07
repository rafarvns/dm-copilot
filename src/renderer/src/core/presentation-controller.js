export default class PresentationController {
  constructor() {
    this.current = null;
    this._pending = null;
    this._initModal();
  }

  _initModal() {
    const modal = document.getElementById("modal-presentation-conflict");
    const overlay = document.getElementById("presentation-conflict-overlay");
    const btnReplace = document.getElementById("btn-presentation-conflict-replace");
    const btnCancel = document.getElementById("btn-presentation-conflict-cancel");

    this._modal = modal;
    this._bodyEl = document.getElementById("presentation-conflict-body");

    btnReplace?.addEventListener("click", () => this._onConfirm());
    btnCancel?.addEventListener("click", () => this._onCancel());
    overlay?.addEventListener("click", () => this._onCancel());
  }

  async requestPresentation({ type, label, start, stop }) {
    if (!this.current) {
      this.current = { type, label, stop };
      await start();
      return;
    }
    this._pending = { type, label, start, stop };
    this._showConflictModal();
  }

  clearPresentation() {
    this.current = null;
  }

  /**
   * Registra a presentation atual SEM disparar `start()`. Usado quando o
   * estado já está ativo no app (ex: mestre reabre um encontro com combate
   * em andamento — a presentation existe conceitualmente, só precisamos
   * que o controller saiba dela para futuros conflitos).
   */
  adoptPresentation({ type, label, stop }) {
    if (this.current && this.current.type === type && this.current.label === label) {
      // Já adotada — só atualiza a callback de stop.
      this.current.stop = stop;
      return;
    }
    if (this.current?.stop) {
      // Outra presentation ativa — encerra silenciosamente, sem modal.
      try {
        this.current.stop();
      } catch (err) {
        console.warn("adoptPresentation: falha ao parar a presentation anterior:", err);
      }
    }
    this.current = { type, label, stop };
    this._pending = null;
  }

  _showConflictModal() {
    if (this._bodyEl) {
      this._bodyEl.textContent = `Há uma apresentação em andamento: "${this.current.label}". Deseja substituí-la?`;
    }
    this._modal?.classList.remove("hidden");
  }

  async _onConfirm() {
    this._modal?.classList.add("hidden");
    if (!this._pending) return;

    const pending = this._pending;
    this._pending = null;

    // Stop old presentation silently (no user prompt)
    await this.current.stop();

    // Register new as current then start it
    this.current = { type: pending.type, label: pending.label, stop: pending.stop };
    await pending.start();
  }

  _onCancel() {
    this._modal?.classList.add("hidden");
    this._pending = null;
  }
}
