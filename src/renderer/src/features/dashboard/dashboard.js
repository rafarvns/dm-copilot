import template from './dashboard.html?raw';
import './dashboard.css';
import { navigateTo } from '../../core/router.js';

const ACTION_MAP = {
  'new-campaign': 'campaigns',
  'new-character': 'characters',
  'open-campaigns': 'campaigns',
  'open-characters': 'characters',
  'open-encounters': 'campaigns',
  'open-dice': 'dice',
  'open-notes': 'notes',
  'open-settings': 'settings',
};

export default class DashboardFeature {
  constructor() {
    this.container = null;
  }

  async mount(container) {
    this.container = container;
    container.innerHTML = template;
    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelectorAll('[data-action]').forEach((el) => {
      el.addEventListener('click', () => {
        const view = ACTION_MAP[el.dataset.action];
        if (!view) return;
        navigateTo(view);
        if (el.dataset.action === 'new-campaign') {
          setTimeout(() => window.campaignsView?.openForm(), 100);
        } else if (el.dataset.action === 'new-character') {
          setTimeout(() => window.charactersView?.openForm(), 100);
        }
      });
    });
  }

  destroy() {}
}
