// DM Copilot - Renderer Process
// Handles UI logic, navigation, and communication with the main process

// Import styles (Vite handles CSS injection with HMR)
import "./assets/main.css";

// Database Service
import databaseService from "./db/database.js";

// Views
import { CampaignsView, EncountersView, showToast } from "./views/database-views.js";
import charactersView from "./views/characters-view.js";
import DiceView from "./views/dice-view.js";

// ============================================
// DOM Element References
// ============================================
const DOM = {
  // Sidebar
  sidebarLinks: document.querySelectorAll(".sidebar__link[data-view]"),

  // Views (includes both .welcome and .view elements)
  views: document.querySelectorAll('[id^="view-"]'),

  // Status bar
  versionInfo: document.getElementById("version-info"),

  // Feature cards & action buttons
  actionElements: document.querySelectorAll("[data-action]"),
};

// ============================================
// Application State
// ============================================
const state = {
  currentView: "dashboard",
};

// ============================================
// View Instances
// ============================================
window.campaignsView = new CampaignsView();
window.encountersView = new EncountersView();
window.diceView = new DiceView();

// ============================================
// Navigation
// ============================================
function navigateTo(viewName) {
  if (!viewName) return;

  // Hide all views
  DOM.views.forEach((view) => {
    view.classList.add("hidden");
    view.classList.remove("animate-fade-in");
  });

  // Show target view
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) {
    targetView.classList.remove("hidden");
    // Re-trigger animation
    requestAnimationFrame(() => {
      targetView.classList.add("animate-fade-in");
    });
  }

  // Update sidebar active state
  DOM.sidebarLinks.forEach((link) => {
    const isActive = link.dataset.view === viewName;
    link.classList.toggle("sidebar__link--active", isActive);
  });

  state.currentView = viewName;

  // Mount views when navigated to
  if (viewName === "campaigns") {
    window.campaignsView.mount();
  } else if (viewName === "characters") {
    charactersView.mount();
  }
}

// ============================================
// Action Handlers
// ============================================
function handleAction(action) {
  const actionViewMap = {
    "new-campaign": "campaigns",
    "new-character": "characters",
    "open-campaigns": "campaigns",
    "open-characters": "characters",
    "open-dice": "dice",
    "open-notes": "notes",
    "open-settings": "settings",
  };

  const targetView = actionViewMap[action];
  if (targetView) {
    navigateTo(targetView);

    // Special actions after navigation
    if (action === "new-campaign") {
      setTimeout(() => window.campaignsView.openForm(), 100);
    } else if (action === "new-character") {
      setTimeout(() => charactersView.openForm(), 100);
    }
  }
}

// ============================================
// Event Listeners
// ============================================
function setupNavigation() {
  DOM.sidebarLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const view = link.dataset.view;
      if (view) {
        navigateTo(view);
      }
    });
  });
}

function setupActions() {
  DOM.actionElements.forEach((element) => {
    element.addEventListener("click", () => {
      const action = element.dataset.action;
      if (action) {
        handleAction(action);
      }
    });
  });
}

function setupMenuActions() {
  // Listen for menu actions from the main process
  if (window.dmCopilot && window.dmCopilot.onMenuAction) {
    window.dmCopilot.onMenuAction((action) => {
      switch (action) {
        case "new-campaign":
          navigateTo("campaigns");
          if (window.campaignsView) {
            setTimeout(() => window.campaignsView.openForm(), 100);
          }
          break;
        case "open-campaign":
          navigateTo("campaigns");
          break;
        case "save-campaign":
          // Future implementation
          break;
        case "about":
          navigateTo("settings");
          break;
        default:
          break;
      }
    });
  }
}

// ============================================
// Initialization
// ============================================
async function init() {
  try {
    // Initialize database
    try {
      const dbReady = await databaseService.init();
      if (dbReady) {
        console.log("Database service initialized");
      } else {
        console.warn("Database initialization failed, continuing without database");
      }
    } catch (error) {
      console.warn("Database service not available:", error);
    }

    // Get app version from main process
    if (window.dmCopilot && window.dmCopilot.getAppVersion) {
      const version = await window.dmCopilot.getAppVersion();
      if (DOM.versionInfo) {
        DOM.versionInfo.textContent = `v${version}`;
      }
    }

    // Set up all event listeners
    setupNavigation();
    setupActions();
    setupMenuActions();

    // Start on dashboard view
    navigateTo("dashboard");

    console.log("DM Copilot initialized successfully");
  } catch (error) {
    console.error("Failed to initialize DM Copilot:", error);
  }
}

// Start the application when the DOM is ready
document.addEventListener("DOMContentLoaded", init);
