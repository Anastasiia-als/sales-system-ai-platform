/* js/client/ui/client-meetings-view.js - Global Client Meetings Workspace */

import { DataClient } from "../../portal/api/data-client.js";

export function renderClientMeetingsView(meetings = [], projects = [], currentFilter = {}) {
    const selectedView = currentFilter.view || "upcoming";
    const selectedProjectId = currentFilter.projectId || "all";
    const searchKeyword = currentFilter.search || "";

    const upcomingMeetings = DataClient.getUpcomingMeetings(meetings);
    const pastMeetings = DataClient.getPastMeetings(meetings);
    const cancelledMeetings = DataClient.getCancelledMeetings(meetings);

    const upcomingCount = upcomingMeetings.length;
    const pastCount = pastMeetings.length;
    const cancelledCount = cancelledMeetings.length;

    let displayedMeetings = [];
    if (selectedView === "upcoming") {
        displayedMeetings = [...upcomingMeetings];
    } else if (selectedView === "past") {
        displayedMeetings = [...pastMeetings];
    } else if (selectedView === "cancelled") {
        displayedMeetings = [...cancelledMeetings];
    } else {
        displayedMeetings = [...upcomingMeetings];
    }

    if (selectedProjectId !== "all") {
        displayedMeetings = displayedMeetings.filter(m => m.project_id === selectedProjectId);
    }

    if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        displayedMeetings = displayedMeetings.filter(m => 
            (m.title && m.title.toLowerCase().includes(kw)) ||
            (m.agenda && m.agenda.toLowerCase().includes(kw))
        );
    }

    return `
        <div class="client-container">
            <!-- Header -->
            <div class="client-section-header" style="margin-bottom: 24px;">
                <div>
                    <h1 class="client-page-title">Синхронізаційні зустрічі</h1>
                    <p class="client-page-subtitle">Графік регулярних дзвінків, демо-сесій та презентацій результатів делівері.</p>
                </div>
            </div>

            <!-- Filter Controls Bar -->
            <div class="client-card" style="margin-bottom: 20px; padding: 16px;">
                <div class="client-meetings-filter-bar">
                    <!-- View Pills -->
                    <div class="client-filter-pills" id="client-meeting-pills">
                        <button class="client-filter-pill ${selectedView === 'upcoming' ? 'active' : ''}" data-view="upcoming">
                            Майбутні (${upcomingCount})
                        </button>
                        <button class="client-filter-pill ${selectedView === 'past' ? 'active' : ''}" data-view="past">
                            Проведені (${pastCount})
                        </button>
                        <button class="client-filter-pill ${selectedView === 'cancelled' ? 'active' : ''}" data-view="cancelled">
                            Скасовані (${cancelledCount})
                        </button>
                    </div>

                    <!-- Search & Project Select -->
                    <div class="client-actions-search-row">
                        <div class="client-search-input-wrap">
                            <i data-lucide="search" class="client-search-icon"></i>
                            <input type="text" id="input-client-meet-search" class="client-search-input" placeholder="Пошук зустрічі..." value="${escapeHtml(searchKeyword)}" />
                        </div>

                        ${projects.length > 1 ? `
                            <select id="select-client-meet-project" class="client-select-input">
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

            <!-- Meetings List -->
            ${displayedMeetings.length === 0 ? `
                <div class="client-card" style="text-align: center; padding: 60px 20px;">
                    <div class="portal-empty-icon" style="color: var(--text-muted); margin-bottom: 16px;">
                        <i data-lucide="video" style="width: 48px; height: 48px;"></i>
                    </div>
                    <h3 style="font-size: 1.15rem; font-weight: 600; margin-bottom: 8px;">
                        ${selectedView === 'upcoming' ? 'Наступних зустрічей не заплановано' : 'Немає зустрічей у цьому списку'}
                    </h3>
                    <p style="color: var(--text-secondary); max-width: 440px; margin: 0 auto;">
                        ${selectedView === 'upcoming' 
                            ? 'Команда FIRSTWIN повідомить вас про наступну синхронізацію.' 
                            : 'Історія зустрічей відображатиметься тут після проведення дзвінків.'}
                    </p>
                </div>
            ` : `
                <div class="client-meetings-grid">
                    ${displayedMeetings.map(m => renderMeetingWorkspaceCard(m)).join("")}
                </div>
            `}
        </div>
    `;
}

function renderMeetingWorkspaceCard(m) {
    const isUpcoming = m.status === 'scheduled' && new Date(m.start_at) >= new Date(Date.now() - 30 * 60 * 1000);
    const dateFormatted = formatDate(m.start_at);
    const timeFormatted = `${formatTime(m.start_at)} - ${formatTime(m.end_at)}`;
    const projectName = m.project?.name || m.project?.title || "Проєкт";
    const typeLabel = getMeetingTypeLabel(m.meeting_type);
    const statusBadge = getMeetingStatusBadge(m.status);

    return `
        <div class="client-card client-meeting-card" style="margin-bottom: 14px;">
            <div class="client-meeting-card-header">
                <div style="display: flex; gap: 16px; align-items: center; min-width: 0; flex: 1;">
                    <div class="client-meeting-date-badge ${isUpcoming ? 'upcoming' : ''}">
                        <div class="client-meeting-date-month">${new Date(m.start_at).toLocaleDateString('uk-UA', { month: 'short' }).toUpperCase()}</div>
                        <div class="client-meeting-date-day">${new Date(m.start_at).getDate()}</div>
                    </div>

                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 4px; flex-wrap: wrap;">
                            <span class="client-badge client-badge-neutral" style="font-size: 0.75rem;">
                                <i data-lucide="folder" style="width: 11px; height: 11px;"></i> ${escapeHtml(projectName)}
                            </span>
                            <span class="client-project-type-tag" style="font-size: 0.75rem;">${escapeHtml(typeLabel)}</span>
                            <span class="client-badge ${statusBadge.badgeClass}" style="font-size: 0.75rem;">${statusBadge.label}</span>
                        </div>

                        <h4 class="client-meeting-title" style="font-size: 1.05rem;">${escapeHtml(m.title)}</h4>

                        <div class="client-meeting-time-str" style="margin-top: 4px;">
                            <i data-lucide="clock" style="width: 12px; height: 12px;"></i>
                            ${dateFormatted}, ${timeFormatted} (${escapeHtml(m.timezone || 'Kyiv')})
                        </div>
                    </div>
                </div>

                <div class="client-meeting-actions">
                    ${isUpcoming && m.meeting_url ? `
                        <a href="${escapeHtml(m.meeting_url)}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">
                            <i data-lucide="video" style="width: 13px; height: 13px;"></i> Приєднатися
                        </a>
                    ` : ''}
                    <button class="btn btn-outline btn-sm" onclick="window.location.hash = '#/client/meetings/${m.id}'">
                        Деталі та матеріали
                    </button>
                </div>
            </div>
        </div>
    `;
}

export function initClientMeetingsEvents(meetings = [], projects = [], currentFilter = {}, onFilterChange) {
    if (window.lucide) window.lucide.createIcons();

    // View Pills
    document.querySelectorAll("#client-meeting-pills .client-filter-pill").forEach(pill => {
        pill.addEventListener("click", () => {
            const newView = pill.dataset.view;
            if (onFilterChange) {
                onFilterChange({ ...currentFilter, view: newView });
            }
        });
    });

    // Project Select
    document.getElementById("select-client-meet-project")?.addEventListener("change", (e) => {
        const newProj = e.target.value;
        if (onFilterChange) {
            onFilterChange({ ...currentFilter, projectId: newProj });
        }
    });

    // Search Input
    let searchTimeout;
    document.getElementById("input-client-meet-search")?.addEventListener("input", (e) => {
        clearTimeout(searchTimeout);
        const newKw = e.target.value;
        searchTimeout = setTimeout(() => {
            if (onFilterChange) {
                onFilterChange({ ...currentFilter, search: newKw });
            }
        }, 250);
    });
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
