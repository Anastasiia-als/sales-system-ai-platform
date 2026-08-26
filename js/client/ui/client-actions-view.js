/* js/client/ui/client-actions-view.js - Global Client Action Center */

import { DataClient } from "../../portal/api/data-client.js";

let selectedView = "active";
let selectedProjectId = "all";
let searchKeyword = "";

export function renderClientActionsView(actions = [], projects = [], currentFilter = {}) {
    selectedView = currentFilter.view || selectedView || "active";
    selectedProjectId = currentFilter.projectId || selectedProjectId || "all";
    searchKeyword = currentFilter.search || "";

    const activeCount = actions.filter(a => a.status !== "done").length;
    const now = new Date();
    const overdueCount = actions.filter(a => a.status !== "done" && a.due_date && new Date(a.due_date) < now).length;
    const completedCount = actions.filter(a => a.status === "done").length;
    const totalCount = actions.length;

    // Filtered actions for display
    let displayedActions = [...actions];
    if (selectedView === "active") {
        displayedActions = displayedActions.filter(a => a.status !== "done");
    } else if (selectedView === "overdue") {
        displayedActions = displayedActions.filter(a => a.status !== "done" && a.due_date && new Date(a.due_date) < now);
    } else if (selectedView === "completed") {
        displayedActions = displayedActions.filter(a => a.status === "done");
    }

    if (selectedProjectId !== "all") {
        displayedActions = displayedActions.filter(a => a.project_id === selectedProjectId);
    }

    if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        displayedActions = displayedActions.filter(a => 
            (a.title && a.title.toLowerCase().includes(kw)) ||
            (a.description && a.description.toLowerCase().includes(kw))
        );
    }

    return `
        <div class="client-container">
            <!-- Header -->
            <div class="client-section-header" style="margin-bottom: 24px;">
                <div>
                    <h1 class="client-page-title">Очікуємо від вас (Action Center)</h1>
                    <p class="client-page-subtitle">Єдиний центр дій, погоджень та матеріалів, необхідних для просування ваших проєктів.</p>
                </div>
            </div>

            <!-- Filter Tabs & Controls Bar -->
            <div class="client-card" style="margin-bottom: 20px; padding: 16px;">
                <div class="client-actions-filter-bar">
                    <!-- Views Tabs -->
                    <div class="client-filter-pills" id="client-action-pills">
                        <button class="client-filter-pill ${selectedView === 'active' ? 'active' : ''}" data-view="active">
                            Активні (${activeCount})
                        </button>
                        <button class="client-filter-pill ${selectedView === 'overdue' ? 'active' : ''}" data-view="overdue">
                            Прострочені (${overdueCount})
                        </button>
                        <button class="client-filter-pill ${selectedView === 'completed' ? 'active' : ''}" data-view="completed">
                            Виконані (${completedCount})
                        </button>
                        <button class="client-filter-pill ${selectedView === 'all' ? 'active' : ''}" data-view="all">
                            Усі (${totalCount})
                        </button>
                    </div>

                    <!-- Search and Project Dropdown -->
                    <div class="client-actions-search-row">
                        <div class="client-search-input-wrap">
                            <i data-lucide="search" class="client-search-icon"></i>
                            <input type="text" id="input-client-action-search" class="client-search-input" placeholder="Пошук дії..." value="${escapeHtml(searchKeyword)}" />
                        </div>

                        ${projects.length > 1 ? `
                            <select id="select-client-action-project" class="client-select-input">
                                <option value="all" ${selectedProjectId === 'all' ? 'selected' : ''}>Всі проєкти</option>
                                ${projects.map(p => `
                                    <option value="${p.id}" ${selectedProjectId === p.id ? 'selected' : ''}>
                                        ${escapeHtml(p.name || p.title)}
                                    </option>
                                `).join("")}
                            </select>
                        ` : ''}
                    </div>
                </div>
            </div>

            <!-- Actions List -->
            ${displayedActions.length === 0 ? `
                <div class="client-card" style="text-align: center; padding: 60px 20px;">
                    <div class="portal-empty-icon" style="color: var(--color-success); margin-bottom: 16px;">
                        <i data-lucide="check-circle-2" style="width: 48px; height: 48px;"></i>
                    </div>
                    <h3 style="font-size: 1.15rem; font-weight: 600; margin-bottom: 8px;">
                        ${selectedView === 'completed' ? 'Немає виконаних дій' : 'Зараз від вас нічого не очікується'}
                    </h3>
                    <p style="color: var(--text-secondary); max-width: 440px; margin: 0 auto;">
                        ${selectedView === 'completed' 
                            ? 'Виконані дії з’являться тут після підтвердження.' 
                            : 'Усі необхідні доступи та погодження надано. Команда повідомить у разі нових завдань.'}
                    </p>
                </div>
            ` : `
                <div class="client-actions-grid">
                    ${displayedActions.map(a => renderActionCard(a)).join("")}
                </div>
            `}
        </div>

        <!-- Lightweight Action Detail Modal Container -->
        <div id="client-action-modal-container"></div>
    `;
}

function renderActionCard(a) {
    const isDone = a.status === "done";
    const isOverdue = !isDone && a.due_date && new Date(a.due_date) < new Date();
    const projectName = a.project?.name || a.project?.title || "Проєкт";

    return `
        <div class="client-card client-action-card-item ${isDone ? 'done' : ''}" data-task-id="${a.id}">
            <div class="client-action-card-main" onclick="openActionDetailModal('${a.id}')" style="cursor: pointer;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
                    <span class="client-badge client-badge-neutral" style="font-size: 0.75rem;">
                        <i data-lucide="folder" style="width: 11px; height: 11px;"></i> ${escapeHtml(projectName)}
                    </span>
                    ${isOverdue ? `
                        <span class="client-badge client-badge-danger" style="font-size: 0.75rem;">
                            <i data-lucide="alert-triangle" style="width: 11px; height: 11px;"></i> Прострочено
                        </span>
                    ` : (isDone ? `
                        <span class="client-badge client-badge-success" style="font-size: 0.75rem;">
                            <i data-lucide="check" style="width: 11px; height: 11px;"></i> Виконано
                        </span>
                    ` : '')}
                </div>

                <h4 class="client-action-card-title ${isDone ? 'done-text' : ''}">${escapeHtml(a.title)}</h4>
                ${a.description ? `<p class="client-action-card-desc">${escapeHtml(a.description)}</p>` : ''}

                <div class="client-action-card-meta">
                    ${a.due_date ? `
                        <span class="client-action-card-due ${isOverdue ? 'overdue' : ''}">
                            <i data-lucide="calendar" style="width: 12px; height: 12px;"></i>
                            Термін: ${formatDate(a.due_date)}
                        </span>
                    ` : ''}
                    ${a.stage ? `
                        <span class="client-action-card-stage">
                            <i data-lucide="play-circle" style="width: 12px; height: 12px;"></i>
                            ${escapeHtml(a.stage.name)}
                        </span>
                    ` : ''}
                </div>
            </div>

            <!-- Actions Footer -->
            <div class="client-action-card-footer">
                <button class="btn btn-sm btn-ghost" onclick="openActionDetailModal('${a.id}')">
                    Деталі
                </button>

                <div>
                    ${isDone ? `
                        <button class="btn btn-sm btn-outline btn-reopen-action" data-task-id="${a.id}" title="Повернути до виконання">
                            <i data-lucide="rotate-ccw" style="width: 13px; height: 13px;"></i> Повернути
                        </button>
                    ` : `
                        <button class="btn btn-sm btn-primary btn-complete-action" data-task-id="${a.id}">
                            <i data-lucide="check" style="width: 13px; height: 13px;"></i> Позначити виконаним
                        </button>
                    `}
                </div>
            </div>
        </div>
    `;
}

export function initClientActionsEvents(actions = [], projects = [], onFilterChange, onRefresh) {
    if (window.lucide) window.lucide.createIcons();

    // Store in window for modal
    window._clientActionsData = actions;

    // View Pills
    document.querySelectorAll("#client-action-pills .client-filter-pill").forEach(pill => {
        pill.addEventListener("click", () => {
            selectedView = pill.dataset.view;
            if (onFilterChange) {
                onFilterChange({ view: selectedView, projectId: selectedProjectId, search: searchKeyword });
            }
        });
    });

    // Project Select
    document.getElementById("select-client-action-project")?.addEventListener("change", (e) => {
        selectedProjectId = e.target.value;
        if (onFilterChange) {
            onFilterChange({ view: selectedView, projectId: selectedProjectId, search: searchKeyword });
        }
    });

    // Search Input
    let searchTimeout;
    document.getElementById("input-client-action-search")?.addEventListener("input", (e) => {
        clearTimeout(searchTimeout);
        searchKeyword = e.target.value;
        searchTimeout = setTimeout(() => {
            if (onFilterChange) {
                onFilterChange({ view: selectedView, projectId: selectedProjectId, search: searchKeyword });
            }
        }, 250);
    });

    // Complete Action buttons
    document.querySelectorAll(".btn-complete-action").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const taskId = btn.dataset.taskId;
            if (!taskId) return;
            btn.disabled = true;
            btn.innerHTML = '<span class="portal-spinner" style="width:14px;height:14px;"></span>';

            const { error } = await DataClient.completeClientAction(taskId);
            if (error) {
                alert(error.message || "Не вдалося виконати дію.");
                btn.disabled = false;
                btn.innerHTML = '<i data-lucide="check"></i> Позначити виконаним';
                if (window.lucide) window.lucide.createIcons();
                return;
            }
            if (onRefresh) onRefresh();
        });
    });

    // Reopen Action buttons
    document.querySelectorAll(".btn-reopen-action").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const taskId = btn.dataset.taskId;
            if (!taskId) return;
            btn.disabled = true;
            btn.innerHTML = '<span class="portal-spinner" style="width:14px;height:14px;"></span>';

            const { error } = await DataClient.reopenClientAction(taskId);
            if (error) {
                alert(error.message || "Не вдалося повернути дію.");
                btn.disabled = false;
                btn.innerHTML = '<i data-lucide="rotate-ccw"></i> Повернути';
                if (window.lucide) window.lucide.createIcons();
                return;
            }
            if (onRefresh) onRefresh();
        });
    });
}

// Action Detail Modal
window.openActionDetailModal = (taskId) => {
    const actions = window._clientActionsData || [];
    const action = actions.find(a => a.id === taskId);
    if (!action) return;

    const container = document.getElementById("client-action-modal-container");
    if (!container) return;

    const isDone = action.status === "done";
    const projectName = action.project?.name || action.project?.title || "Проєкт";

    container.innerHTML = `
        <div class="portal-modal-overlay" id="modal-action-detail-overlay">
            <div class="portal-modal-card" style="max-width: 540px;">
                <div class="portal-modal-header">
                    <div>
                        <span class="client-badge client-badge-neutral" style="font-size: 0.75rem; margin-bottom: 4px;">
                            ${escapeHtml(projectName)}
                        </span>
                        <h3 class="portal-modal-title">${escapeHtml(action.title)}</h3>
                    </div>
                    <button class="portal-modal-close" onclick="closeActionDetailModal()">&times;</button>
                </div>

                <div class="portal-modal-body">
                    ${action.description ? `
                        <div style="margin-bottom: 16px;">
                            <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Опис дії</label>
                            <div style="font-size: 0.95rem; color: var(--text-secondary); line-height: 1.6; margin-top: 4px; white-space: pre-wrap;">${escapeHtml(action.description)}</div>
                        </div>
                    ` : ''}

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; padding: 12px; background: var(--bg-card-subtle); border-radius: var(--radius-sm);">
                        <div>
                            <span style="font-size: 0.75rem; color: var(--text-muted);">Статус</span>
                            <div style="font-size: 0.88rem; font-weight: 600; margin-top: 2px;">
                                ${isDone ? '<span style="color: var(--color-success);">Виконано</span>' : '<span style="color: var(--color-warning);">До виконання</span>'}
                            </div>
                        </div>
                        <div>
                            <span style="font-size: 0.75rem; color: var(--text-muted);">Термін виконання</span>
                            <div style="font-size: 0.88rem; font-weight: 600; margin-top: 2px;">
                                ${action.due_date ? formatDate(action.due_date) : 'Не вказано'}
                            </div>
                        </div>
                        ${action.stage ? `
                            <div>
                                <span style="font-size: 0.75rem; color: var(--text-muted);">Етап проєкту</span>
                                <div style="font-size: 0.88rem; margin-top: 2px;">${escapeHtml(action.stage.name)}</div>
                            </div>
                        ` : ''}
                        ${action.meeting ? `
                            <div>
                                <span style="font-size: 0.75rem; color: var(--text-muted);">Пов'язана зустріч</span>
                                <div style="font-size: 0.88rem; margin-top: 2px;">${escapeHtml(action.meeting.title)}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="portal-modal-footer" style="display: flex; justify-content: space-between;">
                    <button class="btn btn-outline" onclick="closeActionDetailModal()">Закрити</button>
                    ${isDone ? `
                        <button class="btn btn-outline" onclick="triggerReopenModalAction('${action.id}')">
                            <i data-lucide="rotate-ccw" style="width: 14px; height: 14px;"></i> Повернути до виконання
                        </button>
                    ` : `
                        <button class="btn btn-primary" onclick="triggerCompleteModalAction('${action.id}')">
                            <i data-lucide="check" style="width: 14px; height: 14px;"></i> Позначити виконаним
                        </button>
                    `}
                </div>
            </div>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();
};

window.closeActionDetailModal = () => {
    const container = document.getElementById("client-action-modal-container");
    if (container) container.innerHTML = "";
};

window.triggerCompleteModalAction = async (taskId) => {
    const { error } = await DataClient.completeClientAction(taskId);
    if (error) {
        alert(error.message || "Помилка оновлення статусу.");
        return;
    }
    closeActionDetailModal();
    if (window._clientActionsRefresh) window._clientActionsRefresh();
};

window.triggerReopenModalAction = async (taskId) => {
    const { error } = await DataClient.reopenClientAction(taskId);
    if (error) {
        alert(error.message || "Помилка оновлення статусу.");
        return;
    }
    closeActionDetailModal();
    if (window._clientActionsRefresh) window._clientActionsRefresh();
};

function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" });
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
