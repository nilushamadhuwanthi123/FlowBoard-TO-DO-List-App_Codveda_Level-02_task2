/**
 * ui.js
 * -----------------------------------------------------------------------
 * Everything that touches the DOM: rendering, modals, toasts, drag &
 * drop, theme switching and focus mode. Reads/writes state through
 * TaskManager; never talks to localStorage directly (that's storage.js).
 * -----------------------------------------------------------------------
 */

const UI = (() => {
  const el = {}; // cached DOM refs, populated in cacheDom()

  const state = {
    search: '',
    filter: 'all',
    category: '',
    sort: 'newest',
    editingTaskId: null,
    draftSubtasks: [],
    draggingId: null,
    focusQueue: [],
    focusIndex: 0
  };

  const CATEGORY_FALLBACK_COLOR = '#94A3B8';

  const FILTER_LABELS = {
    all: 'All tasks', today: "Today's tasks", active: 'Active tasks',
    completed: 'Completed tasks', high: 'High priority', overdue: 'Overdue tasks',
    pinned: 'Pinned tasks', archived: 'Archived tasks'
  };

  /* ---------------------------------------------------------------- */
  /* Init                                                               */
  /* ---------------------------------------------------------------- */

  function init() {
    cacheDom();
    initTheme();
    bindStaticEvents();
    renderGreeting();
    renderCategoryOptions();
    renderAll();
    setInterval(renderLiveClocks, 60000); // refresh countdowns/greeting each minute
  }

  function cacheDom() {
    const ids = [
      'sidebar', 'sidebar-toggle', 'filter-list', 'category-list', 'add-category-btn',
      'theme-toggle', 'greeting-text', 'greeting-date', 'focus-mode-btn', 'open-add-task',
      'stat-total', 'stat-active', 'stat-completed', 'stat-high', 'stat-overdue',
      'progress-ring-circle', 'progress-ring-pct', 'productivity-summary',
      'streak-count', 'deadline-countdown', 'deadline-name',
      'search-input', 'sort-select', 'view-current-label',
      'bulk-actions', 'bulk-actions-count', 'clear-completed-btn', 'clear-all-btn',
      'task-list', 'empty-state', 'empty-state-title', 'empty-state-body', 'empty-state-cta',
      'task-modal-overlay', 'task-modal-title', 'task-modal-close', 'task-form', 'task-id-input',
      'task-title-input', 'task-title-error', 'task-desc-input', 'task-priority-input',
      'task-category-input', 'task-due-input', 'task-due-error', 'task-reminder-input',
      'task-reminder-error', 'subtask-editor-list', 'subtask-input', 'subtask-add-btn',
      'task-cancel-btn', 'task-submit-btn',
      'details-modal-overlay', 'details-modal-title', 'details-modal-close', 'details-modal-body',
      'details-edit-btn', 'details-close-btn',
      'confirm-modal-overlay', 'confirm-modal-title', 'confirm-modal-body',
      'confirm-cancel-btn', 'confirm-ok-btn',
      'category-modal-overlay', 'category-modal-close', 'category-form', 'category-name-input',
      'category-color-input', 'category-cancel-btn',
      'focus-overlay', 'focus-exit-btn', 'focus-task-title', 'focus-task-meta',
      'focus-complete-btn', 'focus-skip-btn',
      'toast-container'
    ];
    ids.forEach(id => { el[toCamel(id)] = document.getElementById(id); });

    Object.entries({
      countAll: 'count-all', countToday: 'count-today', countActive: 'count-active',
      countCompleted: 'count-completed', countHigh: 'count-high', countOverdue: 'count-overdue',
      countPinned: 'count-pinned', countArchived: 'count-archived'
    }).forEach(([key, id]) => { el[key] = document.getElementById(id); });
  }

  function toCamel(str) {
    return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  }

  /* ---------------------------------------------------------------- */
  /* Static event bindings                                             */
  /* ---------------------------------------------------------------- */

  function bindStaticEvents() {
    el.sidebarToggle.addEventListener('click', toggleSidebar);
    el.themeToggle.addEventListener('click', toggleTheme);

    el.filterList.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-item');
      if (!btn) return;
      setFilter(btn.dataset.filter);
    });

    el.addCategoryBtn.addEventListener('click', () => openCategoryModal());
    el.categoryModalClose.addEventListener('click', closeCategoryModal);
    el.categoryCancelBtn.addEventListener('click', closeCategoryModal);
    el.categoryForm.addEventListener('submit', handleCategorySubmit);

    el.openAddTask.addEventListener('click', () => openTaskModal());
    el.emptyStateCta.addEventListener('click', () => openTaskModal());
    el.taskModalClose.addEventListener('click', closeTaskModal);
    el.taskCancelBtn.addEventListener('click', closeTaskModal);
    el.taskForm.addEventListener('submit', handleTaskSubmit);
    el.taskModalOverlay.addEventListener('click', (e) => { if (e.target === el.taskModalOverlay) closeTaskModal(); });

    el.subtaskAddBtn.addEventListener('click', addDraftSubtaskFromInput);
    el.subtaskInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addDraftSubtaskFromInput(); }
    });
    el.subtaskEditorList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove-subtask]');
      if (!btn) return;
      const idx = Number(btn.dataset.removeSubtask);
      state.draftSubtasks.splice(idx, 1);
      renderDraftSubtasks();
    });

    el.detailsModalClose.addEventListener('click', closeDetailsModal);
    el.detailsCloseBtn.addEventListener('click', closeDetailsModal);
    el.detailsModalOverlay.addEventListener('click', (e) => { if (e.target === el.detailsModalOverlay) closeDetailsModal(); });
    el.detailsEditBtn.addEventListener('click', () => {
      const id = el.detailsModalOverlay.dataset.taskId;
      closeDetailsModal();
      openTaskModal(id);
    });

    el.confirmModalOverlay.addEventListener('click', (e) => { if (e.target === el.confirmModalOverlay) closeConfirmModal(); });
    el.confirmCancelBtn.addEventListener('click', closeConfirmModal);

    el.searchInput.addEventListener('input', Utils.debounce((e) => {
      state.search = e.target.value;
      renderTaskList();
    }, 200));

    el.sortSelect.addEventListener('change', (e) => {
      state.sort = e.target.value;
      renderTaskList();
    });

    el.clearCompletedBtn.addEventListener('click', () => {
      openConfirmModal({
        title: 'Clear completed tasks?',
        body: 'Every completed task will be permanently removed.',
        confirmLabel: 'Clear completed',
        onConfirm: () => {
          const n = TaskManager.clearCompleted();
          renderAll();
          showToast(`Cleared ${n} completed task${n === 1 ? '' : 's'}.`, 'success');
        }
      });
    });

    el.clearAllBtn.addEventListener('click', () => {
      openConfirmModal({
        title: 'Clear all tasks?',
        body: 'This deletes every task permanently and cannot be undone.',
        confirmLabel: 'Clear all',
        onConfirm: () => {
          TaskManager.clearAll();
          renderAll();
          showToast('All tasks cleared.', 'success');
        }
      });
    });

    // Task list — event delegation for all per-card interactions.
    el.taskList.addEventListener('click', handleTaskListClick);
    el.taskList.addEventListener('dragstart', handleDragStart);
    el.taskList.addEventListener('dragend', handleDragEnd);
    el.taskList.addEventListener('dragover', handleDragOver);
    el.taskList.addEventListener('drop', handleDrop);

    // Focus mode
    el.focusModeBtn.addEventListener('click', enterFocusMode);
    el.focusExitBtn.addEventListener('click', exitFocusMode);
    el.focusCompleteBtn.addEventListener('click', focusCompleteCurrent);
    el.focusSkipBtn.addEventListener('click', focusNext);

    // Global keyboard shortcuts
    document.addEventListener('keydown', handleGlobalKeydown);
  }

  /* ---------------------------------------------------------------- */
  /* Rendering orchestration                                           */
  /* ---------------------------------------------------------------- */

  function renderAll() {
    renderCategoryOptions();
    renderCategorySidebar();
    renderTaskList();
    renderStats();
    renderCounts();
  }

  function renderGreeting() {
    const { text, icon } = Utils.getGreeting();
    el.greetingText.textContent = `${text} ${icon}`;
    el.greetingDate.textContent = new Date().toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric'
    });
  }

  function renderLiveClocks() {
    renderGreeting();
    renderStats(); // refreshes deadline countdown text
  }

  /* ----------------------------- Sidebar ------------------------------ */

  function toggleSidebar() {
    const isOpen = el.sidebar.classList.toggle('is-open');
    el.sidebarToggle.setAttribute('aria-expanded', String(isOpen));
  }

  function setFilter(filter) {
    state.filter = filter;
    state.category = '';
    [...el.filterList.querySelectorAll('.filter-item')].forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.filter === filter);
    });
    [...el.categoryList.querySelectorAll('.category-item')].forEach(btn => btn.classList.remove('is-active'));
    el.viewCurrentLabel.textContent = FILTER_LABELS[filter] || 'Tasks';
    renderTaskList();
    if (window.innerWidth <= 900) el.sidebar.classList.remove('is-open');
  }

  function setCategory(catId, catName) {
    state.category = catId;
    state.filter = 'all';
    [...el.filterList.querySelectorAll('.filter-item')].forEach(btn => btn.classList.toggle('is-active', btn.dataset.filter === 'all'));
    [...el.categoryList.querySelectorAll('.category-item')].forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.categoryId === catId);
    });
    el.viewCurrentLabel.textContent = catName;
    renderTaskList();
    if (window.innerWidth <= 900) el.sidebar.classList.remove('is-open');
  }

  function renderCategorySidebar() {
    const categories = TaskManager.getCategories();
    const tasks = TaskManager.getAllTasksRaw().filter(t => !t.archived);
    el.categoryList.innerHTML = categories.map(cat => {
      const count = tasks.filter(t => t.category === cat.id).length;
      return `
        <li>
          <button class="category-item${state.category === cat.id ? ' is-active' : ''}" type="button" data-category-id="${cat.id}" data-category-name="${Utils.escapeHtml(cat.name)}">
            <span class="category-dot" style="background:${cat.color}"></span>
            <span class="category-item__name">${Utils.escapeHtml(cat.name)}</span>
            <span class="category-item__count">${count}</span>
            <span class="category-item__delete" data-delete-category="${cat.id}" title="Delete category" role="button" aria-label="Delete ${Utils.escapeHtml(cat.name)}">✕</span>
          </button>
        </li>`;
    }).join('');

    [...el.categoryList.querySelectorAll('.category-item')].forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (e.target.closest('[data-delete-category]')) {
          e.stopPropagation();
          const id = e.target.closest('[data-delete-category]').dataset.deleteCategory;
          openConfirmModal({
            title: 'Delete category?',
            body: 'Tasks in this category will become uncategorized.',
            confirmLabel: 'Delete',
            onConfirm: () => { TaskManager.deleteCategory(id); renderAll(); showToast('Category deleted.', 'info'); }
          });
          return;
        }
        setCategory(btn.dataset.categoryId, btn.dataset.categoryName);
      });
    });
  }

  function renderCategoryOptions() {
    const categories = TaskManager.getCategories();
    const current = el.taskCategoryInput.value;
    el.taskCategoryInput.innerHTML = `<option value="">No category</option>` +
      categories.map(c => `<option value="${c.id}">${Utils.escapeHtml(c.name)}</option>`).join('');
    if (current) el.taskCategoryInput.value = current;
  }

  /* ----------------------------- Counts ------------------------------ */

  function renderCounts() {
    const tasks = TaskManager.getAllTasksRaw();
    const visible = tasks.filter(t => !t.archived);
    el.countAll.textContent = visible.length;
    el.countToday.textContent = visible.filter(t => Utils.isToday(t.dueDate)).length;
    el.countActive.textContent = visible.filter(t => !t.completed).length;
    el.countCompleted.textContent = visible.filter(t => t.completed).length;
    el.countHigh.textContent = visible.filter(t => t.priority === 'high').length;
    el.countOverdue.textContent = visible.filter(t => Utils.isOverdue(t.dueDate, t.completed)).length;
    el.countPinned.textContent = visible.filter(t => t.pinned).length;
    el.countArchived.textContent = tasks.filter(t => t.archived).length;
  }

  /* ----------------------------- Dashboard ------------------------------ */

  const RING_CIRCUMFERENCE = 2 * Math.PI * 56;

  function renderStats() {
    const stats = TaskManager.getStats();
    el.statTotal.textContent = stats.total;
    el.statActive.textContent = stats.active;
    el.statCompleted.textContent = stats.completed;
    el.statHigh.textContent = stats.highPriority;
    el.statOverdue.textContent = stats.overdue;

    const offset = RING_CIRCUMFERENCE - (stats.completionPct / 100) * RING_CIRCUMFERENCE;
    el.progressRingCircle.style.strokeDashoffset = String(offset);
    el.progressRingPct.textContent = `${stats.completionPct}%`;

    el.productivitySummary.textContent = summaryLine(stats);
    el.streakCount.textContent = TaskManager.getStreak();

    renderDeadlinePanel();
  }

  function summaryLine(stats) {
    if (stats.total === 0) return 'Add a task to get started.';
    if (stats.completionPct === 100) return 'Everything is done. Nicely played.';
    if (stats.overdue > 0) return `${stats.overdue} task${stats.overdue === 1 ? '' : 's'} overdue — worth a look.`;
    if (stats.dueSoon > 0) return `${stats.dueSoon} task${stats.dueSoon === 1 ? '' : 's'} due soon.`;
    return `${stats.active} task${stats.active === 1 ? '' : 's'} left to reach 100%.`;
  }

  function renderDeadlinePanel() {
    const upcoming = TaskManager.getAllTasksRaw()
      .filter(t => !t.completed && !t.archived && t.dueDate)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];

    if (!upcoming) {
      el.deadlineCountdown.textContent = '—';
      el.deadlineName.textContent = 'No upcoming due dates';
      return;
    }
    el.deadlineCountdown.textContent = Utils.formatCountdown(upcoming.dueDate);
    el.deadlineName.textContent = upcoming.title;
  }

  /* ----------------------------- Task list ------------------------------ */

  function renderTaskList() {
    const list = TaskManager.getVisibleTasks(state);
    el.bulkActions.classList.toggle('is-hidden', list.length === 0);
    el.bulkActionsCount.textContent = `${list.length} task${list.length === 1 ? '' : 's'}`;

    if (list.length === 0) {
      el.taskList.innerHTML = '';
      el.emptyState.classList.remove('is-hidden');
      renderEmptyState();
      return;
    }
    el.emptyState.classList.add('is-hidden');
    el.taskList.innerHTML = list.map(renderTaskCard).join('');
  }

  function renderEmptyState() {
    const hasAnyTasks = TaskManager.getAllTasksRaw().length > 0;
    if (state.search) {
      el.emptyStateTitle.textContent = 'No matches';
      el.emptyStateBody.textContent = `Nothing matches "${state.search}". Try a different search.`;
      el.emptyStateCta.classList.add('is-hidden');
    } else if (state.filter === 'archived') {
      el.emptyStateTitle.textContent = 'Archive is empty';
      el.emptyStateBody.textContent = 'Completed tasks you archive will show up here.';
      el.emptyStateCta.classList.add('is-hidden');
    } else if (hasAnyTasks) {
      el.emptyStateTitle.textContent = 'Nothing here';
      el.emptyStateBody.textContent = 'No tasks match this view right now.';
      el.emptyStateCta.classList.add('is-hidden');
    } else {
      el.emptyStateTitle.textContent = 'No tasks yet';
      el.emptyStateBody.textContent = 'Add your first task and start building momentum.';
      el.emptyStateCta.classList.remove('is-hidden');
    }
  }

  function getCategoryById(id) {
    return TaskManager.getCategories().find(c => c.id === id);
  }

  function renderTaskCard(task) {
    const cat = task.category ? getCategoryById(task.category) : null;
    const overdue = Utils.isOverdue(task.dueDate, task.completed);
    const dueSoon = !overdue && Utils.isDueSoon(task.dueDate, task.completed);
    const doneSubtasks = task.subtasks.filter(s => s.completed).length;

    const badges = [
      `<span class="badge badge--priority-${task.priority}">${task.priority}</span>`,
      cat ? `<span class="badge badge--category" style="background:${cat.color}">${Utils.escapeHtml(cat.name)}</span>` : '',
      task.dueDate ? `<span class="badge ${overdue ? 'badge--overdue' : dueSoon ? 'badge--due-soon' : ''}">${overdue ? '⏰ ' : '📅 '}${Utils.formatRelativeDate(task.dueDate)}</span>` : '',
      task.subtasks.length ? `<span class="badge badge--subtasks">☑ ${doneSubtasks}/${task.subtasks.length}</span>` : ''
    ].filter(Boolean).join('');

    return `
      <li class="task-card${task.completed ? ' is-completed' : ''}" data-task-id="${task.id}" draggable="true">
        <span class="drag-handle" aria-hidden="true" title="Drag to reorder">⠿</span>
        <button class="task-card__checkbox" data-action="toggle-complete" aria-label="${task.completed ? 'Mark incomplete' : 'Mark complete'}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="task-card__body" data-action="open-details">
          <div class="task-card__top">
            <span class="task-card__title">${Utils.escapeHtml(task.title)}</span>
          </div>
          ${task.description ? `<p class="task-card__desc">${Utils.escapeHtml(task.description)}</p>` : ''}
          <div class="task-card__meta">${badges}</div>
        </div>
        <div class="task-card__actions">
          <button class="task-card__action-btn${task.pinned ? ' is-active' : ''}" data-action="toggle-pin" aria-label="${task.pinned ? 'Unpin task' : 'Pin task'}" title="Pin">📌</button>
          <button class="task-card__action-btn" data-action="edit" aria-label="Edit task" title="Edit">✎</button>
          ${task.archived
            ? `<button class="task-card__action-btn" data-action="restore" aria-label="Restore task" title="Restore">↩</button>`
            : `<button class="task-card__action-btn" data-action="archive" aria-label="Archive task" title="Archive">🗄</button>`}
          <button class="task-card__action-btn task-card__action-btn--danger" data-action="delete" aria-label="Delete task" title="Delete">🗑</button>
        </div>
      </li>`;
  }

  function handleTaskListClick(e) {
    const card = e.target.closest('.task-card');
    if (!card) return;
    const id = card.dataset.taskId;
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;
    const action = actionBtn.dataset.action;

    switch (action) {
      case 'toggle-complete':
        animateCompleteToggle(card, id);
        break;
      case 'toggle-pin': {
        const t = TaskManager.togglePin(id);
        renderAll();
        showToast(t.pinned ? 'Task pinned.' : 'Task unpinned.', 'info');
        break;
      }
      case 'edit':
        openTaskModal(id);
        break;
      case 'archive':
        TaskManager.archiveTask(id, true);
        renderAll();
        showToast('Task archived.', 'success');
        break;
      case 'restore':
        TaskManager.archiveTask(id, false);
        renderAll();
        showToast('Task restored.', 'success');
        break;
      case 'delete':
        deleteWithUndo(card, id);
        break;
      case 'open-details':
        openDetailsModal(id);
        break;
      default:
        break;
    }
  }

  function animateCompleteToggle(card, id) {
    const task = TaskManager.toggleComplete(id);
    if (task.completed) {
      card.classList.add('is-completing');
      setTimeout(() => renderAll(), 380);
    } else {
      renderAll();
    }
  }

  function deleteWithUndo(card, id) {
    card.classList.add('is-removing');
    setTimeout(() => {
      TaskManager.deleteTask(id);
      renderAll();
      showToast('Task deleted.', 'info', 'Undo', () => {
        TaskManager.undoDelete();
        renderAll();
        showToast('Task restored.', 'success');
      });
    }, 240);
  }

  /* ----------------------------- Drag & drop ------------------------------ */

  function handleDragStart(e) {
    const card = e.target.closest('.task-card');
    if (!card) return;
    state.draggingId = card.dataset.taskId;
    card.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragEnd(e) {
    const card = e.target.closest('.task-card');
    if (card) card.classList.remove('is-dragging');
    [...el.taskList.querySelectorAll('.task-card')].forEach(c => c.classList.remove('is-drag-over'));
    state.draggingId = null;
  }

  function handleDragOver(e) {
    e.preventDefault();
    const card = e.target.closest('.task-card');
    if (!card || card.dataset.taskId === state.draggingId) return;
    [...el.taskList.querySelectorAll('.task-card')].forEach(c => c.classList.remove('is-drag-over'));
    card.classList.add('is-drag-over');
  }

  function handleDrop(e) {
    e.preventDefault();
    const targetCard = e.target.closest('.task-card');
    if (!targetCard || !state.draggingId) return;
    const targetId = targetCard.dataset.taskId;
    if (targetId === state.draggingId) return;

    const orderedIds = [...el.taskList.querySelectorAll('.task-card')].map(c => c.dataset.taskId);
    const from = orderedIds.indexOf(state.draggingId);
    const to = orderedIds.indexOf(targetId);
    orderedIds.splice(from, 1);
    orderedIds.splice(to, 0, state.draggingId);

    TaskManager.reorderTasks(orderedIds);
    renderTaskList();
  }

  /* ----------------------------- Task modal ------------------------------ */

  function openTaskModal(taskId = null) {
    state.editingTaskId = taskId;
    state.draftSubtasks = [];
    clearFieldErrors();

    if (taskId) {
      const task = TaskManager.getTask(taskId);
      if (!task) return;
      el.taskModalTitle.textContent = 'Edit task';
      el.taskSubmitBtn.textContent = 'Save changes';
      el.taskIdInput.value = task.id;
      el.taskTitleInput.value = task.title;
      el.taskDescInput.value = task.description;
      el.taskPriorityInput.value = task.priority;
      renderCategoryOptions();
      el.taskCategoryInput.value = task.category || '';
      el.taskDueInput.value = Utils.toDateInputValue(task.dueDate);
      el.taskReminderInput.value = task.reminder ? task.reminder.slice(0, 16) : '';
      state.draftSubtasks = task.subtasks.map(s => ({ ...s }));
    } else {
      el.taskModalTitle.textContent = 'Add task';
      el.taskSubmitBtn.textContent = 'Add task';
      el.taskForm.reset();
      el.taskIdInput.value = '';
      renderCategoryOptions();
      el.taskPriorityInput.value = 'medium';
    }

    renderDraftSubtasks();
    el.taskModalOverlay.classList.remove('is-hidden');
    setTimeout(() => el.taskTitleInput.focus(), 50);
    document.addEventListener('keydown', escToClose(closeTaskModal));
  }

  function closeTaskModal() {
    el.taskModalOverlay.classList.add('is-hidden');
    state.editingTaskId = null;
  }

  function addDraftSubtaskFromInput() {
    const value = Utils.sanitizeString(el.subtaskInput.value);
    if (!value) return;
    state.draftSubtasks.push({ id: Utils.generateId('sub'), title: value, completed: false });
    el.subtaskInput.value = '';
    renderDraftSubtasks();
    el.subtaskInput.focus();
  }

  function renderDraftSubtasks() {
    el.subtaskEditorList.innerHTML = state.draftSubtasks.map((s, i) => `
      <li class="subtask-editor-item">
        <span>${Utils.escapeHtml(s.title)}</span>
        <button type="button" data-remove-subtask="${i}" aria-label="Remove subtask">✕</button>
      </li>`).join('');
  }

  function clearFieldErrors() {
    [el.taskTitleInput, el.taskDueInput, el.taskReminderInput].forEach(i => i.classList.remove('has-error'));
    [el.taskTitleError, el.taskDueError, el.taskReminderError].forEach(e => { e.textContent = ''; });
  }

  function handleTaskSubmit(e) {
    e.preventDefault();
    clearFieldErrors();

    const payload = {
      title: el.taskTitleInput.value,
      description: el.taskDescInput.value,
      priority: el.taskPriorityInput.value,
      category: el.taskCategoryInput.value,
      dueDate: el.taskDueInput.value || null,
      reminder: el.taskReminderInput.value || null,
      subtasks: state.draftSubtasks
    };

    const { valid, errors } = Utils.validateTaskInput(payload);
    if (!valid) {
      if (errors.title) { el.taskTitleInput.classList.add('has-error'); el.taskTitleError.textContent = errors.title; }
      if (errors.dueDate) { el.taskDueInput.classList.add('has-error'); el.taskDueError.textContent = errors.dueDate; }
      if (errors.reminder) { el.taskReminderInput.classList.add('has-error'); el.taskReminderError.textContent = errors.reminder; }
      return;
    }

    if (state.editingTaskId) {
      TaskManager.updateTask(state.editingTaskId, payload);
      showToast('Task updated.', 'success');
    } else {
      TaskManager.createTask(payload);
      showToast('Task added.', 'success');
    }

    closeTaskModal();
    renderAll();
  }

  /* ----------------------------- Details modal ------------------------------ */

  function openDetailsModal(taskId) {
    const task = TaskManager.getTask(taskId);
    if (!task) return;
    el.detailsModalOverlay.dataset.taskId = taskId;
    el.detailsModalTitle.textContent = task.title;

    const cat = task.category ? getCategoryById(task.category) : null;
    const rows = [];

    if (task.description) rows.push(row('Description', Utils.escapeHtml(task.description)));
    rows.push(row('Status', task.completed ? '✅ Completed' : '⏳ In progress'));
    rows.push(row('Priority', `<span class="badge badge--priority-${task.priority}">${task.priority}</span>`));
    if (cat) rows.push(row('Category', `<span class="badge badge--category" style="background:${cat.color}">${Utils.escapeHtml(cat.name)}</span>`));
    if (task.dueDate) rows.push(row('Due date', Utils.formatRelativeDate(task.dueDate)));
    if (task.reminder) rows.push(row('Reminder', new Date(task.reminder).toLocaleString()));
    rows.push(row('Created', new Date(task.createdAt).toLocaleString()));

    if (task.subtasks.length) {
      const subtaskHtml = `<div class="details-subtasks">${task.subtasks.map(s => `
        <label class="details-subtask${s.completed ? ' is-done' : ''}">
          <input type="checkbox" ${s.completed ? 'checked' : ''} data-subtask-toggle="${s.id}" />
          <span>${Utils.escapeHtml(s.title)}</span>
        </label>`).join('')}</div>`;
      rows.push(row('Subtasks', subtaskHtml));
    }

    el.detailsModalBody.innerHTML = rows.join('');
    el.detailsModalBody.querySelectorAll('[data-subtask-toggle]').forEach(input => {
      input.addEventListener('change', () => {
        TaskManager.toggleSubtask(taskId, input.dataset.subtaskToggle);
        renderAll();
        openDetailsModal(taskId);
      });
    });

    el.detailsModalOverlay.classList.remove('is-hidden');
    document.addEventListener('keydown', escToClose(closeDetailsModal));

    function row(label, valueHtml) {
      return `<div class="details-row"><div class="details-row__label">${label}</div><div class="details-row__value">${valueHtml}</div></div>`;
    }
  }

  function closeDetailsModal() {
    el.detailsModalOverlay.classList.add('is-hidden');
  }

  /* ----------------------------- Confirm modal ------------------------------ */

  let confirmCallback = null;

  function openConfirmModal({ title, body, confirmLabel = 'Confirm', onConfirm }) {
    el.confirmModalTitle.textContent = title;
    el.confirmModalBody.textContent = body;
    el.confirmOkBtn.textContent = confirmLabel;
    confirmCallback = onConfirm;
    el.confirmModalOverlay.classList.remove('is-hidden');

    el.confirmOkBtn.onclick = () => {
      closeConfirmModal();
      if (confirmCallback) confirmCallback();
    };
    document.addEventListener('keydown', escToClose(closeConfirmModal));
  }

  function closeConfirmModal() {
    el.confirmModalOverlay.classList.add('is-hidden');
    confirmCallback = null;
  }

  /* ----------------------------- Category modal ------------------------------ */

  function openCategoryModal() {
    el.categoryForm.reset();
    el.categoryColorInput.value = '#6366F1';
    el.categoryModalOverlay.classList.remove('is-hidden');
    setTimeout(() => el.categoryNameInput.focus(), 50);
    document.addEventListener('keydown', escToClose(closeCategoryModal));
  }

  function closeCategoryModal() {
    el.categoryModalOverlay.classList.add('is-hidden');
  }

  function handleCategorySubmit(e) {
    e.preventDefault();
    const name = el.categoryNameInput.value;
    if (!Utils.sanitizeString(name)) return;
    TaskManager.addCategory(name, el.categoryColorInput.value);
    closeCategoryModal();
    renderAll();
    showToast('Category created.', 'success');
  }

  /* ----------------------------- Focus mode ------------------------------ */

  function enterFocusMode() {
    state.focusQueue = TaskManager.getVisibleTasks({ filter: 'active', sort: 'priority' })
      .filter(t => !t.completed && !t.archived);
    state.focusIndex = 0;
    el.focusOverlay.classList.remove('is-hidden');
    renderFocusCard();
    document.addEventListener('keydown', escToClose(exitFocusMode));
  }

  function exitFocusMode() {
    el.focusOverlay.classList.add('is-hidden');
  }

  function renderFocusCard() {
    const task = state.focusQueue[state.focusIndex];
    if (!task) {
      el.focusTaskTitle.textContent = "You're all caught up 🎉";
      el.focusTaskMeta.textContent = 'No active tasks left to focus on.';
      el.focusCompleteBtn.classList.add('is-hidden');
      el.focusSkipBtn.classList.add('is-hidden');
      return;
    }
    el.focusCompleteBtn.classList.remove('is-hidden');
    el.focusSkipBtn.classList.remove('is-hidden');
    el.focusTaskTitle.textContent = task.title;
    const bits = [`${task.priority} priority`];
    if (task.dueDate) bits.push(`due ${Utils.formatRelativeDate(task.dueDate)}`);
    el.focusTaskMeta.textContent = bits.join(' · ');
  }

  function focusCompleteCurrent() {
    const task = state.focusQueue[state.focusIndex];
    if (!task) return;
    TaskManager.toggleComplete(task.id);
    renderAll();
    focusNext();
  }

  function focusNext() {
    if (state.focusQueue.length) state.focusQueue.splice(state.focusIndex, 1);
    if (state.focusIndex >= state.focusQueue.length) state.focusIndex = 0;
    renderFocusCard();
  }

  /* ----------------------------- Theme ------------------------------ */

  function initTheme() {
    const saved = Storage.loadData(Storage.KEYS.THEME, null);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    applyTheme(theme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    el.themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
    Storage.saveData(Storage.KEYS.THEME, theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  /* ----------------------------- Toasts ------------------------------ */

  const TOAST_ICONS = { success: '✓', error: '⚠', info: 'ℹ' };

  function showToast(message, type = 'info', actionLabel = null, actionCallback = null) {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <span class="toast__icon" aria-hidden="true">${TOAST_ICONS[type] || TOAST_ICONS.info}</span>
      <span class="toast__msg">${Utils.escapeHtml(message)}</span>
      ${actionLabel ? `<button class="toast__action">${Utils.escapeHtml(actionLabel)}</button>` : ''}
    `;
    el.toastContainer.appendChild(toast);

    if (actionLabel && actionCallback) {
      toast.querySelector('.toast__action').addEventListener('click', () => {
        actionCallback();
        removeToast(toast);
      });
    }

    const lifetime = actionLabel ? 6000 : 3200;
    setTimeout(() => removeToast(toast), lifetime);
  }

  function removeToast(toast) {
    if (!toast.isConnected) return;
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 220);
  }

  /* ----------------------------- Keyboard shortcuts ------------------------------ */

  function escToClose(closeFn) {
    // Returns a one-shot handler bound fresh each time a modal opens, so we
    // never stack duplicate listeners across repeated opens.
    function handler(e) {
      if (e.key === 'Escape') {
        closeFn();
        document.removeEventListener('keydown', handler);
      }
    }
    return handler;
  }

  function handleGlobalKeydown(e) {
    const tag = (e.target.tagName || '').toLowerCase();
    const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;

    if (!isTyping && (e.key === 'n' || e.key === 'N')) {
      e.preventDefault();
      openTaskModal();
      return;
    }
    if (!isTyping && (e.key === '/')) {
      e.preventDefault();
      el.searchInput.focus();
      return;
    }
    if (!isTyping && (e.key === 'f' || e.key === 'F')) {
      if (el.focusOverlay.classList.contains('is-hidden')) enterFocusMode();
    }
  }

  return { init, showToast, renderAll };
})();

if (typeof window !== 'undefined') window.UI = UI;
