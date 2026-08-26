/* js/client/ui/client-projects-view.js - Client Projects List View */

export function renderClientProjectsView(projects = []) {
    return `
        <div class="client-container">
            <!-- Header -->
            <div class="client-section-header" style="margin-bottom: 24px;">
                <div>
                    <h1 class="client-page-title">Ваші проєкти</h1>
                    <p class="client-page-subtitle">Перелік активних та реалізованих проєктів делівері для вашої компанії.</p>
                </div>
            </div>

            <!-- Projects Grid -->
            ${projects.length === 0 ? `
                <div class="client-card" style="text-align: center; padding: 60px 20px;">
                    <div class="portal-empty-icon" style="color: var(--text-muted); margin-bottom: 16px;">
                        <i data-lucide="folder-open" style="width: 48px; height: 48px;"></i>
                    </div>
                    <h3 style="font-size: 1.15rem; font-weight: 600; margin-bottom: 8px;">Немає доступних проєктів</h3>
                    <p style="color: var(--text-secondary); max-width: 440px; margin: 0 auto;">
                        Для вашої організації наразі не призначено активних проєктів або вони готуються командою FIRSTWIN.
                    </p>
                </div>
            ` : `
                <div class="client-projects-grid">
                    ${projects.map(p => renderClientProjectCard(p)).join("")}
                </div>
            `}
        </div>
    `;
}

function renderClientProjectCard(p) {
    const title = p.name || p.title || "Проєкт делівері";
    const typeLabel = getProjectTypeLabel(p.project_type);
    const statusInfo = getProjectStatusBadge(p.status);
    const progress = p.progress !== null ? `${p.progress}%` : "Готується";
    const pmName = p.responsible_pm?.full_name || "Команда FIRSTWIN";

    const currentStageName = p.currentStage ? p.currentStage.name : "Етап формується";
    const nextMilestoneName = p.nextMilestone ? p.nextMilestone.name : "Контрольна точка очікується";
    const targetDateFormatted = p.target_date ? formatDate(p.target_date) : (p.target_end_date ? formatDate(p.target_end_date) : "Уточнюється");

    const nextMeetFormatted = p.nextMeeting 
        ? `${formatDate(p.nextMeeting.start_at)} о ${formatTime(p.nextMeeting.start_at)}` 
        : "Не заплановано";

    return `
        <div class="client-card client-project-card" data-project-id="${p.id}" onclick="window.location.hash = '#/client/projects/${p.id}'" style="cursor: pointer;">
            <div class="client-project-card-header">
                <div>
                    <div class="client-project-type-tag">${escapeHtml(typeLabel)}</div>
                    <h3 class="client-project-title">${escapeHtml(title)}</h3>
                </div>
                <div class="client-badge ${statusInfo.badgeClass}">
                    ${statusInfo.label}
                </div>
            </div>

            <!-- Progress Bar -->
            <div class="client-project-progress-box">
                <div class="client-progress-header">
                    <span class="client-progress-label">Виконання дорожньої карти</span>
                    <span class="client-progress-val">${progress}</span>
                </div>
                <div class="client-progress-track">
                    <div class="client-progress-fill" style="width: ${p.progress !== null ? p.progress : 0}%;"></div>
                </div>
            </div>

            <!-- Project Details Grid -->
            <div class="client-project-metrics-grid">
                <div class="client-project-metric-item">
                    <span class="client-metric-label"><i data-lucide="play-circle" style="width: 13px; height: 13px;"></i> Поточний етап</span>
                    <span class="client-metric-val" title="${escapeHtml(currentStageName)}">${escapeHtml(currentStageName)}</span>
                </div>
                <div class="client-project-metric-item">
                    <span class="client-metric-label"><i data-lucide="flag" style="width: 13px; height: 13px;"></i> Наступна точка</span>
                    <span class="client-metric-val" title="${escapeHtml(nextMilestoneName)}">${escapeHtml(nextMilestoneName)}</span>
                </div>
                <div class="client-project-metric-item">
                    <span class="client-metric-label"><i data-lucide="calendar" style="width: 13px; height: 13px;"></i> Цільова дата</span>
                    <span class="client-metric-val">${targetDateFormatted}</span>
                </div>
                <div class="client-project-metric-item">
                    <span class="client-metric-label"><i data-lucide="user-check" style="width: 13px; height: 13px;"></i> Керівник проєкту (PM)</span>
                    <span class="client-metric-val">${escapeHtml(pmName)}</span>
                </div>
            </div>

            <!-- Footer Stats -->
            <div class="client-project-card-footer">
                <div class="client-project-footer-badges">
                    ${p.openActionsCount > 0 ? `
                        <span class="client-badge client-badge-warning" title="Відкриті дії з боку клієнта">
                            <i data-lucide="alert-circle" style="width: 12px; height: 12px;"></i>
                            ${p.openActionsCount} ${getDeclension(p.openActionsCount, 'дія', 'дії', 'дій')} від вас
                        </span>
                    ` : `
                        <span class="client-badge client-badge-success" title="Усі дії виконані">
                            <i data-lucide="check" style="width: 12px; height: 12px;"></i>
                            Дій не очікується
                        </span>
                    `}
                    <span class="client-badge client-badge-neutral" title="Наступна зустріч">
                        <i data-lucide="video" style="width: 12px; height: 12px;"></i>
                        ${escapeHtml(nextMeetFormatted)}
                    </span>
                </div>

                <div class="client-project-card-arrow">
                    <span>Відкрити кабінет проєкту</span>
                    <i data-lucide="arrow-right" style="width: 14px; height: 14px;"></i>
                </div>
            </div>
        </div>
    `;
}

export function initClientProjectsEvents() {
    if (window.lucide) window.lucide.createIcons();
}

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

function getDeclension(n, one, few, many) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 19) return many;
    if (mod10 === 1) return one;
    if (mod10 >= 2 && mod10 <= 4) return few;
    return many;
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
