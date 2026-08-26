/* js/client/ui/client-project-detail-view.js - Full Client Project Workspace */

import { DataClient } from "../../portal/api/data-client.js";

let activeProjectTab = "overview";

export function renderClientProjectDetailView(projectData, initialTab = "overview") {
    activeProjectTab = initialTab;
    const { project, stages = [], milestones = [], clientActions = [], documents = [], meetings = [], nextMeeting } = projectData;

    const title = project.name || project.title || "Проєкт делівері";
    const orgName = project.organization?.name || "Ваша компанія";
    const typeLabel = getProjectTypeLabel(project.project_type);
    const statusInfo = getProjectStatusBadge(project.status);
    const progressText = project.progress !== null ? `${project.progress}%` : "Готується";
    const pmName = project.responsible_pm?.full_name || "Команда FIRSTWIN";
    const targetDateFormatted = project.target_date ? formatDate(project.target_date) : (project.target_end_date ? formatDate(project.target_end_date) : "Уточнюється");

    const openActions = clientActions.filter(a => a.status !== "done");

    return `
        <div class="client-container">
            <!-- Breadcrumbs -->
            <div class="client-breadcrumbs" style="margin-bottom: 16px;">
                <a href="#/client/projects" class="client-breadcrumb-link">
                    <i data-lucide="arrow-left" style="width: 14px; height: 14px;"></i>
                    <span>Всі проєкти</span>
                </a>
                <span class="client-breadcrumb-sep">/</span>
                <span class="client-breadcrumb-current">${escapeHtml(title)}</span>
            </div>

            <!-- Project Hero Card / Header -->
            <div class="client-card client-project-hero">
                <div class="client-project-hero-main">
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
                            <span class="client-project-type-tag">${escapeHtml(typeLabel)}</span>
                            <span class="client-badge ${statusInfo.badgeClass}">${statusInfo.label}</span>
                            <span class="client-badge client-badge-neutral" style="font-size: 0.8rem;">
                                <i data-lucide="building" style="width: 12px; height: 12px;"></i> ${escapeHtml(orgName)}
                            </span>
                        </div>
                        <h1 class="client-project-hero-title">${escapeHtml(title)}</h1>
                        ${project.description ? `
                            <p class="client-project-hero-desc">${escapeHtml(project.description)}</p>
                        ` : ''}
                    </div>

                    <!-- Progress Summary Block -->
                    <div class="client-project-hero-progress">
                        <div class="client-progress-header">
                            <span class="client-progress-label">Виконання проєкту</span>
                            <span class="client-progress-val" style="font-size: 1.25rem; font-weight: 700; color: var(--color-primary);">${progressText}</span>
                        </div>
                        <div class="client-progress-track" style="height: 8px; margin-top: 6px;">
                            <div class="client-progress-fill" style="width: ${project.progress !== null ? project.progress : 0}%;"></div>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 0.8rem; color: var(--text-secondary);">
                            <span><i data-lucide="user-check" style="width: 12px; height: 12px; display: inline;"></i> PM: ${escapeHtml(pmName)}</span>
                            <span><i data-lucide="calendar" style="width: 12px; height: 12px; display: inline;"></i> До: ${targetDateFormatted}</span>
                        </div>
                    </div>
                </div>

                <!-- Tabs Navigation -->
                <div class="client-tabs-nav" id="client-project-tabs-bar">
                    <button class="client-tab-btn ${activeProjectTab === 'overview' ? 'active' : ''}" data-tab="overview">
                        <i data-lucide="layout-grid" style="width: 15px; height: 15px;"></i>
                        <span>Огляд</span>
                    </button>
                    <button class="client-tab-btn ${activeProjectTab === 'roadmap' ? 'active' : ''}" data-tab="roadmap">
                        <i data-lucide="map" style="width: 15px; height: 15px;"></i>
                        <span>Дорожня карта (${stages.length})</span>
                    </button>
                    <button class="client-tab-btn ${activeProjectTab === 'actions' ? 'active' : ''}" data-tab="actions">
                        <i data-lucide="check-square" style="width: 15px; height: 15px;"></i>
                        <span>Очікуємо від вас ${openActions.length > 0 ? `<span class="client-tab-counter-badge">${openActions.length}</span>` : `(${clientActions.length})`}</span>
                    </button>
                    <button class="client-tab-btn ${activeProjectTab === 'documents' ? 'active' : ''}" data-tab="documents">
                        <i data-lucide="file-text" style="width: 15px; height: 15px;"></i>
                        <span>Документи (${documents.length})</span>
                    </button>
                    <button class="client-tab-btn ${activeProjectTab === 'meetings' ? 'active' : ''}" data-tab="meetings">
                        <i data-lucide="video" style="width: 15px; height: 15px;"></i>
                        <span>Зустрічі (${meetings.length})</span>
                    </button>
                </div>
            </div>

            <!-- Tab Content Container -->
            <div id="client-project-tab-content" style="margin-top: 20px;">
                ${renderTabContent(projectData, activeProjectTab)}
            </div>
        </div>
    `;
}

function renderTabContent(projectData, tab) {
    if (tab === "roadmap") return renderRoadmapTab(projectData);
    if (tab === "actions") return renderActionsTab(projectData);
    if (tab === "documents") return renderDocumentsTab(projectData);
    if (tab === "meetings") return renderMeetingsTab(projectData);
    return renderOverviewTab(projectData);
}

// -----------------------------------------------------------------------------
// TAB 1: Огляд (Overview)
// -----------------------------------------------------------------------------
function renderOverviewTab(projectData) {
    const { project, stages = [], milestones = [], clientActions = [], documents = [], nextMeeting } = projectData;

    const currentStage = project.currentStage;
    const nextMilestone = project.nextMilestone;
    const topActions = clientActions.slice(0, 3);
    const topDocs = documents.slice(0, 3);
    const upcomingMilestones = milestones.filter(m => m.status !== "completed").slice(0, 4);

    return `
        <div class="client-overview-layout">
            <div class="client-overview-col-main">
                <!-- Current Stage Highlight -->
                <div class="client-card" style="margin-bottom: 20px;">
                    <div class="client-card-header">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div class="client-card-icon" style="background: rgba(99, 102, 241, 0.12); color: var(--color-primary);">
                                <i data-lucide="play-circle"></i>
                            </div>
                            <div>
                                <h3 class="client-card-title">Що відбувається зараз</h3>
                                <p class="client-card-subtitle">Активний етап виконання проєкту</p>
                            </div>
                        </div>
                        ${currentStage ? `
                            <span class="client-badge ${getStageStatusBadge(currentStage.status).badgeClass}">
                                ${getStageStatusBadge(currentStage.status).label}
                            </span>
                        ` : ''}
                    </div>

                    ${currentStage ? `
                        <div style="padding: 16px; background: var(--bg-card-subtle); border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-top: 12px;">
                            <h4 style="font-size: 1.05rem; font-weight: 600; margin-bottom: 6px; color: var(--text-primary);">
                                ${escapeHtml(currentStage.name)}
                            </h4>
                            <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 12px;">
                                ${currentStage.description ? escapeHtml(currentStage.description) : "Команда працює над реалізацією цілей даного етапу згідно з планом делівері."}
                            </p>
                            <div style="display: flex; gap: 16px; font-size: 0.82rem; color: var(--text-muted); flex-wrap: wrap;">
                                ${currentStage.target_date ? `<span><i data-lucide="calendar" style="width: 12px; height: 12px;"></i> Очікуване завершення: ${formatDate(currentStage.target_date)}</span>` : ''}
                                ${currentStage.progress !== null && currentStage.progress !== undefined ? `<span><i data-lucide="check-circle" style="width: 12px; height: 12px;"></i> Прогрес етапу: ${currentStage.progress}%</span>` : ''}
                            </div>
                        </div>
                    ` : `
                        <div style="padding: 24px; text-align: center; color: var(--text-secondary);">
                            <p>Дорожня карта готується командою делівері.</p>
                        </div>
                    `}
                </div>

                <!-- Client Actions Section -->
                <div class="client-card" style="margin-bottom: 20px;">
                    <div class="client-card-header">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div class="client-card-icon" style="background: rgba(245, 158, 11, 0.12); color: var(--color-warning);">
                                <i data-lucide="check-square"></i>
                            </div>
                            <div>
                                <h3 class="client-card-title">Очікуємо від вас</h3>
                                <p class="client-card-subtitle">Дії та матеріали, необхідні для делівері</p>
                            </div>
                        </div>
                        <button class="btn btn-sm btn-ghost" onclick="switchProjectTab('actions')">
                            Всі дії (${clientActions.length}) <i data-lucide="chevron-right" style="width: 14px; height: 14px;"></i>
                        </button>
                    </div>

                    ${topActions.length === 0 ? `
                        <div style="padding: 24px; text-align: center; color: var(--text-secondary);">
                            <i data-lucide="check-circle-2" style="width: 32px; height: 32px; color: var(--color-success); margin-bottom: 8px;"></i>
                            <p style="font-weight: 500;">Зараз від вас нічого не очікується</p>
                            <span style="font-size: 0.85rem; color: var(--text-muted);">Команда своєчасно повідомить, якщо знадобляться погодження чи доступи.</span>
                        </div>
                    ` : `
                        <div class="client-action-list" style="margin-top: 12px;">
                            ${topActions.map(a => renderActionRow(a)).join("")}
                        </div>
                    `}
                </div>

                <!-- Recent Documents Section -->
                <div class="client-card">
                    <div class="client-card-header">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div class="client-card-icon" style="background: rgba(16, 185, 129, 0.12); color: var(--color-success);">
                                <i data-lucide="file-text"></i>
                            </div>
                            <div>
                                <h3 class="client-card-title">Матеріали та документи</h3>
                                <p class="client-card-subtitle">Останні опубліковані артефакти</p>
                            </div>
                        </div>
                        <button class="btn btn-sm btn-ghost" onclick="switchProjectTab('documents')">
                            Всі документи (${documents.length}) <i data-lucide="chevron-right" style="width: 14px; height: 14px;"></i>
                        </button>
                    </div>

                    ${topDocs.length === 0 ? `
                        <div style="padding: 24px; text-align: center; color: var(--text-secondary);">
                            <p>Матеріали ще готуються</p>
                        </div>
                    ` : `
                        <div class="client-doc-list" style="margin-top: 12px;">
                            ${topDocs.map(d => renderDocRow(d)).join("")}
                        </div>
                    `}
                </div>
            </div>

            <!-- Sidebar Column -->
            <div class="client-overview-col-side">
                <!-- Next Meeting Widget -->
                <div class="client-card" style="margin-bottom: 20px;">
                    <div class="client-card-header" style="margin-bottom: 12px;">
                        <h3 class="client-card-title" style="font-size: 0.95rem;">Наступна зустріч</h3>
                        <button class="btn btn-sm btn-ghost" onclick="switchProjectTab('meetings')" style="padding: 2px 6px;">
                            <i data-lucide="calendar" style="width: 13px; height: 13px;"></i>
                        </button>
                    </div>

                    ${nextMeeting ? `
                        <div class="client-meeting-compact-box">
                            <div class="client-meeting-compact-date">
                                <div class="client-meeting-compact-month">${new Date(nextMeeting.start_at).toLocaleDateString('uk-UA', { month: 'short' }).toUpperCase()}</div>
                                <div class="client-meeting-compact-day">${new Date(nextMeeting.start_at).getDate()}</div>
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <h4 class="client-meeting-compact-title">${escapeHtml(nextMeeting.title)}</h4>
                                <div class="client-meeting-compact-time">
                                    <i data-lucide="clock" style="width: 12px; height: 12px;"></i>
                                    ${formatTime(nextMeeting.start_at)} - ${formatTime(nextMeeting.end_at)}
                                </div>
                            </div>
                        </div>
                        ${nextMeeting.meeting_url ? `
                            <a href="${escapeHtml(nextMeeting.meeting_url)}" target="_blank" rel="noopener" class="btn btn-primary btn-sm" style="width: 100%; justify-content: center; margin-top: 12px;">
                                <i data-lucide="video" style="width: 14px; height: 14px;"></i> Приєднатися до дзвінка
                            </a>
                        ` : ''}
                        <button class="btn btn-outline btn-sm" onclick="window.location.hash = '#/client/meetings/${nextMeeting.id}'" style="width: 100%; justify-content: center; margin-top: 8px;">
                            Деталі та адженда
                        </button>
                    ` : `
                        <div style="padding: 16px; text-align: center; color: var(--text-secondary); font-size: 0.88rem;">
                            <p>Наступних зустрічей не заплановано</p>
                        </div>
                    `}
                </div>

                <!-- Upcoming Milestones Widget -->
                <div class="client-card">
                    <div class="client-card-header" style="margin-bottom: 12px;">
                        <h3 class="client-card-title" style="font-size: 0.95rem;">Найближчі контрольні точки</h3>
                    </div>

                    ${upcomingMilestones.length === 0 ? `
                        <div style="padding: 16px; text-align: center; color: var(--text-secondary); font-size: 0.88rem;">
                            <p>Усі контрольні точки досягнуто або вони формуються.</p>
                        </div>
                    ` : `
                        <div class="client-milestone-compact-list">
                            ${upcomingMilestones.map(m => `
                                <div class="client-milestone-compact-item">
                                    <div class="client-milestone-compact-dot"></div>
                                    <div style="flex: 1; min-width: 0;">
                                        <div class="client-milestone-compact-name">${escapeHtml(m.name)}</div>
                                        ${m.target_date ? `
                                            <div class="client-milestone-compact-date">
                                                <i data-lucide="calendar" style="width: 11px; height: 11px;"></i>
                                                Ціль: ${formatDate(m.target_date)}
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            `).join("")}
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;
}

// -----------------------------------------------------------------------------
// TAB 2: Дорожня карта (Roadmap)
// -----------------------------------------------------------------------------
function renderRoadmapTab(projectData) {
    const { stages = [], milestones = [] } = projectData;

    if (stages.length === 0) {
        return `
            <div class="client-card" style="text-align: center; padding: 60px 20px;">
                <div class="portal-empty-icon" style="color: var(--text-muted); margin-bottom: 16px;">
                    <i data-lucide="map" style="width: 48px; height: 48px;"></i>
                </div>
                <h3 style="font-size: 1.15rem; font-weight: 600; margin-bottom: 8px;">Дорожня карта готується</h3>
                <p style="color: var(--text-secondary); max-width: 440px; margin: 0 auto;">
                    Команда делівері формує послідовність етапів та контрольних точок для цього проєкту.
                </p>
            </div>
        `;
    }

    return `
        <div class="client-roadmap-container">
            <div class="client-roadmap-timeline">
                ${stages.map((stage, idx) => {
                    const stageMilestones = milestones.filter(m => m.stage_id === stage.id);
                    const statusInfo = getStageStatusBadge(stage.status);
                    const progressVal = stage.progress !== null && stage.progress !== undefined ? `${stage.progress}%` : null;

                    return `
                        <div class="client-roadmap-stage-card ${stage.status === 'in_progress' ? 'active-stage' : ''}">
                            <div class="client-roadmap-stage-marker">
                                <div class="client-roadmap-marker-dot ${stage.status}">
                                    ${stage.status === 'completed' ? '<i data-lucide="check" style="width: 12px; height: 12px;"></i>' : (idx + 1)}
                                </div>
                            </div>

                            <div class="client-roadmap-stage-body client-card">
                                <div class="client-roadmap-stage-header">
                                    <div>
                                        <span class="client-roadmap-stage-num">Етап ${idx + 1}</span>
                                        <h3 class="client-roadmap-stage-title">${escapeHtml(stage.name)}</h3>
                                    </div>
                                    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                                        ${progressVal ? `
                                            <span class="client-badge client-badge-neutral" style="font-weight: 600;">
                                                ${progressVal}
                                            </span>
                                        ` : ''}
                                        <span class="client-badge ${statusInfo.badgeClass}">
                                            ${statusInfo.label}
                                        </span>
                                    </div>
                                </div>

                                ${stage.description ? `
                                    <p class="client-roadmap-stage-desc">${escapeHtml(stage.description)}</p>
                                ` : ''}

                                <div class="client-roadmap-stage-dates">
                                    ${stage.start_date ? `<span><i data-lucide="play" style="width: 11px; height: 11px;"></i> Старт: ${formatDate(stage.start_date)}</span>` : ''}
                                    ${stage.target_date ? `<span><i data-lucide="flag" style="width: 11px; height: 11px;"></i> Дедлайн: ${formatDate(stage.target_date)}</span>` : ''}
                                </div>

                                <!-- Milestones checklist -->
                                ${stageMilestones.length > 0 ? `
                                    <div class="client-roadmap-milestones-box">
                                        <div class="client-milestones-title">Контрольні точки етапу (${stageMilestones.filter(m => m.status === 'completed').length}/${stageMilestones.length}):</div>
                                        <div class="client-milestones-list">
                                            ${stageMilestones.map(m => {
                                                const isDone = m.status === 'completed';
                                                const isOverdue = !isDone && m.target_date && new Date(m.target_date) < new Date();

                                                return `
                                                    <div class="client-milestone-item ${isDone ? 'completed' : ''}">
                                                        <div class="client-milestone-checkbox ${isDone ? 'checked' : ''}">
                                                            ${isDone ? '<i data-lucide="check" style="width: 12px; height: 12px;"></i>' : ''}
                                                        </div>
                                                        <div style="flex: 1; min-width: 0;">
                                                            <div class="client-milestone-name ${isDone ? 'done-text' : ''}">${escapeHtml(m.name)}</div>
                                                            ${m.description ? `<div class="client-milestone-desc">${escapeHtml(m.description)}</div>` : ''}
                                                        </div>
                                                        <div class="client-milestone-meta">
                                                            ${isDone && m.completed_at ? `
                                                                <span class="client-milestone-date done"><i data-lucide="check" style="width: 11px; height: 11px;"></i> ${formatDate(m.completed_at)}</span>
                                                            ` : (m.target_date ? `
                                                                <span class="client-milestone-date ${isOverdue ? 'overdue' : ''}">
                                                                    <i data-lucide="calendar" style="width: 11px; height: 11px;"></i> ${formatDate(m.target_date)}
                                                                </span>
                                                            ` : '')}
                                                        </div>
                                                    </div>
                                                `;
                                            }).join("")}
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join("")}
            </div>
        </div>
    `;
}

// -----------------------------------------------------------------------------
// TAB 3: Очікуємо від вас (Project Actions)
// -----------------------------------------------------------------------------
function renderActionsTab(projectData) {
    const { clientActions = [], project } = projectData;

    return `
        <div class="client-card">
            <div class="client-card-header" style="margin-bottom: 16px;">
                <div>
                    <h3 class="client-card-title">Дії з боку клієнта для цього проєкту</h3>
                    <p class="client-card-subtitle">Чекліст погоджень, допусків та матеріалів, що очікуються від вас.</p>
                </div>
            </div>

            ${clientActions.length === 0 ? `
                <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                    <i data-lucide="check-circle-2" style="width: 40px; height: 40px; color: var(--color-success); margin-bottom: 10px;"></i>
                    <h4 style="font-size: 1.05rem; font-weight: 600; margin-bottom: 4px;">Зараз від вас нічого не очікується</h4>
                    <p style="font-size: 0.9rem; color: var(--text-muted);">Всі задачі та доступи надано або виконано.</p>
                </div>
            ` : `
                <div class="client-action-list">
                    ${clientActions.map(a => renderActionRow(a, true)).join("")}
                </div>
            `}
        </div>
    `;
}

// -----------------------------------------------------------------------------
// TAB 4: Документи (Project Documents)
// -----------------------------------------------------------------------------
function renderDocumentsTab(projectData) {
    const { documents = [], project } = projectData;

    return `
        <div class="client-card">
            <div class="client-card-header" style="margin-bottom: 16px;">
                <div>
                    <h3 class="client-card-title">Матеріали та артефакти проєкту</h3>
                    <p class="client-card-subtitle">Затверджені звіти, регламенти, скрипти та робочі файли.</p>
                </div>
            </div>

            ${documents.length === 0 ? `
                <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                    <i data-lucide="file-text" style="width: 40px; height: 40px; color: var(--text-muted); margin-bottom: 10px;"></i>
                    <h4 style="font-size: 1.05rem; font-weight: 600; margin-bottom: 4px;">Матеріали ще готуються</h4>
                    <p style="font-size: 0.9rem; color: var(--text-muted);">Документи з'являться тут після їх формування та публікації командою.</p>
                </div>
            ` : `
                <div class="client-doc-grid">
                    ${documents.map(d => renderDocCard(d)).join("")}
                </div>
            `}
        </div>
    `;
}

// -----------------------------------------------------------------------------
// TAB 5: Зустрічі (Project Meetings)
// -----------------------------------------------------------------------------
function renderMeetingsTab(projectData) {
    const { meetings = [] } = projectData;

    return `
        <div class="client-card">
            <div class="client-card-header" style="margin-bottom: 16px;">
                <div>
                    <h3 class="client-card-title">Синхронізаційні зустрічі проєкту</h3>
                    <p class="client-card-subtitle">Графік запланованих та проведених спільних дзвінків.</p>
                </div>
            </div>

            ${meetings.length === 0 ? `
                <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                    <i data-lucide="video" style="width: 40px; height: 40px; color: var(--text-muted); margin-bottom: 10px;"></i>
                    <h4 style="font-size: 1.05rem; font-weight: 600; margin-bottom: 4px;">Наступних зустрічей не заплановано</h4>
                    <p style="font-size: 0.9rem; color: var(--text-muted);">Команда призначить синхронізацію відповідно до графіка делівері.</p>
                </div>
            ` : `
                <div class="client-meetings-list">
                    ${meetings.map(m => renderMeetingCard(m)).join("")}
                </div>
            `}
        </div>
    `;
}

// -----------------------------------------------------------------------------
// Shared Sub-renderers
// -----------------------------------------------------------------------------
function renderActionRow(a, showStage = false) {
    const isDone = a.status === "done";
    const isOverdue = !isDone && a.due_date && new Date(a.due_date) < new Date();

    return `
        <div class="client-action-item ${isDone ? 'done' : ''}" data-task-id="${a.id}">
            <div class="client-action-left">
                <div class="client-action-title ${isDone ? 'done-text' : ''}">${escapeHtml(a.title)}</div>
                ${a.description ? `<div class="client-action-desc">${escapeHtml(a.description)}</div>` : ''}
                <div class="client-action-meta">
                    ${a.due_date ? `
                        <span class="client-action-due ${isOverdue ? 'overdue' : ''}">
                            <i data-lucide="calendar" style="width: 11px; height: 11px;"></i>
                            Термін: ${formatDate(a.due_date)} ${isOverdue ? '(Прострочено)' : ''}
                        </span>
                    ` : ''}
                    ${showStage && a.stage ? `
                        <span class="client-action-stage">
                            <i data-lucide="play-circle" style="width: 11px; height: 11px;"></i>
                            ${escapeHtml(a.stage.name)}
                        </span>
                    ` : ''}
                </div>
            </div>

            <div class="client-action-cta">
                ${isDone ? `
                    <button class="btn btn-sm btn-outline btn-reopen-action" data-task-id="${a.id}" title="Повернути до виконання">
                        <i data-lucide="rotate-ccw" style="width: 13px; height: 13px;"></i> Повернути
                    </button>
                    <span class="client-badge client-badge-success"><i data-lucide="check" style="width: 12px; height: 12px;"></i> Виконано</span>
                ` : `
                    <button class="btn btn-sm btn-primary btn-complete-action" data-task-id="${a.id}">
                        <i data-lucide="check" style="width: 13px; height: 13px;"></i> Позначити виконаним
                    </button>
                `}
            </div>
        </div>
    `;
}

function renderDocRow(d) {
    const latestVer = d.latestVersion;
    const hasFile = !!latestVer;

    return `
        <div class="client-doc-row" onclick="window.location.hash = '#/client/documents/${d.id}'" style="cursor: pointer;">
            <div class="client-doc-row-icon">
                <i data-lucide="file-text"></i>
            </div>
            <div style="flex: 1; min-width: 0;">
                <div class="client-doc-row-title">${escapeHtml(d.title)}</div>
                <div class="client-doc-row-meta">
                    <span class="client-badge client-badge-neutral" style="font-size: 0.75rem;">${escapeHtml(d.category)}</span>
                    ${hasFile ? `<span>Версія ${latestVer.version_number} • ${formatFileSize(latestVer.size_bytes)}</span>` : '<span style="color: var(--text-muted);">Готується</span>'}
                </div>
            </div>
            <div class="client-doc-row-action">
                <i data-lucide="chevron-right" style="width: 16px; height: 16px; color: var(--text-muted);"></i>
            </div>
        </div>
    `;
}

function renderDocCard(d) {
    const latestVer = d.latestVersion;
    const hasFile = !!latestVer;
    const statusBadge = getDocStatusBadge(d.status);

    return `
        <div class="client-card client-doc-card" onclick="window.location.hash = '#/client/documents/${d.id}'" style="cursor: pointer;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                <span class="client-badge client-badge-neutral">${escapeHtml(d.category)}</span>
                <span class="client-badge ${statusBadge.badgeClass}">${statusBadge.label}</span>
            </div>
            <h4 class="client-doc-card-title">${escapeHtml(d.title)}</h4>
            ${d.description ? `<p class="client-doc-card-desc">${escapeHtml(d.description)}</p>` : ''}

            <div class="client-doc-card-footer">
                <div class="client-doc-card-ver">
                    ${hasFile ? `
                        <i data-lucide="file-check" style="width: 13px; height: 13px; color: var(--color-success);"></i>
                        Версія v${latestVer.version_number} (${formatFileSize(latestVer.size_bytes)})
                    ` : `
                        <i data-lucide="clock" style="width: 13px; height: 13px; color: var(--text-muted);"></i>
                        Готується
                    `}
                </div>
                <div class="client-doc-card-link">
                    <span>Відкрити</span>
                    <i data-lucide="arrow-right" style="width: 13px; height: 13px;"></i>
                </div>
            </div>
        </div>
    `;
}

function renderMeetingCard(m) {
    const isUpcoming = m.status === 'scheduled' && new Date(m.start_at) >= new Date(Date.now() - 30 * 60 * 1000);
    const dateFormatted = formatDate(m.start_at);
    const timeFormatted = `${formatTime(m.start_at)} - ${formatTime(m.end_at)}`;

    return `
        <div class="client-card client-meeting-card" style="margin-bottom: 12px;">
            <div class="client-meeting-card-header">
                <div style="display: flex; gap: 14px; align-items: center;">
                    <div class="client-meeting-date-badge ${isUpcoming ? 'upcoming' : ''}">
                        <div class="client-meeting-date-month">${new Date(m.start_at).toLocaleDateString('uk-UA', { month: 'short' }).toUpperCase()}</div>
                        <div class="client-meeting-date-day">${new Date(m.start_at).getDate()}</div>
                    </div>
                    <div>
                        <h4 class="client-meeting-title">${escapeHtml(m.title)}</h4>
                        <div class="client-meeting-time-str">
                            <i data-lucide="clock" style="width: 12px; height: 12px;"></i>
                            ${dateFormatted}, ${timeFormatted} (${escapeHtml(m.timezone || 'Kyiv')})
                        </div>
                    </div>
                </div>

                <div class="client-meeting-actions">
                    ${m.meeting_url ? `
                        <a href="${escapeHtml(m.meeting_url)}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">
                            <i data-lucide="video" style="width: 13px; height: 13px;"></i> Приєднатися
                        </a>
                    ` : ''}
                    <button class="btn btn-outline btn-sm" onclick="window.location.hash = '#/client/meetings/${m.id}'">
                        Деталі
                    </button>
                </div>
            </div>
        </div>
    `;
}

// -----------------------------------------------------------------------------
// Events & Interactive Handlers
// -----------------------------------------------------------------------------
export function initClientProjectDetailEvents(projectData, onRefresh) {
    if (window.lucide) window.lucide.createIcons();

    // Tab buttons
    document.querySelectorAll("#client-project-tabs-bar .client-tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const tabName = btn.dataset.tab;
            if (tabName) {
                switchProjectTab(tabName, projectData);
            }
        });
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

export function switchProjectTab(tabName, projectData) {
    activeProjectTab = tabName;
    document.querySelectorAll("#client-project-tabs-bar .client-tab-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tab === tabName);
    });
    const container = document.getElementById("client-project-tab-content");
    if (container && projectData) {
        container.innerHTML = renderTabContent(projectData, tabName);
        if (window.lucide) window.lucide.createIcons();
    }
}

// Global expose for onclick tabs
window.switchProjectTab = (tab) => {
    const btn = document.querySelector(`#client-project-tabs-bar .client-tab-btn[data-tab="${tab}"]`);
    if (btn) btn.click();
};

function getProjectTypeLabel(type) {
    const map = {
        audit_sales: "Аудит відділу продажу",
        crm_implementation: "Впровадження CRM",
        scripts_kpi: "Скрипти та KPI",
        sales_training: "Тренінг з продажу",
        ai_automation: "ШІ-автоматизація",
        custom: "Індивідуальний проєкт"
    };
    return map[type] || "Проєкт делівері";
}

function getProjectStatusBadge(status) {
    const map = {
        draft: { label: "Чернетка", badgeClass: "client-badge-neutral" },
        onboarding: { label: "Онбординг", badgeClass: "client-badge-info" },
        discovery: { label: "Дослідження", badgeClass: "client-badge-info" },
        in_progress: { label: "У роботі", badgeClass: "client-badge-primary" },
        waiting_client: { label: "Очікуємо клієнта", badgeClass: "client-badge-warning" },
        blocked: { label: "Заблоковано", badgeClass: "client-badge-danger" },
        client_review: { label: "На погодженні", badgeClass: "client-badge-warning" },
        completed: { label: "Завершено", badgeClass: "client-badge-success" },
        paused: { label: "Призупинено", badgeClass: "client-badge-neutral" }
    };
    return map[status] || { label: "У роботі", badgeClass: "client-badge-primary" };
}

function getStageStatusBadge(status) {
    const map = {
        not_started: { label: "Не розпочато", badgeClass: "client-badge-neutral" },
        in_progress: { label: "У роботі", badgeClass: "client-badge-primary" },
        waiting_client: { label: "Очікуємо клієнта", badgeClass: "client-badge-warning" },
        blocked: { label: "Заблоковано", badgeClass: "client-badge-danger" },
        completed: { label: "Завершено", badgeClass: "client-badge-success" }
    };
    return map[status] || { label: "У роботі", badgeClass: "client-badge-primary" };
}

function getDocStatusBadge(status) {
    const map = {
        draft: { label: "Чернетка", badgeClass: "client-badge-neutral" },
        internal_review: { label: "На перевірці", badgeClass: "client-badge-info" },
        client_review: { label: "Потрібне погодження", badgeClass: "client-badge-warning" },
        changes_requested: { label: "Запрошено зміни", badgeClass: "client-badge-danger" },
        approved: { label: "Погоджено", badgeClass: "client-badge-success" },
        final: { label: "Фінальний", badgeClass: "client-badge-success" }
    };
    return map[status] || { label: "Документ", badgeClass: "client-badge-neutral" };
}

function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" });
}

function formatTime(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
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
