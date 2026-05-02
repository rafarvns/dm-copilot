const ICONS = { success: '✅', error: '❌', info: 'ℹ️' };

export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <span class="toast__icon">${ICONS[type] || ICONS.info}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast--removing');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
