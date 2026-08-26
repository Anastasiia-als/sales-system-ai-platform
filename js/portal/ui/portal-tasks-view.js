/* js/portal/ui/portal-tasks-view.js - Standalone 'My Tasks' Workspace */

import { DataClient } from "../api/data-client.js";
import { PortalAuth } from "../auth/auth-service.js";
import { isTaskOverdue, getTaskStatusLabel, getPriorityLabel, openTaskModal, openDeleteTaskModal } from "./portal-project-tasks-view.js";

let myTasksFilters = {
    status: "all",
    priority: "all",
    search: "",
    overdueOnly: false
};

export function renderTasksView() {
    return `
        <div class="portal-content" id="my-tasks-container">
            <div class="portal-loading-container">
                <div class="portal-spinner"></div>
                <span>Завантаження моїх задач...</span>
            </div>
        </div>

        <div id="portal-tasks-modal-mount"></div>
    `;
}

export async function initTasksViewEvents() {
    await loadMyTasks();
}

async function loadMyTasks() {
    const container = document.getElementById("my-tasks-container");
    if (!container) return;

    const currentUserId = PortalAuth.getUserId();
    if (!currentUserId) {
        container.innerHTML = `
            <div class="portal-empty-state">
                <div class="portal-empty-title">Необхідно авторизуватися</div>
            </div>
        `;
        return;
    }

    try {
        const { data: rawTasks, error } = await DataClient.getMyTasks(currentUserId, myTasksFilters);
        const tasks = rawTasks || [];

        const totalAssigned = tasks.length;
        const inProgressCount = tasks.filter(t => t.status === "in_progress" || t.status === "todo").length;
        const overdueCount = tasks.filter(t => isTaskOverdue(t)).length;
        const doneCount = tasks.filter(t => t.status === "done").length;

        const filteredTasks = tasks.filter(t => {
            if (myTasksFilters.overdueOnly && !isTaskOverdue(t)) return false;
            return true;
        });

        container.innerHTML = `
            <!-- Top View Header -->
            <div class="portal-view-header">
                <div class="portal-view-title-group">
                    <h1 class="portal-view-title">Мої задачі</h1>
                    <p class="portal-view-subtitle">Усі задачі, призначені вам у проєктах</p>
                </div>
            </div>

            <!-- Stats Bar -->
            <div class="portal-kpi-row">
                <div class="portal-kpi-card">
                    <div class="portal-kpi-value">${totalAssigned}</div>
                    <div class="portal-kpi-label">Призначено</div>
                </div>
                <div class="portal-kpi-card">
                    <div class="portal-kpi-value">${inProgressCount}</div>
                    <div class="portal-kpi-label">В роботі</div>
                </div>
                <div class="portal-kpi-card portal-kpi-card-warning">
                    <div class="portal-kpi-value">${overdueCount}</div>
                    <div class="portal-kpi-label">Прострочені</div>
                </div>
                <div class="portal-kpi-card portal-kpi-card-success">
                    <div class="portal-kpi-value">${doneCount}</div>
                    <div class="portal-kpi-label">Виконано</div>
                </div>
            </div>

            <!-- Toolbar & Filter Tabs -->
            <div class="portal-tasks-filter-bar">
                <div class="portal-search-box" style="flex: 1; min-width: 220px;">
                    <i data-lucide="search" style="width: 14px; height: 14px; color: var(--text-muted);"></i>
                    <input type="text" id="my-task-search-input" class="portal-search-input" placeholder="Пошук моїх задач..." value="${escapeHtml(myTasksFilters.search)}" />
                </div>

                <select id="my-task-filter-status" class="portal-select-sm">
                    <option value="all" ${myTasksFilters.status === 'all' ? 'selected' : ''}>Всі статуси</option>
                    <option value="todo" ${myTasksFilters.status === 'todo' ? 'selected' : ''}>До виконання</option>
                    <option value="in_progress" ${myTasksFilters.status === 'in_progress' ? 'selected' : ''}>В роботі</option>
                    <option value="review" ${myTasksFilters.status === 'review' ? 'selected' : ''}>На перевірці</option>
                    <option value="waiting_client" ${myTasksFilters.status === 'waiting_client' ? 'selected' : ''}>Очікуємо клієнта</option>
                    <option value="done" ${myTasksFilters.status === 'done' ? 'selected' : ''}>Виконано</option>
                </select>

                <select id="my-task-filter-priority" class="portal-select-sm">
                    <option value="all" ${myTasksFilters.priority === 'all' ? 'selected' : ''}>Всі пріоритети</option>
                    <option value="critical" ${myTasksFilters.priority === 'critical' ? 'selected' : ''}>Критичний</option>
                    <option value="high" ${myTasksFilters.priority === 'high' ? 'selected' : ''}>Високий</option>
                    <option value="medium" ${myTasksFilters.priority === 'medium' ? 'selected' : ''}>Середній</option>
                    <option value="low" ${myTasksFilters.priority === 'low' ? 'selected' : ''}>Низький</option>
                </select>

                <button class="btn btn-sm ${myTasksFilters.overdueOnly ? 'btn-danger' : 'btn-outline'}" id="btn-my-task-toggle-overdue" style="padding: 5px 10px; font-size: 0.78rem;">
                    <i data-lucide="clock" style="width: 12px; height: 12px;"></i> Тільки прострочені
                </button>
            </div>

            <!-- Tasks Table / Empty -->
            <div style="margin-top: 16px;">
                ${filteredTasks.length === 0 ? `
                    <div class="portal-placeholder-box" style="padding: 50px 20px;">
                        <div class="portal-empty-icon" style="color: var(--color-primary);"><i data-lucide="check-circle-2"></i></div>
                        <div class="portal-empty-title">Немає призначених задач</div>
                        <div class="portal-empty-desc">
                            ${tasks.length === 0 ? "У вас немає активних задач, призначених на ваш акаунт. Перейдіть до ваших проєктів, щоб переглянути загальні задачі команди." : "Жодна задача не відповідає вибраним фільтрам."}
                        </div>
                        <a href="#/portal/projects" class="btn btn-primary" style="margin-top: 12px;">
                            <i data-lucide="folder"></i> До моїх проєктів
                        </a>
                    </div>
                ` : `
                    <div class="portal-task-list-table">
                        <div class="portal-task-list-header">
                            <div style="width: 38px;"></div>
                            <div style="flex: 2; min-width: 220px;">Задача</div>
                            <div style="width: 160px;">Проєкт / Клієнт</div>
                            <div style="width: 130px;">Статус</div>
                            <div style="width: 95px;">Пріоритет</div>
                            <div style="width: 140px;">Дедлайн</div>
                        </div>
                        <div class="portal-task-list-body">
                            ${filteredTasks.map(t => renderMyTaskRow(t)).join("")}
                        </div>
                    </div>
                `}
            </div>
        `;

        if (window.lucide) window.lucide.createIcons();
        bindMyTasksEvents();
    } catch (err) {
        container.innerHTML = `
            <div class="portal-empty-state">
                <div class="portal-empty-title" style="color: var(--color-danger);">Помилка завантаження задач</div>
                <div class="portal-empty-desc">${err.message}</div>
            </div>
        `;
    }
}

function renderMyTaskRow(task) {
    const isDone = task.status === "done";
    const isOverdue = isTaskOverdue(task);
    const dueDateFormatted = task.due_date ? formatDate(task.due_date) : null;
    const projectName = task.project?.name || task.project?.title || "Проєкт";

    return `
        <div class="portal-task-row ${isDone ? 'task-row-done' : ''}" data-task-id="${task.id}">
            <div style="width: 38px; display: flex; align-items: center; justify-content: center;">
                <label class="portal-checkbox-label">
                    <input type="checkbox" class="portal-my-task-status-cb" data-task-id="${task.id}" ${isDone ? 'checked' : ''} />
                    <span class="portal-custom-checkbox"></span>
                </label>
            </div>

            <div style="flex: 2; min-width: 220px; display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <span class="portal-task-title ${isDone ? 'task-title-done' : ''}" style="font-weight: 600; color: var(--text-primary);">
                        ${escapeHtml(task.title)}
                    </span>
                    ${isOverdue ? `
                        <span class="portal-badge portal-badge-overdue">
                            <i data-lucide="alert-circle" style="width: 10px; height: 10px;"></i> Прострочено
                        </span>
                    ` : ""}
                </div>
                ${task.description ? `
                    <div style="font-size: 0.76rem; color: var(--text-muted); line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 440px;">
                        ${escapeHtml(task.description)}
                    </div>
                ` : ""}
            </div>

            <div style="width: 160px; display: flex; flex-direction: column; gap: 2px;">
                <a href="#/portal/projects/${task.project_id}" style="font-size: 0.82rem; font-weight: 600; color: var(--color-primary); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    <i data-lucide="folder" style="width: 12px; height: 12px; vertical-align: middle;"></i> ${escapeHtml(projectName)}
                </a>
                ${task.project?.organizations?.name ? `
                    <span style="font-size: 0.74rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${escapeHtml(task.project.organizations.name)}
                    </span>
                ` : ""}
            </div>

            <div style="width: 130px;">
                <select class="portal-select-inline my-task-status-select" data-task-id="${task.id}">
                    <option value="backlog" ${task.status === 'backlog' ? 'selected' : ''}>Беклог</option>
                    <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>До виконання</option>
                    <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>В роботі</option>
                    <option value="review" ${task.status === 'review' ? 'selected' : ''}>На перевірці</option>
                    <option value="waiting_client" ${task.status === 'waiting_client' ? 'selected' : ''}>Очікуємо клієнта</option>
                    <option value="blocked" ${task.status === 'blocked' ? 'selected' : ''}>Заблоковано</option>
                    <option value="done" ${task.status === 'done' ? 'selected' : ''}>Виконано</option>
                </select>
            </div>

            <div style="width: 95px;">
                <span class="portal-badge portal-badge-priority-${task.priority}">
                    ${getPriorityLabel(task.priority)}
                </span>
            </div>

            <div style="width: 140px;">
                ${dueDateFormatted ? `
                    <span style="font-size: 0.78rem; color: ${isOverdue ? 'var(--color-danger)' : 'var(--text-secondary)'}; display: inline-flex; align-items: center; gap: 4px;">
                        <i data-lucide="calendar" style="width: 12px; height: 12px;"></i> ${dueDateFormatted}
                    </span>
                ` : `<span style="font-size: 0.76rem; color: var(--text-muted);">Без дедлайну</span>`}
            </div>
        </div>
    `;
}

function bindMyTasksEvents() {
    const searchInput = document.getElementById("my-task-search-input");
    searchInput?.addEventListener("input", (e) => {
        myTasksFilters.search = e.target.value.trim();
        loadMyTasks();
    });

    document.getElementById("my-task-filter-status")?.addEventListener("change", (e) => {
        myTasksFilters.status = e.target.value;
        loadMyTasks();
    });

    document.getElementById("my-task-filter-priority")?.addEventListener("change", (e) => {
        myTasksFilters.priority = e.target.value;
        loadMyTasks();
    });

    document.getElementById("btn-my-task-toggle-overdue")?.addEventListener("click", () => {
        myTasksFilters.overdueOnly = !myTasksFilters.overdueOnly;
        loadMyTasks();
    });

    // Checkbox status toggle
    document.querySelectorAll(".portal-my-task-status-cb").forEach(cb => {
        cb.addEventListener("change", async () => {
            const taskId = cb.getAttribute("data-task-id");
            const newStatus = cb.checked ? "done" : "todo";
            cb.disabled = true;
            try {
                await DataClient.toggleTaskStatus(taskId, newStatus);
                await loadMyTasks();
            } catch (err) {
                console.error("Failed to toggle task status:", err);
                cb.disabled = false;
            }
        });
    });

    // Dropdown status toggle
    document.querySelectorAll(".my-task-status-select").forEach(sel => {
        sel.addEventListener("change", async () => {
            const taskId = sel.getAttribute("data-task-id");
            const newStatus = sel.value;
            sel.disabled = true;
            try {
                await DataClient.toggleTaskStatus(taskId, newStatus);
                await loadMyTasks();
            } catch (err) {
                console.error("Failed to change task status:", err);
                sel.disabled = false;
            }
        });
    });
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
