/* js/portal/ui/portal-project-tasks-view.js - Project Tasks (List & Kanban Views) */

import { DataClient } from "../api/data-client.js";
import { PortalAuth } from "../auth/auth-service.js";

let currentViewMode = "list"; // 'list' | 'kanban'
let currentFilters = {
    search: "",
    status: "all",
    priority: "all",
    responsibility: "all",
    assignee: "all",
    overdueOnly: false
};

export function renderProjectTasksView(projectId, tasks = [], stages = [], members = [], contacts = [], dependencies = [], canManage = false) {
    const isMember = PortalAuth.isGlobalOwner() || canManage || members.some(m => m.user_id === PortalAuth.getUserId());
    const openTasksCount = tasks.filter(t => t.status !== "done").length;
    const clientActionsCount = tasks.filter(t => t.responsibility_type === "client" && t.status !== "done").length;
    const overdueCount = tasks.filter(t => isTaskOverdue(t)).length;

    // Filter tasks based on currentFilters
    const filteredTasks = filterTasksList(tasks, currentFilters);

    return `
        <div class="portal-tasks-container">
            <!-- Top Controls Bar -->
            <div class="portal-tasks-controls-bar">
                <div class="portal-tasks-summary-pills">
                    <span class="portal-badge" style="background: rgba(59,130,246,0.1); color: #60A5FA; font-size: 0.8rem; padding: 4px 10px;">
                        Всього: <strong>${tasks.length}</strong>
                    </span>
                    <span class="portal-badge" style="background: rgba(245,158,11,0.1); color: #FBBF24; font-size: 0.8rem; padding: 4px 10px;">
                        В роботі: <strong>${openTasksCount}</strong>
                    </span>
                    <span class="portal-badge" style="background: rgba(168,85,247,0.1); color: #C084FC; font-size: 0.8rem; padding: 4px 10px;">
                        Очікуємо від клієнта: <strong>${clientActionsCount}</strong>
                    </span>
                    ${overdueCount > 0 ? `
                        <span class="portal-badge" style="background: rgba(239,68,68,0.15); color: #F87171; font-size: 0.8rem; padding: 4px 10px;">
                            <i data-lucide="alert-triangle" style="width: 12px; height: 12px;"></i> Прострочено: <strong>${overdueCount}</strong>
                        </span>
                    ` : ""}
                </div>

                <div style="display: flex; align-items: center; gap: 10px;">
                    <!-- View Mode Switcher -->
                    <div class="portal-view-switcher">
                        <button class="portal-view-btn ${currentViewMode === 'list' ? 'active' : ''}" id="btn-view-list" title="Список">
                            <i data-lucide="list"></i> Список
                        </button>
                        <button class="portal-view-btn ${currentViewMode === 'kanban' ? 'active' : ''}" id="btn-view-kanban" title="Канбан дошка">
                            <i data-lucide="kanban"></i> Канбан
                        </button>
                    </div>

                    ${canManage ? `
                        <button class="btn btn-primary" id="btn-create-task" style="padding: 7px 14px; font-size: 0.85rem;">
                            <i data-lucide="plus"></i> Створити задачу
                        </button>
                    ` : ""}
                </div>
            </div>

            <!-- Filter & Search Toolbar -->
            <div class="portal-tasks-filter-bar">
                <div class="portal-search-box" style="flex: 1; min-width: 200px;">
                    <i data-lucide="search" style="width: 14px; height: 14px; color: var(--text-muted);"></i>
                    <input type="text" id="task-search-input" class="portal-search-input" placeholder="Пошук задач за назвою..." value="${escapeHtml(currentFilters.search)}" />
                </div>

                <select id="filter-task-status" class="portal-select-sm">
                    <option value="all" ${currentFilters.status === 'all' ? 'selected' : ''}>Всі статуси</option>
                    <option value="backlog" ${currentFilters.status === 'backlog' ? 'selected' : ''}>Беклог</option>
                    <option value="todo" ${currentFilters.status === 'todo' ? 'selected' : ''}>До виконання</option>
                    <option value="in_progress" ${currentFilters.status === 'in_progress' ? 'selected' : ''}>В роботі</option>
                    <option value="review" ${currentFilters.status === 'review' ? 'selected' : ''}>На перевірці</option>
                    <option value="waiting_client" ${currentFilters.status === 'waiting_client' ? 'selected' : ''}>Очікуємо клієнта</option>
                    <option value="blocked" ${currentFilters.status === 'blocked' ? 'selected' : ''}>Заблоковано</option>
                    <option value="done" ${currentFilters.status === 'done' ? 'selected' : ''}>Виконано</option>
                </select>

                <select id="filter-task-priority" class="portal-select-sm">
                    <option value="all" ${currentFilters.priority === 'all' ? 'selected' : ''}>Всі пріоритети</option>
                    <option value="critical" ${currentFilters.priority === 'critical' ? 'selected' : ''}>Критичний</option>
                    <option value="high" ${currentFilters.priority === 'high' ? 'selected' : ''}>Високий</option>
                    <option value="medium" ${currentFilters.priority === 'medium' ? 'selected' : ''}>Середній</option>
                    <option value="low" ${currentFilters.priority === 'low' ? 'selected' : ''}>Низький</option>
                </select>

                <select id="filter-task-resp" class="portal-select-sm">
                    <option value="all" ${currentFilters.responsibility === 'all' ? 'selected' : ''}>Вся відповідальність</option>
                    <option value="internal" ${currentFilters.responsibility === 'internal' ? 'selected' : ''}>Команда (Internal)</option>
                    <option value="client" ${currentFilters.responsibility === 'client' ? 'selected' : ''}>Очікуємо від клієнта</option>
                </select>

                <select id="filter-task-assignee" class="portal-select-sm">
                    <option value="all" ${currentFilters.assignee === 'all' ? 'selected' : ''}>Всі виконавці</option>
                    ${members.map(m => `
                        <option value="${m.user_id}" ${currentFilters.assignee === m.user_id ? 'selected' : ''}>
                            ${escapeHtml(m.profiles?.full_name || m.profiles?.email || 'Спеціаліст')}
                        </option>
                    `).join("")}
                </select>

                <button class="btn btn-sm ${currentFilters.overdueOnly ? 'btn-danger' : 'btn-outline'}" id="btn-toggle-overdue" style="padding: 5px 10px; font-size: 0.78rem;">
                    <i data-lucide="clock" style="width: 12px; height: 12px;"></i> Тільки прострочені
                </button>
            </div>

            <!-- Content Area: List or Kanban -->
            <div id="project-tasks-view-content" style="margin-top: 16px;">
                ${filteredTasks.length === 0 ? `
                    <div class="portal-placeholder-box" style="padding: 40px 20px;">
                        <div class="portal-empty-icon" style="color: var(--color-primary);"><i data-lucide="check-square"></i></div>
                        <div class="portal-empty-title">Задач не знайдено</div>
                        <div class="portal-empty-desc">
                            ${tasks.length === 0 ? "У цьому проєкті ще немає створених задач. Створіть першу задачу для команди або дію для клієнта." : "Немає задач, що відповідають вибраним фільтрам."}
                        </div>
                        ${canManage && tasks.length === 0 ? `
                            <button class="btn btn-primary btn-empty-create-task" style="margin-top: 10px;">
                                <i data-lucide="plus"></i> Створити першу задачу
                            </button>
                        ` : ""}
                    </div>
                ` : (currentViewMode === 'kanban' ? renderKanbanView(filteredTasks, dependencies, canManage, isMember) : renderListView(filteredTasks, dependencies, canManage, isMember))}
            </div>
        </div>
    `;
}

function renderListView(tasks, dependencies, canManage, isMember) {
    return `
        <div class="portal-task-list-table">
            <div class="portal-task-list-header">
                <div style="width: 38px;"></div>
                <div style="flex: 2; min-width: 220px;">Задача</div>
                <div style="width: 130px;">Статус</div>
                <div style="width: 95px;">Пріоритет</div>
                <div style="width: 170px;">Відповідальний / Контакт</div>
                <div style="width: 160px;">Етап / Дедлайн</div>
                <div style="width: 70px; text-align: right;">Дії</div>
            </div>
            <div class="portal-task-list-body">
                ${tasks.map(task => renderTaskRow(task, dependencies, canManage, isMember)).join("")}
            </div>
        </div>
    `;
}

function renderTaskRow(task, dependencies, canManageParam, isMember) {
    const canManage = PortalAuth.isGlobalOwner() || canManageParam;
    const currentUserId = PortalAuth.getUserId();
    const canEditThisTask = canManage || (task.assignee_user_id === currentUserId || task.assignee?.id === currentUserId);
    const isDone = task.status === "done";
    const isOverdue = isTaskOverdue(task);
    const blockingDeps = getBlockingDependencies(task.id, dependencies);
    const isBlocked = blockingDeps.length > 0 && !isDone;
    const dueDateFormatted = task.due_date ? formatDate(task.due_date) : null;
    const isClientAction = task.responsibility_type === "client";

    return `
        <div class="portal-task-row ${isDone ? 'task-row-done' : ''}" data-task-id="${task.id}">
            <div style="width: 32px; display: flex; align-items: center; justify-content: center;">
                <label class="portal-checkbox-label">
                    <input type="checkbox" class="task-checkbox-toggle" data-task-id="${task.id}" ${isDone ? 'checked' : ''} ${!canEditThisTask ? 'disabled' : ''} />
                    <span class="portal-custom-checkbox"></span>
                </label>
            </div>

            <div style="flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 3px; padding-right: 14px;">
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <span class="portal-task-title ${isDone ? 'task-title-done' : ''} btn-open-task-detail" data-task-id="${task.id}" style="cursor: pointer; font-weight: 600; color: var(--text-primary);">
                        ${escapeHtml(task.title)}
                    </span>
                    ${isClientAction ? `
                        <span class="portal-badge portal-badge-client-action">
                            <i data-lucide="user-check" style="width: 10px; height: 10px;"></i> Очікуємо від клієнта
                        </span>
                    ` : ""}
                    ${isBlocked ? `
                        <span class="portal-badge portal-badge-blocked" title="Заблоковано невиконаними попередніми задачами (${blockingDeps.length})">
                            <i data-lucide="lock" style="width: 10px; height: 10px;"></i> Заблоковано (${blockingDeps.length})
                        </span>
                    ` : ""}
                    ${isOverdue ? `
                        <span class="portal-badge portal-badge-overdue">
                            <i data-lucide="alert-circle" style="width: 10px; height: 10px;"></i> Прострочено
                        </span>
                    ` : ""}
                </div>
                ${task.description ? `
                    <div style="font-size: 0.76rem; color: var(--text-muted); line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 480px;">
                        ${escapeHtml(task.description)}
                    </div>
                ` : ""}
            </div>

            <div style="width: 130px;">
                ${canEditThisTask ? `
                    <select class="portal-select-inline task-status-select" data-task-id="${task.id}">
                        <option value="backlog" ${task.status === 'backlog' ? 'selected' : ''}>Беклог</option>
                        <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>До виконання</option>
                        <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>В роботі</option>
                        <option value="review" ${task.status === 'review' ? 'selected' : ''}>На перевірці</option>
                        <option value="waiting_client" ${task.status === 'waiting_client' ? 'selected' : ''}>Очікуємо клієнта</option>
                        <option value="blocked" ${task.status === 'blocked' ? 'selected' : ''}>Заблоковано</option>
                        <option value="done" ${task.status === 'done' ? 'selected' : ''}>Виконано</option>
                    </select>
                ` : `
                    <span class="portal-badge portal-badge-task-${task.status}">
                        ${getTaskStatusLabel(task.status)}
                    </span>
                `}
            </div>

            <div style="width: 95px;">
                <span class="portal-badge portal-badge-priority-${task.priority}">
                    ${getPriorityLabel(task.priority)}
                </span>
            </div>

            <div style="width: 170px; font-size: 0.82rem; color: var(--text-secondary);">
                ${isClientAction ? (
                    task.client_contact ? `
                        <div style="display: flex; align-items: center; gap: 6px;" title="Клієнтський контакт">
                            <i data-lucide="building" style="width: 13px; height: 13px; color: var(--color-gold);"></i>
                            <span>${escapeHtml(task.client_contact.first_name || '')} ${escapeHtml(task.client_contact.last_name || '')}</span>
                        </div>
                    ` : `<span style="color: var(--text-muted);">Клієнт (не вказано)</span>`
                ) : (
                    task.assignee ? `
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <div class="portal-user-avatar-sm" style="width: 20px; height: 20px; font-size: 0.65rem;">
                                ${(task.assignee.full_name?.substring(0, 2) || 'SP').toUpperCase()}
                            </div>
                            <span>${escapeHtml(task.assignee.full_name || task.assignee.email)}</span>
                        </div>
                    ` : `<span style="color: var(--text-muted);">— Не призначено —</span>`
                )}
            </div>

            <div style="width: 160px; display: flex; flex-direction: column; gap: 2px;">
                ${task.stage ? `
                    <span style="font-size: 0.75rem; color: var(--color-primary); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <i data-lucide="milestone" style="width: 11px; height: 11px; vertical-align: middle;"></i> ${escapeHtml(task.stage.name)}
                    </span>
                ` : ""}
                ${dueDateFormatted ? `
                    <span style="font-size: 0.76rem; color: ${isOverdue ? 'var(--color-danger)' : 'var(--text-muted)'}; display: inline-flex; align-items: center; gap: 4px;">
                        <i data-lucide="calendar" style="width: 11px; height: 11px;"></i> ${dueDateFormatted}
                    </span>
                ` : `<span style="font-size: 0.74rem; color: var(--text-muted);">Без дедлайну</span>`}
            </div>

            <div style="width: 70px; text-align: right; display: flex; justify-content: flex-end; gap: 4px;">
                <button class="portal-icon-btn btn-open-task-detail" data-task-id="${task.id}" title="Переглянути / Редагувати">
                    <i data-lucide="edit-2" style="width: 13px; height: 13px;"></i>
                </button>
                ${canManage ? `
                    <button class="portal-icon-btn btn-delete-task" data-task-id="${task.id}" data-task-title="${escapeHtml(task.title)}" title="Видалити задачу" style="color: var(--color-danger);">
                        <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
                    </button>
                ` : ""}
            </div>
        </div>
    `;
}

function renderKanbanView(tasks, dependencies, canManage, isMember) {
    const columns = [
        { id: "backlog", label: "Беклог", color: "#64748B" },
        { id: "todo", label: "До виконання", color: "#3B82F6" },
        { id: "in_progress", label: "В роботі", color: "#F59E0B" },
        { id: "review", label: "На перевірці", color: "#8B5CF6" },
        { id: "waiting_client", label: "Очікуємо клієнта", color: "#EC4899" },
        { id: "blocked", label: "Заблоковано", color: "#EF4444" },
        { id: "done", label: "Виконано", color: "#10B981" }
    ];

    return `
        <div class="portal-kanban-board">
            ${columns.map(col => {
                const colTasks = tasks.filter(t => t.status === col.id);
                return `
                    <div class="portal-kanban-column" data-status="${col.id}">
                        <div class="portal-kanban-column-header" style="border-top-color: ${col.color};">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary);">${col.label}</span>
                                <span class="portal-kanban-count">${colTasks.length}</span>
                            </div>
                            ${canManage && col.id !== 'done' ? `
                                <button class="portal-icon-btn btn-quick-add-task" data-status="${col.id}" title="Додати задачу у ${col.label}">
                                    <i data-lucide="plus" style="width: 13px; height: 13px;"></i>
                                </button>
                            ` : ""}
                        </div>

                        <div class="portal-kanban-cards-list">
                            ${colTasks.length === 0 ? `
                                <div class="portal-kanban-empty">Порожньо</div>
                            ` : colTasks.map(task => renderKanbanCard(task, dependencies, canManage, isMember)).join("")}
                        </div>
                    </div>
                `;
            }).join("")}
        </div>
    `;
}

function renderKanbanCard(task, dependencies, canManage, isMember) {
    const isDone = task.status === "done";
    const isOverdue = isTaskOverdue(task);
    const blockingDeps = getBlockingDependencies(task.id, dependencies);
    const isBlocked = blockingDeps.length > 0 && !isDone;
    const dueDateFormatted = task.due_date ? formatDate(task.due_date) : null;
    const isClientAction = task.responsibility_type === "client";

    return `
        <div class="portal-kanban-card ${isDone ? 'kanban-card-done' : ''}" data-task-id="${task.id}">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; margin-bottom: 6px;">
                <span class="portal-badge portal-badge-priority-${task.priority}" style="font-size: 0.65rem; padding: 1px 6px;">
                    ${getPriorityLabel(task.priority)}
                </span>
                ${isClientAction ? `
                    <span class="portal-badge portal-badge-client-action" style="font-size: 0.65rem; padding: 1px 6px;">
                        Очікуємо від клієнта
                    </span>
                ` : ""}
            </div>

            <div class="portal-kanban-card-title btn-open-task-detail" data-task-id="${task.id}" style="cursor: pointer;">
                ${escapeHtml(task.title)}
            </div>

            ${task.stage ? `
                <div style="font-size: 0.72rem; color: var(--color-primary); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    <i data-lucide="milestone" style="width: 10px; height: 10px; vertical-align: middle;"></i> ${escapeHtml(task.stage.name)}
                </div>
            ` : ""}

            <div class="portal-kanban-card-footer">
                <div style="display: flex; align-items: center; gap: 6px;">
                    ${isClientAction ? `
                        <span title="Дія клієнта" style="color: var(--color-gold); font-size: 0.72rem; display: inline-flex; align-items: center; gap: 3px;">
                            <i data-lucide="user-check" style="width: 12px; height: 12px;"></i> ${escapeHtml(task.client_contact?.first_name || 'Client')}
                        </span>
                    ` : (
                        task.assignee ? `
                            <div class="portal-user-avatar-sm" style="width: 22px; height: 22px; font-size: 0.65rem;" title="${escapeHtml(task.assignee.full_name || task.assignee.email)}">
                                ${(task.assignee.full_name?.substring(0, 2) || 'SP').toUpperCase()}
                            </div>
                        ` : `<span style="font-size: 0.72rem; color: var(--text-muted);">—</span>`
                    )}
                </div>

                <div style="display: flex; align-items: center; gap: 6px;">
                    ${isBlocked ? `
                        <span style="color: var(--color-danger);" title="Заблоковано попередніми задачами"><i data-lucide="lock" style="width: 12px; height: 12px;"></i></span>
                    ` : ""}
                    ${dueDateFormatted ? `
                        <span style="font-size: 0.72rem; color: ${isOverdue ? 'var(--color-danger)' : 'var(--text-muted)'}; display: inline-flex; align-items: center; gap: 3px;">
                            <i data-lucide="clock" style="width: 11px; height: 11px;"></i> ${dueDateFormatted}
                        </span>
                    ` : ""}
                </div>
            </div>
        </div>
    `;
}

// -----------------------------------------------------------------------------
// Events Binding
// -----------------------------------------------------------------------------
export function initProjectTasksEvents(projectId, organizationId, tasks, stages, members, contacts, dependencies, onReload) {
    const canManage = PortalAuth.isGlobalOwner() || PortalAuth.isOrgAdmin(organizationId);

    // 1. Switch View Mode (List vs Kanban)
    document.getElementById("btn-view-list")?.addEventListener("click", () => {
        currentViewMode = "list";
        if (onReload) onReload();
    });
    document.getElementById("btn-view-kanban")?.addEventListener("click", () => {
        currentViewMode = "kanban";
        if (onReload) onReload();
    });

    // 2. Filters
    const searchInput = document.getElementById("task-search-input");
    searchInput?.addEventListener("input", (e) => {
        currentFilters.search = e.target.value.trim();
        reapplyFilters();
    });

    document.getElementById("filter-task-status")?.addEventListener("change", (e) => {
        currentFilters.status = e.target.value;
        reapplyFilters();
    });
    document.getElementById("filter-task-priority")?.addEventListener("change", (e) => {
        currentFilters.priority = e.target.value;
        reapplyFilters();
    });
    document.getElementById("filter-task-resp")?.addEventListener("change", (e) => {
        currentFilters.responsibility = e.target.value;
        reapplyFilters();
    });
    document.getElementById("filter-task-assignee")?.addEventListener("change", (e) => {
        currentFilters.assignee = e.target.value;
        reapplyFilters();
    });
    document.getElementById("btn-toggle-overdue")?.addEventListener("click", () => {
        currentFilters.overdueOnly = !currentFilters.overdueOnly;
        reapplyFilters();
    });

    function reapplyFilters() {
        if (onReload) onReload();
    }

    // 3. Create Task Buttons
    document.getElementById("btn-create-task")?.addEventListener("click", () => {
        openTaskModal(projectId, organizationId, null, stages, members, contacts, tasks, dependencies, onReload);
    });
    document.querySelectorAll(".btn-empty-create-task").forEach(btn => {
        btn.addEventListener("click", () => {
            openTaskModal(projectId, organizationId, null, stages, members, contacts, tasks, dependencies, onReload);
        });
    });
    document.querySelectorAll(".btn-quick-add-task").forEach(btn => {
        btn.addEventListener("click", () => {
            const initialStatus = btn.getAttribute("data-status");
            openTaskModal(projectId, organizationId, { status: initialStatus }, stages, members, contacts, tasks, dependencies, onReload);
        });
    });

    // 4. Open Task Detail / Edit Modal
    document.querySelectorAll(".btn-open-task-detail").forEach(btn => {
        btn.addEventListener("click", () => {
            const taskId = btn.getAttribute("data-task-id");
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                openTaskModal(projectId, organizationId, task, stages, members, contacts, tasks, dependencies, onReload);
            }
        });
    });

    // 5. Delete Task
    document.querySelectorAll(".btn-delete-task").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const taskId = btn.getAttribute("data-task-id");
            const taskTitle = btn.getAttribute("data-task-title");
            openDeleteTaskModal(taskId, taskTitle, onReload);
        });
    });

    // 6. Status Checkbox Quick Toggle
    document.querySelectorAll(".portal-task-status-checkbox").forEach(cb => {
        cb.addEventListener("change", async () => {
            const taskId = cb.getAttribute("data-task-id");
            const newStatus = cb.checked ? "done" : "todo";
            cb.disabled = true;
            try {
                await DataClient.toggleTaskStatus(taskId, newStatus);
                if (onReload) await onReload();
            } catch (err) {
                console.error("Failed to toggle task status:", err);
                cb.disabled = false;
            }
        });
    });

    // 7. Status Inline Select
    document.querySelectorAll(".task-status-select").forEach(sel => {
        sel.addEventListener("change", async () => {
            const taskId = sel.getAttribute("data-task-id");
            const newStatus = sel.value;
            sel.disabled = true;
            try {
                await DataClient.toggleTaskStatus(taskId, newStatus);
                if (onReload) await onReload();
            } catch (err) {
                console.error("Failed to change task status:", err);
                sel.disabled = false;
            }
        });
    });
}

// -----------------------------------------------------------------------------
// Modals: Create / Edit Task & Dependencies
// -----------------------------------------------------------------------------
export async function openTaskModal(projectId, organizationId, task = null, stages = [], members = [], contacts = [], allTasks = [], allDeps = [], onSuccess) {
    const mount = document.getElementById("project-detail-modal-mount") || document.getElementById("portal-tasks-modal-mount");
    if (!mount) return;

    const isEdit = Boolean(task && task.id);
    const currentTaskId = task?.id;
    const currentUserId = PortalAuth.getUserId();
    const isProjectPM = members.some(m => m.user_id === currentUserId && m.project_role === 'pm');
    const canManage = PortalAuth.isGlobalOwner() || PortalAuth.isOrgAdmin(organizationId) || isProjectPM;
    const isAssignee = task && (task.assignee_user_id === currentUserId || task.assignee?.id === currentUserId);
    const isSpecialistSelfEdit = isEdit && !canManage && isAssignee;
    const isReadOnly = isEdit && !canManage && !isAssignee;

    // Direct dependencies for this task
    const taskDeps = isEdit ? allDeps.filter(d => d.task_id === currentTaskId) : [];
    const blockingOthers = isEdit ? allDeps.filter(d => d.depends_on_task_id === currentTaskId) : [];

    // Eligible tasks for "Depends on" (cannot select self or circular)
    const eligibleTasks = allTasks.filter(t => t.id !== currentTaskId);

    const stagesOptions = stages.map(s => `
        <option value="${s.id}" ${task?.stage_id === s.id ? 'selected' : ''}>
            ${escapeHtml(s.name)}
        </option>
    `).join("");

    const staffOptions = members.map(m => `
        <option value="${m.user_id}" ${task?.assignee_user_id === m.user_id ? 'selected' : ''}>
            ${escapeHtml(m.profiles?.full_name || m.profiles?.email || 'Спеціаліст')} (${(m.project_role || 'member').toUpperCase()})
        </option>
    `).join("");

    const contactsOptions = contacts.map(c => `
        <option value="${c.id}" ${task?.client_contact_id === c.id ? 'selected' : ''}>
            ${escapeHtml(c.first_name || '')} ${escapeHtml(c.last_name || '')} (${escapeHtml(c.position || 'Контакт')})
        </option>
    `).join("");

    const dependsOptions = eligibleTasks.map(t => {
        const isSelected = taskDeps.some(d => d.depends_on_task_id === t.id);
        return `
            <option value="${t.id}" ${isSelected ? 'selected' : ''}>
                ${escapeHtml(t.title)} [${getTaskStatusLabel(t.status)}]
            </option>
        `;
    }).join("");

    mount.innerHTML = `
        <div class="portal-modal-overlay" id="task-modal-overlay">
            <div class="portal-modal" style="max-width: 620px;">
                <div class="portal-modal-header">
                    <div class="portal-modal-title">
                        ${isReadOnly ? "Перегляд задачі делівері" : (isSpecialistSelfEdit ? "Оновити виконання задачі" : (isEdit ? "Редагувати задачу делівері" : "Створити нову задачу"))}
                    </div>
                    <button id="btn-close-task-modal" style="color: var(--text-muted); cursor: pointer; padding: 4px;">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <form id="form-task-modal">
                    <div class="portal-modal-body">
                        ${isSpecialistSelfEdit ? `
                            <div style="background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.25); border-radius: var(--radius-sm); padding: 10px 12px; margin-bottom: 14px; font-size: 0.8rem; color: #93C5FD; display: flex; align-items: flex-start; gap: 8px;">
                                <i data-lucide="info" style="width: 15px; height: 15px; flex-shrink: 0; margin-top: 2px;"></i>
                                <span>Ви є призначеним виконавцем цієї задачі. Ви можете оновлювати її статус та опис виконання. Структурні прив'язки та пріоритет контролюються PM.</span>
                            </div>
                        ` : (isReadOnly ? `
                            <div style="background: rgba(148,163,184,0.08); border: 1px solid rgba(148,163,184,0.2); border-radius: var(--radius-sm); padding: 10px 12px; margin-bottom: 14px; font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 8px;">
                                <i data-lucide="lock" style="width: 14px; height: 14px; flex-shrink: 0;"></i>
                                <span>Режим перегляду. Редагування задачі доступне відповідальному PM або призначеному виконавцю.</span>
                            </div>
                        ` : '')}

                        <div class="portal-form-group">
                            <label class="portal-label">Назва задачі <span style="color: var(--color-danger);">*</span></label>
                            <input type="text" id="task-title" class="portal-input" placeholder="Наприклад: Налаштувати воронку продажів у CRM" value="${escapeHtml(task?.title || '')}" ${isSpecialistSelfEdit || isReadOnly ? 'disabled' : 'required'} />
                        </div>

                        <div class="portal-form-row">
                            <div class="portal-form-group">
                                <label class="portal-label">Статус</label>
                                <select id="task-status" class="portal-select" ${isReadOnly ? 'disabled' : ''}>
                                    <option value="backlog" ${task?.status === 'backlog' ? 'selected' : ''}>Беклог</option>
                                    <option value="todo" ${(!task?.status || task?.status === 'todo') ? 'selected' : ''}>До виконання</option>
                                    <option value="in_progress" ${task?.status === 'in_progress' ? 'selected' : ''}>В роботі</option>
                                    <option value="review" ${task?.status === 'review' ? 'selected' : ''}>На перевірці</option>
                                    <option value="waiting_client" ${task?.status === 'waiting_client' ? 'selected' : ''}>Очікуємо клієнта</option>
                                    <option value="blocked" ${task?.status === 'blocked' ? 'selected' : ''}>Заблоковано</option>
                                    <option value="done" ${task?.status === 'done' ? 'selected' : ''}>Виконано</option>
                                </select>
                            </div>
                            <div class="portal-form-group">
                                <label class="portal-label">Пріоритет</label>
                                <select id="task-priority" class="portal-select" ${isSpecialistSelfEdit || isReadOnly ? 'disabled' : ''}>
                                    <option value="low" ${task?.priority === 'low' ? 'selected' : ''}>Низький</option>
                                    <option value="medium" ${(!task?.priority || task?.priority === 'medium') ? 'selected' : ''}>Середній</option>
                                    <option value="high" ${task?.priority === 'high' ? 'selected' : ''}>Високий</option>
                                    <option value="critical" ${task?.priority === 'critical' ? 'selected' : ''}>Критичний</option>
                                </select>
                            </div>
                        </div>

                        <div class="portal-form-row">
                            <div class="portal-form-group">
                                <label class="portal-label">Тип відповідальності</label>
                                <select id="task-resp-type" class="portal-select" ${isSpecialistSelfEdit || isReadOnly ? 'disabled' : ''}>
                                    <option value="internal" ${task?.responsibility_type !== 'client' ? 'selected' : ''}>Внутрішня команда</option>
                                    <option value="client" ${task?.responsibility_type === 'client' ? 'selected' : ''}>Очікуємо від клієнта</option>
                                </select>
                            </div>

                            <div class="portal-form-group" id="group-assignee-staff" style="${task?.responsibility_type === 'client' ? 'display:none;' : ''}">
                                <label class="portal-label">Виконавець з команди</label>
                                <select id="task-assignee-id" class="portal-select" ${isSpecialistSelfEdit || isReadOnly ? 'disabled' : ''}>
                                    <option value="">-- Не призначено --</option>
                                    ${staffOptions}
                                </select>
                            </div>

                            <div class="portal-form-group" id="group-client-contact" style="${task?.responsibility_type === 'client' ? '' : 'display:none;'}">
                                <label class="portal-label">Контактна особа клієнта</label>
                                <select id="task-client-contact-id" class="portal-select" ${isSpecialistSelfEdit || isReadOnly ? 'disabled' : ''}>
                                    <option value="">-- Оберіть контакт клієнта --</option>
                                    ${contactsOptions}
                                </select>
                            </div>
                        </div>

                        <div class="portal-form-row">
                            <div class="portal-form-group">
                                <label class="portal-label">Етап делівері (Stage)</label>
                                <select id="task-stage-id" class="portal-select" ${isSpecialistSelfEdit || isReadOnly ? 'disabled' : ''}>
                                    <option value="">-- Без прив'язки до етапу --</option>
                                    ${stagesOptions}
                                </select>
                            </div>
                            <div class="portal-form-group">
                                <label class="portal-label">Контрольний пункт (Milestone)</label>
                                <select id="task-milestone-id" class="portal-select" ${isSpecialistSelfEdit || isReadOnly ? 'disabled' : ''}>
                                    <option value="">-- Без прив'язки до milestone --</option>
                                </select>
                            </div>
                        </div>

                        <div class="portal-form-row">
                            <div class="portal-form-group">
                                <label class="portal-label">Дата початку</label>
                                <input type="date" id="task-start-date" class="portal-input" value="${task?.start_date || ''}" ${isSpecialistSelfEdit || isReadOnly ? 'disabled' : ''} />
                            </div>
                            <div class="portal-form-group">
                                <label class="portal-label">Крайній термін (Due Date)</label>
                                <input type="date" id="task-due-date" class="portal-input" value="${task?.due_date || ''}" ${isSpecialistSelfEdit || isReadOnly ? 'disabled' : ''} />
                            </div>
                        </div>

                        <div class="portal-form-group">
                            <label class="portal-label">Опис задачі / Хід виконання</label>
                            <textarea id="task-description" class="portal-textarea" style="min-height: 70px;" placeholder="Деталі задачі, очікуваний результат або корисні посилання..." ${isReadOnly ? 'disabled' : ''}>${escapeHtml(task?.description || '')}</textarea>
                        </div>

                        <!-- Dependencies Section -->
                        <div style="background: #0E1526; padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-bottom: 14px;">
                            <div style="font-size: 0.82rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                                <i data-lucide="link-2" style="width: 14px; height: 14px; color: var(--color-primary);"></i>
                                Залежності задач (Task Dependencies)
                            </div>
                            <div style="font-size: 0.76rem; color: var(--text-muted); margin-bottom: 10px;">
                                Вкажіть задачі цього проєкту, після яких має виконуватися ця задача (Depends on).
                            </div>

                            <div class="portal-form-group" style="margin-bottom: 0;">
                                <select id="task-dependencies-select" class="portal-select" multiple style="height: 85px; font-size: 0.82rem;" ${isSpecialistSelfEdit || isReadOnly ? 'disabled' : ''}>
                                    ${dependsOptions}
                                </select>
                                <span style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px; display: block;">
                                    (Утримуйте Ctrl / Cmd для вибору кількох залежностей)
                                </span>
                            </div>

                            ${blockingOthers.length > 0 ? `
                                <div style="margin-top: 10px; font-size: 0.76rem; color: var(--color-warning);">
                                    <i data-lucide="alert-circle" style="width: 12px; height: 12px; vertical-align: middle;"></i> 
                                    Ця задача блокує виконання <strong>${blockingOthers.length}</strong> інших задач.
                                </div>
                            ` : ""}
                        </div>

                        <div style="background: #131B2F; padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                            <label style="display: flex; align-items: center; gap: 10px; font-size: 0.85rem; ${isSpecialistSelfEdit || isReadOnly ? 'cursor: not-allowed; opacity: 0.6;' : 'cursor: pointer;'}">
                                <input type="checkbox" id="task-is-client-visible" ${task ? (task.is_client_visible ? 'checked' : '') : ''} ${isSpecialistSelfEdit || isReadOnly ? 'disabled' : ''} />
                                <span><strong>Видно клієнту</strong></span>
                            </label>
                        </div>

                        ${isEdit && task?.id ? `
                            <div id="client-action-management-container" style="${task.responsibility_type === 'client' ? '' : 'display:none;'} margin-top: 14px; background: #0E1526; padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <div style="font-size:0.85rem; font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:6px;">
                                        <i data-lucide="key" style="width:14px; height:14px; color:var(--color-primary);"></i>
                                        Клієнтська дія (Magic Link & Submission)
                                    </div>
                                    <span class="portal-spinner" style="width:14px; height:14px; border-width:2px;"></span>
                                </div>
                            </div>
                        ` : ''}

                        <div id="task-modal-error" style="color: var(--color-danger); font-size: 0.82rem; margin-top: 10px; display: none;"></div>
                    </div>

                    <div class="portal-modal-footer">
                        <button type="button" class="btn btn-outline" id="btn-cancel-task-modal">${isReadOnly ? "Закрити" : "Скасувати"}</button>
                        ${!isReadOnly ? `
                            <button type="submit" class="btn btn-primary" id="btn-submit-task-modal">
                                <i data-lucide="check"></i> ${isEdit ? "Зберегти зміни" : "Створити задачу"}
                            </button>
                        ` : ''}
                    </div>
                </form>
            </div>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Populate milestones dynamically based on selected stage
    const stageSelect = document.getElementById("task-stage-id");
    const milestoneSelect = document.getElementById("task-milestone-id");

    function updateMilestoneOptions() {
        const selectedStageId = stageSelect?.value;
        if (!selectedStageId) {
            milestoneSelect.innerHTML = `<option value="">-- Без прив'язки до milestone --</option>`;
            return;
        }
        const st = stages.find(s => s.id === selectedStageId);
        const msList = st?.milestones || [];
        if (msList.length === 0) {
            milestoneSelect.innerHTML = `<option value="">-- У цьому етапі немає milestones --</option>`;
            return;
        }
        milestoneSelect.innerHTML = `
            <option value="">-- Без прив'язки до milestone --</option>
            ${msList.map(m => `
                <option value="${m.id}" ${task?.milestone_id === m.id ? 'selected' : ''}>
                    ${escapeHtml(m.name)} [${m.status === 'completed' ? 'Виконано' : 'В очікуванні'}]
                </option>
            `).join("")}
        `;
    }
    updateMilestoneOptions();
    stageSelect?.addEventListener("change", updateMilestoneOptions);

    // Dynamic responsibility toggle
    const respTypeSelect = document.getElementById("task-resp-type");
    const staffGroup = document.getElementById("group-assignee-staff");
    const clientContactGroup = document.getElementById("group-client-contact");
    const clientVisibleCb = document.getElementById("task-is-client-visible");

    respTypeSelect?.addEventListener("change", (e) => {
        const caContainer = document.getElementById("client-action-management-container");
        if (e.target.value === "client") {
            if (staffGroup) staffGroup.style.display = "none";
            if (clientContactGroup) clientContactGroup.style.display = "block";
            if (clientVisibleCb) {
                clientVisibleCb.checked = true;
                clientVisibleCb.disabled = true;
            }
            if (caContainer) caContainer.style.display = "block";
        } else {
            if (staffGroup) staffGroup.style.display = "block";
            if (clientContactGroup) clientContactGroup.style.display = "none";
            if (clientVisibleCb) {
                clientVisibleCb.disabled = false;
            }
            if (caContainer) caContainer.style.display = "none";
        }
    });
    if (respTypeSelect?.value === "client" && clientVisibleCb) {
        clientVisibleCb.checked = true;
        clientVisibleCb.disabled = true;
    }

    function closeModal() {
        mount.innerHTML = "";
    }

    document.getElementById("btn-close-task-modal")?.addEventListener("click", closeModal);
    document.getElementById("btn-cancel-task-modal")?.addEventListener("click", closeModal);
    document.getElementById("task-modal-overlay")?.addEventListener("click", (e) => {
        if (e.target.id === "task-modal-overlay") closeModal();
    });

    if (isEdit && task?.id) {
        initClientActionManagementSection(task, canManage, onSuccess);
    }

    const form = document.getElementById("form-task-modal");
    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const status = document.getElementById("task-status")?.value || "backlog";
        const description = document.getElementById("task-description")?.value.trim();
        const errBox = document.getElementById("task-modal-error");
        const btn = document.getElementById("btn-submit-task-modal");

        if (errBox) errBox.style.display = "none";
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="portal-spinner" style="width:14px;height:14px;border-width:2px;"></span> Збереження...`;
        }

        try {
            let res;
            if (isSpecialistSelfEdit) {
                // Specialist updating their own task: send only operational fields
                res = await DataClient.updateTask(task.id, {
                    status,
                    description: description || null
                });
            } else {
                // Full management payload for PM / Admin
                const title = document.getElementById("task-title")?.value.trim();
                const priority = document.getElementById("task-priority")?.value || "medium";
                const responsibility_type = document.getElementById("task-resp-type")?.value || "internal";
                const assignee_user_id = document.getElementById("task-assignee-id")?.value || null;
                const client_contact_id = document.getElementById("task-client-contact-id")?.value || null;
                const stage_id = document.getElementById("task-stage-id")?.value || null;
                const milestone_id = document.getElementById("task-milestone-id")?.value || null;
                const start_date = document.getElementById("task-start-date")?.value || null;
                const due_date = document.getElementById("task-due-date")?.value || null;
                const is_client_visible = responsibility_type === "client" ? true : document.getElementById("task-is-client-visible")?.checked;

                if (!title) {
                    if (btn) btn.disabled = false;
                    return;
                }

                const payload = {
                    project_id: projectId,
                    organization_id: organizationId,
                    title,
                    status,
                    priority,
                    responsibility_type,
                    assignee_user_id: responsibility_type === "client" ? null : assignee_user_id,
                    client_contact_id: responsibility_type === "client" ? client_contact_id : null,
                    stage_id,
                    milestone_id,
                    start_date,
                    due_date,
                    description: description || null,
                    is_client_visible,
                    created_by: PortalAuth.getUserId()
                };

                if (isEdit) {
                    res = await DataClient.updateTask(task.id, payload);
                } else {
                    res = await DataClient.createTask(payload);
                }
            }

            if (res.error) {
                if (errBox) {
                    errBox.textContent = res.error.message;
                    errBox.style.display = "block";
                }
                return;
            }

            const savedTaskId = res.data.id;

            // Sync dependencies (only when user has task management permissions)
            if (!isSpecialistSelfEdit && !isReadOnly) {
                const depSelect = document.getElementById("task-dependencies-select");
                const selectedDepIds = depSelect
                    ? Array.from(depSelect.selectedOptions || []).map(opt => opt.value).filter(Boolean)
                    : [];
                const currentDepIds = taskDeps.map(d => d.depends_on_task_id);
                const toAdd = selectedDepIds.filter(id => !currentDepIds.includes(id));
                const toRemove = taskDeps.filter(d => !selectedDepIds.includes(d.depends_on_task_id));

                for (const dep of toRemove) {
                    await DataClient.removeTaskDependency(dep.id);
                }

                for (const depId of toAdd) {
                    const depRes = await DataClient.addTaskDependency(savedTaskId, depId, projectId, organizationId);
                    if (depRes.error) {
                        console.warn("Dependency add warning:", depRes.error.message);
                    }
                }
            }

            closeModal();
            if (onSuccess) await onSuccess();
        } catch (err) {
            if (errBox) {
                errBox.textContent = err.message;
                errBox.style.display = "block";
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i data-lucide="check"></i> ${isEdit ? "Зберегти зміни" : "Створити задачу"}`;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    });
}

export function openDeleteTaskModal(taskId, taskTitle, onSuccess) {
    const mount = document.getElementById("project-detail-modal-mount") || document.getElementById("portal-tasks-modal-mount");
    if (!mount) return;

    mount.innerHTML = `
        <div class="portal-modal-overlay" id="delete-task-overlay">
            <div class="portal-modal" style="max-width: 420px;">
                <div class="portal-modal-header">
                    <div class="portal-modal-title" style="color: var(--color-danger); display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="alert-triangle"></i> Видалити задачу?
                    </div>
                    <button id="btn-close-delete-task" style="color: var(--text-muted); cursor: pointer; padding: 4px;">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="portal-modal-body">
                    <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5;">
                        Ви дійсно бажаєте видалити задачу <strong>${escapeHtml(taskTitle)}</strong>?
                    </p>
                    <div id="delete-task-error" style="color: var(--color-danger); font-size: 0.82rem; display: none;"></div>
                </div>
                <div class="portal-modal-footer">
                    <button type="button" class="btn btn-outline" id="btn-cancel-delete-task">Скасувати</button>
                    <button type="button" class="btn btn-danger" id="btn-confirm-delete-task" style="background: var(--color-danger); color: #FFF;">
                        <i data-lucide="trash-2"></i> Видалити
                    </button>
                </div>
            </div>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    function closeModal() {
        mount.innerHTML = "";
    }

    document.getElementById("btn-close-delete-task")?.addEventListener("click", closeModal);
    document.getElementById("btn-cancel-delete-task")?.addEventListener("click", closeModal);
    document.getElementById("delete-task-overlay")?.addEventListener("click", (e) => {
        if (e.target.id === "delete-task-overlay") closeModal();
    });

    document.getElementById("btn-confirm-delete-task")?.addEventListener("click", async () => {
        const btn = document.getElementById("btn-confirm-delete-task");
        const errBox = document.getElementById("delete-task-error");

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="portal-spinner" style="width:14px;height:14px;border-width:2px;"></span> Видалення...`;
        }

        try {
            const { error } = await DataClient.deleteTask(taskId);
            if (error) {
                if (errBox) {
                    errBox.textContent = error.message;
                    errBox.style.display = "block";
                }
            } else {
                closeModal();
                if (onSuccess) await onSuccess();
            }
        } catch (err) {
            if (errBox) {
                errBox.textContent = err.message;
                errBox.style.display = "block";
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i data-lucide="trash-2"></i> Видалити`;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    });
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------
export function isTaskOverdue(task) {
    if (!task.due_date || task.status === "done") return false;
    const dueTime = new Date(task.due_date).setHours(23, 59, 59, 999);
    return dueTime < Date.now();
}

export function getBlockingDependencies(taskId, dependencies = []) {
    const directPrereqs = dependencies.filter(d => d.task_id === taskId);
    return directPrereqs.filter(d => d.depends_on_task?.status !== "done");
}

function filterTasksList(tasks, filters) {
    return tasks.filter(t => {
        if (filters.status && filters.status !== "all" && t.status !== filters.status) return false;
        if (filters.priority && filters.priority !== "all" && t.priority !== filters.priority) return false;
        if (filters.responsibility && filters.responsibility !== "all" && t.responsibility_type !== filters.responsibility) return false;
        if (filters.assignee && filters.assignee !== "all" && t.assignee_user_id !== filters.assignee) return false;
        if (filters.overdueOnly && !isTaskOverdue(t)) return false;
        if (filters.search) {
            const s = filters.search.toLowerCase();
            const titleMatch = t.title?.toLowerCase().includes(s);
            const descMatch = t.description?.toLowerCase().includes(s);
            if (!titleMatch && !descMatch) return false;
        }
        return true;
    });
}

export function getTaskStatusLabel(status) {
    switch (status) {
        case "backlog": return "Беклог";
        case "todo": return "До виконання";
        case "in_progress": return "В роботі";
        case "review": return "На перевірці";
        case "waiting_client": return "Очікуємо клієнта";
        case "blocked": return "Заблоковано";
        case "done": return "Виконано";
        default: return status || "—";
    }
}

export function getPriorityLabel(priority) {
    switch (priority) {
        case "low": return "Низький";
        case "medium": return "Середній";
        case "high": return "Високий";
        case "critical": return "Критичний";
        default: return priority || "—";
    }
}

function formatDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("uk-UA", { day: "2-digit", month: "short", year: "numeric" });
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDateTime(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleString("uk-UA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// -----------------------------------------------------------------------------
// Phase 6D.3: Client Action & Magic Link Lifecycle Management Section
// -----------------------------------------------------------------------------
export async function initClientActionManagementSection(task, canManage, onReload) {
    const container = document.getElementById("client-action-management-container");
    if (!container || !task || !task.id) return;

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div style="font-size:0.85rem; font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:6px;">
                <i data-lucide="key" style="width:14px; height:14px; color:var(--color-primary);"></i>
                Клієнтська дія (Magic Link & Submission)
            </div>
            <span class="portal-spinner" style="width:14px; height:14px; border-width:2px;"></span>
        </div>
    `;
    if (window.lucide) window.lucide.createIcons();

    let statusRes, submissionsRes;
    try {
        [statusRes, submissionsRes] = await Promise.all([
            DataClient.getClientActionTokenStatus(task.id),
            DataClient.getTaskSubmissions(task.id)
        ]);
    } catch(err) {
        container.innerHTML = `
            <div style="font-size:0.8rem; color:var(--color-danger);">
                Помилка завантаження даних клієнтської дії: ${escapeHtml(err.message)}
            </div>
        `;
        return;
    }

    const tokenData = statusRes?.data || { status: "none", is_completed: false };
    const submissions = submissionsRes?.data || [];
    const currentStatus = tokenData.status || "none";

    let badgeHtml = "";
    let statusDesc = "";
    let actionsHtml = "";

    switch (currentStatus) {
        case "done":
            badgeHtml = `<span class="portal-badge" style="background: rgba(16, 185, 129, 0.15); color: #34D399;"><i data-lucide="check-circle-2" style="width:11px; height:11px;"></i> Виконано</span>`;
            statusDesc = `Дію успішно виконано клієнтом${tokenData.completed_at ? ` (${formatDate(tokenData.completed_at)})` : ""}.`;
            if (canManage) {
                actionsHtml = `
                    <button type="button" class="btn btn-sm btn-outline-warning" id="btn-ca-reopen" style="display:inline-flex; align-items:center; gap:6px; font-size:0.8rem;">
                        <i data-lucide="rotate-ccw" style="width:13px; height:13px;"></i> Повернути в роботу (Reopen)
                    </button>
                `;
            }
            break;

        case "active":
            badgeHtml = `<span class="portal-badge" style="background: rgba(59, 130, 246, 0.15); color: #60A5FA;"><i data-lucide="clock" style="width:11px; height:11px;"></i> Активне</span>`;
            statusDesc = `Посилання активне (дійсне до ${formatDate(tokenData.expires_at)}).`;
            if (canManage) {
                actionsHtml = `
                    <button type="button" class="btn btn-sm btn-outline" id="btn-ca-regenerate" style="display:inline-flex; align-items:center; gap:6px; font-size:0.8rem;">
                        <i data-lucide="refresh-cw" style="width:13px; height:13px;"></i> Перевипустити посилання
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-danger" id="btn-ca-revoke" style="display:inline-flex; align-items:center; gap:6px; font-size:0.8rem; margin-left:8px;">
                        <i data-lucide="slash" style="width:13px; height:13px;"></i> Відкликати
                    </button>
                `;
            }
            break;

        case "expired":
            badgeHtml = `<span class="portal-badge" style="background: rgba(239, 68, 68, 0.15); color: #F87171;"><i data-lucide="alert-circle" style="width:11px; height:11px;"></i> Прострочено</span>`;
            statusDesc = `14-денний термін дії посилання вичерпано (${formatDate(tokenData.expires_at)}).`;
            if (canManage) {
                actionsHtml = `
                    <button type="button" class="btn btn-sm btn-primary" id="btn-ca-regenerate" style="display:inline-flex; align-items:center; gap:6px; font-size:0.8rem;">
                        <i data-lucide="refresh-cw" style="width:13px; height:13px;"></i> Створити нове посилання
                    </button>
                `;
            }
            break;

        case "revoked":
            badgeHtml = `<span class="portal-badge" style="background: rgba(239, 68, 68, 0.15); color: #F87171;"><i data-lucide="slash" style="width:11px; height:11px;"></i> Відкликано</span>`;
            statusDesc = `Попереднє посилання було відкликано менеджером.`;
            if (canManage) {
                actionsHtml = `
                    <button type="button" class="btn btn-sm btn-primary" id="btn-ca-regenerate" style="display:inline-flex; align-items:center; gap:6px; font-size:0.8rem;">
                        <i data-lucide="refresh-cw" style="width:13px; height:13px;"></i> Створити нове посилання
                    </button>
                `;
            }
            break;

        case "none":
        default:
            badgeHtml = `<span class="portal-badge" style="background: rgba(148, 163, 184, 0.15); color: #94A3B8;"><i data-lucide="link" style="width:11px; height:11px;"></i> Не згенеровано</span>`;
            statusDesc = `Посилання для клієнта ще не згенеровано. Створіть одноразовий Magic Link для виконання цієї дії без реєстрації.`;
            if (canManage) {
                actionsHtml = `
                    <button type="button" class="btn btn-sm btn-primary" id="btn-ca-generate" style="display:inline-flex; align-items:center; gap:6px; font-size:0.8rem;">
                        <i data-lucide="link" style="width:13px; height:13px;"></i> Згенерувати Magic Link
                    </button>
                `;
            }
            break;
    }

    // Render submission history HTML
    let submissionsHtml = "";
    if (submissions && submissions.length > 0) {
        submissionsHtml = `
            <div style="margin-top: 16px; border-top: 1px solid var(--border-color); padding-top: 14px;">
                <div style="font-weight: 700; font-size: 0.82rem; color: var(--text-primary); margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                    <i data-lucide="history" style="width: 13px; height: 13px; color: var(--color-primary);"></i>
                    <span>Отримані відповіді клієнта (${submissions.length})</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${submissions.map((sub, idx) => {
                        const isPublic = sub.submission_type === "public_link";
                        const channelBadge = isPublic
                            ? `<span class="portal-badge" style="background: rgba(139, 92, 246, 0.15); color: #A78BFA; font-size: 0.7rem;"><i data-lucide="globe" style="width: 10px; height: 10px;"></i> Публічне посилання</span>`
                            : `<span class="portal-badge" style="background: rgba(59, 130, 246, 0.15); color: #60A5FA; font-size: 0.7rem;"><i data-lucide="shield" style="width: 10px; height: 10px;"></i> Клієнтський портал</span>`;
                        const atts = Array.isArray(sub.attachments) ? sub.attachments : [];
                        return `
                            <div style="background: #111827; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 6px;">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span style="font-size: 0.75rem; font-weight: 700; color: #94A3B8;">#${idx + 1}</span>
                                        ${channelBadge}
                                        <span style="font-size: 0.78rem; color: var(--text-muted);">${formatDateTime(sub.created_at)}</span>
                                    </div>
                                    <div style="font-size: 0.75rem; color: #CBD5E1;">
                                        <i data-lucide="user" style="width: 10px; height: 10px; vertical-align: middle;"></i> ${escapeHtml(sub.submitted_by_contact_name || sub.submitted_by_user_name || 'Клієнт')}
                                    </div>
                                </div>
                                <div style="background: #1A233A; padding: 10px; border-radius: 4px; font-size: 0.82rem; color: var(--text-primary); white-space: pre-wrap; line-height: 1.4;">${escapeHtml(sub.payload?.text || '—')}</div>
                                ${atts.length > 0 ? `
                                    <div style="margin-top: 8px;">
                                        <div style="font-size: 0.74rem; font-weight: 600; color: #94A3B8; margin-bottom: 4px;">Додані файли (${atts.length}):</div>
                                        <div style="display: flex; flex-direction: column; gap: 4px;">
                                            ${atts.map(att => `
                                                <div style="display: flex; align-items: center; justify-content: space-between; background: #0E1526; border: 1px solid #1E293B; border-radius: 4px; padding: 6px 10px; font-size: 0.78rem;">
                                                    <span style="color: #60A5FA; display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 320px;">
                                                        <i data-lucide="file-text" style="width: 12px; height: 12px; flex-shrink: 0;"></i>
                                                        ${escapeHtml(att.name)}
                                                    </span>
                                                    <div style="display: flex; align-items: center; gap: 8px;">
                                                        <span style="color: #64748B; font-size: 0.72rem;">${formatBytes(att.size)}</span>
                                                        ${att.path ? `
                                                            <button type="button" class="btn-download-att" data-path="${escapeHtml(att.path)}" style="background: none; border: none; color: var(--color-primary); cursor: pointer; padding: 2px;" title="Завантажити">
                                                                <i data-lucide="download" style="width: 12px; height: 12px;"></i>
                                                            </button>
                                                        ` : ''}
                                                    </div>
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="font-size:0.85rem; font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:6px;">
                <i data-lucide="key" style="width:14px; height:14px; color:var(--color-primary);"></i>
                Клієнтська дія (Magic Link & Submission)
            </div>
            <div>${badgeHtml}</div>
        </div>
        <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:12px; line-height:1.4;">${statusDesc}</p>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            ${actionsHtml}
        </div>
        <div id="ca-error-box" style="display:none; color:var(--color-danger); font-size:0.8rem; margin-top:8px;"></div>
        ${submissionsHtml}
    `;

    if (window.lucide) window.lucide.createIcons();

    const errBox = document.getElementById("ca-error-box");
    function showCaError(msg) {
        if (errBox) {
            errBox.textContent = msg;
            errBox.style.display = "block";
        }
    }

    // Attachment download buttons
    container.querySelectorAll(".btn-download-att").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const p = btn.getAttribute("data-path");
            if (!p) return;
            try {
                const { data: signedUrl, error } = await DataClient.getClientActionAttachmentUrl(p);
                if (error || !signedUrl) throw error || new Error("Помилка завантаження");
                window.open(signedUrl, "_blank");
            } catch(err) {
                showCaError(err.message || "Не вдалося отримати посилання на файл");
            }
        });
    });

    // 1. Generate Handler
    const genBtn = document.getElementById("btn-ca-generate");
    genBtn?.addEventListener("click", async () => {
        genBtn.disabled = true;
        genBtn.innerHTML = `<span class="portal-spinner" style="width:12px;height:12px;border-width:2px;"></span> Генерація...`;
        if (errBox) errBox.style.display = "none";

        try {
            const { data, error } = await DataClient.generateClientActionToken(task.id);
            if (error || !data?.success) throw error || new Error(error?.message || "Не вдалося створити посилання");

            showOneTimeRevealModal(data.raw_token, data.public_url, () => {
                initClientActionManagementSection(task, canManage, onReload);
                if (onReload) onReload();
            });
        } catch(err) {
            showCaError(err.message || "Помилка при генерації посилання");
            genBtn.disabled = false;
            genBtn.innerHTML = `<i data-lucide="link" style="width:13px; height:13px;"></i> Згенерувати Magic Link`;
            if (window.lucide) window.lucide.createIcons();
        }
    });

    // 2. Regenerate Handler
    const regenBtn = document.getElementById("btn-ca-regenerate");
    regenBtn?.addEventListener("click", async () => {
        if (currentStatus === "active") {
            const confirmed = window.confirm("Попереднє посилання буде негайно анульовано. Створити нове посилання для клієнта?");
            if (!confirmed) return;
        }
        regenBtn.disabled = true;
        regenBtn.innerHTML = `<span class="portal-spinner" style="width:12px;height:12px;border-width:2px;"></span> Створення...`;
        if (errBox) errBox.style.display = "none";

        try {
            const { data, error } = await DataClient.regenerateClientActionToken(task.id);
            if (error || !data?.success) throw error || new Error(error?.message || "Не вдалося перевипустити посилання");

            showOneTimeRevealModal(data.raw_token, data.public_url, () => {
                initClientActionManagementSection(task, canManage, onReload);
                if (onReload) onReload();
            });
        } catch(err) {
            showCaError(err.message || "Помилка при перевипуску посилання");
            regenBtn.disabled = false;
            regenBtn.innerHTML = `<i data-lucide="refresh-cw" style="width:13px; height:13px;"></i> Перевипустити посилання`;
            if (window.lucide) window.lucide.createIcons();
        }
    });

    // 3. Revoke Handler
    const revokeBtn = document.getElementById("btn-ca-revoke");
    revokeBtn?.addEventListener("click", async () => {
        const confirmed = window.confirm("Ви впевнені, що хочете відкликати це посилання? Клієнт більше не зможе відкрити форму.");
        if (!confirmed) return;

        revokeBtn.disabled = true;
        revokeBtn.innerHTML = `<span class="portal-spinner" style="width:12px;height:12px;border-width:2px;"></span> Відкликання...`;
        if (errBox) errBox.style.display = "none";

        try {
            const { data, error } = await DataClient.revokeClientActionToken(task.id);
            if (error || !data?.success) throw error || new Error(error?.message || "Не вдалося відкликати посилання");

            await initClientActionManagementSection(task, canManage, onReload);
            if (onReload) onReload();
        } catch(err) {
            showCaError(err.message || "Помилка при відкликанні посилання");
            revokeBtn.disabled = false;
            revokeBtn.innerHTML = `<i data-lucide="slash" style="width:13px; height:13px;"></i> Відкликати`;
            if (window.lucide) window.lucide.createIcons();
        }
    });

    // 4. Reopen Handler (Canonical Precedence Rule: Виконано -> Reopen -> Не згенеровано)
    const reopenBtn = document.getElementById("btn-ca-reopen");
    reopenBtn?.addEventListener("click", async () => {
        const confirmed = window.confirm("Повернути клієнтську дію в роботу? Задача повернеться в статус «До виконання», а всі попередні відповіді збережуться в історії.");
        if (!confirmed) return;

        reopenBtn.disabled = true;
        reopenBtn.innerHTML = `<span class="portal-spinner" style="width:12px;height:12px;border-width:2px;"></span> Відновлення...`;
        if (errBox) errBox.style.display = "none";

        try {
            const { data, error } = await DataClient.reopenClientAction(task.id);
            if (error || !data?.success) throw error || new Error(error?.message || "Не вдалося повернути дію в роботу");

            task.status = "todo";
            task.completed_at = null;
            const statusSelect = document.getElementById("task-status");
            if (statusSelect) statusSelect.value = "todo";

            await initClientActionManagementSection(task, canManage, onReload);
            if (onReload) onReload();
        } catch(err) {
            showCaError(err.message || "Помилка при поверненні дії в роботу");
            reopenBtn.disabled = false;
            reopenBtn.innerHTML = `<i data-lucide="rotate-ccw" style="width:13px; height:13px;"></i> Повернути в роботу (Reopen)`;
            if (window.lucide) window.lucide.createIcons();
        }
    });
}

export function showOneTimeRevealModal(rawToken, publicUrl, onClosed) {
    let transientToken = rawToken;
    const origin = window.location.origin;
    const pathname = window.location.pathname.endsWith('/') ? window.location.pathname : window.location.pathname + '/';
    const fullUrl = `${origin}${pathname}#/action/${transientToken}`;

    const modalEl = document.createElement("div");
    modalEl.id = "modal-one-time-reveal";
    modalEl.className = "portal-modal-overlay";
    modalEl.style.zIndex = "9999";
    modalEl.innerHTML = `
        <div class="portal-modal" style="max-width: 560px; background: #0F172A; border: 1px solid #334155; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.6);">
            <div class="portal-modal-header" style="border-bottom: 1px solid #1E293B;">
                <div class="portal-modal-title" style="display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="shield-check" style="color: #38BDF8; width: 20px; height: 20px;"></i>
                    <span>Одноразове посилання для клієнта (Magic Link)</span>
                </div>
                <button id="btn-close-reveal-modal" style="color: var(--text-muted); cursor: pointer; padding: 4px; background: none; border: none;">
                    <i data-lucide="x"></i>
                </button>
            </div>
            <div class="portal-modal-body" style="padding: 20px;">
                <p style="font-size: 0.85rem; color: #94A3B8; margin-bottom: 14px; line-height: 1.5;">
                    Надішліть це посилання клієнту. За ним клієнт зможе переглянути вимоги, надати відповідь та прикріпити необхідні файли без авторизації.
                </p>
                <div style="margin-bottom: 16px;">
                    <label class="portal-label" style="font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748B;">Посилання для клієнта</label>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <input type="text" id="reveal-url-input" class="portal-input" value="${escapeHtml(fullUrl)}" readonly style="font-family: monospace; font-size: 0.82rem; background: #090D16; color: #38BDF8; border-color: #334155;" />
                        <button type="button" class="btn btn-primary" id="btn-copy-magic-link" style="white-space: nowrap; display: flex; align-items: center; gap: 6px;">
                            <i data-lucide="copy" style="width: 14px; height: 14px;"></i> <span>Копіювати</span>
                        </button>
                    </div>
                </div>
                <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: var(--radius-sm); padding: 12px; font-size: 0.82rem; color: #FCD34D; display: flex; align-items: flex-start; gap: 8px; line-height: 1.4;">
                    <i data-lucide="alert-triangle" style="width: 16px; height: 16px; flex-shrink: 0; margin-top: 2px;"></i>
                    <span><strong>Скопіюйте посилання зараз.</strong> З міркувань безпеки після закриття цього вікна повна адреса більше ніколи не відображатиметься (у системі зберігається лише SHA-256 хеш).</span>
                </div>
            </div>
            <div class="portal-modal-footer" style="border-top: 1px solid #1E293B; display: flex; justify-content: flex-end;">
                <button type="button" class="btn btn-primary" id="btn-done-reveal-modal">Зрозуміло, закрити</button>
            </div>
        </div>
    `;
    document.body.appendChild(modalEl);
    if (window.lucide) window.lucide.createIcons();

    const copyBtn = document.getElementById("btn-copy-magic-link");
    const urlInput = document.getElementById("reveal-url-input");
    copyBtn?.addEventListener("click", async () => {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(fullUrl);
            } else {
                urlInput.select();
                document.execCommand("copy");
            }
            copyBtn.innerHTML = `<i data-lucide="check" style="width:14px;height:14px;"></i> <span>Скопійовано!</span>`;
            copyBtn.style.background = "#10B981";
            if (window.lucide) window.lucide.createIcons();
            setTimeout(() => {
                copyBtn.innerHTML = `<i data-lucide="copy" style="width:14px;height:14px;"></i> <span>Копіювати</span>`;
                copyBtn.style.background = "";
                if (window.lucide) window.lucide.createIcons();
            }, 2500);
        } catch(err) {
            urlInput.select();
        }
    });

    function destroyRevealModal() {
        transientToken = null; // Memory wiped
        modalEl.remove();
        window.removeEventListener("keydown", handleEsc);
        if (onClosed) onClosed();
    }

    function handleEsc(e) {
        if (e.key === "Escape") destroyRevealModal();
    }

    document.getElementById("btn-close-reveal-modal")?.addEventListener("click", destroyRevealModal);
    document.getElementById("btn-done-reveal-modal")?.addEventListener("click", destroyRevealModal);
    modalEl.addEventListener("click", (e) => {
        if (e.target.id === "modal-one-time-reveal") destroyRevealModal();
    });
    window.addEventListener("keydown", handleEsc);
}

