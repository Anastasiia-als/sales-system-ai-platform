/* js/pages/client-page.js - Client Portal Page Controller */

import { PortalAuth } from "../portal/auth/auth-service.js";
import { DataClient } from "../portal/api/data-client.js";
import { renderClientShell, initClientShellEvents } from "../client/ui/client-shell.js";
import { renderClientDashboardView, initClientDashboardEvents } from "../client/ui/client-dashboard-view.js";
import { renderClientProjectsView, initClientProjectsEvents } from "../client/ui/client-projects-view.js";
import { renderClientProjectDetailView, initClientProjectDetailEvents } from "../client/ui/client-project-detail-view.js";
import { renderClientActionsView, initClientActionsEvents } from "../client/ui/client-actions-view.js";
import { renderClientDocumentsView, initClientDocumentsEvents } from "../client/ui/client-documents-view.js";
import { renderClientDocumentDetailView, initClientDocumentDetailEvents } from "../client/ui/client-document-detail-view.js";
import { renderClientMeetingsView, initClientMeetingsEvents } from "../client/ui/client-meetings-view.js";
import { renderClientMeetingDetailView, initClientMeetingDetailEvents } from "../client/ui/client-meeting-detail-view.js";
import { renderClientBillingView, initClientBillingEvents } from "../client/ui/client-billing-view.js";
import { renderClientInvoiceDetailView, initClientInvoiceDetailEvents } from "../client/ui/client-invoice-detail-view.js";
import { renderClientLoginView, initClientLoginEvents, renderClientActivateView, initClientActivateEvents } from "../client/ui/client-auth-view.js";

let selectedOrgIdState = null;
let actionsFilterState = { view: "active", projectId: "all", search: "" };
let docsFilterState = { category: "all", projectId: "all", status: "all", search: "" };
let meetsFilterState = { view: "upcoming", projectId: "all", search: "" };

export const ClientPage = {
    render() {
        return `
            <div id="client-root">
                <div class="portal-loading-container" style="min-height: 80vh;">
                    <div class="portal-spinner"></div>
                    <span style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 12px;">Завантаження Client Workspace...</span>
                </div>
            </div>
        `;
    },

    async init() {
        const root = document.getElementById("client-root");
        if (!root) return;

        try {
            await PortalAuth.init();
            await this.handleClientRouting();
        } catch (err) {
            console.error("[ClientPage] Init error:", err);
            root.innerHTML = `
                <div class="portal-empty-state" style="padding: 60px 20px;">
                    <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="alert-circle"></i></div>
                    <div class="portal-empty-title">Помилка завантаження</div>
                    <div class="portal-empty-desc">${err.message || "Не вдалося ініціалізувати кабінет клієнта."}</div>
                    <a href="#/client/login" class="btn btn-outline" style="margin-top: 16px;">
                        <i data-lucide="refresh-cw"></i> Спробувати знову
                    </a>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
        }
    },

    async handleClientRouting() {
        const root = document.getElementById("client-root");
        if (!root) return;

        const hash = window.location.hash.slice(1) || "/client";
        const isAuthenticated = PortalAuth.isAuthenticated();

        // 1. Route: /client/login
        if (hash === "/client/login") {
            if (isAuthenticated && PortalAuth.isClientUser()) {
                window.location.hash = "#/client/dashboard";
                return;
            }
            root.innerHTML = renderClientLoginView();
            initClientLoginEvents(async () => {
                window.location.hash = "#/client/dashboard";
            });
            return;
        }

        // 2. Route: /client/activate
        if (hash === "/client/activate") {
            if (!isAuthenticated) {
                setTimeout(async () => {
                    if (!PortalAuth.isAuthenticated()) {
                        root.innerHTML = renderClientLoginView();
                        initClientLoginEvents(async () => {
                            window.location.hash = "#/client/dashboard";
                        });
                    } else {
                        root.innerHTML = renderClientActivateView();
                        initClientActivateEvents(async () => {
                            window.location.hash = "#/client/dashboard";
                        });
                    }
                }, 500);
                return;
            }
            root.innerHTML = renderClientActivateView();
            initClientActivateEvents(async () => {
                window.location.hash = "#/client/dashboard";
            });
            return;
        }

        // 3. Protected Client Routes
        if (!isAuthenticated) {
            window.location.hash = "#/client/login";
            return;
        }

        // Load client organizations
        const { data: orgs, error: orgsErr } = await DataClient.getClientOrganizations();
        const clientOrgs = orgs || [];

        // Check if access is revoked
        const clientAccessRecords = PortalAuth.getClientAccess();
        const hasRevokedOnly = clientAccessRecords.length > 0 && clientAccessRecords.every(a => a.status === "revoked");

        if (hasRevokedOnly) {
            root.innerHTML = `
                <div class="client-auth-wrapper">
                    <div class="client-auth-card" style="text-align: center;">
                        <div class="portal-empty-icon" style="color: var(--color-danger); margin-bottom: 16px;"><i data-lucide="shield-alert"></i></div>
                        <h2 class="client-auth-title" style="color: var(--color-danger);">Доступ до кабінету відкликано</h2>
                        <p class="client-auth-desc">Доступ вашого облікового запису до проєктів організації було призупинено адміністратором.</p>
                        <div style="margin-top: 24px;">
                            <button id="btn-revoked-logout" class="btn btn-outline" style="width: 100%; justify-content: center;">
                                <i data-lucide="log-out"></i> Вийти з акаунту
                            </button>
                        </div>
                    </div>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            document.getElementById("btn-revoked-logout")?.addEventListener("click", async () => {
                await PortalAuth.signOut();
                window.location.hash = "#/client/login";
            });
            return;
        }

        if (clientOrgs.length === 0) {
            root.innerHTML = `
                <div class="client-auth-wrapper">
                    <div class="client-auth-card" style="text-align: center;">
                        <div class="portal-empty-icon" style="color: var(--color-warning); margin-bottom: 16px;"><i data-lucide="shield-off"></i></div>
                        <h2 class="client-auth-title">Немає доступних організацій</h2>
                        <p class="client-auth-desc">Ваш обліковий запис ще не прив'язаний до жодної організації або очікує активації адміністратором.</p>
                        <div style="margin-top: 24px;">
                            <button id="btn-no-org-logout" class="btn btn-outline" style="width: 100%; justify-content: center;">
                                <i data-lucide="log-out"></i> Вийти
                            </button>
                        </div>
                    </div>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            document.getElementById("btn-no-org-logout")?.addEventListener("click", async () => {
                await PortalAuth.signOut();
                window.location.hash = "#/client/login";
            });
            return;
        }

        // Determine active organization
        let activeOrg = clientOrgs.find(o => o.id === selectedOrgIdState);
        if (!activeOrg) {
            activeOrg = clientOrgs[0];
            selectedOrgIdState = activeOrg.id;
        }

        // Parse Subroutes
        // A. Route: /client/projects/:id
        const projectDetailMatch = hash.match(/^\/client\/projects\/([a-f0-9-]+)$/i);
        if (projectDetailMatch) {
            const projectId = projectDetailMatch[1];
            const { data: projectData, error: projErr } = await DataClient.getClientProjectDetail(projectId);

            if (projErr || !projectData) {
                root.innerHTML = renderClientShell(`
                    <div class="portal-empty-state" style="padding: 60px 20px;">
                        <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="alert-circle"></i></div>
                        <div class="portal-empty-title">Проєкт не знайдено або доступ обмежено</div>
                        <div class="portal-empty-desc">${projErr ? projErr.message : "У вас немає доступу до цього проєкту або його було архівовано."}</div>
                        <a href="#/client/projects" class="btn btn-outline" style="margin-top: 16px;">
                            <i data-lucide="arrow-left"></i> До списку проєктів
                        </a>
                    </div>
                `, activeOrg, clientOrgs);
                initClientShellEvents((newOrgId) => {
                    selectedOrgIdState = newOrgId;
                    this.handleClientRouting();
                });
                return;
            }

            const contentHtml = renderClientProjectDetailView(projectData);
            root.innerHTML = renderClientShell(contentHtml, activeOrg, clientOrgs);
            initClientShellEvents((newOrgId) => {
                selectedOrgIdState = newOrgId;
                this.handleClientRouting();
            });
            initClientProjectDetailEvents(projectData, () => this.handleClientRouting());
            return;
        }

        // B. Route: /client/projects
        if (hash === "/client/projects") {
            const { data: projects, error: projErr } = await DataClient.getClientProjects(activeOrg.id);
            const contentHtml = renderClientProjectsView(projects || []);
            root.innerHTML = renderClientShell(contentHtml, activeOrg, clientOrgs);
            initClientShellEvents((newOrgId) => {
                selectedOrgIdState = newOrgId;
                this.handleClientRouting();
            });
            initClientProjectsEvents();
            return;
        }

        // C. Route: /client/actions
        if (hash === "/client/actions") {
            const [actionsRes, projectsRes] = await Promise.all([
                DataClient.getClientActions(activeOrg.id, actionsFilterState),
                DataClient.getClientProjects(activeOrg.id)
            ]);

            const actions = actionsRes.data || [];
            const projects = projectsRes.data || [];

            const contentHtml = renderClientActionsView(actions, projects, actionsFilterState);
            root.innerHTML = renderClientShell(contentHtml, activeOrg, clientOrgs);
            initClientShellEvents((newOrgId) => {
                selectedOrgIdState = newOrgId;
                this.handleClientRouting();
            });

            window._clientActionsRefresh = () => this.handleClientRouting();

            initClientActionsEvents(
                actions, 
                projects, 
                (newFilters) => {
                    actionsFilterState = { ...actionsFilterState, ...newFilters };
                    this.handleClientRouting();
                },
                () => this.handleClientRouting()
            );
            return;
        }

        // D. Route: /client/documents/:id
        const docDetailMatch = hash.match(/^\/client\/documents\/([a-f0-9-]+)$/i);
        if (docDetailMatch) {
            const documentId = docDetailMatch[1];
            const { data: docData, error: docErr } = await DataClient.getClientDocumentDetail(documentId);

            if (docErr || !docData) {
                root.innerHTML = renderClientShell(`
                    <div class="portal-empty-state" style="padding: 60px 20px;">
                        <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="alert-circle"></i></div>
                        <div class="portal-empty-title">Документ не знайдено або доступ обмежено</div>
                        <div class="portal-empty-desc">${docErr ? docErr.message : "У вас немає доступу до цього документа."}</div>
                        <a href="#/client/documents" class="btn btn-outline" style="margin-top: 16px;">
                            <i data-lucide="arrow-left"></i> До списку документів
                        </a>
                    </div>
                `, activeOrg, clientOrgs);
                initClientShellEvents((newOrgId) => {
                    selectedOrgIdState = newOrgId;
                    this.handleClientRouting();
                });
                return;
            }

            const contentHtml = renderClientDocumentDetailView(docData);
            root.innerHTML = renderClientShell(contentHtml, activeOrg, clientOrgs);
            initClientShellEvents((newOrgId) => {
                selectedOrgIdState = newOrgId;
                this.handleClientRouting();
            });
            initClientDocumentDetailEvents(docData, () => this.handleClientRouting());
            return;
        }

        // E. Route: /client/documents
        if (hash === "/client/documents") {
            const [docsRes, projectsRes] = await Promise.all([
                DataClient.getClientDocuments(activeOrg.id, docsFilterState),
                DataClient.getClientProjects(activeOrg.id)
            ]);

            const docs = docsRes.data || [];
            const projects = projectsRes.data || [];

            const contentHtml = renderClientDocumentsView(docs, projects, docsFilterState);
            root.innerHTML = renderClientShell(contentHtml, activeOrg, clientOrgs);
            initClientShellEvents((newOrgId) => {
                selectedOrgIdState = newOrgId;
                this.handleClientRouting();
            });
            initClientDocumentsEvents(
                docs, 
                projects, 
                (newFilters) => {
                    docsFilterState = { ...docsFilterState, ...newFilters };
                    this.handleClientRouting();
                }
            );
            return;
        }

        // F. Route: /client/meetings/:id
        const meetDetailMatch = hash.match(/^\/client\/meetings\/([a-f0-9-]+)$/i);
        if (meetDetailMatch) {
            const meetingId = meetDetailMatch[1];
            const { data: meetingData, error: meetErr } = await DataClient.getClientMeetingDetail(meetingId);

            if (meetErr || !meetingData) {
                root.innerHTML = renderClientShell(`
                    <div class="portal-empty-state" style="padding: 60px 20px;">
                        <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="alert-circle"></i></div>
                        <div class="portal-empty-title">Зустріч не знайдено або доступ обмежено</div>
                        <div class="portal-empty-desc">${meetErr ? meetErr.message : "У вас немає доступу до цієї зустрічі."}</div>
                        <a href="#/client/meetings" class="btn btn-outline" style="margin-top: 16px;">
                            <i data-lucide="arrow-left"></i> До списку зустрічей
                        </a>
                    </div>
                `, activeOrg, clientOrgs);
                initClientShellEvents((newOrgId) => {
                    selectedOrgIdState = newOrgId;
                    this.handleClientRouting();
                });
                return;
            }

            const contentHtml = renderClientMeetingDetailView(meetingData);
            root.innerHTML = renderClientShell(contentHtml, activeOrg, clientOrgs);
            initClientShellEvents((newOrgId) => {
                selectedOrgIdState = newOrgId;
                this.handleClientRouting();
            });
            initClientMeetingDetailEvents();
            return;
        }

        // G. Route: /client/meetings
        if (hash === "/client/meetings") {
            const [meetsRes, projectsRes] = await Promise.all([
                DataClient.getClientMeetings(activeOrg.id, meetsFilterState),
                DataClient.getClientProjects(activeOrg.id)
            ]);

            const meets = meetsRes.data || [];
            const projects = projectsRes.data || [];

            const contentHtml = renderClientMeetingsView(meets, projects, meetsFilterState);
            root.innerHTML = renderClientShell(contentHtml, activeOrg, clientOrgs);
            initClientShellEvents((newOrgId) => {
                selectedOrgIdState = newOrgId;
                this.handleClientRouting();
            });
            initClientMeetingsEvents(
                meets, 
                projects, 
                meetsFilterState,
                (newFilters) => {
                    meetsFilterState = { ...meetsFilterState, ...newFilters };
                    this.handleClientRouting();
                }
            );
            return;
        }

        // G.1. Route: /client/billing/:id
        const billDetailMatch = hash.match(/^\/client\/billing\/([a-f0-9-]+)$/i);
        if (billDetailMatch) {
            const invoiceId = billDetailMatch[1];
            const contentHtml = renderClientInvoiceDetailView(invoiceId, activeOrg);
            root.innerHTML = renderClientShell(contentHtml, activeOrg, clientOrgs);
            initClientShellEvents((newOrgId) => {
                selectedOrgIdState = newOrgId;
                this.handleClientRouting();
            });
            await initClientInvoiceDetailEvents(invoiceId, activeOrg);
            return;
        }

        // G.2. Route: /client/billing
        if (hash === "/client/billing") {
            const contentHtml = renderClientBillingView(activeOrg);
            root.innerHTML = renderClientShell(contentHtml, activeOrg, clientOrgs);
            initClientShellEvents((newOrgId) => {
                selectedOrgIdState = newOrgId;
                this.handleClientRouting();
            });
            await initClientBillingEvents(activeOrg);
            return;
        }

        // H. Default: /client/dashboard or /client
        const [{ data: dashboardData, error: dashErr }, clientInvoices] = await Promise.all([
            DataClient.getClientDashboardData(activeOrg.id),
            DataClient.getInvoices({ organization_id: activeOrg.id, excludeDrafts: true })
        ]);

        if (dashboardData) {
            dashboardData.pendingInvoices = (clientInvoices || []).filter(inv => {
                const tot = Number(inv.total_minor || 0);
                const pd = Number(inv.paid_minor || 0);
                return (tot - pd > 0) && inv.status !== "cancelled";
            });
        }

        if (dashErr || !dashboardData) {
            root.innerHTML = renderClientShell(`
                <div class="portal-empty-state" style="padding: 60px 20px;">
                    <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="alert-circle"></i></div>
                    <div class="portal-empty-title">Помилка завантаження даних</div>
                    <div class="portal-empty-desc">${dashErr ? dashErr.message : "Не вдалося завантажити дані проєктів."}</div>
                    <button class="btn btn-outline" id="btn-retry-client-dash" style="margin-top: 16px;">
                        <i data-lucide="refresh-cw"></i> Оновити
                    </button>
                </div>
            `, activeOrg, clientOrgs);
            initClientShellEvents((newOrgId) => {
                selectedOrgIdState = newOrgId;
                this.handleClientRouting();
            });
            document.getElementById("btn-retry-client-dash")?.addEventListener("click", () => {
                this.handleClientRouting();
            });
            return;
        }

        const contentHtml = renderClientDashboardView(dashboardData);
        root.innerHTML = renderClientShell(contentHtml, activeOrg, clientOrgs);
        initClientShellEvents((newOrgId) => {
            selectedOrgIdState = newOrgId;
            this.handleClientRouting();
        });
        initClientDashboardEvents(dashboardData, async () => {
            await this.handleClientRouting();
        });
    }
};
