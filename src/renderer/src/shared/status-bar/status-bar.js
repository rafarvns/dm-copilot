import template from './status-bar.html?raw';
import './status-bar.css';

export default class StatusBarComponent {
  mount(container) {
    container.innerHTML = template;
  }

  setVersion(version) {
    const el = document.getElementById('version-info');
    if (el) el.textContent = `v${version}`;
  }
}
