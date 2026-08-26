/* js/portal/ui/portal-meeting-detail-view.js - Meeting Passport & Protocol View */

import { DataClient } from "../api/data-client.js";
import { PortalAuth } from "../auth/auth-service.js";
import { getMeetingTypeLabel, getMeetingStatusBadge, openCreateMeetingModal } from "./portal-meetings-view.js";

export function renderMeetingDetailView(meetingId) {
    return `
        <div class="portal-content" id="meeting-detail-container">
            <div class="portal-loading-container" style="min-height: 50vh;">
                <div class="portal-spinner"></div>
                <span>Завантаження картки зустрічі...</span>
            </div>
        </div>

        <!-- Modals Mount -->
        <div id="meeting-detail-modal-mount"></div>
    `;
}

export async function initMeetingDetailEvents(meetingId) {
    const container = document.getElementById("meeting-detail-container");
    if (!container) return;

    // Load meeting data
    const { data: meeting, error } = await DataClient.getMeetingById(meetingId);

    if (error || !meeting) {
        container.innerHTML = `
            <div class="portal-empty-state">
                <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="alert-triangle"></i></div>
                <div class="portal-empty-title">Зустріч не знайдено</div>
                <div class="portal-empty-desc">${escapeHtml(error?.message || "Можливо, зустріч була видалена або у вас немає прав доступу.")}</div>
                <div style="margin-top: 16px;">
                    <a href="#/portal/meetings" class="btn btn-primary">
                        <i data-lucide="arrow-left"></i> До списку зустрічей
                    </a>
                </div>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    const canManage = PortalAuth.isGlobalOwner() || PortalAuth.isOrgAdmin(meeting.organization_id);
    const startDate = new Date(meeting.start_at);
    const endDate = new Date(meeting.end_at);

    const dateStr = startDate.toLocaleDateString("uk-UA", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric"
    });
    const timeStr = `${startDate.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })} – ${endDate.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}`;

    const isCompleted = meeting.status === "completed";
    const isCancelled = meeting.status === "cancelled";
    const isScheduled = meeting.status === "scheduled";

    const internalParticipants = (meeting.participants || []).filter(p => p.participant_type === "user");
    const clientParticipants = (meeting.participants || []).filter(p => p.participant_type === "contact");

    const notes = meeting.notes || [];
    const decisions = meeting.decisions || [];
    const actionItems = meeting.action_items || [];
    const documents = meeting.documents || [];

    // Render HTML
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 20px;">
            <!-- Top Navigation & Actions -->
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                <a href="#/portal/meetings" class="btn btn-sm btn-outline" style="display: inline-flex; align-items: center; gap: 6px;">
                    <i data-lucide="arrow-left" style="width: 14px; height: 14px;"></i> До всіх зустрічей
                </a>

                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    ${canManage && isScheduled ? `
                        <button class="btn btn-sm btn-success" id="btn-complete-meeting">
                            <i data-lucide="check-circle" style="width: 14px; height: 14px;"></i> Завершити зустріч
                        </button>
                        <button class="btn btn-sm btn-outline" id="btn-cancel-meeting" style="color: var(--color-danger); border-color: rgba(239, 68, 68, 0.4);">
                            <i data-lucide="x-circle" style="width: 14px; height: 14px;"></i> Скасувати
                        </button>
                    ` : ""}

                    ${canManage ? `
                        <button class="btn btn-sm btn-primary" id="btn-schedule-next-meeting">
                            <i data-lucide="calendar-plus" style="width: 14px; height: 14px;"></i> Запланувати наступну
                        </button>
                        <button class="btn btn-sm btn-outline" id="btn-edit-meeting">
                            <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i> Редагувати
                        </button>
                    ` : ""}
                </div>
            </div>

            <!-- Main Header Card -->
            <div class="portal-card" style="padding: 24px; border-left: 4px solid var(--color-primary);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 280px;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
                            ${getMeetingStatusBadge(meeting.status)}
                            <span class="portal-badge portal-badge-secondary">${getMeetingTypeLabel(meeting.meeting_type)}</span>
                            ${meeting.recurrence_series_id ? `
                                <span class="portal-badge portal-badge-info" title="Повторювана зустріч">
                                    <i data-lucide="repeat" style="width: 11px; height: 11px;"></i> Серія зустрічей
                                </span>
                            ` : ""}
                            ${meeting.is_client_visible ? `
                                <span class="portal-badge portal-badge-success" title="Буде доступно клієнту в Phase 4">Видно клієнту</span>
                            ` : `
                                <span class="portal-badge portal-badge-secondary">Внутрішня</span>
                            `}
                        </div>

                        <h1 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 10px 0;">
                            ${escapeHtml(meeting.title)}
                        </h1>

                        <div style="display: flex; align-items: center; gap: 16px; font-size: 0.9rem; color: var(--text-secondary); flex-wrap: wrap;">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <i data-lucide="calendar" style="width: 16px; height: 16px; color: var(--color-primary);"></i>
                                <span style="font-weight: 600; text-transform: capitalize;">${dateStr}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <i data-lucide="clock" style="width: 16px; height: 16px; color: var(--color-primary);"></i>
                                <span>${timeStr} (${escapeHtml(meeting.timezone || "Europe/Kyiv")})</span>
                            </div>
                        </div>
                    </div>

                    <!-- Client & Project Info -->
                    <div style="background: var(--bg-surface); padding: 14px 18px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); min-width: 240px;">
                        <div style="font-size: 0.78rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Контекст проєкту</div>
                        <div style="font-weight: 600; font-size: 0.92rem; margin-bottom: 4px;">
                            ${meeting.organization ? `
                                <a href="#/portal/clients/${meeting.organization.id}" class="portal-table-link">
                                    🏢 ${escapeHtml(meeting.organization.name)}
                                </a>
                            ` : "—"}
                        </div>
                        <div style="font-size: 0.88rem;">
                            ${meeting.project ? `
                                <a href="#/portal/projects/${meeting.project.id}" class="portal-table-link">
                                    📁 ${escapeHtml(meeting.project.title || meeting.project.name)}
                                </a>
                            ` : "—"}
                        </div>
                    </div>
                </div>

                <!-- Call / Location / Recording Links Bar -->
                <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border-color); display: flex; gap: 14px; flex-wrap: wrap; align-items: center;">
                    ${meeting.location_type === 'online' && meeting.meeting_url ? `
                        <a href="${escapeHtml(meeting.meeting_url)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 8px;">
                            <i data-lucide="video" style="width: 16px; height: 16px;"></i> Приєднатися до дзвінка
                        </a>
                    ` : ""}

                    ${meeting.location_text ? `
                        <div style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.88rem; color: var(--text-secondary);">
                            <i data-lucide="map-pin" style="width: 15px; height: 15px; color: var(--color-warning);"></i>
                            <span>${escapeHtml(meeting.location_text)}</span>
                        </div>
                    ` : ""}

                    <!-- Recording Link -->
                    <div style="display: inline-flex; align-items: center; gap: 8px; margin-left: auto;">
                        ${meeting.recording_url ? `
                            <a href="${escapeHtml(meeting.recording_url)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline" style="color: var(--color-info); border-color: rgba(59, 130, 246, 0.4);">
                                <i data-lucide="play-circle" style="width: 14px; height: 14px;"></i> Відеозапис зустрічі
                            </a>
                        ` : (canManage ? `
                            <button class="btn btn-sm btn-outline" id="btn-add-recording" style="font-size: 0.8rem;">
                                <i data-lucide="link" style="width: 13px; height: 13px;"></i> Додати посилання на запис
                            </button>
                        ` : "")}
                    </div>
                </div>
            </div>

            <!-- Two Columns Layout: Left = Agenda, Notes, Decisions, Action Items; Right = Participants, Documents -->
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;" id="meeting-detail-grid">
                <!-- Left Column -->
                <div style="display: flex; flex-direction: column; gap: 20px;">
                    <!-- Agenda -->
                    <div class="portal-section-card">
                        <div class="portal-section-card-title">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <i data-lucide="list-ordered" style="color: var(--color-primary); width: 18px; height: 18px;"></i>
                                <span>Порядок денний (Agenda)</span>
                            </div>
                        </div>
                        <div style="color: var(--text-secondary); font-size: 0.92rem; line-height: 1.6; white-space: pre-wrap;">
                            ${meeting.agenda ? escapeHtml(meeting.agenda) : `<span style="color: var(--text-muted); font-style: italic;">Порядок денний ще не заповнено</span>`}
                        </div>
                    </div>

                    <!-- Decisions (Рішення зустрічі) -->
                    <div class="portal-section-card" style="border-left: 3px solid var(--color-success);">
                        <div class="portal-section-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                            <div class="portal-section-card-title" style="margin: 0;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <i data-lucide="check-square" style="color: var(--color-success); width: 18px; height: 18px;"></i>
                                    <span>Зафіксовані рішення (${decisions.length})</span>
                                </div>
                            </div>
                            ${canManage ? `
                                <button class="btn btn-sm btn-outline" id="btn-add-decision" style="font-size: 0.8rem;">
                                    <i data-lucide="plus" style="width: 13px; height: 13px;"></i> Додати рішення
                                </button>
                            ` : ""}
                        </div>

                        <div id="decisions-list-container" style="display: flex; flex-direction: column; gap: 10px;">
                            ${decisions.length === 0 ? `
                                <div style="color: var(--text-muted); font-size: 0.88rem; font-style: italic; padding: 10px 0;">
                                    Рішення під час зустрічі ще не зафіксовані.
                                </div>
                            ` : decisions.map((d, idx) => `
                                <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: var(--radius-sm); padding: 12px 14px; display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
                                    <div style="flex: 1;">
                                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                            <span style="font-weight: 700; color: var(--color-success); font-size: 0.85rem;">Рішення #${idx + 1}</span>
                                            ${d.is_client_visible ? `
                                                <span class="portal-badge portal-badge-success" style="font-size: 0.68rem; padding: 1px 5px;">Видно клієнту</span>
                                            ` : `
                                                <span class="portal-badge portal-badge-secondary" style="font-size: 0.68rem; padding: 1px 5px;">Внутрішнє</span>
                                            `}
                                        </div>
                                        <div style="color: var(--text-primary); font-size: 0.92rem; line-height: 1.5;">
                                            ${escapeHtml(d.decision_text)}
                                        </div>
                                        <div style="color: var(--text-muted); font-size: 0.75rem; margin-top: 4px;">
                                            Автор: ${escapeHtml(d.author?.full_name || d.author?.email || "Користувач")} • ${new Date(d.created_at).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}
                                        </div>
                                    </div>
                                    ${canManage ? `
                                        <button class="btn btn-sm btn-outline btn-delete-decision" data-decision-id="${d.id}" title="Видалити рішення" style="padding: 4px 8px; color: var(--text-muted);">
                                            <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
                                        </button>
                                    ` : ""}
                                </div>
                            `).join("")}
                        </div>
                    </div>

                    <!-- Action Items (Задачі зустрічі) -->
                    <div class="portal-section-card" style="border-left: 3px solid var(--color-warning);">
                        <div class="portal-section-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                            <div>
                                <div class="portal-section-card-title" style="margin: 0;">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <i data-lucide="target" style="color: var(--color-warning); width: 18px; height: 18px;"></i>
                                        <span>Задачі за підсумками зустрічі (${actionItems.length})</span>
                                    </div>
                                </div>
                                <p style="color: var(--text-muted); font-size: 0.78rem; margin: 4px 0 0 0;">
                                    Автоматично інтегровані в єдиний трекер задач проєкту
                                </p>
                            </div>
                            ${canManage ? `
                                <button class="btn btn-sm btn-primary" id="btn-create-action-item" style="font-size: 0.8rem;">
                                    <i data-lucide="plus" style="width: 13px; height: 13px;"></i> Додати задачу
                                </button>
                            ` : ""}
                        </div>

                        <div id="action-items-list-container" style="display: flex; flex-direction: column; gap: 10px;">
                            ${actionItems.length === 0 ? `
                                <div style="color: var(--text-muted); font-size: 0.88rem; font-style: italic; padding: 10px 0;">
                                    Задач за підсумками зустрічі ще не створено.
                                </div>
                            ` : actionItems.map(task => {
                                const isClient = task.responsibility_type === "client";
                                const isDone = task.status === "done";
                                const assigneeName = isClient
                                    ? (task.client_contact ? `${task.client_contact.first_name} ${task.client_contact.last_name || ""}` : "Клієнт")
                                    : (task.assignee ? (task.assignee.full_name || task.assignee.email) : "Не призначено");

                                return `
                                    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                                        <div style="display: flex; align-items: flex-start; gap: 10px; flex: 1;">
                                            <input type="checkbox" class="chk-task-status-toggle" data-task-id="${task.id}" ${isDone ? 'checked' : ''} style="margin-top: 4px; cursor: pointer;" />
                                            <div>
                                                <div style="font-weight: 600; font-size: 0.92rem; color: ${isDone ? 'var(--text-muted)' : 'var(--text-primary)'}; text-decoration: ${isDone ? 'line-through' : 'none'};">
                                                    ${escapeHtml(task.title)}
                                                </div>
                                                <div style="display: flex; align-items: center; gap: 8px; font-size: 0.78rem; margin-top: 4px; flex-wrap: wrap;">
                                                    ${isClient ? `
                                                        <span class="portal-badge portal-badge-warning">
                                                            <i data-lucide="user-check" style="width: 10px; height: 10px;"></i> Дія клієнта: ${escapeHtml(assigneeName)}
                                                        </span>
                                                    ` : `
                                                        <span class="portal-badge portal-badge-info">
                                                            <i data-lucide="user" style="width: 10px; height: 10px;"></i> Команда: ${escapeHtml(assigneeName)}
                                                        </span>
                                                    `}
                                                    ${task.due_date ? `
                                                        <span style="color: var(--text-muted);">Дедлайн: ${task.due_date}</span>
                                                    ` : ""}
                                                    <span class="portal-badge portal-badge-secondary">${escapeHtml(task.status)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <a href="#/portal/projects/${meeting.project_id}" class="btn btn-sm btn-outline" title="Відкрити в задачах проєкту" style="padding: 4px 8px;">
                                                <i data-lucide="external-link" style="width: 13px; height: 13px;"></i>
                                            </a>
                                        </div>
                                    </div>
                                `;
                            }).join("")}
                        </div>
                    </div>

                    <!-- Meeting Notes (Протокол та нотатки) -->
                    <div class="portal-section-card">
                        <div class="portal-section-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                            <div class="portal-section-card-title" style="margin: 0;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <i data-lucide="file-text" style="color: var(--color-primary); width: 18px; height: 18px;"></i>
                                    <span>Нотатки та протокол (${notes.length})</span>
                                </div>
                            </div>
                            ${canManage ? `
                                <button class="btn btn-sm btn-outline" id="btn-add-note" style="font-size: 0.8rem;">
                                    <i data-lucide="plus" style="width: 13px; height: 13px;"></i> Додати нотатку
                                </button>
                            ` : ""}
                        </div>

                        <div id="notes-list-container" style="display: flex; flex-direction: column; gap: 12px;">
                            ${notes.length === 0 ? `
                                <div style="color: var(--text-muted); font-size: 0.88rem; font-style: italic; padding: 10px 0;">
                                    Нотатки зустрічі ще не додані.
                                </div>
                            ` : notes.map(n => `
                                <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 14px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <span style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary);">
                                                ${escapeHtml(n.author?.full_name || n.author?.email || "Автор")}
                                            </span>
                                            <span style="font-size: 0.75rem; color: var(--text-muted);">
                                                ${new Date(n.created_at).toLocaleDateString("uk-UA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                                            </span>
                                        </div>

                                        <div style="display: flex; align-items: center; gap: 6px;">
                                            ${n.is_client_visible ? `
                                                <span class="portal-badge portal-badge-success" style="font-size: 0.68rem;">Видно клієнту</span>
                                            ` : `
                                                <span class="portal-badge portal-badge-secondary" style="font-size: 0.68rem;">Внутрішня</span>
                                            `}
                                            ${canManage ? `
                                                <button class="btn btn-sm btn-outline btn-delete-note" data-note-id="${n.id}" title="Видалити нотатку" style="padding: 2px 6px; border: none; color: var(--text-muted);">
                                                    <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
                                                </button>
                                            ` : ""}
                                        </div>
                                    </div>

                                    <div style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.6; white-space: pre-wrap;">
                                        ${escapeHtml(n.body)}
                                    </div>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                </div>

                <!-- Right Column: Participants & Documents -->
                <div style="display: flex; flex-direction: column; gap: 20px;">
                    <!-- Participants Card -->
                    <div class="portal-section-card">
                        <div class="portal-section-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <div class="portal-section-card-title" style="margin: 0; font-size: 0.95rem;">
                                <i data-lucide="users" style="width: 16px; height: 16px; color: var(--color-primary);"></i>
                                <span>Учасники (${(meeting.participants || []).length})</span>
                            </div>
                            ${canManage ? `
                                <button class="btn btn-sm btn-outline" id="btn-add-participant" style="font-size: 0.75rem; padding: 3px 8px;">
                                    <i data-lucide="user-plus" style="width: 12px; height: 12px;"></i> Додати
                                </button>
                            ` : ""}
                        </div>

                        <!-- Internal Staff -->
                        <div style="margin-bottom: 16px;">
                            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                                Команда FIRSTWIN
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                ${internalParticipants.length === 0 ? `<div style="font-size: 0.8rem; color: var(--text-muted);">Не вказано</div>` : internalParticipants.map(p => `
                                    <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface); padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border-color);">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <div style="width: 26px; height: 26px; border-radius: 50%; background: var(--color-primary); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700;">
                                                ${(p.user?.full_name?.slice(0, 2) || "FW").toUpperCase()}
                                            </div>
                                            <div>
                                                <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">${escapeHtml(p.user?.full_name || p.user?.email || "Учасник")}</div>
                                            </div>
                                        </div>

                                        <div style="display: flex; align-items: center; gap: 6px;">
                                            ${canManage ? `
                                                <select class="portal-select sel-participant-status" data-participant-id="${p.id}" style="font-size: 0.72rem; padding: 2px 6px; height: 26px;">
                                                    <option value="invited" ${p.attendance_status === 'invited' ? 'selected' : ''}>Запрошено</option>
                                                    <option value="confirmed" ${p.attendance_status === 'confirmed' ? 'selected' : ''}>Підтвердив</option>
                                                    <option value="attended" ${p.attendance_status === 'attended' ? 'selected' : ''}>Був присутній</option>
                                                    <option value="absent" ${p.attendance_status === 'absent' ? 'selected' : ''}>Відсутній</option>
                                                </select>
                                                <button class="btn btn-sm btn-delete-participant" data-participant-id="${p.id}" title="Видалити" style="padding: 2px 4px; color: var(--text-muted); border: none; background: transparent;">
                                                    &times;
                                                </button>
                                            ` : `
                                                <span class="portal-badge portal-badge-secondary" style="font-size: 0.7rem;">${escapeHtml(p.attendance_status)}</span>
                                            `}
                                        </div>
                                    </div>
                                `).join("")}
                            </div>
                        </div>

                        <!-- Client Contacts -->
                        <div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                                Представники клієнта
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                ${clientParticipants.length === 0 ? `<div style="font-size: 0.8rem; color: var(--text-muted);">Не вказано</div>` : clientParticipants.map(p => `
                                    <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface); padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border-color);">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <div style="width: 26px; height: 26px; border-radius: 50%; background: var(--color-warning); color: #000; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700;">
                                                ${(p.contact?.first_name?.slice(0, 1) || "C").toUpperCase()}
                                            </div>
                                            <div>
                                                <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">${escapeHtml(p.contact?.first_name)} ${escapeHtml(p.contact?.last_name || "")}</div>
                                                ${p.contact?.position ? `<div style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(p.contact.position)}</div>` : ""}
                                            </div>
                                        </div>

                                        <div style="display: flex; align-items: center; gap: 6px;">
                                            ${canManage ? `
                                                <select class="portal-select sel-participant-status" data-participant-id="${p.id}" style="font-size: 0.72rem; padding: 2px 6px; height: 26px;">
                                                    <option value="invited" ${p.attendance_status === 'invited' ? 'selected' : ''}>Запрошено</option>
                                                    <option value="confirmed" ${p.attendance_status === 'confirmed' ? 'selected' : ''}>Підтвердив</option>
                                                    <option value="attended" ${p.attendance_status === 'attended' ? 'selected' : ''}>Був присутній</option>
                                                    <option value="absent" ${p.attendance_status === 'absent' ? 'selected' : ''}>Відсутній</option>
                                                </select>
                                                <button class="btn btn-sm btn-delete-participant" data-participant-id="${p.id}" title="Видалити" style="padding: 2px 4px; color: var(--text-muted); border: none; background: transparent;">
                                                    &times;
                                                </button>
                                            ` : `
                                                <span class="portal-badge portal-badge-secondary" style="font-size: 0.7rem;">${escapeHtml(p.attendance_status)}</span>
                                            `}
                                        </div>
                                    </div>
                                `).join("")}
                            </div>
                        </div>
                    </div>

                    <!-- Meeting Documents (Матеріали зустрічі) -->
                    <div class="portal-section-card">
                        <div class="portal-section-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <div class="portal-section-card-title" style="margin: 0; font-size: 0.95rem;">
                                <i data-lucide="paperclip" style="width: 16px; height: 16px; color: var(--color-primary);"></i>
                                <span>Матеріали (${documents.length})</span>
                            </div>
                            ${canManage ? `
                                <button class="btn btn-sm btn-outline" id="btn-link-document" style="font-size: 0.75rem; padding: 3px 8px;">
                                    <i data-lucide="plus" style="width: 12px; height: 12px;"></i> Прикріпити
                                </button>
                            ` : ""}
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            ${documents.length === 0 ? `
                                <div style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">Документи не прикріплено</div>
                            ` : documents.map(md => {
                                const doc = md.document;
                                if (!doc) return "";
                                const latestVer = doc.latest_versions && doc.latest_versions[0];

                                return `
                                    <div style="background: var(--bg-surface); padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                                        <div style="flex: 1; min-width: 0;">
                                            <a href="#/portal/documents/${doc.id}" class="portal-table-link" style="font-size: 0.85rem; font-weight: 600; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                                ${escapeHtml(doc.title)}
                                            </a>
                                            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
                                                ${escapeHtml(doc.category)} ${latestVer ? `• v${latestVer.version_number}` : ""}
                                            </div>
                                        </div>

                                        <div style="display: flex; align-items: center; gap: 4px;">
                                            ${latestVer ? `
                                                <button class="btn btn-sm btn-outline btn-download-meeting-doc" data-storage-path="${escapeHtml(latestVer.storage_path)}" data-filename="${escapeHtml(latestVer.original_filename)}" title="Завантажити" style="padding: 4px 6px;">
                                                    <i data-lucide="download" style="width: 12px; height: 12px;"></i>
                                                </button>
                                            ` : ""}
                                            ${canManage ? `
                                                <button class="btn btn-sm btn-unlink-document" data-link-id="${md.id}" title="Відкріпити" style="padding: 4px 6px; color: var(--text-muted); border: none; background: transparent;">
                                                    &times;
                                                </button>
                                            ` : ""}
                                        </div>
                                    </div>
                                `;
                            }).join("")}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Attach Event Listeners
    setupMeetingDetailActions(meeting, () => initMeetingDetailEvents(meetingId));
}

function setupMeetingDetailActions(meeting, reload) {
    const meetingId = meeting.id;

    // 1. Complete Meeting
    document.getElementById("btn-complete-meeting")?.addEventListener("click", async () => {
        if (!confirm("Завершити зустріч? Всі зафіксовані рішення та Action Items залишаться активними.")) return;
        const res = await DataClient.completeMeeting(meetingId);
        if (res.error) alert("Помилка: " + res.error.message);
        else reload();
    });

    // 2. Cancel Meeting
    document.getElementById("btn-cancel-meeting")?.addEventListener("click", async () => {
        if (!confirm("Скасувати цю зустріч?")) return;
        const res = await DataClient.cancelMeeting(meetingId);
        if (res.error) alert("Помилка: " + res.error.message);
        else reload();
    });

    // 3. Schedule Next Meeting
    document.getElementById("btn-schedule-next-meeting")?.addEventListener("click", async () => {
        const { data: orgs } = await DataClient.getOrganizations();
        const { data: projects } = await DataClient.getProjects();
        openCreateMeetingModal(
            orgs || [],
            projects || [],
            () => {
                window.location.hash = "#/portal/meetings";
            },
            meeting.project_id,
            meeting.organization_id
        );
    });

    // 4. Add Recording URL
    document.getElementById("btn-add-recording")?.addEventListener("click", async () => {
        const url = prompt("Введіть посилання на відеозапис зустрічі (Zoom / Google Drive / Loom):", meeting.recording_url || "");
        if (url !== null) {
            const res = await DataClient.updateMeeting(meetingId, { recording_url: url.trim() || null });
            if (res.error) alert("Помилка: " + res.error.message);
            else reload();
        }
    });

    // 5. Add Decision Modal / Prompt
    document.getElementById("btn-add-decision")?.addEventListener("click", async () => {
        const text = prompt("Введіть текст прийнятого рішення:");
        if (text && text.trim()) {
            const isClientVisible = confirm("Зробити це рішення видимим для клієнта?");
            const res = await DataClient.createMeetingDecision({
                meeting_id: meetingId,
                decision_text: text.trim(),
                is_client_visible: isClientVisible
            });
            if (res.error) alert("Помилка: " + res.error.message);
            else reload();
        }
    });

    // 6. Delete Decision
    document.querySelectorAll(".btn-delete-decision").forEach(btn => {
        btn.addEventListener("click", async () => {
            if (!confirm("Видалити це рішення?")) return;
            const res = await DataClient.deleteMeetingDecision(btn.dataset.decisionId);
            if (res.error) alert("Помилка: " + res.error.message);
            else reload();
        });
    });

    // 7. Add Note Modal / Prompt
    document.getElementById("btn-add-note")?.addEventListener("click", async () => {
        openAddNoteModal(meeting, reload);
    });

    // 8. Delete Note
    document.querySelectorAll(".btn-delete-note").forEach(btn => {
        btn.addEventListener("click", async () => {
            if (!confirm("Видалити цю нотатку?")) return;
            const res = await DataClient.deleteMeetingNote(btn.dataset.noteId);
            if (res.error) alert("Помилка: " + res.error.message);
            else reload();
        });
    });

    // 9. Create Action Item Modal (Meeting -> Task)
    document.getElementById("btn-create-action-item")?.addEventListener("click", async () => {
        openCreateActionItemModal(meeting, reload);
    });

    // 10. Task Status Checkbox Toggle
    document.querySelectorAll(".chk-task-status-toggle").forEach(chk => {
        chk.addEventListener("change", async (e) => {
            const taskId = chk.dataset.taskId;
            const newStatus = e.target.checked ? "done" : "in_progress";
            await DataClient.updateTask(taskId, { status: newStatus });
            reload();
        });
    });

    // 11. Update Participant Attendance
    document.querySelectorAll(".sel-participant-status").forEach(sel => {
        sel.addEventListener("change", async (e) => {
            const partId = sel.dataset.participantId;
            await DataClient.updateMeetingParticipantAttendance(partId, e.target.value);
        });
    });

    // 12. Delete Participant
    document.querySelectorAll(".btn-delete-participant").forEach(btn => {
        btn.addEventListener("click", async () => {
            if (!confirm("Видалити учасника з цієї зустрічі?")) return;
            await DataClient.removeMeetingParticipant(btn.dataset.participantId);
            reload();
        });
    });

    // 13. Add Participant Modal
    document.getElementById("btn-add-participant")?.addEventListener("click", async () => {
        openAddParticipantModal(meeting, reload);
    });

    // 14. Link Document Modal
    document.getElementById("btn-link-document")?.addEventListener("click", async () => {
        openLinkDocumentModal(meeting, reload);
    });

    // 15. Unlink Document
    document.querySelectorAll(".btn-unlink-document").forEach(btn => {
        btn.addEventListener("click", async () => {
            if (!confirm("Відкріпити документ від цієї зустрічі? Сам документ залишиться у проєкті.")) return;
            await DataClient.unlinkDocumentFromMeeting(btn.dataset.linkId);
            reload();
        });
    });

    // 16. Download Document File
    document.querySelectorAll(".btn-download-meeting-doc").forEach(btn => {
        btn.addEventListener("click", async () => {
            try {
                await DataClient.downloadDocumentFile(btn.dataset.storagePath, btn.dataset.filename);
            } catch (err) {
                alert("Помилка завантаження: " + err.message);
            }
        });
    });
}

function openAddNoteModal(meeting, onAdded) {
    const mount = document.getElementById("meeting-detail-modal-mount") || document.body;

    const modalHtml = `
        <div class="portal-modal-backdrop" id="add-note-backdrop">
            <div class="portal-modal" style="max-width: 500px;">
                <div class="portal-modal-header">
                    <div class="portal-modal-title">
                        <i data-lucide="file-text" style="color: var(--color-primary);"></i>
                        <span>Додати нотатку зустрічі</span>
                    </div>
                    <button class="portal-modal-close" id="btn-close-note-modal">&times;</button>
                </div>

                <form id="form-add-meeting-note" class="portal-modal-body" style="display: flex; flex-direction: column; gap: 14px;">
                    <div class="portal-form-group">
                        <label class="portal-label">Текст нотатки / протоколу *</label>
                        <textarea id="note-body" class="portal-textarea" rows="4" placeholder="Введіть текст..." required></textarea>
                    </div>

                    <div class="portal-form-group">
                        <label class="portal-label">Тип нотатки</label>
                        <select id="note-type" class="portal-select">
                            <option value="general" selected>Загальна нотатка</option>
                            <option value="internal">Внутрішня (Тільки для керівництва/команди)</option>
                            <option value="next_step">Наступний крок</option>
                            <option value="summary">Підсумок зустрічі</option>
                        </select>
                    </div>

                    <div class="portal-form-group">
                        <label class="portal-checkbox-label" style="font-size: 0.88rem; display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="note-client-visible" />
                            <span>Видимо клієнту в майбутньому кабінеті (is_client_visible)</span>
                        </label>
                    </div>

                    <div class="portal-modal-actions">
                        <button type="button" class="btn btn-outline" id="btn-cancel-note">Скасувати</button>
                        <button type="submit" class="btn btn-primary">Зберегти нотатку</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const div = document.createElement("div");
    div.innerHTML = modalHtml;
    mount.appendChild(div);
    if (window.lucide) window.lucide.createIcons();

    const closeModal = () => div.remove();
    document.getElementById("btn-close-note-modal")?.addEventListener("click", closeModal);
    document.getElementById("btn-cancel-note")?.addEventListener("click", closeModal);

    document.getElementById("form-add-meeting-note")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const body = document.getElementById("note-body").value.trim();
        const noteType = document.getElementById("note-type").value;
        const isClientVisible = document.getElementById("note-client-visible").checked;

        const res = await DataClient.createMeetingNote({
            meeting_id: meeting.id,
            body,
            note_type: noteType,
            is_client_visible: isClientVisible
        });

        if (res.error) alert("Помилка: " + res.error.message);
        else {
            closeModal();
            onAdded();
        }
    });
}

async function openCreateActionItemModal(meeting, onCreated) {
    const mount = document.getElementById("meeting-detail-modal-mount") || document.body;

    const { data: staff } = await DataClient.getStaffProfiles();
    const { data: contacts } = await DataClient.getContactsByOrg(meeting.organization_id);

    const todayStr = new Date().toISOString().split("T")[0];

    const modalHtml = `
        <div class="portal-modal-backdrop" id="create-action-item-backdrop">
            <div class="portal-modal" style="max-width: 540px;">
                <div class="portal-modal-header">
                    <div class="portal-modal-title" style="display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="target" style="color: var(--color-warning); width: 18px; height: 18px;"></i>
                        <span>Додати задачу за підсумками зустрічі</span>
                    </div>
                    <button class="portal-modal-close" id="btn-close-action-item-modal">&times;</button>
                </div>

                <form id="form-create-action-item" class="portal-modal-body" style="display: flex; flex-direction: column; gap: 14px;">
                    <div class="portal-form-group">
                        <label class="portal-label">Назва задачі / дії *</label>
                        <input type="text" id="action-title" class="portal-input" placeholder="напр., Надати доступи до Google Analytics" required />
                    </div>

                    <div class="portal-form-group">
                        <label class="portal-label">Опис (опціонально)</label>
                        <textarea id="action-desc" class="portal-textarea" rows="2" placeholder="Деталі або посилання..."></textarea>
                    </div>

                    <div class="portal-form-group">
                        <label class="portal-label">Хто виконує (Відповідальність) *</label>
                        <select id="action-responsibility" class="portal-select">
                            <option value="internal" selected>Команда FIRSTWIN (Внутрішня задача)</option>
                            <option value="client">Клієнт (Очікуємо дію від клієнта)</option>
                        </select>
                    </div>

                    <!-- Assignee Pickers -->
                    <div class="portal-form-group" id="group-internal-assignee">
                        <label class="portal-label">Виконавець з команди</label>
                        <select id="action-assignee-user" class="portal-select">
                            <option value="">Не призначено</option>
                            ${(staff || []).map(s => `
                                <option value="${s.id}" ${s.id === PortalAuth.getUserId() ? 'selected' : ''}>${escapeHtml(s.full_name || s.email)}</option>
                            `).join("")}
                        </select>
                    </div>

                    <div class="portal-form-group" id="group-client-assignee" style="display: none;">
                        <label class="portal-label">Контактна особа клієнта *</label>
                        <select id="action-client-contact" class="portal-select">
                            ${(contacts || []).map(c => `
                                <option value="${c.id}">${escapeHtml(c.first_name)} ${escapeHtml(c.last_name || "")} (${escapeHtml(c.position || "Контакт")})</option>
                            `).join("")}
                        </select>
                    </div>

                    <div class="portal-form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div class="portal-form-group">
                            <label class="portal-label">Пріоритет *</label>
                            <select id="action-priority" class="portal-select">
                                <option value="low">Низький</option>
                                <option value="medium" selected>Середній</option>
                                <option value="high">Високий</option>
                                <option value="critical">Критичний</option>
                            </select>
                        </div>

                        <div class="portal-form-group">
                            <label class="portal-label">Дедлайн (Due Date)</label>
                            <input type="date" id="action-due-date" class="portal-input" value="${todayStr}" />
                        </div>
                    </div>

                    <div class="portal-modal-actions">
                        <button type="button" class="btn btn-outline" id="btn-cancel-action-item">Скасувати</button>
                        <button type="submit" class="btn btn-primary">Створити задачу</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const div = document.createElement("div");
    div.innerHTML = modalHtml;
    mount.appendChild(div);
    if (window.lucide) window.lucide.createIcons();

    const closeModal = () => div.remove();
    document.getElementById("btn-close-action-item-modal")?.addEventListener("click", closeModal);
    document.getElementById("btn-cancel-action-item")?.addEventListener("click", closeModal);

    // Toggle responsibility
    document.getElementById("action-responsibility")?.addEventListener("change", (e) => {
        const isClient = e.target.value === "client";
        document.getElementById("group-internal-assignee").style.display = isClient ? "none" : "block";
        document.getElementById("group-client-assignee").style.display = isClient ? "block" : "none";
    });

    document.getElementById("form-create-action-item")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const title = document.getElementById("action-title").value.trim();
        const description = document.getElementById("action-desc").value.trim() || null;
        const responsibility = document.getElementById("action-responsibility").value;
        const priority = document.getElementById("action-priority").value;
        const dueDate = document.getElementById("action-due-date").value || null;

        const isClient = responsibility === "client";
        const assigneeUserId = isClient ? null : (document.getElementById("action-assignee-user").value || null);
        const clientContactId = isClient ? (document.getElementById("action-client-contact").value || null) : null;

        const taskData = {
            organization_id: meeting.organization_id,
            project_id: meeting.project_id,
            title,
            description,
            priority,
            due_date: dueDate,
            responsibility_type: responsibility,
            assignee_user_id: assigneeUserId,
            client_contact_id: clientContactId,
            status: "todo"
        };

        const res = await DataClient.createTaskFromMeeting(meeting.id, taskData);
        if (res.error) alert("Помилка: " + res.error.message);
        else {
            closeModal();
            onCreated();
        }
    });
}

async function openAddParticipantModal(meeting, onAdded) {
    const mount = document.getElementById("meeting-detail-modal-mount") || document.body;

    const { data: staff } = await DataClient.getStaffProfiles();
    const { data: contacts } = await DataClient.getContactsByOrg(meeting.organization_id);

    const modalHtml = `
        <div class="portal-modal-backdrop" id="add-part-backdrop">
            <div class="portal-modal" style="max-width: 480px;">
                <div class="portal-modal-header">
                    <div class="portal-modal-title">
                        <i data-lucide="user-plus" style="color: var(--color-primary);"></i>
                        <span>Додати учасника</span>
                    </div>
                    <button class="portal-modal-close" id="btn-close-part-modal">&times;</button>
                </div>

                <form id="form-add-meeting-participant" class="portal-modal-body" style="display: flex; flex-direction: column; gap: 14px;">
                    <div class="portal-form-group">
                        <label class="portal-label">Тип учасника *</label>
                        <select id="part-type" class="portal-select">
                            <option value="user" selected>Співробітник FIRSTWIN</option>
                            <option value="contact">Контактна особа клієнта</option>
                        </select>
                    </div>

                    <div class="portal-form-group" id="group-user-select">
                        <label class="portal-label">Оберіть співробітника *</label>
                        <select id="part-user-id" class="portal-select">
                            ${(staff || []).map(s => `
                                <option value="${s.id}">${escapeHtml(s.full_name || s.email)} (${s.global_role})</option>
                            `).join("")}
                        </select>
                    </div>

                    <div class="portal-form-group" id="group-contact-select" style="display: none;">
                        <label class="portal-label">Оберіть контакт клієнта *</label>
                        <select id="part-contact-id" class="portal-select">
                            ${(contacts || []).map(c => `
                                <option value="${c.id}">${escapeHtml(c.first_name)} ${escapeHtml(c.last_name || "")} (${escapeHtml(c.position || "Контакт")})</option>
                            `).join("")}
                        </select>
                    </div>

                    <div class="portal-modal-actions">
                        <button type="button" class="btn btn-outline" id="btn-cancel-part">Скасувати</button>
                        <button type="submit" class="btn btn-primary">Додати</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const div = document.createElement("div");
    div.innerHTML = modalHtml;
    mount.appendChild(div);
    if (window.lucide) window.lucide.createIcons();

    const closeModal = () => div.remove();
    document.getElementById("btn-close-part-modal")?.addEventListener("click", closeModal);
    document.getElementById("btn-cancel-part")?.addEventListener("click", closeModal);

    document.getElementById("part-type")?.addEventListener("change", (e) => {
        const isUser = e.target.value === "user";
        document.getElementById("group-user-select").style.display = isUser ? "block" : "none";
        document.getElementById("group-contact-select").style.display = isUser ? "none" : "block";
    });

    document.getElementById("form-add-meeting-participant")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const pType = document.getElementById("part-type").value;
        const userId = pType === "user" ? document.getElementById("part-user-id").value : null;
        const contactId = pType === "contact" ? document.getElementById("part-contact-id").value : null;

        const res = await DataClient.addMeetingParticipant(meeting.id, {
            organization_id: meeting.organization_id,
            project_id: meeting.project_id,
            participant_type: pType,
            user_id: userId,
            contact_id: contactId,
            attendance_status: "invited"
        });

        if (res.error) alert("Помилка: " + res.error.message);
        else {
            closeModal();
            onAdded();
        }
    });
}

async function openLinkDocumentModal(meeting, onLinked) {
    const mount = document.getElementById("meeting-detail-modal-mount") || document.body;

    const { data: projectDocs } = await DataClient.getDocuments({ projectId: meeting.project_id });

    const modalHtml = `
        <div class="portal-modal-backdrop" id="link-doc-backdrop">
            <div class="portal-modal" style="max-width: 480px;">
                <div class="portal-modal-header">
                    <div class="portal-modal-title">
                        <i data-lucide="paperclip" style="color: var(--color-primary);"></i>
                        <span>Прикріпити документ проєкту</span>
                    </div>
                    <button class="portal-modal-close" id="btn-close-link-doc-modal">&times;</button>
                </div>

                <form id="form-link-meeting-doc" class="portal-modal-body" style="display: flex; flex-direction: column; gap: 14px;">
                    <div class="portal-form-group">
                        <label class="portal-label">Оберіть документ із проєкту *</label>
                        <select id="link-doc-id" class="portal-select" required>
                            ${(!projectDocs || projectDocs.length === 0) ? `<option value="">Документів у проєкті не знайдено</option>` : projectDocs.map(d => `
                                <option value="${d.id}">${escapeHtml(d.title)} (${escapeHtml(d.category)})</option>
                            `).join("")}
                        </select>
                    </div>

                    <div class="portal-form-group">
                        <label class="portal-label">Тип зв'язку матеріалу</label>
                        <select id="link-doc-relation" class="portal-select">
                            <option value="agenda_material" selected>Матеріал до адженди</option>
                            <option value="presentation">Презентація</option>
                            <option value="meeting_deliverable">Результат зустрічі / Артефакт</option>
                            <option value="final_report">Підсумковий звіт</option>
                            <option value="material">Загальний матеріал</option>
                        </select>
                    </div>

                    <div class="portal-modal-actions">
                        <button type="button" class="btn btn-outline" id="btn-cancel-link-doc">Скасувати</button>
                        <button type="submit" class="btn btn-primary" ${(!projectDocs || projectDocs.length === 0) ? 'disabled' : ''}>Прикріпити</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const div = document.createElement("div");
    div.innerHTML = modalHtml;
    mount.appendChild(div);
    if (window.lucide) window.lucide.createIcons();

    const closeModal = () => div.remove();
    document.getElementById("btn-close-link-doc-modal")?.addEventListener("click", closeModal);
    document.getElementById("btn-cancel-link-doc")?.addEventListener("click", closeModal);

    document.getElementById("form-link-meeting-doc")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const docId = document.getElementById("link-doc-id").value;
        const relType = document.getElementById("link-doc-relation").value;

        if (!docId) return;

        const res = await DataClient.linkDocumentToMeeting(meeting.id, docId, relType);
        if (res.error) alert("Помилка: " + res.error.message);
        else {
            closeModal();
            onLinked();
        }
    });
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
