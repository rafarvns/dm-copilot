import template from './campaigns.html?raw';
import './campaigns.css';
import { CampaignsView } from '../../views/database-views.js';

export default class CampaignsFeature {
  constructor() {
    this.container = null;
    this.campaignsView = null;
  }

  async mount(container) {
    this.container = container;
    container.innerHTML = template;

    this.campaignsView = new CampaignsView();
    window.campaignsView = this.campaignsView;

    await this.campaignsView.mount();
  }

  destroy() {
    window.campaignsView = null;
    this.campaignsView = null;
  }
}
