const routes = new Map();
let currentRoute = null;

export function registerRoute(name, FeatureClass) {
  routes.set(name, FeatureClass);
}

export async function navigateTo(name) {
  if (currentRoute?.instance?.destroy) {
    currentRoute.instance.destroy();
  }

  const FeatureClass = routes.get(name);
  if (!FeatureClass) return;

  const instance = new FeatureClass();
  const outlet = document.getElementById('view-outlet');
  if (!outlet) return;

  outlet.innerHTML = '';
  await instance.mount(outlet);

  currentRoute = { name, instance };

  document.querySelectorAll('.sidebar__link[data-view]').forEach((l) => {
    l.classList.toggle('sidebar__link--active', l.dataset.view === name);
  });
}

export function getCurrentRoute() {
  return currentRoute;
}
