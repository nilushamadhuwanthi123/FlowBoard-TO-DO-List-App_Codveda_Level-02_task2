/**
 * app.js
 * -----------------------------------------------------------------------
 * Application bootstrap. Keeps startup order explicit: load persisted
 * state first, then wire up the UI once the DOM is ready.
 * -----------------------------------------------------------------------
 */

document.addEventListener('DOMContentLoaded', () => {
  try {
    TaskManager.init();
    UI.init();
  } catch (err) {
    // Even if something goes wrong during boot, fail loud in the console
    // but keep the page from looking completely broken.
    console.error('[FlowBoard] Failed to initialize app:', err);
    const container = document.getElementById('toast-container');
    if (container) {
      const toast = document.createElement('div');
      toast.className = 'toast toast--error';
      toast.innerHTML = '<span class="toast__icon">⚠</span><span class="toast__msg">Something went wrong loading your tasks. Try refreshing the page.</span>';
      container.appendChild(toast);
    }
  }
});
