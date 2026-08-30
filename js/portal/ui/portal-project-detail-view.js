import { PortalAutomationView } from "./portal-automation-view.js";
/* js/portal/ui/portal-project-detail-view.js - Project Card, Overview, Roadmap, Team & Tasks */

import { DataClient } from "../api/data-client.js";
import { PortalAuth } from "../auth/auth-service.js";
import { getProjectStatusLabel, getHealthLabel, getProjectTypeLabel } from "./portal-projects-view.js";
import { 
    renderRoadmapView, 
    initRoadmapEvents, 
    calculateProjectProgress, 
    getCurrentStage, 
    getNextMilestone,
    getStageStatusLabel 
} from "./portal-roadmap-view.js";
import {
    renderProjectTasksView,
    initProjectTasksEvents
} from "./portal-project-tasks-view.js";
import {
    renderDocumentsTable,
    openCreateDocumentModal
} from "./portal-documents-view.js";
import {
    getMeetingTypeLabel,
    getMeetingStatusBadge,
    openCreateMeetingModal
} from "./portal-meetings-view.js";
import {
    renderProjectFinanceTab,
    loadAndRenderProjectFinance
} from "./portal-project-finance-tab.js";

export function renderProjectDetailView(projectId) {
    return `
        <div class="portal-content" id="project-detail-container" data-project-id="${projectId}">
            <div class="portal-loading-container">
                <div class="portal-spinner"></div>
                <span>Завантаження паспорта проєкту...</span>
            </div>
        </div>

        <!-- Modals Container -->
        <div id="project-detail-modal-mount"></div>
    `;
}

export async function initProjectDetailEvents(projectId) {
    await loadProjectDetail(projectId);
}

async function loadProjectDetail(projectId) {
    const container = document.getElementById("project-detail-container");
    if (!container) return;

    try {
        const [projectRes, roadmapRes, tasksRes, depsRes, docsRes, meetingsRes, nextMeetingRes] = await Promise.all([
            DataClient.getProjectById(projectId),
            DataClient.getProjectRoadmap(projectId),
            DataClient.getTasks({ projectId }),
            DataClient.getTaskDependencies(projectId),
            DataClient.getDocuments({ projectId, includeArchived: true }),
            DataClient.getMeetings({ projectId }),
            DataClient.getNextMeetingForProject(projectId)
        ]);

        const project = projectRes.data;
        const stages = roadmapRes.data || [];
        const tasks = tasksRes.data || [];
        const dependencies = depsRes.data || [];
        const documents = docsRes.data || [];
        const meetings = meetingsRes.data || [];
        const nextMeeting = nextMeetingRes?.data || null;

        if (projectRes.error || !project) {
            container.innerHTML = `
                <div class="portal-empty-state">
                    <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="alert-circle"></i></div>
                    <div class="portal-empty-title">Проєкт не знайдено</div>
                    <div class="portal-empty-desc">${projectRes.error ? projectRes.error.message : "Проєкт не існує або у вас немає прав доступу до нього."}</div>
                    <a href="#/portal/projects" class="btn btn-outline" style="margin-top: 12px;">
                        <i data-lucide="arrow-left"></i> Назад до списку
                    </a>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        const contactsRes = await DataClient.getContactsByOrg(project.organization_id);
        const contacts = contactsRes.data || [];

        const canManage = PortalAuth.isGlobalOwner() || PortalAuth.isOrgAdmin(project.organization_id);
        const org = project.organizations;
        const isInternal = PortalAuth.isStaff();
        const pm = project.responsible_pm;
        const members = project.project_memberships || [];
        const projectName = project.name || project.title || "Проєкт";
        const health = project.health || project.health_status || "on_track";
        const status = project.status || "draft";
        const startDate = project.start_date ? formatDate(project.start_date) : "—";
        const targetDate = (project.target_date || project.target_end_date) ? formatDate(project.target_date || project.target_end_date) : "—";
        const createdDate = new Date(project.created_at).toLocaleDateString("uk-UA", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        });
        const updatedDate = new Date(project.updated_at).toLocaleDateString("uk-UA", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        });

        // Roadmap metrics for Overview
        const overallProgress = calculateProjectProgress(stages);
        const currentStage = getCurrentStage(stages);
        const nextMilestone = getNextMilestone(stages);
        const totalMilestones = stages.reduce((acc, s) => acc + (s.milestones?.length || 0), 0);
        const completedMilestones = stages.reduce((acc, s) => acc + (s.milestones?.filter(m => m.status === "completed").length || 0), 0);

        // Task metrics for Overview
        const now = new Date().setHours(0, 0, 0, 0);
        const openTasks = tasks.filter(t => t.status !== "done").length;
        const overdueTasks = tasks.filter(t => t.status !== "done" && t.due_date && new Date(t.due_date).getTime() < now).length;
        const doneTasks = tasks.filter(t => t.status === "done").length;
        const waitingClientTasks = tasks.filter(t => t.status !== "done" && (t.status === "waiting_client" || t.responsibility_type === "client")).length;
        
        const pendingWithDeadline = tasks.filter(t => t.status !== "done" && t.due_date);
        pendingWithDeadline.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
        const nextTaskDeadline = pendingWithDeadline[0] || null;

        container.innerHTML = `
            <!-- Top Breadcrumb -->
            <div style="margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
                <a href="#/portal/projects" class="link-arrow" style="font-size: 0.88rem; color: var(--text-muted); display: inline-flex; align-items: center; gap: 6px;">
                    <i data-lucide="arrow-left" style="width: 14px; height: 14px;"></i> До списку проєктів
                </a>
                ${org ? `
                    <a href="#/portal/clients/${org.id}" style="font-size: 0.85rem; color: var(--text-secondary); display: inline-flex; align-items: center; gap: 6px;">
                        <i data-lucide="building" style="width: 13px; height: 13px;"></i> Клієнт: <strong>${escapeHtml(org.name)}</strong>
                    </a>
                ` : ""}
            </div>

            <!-- Project Header Card -->
            <div class="portal-card-header">
                <div class="portal-card-header-left">
                    <div class="portal-card-logo-large" style="background: linear-gradient(135deg, #1E293B, #2563EB);">
                        <i data-lucide="folder" style="width: 32px; height: 32px; color: #FFF;"></i>
                    </div>
                    <div>
                        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                            <h1 style="font-size: 1.7rem; margin: 0;">${escapeHtml(projectName)}</h1>
                            <span class="portal-badge portal-badge-status-${status}">
                                ${getProjectStatusLabel(status)}
                            </span>
                            <span class="portal-badge portal-badge-health-${health}">
                                <span class="portal-health-dot portal-health-dot-${health}"></span>
                                ${getHealthLabel(health)}
                            </span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 16px; margin-top: 6px; font-size: 0.85rem; color: var(--text-secondary); flex-wrap: wrap;">
                            ${org ? `<span><i data-lucide="building" style="width:13px;height:13px;vertical-align:middle;"></i> <a href="#/portal/clients/${org.id}" style="color:var(--color-primary);">${escapeHtml(org.name)}</a></span>` : ""}
                            <span><i data-lucide="tag" style="width:13px;height:13px;vertical-align:middle;"></i> ${getProjectTypeLabel(project.project_type)}</span>
                            <span><i data-lucide="calendar" style="width:13px;height:13px;vertical-align:middle;"></i> ${startDate} — ${targetDate}</span>
                        </div>
                    </div>
                </div>

                ${canManage ? `
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-outline" id="btn-edit-project">
                            <i data-lucide="edit-3"></i> Редагувати
                        </button>
                    </div>
                ` : ""}
            </div>

            <!-- Navigation Tabs -->
            <div class="portal-tabs-nav" id="project-card-tabs">
                <div class="portal-tab-btn active" data-tab="overview"><i data-lucide="info"></i> Паспорт проєкту</div>
                <div class="portal-tab-btn" data-tab="roadmap"><i data-lucide="milestone"></i> Дорожня карта (${stages.length})</div>
                <div class="portal-tab-btn" data-tab="team"><i data-lucide="users"></i> Команда (${members.length})</div>
                <div class="portal-tab-btn" data-tab="tasks"><i data-lucide="check-square"></i> Задачі (${tasks.length})</div>
                <div class="portal-tab-btn" data-tab="documents"><i data-lucide="file-text"></i> Документи (${documents.length})</div>
                <div class="portal-tab-btn" data-tab="meetings"><i data-lucide="video"></i> Зустрічі (${meetings.length})</div>
                ${canManage ? `
                    <div class="portal-tab-btn" data-tab="finance"><i data-lucide="dollar-sign"></i> Фінанси</div>
                ${isInternal ? '<div class="portal-tab-btn" data-tab="automation"><i data-lucide="settings"></i> Автоматизація</div>' : ''}
                ` : ""}
            </div>

            <!-- Tab 1: Overview -->
            <div class="portal-tab-content" id="tab-content-overview">
                <div class="portal-grid-2">
                    <div>
                        <!-- Project Passport Data -->
                        <div class="portal-section-card">
                            <div class="portal-section-card-title">
                                <span>Паспорт проєкту</span>
                            </div>
                            <div class="portal-detail-list">
                                <div class="portal-detail-item">
                                    <span class="portal-detail-label">Назва</span>
                                    <span class="portal-detail-value">${escapeHtml(projectName)}</span>
                                </div>
                                <div class="portal-detail-item">
                                    <span class="portal-detail-label">Клієнт / Організація</span>
                                    <span class="portal-detail-value">
                                        ${org ? `<a href="#/portal/clients/${org.id}" style="color: var(--color-primary);">${escapeHtml(org.name)}</a>` : "—"}
                                    </span>
                                </div>
                                <div class="portal-detail-item">
                                    <span class="portal-detail-label">Тип проєкту</span>
                                    <span class="portal-detail-value">${getProjectTypeLabel(project.project_type)}</span>
                                </div>
                                <div class="portal-detail-item">
                                    <span class="portal-detail-label">Статус</span>
                                    <span class="portal-detail-value">${getProjectStatusLabel(status)}</span>
                                </div>
                                <div class="portal-detail-item">
                                    <span class="portal-detail-label">Стан проєкту</span>
                                    <span class="portal-detail-value">${getHealthLabel(health)}</span>
                                </div>
                                <div class="portal-detail-item">
                                    <span class="portal-detail-label">Відповідальний PM</span>
                                    <span class="portal-detail-value">${pm ? escapeHtml(pm.full_name || pm.email) : "—"}</span>
                                </div>
                                <div class="portal-detail-item">
                                    <span class="portal-detail-label">Дата старту</span>
                                    <span class="portal-detail-value">${startDate}</span>
                                </div>
                                <div class="portal-detail-item">
                                    <span class="portal-detail-label">Планова дата завершення</span>
                                    <span class="portal-detail-value">${targetDate}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Scope & Goals -->
                        <div class="portal-section-card">
                            <div class="portal-section-card-title">
                                <span>Опис і цілі проєкту</span>
                            </div>
                            <div style="font-size: 0.88rem; color: var(--text-secondary); line-height: 1.6; white-space: pre-wrap; background: #131B2F; padding: 14px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                                ${escapeHtml(project.description || "Опис та скоуп цілей ще не додано.")}
                            </div>
                        </div>
                    </div>

                    <!-- Right Column: Roadmap Summary, Tasks Summary & Meta -->
                    <div>
                        <!-- Roadmap Execution Card -->
                        <div class="portal-section-card">
                            <div class="portal-section-card-title" style="display: flex; justify-content: space-between; align-items: center;">
                                <span>Прогрес і дорожня карта</span>
                                <button class="btn btn-sm btn-outline btn-switch-to-roadmap" style="padding: 2px 8px; font-size: 0.75rem;">
                                    Дорожня карта →
                                </button>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 14px; background: #131B2F; padding: 14px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                                <div>
                                    ${overallProgress !== null ? `
                                        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
                                            <span style="font-size: 0.82rem; color: var(--text-muted);">Загальний прогрес проєкту</span>
                                            <span style="font-size: 1.1rem; font-weight: 800; color: var(--color-primary);">${overallProgress}%</span>
                                        </div>
                                        <div class="portal-progress-bar" style="height: 6px;">
                                            <div class="portal-progress-fill" style="width: ${overallProgress}%;"></div>
                                        </div>
                                        <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 4px;">
                                            ${completedMilestones} з ${totalMilestones} контрольних точок виконано (${stages.length} етапів)
                                        </div>
                                    ` : `
                                        <div style="font-size: 0.88rem; font-weight: 600; color: var(--text-muted); padding: 4px 0;">
                                            Roadmap ще не створено
                                        </div>
                                    `}
                                </div>

                                <div style="border-top: 1px solid var(--border-color); padding-top: 10px; display: flex; flex-direction: column; gap: 6px;">
                                    <div style="font-size: 0.76rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Поточний активний етап:</div>
                                    <div style="font-weight: 600; font-size: 0.92rem; color: var(--text-primary);">
                                        ${currentStage ? escapeHtml(currentStage.name) : (stages.length > 0 ? "Всі етапи завершено 🎉" : "Етапи ще не сформовані")}
                                    </div>
                                    ${currentStage ? `
                                        <div style="font-size: 0.78rem; color: var(--text-secondary);">
                                            Статус: <span class="portal-badge portal-badge-stage-${currentStage.status}" style="padding: 1px 6px; font-size: 0.7rem;">${getStageStatusLabel(currentStage.status)}</span>
                                        </div>
                                    ` : ""}
                                </div>

                                <div style="border-top: 1px solid var(--border-color); padding-top: 10px; display: flex; flex-direction: column; gap: 4px;">
                                    <div style="font-size: 0.76rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Найближча контрольна точка:</div>
                                    ${nextMilestone ? `
                                        <div style="font-size: 0.88rem; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
                                            <i data-lucide="clock" style="width: 13px; height: 13px; color: var(--color-primary);"></i>
                                            <span>${escapeHtml(nextMilestone.name)}</span>
                                        </div>
                                        <div style="font-size: 0.78rem; color: var(--text-muted);">
                                            Дедлайн: ${nextMilestone.target_date ? formatDate(nextMilestone.target_date) : "Не вказано"}
                                        </div>
                                    ` : `
                                        <div style="font-size: 0.84rem; color: var(--text-muted);">
                                            Немає запланованих невиконаних пунктів
                                        </div>
                                    `}
                                </div>
                            </div>
                        </div>

                        <!-- Tasks Summary Card (Phase 2B Overview Additions) -->
                        <div class="portal-section-card">
                            <div class="portal-section-card-title" style="display: flex; justify-content: space-between; align-items: center;">
                                <span>Статус задач проєкту</span>
                                <button class="btn btn-sm btn-outline btn-switch-to-tasks" style="padding: 2px 8px; font-size: 0.75rem;">
                                    До задач →
                                </button>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 12px; background: #131B2F; padding: 14px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                                    <div style="background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                                        <div style="font-size: 0.74rem; color: var(--text-muted);">Відкриті задачі</div>
                                        <div style="font-size: 1.15rem; font-weight: 700; color: var(--color-primary);">${openTasks}</div>
                                    </div>
                                    <div style="background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                                        <div style="font-size: 0.74rem; color: var(--text-muted);">Виконано</div>
                                        <div style="font-size: 1.15rem; font-weight: 700; color: var(--color-success);">${doneTasks}</div>
                                    </div>
                                    <div style="background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                                        <div style="font-size: 0.74rem; color: var(--text-muted);">Протерміновано</div>
                                        <div style="font-size: 1.15rem; font-weight: 700; color: ${overdueTasks > 0 ? 'var(--color-danger)' : 'var(--text-secondary)'};">${overdueTasks}</div>
                                    </div>
                                    <div style="background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                                        <div style="font-size: 0.74rem; color: var(--text-muted);">Очікують клієнта</div>
                                        <div style="font-size: 1.15rem; font-weight: 700; color: #C084FC;">${waitingClientTasks}</div>
                                    </div>
                                </div>

                                <div style="border-top: 1px solid var(--border-color); padding-top: 8px; font-size: 0.78rem;">
                                    <span style="color: var(--text-muted);">Найближчий дедлайн задачі: </span>
                                    ${nextTaskDeadline ? `
                                        <strong style="color: var(--text-primary);">${escapeHtml(nextTaskDeadline.title)}</strong> (${formatDate(nextTaskDeadline.due_date)})
                                    ` : `<span style="color: var(--text-muted);">—</span>`}
                                </div>
                            </div>
                        </div>

                        <!-- Next Meeting Card (Phase 3B) -->
                        <div class="portal-section-card">
                            <div class="portal-section-card-title" style="display: flex; justify-content: space-between; align-items: center;">
                                <span>Наступна зустріч</span>
                                <button class="btn btn-sm btn-outline btn-switch-to-meetings" style="padding: 2px 8px; font-size: 0.75rem;">
                                    Всі зустрічі →
                                </button>
                            </div>
                            <div style="background: #131B2F; padding: 14px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                                ${nextMeeting ? `
                                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 8px;">
                                        <div>
                                            <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">
                                                <a href="#/portal/meetings/${nextMeeting.id}" class="portal-table-link">
                                                    ${escapeHtml(nextMeeting.title)}
                                                </a>
                                            </div>
                                            <div style="font-size: 0.78rem; color: var(--color-primary); margin-top: 2px;">
                                                ${getMeetingTypeLabel(nextMeeting.meeting_type)}
                                            </div>
                                        </div>
                                        <a href="#/portal/meetings/${nextMeeting.id}" class="btn btn-sm btn-primary" style="padding: 3px 8px; font-size: 0.75rem;">
                                            Відкрити
                                        </a>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 12px; font-size: 0.82rem; color: var(--text-secondary); margin-top: 8px; flex-wrap: wrap;">
                                        <span>📅 ${new Date(nextMeeting.start_at).toLocaleDateString("uk-UA", { day: "2-digit", month: "short" })}</span>
                                        <span>⏰ ${new Date(nextMeeting.start_at).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}</span>
                                        <span>👥 ${(nextMeeting.participants || []).length} учасн.</span>
                                    </div>
                                ` : `
                                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                                        <span style="font-size: 0.85rem; color: var(--text-muted);">Наступну зустріч не заплановано</span>
                                        ${canManage ? `
                                            <button class="btn btn-sm btn-outline" id="btn-overview-schedule-meeting" style="font-size: 0.75rem; padding: 3px 8px;">
                                                <i data-lucide="plus"></i> Запланувати
                                            </button>
                                        ` : ""}
                                    </div>
                                `}
                            </div>
                        </div>

                        <!-- Responsible Manager -->
                        <div class="portal-section-card">
                            <div class="portal-section-card-title">
                                <span>Відповідальний менеджер</span>
                            </div>
                            ${pm ? `
                                <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: #131B2F; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                                    <div style="width: 42px; height: 42px; border-radius: 50%; background: linear-gradient(135deg, #1E293B, #3B82F6); display: flex; align-items: center; justify-content: center; font-weight: 700; color: #FFF; font-size: 0.95rem;">
                                        ${pm.full_name ? pm.full_name.substring(0, 2).toUpperCase() : "PM"}
                                    </div>
                                    <div>
                                        <div style="font-weight: 600; font-size: 0.95rem;">${escapeHtml(pm.full_name || pm.email)}</div>
                                        <div style="font-size: 0.76rem; color: var(--text-muted);">${escapeHtml(pm.email)}</div>
                                    </div>
                                </div>
                            ` : `
                                <div style="color: var(--text-muted); font-size: 0.85rem; padding: 12px; background: #131B2F; border-radius: var(--radius-sm); text-align: center;">
                                    PM не призначений
                                </div>
                            `}
                        </div>

                        <!-- System Metadata -->
                        <div class="portal-section-card">
                            <div class="portal-section-card-title">
                                <span>Системні метадані</span>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.82rem;">
                                <div style="display: flex; justify-content: space-between;">
                                    <span style="color: var(--text-muted);">ID проєкту:</span>
                                    <span style="font-family: monospace; color: var(--text-secondary);">${project.id.substring(0, 8)}...</span>
                                </div>
                                <div style="display: flex; justify-content: space-between;">
                                    <span style="color: var(--text-muted);">Дата створення:</span>
                                    <span>${createdDate}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between;">
                                    <span style="color: var(--text-muted);">Останнє оновлення:</span>
                                    <span>${updatedDate}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tab 2: Roadmap (Phase 2A Active) -->
            <div class="portal-tab-content" id="tab-content-roadmap" style="display: none;">
                ${renderRoadmapView(project.id, stages, canManage)}
            </div>

            <!-- Tab 3: Team (Project Memberships) -->
            <div class="portal-tab-content" id="tab-content-team" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.2rem;">Команда проєкту</h3>
                        <p style="margin: 4px 0 0; font-size: 0.85rem; color: var(--text-secondary);">
                            Члени команди, які працюють над проєктом та мають доступ до його матеріалів
                        </p>
                    </div>
                    ${canManage ? `
                        <button class="btn btn-primary" id="btn-add-team-member">
                            <i data-lucide="user-plus"></i> Додати учасника
                        </button>
                    ` : ""}
                </div>

                <div id="team-members-container">
                    ${renderTeamMembersList(members, canManage)}
                </div>
            </div>

            <!-- Tab 4: Tasks (Phase 2B Active) -->
            <div class="portal-tab-content" id="tab-content-tasks" style="display: none;">
                ${renderProjectTasksView(project.id, tasks, stages, members, contacts, dependencies, canManage)}
            </div>

            <!-- Tab 5: Documents (Phase 3A Active) -->
            <div class="portal-tab-content" id="tab-content-documents" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.2rem;">Документи проєкту</h3>
                        <p style="margin: 4px 0 0; font-size: 0.85rem; color: var(--text-secondary);">
                            Матеріали, артефакти, звіти та регламенти даного проєкту
                        </p>
                    </div>
                    ${canManage ? `
                        <button class="btn btn-primary" id="btn-add-project-doc">
                            <i data-lucide="plus"></i> Додати документ
                        </button>
                    ` : ""}
                </div>

                ${documents.length > 0 ? `
                    <div id="project-docs-list-container">
                        ${renderDocumentsTable(documents)}
                    </div>
                ` : `
                    <div class="portal-empty-state" style="padding: 40px 20px;">
                        <div class="portal-empty-icon"><i data-lucide="file-text"></i></div>
                        <div class="portal-empty-title">У цьому проєкті ще немає документів</div>
                        <div class="portal-empty-desc">
                            Створіть перший документ або завантажте артефакт делівері.
                        </div>
                        ${canManage ? `
                            <button class="btn btn-primary" id="btn-add-first-project-doc" style="margin-top: 14px;">
                                <i data-lucide="plus"></i> Додати перший документ
                            </button>
                        ` : ""}
                    </div>
                `}
            </div>

            <!-- Tab 6: Meetings (Phase 3B Active) -->
            <div class="portal-tab-content" id="tab-content-meetings" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.2rem;">Зустрічі проєкту</h3>
                        <p style="margin: 4px 0 0; font-size: 0.85rem; color: var(--text-secondary);">
                            Розклад синхронізацій, адженди, протоколи, рішення та Action Items
                        </p>
                    </div>
                    ${canManage ? `
                        <button class="btn btn-primary" id="btn-add-project-meeting">
                            <i data-lucide="calendar-plus"></i> Запланувати зустріч
                        </button>
                    ` : ""}
                </div>

                ${meetings.length > 0 ? `
                    <div id="project-meetings-list-container">
                        <div class="portal-table-wrapper">
                            <table class="portal-table">
                                <thead>
                                    <tr>
                                        <th style="width: 180px;">Дата та час</th>
                                        <th>Назва зустрічі</th>
                                        <th>Тип</th>
                                        <th>Учасники</th>
                                        <th>Статус</th>
                                        <th style="text-align: right; width: 80px;">Дії</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${meetings.map(m => {
                                        const mStartDate = new Date(m.start_at);
                                        const mEndDate = new Date(m.end_at);
                                        const mDateStr = mStartDate.toLocaleDateString("uk-UA", { day: "2-digit", month: "short", year: "numeric" });
                                        const mTimeStr = `${mStartDate.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })} – ${mEndDate.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}`;
                                        const mParticipants = m.participants || [];
                                        const isRec = !!m.recurrence_series_id;

                                        return `
                                            <tr>
                                                <td style="white-space: nowrap;">
                                                    <div style="font-weight: 700; color: var(--text-primary); font-size: 0.9rem;">${mDateStr}</div>
                                                    <div style="color: var(--text-muted); font-size: 0.76rem;">${mTimeStr} (${escapeHtml(m.timezone || "Kyiv")})</div>
                                                </td>
                                                <td>
                                                    <div style="font-weight: 600;">
                                                        <a href="#/portal/meetings/${m.id}" class="portal-table-link" style="font-size: 0.92rem;">
                                                            ${escapeHtml(m.title)}
                                                        </a>
                                                        ${isRec ? `<span class="portal-badge portal-badge-info" style="font-size: 0.68rem; padding: 1px 5px; margin-left: 4px;">Серія</span>` : ""}
                                                    </div>
                                                    ${m.location_type === 'online' && m.meeting_url ? `
                                                        <div style="margin-top: 3px;">
                                                            <a href="${escapeHtml(m.meeting_url)}" target="_blank" rel="noopener noreferrer" style="color: var(--color-primary); font-size: 0.76rem; display: inline-flex; align-items: center; gap: 4px;">
                                                                <i data-lucide="video" style="width: 11px; height: 11px;"></i> Приєднатися до дзвінка
                                                            </a>
                                                        </div>
                                                    ` : (m.location_text ? `<div style="color: var(--text-muted); font-size: 0.76rem; margin-top: 2px;">📍 ${escapeHtml(m.location_text)}</div>` : "")}
                                                </td>
                                                <td>
                                                    <span class="portal-badge portal-badge-secondary" style="font-size: 0.78rem;">
                                                        ${getMeetingTypeLabel(m.meeting_type)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style="font-size: 0.8rem; color: var(--text-secondary);">
                                                        👥 ${mParticipants.length} учасн.
                                                    </div>
                                                </td>
                                                <td>
                                                    ${getMeetingStatusBadge(m.status)}
                                                </td>
                                                <td style="text-align: right;">
                                                    <a href="#/portal/meetings/${m.id}" class="btn btn-sm btn-outline" title="Відкрити зустріч" style="padding: 4px 8px;">
                                                        <i data-lucide="arrow-right" style="width: 13px; height: 13px;"></i>
                                                    </a>
                                                </td>
                                            </tr>
                                        `;
                                    }).join("")}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ` : `
                    <div class="portal-empty-state" style="padding: 40px 20px;">
                        <div class="portal-empty-icon"><i data-lucide="calendar-x"></i></div>
                        <div class="portal-empty-title">У цьому проєкті ще немає зустрічей</div>
                        <div class="portal-empty-desc">
                            Заплануйте першу зустріч або щотижневу серію синхронізацій з клієнтом.
                        </div>
                        ${canManage ? `
                            <button class="btn btn-primary" id="btn-add-first-project-meeting" style="margin-top: 14px;">
                                <i data-lucide="calendar-plus"></i> Запланувати першу зустріч
                            </button>
                        ` : ""}
                    </div>
                `}
            </div>

            <!-- Tab 8: Automation (Internal Only) -->
            ${isInternal ? `
                <div class="portal-tab-content" id="tab-content-automation" style="display: none;">
                    <div id="project-automation-container"></div>
                </div>
            ` : ""}

            <!-- Tab 7: Finance (Owner & PM Only) -->
            ${canManage ? `
                <div class="portal-tab-content" id="tab-content-finance" style="display: none;">
                    ${renderProjectFinanceTab(projectId, PortalAuth.isGlobalOwner(), canManage)}
                </div>
            ` : ""}
        `;

        if (window.lucide) window.lucide.createIcons();

        // Setup Tabs switching
        const tabs = document.querySelectorAll("#project-card-tabs .portal-tab-btn");
        function switchTab(target) {
            tabs.forEach(t => {
                if (t.getAttribute("data-tab") === target) {
                    t.classList.add("active");
                } else {
                    t.classList.remove("active");
                }
            });
            const overviewEl = document.getElementById("tab-content-overview");
            if (overviewEl) overviewEl.style.display = target === "overview" ? "block" : "none";
            const roadmapEl = document.getElementById("tab-content-roadmap");
            if (roadmapEl) roadmapEl.style.display = target === "roadmap" ? "block" : "none";
            const teamEl = document.getElementById("tab-content-team");
            if (teamEl) teamEl.style.display = target === "team" ? "block" : "none";
            const tasksEl = document.getElementById("tab-content-tasks");
            if (tasksEl) tasksEl.style.display = target === "tasks" ? "block" : "none";
            const docsEl = document.getElementById("tab-content-documents");
            if (docsEl) docsEl.style.display = target === "documents" ? "block" : "none";
            const meetingsEl = document.getElementById("tab-content-meetings");
            if (meetingsEl) meetingsEl.style.display = target === "meetings" ? "block" : "none";
            const financeEl = document.getElementById("tab-content-finance");
            if (financeEl) {
                financeEl.style.display = target === "finance" ? "block" : "none";
                if (target === "finance") {
                    loadAndRenderProjectFinance(projectId);
                }
            }
            const autoEl = document.getElementById("tab-content-automation");
            if (autoEl) {
                autoEl.style.display = target === "automation" ? "block" : "none";
                if (target === "automation") {
                    const autoTab = new PortalAutomationView("project-automation-container");
                    autoTab.render(projectId);
                }
            }
        }

        tabs.forEach(tab => {
            tab.addEventListener("click", () => {
                switchTab(tab.getAttribute("data-tab"));
            });
        });

        // Quick switch from Overview to Roadmap / Tasks / Meetings
        document.querySelectorAll(".btn-switch-to-roadmap").forEach(b => {
            b.addEventListener("click", () => switchTab("roadmap"));
        });
        document.querySelectorAll(".btn-switch-to-tasks").forEach(b => {
            b.addEventListener("click", () => switchTab("tasks"));
        });
        document.querySelectorAll(".btn-switch-to-meetings").forEach(b => {
            b.addEventListener("click", () => switchTab("meetings"));
        });

        // Initialize Roadmap View Events
        initRoadmapEvents(project.id, project.organization_id, stages, async () => {
            await loadProjectDetail(projectId);
        });

        // Initialize Project Tasks Events (Phase 2B)
        initProjectTasksEvents(project.id, project.organization_id, tasks, stages, members, contacts, dependencies, async () => {
            await loadProjectDetail(projectId);
        });

        // Project Documents Actions (Phase 3A)
        const openProjectDocModal = () => {
            openCreateDocumentModal(project.organization_id, project.id, async () => {
                await loadProjectDetail(projectId);
            });
        };
        document.getElementById("btn-add-project-doc")?.addEventListener("click", openProjectDocModal);
        document.getElementById("btn-add-first-project-doc")?.addEventListener("click", openProjectDocModal);

        // Project Meetings Actions (Phase 3B)
        const openProjectMeetingModal = () => {
            openCreateMeetingModal(
                org ? [org] : [],
                [project],
                async () => {
                    await loadProjectDetail(projectId);
                },
                project.id,
                project.organization_id
            );
        };
        document.getElementById("btn-add-project-meeting")?.addEventListener("click", openProjectMeetingModal);
        document.getElementById("btn-add-first-project-meeting")?.addEventListener("click", openProjectMeetingModal);
        document.getElementById("btn-overview-schedule-meeting")?.addEventListener("click", openProjectMeetingModal);

        document.querySelectorAll("#tab-content-documents .btn-download-latest-doc").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                e.stopPropagation();
                const storagePath = btn.dataset.storagePath;
                const filename = btn.dataset.filename;
                if (!storagePath) return;

                btn.disabled = true;
                try {
                    await DataClient.downloadDocumentFile(storagePath, filename);
                } catch (err) {
                    alert("Помилка завантаження файлу: " + (err.message || "Невідома помилка"));
                } finally {
                    btn.disabled = false;
                }
            });
        });

        // Edit Project Button
        document.getElementById("btn-edit-project")?.addEventListener("click", () => {
            openEditProjectModal(project, async () => {
                await loadProjectDetail(projectId);
            });
        });

        // Add Member Button
        document.getElementById("btn-add-team-member")?.addEventListener("click", () => {
            openAddMemberModal(project.id, members, async () => {
                await loadProjectDetail(projectId);
            });
        });

        // Attach Member Actions (Edit Role / Remove)
        attachMemberActionEvents(project.id, members, async () => {
            await loadProjectDetail(projectId);
        });

    } catch (err) {
        console.error("loadProjectDetail Error:", err);
        container.innerHTML = `
            <div class="portal-empty-state">
                <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="alert-circle"></i></div>
                <div class="portal-empty-title">Помилка</div>
                <div class="portal-empty-desc">${err.message}</div>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
    }
}

function renderTeamMembersList(members, canManage) {
    if (!members || members.length === 0) {
        return `
            <div class="portal-empty-state" style="background: #0E1526; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                <div class="portal-empty-icon"><i data-lucide="users"></i></div>
                <div class="portal-empty-title">Команда ще не призначена</div>
                <div class="portal-empty-desc">Додайте спеціалістів платформи для надання їм доступу до виконання задач проєкту.</div>
            </div>
        `;
    }

    return `
        <div class="portal-table-container">
            <table class="portal-table">
                <thead>
                    <tr>
                        <th>Учасник</th>
                        <th>Email</th>
                        <th>Глобальна роль</th>
                        <th>Роль у проєкті</th>
                        <th>Призначено</th>
                        ${canManage ? `<th style="text-align: right;">Дія</th>` : ""}
                    </tr>
                </thead>
                <tbody>
                    ${members.map(m => {
                        const prof = m.profiles;
                        const fullName = prof?.full_name || prof?.email?.split("@")[0] || "Користувач";
                        const initials = (fullName.substring(0, 2) || "U").toUpperCase();
                        const email = prof?.email || "—";
                        const globalRole = prof?.global_role || "member";
                        const assignedDate = new Date(m.created_at).toLocaleDateString("uk-UA", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric"
                        });

                        return `
                            <tr>
                                <td>
                                    <div style="display: flex; align-items: center; gap: 12px;">
                                        <div class="portal-user-avatar" style="width: 36px; height: 36px; font-size: 0.85rem;">
                                            ${initials}
                                        </div>
                                        <div style="display: flex; flex-direction: column;">
                                            <span style="font-weight: 600; font-size: 0.92rem; color: var(--text-primary);">
                                                ${escapeHtml(fullName)}
                                            </span>
                                        </div>
                                    </div>
                                </td>
                                <td style="font-size: 0.84rem; color: var(--text-secondary);">
                                    ${escapeHtml(email)}
                                </td>
                                <td>
                                    <span class="portal-badge portal-badge-role-${globalRole}">
                                        ${globalRole.toUpperCase()}
                                    </span>
                                </td>
                                <td>
                                    <span class="portal-badge" style="background: rgba(59,130,246,0.12); color: #60A5FA; border: 1px solid rgba(59,130,246,0.25);">
                                        ${getProjectRoleLabel(m.project_role)}
                                    </span>
                                </td>
                                <td style="font-size: 0.82rem; color: var(--text-muted);">
                                    ${assignedDate}
                                </td>
                                ${canManage ? `
                                    <td style="text-align: right;">
                                        <div style="display: inline-flex; gap: 6px;">
                                            <button class="btn btn-sm btn-outline btn-edit-member-role" data-membership-id="${m.id}" data-current-role="${m.project_role}" data-user-name="${escapeHtml(fullName)}" style="padding: 4px 10px; font-size: 0.78rem;">
                                                <i data-lucide="edit-2" style="width: 12px; height: 12px;"></i> Змінити роль
                                            </button>
                                            <button class="btn btn-sm btn-outline btn-remove-member" data-membership-id="${m.id}" data-user-name="${escapeHtml(fullName)}" style="padding: 4px 10px; font-size: 0.78rem; color: var(--color-danger); border-color: rgba(239,68,68,0.3);">
                                                <i data-lucide="user-x" style="width: 12px; height: 12px;"></i>
                                            </button>
                                        </div>
                                    </td>
                                ` : ""}
                            </tr>
                        `;
                    }).join("")}
                </tbody>
            </table>
        </div>
    `;
}

function attachMemberActionEvents(projectId, members, reloadCallback) {
    document.querySelectorAll(".btn-edit-member-role").forEach(btn => {
        btn.addEventListener("click", () => {
            const membershipId = btn.getAttribute("data-membership-id");
            const currentRole = btn.getAttribute("data-current-role");
            const userName = btn.getAttribute("data-user-name");
            openEditMemberRoleModal(membershipId, currentRole, userName, reloadCallback);
        });
    });

    document.querySelectorAll(".btn-remove-member").forEach(btn => {
        btn.addEventListener("click", () => {
            const membershipId = btn.getAttribute("data-membership-id");
            const userName = btn.getAttribute("data-user-name");
            openRemoveMemberModal(membershipId, userName, reloadCallback);
        });
    });
}

export async function openAddMemberModal(projectId, existingMembers, onSuccess) {
    const mount = document.getElementById("project-detail-modal-mount");
    if (!mount) return;

    const { data: staff } = await DataClient.getStaffProfiles();
    const existingUserIds = new Set((existingMembers || []).map(m => m.user_id));
    const availableStaff = (staff || []).filter(s => !existingUserIds.has(s.id));

    if (availableStaff.length === 0) {
        mount.innerHTML = `
            <div class="portal-modal-overlay" id="add-member-overlay">
                <div class="portal-modal" style="max-width: 440px;">
                    <div class="portal-modal-header">
                        <div class="portal-modal-title">Додати учасника</div>
                        <button id="btn-close-add-member" style="color: var(--text-muted); cursor: pointer; padding: 4px;">
                            <i data-lucide="x"></i>
                        </button>
                    </div>
                    <div class="portal-modal-body">
                        <p style="font-size: 0.9rem; color: var(--text-secondary);">
                            Всі наявні фахівці платформи вже додані до команди цього проєкту.
                        </p>
                    </div>
                    <div class="portal-modal-footer">
                        <button type="button" class="btn btn-outline" id="btn-ok-add-member">Зрозуміло</button>
                    </div>
                </div>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        document.getElementById("btn-close-add-member")?.addEventListener("click", () => mount.innerHTML = "");
        document.getElementById("btn-ok-add-member")?.addEventListener("click", () => mount.innerHTML = "");
        return;
    }

    const staffOptions = availableStaff.map(s => `
        <option value="${s.id}">${escapeHtml(s.full_name || s.email)} (${s.global_role.toUpperCase()}) — ${escapeHtml(s.email)}</option>
    `).join("");

    mount.innerHTML = `
        <div class="portal-modal-overlay" id="add-member-overlay">
            <div class="portal-modal" style="max-width: 500px;">
                <div class="portal-modal-header">
                    <div class="portal-modal-title">Призначити учасника на проєкт</div>
                    <button id="btn-close-add-member" style="color: var(--text-muted); cursor: pointer; padding: 4px;">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <form id="form-add-member">
                    <div class="portal-modal-body">
                        <div class="portal-form-group">
                            <label class="portal-label">Оберіть співробітника <span style="color: var(--color-danger);">*</span></label>
                            <select id="add-member-user-id" class="portal-select" required>
                                <option value="">-- Оберіть користувача --</option>
                                ${staffOptions}
                            </select>
                        </div>

                        <div class="portal-form-group">
                            <label class="portal-label">Роль у проєкті <span style="color: var(--color-danger);">*</span></label>
                            <select id="add-member-role" class="portal-select" required>
                                <option value="specialist" selected>Specialist (Спеціаліст)</option>
                                <option value="pm">Project Manager (PM)</option>
                                <option value="lead_consultant">Lead Consultant</option>
                                <option value="it_specialist">IT Specialist</option>
                                <option value="admin">Project Admin</option>
                                <option value="member">Team Member</option>
                            </select>
                        </div>

                        <div id="add-member-error" style="color: var(--color-danger); font-size: 0.82rem; display: none;"></div>
                    </div>
                    <div class="portal-modal-footer">
                        <button type="button" class="btn btn-outline" id="btn-cancel-add-member">Скасувати</button>
                        <button type="submit" class="btn btn-primary" id="btn-submit-add-member">
                            <i data-lucide="user-plus"></i> Призначити
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

    document.getElementById("btn-close-add-member")?.addEventListener("click", closeModal);
    document.getElementById("btn-cancel-add-member")?.addEventListener("click", closeModal);
    document.getElementById("add-member-overlay")?.addEventListener("click", (e) => {
        if (e.target.id === "add-member-overlay") closeModal();
    });

    const form = document.getElementById("form-add-member");
    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const userId = document.getElementById("add-member-user-id")?.value;
        const role = document.getElementById("add-member-role")?.value || "specialist";
        const errBox = document.getElementById("add-member-error");
        const btn = document.getElementById("btn-submit-add-member");

        if (!userId) return;

        if (errBox) errBox.style.display = "none";
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="portal-spinner" style="width:14px;height:14px;border-width:2px;"></span> Призначення...`;
        }

        try {
            const { error } = await DataClient.addProjectMember(projectId, userId, role);
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
                btn.innerHTML = `<i data-lucide="user-plus"></i> Призначити`;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    });
}

export function openEditMemberRoleModal(membershipId, currentRole, userName, onSuccess) {
    const mount = document.getElementById("project-detail-modal-mount");
    if (!mount) return;

    mount.innerHTML = `
        <div class="portal-modal-overlay" id="edit-role-overlay">
            <div class="portal-modal" style="max-width: 440px;">
                <div class="portal-modal-header">
                    <div class="portal-modal-title">Змінити роль учасника</div>
                    <button id="btn-close-edit-role" style="color: var(--text-muted); cursor: pointer; padding: 4px;">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <form id="form-edit-role">
                    <div class="portal-modal-body">
                        <p style="font-size: 0.88rem; color: var(--text-secondary); margin-top: 0;">
                            Учасник: <strong>${escapeHtml(userName)}</strong>
                        </p>

                        <div class="portal-form-group">
                            <label class="portal-label">Нова роль у проєкті</label>
                            <select id="edit-member-role-select" class="portal-select">
                                <option value="specialist" ${currentRole === "specialist" ? "selected" : ""}>Specialist (Спеціаліст)</option>
                                <option value="pm" ${currentRole === "pm" ? "selected" : ""}>Project Manager (PM)</option>
                                <option value="lead_consultant" ${currentRole === "lead_consultant" ? "selected" : ""}>Lead Consultant</option>
                                <option value="it_specialist" ${currentRole === "it_specialist" ? "selected" : ""}>IT Specialist</option>
                                <option value="admin" ${currentRole === "admin" ? "selected" : ""}>Project Admin</option>
                                <option value="member" ${currentRole === "member" ? "selected" : ""}>Team Member</option>
                            </select>
                        </div>

                        <div id="edit-role-error" style="color: var(--color-danger); font-size: 0.82rem; display: none;"></div>
                    </div>
                    <div class="portal-modal-footer">
                        <button type="button" class="btn btn-outline" id="btn-cancel-edit-role">Скасувати</button>
                        <button type="submit" class="btn btn-primary" id="btn-submit-edit-role">
                            <i data-lucide="check"></i> Зберегти роль
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

    document.getElementById("btn-close-edit-role")?.addEventListener("click", closeModal);
    document.getElementById("btn-cancel-edit-role")?.addEventListener("click", closeModal);
    document.getElementById("edit-role-overlay")?.addEventListener("click", (e) => {
        if (e.target.id === "edit-role-overlay") closeModal();
    });

    const form = document.getElementById("form-edit-role");
    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const role = document.getElementById("edit-member-role-select")?.value;
        const errBox = document.getElementById("edit-role-error");
        const btn = document.getElementById("btn-submit-edit-role");

        if (errBox) errBox.style.display = "none";
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="portal-spinner" style="width:14px;height:14px;border-width:2px;"></span> Збереження...`;
        }

        try {
            const { error } = await DataClient.updateProjectMemberRole(membershipId, role);
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
                btn.innerHTML = `<i data-lucide="check"></i> Зберегти роль`;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    });
}

export function openRemoveMemberModal(membershipId, userName, onSuccess) {
    const mount = document.getElementById("project-detail-modal-mount");
    if (!mount) return;

    mount.innerHTML = `
        <div class="portal-modal-overlay" id="remove-member-overlay">
            <div class="portal-modal" style="max-width: 440px;">
                <div class="portal-modal-header">
                    <div class="portal-modal-title" style="color: var(--color-danger); display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="alert-triangle"></i> Видалити з проєкту?
                    </div>
                    <button id="btn-close-remove-modal" style="color: var(--text-muted); cursor: pointer; padding: 4px;">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="portal-modal-body">
                    <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5;">
                        Ви дійсно бажаєте вилучити користувача <strong>${escapeHtml(userName)}</strong> зі складу команди цього проєкту? Користувач втратить доступ до задач та матеріалів проєкту.
                    </p>
                    <div id="remove-member-error" style="color: var(--color-danger); font-size: 0.82rem; display: none;"></div>
                </div>
                <div class="portal-modal-footer">
                    <button type="button" class="btn btn-outline" id="btn-cancel-remove">Скасувати</button>
                    <button type="button" class="btn btn-danger" id="btn-confirm-remove" style="background: var(--color-danger); color: #FFF;">
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

    document.getElementById("btn-close-remove-modal")?.addEventListener("click", closeModal);
    document.getElementById("btn-cancel-remove")?.addEventListener("click", closeModal);
    document.getElementById("remove-member-overlay")?.addEventListener("click", (e) => {
        if (e.target.id === "remove-member-overlay") closeModal();
    });

    document.getElementById("btn-confirm-remove")?.addEventListener("click", async () => {
        const btn = document.getElementById("btn-confirm-remove");
        const errBox = document.getElementById("remove-member-error");

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="portal-spinner" style="width:14px;height:14px;border-width:2px;"></span> Видалення...`;
        }

        try {
            const { error } = await DataClient.removeProjectMember(membershipId);
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

export async function openEditProjectModal(project, onSuccess) {
    const mount = document.getElementById("project-detail-modal-mount");
    if (!mount) return;

    const { data: staff } = await DataClient.getStaffProfiles();
    const pmOptions = (staff || []).map(p => `
        <option value="${p.id}" ${project.responsible_pm_id === p.id ? "selected" : ""}>
            ${escapeHtml(p.full_name || p.email)} (${p.global_role.toUpperCase()})
        </option>
    `).join("");

    const currentName = project.name || project.title || "";
    const currentHealth = project.health || project.health_status || "on_track";
    const currentStatus = project.status || "draft";
    const currentTarget = project.target_date || project.target_end_date || "";

    mount.innerHTML = `
        <div class="portal-modal-overlay" id="edit-project-overlay">
            <div class="portal-modal" style="max-width: 620px;">
                <div class="portal-modal-header">
                    <div class="portal-modal-title">Редагувати проєкт</div>
                    <button id="btn-close-edit-project" style="color: var(--text-muted); cursor: pointer; padding: 4px;">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <form id="form-edit-project">
                    <div class="portal-modal-body">
                        <div class="portal-form-group">
                            <label class="portal-label">Назва проєкту <span style="color: var(--color-danger);">*</span></label>
                            <input type="text" id="edit-project-name" class="portal-input" value="${escapeHtml(currentName)}" required />
                        </div>

                        <div class="portal-form-row">
                            <div class="portal-form-group">
                                <label class="portal-label">Тип послуги / проєкту</label>
                                <select id="edit-project-type" class="portal-select">
                                    <option value="custom" ${project.project_type === "custom" ? "selected" : ""}>Комплексний делівері</option>
                                    <option value="audit_sales" ${project.project_type === "audit_sales" ? "selected" : ""}>Аудит відділу продажів</option>
                                    <option value="crm_implementation" ${project.project_type === "crm_implementation" ? "selected" : ""}>Впровадження CRM</option>
                                    <option value="scripts_kpi" ${project.project_type === "scripts_kpi" ? "selected" : ""}>Скрипти та KPI</option>
                                    <option value="sales_training" ${project.project_type === "sales_training" ? "selected" : ""}>Тренінг з продажів</option>
                                    <option value="ai_automation" ${project.project_type === "ai_automation" ? "selected" : ""}>ШІ & Автоматизація</option>
                                </select>
                            </div>
                            <div class="portal-form-group">
                                <label class="portal-label">Відповідальний PM</label>
                                <select id="edit-project-pm-id" class="portal-select">
                                    <option value="">-- Не призначено --</option>
                                    ${pmOptions}
                                </select>
                            </div>
                        </div>

                        <div class="portal-form-row">
                            <div class="portal-form-group">
                                <label class="portal-label">Статус</label>
                                <select id="edit-project-status" class="portal-select">
                                    <option value="draft" ${currentStatus === "draft" ? "selected" : ""}>Чернетка</option>
                                    <option value="onboarding" ${currentStatus === "onboarding" ? "selected" : ""}>Онбординг</option>
                                    <option value="discovery" ${currentStatus === "discovery" ? "selected" : ""}>Аудит / Дослідження</option>
                                    <option value="in_progress" ${currentStatus === "in_progress" || currentStatus === "active" ? "selected" : ""}>В роботі</option>
                                    <option value="waiting_client" ${currentStatus === "waiting_client" || currentStatus === "waiting_for_client" ? "selected" : ""}>Очікує клієнта</option>
                                    <option value="blocked" ${currentStatus === "blocked" ? "selected" : ""}>Заблоковано</option>
                                    <option value="client_review" ${currentStatus === "client_review" || currentStatus === "review" ? "selected" : ""}>Погодження клієнтом</option>
                                    <option value="completed" ${currentStatus === "completed" ? "selected" : ""}>Завершено</option>
                                    <option value="paused" ${currentStatus === "paused" || currentStatus === "on_hold" ? "selected" : ""}>Призупинено</option>
                                    <option value="archived" ${currentStatus === "archived" ? "selected" : ""}>В архіві</option>
                                </select>
                            </div>
                            <div class="portal-form-group">
                                <label class="portal-label">Стан проєкту (Health)</label>
                                <select id="edit-project-health" class="portal-select">
                                    <option value="on_track" ${currentHealth === "on_track" ? "selected" : ""}>🟢 В нормі</option>
                                    <option value="at_risk" ${currentHealth === "at_risk" ? "selected" : ""}>🟡 Є ризик</option>
                                    <option value="delayed" ${currentHealth === "delayed" ? "selected" : ""}>🔴 Із затримкою</option>
                                </select>
                            </div>
                        </div>

                        <div class="portal-form-row">
                            <div class="portal-form-group">
                                <label class="portal-label">Дата старту</label>
                                <input type="date" id="edit-project-start-date" class="portal-input" value="${project.start_date || ''}" />
                            </div>
                            <div class="portal-form-group">
                                <label class="portal-label">Планова дата завершення</label>
                                <input type="date" id="edit-project-target-date" class="portal-input" value="${currentTarget}" />
                            </div>
                        </div>

                        <div class="portal-form-group">
                            <label class="portal-label">Опис та скоуп проєкту</label>
                            <textarea id="edit-project-description" class="portal-textarea">${escapeHtml(project.description || '')}</textarea>
                        </div>

                        <div id="edit-project-error" style="color: var(--color-danger); font-size: 0.82rem; display: none;"></div>
                    </div>
                    <div class="portal-modal-footer">
                        <button type="button" class="btn btn-outline" id="btn-cancel-edit-project">Скасувати</button>
                        <button type="submit" class="btn btn-primary" id="btn-submit-edit-project">
                            <i data-lucide="check"></i> Зберегти зміни
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

    document.getElementById("btn-close-edit-project")?.addEventListener("click", closeModal);
    document.getElementById("btn-cancel-edit-project")?.addEventListener("click", closeModal);
    document.getElementById("edit-project-overlay")?.addEventListener("click", (e) => {
        if (e.target.id === "edit-project-overlay") closeModal();
    });

    const form = document.getElementById("form-edit-project");
    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("edit-project-name")?.value.trim();
        const project_type = document.getElementById("edit-project-type")?.value || "custom";
        const responsible_pm_id = document.getElementById("edit-project-pm-id")?.value || null;
        const status = document.getElementById("edit-project-status")?.value;
        const health = document.getElementById("edit-project-health")?.value;
        const start_date = document.getElementById("edit-project-start-date")?.value || null;
        const target_date = document.getElementById("edit-project-target-date")?.value || null;
        const description = document.getElementById("edit-project-description")?.value.trim();
        const errBox = document.getElementById("edit-project-error");
        const btn = document.getElementById("btn-submit-edit-project");

        if (!name) return;

        if (errBox) errBox.style.display = "none";
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="portal-spinner" style="width:16px;height:16px;border-width:2px;"></span> Збереження...`;
        }

        try {
            const { error } = await DataClient.updateProject(project.id, {
                name,
                project_type,
                responsible_pm_id,
                status,
                health,
                start_date,
                target_date,
                description: description || null
            });

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
                btn.innerHTML = `<i data-lucide="check"></i> Зберегти зміни`;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    });
}

function getProjectRoleLabel(role) {
    switch (role) {
        case "pm": return "Project Manager";
        case "admin": return "Project Admin";
        case "lead_consultant": return "Lead Consultant";
        case "specialist": return "Specialist";
        case "it_specialist": return "IT Specialist";
        case "client_rep": return "Client Rep";
        case "member": return "Team Member";
        default: return role || "Member";
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
