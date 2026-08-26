/* js/client/ui/client-dashboard-view.js - Client Dashboard Component */

import { DataClient } from "../../portal/api/data-client.js";
import { PortalAuth } from "../../portal/auth/auth-service.js";

export function renderClientDashboardView(dashboardData) {
    const { organization, projects = [], stages = [], milestones = [], clientActions = [], documents = [], nextMeeting, pendingInvoices = [] } = dashboardData;

    const profile = PortalAuth.getProfile();
    const contactName = profile?.full_name || organization?.contacts?.[0]?.first_name || "Клієнт";
    const pm = organization?.responsible_pm;

    // 1. KPI Calculations
    const activeProjectsCount = projects.filter(p => ["in_progress", "discovery", "onboarding", "waiting_client", "client_review"].includes(p.status)).length;
    const completedMilestonesCount = milestones.filter(m => m.status === "completed").length;
    const totalMilestonesCount = milestones.length;
    const pendingActionsCount = clientActions.filter(a => a.status !== "done").length;

    let nextMeetingText = "Не заплановано";
    if (nextMeeting?.start_at) {
        const d = new Date(nextMeeting.start_at);
        nextMeetingText = d.toLocaleDateString("uk-UA", { day: "2-digit", month: "short" }) + ", " + d.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
    }

    // Slice for dashboard summary view (max 5 records)
    const displayActions = clientActions.slice(0, 5);
    const remainingActionsCount = clientActions.length - displayActions.length;

    const displayDocs = documents.slice(0, 5);
    const remainingDocsCount = documents.length - displayDocs.length;

    return `
        <div class="client-dashboard-container">
            <!-- Greeting & Header Banner -->
            <div class="client-banner">
                <div class="client-banner-content">
                    <div class="client-greeting-tag">Персональний кабінет клієнта</div>
                    <h1 class="client-greeting-title">Вітаємо, ${escapeHtml(contactName)}</h1>
                    <div class="client-banner-meta">
                        <span><i data-lucide="building" style="width: 14px; height: 14px;"></i> ${escapeHtml(organization.name)}</span>
                        ${pm ? `<span><i data-lucide="user-check" style="width: 14px; height: 14px;"></i> Ваш Project Manager: <strong>${escapeHtml(pm.full_name || pm.email)}</strong></span>` : ""}
                    </div>
                </div>
            </div>

            <!-- KPI Cards Grid -->
            <div class="client-kpi-grid">
                <div class="client-kpi-card">
                    <div class="client-kpi-icon" style="background: rgba(79, 70, 229, 0.15); color: #818CF8;">
                        <i data-lucide="folder"></i>
                    </div>
                    <div class="client-kpi-data">
                        <div class="client-kpi-value">${activeProjectsCount}</div>
                        <div class="client-kpi-label">Активні проєкти</div>
                    </div>
                </div>

                <div class="client-kpi-card">
                    <div class="client-kpi-icon" style="background: rgba(16, 185, 129, 0.15); color: #34D399;">
                        <i data-lucide="check-circle-2"></i>
                    </div>
                    <div class="client-kpi-data">
                        <div class="client-kpi-value">${completedMilestonesCount} / ${totalMilestonesCount}</div>
                        <div class="client-kpi-label">Контрольні точки</div>
                    </div>
                </div>

                <div class="client-kpi-card ${pendingActionsCount > 0 ? 'client-kpi-card-highlight' : ''}">
                    <div class="client-kpi-icon" style="background: rgba(245, 158, 11, 0.15); color: #FBBF24;">
                        <i data-lucide="alert-circle"></i>
                    </div>
                    <div class="client-kpi-data">
                        <div class="client-kpi-value">${pendingActionsCount}</div>
                        <div class="client-kpi-label">Очікуємо від вас</div>
                    </div>
                </div>

                <div class="client-kpi-card">
                    <div class="client-kpi-icon" style="background: rgba(59, 130, 246, 0.15); color: #60A5FA;">
                        <i data-lucide="calendar"></i>
                    </div>
                    <div class="client-kpi-data">
                        <div class="client-kpi-value" style="font-size: 1.1rem; font-weight: 700;">${nextMeetingText}</div>
                        <div class="client-kpi-label">Наступна зустріч</div>
                    </div>
                </div>
            </div>

            <!-- Two Columns Main Layout -->
            <div class="client-sections-grid">
                <!-- Left Main Column: Projects & Actions -->
                <div class="client-main-col">
                    <!-- Section: Active Projects -->
                    <section class="client-card">
                        <div class="client-card-header">
                            <div class="client-card-title">
                                <i data-lucide="briefcase" style="color: var(--color-primary);"></i>
                                <span>Ваші проєкти</span>
                            </div>
                            <a href="#/client/projects" class="btn btn-sm btn-ghost" style="font-size: 0.8rem;">
                                Всі проєкти (${projects.length}) <i data-lucide="chevron-right" style="width: 13px; height: 13px;"></i>
                            </a>
                        </div>

                        <div class="client-projects-list">
                            ${projects.length === 0 ? `
                                <div class="portal-empty-state" style="padding: 24px;">
                                    <div class="portal-empty-icon"><i data-lucide="folder-open"></i></div>
                                    <div class="portal-empty-title">Проєктів не знайдено</div>
                                    <div class="portal-empty-desc">Для вашого кабінету ще не надано доступу до активних проєктів.</div>
                                </div>
                            ` : projects.map(p => {
                                const projectStages = stages.filter(s => s.project_id === p.id);
                                const projectMilestones = milestones.filter(m => m.project_id === p.id);
                                const progress = calculateClientProgress(projectStages, projectMilestones);
                                const currentStage = projectStages.find(s => s.status === "in_progress") || projectStages.find(s => s.status !== "completed") || null;
                                const nextMilestone = projectMilestones.find(m => m.status === "pending") || null;

                                const targetDate = p.target_date || p.target_end_date ? new Date(p.target_date || p.target_end_date).toLocaleDateString("uk-UA", { day: "2-digit", month: "short", year: "numeric" }) : null;

                                return `
                                    <div class="client-project-card" onclick="window.location.hash = '#/client/projects/${p.id}'" style="cursor: pointer;">
                                        <div class="client-project-header">
                                            <div>
                                                <div class="client-project-name">${escapeHtml(p.name || p.title || 'Проєкт')}</div>
                                                <div class="client-project-type">${getClientProjectTypeLabel(p.project_type)}</div>
                                            </div>
                                            <span class="portal-badge portal-badge-status-${p.status}">
                                                ${getClientProjectStatusLabel(p.status)}
                                            </span>
                                        </div>

                                        <!-- Progress Bar -->
                                        <div class="client-progress-section">
                                            <div class="client-progress-header">
                                                <span style="font-size: 0.8rem; color: var(--text-secondary);">Прогрес виконання</span>
                                                <span style="font-size: 0.82rem; font-weight: 700; color: var(--color-primary);">${progress !== null ? `${progress}%` : "Дорожня карта готується"}</span>
                                            </div>
                                            <div class="client-progress-track">
                                                <div class="client-progress-fill" style="width: ${progress !== null ? progress : 0}%;"></div>
                                            </div>
                                        </div>

                                        <!-- Stage / Milestone Meta -->
                                        <div class="client-project-meta-grid">
                                            <div class="client-meta-box">
                                                <div class="client-meta-label">Поточний етап</div>
                                                <div class="client-meta-value">${currentStage ? escapeHtml(currentStage.name) : "Етап узгоджується"}</div>
                                            </div>
                                            <div class="client-meta-box">
                                                <div class="client-meta-label">Наступна точка</div>
                                                <div class="client-meta-value">${nextMilestone ? escapeHtml(nextMilestone.name) : "Всі точки виконано"}</div>
                                            </div>
                                            ${targetDate ? `
                                                <div class="client-meta-box">
                                                    <div class="client-meta-label">Очікуваний термін</div>
                                                    <div class="client-meta-value">до ${targetDate}</div>
                                                </div>
                                            ` : ""}
                                        </div>
                                    </div>
                                `;
                            }).join("")}
                        </div>
                    </section>

                    <!-- Section: Client Actions (Очікуємо від вас) -->
                    <section class="client-card" style="margin-top: 24px;">
                        <div class="client-card-header">
                            <div class="client-card-title">
                                <i data-lucide="check-square" style="color: var(--color-warning);"></i>
                                <span>Очікуємо від вас</span>
                            </div>
                            <a href="#/client/actions" class="btn btn-sm btn-ghost" style="font-size: 0.8rem;">
                                Переглянути всі (${clientActions.length}) <i data-lucide="chevron-right" style="width: 13px; height: 13px;"></i>
                            </a>
                        </div>

                        <div class="client-actions-list">
                            ${displayActions.length === 0 ? `
                                <div class="portal-empty-state" style="padding: 24px;">
                                    <div class="portal-empty-icon" style="color: var(--color-success);"><i data-lucide="check-circle"></i></div>
                                    <div class="portal-empty-title">Все виконано!</div>
                                    <div class="portal-empty-desc">Наразі немає відкритих дій чи запитів, які потребують вашої участі.</div>
                                </div>
                            ` : displayActions.map(action => {
                                const isDone = action.status === "done";
                                const dueDate = action.due_date ? new Date(action.due_date).toLocaleDateString("uk-UA", { day: "2-digit", month: "short" }) : null;
                                const isOverdue = !isDone && action.due_date && new Date(action.due_date) < new Date(Date.now() - 24*60*60*1000);

                                return `
                                    <div class="client-action-item ${isDone ? 'client-action-done' : ''}" data-task-id="${action.id}">
                                        <div class="client-action-checkbox-wrapper">
                                            <button class="client-action-toggle-btn ${isDone ? 'checked' : ''}" data-task-id="${action.id}" title="${isDone ? 'Повернути до виконання' : 'Позначити виконаним'}">
                                                <i data-lucide="${isDone ? 'check' : 'square'}" style="width: 16px; height: 16px;"></i>
                                            </button>
                                        </div>

                                        <div class="client-action-content">
                                            <div class="client-action-title ${isDone ? 'done-text' : ''}">
                                                ${escapeHtml(action.title)}
                                            </div>
                                            ${action.description ? `
                                                <div class="client-action-desc">${escapeHtml(action.description)}</div>
                                            ` : ""}
                                            <div class="client-action-meta">
                                                <span class="portal-badge" style="background: rgba(255,255,255,0.05); color: var(--text-secondary); font-size: 0.74rem;">
                                                    <i data-lucide="folder" style="width: 11px; height: 11px;"></i> ${escapeHtml(action.project?.title || action.project?.name || 'Проєкт')}
                                                </span>
                                                ${dueDate ? `
                                                    <span class="client-due-badge ${isOverdue ? 'overdue' : ''}">
                                                        <i data-lucide="clock" style="width: 11px; height: 11px;"></i> до ${dueDate}
                                                    </span>
                                                ` : ""}
                                            </div>
                                        </div>

                                        <div class="client-action-btn-col">
                                            ${!isDone ? `
                                                <button class="btn btn-sm btn-primary btn-complete-client-action" data-task-id="${action.id}" style="padding: 6px 14px; font-size: 0.8rem; white-space: nowrap;">
                                                    <i data-lucide="check" style="width: 13px; height: 13px;"></i> Позначити виконаним
                                                </button>
                                            ` : `
                                                <div style="display: flex; align-items: center; gap: 6px;">
                                                    <span class="portal-badge" style="background: rgba(16, 185, 129, 0.15); color: #34D399; display: inline-flex; align-items: center; gap: 4px;">
                                                        <i data-lucide="check-circle-2" style="width: 12px; height: 12px;"></i> Виконано
                                                    </span>
                                                    <button class="btn btn-sm btn-outline btn-reopen-client-action" data-task-id="${action.id}" style="padding: 4px 8px; font-size: 0.72rem; border-color: rgba(255,255,255,0.12); color: var(--text-muted);" title="Повернути до виконання">
                                                        <i data-lucide="rotate-ccw" style="width: 11px; height: 11px;"></i> Повернути
                                                    </button>
                                                </div>
                                            `}
                                        </div>
                                    </div>
                                `;
                            }).join("")}
                            ${remainingActionsCount > 0 ? `
                                <div style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 10px 0 2px 0;">
                                    <a href="#/client/actions" style="color: var(--color-primary); text-decoration: none;">Ще ${remainingActionsCount} ${remainingActionsCount === 1 ? 'дія' : ([2,3,4].includes(remainingActionsCount) ? 'дії' : 'дій')} &rarr;</a>
                                </div>
                            ` : ""}
                        </div>
                    </section>
                </div>

                <!-- Right Sidebar Column: Next Meeting & Documents -->
                <div class="client-side-col">
                    ${pendingInvoices.length > 0 ? `
                        <!-- Section: Pending Payment Requests (Phase 5C.2) -->
                        <section class="client-card" style="border-top: 3px solid var(--color-warning);">
                            <div class="client-card-header">
                                <div class="client-card-title">
                                    <i data-lucide="credit-card" style="color: var(--color-warning);"></i>
                                    <span>Очікується оплата</span>
                                </div>
                                <a href="#/client/billing" class="btn btn-sm btn-ghost" style="font-size: 0.8rem;">
                                    Всі (${pendingInvoices.length}) <i data-lucide="chevron-right" style="width: 13px; height: 13px;"></i>
                                </a>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 10px;">
                                ${pendingInvoices.slice(0, 3).map(inv => {
                                    const tot = Number(inv.total_minor || 0);
                                    const pd = Number(inv.paid_minor || 0);
                                    const out = Math.max(tot - pd, 0);
                                    const isDue = out > 0 && new Date(inv.due_date) < new Date();
                                    return `
                                        <div style="padding: 12px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 8px;">
                                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                                                <a href="#/client/billing/${inv.id}" style="font-weight: 700; color: var(--text-primary); text-decoration: none; font-size: 0.9rem;">
                                                    Рахунок ${escapeHtml(inv.invoice_number || 'б/н')}
                                                </a>
                                                <span class="portal-badge ${isDue ? 'portal-badge-danger' : 'portal-badge-warning'}" style="font-size: 0.72rem;">
                                                    ${isDue ? 'Прострочено' : 'Очікує'}
                                                </span>
                                            </div>
                                            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; margin-top: 4px;">
                                                <span style="color: var(--text-muted);">Сума до сплати:</span>
                                                <strong style="color: var(--color-warning); font-size: 0.95rem;">${DataClient.formatMoney(out, inv.currency)}</strong>
                                            </div>
                                            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; margin-top: 4px; color: var(--text-muted);">
                                                <span>Термін: ${inv.due_date}</span>
                                                <a href="#/client/billing/${inv.id}" class="btn btn-outline btn-xs" style="font-size: 0.72rem; padding: 2px 8px;">
                                                    Реквізити →
                                                </a>
                                            </div>
                                        </div>
                                    `;
                                }).join("")}
                            </div>
                        </section>
                    ` : ''}

                    <!-- Section: Next Meeting -->
                    <section class="client-card">
                        <div class="client-card-header">
                            <div class="client-card-title">
                                <i data-lucide="video" style="color: var(--color-primary);"></i>
                                <span>Наступна зустріч</span>
                            </div>
                            <a href="#/client/meetings" class="btn btn-sm btn-ghost" style="font-size: 0.8rem;">
                                Всі <i data-lucide="chevron-right" style="width: 13px; height: 13px;"></i>
                            </a>
                        </div>

                        ${nextMeeting ? `
                            <div class="client-meeting-box">
                                <div class="client-meeting-title">${escapeHtml(nextMeeting.title)}</div>
                                <div class="client-meeting-project">
                                    <i data-lucide="folder" style="width: 12px; height: 12px;"></i>
                                    <span>${escapeHtml(nextMeeting.project?.title || nextMeeting.project?.name || 'Проєкт')}</span>
                                </div>

                                <div class="client-meeting-time-row">
                                    <div class="client-meeting-time-item">
                                        <i data-lucide="calendar" style="color: var(--color-primary); width: 16px; height: 16px;"></i>
                                        <span>${new Date(nextMeeting.start_at).toLocaleDateString("uk-UA", { weekday: "short", day: "2-digit", month: "long" })}</span>
                                    </div>
                                    <div class="client-meeting-time-item">
                                        <i data-lucide="clock" style="color: var(--color-primary); width: 16px; height: 16px;"></i>
                                        <span>${new Date(nextMeeting.start_at).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })} (${nextMeeting.timezone || 'Kyiv'})</span>
                                    </div>
                                </div>

                                ${nextMeeting.meeting_url ? `
                                    <a href="${escapeHtml(nextMeeting.meeting_url)}" target="_blank" class="btn btn-primary" style="width: 100%; justify-content: center; margin-top: 14px;">
                                        <i data-lucide="video"></i> Приєднатися до дзвінка
                                    </a>
                                ` : `
                                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 12px; text-align: center;">
                                        Посилання на дзвінок буде додано організатором
                                    </div>
                                `}
                                <button class="btn btn-outline btn-sm" onclick="window.location.hash = '#/client/meetings/${nextMeeting.id}'" style="width: 100%; justify-content: center; margin-top: 8px;">
                                    Деталі та матеріали
                                </button>
                            </div>
                        ` : `
                            <div class="portal-empty-state" style="padding: 20px;">
                                <div class="portal-empty-icon"><i data-lucide="calendar-x"></i></div>
                                <div class="portal-empty-title">Зустрічей не заплановано</div>
                                <div class="portal-empty-desc">Менеджер проєкту узгодить з вами час наступної синхронізації.</div>
                            </div>
                        `}
                    </section>

                    <!-- Section: Documents -->
                    <section class="client-card" style="margin-top: 24px;">
                        <div class="client-card-header">
                            <div class="client-card-title">
                                <i data-lucide="file-text" style="color: var(--color-accent);"></i>
                                <span>Документи</span>
                            </div>
                            <a href="#/client/documents" class="btn btn-sm btn-ghost" style="font-size: 0.8rem;">
                                Переглянути всі (${documents.length}) <i data-lucide="chevron-right" style="width: 13px; height: 13px;"></i>
                            </a>
                        </div>

                        <div class="client-docs-list">
                            ${displayDocs.length === 0 ? `
                                <div class="portal-empty-state" style="padding: 20px;">
                                    <div class="portal-empty-icon"><i data-lucide="file"></i></div>
                                    <div class="portal-empty-title">Матеріали ще готуються</div>
                                    <div class="portal-empty-desc">Матеріали та фінальні артефакти будуть опубліковані тут після підготовки.</div>
                                </div>
                            ` : displayDocs.map(doc => {
                                const versions = (doc.document_versions || []).filter(v => v.is_client_visible === true);
                                const latestVersion = versions[0] || null;
                                const isReview = doc.status === "client_review";

                                return `
                                    <div class="client-doc-item" onclick="window.location.hash = '#/client/documents/${doc.id}'" style="cursor: pointer;">
                                        <div class="client-doc-icon">
                                            <i data-lucide="${getDocumentIcon(doc.category)}"></i>
                                        </div>
                                        <div class="client-doc-info">
                                            <div class="client-doc-title">${escapeHtml(doc.title)}</div>
                                            <div class="client-doc-meta">
                                                <span>${escapeHtml(doc.category)}</span>
                                                ${latestVersion ? `<span>v${latestVersion.version_number}</span>` : '<span style="color: var(--text-muted);">Готується</span>'}
                                            </div>
                                            ${isReview ? `
                                                <span class="portal-badge" style="background: rgba(245, 158, 11, 0.15); color: #FBBF24; margin-top: 4px; display: inline-flex; align-items: center; gap: 4px;">
                                                    <i data-lucide="eye" style="width: 10px; height: 10px;"></i> Потрібне погодження
                                                </span>
                                            ` : ""}
                                        </div>
                                        <div class="client-doc-action">
                                            ${latestVersion ? `
                                                <button class="btn btn-sm btn-outline btn-download-client-doc" data-storage-path="${escapeHtml(latestVersion.storage_path)}" title="Завантажити" style="padding: 6px 10px;">
                                                    <i data-lucide="download" style="width: 14px; height: 14px;"></i>
                                                </button>
                                            ` : `
                                                <span style="font-size: 0.74rem; color: var(--text-muted);">Готується</span>
                                            `}
                                        </div>
                                    </div>
                                `;
                            }).join("")}
                            ${remainingDocsCount > 0 ? `
                                <div style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 8px 0 0 0;">
                                    Ще ${remainingDocsCount} ${remainingDocsCount === 1 ? 'документ' : ([2,3,4].includes(remainingDocsCount) ? 'документи' : 'документів')}
                                </div>
                            ` : ""}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    `;
}

export function initClientDashboardEvents(dashboardData, reloadCallback) {
    if (window.lucide) window.lucide.createIcons();

    // Complete Action button
    document.querySelectorAll(".btn-complete-client-action").forEach(btn => {
        btn.addEventListener("click", async () => {
            const taskId = btn.getAttribute("data-task-id");
            if (!taskId) return;

            btn.disabled = true;
            btn.innerHTML = `<span class="portal-spinner" style="width:12px;height:12px;border-width:2px;"></span> Оновлення...`;

            try {
                const { error } = await DataClient.completeClientAction(taskId);
                if (error) {
                    alert(`Помилка: ${error.message}`);
                } else if (reloadCallback) {
                    await reloadCallback();
                }
            } catch (err) {
                alert(`Помилка: ${err.message}`);
            } finally {
                btn.disabled = false;
            }
        });
    });

    // Reopen Action button
    document.querySelectorAll(".btn-reopen-client-action").forEach(btn => {
        btn.addEventListener("click", async () => {
            const taskId = btn.getAttribute("data-task-id");
            if (!taskId) return;

            btn.disabled = true;
            btn.innerHTML = `<span class="portal-spinner" style="width:10px;height:10px;border-width:2px;"></span>`;

            try {
                const { error } = await DataClient.reopenClientAction(taskId);
                if (error) {
                    alert(`Помилка: ${error.message}`);
                } else if (reloadCallback) {
                    await reloadCallback();
                }
            } catch (err) {
                alert(`Помилка: ${err.message}`);
            } finally {
                btn.disabled = false;
            }
        });
    });

    // Toggle Action checkbox button
    document.querySelectorAll(".client-action-toggle-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
            const taskId = btn.getAttribute("data-task-id");
            if (!taskId) return;

            const isChecked = btn.classList.contains("checked");
            btn.disabled = true;

            try {
                if (isChecked) {
                    await DataClient.reopenClientAction(taskId);
                } else {
                    await DataClient.completeClientAction(taskId);
                }
                if (reloadCallback) await reloadCallback();
            } catch (err) {
                alert(`Помилка: ${err.message}`);
            } finally {
                btn.disabled = false;
            }
        });
    });

    // Download Document
    document.querySelectorAll(".btn-download-client-doc").forEach(btn => {
        btn.addEventListener("click", async () => {
            const storagePath = btn.getAttribute("data-storage-path");
            if (!storagePath) return;

            btn.disabled = true;
            try {
                const { data, error } = await DataClient.getClientDocumentDownloadUrl(storagePath);
                if (error || !data?.signedUrl) {
                    alert("Не вдалося отримати посилання для завантаження документа.");
                } else {
                    window.open(data.signedUrl, "_blank");
                }
            } catch (err) {
                alert(`Помилка: ${err.message}`);
            } finally {
                btn.disabled = false;
            }
        });
    });
}

function calculateClientProgress(stages, milestones) {
    if (!stages || stages.length === 0) return null;

    let totalProgress = 0;
    for (const stage of stages) {
        const stageMilestones = milestones.filter(m => m.stage_id === stage.id);
        if (stageMilestones.length > 0) {
            const completed = stageMilestones.filter(m => m.status === "completed").length;
            totalProgress += (completed / stageMilestones.length) * 100;
        } else {
            if (stage.status === "completed") {
                totalProgress += 100;
            }
        }
    }

    return Math.round(totalProgress / stages.length);
}

function getClientProjectStatusLabel(status) {
    switch (status) {
        case "draft": return "Підготовка";
        case "onboarding": return "Онбординг";
        case "discovery": return "Дослідження";
        case "in_progress": return "В роботі";
        case "waiting_client": return "Очікуємо клієнта";
        case "client_review": return "На погодженні";
        case "completed": return "Завершений";
        case "paused": return "На паузі";
        default: return status || "В роботі";
    }
}

function getClientProjectTypeLabel(type) {
    switch (type) {
        case "audit_sales": return "Аудит відділу продажів";
        case "crm_implementation": return "Впровадження CRM";
        case "scripts_kpi": return "Скрипти & KPI";
        case "sales_training": return "Навчання команди";
        case "ai_automation": return "AI Автоматизація";
        default: return "Комплексний проєкт";
    }
}

function getDocumentIcon(category) {
    switch (category) {
        case "Аудит": return "search";
        case "Стратегія": return "compass";
        case "Sales Playbook": return "book-open";
        case "Скрипти": return "file-code";
        case "Звіт": return "bar-chart-2";
        case "Аналітика": return "pie-chart";
        case "Технічне завдання": return "cpu";
        default: return "file-text";
    }
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
