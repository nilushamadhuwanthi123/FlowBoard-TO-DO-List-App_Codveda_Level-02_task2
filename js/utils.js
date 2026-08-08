/**
 * utils.js
 * -----------------------------------------------------------------------
 * Small, pure, reusable helper functions used across the application.
 * Nothing in this file touches the DOM or localStorage directly — that
 * separation of concerns keeps these functions easy to test and reuse.
 * -----------------------------------------------------------------------
 */

const Utils = (() => {
  /** Generate a reasonably unique id (timestamp + random suffix). */
  function generateId(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /** Escape a string for safe insertion into innerHTML. */
  function escapeHtml(str = '') {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  /** Trim + collapse whitespace, guard against non-strings. */
  function sanitizeString(value) {
    if (typeof value !== 'string') return '';
    return value.replace(/\s+/g, ' ').trim();
  }

  /** Debounce a function call — used for the live search input. */
  function debounce(fn, delay = 250) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(null, args), delay);
    };
  }

  /** Return true if a date string represents today (local time). */
  function isToday(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
  }

  /** Return true if a date is strictly before today (and task incomplete). */
  function isOverdue(dateStr, completed) {
    if (!dateStr || completed) return false;
    const d = startOfDay(new Date(dateStr));
    const today = startOfDay(new Date());
    return d.getTime() < today.getTime();
  }

  /** Return true if the due date is within the next 48 hours (but not overdue). */
  function isDueSoon(dateStr, completed) {
    if (!dateStr || completed) return false;
    const d = startOfDay(new Date(dateStr));
    const today = startOfDay(new Date());
    const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);
    return diffDays >= 0 && diffDays <= 2;
  }

  function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /** Human friendly relative date label e.g. "Today", "Tomorrow", "3 days ago". */
  function formatRelativeDate(dateStr) {
    if (!dateStr) return '';
    const d = startOfDay(new Date(dateStr));
    const today = startOfDay(new Date());
    const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 1 && diffDays <= 6) return `In ${diffDays} days`;
    if (diffDays < -1 && diffDays >= -6) return `${Math.abs(diffDays)} days ago`;

    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: new Date(dateStr).getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  }

  /** Format a date for <input type="date"> value (YYYY-MM-DD). */
  function toDateInputValue(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0, 10);
  }

  /** Countdown string like "2d 04h" or "3h 12m" or "Overdue". */
  function formatCountdown(dateStr) {
    if (!dateStr) return '';
    const target = new Date(dateStr).getTime();
    const now = Date.now();
    const diff = target - now;
    if (diff <= 0) return 'Overdue';
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    if (days > 0) return `${days}d ${String(hours).padStart(2, '0')}h`;
    if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
    return `${minutes}m`;
  }

  /** Time-based greeting with icon. */
  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Good morning', icon: '☀️' };
    if (hour < 18) return { text: 'Good afternoon', icon: '🌤️' };
    return { text: 'Good evening', icon: '🌙' };
  }

  /** Clamp a number between min/max. */
  function clamp(n, min, max) {
    return Math.min(Math.max(n, min), max);
  }

  /** Basic task-form validation. Returns { valid, errors } */
  function validateTaskInput({ title, dueDate, reminder }) {
    const errors = {};
    const cleanTitle = sanitizeString(title);

    if (!cleanTitle) {
      errors.title = 'Give your task a title.';
    } else if (cleanTitle.length > 120) {
      errors.title = 'Keep the title under 120 characters.';
    }

    if (dueDate) {
      const d = new Date(dueDate);
      if (Number.isNaN(d.getTime())) errors.dueDate = 'That due date doesn\u2019t look valid.';
    }

    if (reminder) {
      const r = new Date(reminder);
      if (Number.isNaN(r.getTime())) errors.reminder = 'That reminder time doesn\u2019t look valid.';
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  return {
    generateId,
    escapeHtml,
    sanitizeString,
    debounce,
    isToday,
    isOverdue,
    isDueSoon,
    formatRelativeDate,
    toDateInputValue,
    formatCountdown,
    getGreeting,
    clamp,
    validateTaskInput
  };
})();

if (typeof window !== 'undefined') window.Utils = Utils;
