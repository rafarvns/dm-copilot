// DM Copilot - Renderer Process
// Bootstraps the modular shell (sidebar + status-bar + router outlet).

import "./assets/main.css";

import databaseService from "./db/database.js";
import { registerRoute, navigateTo } from "./core/router.js";

import SidebarComponent from "./shared/sidebar/sidebar.js";
import StatusBarComponent from "./shared/status-bar/status-bar.js";

import DashboardFeature from "./features/dashboard/dashboard.js";
import CampaignsFeature from "./features/campaigns/campaigns.js";
import CharactersFeature from "./features/characters/characters.js";

import { EncountersView } from "./views/database-views.js";
import charactersView from "./views/characters-view.js";
import DiceView from "./views/dice-view.js";

const sidebar = new SidebarComponent();
const statusBar = new StatusBarComponent();

function mountShell() {
  const sidebarEl = document.getElementById("app-sidebar");
  if (sidebarEl) sidebar.mount(sidebarEl);

  const statusBarEl = document.getElementById("app-statusbar");
  if (statusBarEl) statusBar.mount(statusBarEl);
}

function registerRoutes() {
  registerRoute("dashboard", DashboardFeature);
  registerRoute("campaigns", CampaignsFeature);
  registerRoute("characters", CharactersFeature);
}

function setupSidebarNavigation() {
  const sidebarEl = document.getElementById("app-sidebar");
  if (!sidebarEl) return;
  sidebarEl.addEventListener("click", (event) => {
    const link = event.target.closest(".sidebar__link[data-view]");
    if (!link) return;
    event.preventDefault();
    navigateTo(link.dataset.view);
  });
}

function setupMenuActions() {
  if (!window.dmCopilot?.onMenuAction) return;
  window.dmCopilot.onMenuAction(async (action) => {
    switch (action) {
      case "new-campaign":
        await navigateTo("campaigns");
        setTimeout(() => window.campaignsView?.openForm(), 100);
        break;
      case "open-campaign":
        await navigateTo("campaigns");
        break;
      case "about":
        await navigateTo("dashboard");
        break;
      default:
        break;
    }
  });
}

async function init() {
  try {
    mountShell();
    registerRoutes();

    try {
      const dbReady = await databaseService.init();
      if (dbReady) console.log("Database service initialized");
    } catch (error) {
      console.warn("Database service not available:", error);
    }

    if (window.dmCopilot?.getAppVersion) {
      const version = await window.dmCopilot.getAppVersion();
      statusBar.setVersion(version);
    }

    // Globais usados pelas views (encounter manager, modais de overlay)
    window.encountersView = new EncountersView();
    window.charactersView = charactersView;
    try {
      window.diceView = new DiceView();
    } catch (error) {
      console.warn("DiceView initialization failed:", error);
    }

    setupSidebarNavigation();
    setupMenuActions();

    await navigateTo("dashboard");

    console.log("DM Copilot initialized successfully");
  } catch (error) {
    console.error("Failed to initialize DM Copilot:", error);
  }
}

document.addEventListener("DOMContentLoaded", init);
