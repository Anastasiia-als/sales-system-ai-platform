/* js/pages/portal-page.js - Client & Project Delivery Platform Entry Page */

import { PortalAuth } from "../portal/auth/auth-service.js";
import { renderPortalAuthView, initPortalAuthEvents } from "../portal/ui/portal-auth-view.js";
import { renderPortalShell, initPortalShellEvents } from "../portal/ui/portal-shell.js";
import { renderPortalDashboardView, initPortalDashboardEvents } from "../portal/ui/portal-dashboard-view.js";
import { renderPortalNotificationsView, initPortalNotificationsEvents } from "../portal/ui/portal-notifications-view.js";
import { renderClientsView, initClientsViewEvents } from "../portal/ui/portal-clients-view.js";
import { renderClientDetailView, initClientDetailEvents } from "../portal/ui/portal-client-detail-view.js";
import { renderProjectsView, initProjectsViewEvents } from "../portal/ui/portal-projects-view.js";
import { renderProjectDetailView, initProjectDetailEvents } from "../portal/ui/portal-project-detail-view.js?v=phase7a_r2";
import { renderTasksView, initTasksViewEvents } from "../portal/ui/portal-tasks-view.js";
import { renderDocumentsView, initDocumentsViewEvents } from "../portal/ui/portal-documents-view.js";
import { renderDocumentDetailView, initDocumentDetailEvents } from "../portal/ui/portal-document-detail-view.js";
import { renderMeetingsView, initMeetingsViewEvents } from "../portal/ui/portal-meetings-view.js";
import { renderMeetingDetailView, initMeetingDetailEvents } from "../portal/ui/portal-meeting-detail-view.js";
import { renderFinanceView, initFinanceEvents } from "../portal/ui/portal-finance-view.js";
import { renderInvoiceRegistryView, initInvoiceRegistryEvents } from "../portal/ui/portal-invoice-registry-view.js";
import { renderInvoiceDetailView, initInvoiceDetailEvents } from "../portal/ui/portal-invoice-detail-view.js";
import { renderInvoicePrintView, initInvoicePrintEvents } from "../portal/ui/portal-invoice-print-view.js";
import { renderAnalyticsView, initAnalyticsEvents } from "../portal/ui/portal-analytics-view.js";
import { renderReportsView, initReportsEvents } from "../portal/ui/portal-reports-view.js";
import { renderTemplatesView, initTemplatesEvents } from "../portal/ui/portal-templates-view.js";
import { renderGlobalAutomationView, initGlobalAutomationEvents } from "../portal/ui/portal-global-automation-view.js";
import { renderTemplateBuilderView, initTemplateBuilderEvents } from "../portal/ui/portal-template-builder-view.js";
import { renderIntegrationsView, initIntegrationsViewEvents } from "../portal/ui/portal-integrations-view.js";

export const PortalPage = {
    render() {
        return `
            <div id="portal-root">
                <div class="portal-loading-container" style="min-height: 80vh;">
                    <div class="portal-spinner"></div>
                    <span>Ініціалізація сесії FIRSTWIN Portal...</span>
                </div>
            </div>
        `;
    },

    async init() {
        await renderPortalPage();
    }
};

export async function renderPortalPage() {
    const root = document.getElementById("portal-root") || document.getElementById("app-content");
    if (!root) return;

    try {
        // 1. Initialize Auth Session
        await PortalAuth.init();

        // 2. Check Authentication
        if (!PortalAuth.isAuthenticated()) {
            root.innerHTML = renderPortalAuthView();
            initPortalAuthEvents(async () => {
                await renderPortalPage();
            });
            return;
        }

        // 2.1. Client User Guard: Client users must use Client Workspace
        if (PortalAuth.isClientUser()) {
            window.location.hash = "#/client/dashboard";
            return;
        }

        // 3. Authenticated: Parse subroute from hash
        const hash = window.location.hash || "#/portal";
        const cleanHash = hash.split("?")[0];
        const parts = cleanHash.replace(/^#\/portal\/?/, "").split("/").filter(Boolean);

        // Default to dashboard for internal users on #/portal
        let activeSection = parts[0] || (PortalAuth.isSpecialist() ? "tasks" : "dashboard");
        let entityId = parts[1] || null;

        let childHtml = "";
        let breadcrumbTitle = "";

        // 4. Render Active View
        if (activeSection === "dashboard") {
            if (PortalAuth.isSpecialist() && !PortalAuth.isGlobalOwner() && !PortalAuth.isOrgAdmin()) {
                breadcrumbTitle = "Робочий простір фахівця";
                childHtml = `
                    <div class="portal-content">
                        <div class="portal-view-header">
                            <div class="portal-view-title-group">
                                <h1 class="portal-view-title">Робочий простір фахівця</h1>
                                <p class="portal-view-subtitle">Доступ до загального портфеля обмежено</p>
                            </div>
                        </div>
                        <div class="portal-placeholder-box">
                            <div class="portal-empty-icon" style="color: var(--color-primary);"><i data-lucide="check-square"></i></div>
                            <div class="portal-empty-title">Операційні задачі</div>
                            <div class="portal-empty-desc">
                                Перейдіть до розділу <strong>Мої задачі</strong> для перегляду призначених вам завдань.
                            </div>
                            <div style="display: flex; gap: 12px; margin-top: 14px;">
                                <a href="#/portal/tasks" class="btn btn-primary">
                                    <i data-lucide="check-square"></i> Мої задачі
                                </a>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                breadcrumbTitle = "Командний центр";
                childHtml = renderPortalDashboardView();
            }
        } else if (activeSection === "notifications") {
            breadcrumbTitle = "Центр сповіщень";
            childHtml = renderPortalNotificationsView();
        } else if (activeSection === "clients" && entityId) {
            breadcrumbTitle = "Картка клієнта";
            childHtml = renderClientDetailView(entityId);
        } else if (activeSection === "clients") {
            breadcrumbTitle = "Клієнти";
            childHtml = renderClientsView();
        } else if (activeSection === "projects" && entityId) {
            breadcrumbTitle = "Паспорт проєкту";
            childHtml = renderProjectDetailView(entityId);
        } else if (activeSection === "projects") {
            breadcrumbTitle = "Проєкти";
            childHtml = renderProjectsView();
        } else if (activeSection === "tasks") {
            breadcrumbTitle = "Мої задачі";
            childHtml = renderTasksView();
        } else if (activeSection === "documents" && entityId) {
            breadcrumbTitle = "Паспорт документа";
            childHtml = renderDocumentDetailView(entityId);
        } else if (activeSection === "documents") {
            breadcrumbTitle = "Документи";
            childHtml = renderDocumentsView();
        } else if (activeSection === "meetings" && entityId) {
            breadcrumbTitle = "Картка зустрічі";
            childHtml = renderMeetingDetailView(entityId);
        } else if (activeSection === "meetings") {
            breadcrumbTitle = "Зустрічі";
            childHtml = renderMeetingsView();
        } else if (activeSection === "finance") {
            if (PortalAuth.isSpecialist() && !PortalAuth.isGlobalOwner() && !PortalAuth.isOrgAdmin()) {
                breadcrumbTitle = "Фінанси";
                childHtml = `
                    <div class="portal-content">
                        <div class="portal-placeholder-box">
                            <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="shield-alert"></i></div>
                            <div class="portal-empty-title">Доступ обмежено</div>
                            <div class="portal-empty-desc">
                                Фінансовий модуль доступний виключно для керівництва та проєктних менеджерів.
                            </div>
                        </div>
                    </div>
                `;
            } else {
                breadcrumbTitle = "Фінанси";
                childHtml = renderFinanceView();
            }
        } else if (activeSection === "invoices" && entityId && parts[2] === "print") {
            root.innerHTML = renderInvoicePrintView(entityId);
            await initInvoicePrintEvents(entityId);
            return;
        } else if (activeSection === "invoices" && entityId) {
            if (PortalAuth.isSpecialist() && !PortalAuth.isGlobalOwner() && !PortalAuth.isOrgAdmin()) {
                breadcrumbTitle = "Рахунок";
                childHtml = `
                    <div class="portal-content">
                        <div class="portal-placeholder-box">
                            <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="shield-alert"></i></div>
                            <div class="portal-empty-title">Доступ обмежено</div>
                        </div>
                    </div>
                `;
            } else {
                breadcrumbTitle = "Картка рахунку";
                childHtml = renderInvoiceDetailView(entityId);
            }
        } else if (activeSection === "invoices") {
            if (PortalAuth.isSpecialist() && !PortalAuth.isGlobalOwner() && !PortalAuth.isOrgAdmin()) {
                breadcrumbTitle = "Рахунки";
                childHtml = `
                    <div class="portal-content">
                        <div class="portal-placeholder-box">
                            <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="shield-alert"></i></div>
                            <div class="portal-empty-title">Доступ обмежено</div>
                        </div>
                    </div>
                `;
            } else {
                breadcrumbTitle = "Реєстр рахунків";
                childHtml = renderInvoiceRegistryView();
            }
        } else if (activeSection === "analytics") {
            if (PortalAuth.isSpecialist() && !PortalAuth.isGlobalOwner() && !PortalAuth.isOrgAdmin()) {
                breadcrumbTitle = "Аналітика";
                childHtml = `
                    <div class="portal-content">
                        <div class="portal-placeholder-box">
                            <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="shield-alert"></i></div>
                            <div class="portal-empty-title">Доступ обмежено</div>
                            <div class="portal-empty-desc">Аналітичний центр доступний виключно для керівництва та PM.</div>
                        </div>
                    </div>
                `;
            } else {
                breadcrumbTitle = "Аналітика";
                childHtml = renderAnalyticsView();
            }
        } else if (activeSection === "reports") {
            if (PortalAuth.isSpecialist() && !PortalAuth.isGlobalOwner() && !PortalAuth.isOrgAdmin()) {
                breadcrumbTitle = "Звіти";
                childHtml = `
                    <div class="portal-content">
                        <div class="portal-placeholder-box">
                            <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="shield-alert"></i></div>
                            <div class="portal-empty-title">Доступ обмежено</div>
                            <div class="portal-empty-desc">Центр звітів доступний виключно для керівництва та PM.</div>
                        </div>
                    </div>
                `;
            } else {
                breadcrumbTitle = "Звіти";
                childHtml = renderReportsView();
            }
        } else if (activeSection === "automation") {
            if (!PortalAuth.isGlobalOwner() && !PortalAuth.isOrgAdmin()) {
                breadcrumbTitle = "Автоматизації";
                childHtml = `
                    <div class="portal-content">
                        <div class="portal-placeholder-box">
                            <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="shield-alert"></i></div>
                            <div class="portal-empty-title">Доступ обмежено</div>
                            <div class="portal-empty-desc">Модуль автоматизацій доступний виключно для керівництва.</div>
                        </div>
                    </div>
                `;
            } else {
                breadcrumbTitle = "Автоматизації";
                childHtml = renderGlobalAutomationView();
            }
        } else if (activeSection === "templates") {
            if (PortalAuth.isSpecialist() && !PortalAuth.isGlobalOwner() && !PortalAuth.isOrgAdmin()) {
                breadcrumbTitle = "Шаблони проєктів";
                childHtml = `
                    <div class="portal-content">
                        <div class="portal-placeholder-box">
                            <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="shield-alert"></i></div>
                            <div class="portal-empty-title">Доступ обмежено</div>
                            <div class="portal-empty-desc">Шаблони проєктів доступні виключно для керівництва та PM.</div>
                        </div>
                    </div>
                `;
            } else if (entityId) {
                breadcrumbTitle = "Редактор шаблону";
                childHtml = renderTemplateBuilderView(entityId);
            } else {
                breadcrumbTitle = "Шаблони проєктів";
                childHtml = renderTemplatesView();
            }
        } else if (activeSection === "integrations") {
            if (!PortalAuth.isGlobalOwner() && !PortalAuth.isOrgAdmin()) {
                breadcrumbTitle = "Інтеграції";
                childHtml = `
                    <div class="portal-content">
                        <div class="portal-placeholder-box">
                            <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="shield-alert"></i></div>
                            <div class="portal-empty-title">Доступ обмежено</div>
                            <div class="portal-empty-desc">Модуль інтеграцій доступний виключно для керівництва.</div>
                        </div>
                    </div>
                `;
            } else {
                breadcrumbTitle = "Інтеграції та Webhooks";
                childHtml = renderIntegrationsView();
            }
        } else {
            // Placeholder Sections for Future Phases
            const sectionTitles = {
                calendar: "Календар",
                settings: "Налаштування"
            };
            breadcrumbTitle = sectionTitles[activeSection] || "Розділ";
            childHtml = `
                <div class="portal-content">
                    <div class="portal-view-header">
                        <div class="portal-view-title-group">
                            <h1 class="portal-view-title">${breadcrumbTitle}</h1>
                            <p class="portal-view-subtitle">Модуль знаходиться в розробці</p>
                        </div>
                    </div>
                    <div class="portal-placeholder-box">
                        <div class="portal-empty-icon" style="color: var(--color-primary);"><i data-lucide="clock"></i></div>
                        <div class="portal-empty-title">Заплановано на наступні етапи</div>
                        <div class="portal-empty-desc">
                            Розділ <strong>${breadcrumbTitle}</strong> буде реалізовано у наступних оновленнях платформи.
                        </div>
                        <div style="display: flex; gap: 12px; margin-top: 12px;">
                            <a href="#/portal/dashboard" class="btn btn-primary">
                                <i data-lucide="layout-dashboard"></i> До Командного центру
                            </a>
                            <a href="#/portal/projects" class="btn btn-outline">
                                <i data-lucide="folder"></i> Перейти до Проєктів
                            </a>
                        </div>
                    </div>
                </div>
            `;
        }

        // 5. Mount Inside Shell
        root.innerHTML = renderPortalShell(activeSection, childHtml, breadcrumbTitle);
        initPortalShellEvents();

        // 6. Initialize Child View Events
        if (activeSection === "dashboard") {
            if (!PortalAuth.isSpecialist() || PortalAuth.isGlobalOwner() || PortalAuth.isOrgAdmin()) {
                await initPortalDashboardEvents();
            }
        } else if (activeSection === "notifications") {
            await initPortalNotificationsEvents();
        } else if (activeSection === "clients" && entityId) {
            await initClientDetailEvents(entityId);
        } else if (activeSection === "clients") {
            await initClientsViewEvents();
        } else if (activeSection === "projects" && entityId) {
            await initProjectDetailEvents(entityId);
        } else if (activeSection === "projects") {
            await initProjectsViewEvents();
        } else if (activeSection === "tasks") {
            await initTasksViewEvents();
        } else if (activeSection === "documents" && entityId) {
            await initDocumentDetailEvents(entityId);
        } else if (activeSection === "documents") {
            await initDocumentsViewEvents();
        } else if (activeSection === "meetings" && entityId) {
            await initMeetingDetailEvents(entityId);
        } else if (activeSection === "meetings") {
            await initMeetingsViewEvents();
        } else if (activeSection === "finance") {
            if (!PortalAuth.isSpecialist() || PortalAuth.isGlobalOwner() || PortalAuth.isOrgAdmin()) {
                await initFinanceEvents();
            }
        } else if (activeSection === "invoices" && entityId && parts[2] !== "print") {
            if (!PortalAuth.isSpecialist() || PortalAuth.isGlobalOwner() || PortalAuth.isOrgAdmin()) {
                await initInvoiceDetailEvents(entityId);
            }
        } else if (activeSection === "invoices") {
            if (!PortalAuth.isSpecialist() || PortalAuth.isGlobalOwner() || PortalAuth.isOrgAdmin()) {
                await initInvoiceRegistryEvents();
            }
        } else if (activeSection === "analytics") {
            if (!PortalAuth.isSpecialist() || PortalAuth.isGlobalOwner() || PortalAuth.isOrgAdmin()) {
                await initAnalyticsEvents();
            }
        } else if (activeSection === "reports") {
            if (!PortalAuth.isSpecialist() || PortalAuth.isGlobalOwner() || PortalAuth.isOrgAdmin()) {
                await initReportsEvents();
            }
        } else if (activeSection === "automation") {
            if (PortalAuth.isGlobalOwner() || PortalAuth.isOrgAdmin()) {
                await initGlobalAutomationEvents();
            }
        } else if (activeSection === "templates") {
            if (!PortalAuth.isSpecialist() || PortalAuth.isGlobalOwner() || PortalAuth.isOrgAdmin()) {
                if (entityId) {
                    await initTemplateBuilderEvents();
                } else {
                    await initTemplatesEvents();
                }
            }
        } else if (activeSection === "integrations") {
            if (PortalAuth.isGlobalOwner() || PortalAuth.isOrgAdmin()) {
                await initIntegrationsViewEvents();
            }
        }
    } catch (err) {
        console.error("[PortalPage] Render error:", err);
        root.innerHTML = `
            <div class="portal-wrapper" style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg-dark);">
                <div class="portal-empty-state" style="max-width: 480px; padding: 40px 24px; text-align: center;">
                    <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="alert-triangle"></i></div>
                    <div class="portal-empty-title" style="font-size: 1.3rem; margin-bottom: 8px;">Помилка завантаження порталу</div>
                    <div class="portal-empty-desc" style="margin-bottom: 20px; color: var(--text-secondary);">
                        ${err?.message || "Виникла непередбачена помилка під час ініціалізації робочого простору."}
                    </div>
                    <div style="display: flex; gap: 12px; justify-content: center;">
                        <button class="btn btn-primary" onclick="window.location.reload()">
                            <i data-lucide="refresh-cw"></i> Оновити сторінку
                        </button>
                        <a href="#/portal/clients" class="btn btn-outline" onclick="window.location.hash='#/portal/clients'; window.location.reload();">
                            <i data-lucide="home"></i> На головну порталу
                        </a>
                    </div>
                </div>
            </div>
        `;
    }

    if (window.lucide) window.lucide.createIcons();
}
