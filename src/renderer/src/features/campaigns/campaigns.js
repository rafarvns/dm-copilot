import template from "./campaigns.html?raw";
import "./campaigns.css";
import { CampaignsView } from "../../views/database-views.js";

export default class CampaignsFeature {
  constructor() {
    this.container = null;
    this.campaignsView = null;
  }

  async mount(container) {
    this.container = container;
    container.innerHTML = template;

    // Singleton: reuse the same CampaignsView across navigations to avoid
    // duplicating event listeners attached to global modals (which would
    // cause N inserts/updates on each save).
    if (!CampaignsFeature._sharedView) {
      CampaignsFeature._sharedView = new CampaignsView();
    }
    this.campaignsView = CampaignsFeature._sharedView;
    window.campaignsView = this.campaignsView;

    await this.campaignsView.mount();
  }

  destroy() {
    // Keep the shared view alive between navigations; only drop the global
    // pointer so other modules know the route is no longer active.
    window.campaignsView = null;
    this.campaignsView = null;
  }
}
