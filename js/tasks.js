/**
 * tasks.js
 * -----------------------------------------------------------------------
 * Owns application state (tasks + categories) and all business logic:
 * CRUD, filtering, sorting, search, stats and streak calculation.
 * This module never touches the DOM — UI rendering lives in ui.js.
 * -----------------------------------------------------------------------
 */

const TaskManager = (() => {
  const DEFAULT_CATEGORIES = [
    { id: 'work', name: 'Work', color: '#6366F1' },
    { id: 'personal', name: 'Personal', color: '#8B5CF6' },
    { id: 'health', name: 'Health', color: '#10B981' },
    { id: 'shopping', name: 'Shopping', color: '#06B6D4' }
  ];

  let tasks = [];
  let categories = [];
  let deletedStack = []; // for undo-delete (supports one level of undo)

  /* ---------------------------------------------------------------- */
  /* Bootstrapping                                                     */
  /* ---------------------------------------------------------------- */

  function init() {
    const storedTasks = Storage.loadData(Storage.KEYS.TASKS, []);
    tasks = Array.isArray(storedTasks) ? storedTasks.filter(isValidTaskShape) : [];

    const storedCategories = Storage.loadData(Storage.KEYS.CATEGORIES, null);
    categories = Array.isArray(storedCategories) && storedCategories.length
      ? storedCategories
      : DEFAULT_CATEGORIES.slice();

    persistTasks();
    persistCategories();
  }

  function isValidTaskShape(t) {
    return t && typeof t === 'object' && typeof t.id === 'string' && typeof t.title === 'string';
  }

  function persistTasks() {
    Storage.saveData(Storage.KEYS.TASKS, tasks);
  }

  function persistCategories() {
    Storage.saveData(Storage.KEYS.CATEGORIES, categories);
  }

  /* ---------------------------------------------------------------- */
  /* CRUD                                                               */
  /* ---------------------------------------------------------------- */

  function createTask(data) {
    const now = new Date().toISOString();
    const task = {
      id: Utils.generateId('task'),
      title: Utils.sanitizeString(data.title),
      description: Utils.sanitizeString(data.description || ''),
      priority: data.priority || 'medium',
      category: data.category || '',
      dueDate: data.dueDate || null,
      reminder: data.reminder || null,
      subtasks: (data.subtasks || []).map(st => ({
        id: Utils.generateId('sub'),
        title: Utils.sanitizeString(st.title || st),
        completed: false
      })),
      completed: false,
      pinned: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      order: tasks.length
    };
    tasks.unshift(task);
    persistTasks();
    return task;
  }

  function updateTask(id, data) {
    const task = getTask(id);
    if (!task) return null;
    Object.assign(task, {
      ...data,
      title: data.title !== undefined ? Utils.sanitizeString(data.title) : task.title,
      description: data.description !== undefined ? Utils.sanitizeString(data.description) : task.description,
      updatedAt: new Date().toISOString()
    });
    persistTasks();
    return task;
  }

  function getTask(id) {
    return tasks.find(t => t.id === id) || null;
  }

  function deleteTask(id) {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return false;
    const [removed] = tasks.splice(idx, 1);
    deletedStack.push({ task: removed, index: idx });
    if (deletedStack.length > 10) deletedStack.shift();
    persistTasks();
    return true;
  }

  function undoDelete() {
    const entry = deletedStack.pop();
    if (!entry) return null;
    const insertAt = Utils.clamp(entry.index, 0, tasks.length);
    tasks.splice(insertAt, 0, entry.task);
    persistTasks();
    return entry.task;
  }

  function toggleComplete(id) {
    const task = getTask(id);
    if (!task) return null;
    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;
    task.updatedAt = new Date().toISOString();
    if (task.completed) recordCompletionForStreak();
    persistTasks();
    return task;
  }

  function togglePin(id) {
    const task = getTask(id);
    if (!task) return null;
    task.pinned = !task.pinned;
    persistTasks();
    return task;
  }

  function archiveTask(id, archived = true) {
    const task = getTask(id);
    if (!task) return null;
    task.archived = archived;
    persistTasks();
    return task;
  }

  function clearCompleted({ archivedOnly = false } = {}) {
    const before = tasks.length;
    tasks = tasks.filter(t => !(t.completed && (!archivedOnly || t.archived)));
    persistTasks();
    return before - tasks.length;
  }

  function clearAll() {
    tasks = [];
    deletedStack = [];
    persistTasks();
  }

  function reorderTasks(orderedIds) {
    const map = new Map(tasks.map(t => [t.id, t]));
    const reordered = orderedIds.map(id => map.get(id)).filter(Boolean);
    // Keep any tasks not present in orderedIds (safety) appended at the end.
    const remaining = tasks.filter(t => !orderedIds.includes(t.id));
    tasks = [...reordered, ...remaining];
    tasks.forEach((t, i) => { t.order = i; });
    persistTasks();
  }

  /* ---------------------------------------------------------------- */
  /* Subtasks                                                           */
  /* ---------------------------------------------------------------- */

  function addSubtask(taskId, title) {
    const task = getTask(taskId);
    if (!task) return null;
    const clean = Utils.sanitizeString(title);
    if (!clean) return null;
    task.subtasks.push({ id: Utils.generateId('sub'), title: clean, completed: false });
    persistTasks();
    return task;
  }

  function toggleSubtask(taskId, subtaskId) {
    const task = getTask(taskId);
    if (!task) return null;
    const sub = task.subtasks.find(s => s.id === subtaskId);
    if (!sub) return null;
    sub.completed = !sub.completed;
    persistTasks();
    return task;
  }

  function deleteSubtask(taskId, subtaskId) {
    const task = getTask(taskId);
    if (!task) return null;
    task.subtasks = task.subtasks.filter(s => s.id !== subtaskId);
    persistTasks();
    return task;
  }

  /* ---------------------------------------------------------------- */
  /* Categories                                                         */
  /* ---------------------------------------------------------------- */

  function getCategories() {
    return categories.slice();
  }

  function addCategory(name, color) {
    const clean = Utils.sanitizeString(name);
    if (!clean) return null;
    const existing = categories.find(c => c.name.toLowerCase() === clean.toLowerCase());
    if (existing) return existing;
    const cat = { id: Utils.generateId('cat'), name: clean, color: color || randomAccentColor() };
    categories.push(cat);
    persistCategories();
    return cat;
  }

  function deleteCategory(id) {
    categories = categories.filter(c => c.id !== id);
    tasks.forEach(t => { if (t.category === id) t.category = ''; });
    persistCategories();
    persistTasks();
  }

  function randomAccentColor() {
    const palette = ['#6366F1', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];
    return palette[Math.floor(Math.random() * palette.length)];
  }

  /* ---------------------------------------------------------------- */
  /* Query: search / filter / sort                                     */
  /* ---------------------------------------------------------------- */

  function getVisibleTasks({ search = '', filter = 'all', category = '', sort = 'newest' } = {}) {
    let result = tasks.slice();

    // Archived tasks are hidden everywhere except the "archived" filter.
    if (filter === 'archived') {
      result = result.filter(t => t.archived);
    } else {
      result = result.filter(t => !t.archived);
    }

    switch (filter) {
      case 'active':
        result = result.filter(t => !t.completed);
        break;
      case 'completed':
        result = result.filter(t => t.completed);
        break;
      case 'high':
        result = result.filter(t => t.priority === 'high');
        break;
      case 'today':
        result = result.filter(t => Utils.isToday(t.dueDate));
        break;
      case 'overdue':
        result = result.filter(t => Utils.isOverdue(t.dueDate, t.completed));
        break;
      case 'pinned':
        result = result.filter(t => t.pinned);
        break;
      default:
        break;
    }

    if (category) {
      result = result.filter(t => t.category === category);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        t.subtasks.some(s => s.title.toLowerCase().includes(q))
      );
    }

    result = sortTasks(result, sort);

    // Pinned tasks always float to the top, preserving the chosen sort within groups.
    const pinned = result.filter(t => t.pinned);
    const rest = result.filter(t => !t.pinned);
    return filter === 'pinned' ? result : [...pinned, ...rest];
  }

  function sortTasks(list, sort) {
    const priorityRank = { high: 0, medium: 1, low: 2 };
    const sorted = list.slice();
    switch (sort) {
      case 'oldest':
        sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        break;
      case 'priority':
        sorted.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);
        break;
      case 'dueDate':
        sorted.sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate) - new Date(b.dueDate);
        });
        break;
      case 'alphabetical':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'newest':
      default:
        sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
    }
    return sorted;
  }

  /* ---------------------------------------------------------------- */
  /* Stats + streak                                                     */
  /* ---------------------------------------------------------------- */

  function getStats() {
    const active = tasks.filter(t => !t.archived);
    const total = active.length;
    const completed = active.filter(t => t.completed).length;
    const activeCount = total - completed;
    const highPriority = active.filter(t => t.priority === 'high' && !t.completed).length;
    const overdue = active.filter(t => Utils.isOverdue(t.dueDate, t.completed)).length;
    const dueSoon = active.filter(t => Utils.isDueSoon(t.dueDate, t.completed)).length;
    const completionPct = total === 0 ? 0 : Math.round((completed / total) * 100);

    return { total, completed, active: activeCount, highPriority, overdue, dueSoon, completionPct };
  }

  function recordCompletionForStreak() {
    const streak = Storage.loadData(Storage.KEYS.STREAK, { count: 0, lastDate: null });
    const today = new Date().toDateString();
    if (streak.lastDate === today) return; // already counted today

    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const nextCount = streak.lastDate === yesterday ? streak.count + 1 : 1;
    Storage.saveData(Storage.KEYS.STREAK, { count: nextCount, lastDate: today });
  }

  function getStreak() {
    const streak = Storage.loadData(Storage.KEYS.STREAK, { count: 0, lastDate: null });
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    // If the streak wasn't continued yesterday or today, it's effectively broken (display 0)
    // but we don't destroy the stored record until a fresh completion happens.
    if (streak.lastDate !== today && streak.lastDate !== yesterday) {
      return 0;
    }
    return streak.count;
  }

  function getAllTasksRaw() {
    return tasks.slice();
  }

  return {
    init,
    createTask,
    updateTask,
    getTask,
    deleteTask,
    undoDelete,
    toggleComplete,
    togglePin,
    archiveTask,
    clearCompleted,
    clearAll,
    reorderTasks,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    getCategories,
    addCategory,
    deleteCategory,
    getVisibleTasks,
    getStats,
    getStreak,
    getAllTasksRaw
  };
})();

if (typeof window !== 'undefined') window.TaskManager = TaskManager;
