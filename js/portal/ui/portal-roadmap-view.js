/* js/portal/ui/portal-roadmap-view.js - Project Roadmap, Stages & Milestones View */

import { DataClient } from "../api/data-client.js";
import { PortalAuth } from "../auth/auth-service.js";

export function renderRoadmapView(projectId, stages = [], canManage = false) {
    const overallProgress = calculateProjectProgress(stages);
    const totalMilestones = stages.reduce((acc, s) => acc + (s.milestones?.length || 0), 0);
    const completedMilestones = stages.reduce((acc, s) => acc + (s.milestones?.filter(m => m.status === "completed").length || 0), 0);
    const currentStage = getCurrentStage(stages);

    return `
        <div class="portal-roadmap-wrapper">
            <!-- Roadmap Top Summary Banner -->
            <div class="portal-roadmap-summary-bar">
                <div class="portal-roadmap-summary-left">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <span style="font-size: 0.76rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Загальний прогрес проєкту</span>
                        ${overallProgress !== null ? `
                            <div style="display: flex; align-items: baseline; gap: 8px;">
                                <span style="font-size: 1.6rem; font-weight: 800; color: var(--color-primary); line-height: 1;">${overallProgress}%</span>
                                <span style="font-size: 0.84rem; color: var(--text-secondary);">
                                    (${completedMilestones} з ${totalMilestones} пунктів виконано)
                                </span>
                            </div>
                            <div class="portal-progress-bar" style="width: 240px; height: 6px; margin-top: 4px;">
                                <div class="portal-progress-fill" style="width: ${overallProgress}%;"></div>
                            </div>
                        ` : `
                            <div style="font-size: 0.95rem; font-weight: 600; color: var(--text-muted); padding: 4px 0;">
                                Roadmap ще не створено
                            </div>
                        `}
                    </div>

                    <div class="portal-roadmap-stat-divider"></div>

                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <span style="font-size: 0.76rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Поточний етап</span>
                        <span style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">
                            ${currentStage ? escapeHtml(currentStage.name) : (stages.length > 0 ? "Всі етапи завершено 🎉" : "Етапи ще не створені")}
                        </span>
                        <span style="font-size: 0.78rem; color: var(--text-muted);">
                            ${currentStage ? `Статус: ${getStageStatusLabel(currentStage.status)}` : "—"}
                        </span>
                    </div>
                </div>

                ${canManage ? `
                    <button class="btn btn-primary" id="btn-add-stage">
                        <i data-lucide="plus"></i> Додати етап
                    </button>
                ` : ""}
            </div>

            <!-- Stages List / Empty State -->
            <div id="roadmap-stages-list" style="margin-top: 24px; display: flex; flex-direction: column; gap: 20px;">
                ${stages.length === 0 ? `
                    <div class="portal-placeholder-box">
                        <div class="portal-empty-icon" style="color: var(--color-primary);"><i data-lucide="milestone"></i></div>
                        <div class="portal-empty-title">Roadmap ще не створено</div>
                        <div class="portal-empty-desc">
                            Створіть перший етап проєкту (наприклад, <em>Discovery</em>, <em>Аудит</em>, <em>Впровадження</em>) та додайте контрольні точки.
                        </div>
                        ${canManage ? `
                            <button class="btn btn-primary" id="btn-empty-add-stage" style="margin-top: 10px;">
                                <i data-lucide="plus"></i> Створити перший етап
                            </button>
                        ` : ""}
                    </div>
                ` : stages.map((stage, idx) => renderStageCard(stage, idx, stages.length, canManage)).join("")}
            </div>
        </div>
    `;
}

function renderStageCard(stage, index, totalStages, canManage) {
    const stageNumber = String(index + 1).padStart(2, "0");
    const milestones = stage.milestones || [];
    const tasks = stage.tasks || [];
    const completedTasks = tasks.filter(t => t.status === "done").length;
    const stageProgress = calculateStageProgress(stage);
    const resp = stage.responsible_user;
    const startDate = stage.start_date ? formatDate(stage.start_date) : null;
    const targetDate = stage.target_date ? formatDate(stage.target_date) : null;
    const datesStr = (startDate || targetDate) ? `${startDate || '—'} → ${targetDate || '—'}` : null;

    return `
        <div class="portal-stage-card ${stage.status === 'completed' ? 'stage-card-completed' : ''}" data-stage-id="${stage.id}">
            <!-- Stage Header -->
            <div class="portal-stage-header">
                <div class="portal-stage-header-left">
                    <div class="portal-stage-badge-num">
                        ${stageNumber}
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                            <h3 class="portal-stage-title">${escapeHtml(stage.name)}</h3>
                            <span class="portal-badge portal-badge-stage-${stage.status}">
                                ${getStageStatusLabel(stage.status)}
                            </span>
                            ${stage.is_client_visible ? `
                                <span class="portal-badge" style="background: rgba(59,130,246,0.1); color: #60A5FA; font-size: 0.72rem;">
                                    <i data-lucide="eye" style="width: 11px; height: 11px;"></i> Видно клієнту
                                </span>
                            ` : `
                                <span class="portal-badge" style="background: rgba(148,163,184,0.1); color: #94A3B8; font-size: 0.72rem;">
                                    <i data-lucide="eye-off" style="width: 11px; height: 11px;"></i> Внутрішній
                                </span>
                            `}
                            ${tasks.length > 0 ? `
                                <span class="portal-badge" style="background: rgba(139,92,246,0.1); color: #A78BFA; font-size: 0.72rem;">
                                    <i data-lucide="check-square" style="width: 11px; height: 11px;"></i> Виконано задач: ${completedTasks}/${tasks.length}
                                </span>
                            ` : ""}
                        </div>
                        <div style="display: flex; align-items: center; gap: 14px; font-size: 0.8rem; color: var(--text-muted); flex-wrap: wrap;">
                            ${datesStr ? `<span><i data-lucide="calendar" style="width:12px;height:12px;vertical-align:middle;"></i> ${datesStr}</span>` : ""}
                            ${resp ? `
                                <span style="display: inline-flex; align-items: center; gap: 5px;">
                                    <i data-lucide="user" style="width:12px;height:12px;"></i> ${escapeHtml(resp.full_name || resp.email)}
                                </span>
                            ` : ""}
                            ${stage.description ? `<span style="color: var(--text-secondary);">${escapeHtml(stage.description)}</span>` : ""}
                        </div>
                    </div>
                </div>

                <!-- Stage Progress & Controls -->
                <div class="portal-stage-header-right">
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                        ${stageProgress !== null ? `
                            <span style="font-size: 0.78rem; font-weight: 700; color: var(--text-primary);">${stageProgress}%</span>
                            <div class="portal-progress-bar" style="width: 110px; height: 6px;">
                                <div class="portal-progress-fill" style="width: ${stageProgress}%;"></div>
                            </div>
                        ` : `
                            <span class="portal-badge portal-badge-stage-${stage.status}" style="font-size: 0.75rem; padding: 3px 8px;">
                                ${getStageStatusLabel(stage.status)}
                            </span>
                        `}
                    </div>

                    ${canManage ? `
                        <div class="portal-stage-actions">
                            ${index > 0 ? `
                                <button class="portal-icon-btn btn-move-stage-up" data-stage-id="${stage.id}" title="Перемістити вище">
                                    <i data-lucide="chevron-up" style="width: 14px; height: 14px;"></i>
                                </button>
                            ` : ""}
                            ${index < totalStages - 1 ? `
                                <button class="portal-icon-btn btn-move-stage-down" data-stage-id="${stage.id}" title="Перемістити нижче">
                                    <i data-lucide="chevron-down" style="width: 14px; height: 14px;"></i>
                                </button>
                            ` : ""}
                            <button class="portal-icon-btn btn-edit-stage" data-stage-id="${stage.id}" title="Редагувати">
                                <i data-lucide="edit-2" style="width: 14px; height: 14px;"></i>
                            </button>
                            <button class="portal-icon-btn btn-delete-stage" data-stage-id="${stage.id}" data-stage-name="${escapeHtml(stage.name)}" title="Видалити" style="color: var(--color-danger);">
                                <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                            </button>
                        </div>
                    ` : ""}
                </div>
            </div>

            <!-- Milestones Sub-section -->
            <div class="portal-stage-milestones-box">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em;">
                        Контрольні точки (${milestones.filter(m => m.status === 'completed').length}/${milestones.length})
                    </span>
                    ${canManage ? `
                        <button class="btn btn-sm btn-outline btn-add-milestone" data-stage-id="${stage.id}" style="padding: 4px 10px; font-size: 0.78rem;">
                            <i data-lucide="plus" style="width: 12px; height: 12px;"></i> Додати контрольну точку
                        </button>
                    ` : ""}
                </div>

                ${milestones.length === 0 ? `
                    <div style="padding: 12px; background: rgba(0,0,0,0.15); border-radius: var(--radius-sm); border: 1px dashed var(--border-color); text-align: center; font-size: 0.82rem; color: var(--text-muted);">
                        У цьому етапі ще немає контрольних точок.
                    </div>
                ` : `
                    <div class="portal-milestones-list">
                        ${milestones.map(m => renderMilestoneItem(m, canManage)).join("")}
                    </div>
                `}
            </div>
        </div>
    `;
}

function renderMilestoneItem(milestone, canManage) {
    const isCompleted = milestone.status === "completed";
    const isOverdue = !isCompleted && milestone.target_date && new Date(milestone.target_date) < new Date().setHours(0,0,0,0);
    const targetDateFormatted = milestone.target_date ? formatDate(milestone.target_date) : null;
    const completedDateFormatted = milestone.completed_at ? formatDate(milestone.completed_at) : null;

    return `
        <div class="portal-milestone-item ${isCompleted ? 'milestone-completed' : ''}" data-milestone-id="${milestone.id}">
            <div class="portal-milestone-left">
                <label class="portal-checkbox-label">
                    <input type="checkbox" class="portal-milestone-checkbox" data-milestone-id="${milestone.id}" ${isCompleted ? 'checked' : ''} ${!canManage ? 'disabled' : ''} />
                    <span class="portal-custom-checkbox"></span>
                </label>
                <div style="display: flex; flex-direction: column; gap: 2px;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span class="portal-milestone-name ${isCompleted ? 'milestone-name-done' : ''}">${escapeHtml(milestone.name)}</span>
                        ${isOverdue ? `
                            <span class="portal-badge" style="background: rgba(239,68,68,0.15); color: #F87171; font-size: 0.68rem; padding: 1px 6px;">
                                <i data-lucide="alert-triangle" style="width: 10px; height: 10px;"></i> Протерміновано
                            </span>
                        ` : ""}
                        ${isCompleted ? `
                            <span class="portal-badge" style="background: rgba(16,185,129,0.1); color: #34D399; font-size: 0.68rem; padding: 1px 6px;">
                                <i data-lucide="check" style="width: 10px; height: 10px;"></i> Виконано ${completedDateFormatted ? `(${completedDateFormatted})` : ''}
                            </span>
                        ` : ""}
                    </div>
                    ${milestone.description ? `<span style="font-size: 0.76rem; color: var(--text-muted);">${escapeHtml(milestone.description)}</span>` : ""}
                </div>
            </div>

            <div class="portal-milestone-right">
                ${targetDateFormatted && !isCompleted ? `
                    <span style="font-size: 0.78rem; color: ${isOverdue ? 'var(--color-danger)' : 'var(--text-muted)'}; display: inline-flex; align-items: center; gap: 4px;">
                        <i data-lucide="clock" style="width: 12px; height: 12px;"></i> до ${targetDateFormatted}
                    </span>
                ` : ""}

                ${canManage ? `
                    <div style="display: inline-flex; gap: 4px; align-items: center;">
                        <button class="portal-icon-btn btn-edit-milestone" data-milestone-id="${milestone.id}" title="Редагувати">
                            <i data-lucide="edit-2" style="width: 12px; height: 12px;"></i>
                        </button>
                        <button class="portal-icon-btn btn-delete-milestone" data-milestone-id="${milestone.id}" data-milestone-name="${escapeHtml(milestone.name)}" title="Видалити" style="color: var(--color-danger);">
                            <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
                        </button>
                    </div>
                ` : ""}
            </div>
        </div>
    `;
}

export function initRoadmapEvents(projectId, organizationId, stages, onReload) {
    const canManage = PortalAuth.isGlobalOwner() || PortalAuth.isOrgAdmin(organizationId);

    // 1. Add Stage Button
    document.getElementById("btn-add-stage")?.addEventListener("click", () => {
        openStageModal(projectId, organizationId, null, onReload);
    });
    document.getElementById("btn-empty-add-stage")?.addEventListener("click", () => {
        openStageModal(projectId, organizationId, null, onReload);
    });

    if (!canManage) return;

    // 2. Edit Stage
    document.querySelectorAll(".btn-edit-stage").forEach(btn => {
        btn.addEventListener("click", () => {
            const stageId = btn.getAttribute("data-stage-id");
            const stage = stages.find(s => s.id === stageId);
            if (stage) {
                openStageModal(projectId, organizationId, stage, onReload);
            }
        });
    });

    // 3. Delete Stage
    document.querySelectorAll(".btn-delete-stage").forEach(btn => {
        btn.addEventListener("click", () => {
            const stageId = btn.getAttribute("data-stage-id");
            const stageName = btn.getAttribute("data-stage-name");
            openDeleteStageModal(stageId, stageName, onReload);
        });
    });

    // 4. Move Stage Up
    document.querySelectorAll(".btn-move-stage-up").forEach(btn => {
        btn.addEventListener("click", async () => {
            const stageId = btn.getAttribute("data-stage-id");
            const idx = stages.findIndex(s => s.id === stageId);
            if (idx > 0) {
                const newStages = [...stages];
                const temp = newStages[idx - 1];
                newStages[idx - 1] = newStages[idx];
                newStages[idx] = temp;
                await DataClient.reorderProjectStages(projectId, newStages.map(s => s.id));
                if (onReload) await onReload();
            }
        });
    });

    // 5. Move Stage Down
    document.querySelectorAll(".btn-move-stage-down").forEach(btn => {
        btn.addEventListener("click", async () => {
            const stageId = btn.getAttribute("data-stage-id");
            const idx = stages.findIndex(s => s.id === stageId);
            if (idx < stages.length - 1) {
                const newStages = [...stages];
                const temp = newStages[idx + 1];
                newStages[idx + 1] = newStages[idx];
                newStages[idx] = temp;
                await DataClient.reorderProjectStages(projectId, newStages.map(s => s.id));
                if (onReload) await onReload();
            }
        });
    });

    // 6. Add Milestone
    document.querySelectorAll(".btn-add-milestone").forEach(btn => {
        btn.addEventListener("click", () => {
            const stageId = btn.getAttribute("data-stage-id");
            openMilestoneModal(projectId, organizationId, stageId, null, onReload);
        });
    });

    // 7. Edit Milestone
    document.querySelectorAll(".btn-edit-milestone").forEach(btn => {
        btn.addEventListener("click", () => {
            const milestoneId = btn.getAttribute("data-milestone-id");
            let foundMilestone = null;
            let foundStageId = null;
            for (const stage of stages) {
                const m = (stage.milestones || []).find(x => x.id === milestoneId);
                if (m) {
                    foundMilestone = m;
                    foundStageId = stage.id;
                    break;
                }
            }
            if (foundMilestone) {
                openMilestoneModal(projectId, organizationId, foundStageId, foundMilestone, onReload);
            }
        });
    });

    // 8. Delete Milestone
    document.querySelectorAll(".btn-delete-milestone").forEach(btn => {
        btn.addEventListener("click", () => {
            const milestoneId = btn.getAttribute("data-milestone-id");
            const milestoneName = btn.getAttribute("data-milestone-name");
            openDeleteMilestoneModal(milestoneId, milestoneName, onReload);
        });
    });

    // 9. Milestone Checkbox Toggle
    document.querySelectorAll(".portal-milestone-checkbox").forEach(cb => {
        cb.addEventListener("change", async (e) => {
            const milestoneId = cb.getAttribute("data-milestone-id");
            const newStatus = cb.checked ? "completed" : "pending";
            cb.disabled = true;
            try {
                await DataClient.toggleMilestoneStatus(milestoneId, newStatus);
                if (onReload) await onReload();
            } catch (err) {
                console.error("Failed to toggle milestone:", err);
                cb.disabled = false;
            }
        });
    });
}

// -----------------------------------------------------------------------------
// Modals for Stages & Milestones
// -----------------------------------------------------------------------------
export async function openStageModal(projectId, organizationId, stage = null, onSuccess) {
    const mount = document.getElementById("project-detail-modal-mount");
    if (!mount) return;

    const isEdit = Boolean(stage);
    const { data: staff } = await DataClient.getStaffProfiles();
    const staffOptions = (staff || []).map(s => `
        <option value="${s.id}" ${stage?.responsible_user_id === s.id ? "selected" : ""}>
            ${escapeHtml(s.full_name || s.email)} (${s.global_role.toUpperCase()})
        </option>
    `).join("");

    mount.innerHTML = `
        <div class="portal-modal-overlay" id="stage-modal-overlay">
            <div class="portal-modal" style="max-width: 540px;">
                <div class="portal-modal-header">
                    <div class="portal-modal-title">${isEdit ? "Редагувати етап делівері" : "Додати новий етап проєкту"}</div>
                    <button id="btn-close-stage-modal" style="color: var(--text-muted); cursor: pointer; padding: 4px;">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <form id="form-stage-modal">
                    <div class="portal-modal-body">
                        <div class="portal-form-group">
                            <label class="portal-label">Назва етапу <span style="color: var(--color-danger);">*</span></label>
                            <input type="text" id="stage-name" class="portal-input" placeholder="Наприклад: Discovery & Аудит процесів" value="${escapeHtml(stage?.name || '')}" required />
                        </div>

                        <div class="portal-form-row">
                            <div class="portal-form-group">
                                <label class="portal-label">Статус етапу</label>
                                <select id="stage-status" class="portal-select">
                                    <option value="not_started" ${stage?.status === 'not_started' ? 'selected' : ''}>Not Started (Не розпочато)</option>
                                    <option value="in_progress" ${stage?.status === 'in_progress' ? 'selected' : ''}>In Progress (В роботі)</option>
                                    <option value="waiting_client" ${stage?.status === 'waiting_client' ? 'selected' : ''}>Waiting for Client</option>
                                    <option value="blocked" ${stage?.status === 'blocked' ? 'selected' : ''}>Blocked (Заблоковано)</option>
                                    <option value="completed" ${stage?.status === 'completed' ? 'selected' : ''}>Completed (Завершено)</option>
                                </select>
                            </div>
                            <div class="portal-form-group">
                                <label class="portal-label">Відповідальний за етап</label>
                                <select id="stage-responsible-id" class="portal-select">
                                    <option value="">-- Не призначено --</option>
                                    ${staffOptions}
                                </select>
                            </div>
                        </div>

                        <div class="portal-form-row">
                            <div class="portal-form-group">
                                <label class="portal-label">Дата початку</label>
                                <input type="date" id="stage-start-date" class="portal-input" value="${stage?.start_date || ''}" />
                            </div>
                            <div class="portal-form-group">
                                <label class="portal-label">Планова дата завершення</label>
                                <input type="date" id="stage-target-date" class="portal-input" value="${stage?.target_date || ''}" />
                            </div>
                        </div>

                        <div class="portal-form-group">
                            <label class="portal-label">Опис та цілі етапу</label>
                            <textarea id="stage-description" class="portal-textarea" placeholder="Ключові результати, артефакти або регламенти цього етапу...">${escapeHtml(stage?.description || '')}</textarea>
                        </div>

                        <div style="background: #131B2F; padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                            <label style="display: flex; align-items: center; gap: 10px; font-size: 0.85rem; cursor: pointer;">
                                <input type="checkbox" id="stage-is-client-visible" ${stage ? (stage.is_client_visible ? 'checked' : '') : 'checked'} />
                                <span><strong>Видно клієнту</strong></span>
                            </label>
                        </div>

                        <div id="stage-modal-error" style="color: var(--color-danger); font-size: 0.82rem; display: none;"></div>
                    </div>
                    <div class="portal-modal-footer">
                        <button type="button" class="btn btn-outline" id="btn-cancel-stage-modal">Скасувати</button>
                        <button type="submit" class="btn btn-primary" id="btn-submit-stage-modal">
                            <i data-lucide="check"></i> ${isEdit ? "Зберегти" : "Створити етап"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    function closeModal() {
        mount.innerHTML = "";
    }

    document.getElementById("btn-close-stage-modal")?.addEventListener("click", closeModal);
    document.getElementById("btn-cancel-stage-modal")?.addEventListener("click", closeModal);
    document.getElementById("stage-modal-overlay")?.addEventListener("click", (e) => {
        if (e.target.id === "stage-modal-overlay") closeModal();
    });

    const form = document.getElementById("form-stage-modal");
    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("stage-name")?.value.trim();
        const status = document.getElementById("stage-status")?.value || "not_started";
        const responsible_user_id = document.getElementById("stage-responsible-id")?.value || null;
        const start_date = document.getElementById("stage-start-date")?.value || null;
        const target_date = document.getElementById("stage-target-date")?.value || null;
        const description = document.getElementById("stage-description")?.value.trim();
        const is_client_visible = document.getElementById("stage-is-client-visible")?.checked;
        const errBox = document.getElementById("stage-modal-error");
        const btn = document.getElementById("btn-submit-stage-modal");

        if (!name) return;

        if (errBox) errBox.style.display = "none";
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="portal-spinner" style="width:14px;height:14px;border-width:2px;"></span> Збереження...`;
        }

        try {
            const payload = {
                project_id: projectId,
                organization_id: organizationId,
                name,
                status,
                responsible_user_id,
                start_date,
                target_date,
                description: description || null,
                is_client_visible
            };

            let res;
            if (isEdit) {
                res = await DataClient.updateProjectStage(stage.id, payload);
            } else {
                res = await DataClient.createProjectStage(payload);
            }

            if (res.error) {
                if (errBox) {
                    errBox.textContent = res.error.message;
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
                btn.innerHTML = `<i data-lucide="check"></i> ${isEdit ? "Зберегти" : "Створити етап"}`;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    });
}

export function openDeleteStageModal(stageId, stageName, onSuccess) {
    const mount = document.getElementById("project-detail-modal-mount");
    if (!mount) return;

    mount.innerHTML = `
        <div class="portal-modal-overlay" id="delete-stage-overlay">
            <div class="portal-modal" style="max-width: 440px;">
                <div class="portal-modal-header">
                    <div class="portal-modal-title" style="color: var(--color-danger); display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="alert-triangle"></i> Видалити етап?
                    </div>
                    <button id="btn-close-delete-stage" style="color: var(--text-muted); cursor: pointer; padding: 4px;">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="portal-modal-body">
                    <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5;">
                        Ви дійсно бажаєте видалити етап <strong>${escapeHtml(stageName)}</strong>? Усі пов'язані контрольні точки також буде видалено.
                    </p>
                    <div id="delete-stage-error" style="color: var(--color-danger); font-size: 0.82rem; display: none;"></div>
                </div>
                <div class="portal-modal-footer">
                    <button type="button" class="btn btn-outline" id="btn-cancel-delete-stage">Скасувати</button>
                    <button type="button" class="btn btn-danger" id="btn-confirm-delete-stage" style="background: var(--color-danger); color: #FFF;">
                        <i data-lucide="trash-2"></i> Видалити етап
                    </button>
                </div>
            </div>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    function closeModal() {
        mount.innerHTML = "";
    }

    document.getElementById("btn-close-delete-stage")?.addEventListener("click", closeModal);
    document.getElementById("btn-cancel-delete-stage")?.addEventListener("click", closeModal);
    document.getElementById("delete-stage-overlay")?.addEventListener("click", (e) => {
        if (e.target.id === "delete-stage-overlay") closeModal();
    });

    document.getElementById("btn-confirm-delete-stage")?.addEventListener("click", async () => {
        const btn = document.getElementById("btn-confirm-delete-stage");
        const errBox = document.getElementById("delete-stage-error");

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="portal-spinner" style="width:14px;height:14px;border-width:2px;"></span> Видалення...`;
        }

        try {
            const { error } = await DataClient.deleteProjectStage(stageId);
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
                btn.innerHTML = `<i data-lucide="trash-2"></i> Видалити етап`;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    });
}

export function openMilestoneModal(projectId, organizationId, stageId, milestone = null, onSuccess) {
    const mount = document.getElementById("project-detail-modal-mount");
    if (!mount) return;

    const isEdit = Boolean(milestone);

    mount.innerHTML = `
        <div class="portal-modal-overlay" id="milestone-modal-overlay">
            <div class="portal-modal" style="max-width: 480px;">
                <div class="portal-modal-header">
                    <div class="portal-modal-title">${isEdit ? "Редагувати контрольну точку" : "Додати контрольну точку"}</div>
                    <button id="btn-close-milestone-modal" style="color: var(--text-muted); cursor: pointer; padding: 4px;">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <form id="form-milestone-modal">
                    <div class="portal-modal-body">
                        <div class="portal-form-group">
                            <label class="portal-label">Назва контрольної точки <span style="color: var(--color-danger);">*</span></label>
                            <input type="text" id="milestone-name" class="portal-input" placeholder="Наприклад: Підключення телефонії та налаштування ліній" value="${escapeHtml(milestone?.name || '')}" required />
                        </div>

                        <div class="portal-form-group">
                            <label class="portal-label">Дедлайн (Target Date)</label>
                            <input type="date" id="milestone-target-date" class="portal-input" value="${milestone?.target_date || ''}" />
                        </div>

                        <div class="portal-form-group">
                            <label class="portal-label">Опис або критерій готовності</label>
                            <textarea id="milestone-description" class="portal-textarea" style="min-height: 60px;" placeholder="Що саме має бути виконано або передано клієнту...">${escapeHtml(milestone?.description || '')}</textarea>
                        </div>

                        <div style="background: #131B2F; padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                            <label style="display: flex; align-items: center; gap: 10px; font-size: 0.85rem; cursor: pointer;">
                                <input type="checkbox" id="milestone-is-client-visible" ${milestone ? (milestone.is_client_visible ? 'checked' : '') : 'checked'} />
                                <span><strong>Видно клієнту</strong></span>
                            </label>
                        </div>

                        <div id="milestone-modal-error" style="color: var(--color-danger); font-size: 0.82rem; display: none;"></div>
                    </div>
                    <div class="portal-modal-footer">
                        <button type="button" class="btn btn-outline" id="btn-cancel-milestone-modal">Скасувати</button>
                        <button type="submit" class="btn btn-primary" id="btn-submit-milestone-modal">
                            <i data-lucide="check"></i> ${isEdit ? "Зберегти" : "Додати контрольну точку"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    function closeModal() {
        mount.innerHTML = "";
    }

    document.getElementById("btn-close-milestone-modal")?.addEventListener("click", closeModal);
    document.getElementById("btn-cancel-milestone-modal")?.addEventListener("click", closeModal);
    document.getElementById("milestone-modal-overlay")?.addEventListener("click", (e) => {
        if (e.target.id === "milestone-modal-overlay") closeModal();
    });

    const form = document.getElementById("form-milestone-modal");
    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("milestone-name")?.value.trim();
        const target_date = document.getElementById("milestone-target-date")?.value || null;
        const description = document.getElementById("milestone-description")?.value.trim();
        const is_client_visible = document.getElementById("milestone-is-client-visible")?.checked;
        const errBox = document.getElementById("milestone-modal-error");
        const btn = document.getElementById("btn-submit-milestone-modal");

        if (!name) return;

        if (errBox) errBox.style.display = "none";
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="portal-spinner" style="width:14px;height:14px;border-width:2px;"></span> Збереження...`;
        }

        try {
            const payload = {
                stage_id: stageId,
                project_id: projectId,
                organization_id: organizationId,
                name,
                target_date,
                description: description || null,
                is_client_visible
            };

            let res;
            if (isEdit) {
                res = await DataClient.updateMilestone(milestone.id, payload);
            } else {
                res = await DataClient.createMilestone(payload);
            }

            if (res.error) {
                if (errBox) {
                    errBox.textContent = res.error.message;
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
                btn.innerHTML = `<i data-lucide="check"></i> ${isEdit ? "Зберегти" : "Додати контрольну точку"}`;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    });
}

export function openDeleteMilestoneModal(milestoneId, milestoneName, onSuccess) {
    const mount = document.getElementById("project-detail-modal-mount");
    if (!mount) return;

    mount.innerHTML = `
        <div class="portal-modal-overlay" id="delete-milestone-overlay">
            <div class="portal-modal" style="max-width: 440px;">
                <div class="portal-modal-header">
                    <div class="portal-modal-title" style="color: var(--color-danger); display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="alert-triangle"></i> Видалити контрольну точку?
                    </div>
                    <button id="btn-close-delete-milestone" style="color: var(--text-muted); cursor: pointer; padding: 4px;">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="portal-modal-body">
                    <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5;">
                        Ви дійсно бажаєте видалити контрольну точку <strong>${escapeHtml(milestoneName)}</strong>?
                    </p>
                    <div id="delete-milestone-error" style="color: var(--color-danger); font-size: 0.82rem; display: none;"></div>
                </div>
                <div class="portal-modal-footer">
                    <button type="button" class="btn btn-outline" id="btn-cancel-delete-milestone">Скасувати</button>
                    <button type="button" class="btn btn-danger" id="btn-confirm-delete-milestone" style="background: var(--color-danger); color: #FFF;">
                        <i data-lucide="trash-2"></i> Видалити контрольну точку
                    </button>
                </div>
            </div>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    function closeModal() {
        mount.innerHTML = "";
    }

    document.getElementById("btn-close-delete-milestone")?.addEventListener("click", closeModal);
    document.getElementById("btn-cancel-delete-milestone")?.addEventListener("click", closeModal);
    document.getElementById("delete-milestone-overlay")?.addEventListener("click", (e) => {
        if (e.target.id === "delete-milestone-overlay") closeModal();
    });

    document.getElementById("btn-confirm-delete-milestone")?.addEventListener("click", async () => {
        const btn = document.getElementById("btn-confirm-delete-milestone");
        const errBox = document.getElementById("delete-milestone-error");

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="portal-spinner" style="width:14px;height:14px;border-width:2px;"></span> Видалення...`;
        }

        try {
            const { error } = await DataClient.deleteMilestone(milestoneId);
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
                btn.innerHTML = `<i data-lucide="trash-2"></i> Видалити контрольну точку`;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    });
}

// -----------------------------------------------------------------------------
// Progress & Helper Functions
// -----------------------------------------------------------------------------
export function calculateStageProgress(stage) {
    if (!stage) return null;
    const milestones = stage.milestones || [];
    if (milestones.length > 0) {
        const completed = milestones.filter(m => m.status === "completed").length;
        return Math.round((completed / milestones.length) * 100);
    }
    return stage.status === "completed" ? 100 : null;
}

export function calculateProjectProgress(stages) {
    if (!stages || stages.length === 0) return null;
    
    let totalContribution = 0;
    for (const stage of stages) {
        const milestones = stage.milestones || [];
        if (milestones.length > 0) {
            const completed = milestones.filter(m => m.status === "completed").length;
            totalContribution += (completed / milestones.length) * 100;
        } else {
            totalContribution += stage.status === "completed" ? 100 : 0;
        }
    }
    
    return Math.round(totalContribution / stages.length);
}

export function getCurrentStage(stages) {
    if (!stages || stages.length === 0) return null;
    return stages.find(s => s.status !== "completed") || null;
}

export function getNextMilestone(stages) {
    if (!stages || stages.length === 0) return null;
    const allPending = stages.flatMap(s => s.milestones || []).filter(m => m.status === "pending");
    if (allPending.length === 0) return null;
    allPending.sort((a, b) => {
        if (!a.target_date) return 1;
        if (!b.target_date) return -1;
        return new Date(a.target_date) - new Date(b.target_date);
    });
    return allPending[0];
}

export function getStageStatusLabel(status) {
    switch (status) {
        case "not_started": return "Не розпочато";
        case "in_progress": return "В роботі";
        case "waiting_client": return "Очікує клієнта";
        case "blocked": return "Заблоковано";
        case "completed": return "Завершено";
        default: return status || "—";
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
