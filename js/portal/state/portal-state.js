/* js/portal/state/portal-state.js - Reactive State Manager for Client Portal */

import { PortalAuth } from "../auth/auth-service.js";
import { DataClient } from "../api/data-client.js";

class PortalStateStore {
    constructor() {
        this.organizations = [];
        this.currentOrganization = null;
        this.projects = [];
        this.activeProject = null;
        this.activeTab = "overview";
        this.isLoading = false;
        this.initialized = false;

        this.initAuthSync();
    }

    initAuthSync() {
        if (typeof window !== "undefined") {
            window.addEventListener("portal-auth-changed", async (event) => {
                const { user, profile } = event.detail;
                if (user) {
                    await this.loadInitialData();
                } else {
                    this.reset();
                }
                this.notify();
            });
        }
    }

    async init() {
        if (this.initialized) return;
        await PortalAuth.init();
        if (PortalAuth.isAuthenticated()) {
            await this.loadInitialData();
        }
        this.initialized = true;
        this.notify();
    }

    async loadInitialData() {
        this.isLoading = true;
        this.notify();

        try {
            // 1. Fetch available organizations for this user
            const orgsRes = await DataClient.getOrganizations();
            this.organizations = orgsRes.data || [];

            if (this.organizations.length > 0 && !this.currentOrganization) {
                this.currentOrganization = this.organizations[0];
            }

            // 2. Fetch projects for the active organization
            if (this.currentOrganization) {
                const projRes = await DataClient.getProjects({ organizationId: this.currentOrganization.id });
                this.projects = projRes.data || [];
                if (this.projects.length > 0 && !this.activeProject) {
                    this.activeProject = this.projects[0];
                }
            }
        } catch (err) {
            console.warn("[PortalState] Error loading initial data:", err);
        } finally {
            this.isLoading = false;
            this.notify();
        }
    }

    setCurrentOrganization(orgId) {
        const found = this.organizations.find(o => o.id === orgId);
        if (found) {
            this.currentOrganization = found;
            this.activeProject = null;
            this.loadInitialData();
        }
    }

    setActiveProject(projectId) {
        const found = this.projects.find(p => p.id === projectId);
        if (found) {
            this.activeProject = found;
            this.notify();
        }
    }

    setActiveTab(tabName) {
        this.activeTab = tabName;
        this.notify();
    }

    reset() {
        this.organizations = [];
        this.currentOrganization = null;
        this.projects = [];
        this.activeProject = null;
        this.activeTab = "overview";
        this.isLoading = false;
    }

    notify() {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("portal-state-updated", {
                detail: {
                    currentOrganization: this.currentOrganization,
                    activeProject: this.activeProject,
                    activeTab: this.activeTab,
                    isLoading: this.isLoading
                }
            }));
        }
    }
}

export const PortalState = new PortalStateStore();
