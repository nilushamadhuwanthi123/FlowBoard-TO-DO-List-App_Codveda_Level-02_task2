/**
 * storage.js
 * -----------------------------------------------------------------------
 * A single, professional wrapper around localStorage. Every read/write in
 * the app goes through here so we get consistent error handling, JSON
 * safety, and a graceful fallback when storage is unavailable (private
 * browsing, quota exceeded, corrupted data, etc).
 * -----------------------------------------------------------------------
 */

const Storage = (() => {
  const NAMESPACE = 'flowboard';

  const KEYS = {
    TASKS: `${NAMESPACE}:tasks`,
    CATEGORIES: `${NAMESPACE}:categories`,
    THEME: `${NAMESPACE}:theme`,
    PREFS: `${NAMESPACE}:prefs`,
    STREAK: `${NAMESPACE}:streak`
  };

  // In-memory fallback used if localStorage is unavailable, so the app
  // never crashes — it just won't persist across sessions.
  const memoryFallback = {};
  let storageAvailable = null;

  function isAvailable() {
    if (storageAvailable !== null) return storageAvailable;
    try {
      const testKey = `${NAMESPACE}:__test__`;
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      storageAvailable = true;
    } catch (err) {
      storageAvailable = false;
      console.warn('[Storage] localStorage unavailable, falling back to in-memory storage.', err);
    }
    return storageAvailable;
  }

  /** Save any JSON-serializable value under a key. */
  function saveData(key, value) {
    try {
      const payload = JSON.stringify(value);
      if (isAvailable()) {
        window.localStorage.setItem(key, payload);
      } else {
        memoryFallback[key] = payload;
      }
      return true;
    } catch (err) {
      console.error(`[Storage] Failed to save "${key}"`, err);
      return false;
    }
  }

  /** Load a value; returns fallback if missing, corrupted, or unavailable. */
  function loadData(key, fallback = null) {
    try {
      const raw = isAvailable() ? window.localStorage.getItem(key) : memoryFallback[key];
      if (raw === null || raw === undefined) return fallback;
      const parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (err) {
      console.error(`[Storage] Corrupted data for "${key}", resetting to fallback.`, err);
      removeData(key);
      return fallback;
    }
  }

  /** Merge-update an object value stored at key (shallow merge). */
  function updateData(key, partial, fallback = {}) {
    const current = loadData(key, fallback);
    const next = { ...current, ...partial };
    saveData(key, next);
    return next;
  }

  function removeData(key) {
    try {
      if (isAvailable()) {
        window.localStorage.removeItem(key);
      } else {
        delete memoryFallback[key];
      }
      return true;
    } catch (err) {
      console.error(`[Storage] Failed to remove "${key}"`, err);
      return false;
    }
  }

  /** Wipe every key this app owns (used by "Clear all data"). */
  function clearData() {
    Object.values(KEYS).forEach(removeData);
  }

  return { KEYS, saveData, loadData, updateData, removeData, clearData, isAvailable };
})();

if (typeof window !== 'undefined') window.Storage = Storage;
