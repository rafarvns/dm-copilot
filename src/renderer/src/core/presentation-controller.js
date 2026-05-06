export default class PresentationController {
  constructor() {
    this.current = null;
    this._pending = null;
    this._initModal();
  }

  _initModal() {
    const modal = document.getElementById('modal-presentation-conflict');
    const overlay = document.getElementById('presentation-conflict-overlay');
    const btnReplace = document.getElementById('btn-presentation-conflict-replace');
    const btnCancel = document.getElementById('btn-presentation-conflict-cancel');

    this._modal = modal;
    this._bodyEl = document.getElementById('presentation-conflict-body');

    btnReplace?.addEventListener('click', () => this._onConfirm());
    btnCancel?.addEventListener('click', () => this._onCancel());
    overlay?.addEventListener('click', () => this._onCancel());
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

  _showConflictModal() {
    if (this._bodyEl) {
      this._bodyEl.textContent = `Há uma apresentação em andamento: "${this.current.label}". Deseja substituí-la?`;
    }
    this._modal?.classList.remove('hidden');
  }

  async _onConfirm() {
    this._modal?.classList.add('hidden');
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
    this._modal?.classList.add('hidden');
    this._pending = null;
  }
}
