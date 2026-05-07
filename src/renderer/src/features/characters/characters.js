import template from "./characters.html?raw";
import "./characters.css";
import charactersView from "../../views/characters-view.js";

export default class CharactersFeature {
  constructor() {
    this.container = null;
  }

  async mount(container) {
    this.container = container;
    container.innerHTML = template;

    window.charactersView = charactersView;
    await charactersView.mount();
  }

  destroy() {}
}
