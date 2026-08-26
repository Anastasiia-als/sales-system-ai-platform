/* js/client/ui/client-meeting-detail-view.js - Client-Safe Meeting Detail & Materials */

import { DataClient } from "../../portal/api/data-client.js";

export function renderClientMeetingDetailView(meetingData) {
    const { meeting, participants = [], notes = [], decisions = [], attachedDocuments = [], tasks = [] } = meetingData;

    const projectName = meeting.project?.name || meeting.project?.title || "Проєкт";
    const typeLabel = getMeetingTypeLabel(meeting.meeting_type);
    const statusBadge = getMeetingStatusBadge(meeting.status);
    const dateFormatted = formatDate(meeting.start_at);
    const timeFormatted = `${formatTime(meeting.start_at)} - ${formatTime(meeting.end_at)}`;
    const isUpcoming = meeting.status === 'scheduled' && new Date(meeting.start_at) >= new Date(Date.now() - 30 * 60 * 1000);

    return `
        <div class="client-container">
            <!-- Breadcrumbs -->
            <div class="client-breadcrumbs" style="margin-bottom: 16px;">
                <a href="#/client/meetings" class="client-breadcrumb-link">
                    <i data-lucide="arrow-left" style="width: 14px; height: 14px;"></i>
                    <span>Всі зустрічі</span>
                </a>
                <span class="client-breadcrumb-sep">/</span>
                <span class="client-breadcrumb-current">${escapeHtml(meeting.title)}</span>
            </div>

            <!-- Meeting Hero Card -->
            <div class="client-card" style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap;">
                    <div>
                        <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 6px; flex-wrap: wrap;">
                            <span class="client-badge client-badge-neutral">
                                <i data-lucide="folder" style="width: 11px; height: 11px;"></i> ${escapeHtml(projectName)}
                            </span>
                            <span class="client-project-type-tag">${escapeHtml(typeLabel)}</span>
                            <span class="client-badge ${statusBadge.badgeClass}">${statusBadge.label}</span>
                        </div>
                        <h1 class="client-page-title" style="font-size: 1.5rem; margin-bottom: 8px;">${escapeHtml(meeting.title)}</h1>
                        ${meeting.description ? `
                            <p style="font-size: 0.95rem; color: var(--text-secondary); line-height: 1.6; margin-bottom: 12px;">
                                ${escapeHtml(meeting.description)}
                            </p>
                        ` : ''}
                    </div>

                    <!-- Actions / Links -->
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        ${isUpcoming && meeting.meeting_url ? `
                            <a href="${escapeHtml(meeting.meeting_url)}" target="_blank" rel="noopener" class="btn btn-primary">
                                <i data-lucide="video" style="width: 15px; height: 15px;"></i> Приєднатися до дзвінка
                            </a>
                        ` : ''}
                        ${meeting.recording_url ? `
                            <a href="${escapeHtml(meeting.recording_url)}" target="_blank" rel="noopener" class="btn btn-outline">
                                <i data-lucide="play-circle" style="width: 15px; height: 15px;"></i> Запис зустрічі
                            </a>
                        ` : ''}
                    </div>
                </div>

                <!-- Meeting Meta Grid -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; padding-top: 16px; margin-top: 16px; border-top: 1px solid var(--border-color);">
                    <div>
                        <span class="client-metric-label"><i data-lucide="calendar" style="width: 12px; height: 12px;"></i> Дата та час</span>
                        <div style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin-top: 2px;">
                            ${dateFormatted}
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">
                            ${timeFormatted} (${escapeHtml(meeting.timezone || 'Europe/Kyiv')})
                        </div>
                    </div>

                    <div>
                        <span class="client-metric-label"><i data-lucide="map-pin" style="width: 12px; height: 12px;"></i> Формат</span>
                        <div style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin-top: 2px;">
                            ${meeting.location_type === 'offline' ? 'Офлайн зустріч' : 'Онлайн відеодзвінок'}
                        </div>
                        ${meeting.location_text ? `<div style="font-size: 0.82rem; color: var(--text-secondary);">${escapeHtml(meeting.location_text)}</div>` : ''}
                    </div>

                    <div>
                        <span class="client-metric-label"><i data-lucide="user-check" style="width: 12px; height: 12px;"></i> Організатор</span>
                        <div style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin-top: 2px;">
                            ${escapeHtml(meeting.organizer?.full_name || 'Команда FIRSTWIN')}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Two-Column Layout for Content -->
            <div class="client-meeting-detail-grid">
                <!-- Left Column: Agenda, Notes & Decisions -->
                <div class="client-meeting-detail-main">
                    <!-- Agenda -->
                    <div class="client-card" style="margin-bottom: 20px;">
                        <div class="client-card-header" style="margin-bottom: 12px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div class="client-card-icon" style="background: rgba(99, 102, 241, 0.12); color: var(--color-primary);">
                                    <i data-lucide="list"></i>
                                </div>
                                <h3 class="client-card-title">Порядок денний (Agenda)</h3>
                            </div>
                        </div>

                        ${meeting.agenda ? `
                            <div style="font-size: 0.92rem; color: var(--text-secondary); line-height: 1.6; white-space: pre-wrap;">
                                ${escapeHtml(meeting.agenda)}
                            </div>
                        ` : `
                            <p style="color: var(--text-muted); font-size: 0.88rem;">Порядок денний узгоджується перед початком зустрічі.</p>
                        `}
                    </div>

                    <!-- Client-Visible Decisions -->
                    ${decisions.length > 0 ? `
                        <div class="client-card" style="margin-bottom: 20px;">
                            <div class="client-card-header" style="margin-bottom: 12px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <div class="client-card-icon" style="background: rgba(16, 185, 129, 0.12); color: var(--color-success);">
                                        <i data-lucide="check-circle-2"></i>
                                    </div>
                                    <h3 class="client-card-title">Зафіксовані рішення</h3>
                                </div>
                            </div>

                            <div class="client-decisions-list">
                                ${decisions.map((dec, idx) => `
                                    <div class="client-decision-item">
                                        <div class="client-decision-num">${idx + 1}</div>
                                        <div class="client-decision-text">${escapeHtml(dec.decision_text)}</div>
                                    </div>
                                `).join("")}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Client-Visible Notes / Protocols -->
                    ${notes.length > 0 ? `
                        <div class="client-card" style="margin-bottom: 20px;">
                            <div class="client-card-header" style="margin-bottom: 12px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <div class="client-card-icon" style="background: rgba(245, 158, 11, 0.12); color: var(--color-warning);">
                                        <i data-lucide="file-text"></i>
                                    </div>
                                    <h3 class="client-card-title">Протокол та нотатки зустрічі</h3>
                                </div>
                            </div>

                            <div class="client-notes-list">
                                ${notes.map(n => `
                                    <div class="client-note-item">
                                        <div style="font-size: 0.92rem; color: var(--text-secondary); line-height: 1.6; white-space: pre-wrap;">
                                            ${escapeHtml(n.body)}
                                        </div>
                                    </div>
                                `).join("")}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Client Actions from Meeting -->
                    ${tasks.length > 0 ? `
                        <div class="client-card">
                            <div class="client-card-header" style="margin-bottom: 12px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <div class="client-card-icon" style="background: rgba(245, 158, 11, 0.12); color: var(--color-warning);">
                                        <i data-lucide="check-square"></i>
                                    </div>
                                    <div>
                                        <h3 class="client-card-title">Дії клієнта за підсумками зустрічі</h3>
                                        <p class="client-card-subtitle">Задачі, зафіксовані під час синхронізації</p>
                                    </div>
                                </div>
                            </div>

                            <div class="client-action-list">
                                ${tasks.map(t => {
                                    const isDone = t.status === 'done';
                                    return `
                                        <div class="client-action-item ${isDone ? 'done' : ''}">
                                            <div class="client-action-left">
                                                <div class="client-action-title ${isDone ? 'done-text' : ''}">${escapeHtml(t.title)}</div>
                                                ${t.description ? `<div class="client-action-desc">${escapeHtml(t.description)}</div>` : ''}
                                                ${t.due_date ? `<div class="client-action-meta"><span class="client-action-due"><i data-lucide="calendar" style="width: 11px; height: 11px;"></i> До: ${formatDate(t.due_date)}</span></div>` : ''}
                                            </div>
                                            <div class="client-action-cta">
                                                ${isDone ? '<span class="client-badge client-badge-success"><i data-lucide="check" style="width: 12px; height: 12px;"></i> Виконано</span>' : '<span class="client-badge client-badge-warning">До виконання</span>'}
                                            </div>
                                        </div>
                                    `;
                                }).join("")}
                            </div>
                        </div>
                    ` : ''}
                </div>

                <!-- Right Column: Safe Participants & Attached Materials -->
                <div class="client-meeting-detail-side">
                    <!-- Client-Safe Participants -->
                    <div class="client-card" style="margin-bottom: 20px;">
                        <div class="client-card-header" style="margin-bottom: 12px;">
                            <h3 class="client-card-title" style="font-size: 0.95rem;">Учасники зустрічі</h3>
                        </div>

                        ${participants.length === 0 ? `
                            <p style="color: var(--text-muted); font-size: 0.85rem;">Список учасників формується.</p>
                        ` : `
                            <div class="client-participants-list">
                                ${participants.map(p => {
                                    const isUser = p.participant_type === 'user';
                                    const name = isUser ? (p.user?.full_name || 'Команда FIRSTWIN') : `${p.contact?.first_name || ''} ${p.contact?.last_name || ''}`.trim() || 'Представник клієнта';
                                    const roleTag = isUser ? 'FIRSTWIN Team' : (p.contact?.position || 'Клієнт');

                                    return `
                                        <div class="client-participant-item">
                                            <div class="client-participant-avatar">
                                                ${name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U'}
                                            </div>
                                            <div style="flex: 1; min-width: 0;">
                                                <div class="client-participant-name">${escapeHtml(name)}</div>
                                                <div class="client-participant-role">${escapeHtml(roleTag)}</div>
                                            </div>
                                        </div>
                                    `;
                                }).join("")}
                            </div>
                        `}
                    </div>

                    <!-- Attached Documents -->
                    ${attachedDocuments.length > 0 ? `
                        <div class="client-card">
                            <div class="client-card-header" style="margin-bottom: 12px;">
                                <h3 class="client-card-title" style="font-size: 0.95rem;">Матеріали зустрічі</h3>
                            </div>

                            <div class="client-attached-docs-list">
                                ${attachedDocuments.map(ad => {
                                    const doc = ad.document;
                                    const latestVer = doc?.latestVersion;

                                    return `
                                        <div class="client-attached-doc-item" onclick="window.location.hash = '#/client/documents/${doc.id}'" style="cursor: pointer;">
                                            <div class="client-attached-doc-icon">
                                                <i data-lucide="file-text"></i>
                                            </div>
                                            <div style="flex: 1; min-width: 0;">
                                                <div class="client-attached-doc-title">${escapeHtml(doc.title)}</div>
                                                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                                                    ${escapeHtml(doc.category)} • v${latestVer?.version_number || 1}
                                                </div>
                                            </div>
                                            <i data-lucide="chevron-right" style="width: 14px; height: 14px; color: var(--text-muted);"></i>
                                        </div>
                                    `;
                                }).join("")}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

export function initClientMeetingDetailEvents() {
    if (window.lucide) window.lucide.createIcons();
}

function getMeetingTypeLabel(type) {
    const map = {
        kickoff: "Kickoff зустріч",
        weekly_sync: "Щотижнева синхронізація",
        demo: "Демо результатів",
        planning: "Планування етапу",
        technical: "Технічна сесія",
        retrospective: "Підсумки проєкту",
        other: "Зустріч"
    };
    return map[type] || "Зустріч";
}

function getMeetingStatusBadge(status) {
    const map = {
        scheduled: { label: "Заплановано", badgeClass: "client-badge-primary" },
        in_progress: { label: "Триває зараз", badgeClass: "client-badge-warning" },
        completed: { label: "Проведено", badgeClass: "client-badge-success" },
        cancelled: { label: "Скасовано", badgeClass: "client-badge-neutral" },
        rescheduled: { label: "Перенесено", badgeClass: "client-badge-warning" }
    };
    return map[status] || { label: "Заплановано", badgeClass: "client-badge-primary" };
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

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
