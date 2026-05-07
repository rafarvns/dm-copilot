import template from "./sidebar.html?raw";
import "./sidebar.css";
import logoUrl from "../../assets/images/logo_dm_copilot.png";

export default class SidebarComponent {
  mount(container) {
    container.innerHTML = template;
    const logoImg = container.querySelector(".sidebar__logo-img");
    if (logoImg) logoImg.src = logoUrl;
  }

  updateActiveLink(viewName) {
    document.querySelectorAll(".sidebar__link[data-view]").forEach((l) => {
      l.classList.toggle("sidebar__link--active", l.dataset.view === viewName);
    });
  }
}
