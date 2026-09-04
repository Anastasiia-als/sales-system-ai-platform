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
        <div class="client-card client-action-card-item ${isDone ? 'done' : ''}" data-task-id="${a.id}" style="cursor: pointer;">
            <div class="client-action-card-main" data-task-id="${a.id}">
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
                <button type="button" class="btn btn-sm btn-ghost btn-action-details" data-task-id="${a.id}" onclick="event.stopPropagation(); window.openActionDetailModal && window.openActionDetailModal('${a.id}')">
                    <i data-lucide="eye" style="width: 13px; height: 13px;"></i> Деталі
                </button>

                <div>
                    ${isDone ? `
                        <button type="button" class="btn btn-sm btn-outline btn-reopen-action" data-task-id="${a.id}" title="Повернути до виконання" onclick="event.stopPropagation();">
                            <i data-lucide="rotate-ccw" style="width: 13px; height: 13px;"></i> Повернути
                        </button>
                    ` : `
                        <button type="button" class="btn btn-sm btn-primary btn-complete-action" data-task-id="${a.id}" onclick="event.stopPropagation();">
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

    // Card click & Detail button direct event listeners
    document.querySelectorAll(".client-action-card-item").forEach(card => {
        card.addEventListener("click", (e) => {
            if (e.target.closest(".btn-reopen-action") || e.target.closest(".btn-complete-action")) {
                return;
            }
            const taskId = card.dataset.taskId;
            if (taskId) {
                openActionDetailModal(taskId);
            }
        });
    });

    document.querySelectorAll(".btn-action-details").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const taskId = btn.dataset.taskId;
            if (taskId) {
                openActionDetailModal(taskId);
            }
        });
    });
}

let modalSelectedFiles = [];

export async function openActionDetailModal(taskIdOrAction) {
    let action = null;
    let taskId = null;
    if (typeof taskIdOrAction === 'object' && taskIdOrAction !== null) {
        action = taskIdOrAction;
        taskId = action.id;
    } else {
        taskId = taskIdOrAction;
        const actions = window._clientActionsData || [];
        action = actions.find(a => a.id === taskId);
    }

    if (!action && taskId) {
        // Fallback fetch if not found in memory
        const { data: fetchedTask } = await DataClient.getTaskById(taskId);
        if (fetchedTask) {
            action = fetchedTask;
        }
    }

    if (!action) {
        console.warn("[ClientActions] Action not found for id:", taskId);
        return;
    }

    let container = document.getElementById("client-action-modal-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "client-action-modal-container";
        document.body.appendChild(container);
    }

    modalSelectedFiles = [];
    const isDone = action.status === "done";
    const projectName = action.project?.name || action.project?.title || "Проєкт";

    container.innerHTML = `
        <div class="portal-modal-overlay" id="modal-action-detail-overlay">
            <div class="portal-modal-card" id="action-detail-modal" style="max-width: 600px; width: 100%;">
                <div class="portal-modal-header">
                    <div>
                        <span class="client-badge client-badge-neutral" style="font-size: 0.75rem; margin-bottom: 4px;">
                            ${escapeHtml(projectName)}
                        </span>
                        <h3 class="portal-modal-title" style="margin-top: 2px;">${escapeHtml(action.title)}</h3>
                    </div>
                    <button class="portal-modal-close" onclick="closeActionDetailModal()">&times;</button>
                </div>

                <div class="portal-modal-body">
                    ${action.description ? `
                        <div style="margin-bottom: 16px;">
                            <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Опис завдання від команди</label>
                            <div style="font-size: 0.95rem; color: var(--text-secondary); line-height: 1.6; margin-top: 4px; white-space: pre-wrap; background: var(--bg-card-subtle); padding: 12px; border-radius: var(--radius-sm);">${escapeHtml(action.description)}</div>
                        </div>
                    ` : ''}

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; padding: 12px; background: var(--bg-card-subtle); border-radius: var(--radius-sm);">
                        <div>
                            <span style="font-size: 0.75rem; color: var(--text-muted);">Статус</span>
                            <div style="font-size: 0.88rem; font-weight: 600; margin-top: 2px;">
                                ${isDone ? '<span class="client-badge client-badge-success">Виконано</span>' : '<span class="client-badge client-badge-warning">До виконання</span>'}
                            </div>
                        </div>
                        <div>
                            <span style="font-size: 0.75rem; color: var(--text-muted);">Термін виконання</span>
                            <div style="font-size: 0.88rem; font-weight: 600; margin-top: 2px;">
                                ${action.due_date ? formatDate(action.due_date) : 'Не вказано'}
                            </div>
                        </div>
                    </div>

                    ${!isDone ? `
                        <!-- Submission Form -->
                        <div class="client-action-submission-box" style="border-top: 1px solid var(--border-color); padding-top: 16px;">
                            <label for="client-action-text-input" style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px;">
                                Ваша відповідь / коментар:
                            </label>
                            <textarea 
                                id="client-action-text-input" 
                                class="client-form-textarea" 
                                rows="3" 
                                placeholder="Вкажіть коментар або відповідь на запит команди..."
                                style="width: 100%; box-sizing: border-box; resize: vertical; margin-bottom: 12px; padding: 10px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); font-family: inherit;"
                            ></textarea>

                            <div style="margin-bottom: 12px;">
                                <label style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 4px;">
                                    Прикріпити матеріали (до 5 файлів, до 25 MB кожен):
                                </label>
                                <div 
                                    id="client-action-dropzone" 
                                    style="border: 2px dashed var(--border-color); border-radius: var(--radius-sm); padding: 16px; text-align: center; cursor: pointer; transition: background 0.2s;"
                                    onclick="document.getElementById('client-action-file-input').click()"
                                >
                                    <i data-lucide="upload-cloud" style="width: 24px; height: 24px; color: var(--text-muted); margin-bottom: 4px;"></i>
                                    <div style="font-size: 0.85rem; color: var(--text-secondary);">
                                        Натисніть або перетягніть файли сюди (.pdf, .png, .jpg, .docx, .xlsx, .zip, .csv)
                                    </div>
                                    <input 
                                        type="file" 
                                        id="client-action-file-input" 
                                        multiple 
                                        accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.zip,.csv" 
                                        style="display: none;" 
                                        onchange="handleClientActionFileSelect(event)"
                                    />
                                </div>
                                <div id="client-action-selected-files" style="margin-top: 8px;"></div>
                                <div id="client-action-form-error" style="color: var(--color-danger, #ef4444); font-size: 0.82rem; margin-top: 6px; display: none;"></div>
                            </div>
                        </div>
                    ` : `
                        <!-- Completed Review Section -->
                        <div id="client-action-review-section" style="border-top: 1px solid var(--border-color); padding-top: 16px;">
                            <div style="text-align: center; padding: 12px; color: var(--text-muted);">
                                <span>Завантаження деталей відповіді...</span>
                            </div>
                        </div>
                    `}
                </div>

                <div class="portal-modal-footer" style="display: flex; justify-content: space-between; align-items: center;">
                    <button class="btn btn-outline" onclick="closeActionDetailModal()">Закрити</button>
                    ${isDone ? `
                        <button class="btn btn-outline" id="btn-reopen-client-action" onclick="triggerReopenModalAction('${action.id}')">
                            <i data-lucide="rotate-ccw" style="width: 14px; height: 14px;"></i> Повернути до виконання
                        </button>
                    ` : `
                        <button class="btn btn-primary" id="btn-submit-client-action" onclick="triggerSubmitModalAction('${action.id}')">
                            <i data-lucide="send" style="width: 14px; height: 14px;"></i> Надіслати відповідь
                        </button>
                    `}
                </div>
            </div>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    if (isDone) {
        await loadClientActionSubmissionHistory(action.id);
    }
};

window.handleClientActionFileSelect = (event) => {
    const files = Array.from(event.target.files || []);
    const errorEl = document.getElementById("client-action-form-error");
    if (errorEl) errorEl.style.display = "none";

    const ALLOWED = ['pdf', 'png', 'jpg', 'jpeg', 'docx', 'xlsx', 'zip', 'csv'];
    for (const f of files) {
        const ext = f.name.split('.').pop().toLowerCase();
        if (!ALLOWED.includes(ext)) {
            if (errorEl) {
                errorEl.textContent = `Формат файлу «${f.name}» не дозволено. Дозволено: ${ALLOWED.join(', ')}.`;
                errorEl.style.display = "block";
            }
            return;
        }
        if (f.size > 25 * 1024 * 1024) {
            if (errorEl) {
                errorEl.textContent = `Файл «${f.name}» перевищує ліміт 25 MB.`;
                errorEl.style.display = "block";
            }
            return;
        }
    }

    if (modalSelectedFiles.length + files.length > 5) {
        if (errorEl) {
            errorEl.textContent = "Максимальна кількість файлів — 5.";
            errorEl.style.display = "block";
        }
        return;
    }

    modalSelectedFiles = [...modalSelectedFiles, ...files];
    renderSelectedFilesList();
};

function renderSelectedFilesList() {
    const container = document.getElementById("client-action-selected-files");
    if (!container) return;
    if (modalSelectedFiles.length === 0) {
        container.innerHTML = "";
        return;
    }
    container.innerHTML = modalSelectedFiles.map((f, idx) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: var(--bg-card-subtle); border-radius: var(--radius-sm); margin-bottom: 4px; font-size: 0.82rem;">
            <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                <i data-lucide="file" style="width: 14px; height: 14px; flex-shrink: 0;"></i>
                <span style="overflow: hidden; text-overflow: ellipsis;">${escapeHtml(f.name)}</span>
                <span style="color: var(--text-muted); font-size: 0.75rem;">(${(f.size / 1024).toFixed(0)} KB)</span>
            </div>
            <button type="button" onclick="removeSelectedFile(${idx})" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px;">&times;</button>
        </div>
    `).join("");
    if (window.lucide) window.lucide.createIcons();
}

window.removeSelectedFile = (idx) => {
    modalSelectedFiles.splice(idx, 1);
    renderSelectedFilesList();
};

async function loadClientActionSubmissionHistory(taskId) {
    const section = document.getElementById("client-action-review-section");
    if (!section) return;

    const { data: subs, error } = await DataClient.getClientActionSubmissions(taskId);
    if (error || !subs || subs.length === 0) {
        section.innerHTML = `
            <div style="font-size: 0.88rem; color: var(--text-muted); padding: 12px; background: var(--bg-card-subtle); border-radius: var(--radius-sm); text-align: center;">
                Дію виконано. Деталі відповіді відсутні або зафіксовані в системі.
            </div>
        `;
        return;
    }

    section.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
            <div style="font-size: 0.82rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">
                ${subs.length > 1 ? `Історія виконання (${subs.length} ітерації)` : 'Відповідь клієнта'}
            </div>
            ${subs.map((sub, index) => {
                const isLatest = index === subs.length - 1;
                const payload = sub.payload || {};
                const attachments = sub.attachments || payload.attachments || [];
                const author = sub.submitted_by_contact_name || sub.submitted_by_user_name || sub.submitted_by_contact_email || '';
                const channelName = sub.submission_type === 'authenticated_portal' ? 'Клієнтський портал' : 'Публічне посилання';
                const channelBadge = sub.submission_type === 'authenticated_portal' ? 'client-badge-success' : 'client-badge-neutral';

                return `
                    <div style="background: var(--bg-card-subtle); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span class="client-badge ${channelBadge}" style="font-size: 0.75rem;">
                                    ${escapeHtml(channelName)}
                                </span>
                                ${subs.length > 1 ? `
                                    <span style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">
                                        Ітерація ${index + 1}${isLatest ? ' (Поточна)' : ''}
                                    </span>
                                ` : ''}
                            </div>
                            <span style="font-size: 0.75rem; color: var(--text-muted);">
                                ${formatDateTime(sub.created_at)}
                            </span>
                        </div>

                        ${author ? `
                            <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px;">
                                <strong>Автор:</strong> ${escapeHtml(author)}
                            </div>
                        ` : ''}

                        ${payload.text ? `
                            <div style="font-size: 0.9rem; color: var(--text-primary); line-height: 1.5; margin-bottom: 10px; white-space: pre-wrap; background: var(--bg-card); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                                ${escapeHtml(payload.text)}
                            </div>
                        ` : '<div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px;">Відповідь без текстового коментаря</div>'}

                        ${attachments.length > 0 ? `
                            <div style="border-top: 1px solid var(--border-color); padding-top: 8px; margin-top: 8px;">
                                <span style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 6px;">
                                    Прикріплені файли (${attachments.length}):
                                </span>
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    ${attachments.map(att => `
                                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; padding: 6px 10px; background: var(--bg-card); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                                            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(att.name)}</span>
                                            ${(att.path || att.storage_path) ? `
                                                <button type="button" class="btn btn-outline btn-xs" onclick="downloadAttachmentFile('${escapeHtml(att.path || att.storage_path)}')" style="padding: 2px 8px; font-size: 0.75rem;">
                                                    Завантажити
                                                </button>
                                            ` : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('')}
        </div>
    `;
    if (window.lucide) window.lucide.createIcons();
}

function formatDateTime(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" }) + 
           " о " + 
           d.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
}

window.downloadAttachmentFile = async (storagePath) => {
    const { data: url, error } = await DataClient.getClientActionAttachmentUrl(storagePath);
    if (error || !url) {
        alert("Не вдалося сформувати посилання на завантаження.");
        return;
    }
    window.open(url, "_blank");
};

window.triggerSubmitModalAction = async (taskId) => {
    const btn = document.getElementById("btn-submit-client-action");
    const errorEl = document.getElementById("client-action-form-error");
    const textInput = document.getElementById("client-action-text-input");
    const text = textInput ? textInput.value.trim() : "";

    if (!text && modalSelectedFiles.length === 0) {
        if (errorEl) {
            errorEl.textContent = "Будь ласка, введіть відповідь або прикріпіть хоча б один файл.";
            errorEl.style.display = "block";
        }
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Надсилання...';
        if (window.lucide) window.lucide.createIcons();
    }

    try {
        // Upload attachments
        const uploadedAttachments = [];
        for (const f of modalSelectedFiles) {
            const { data: attData, error: uploadErr } = await DataClient.uploadClientActionAttachment(taskId, f);
            if (uploadErr) {
                throw new Error(uploadErr.message || `Не вдалося завантажити файл «${f.name}».`);
            }
            uploadedAttachments.push(attData);
        }

        // Submit via authenticated RPC
        const { error: submitErr } = await DataClient.submitAuthenticatedClientAction(taskId, {
            text,
            attachments: uploadedAttachments,
            submitted_at: new Date().toISOString()
        });

        if (submitErr) {
            throw new Error(submitErr.message || "Помилка збереження відповіді.");
        }

        closeActionDetailModal();
        if (window._clientActionsRefresh) window._clientActionsRefresh();
    } catch (err) {
        if (errorEl) {
            errorEl.textContent = err.message || "Помилка виконання дії.";
            errorEl.style.display = "block";
        }
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="send" style="width: 14px; height: 14px;"></i> Надіслати відповідь';
            if (window.lucide) window.lucide.createIcons();
        }
    }
};

window.triggerReopenModalAction = async (taskId) => {
    const btn = document.getElementById("btn-reopen-client-action");
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Оновлення...';
        if (window.lucide) window.lucide.createIcons();
    }

    const { error } = await DataClient.reopenClientAction(taskId);
    if (error) {
        alert(error.message || "Помилка оновлення статусу.");
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="rotate-ccw" style="width: 14px; height: 14px;"></i> Повернути до виконання';
            if (window.lucide) window.lucide.createIcons();
        }
        return;
    }

    closeActionDetailModal();
    if (window._clientActionsRefresh) window._clientActionsRefresh();
};

export function closeActionDetailModal() {
    modalSelectedFiles = [];
    const container = document.getElementById("client-action-modal-container");
    if (container) container.innerHTML = "";
}

if (typeof window !== "undefined") {
    window.openActionDetailModal = openActionDetailModal;
    window.closeActionDetailModal = closeActionDetailModal;
}

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
