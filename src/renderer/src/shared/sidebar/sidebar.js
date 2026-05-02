import template from './sidebar.html?raw';
import './sidebar.css';

export default class SidebarComponent {
  mount(container) {
    container.innerHTML = template;
  }

  updateActiveLink(viewName) {
    document.querySelectorAll('.sidebar__link[data-view]').forEach((l) => {
      l.classList.toggle('sidebar__link--active', l.dataset.view === viewName);
    });
  }
}
