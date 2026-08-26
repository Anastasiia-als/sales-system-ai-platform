/* js/client/ui/client-shell.js - Client Workspace Shell Layout */

import { PortalAuth } from "../../portal/auth/auth-service.js";

export function renderClientShell(contentHtml = "", activeOrg = null, clientOrgs = []) {
    const profile = PortalAuth.getProfile();
    const userEmail = PortalAuth.getUserEmail() || "";
    const userName = profile?.full_name || userEmail.split("@")[0] || "Клієнт";
    const initials = userName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() || "C";

    const orgName = activeOrg?.name || "Ваша компанія";
    const hasMultipleOrgs = clientOrgs.length > 1;

    const hash = window.location.hash.slice(1) || "/client/dashboard";
    const isDashboard = hash === "/client" || hash === "/client/dashboard";
    const isProjects = hash.startsWith("/client/projects");
    const isActions = hash.startsWith("/client/actions");
    const isDocs = hash.startsWith("/client/documents");
    const isMeetings = hash.startsWith("/client/meetings");
    const isBilling = hash.startsWith("/client/billing");

    return `
        <div class="client-wrapper">
            <!-- Client Header -->
            <header class="client-header">
                <div class="client-header-container">
                    <div class="client-header-left">
                        <a href="#/client/dashboard" class="client-logo">
                            <span class="client-logo-accent">FIRSTWIN</span>
                            <span class="client-portal-tag">Кабінет клієнта</span>
                        </a>

                        <!-- Navigation Links -->
                        <nav class="client-nav" id="client-nav-menu">
                            <a href="#/client/dashboard" class="client-nav-link ${isDashboard ? 'active' : ''}">
                                <i data-lucide="layout-dashboard"></i>
                                <span>Головна</span>
                            </a>
                            <a href="#/client/projects" class="client-nav-link ${isProjects ? 'active' : ''}">
                                <i data-lucide="folder-kanban"></i>
                                <span>Проєкти</span>
                            </a>
                            <a href="#/client/actions" class="client-nav-link ${isActions ? 'active' : ''}">
                                <i data-lucide="check-square"></i>
                                <span>Очікуємо від вас</span>
                            </a>
                            <a href="#/client/billing" class="client-nav-link ${isBilling ? 'active' : ''}">
                                <i data-lucide="credit-card"></i>
                                <span>Оплати</span>
                            </a>
                            <a href="#/client/documents" class="client-nav-link ${isDocs ? 'active' : ''}">
                                <i data-lucide="file-text"></i>
                                <span>Документи</span>
                            </a>
                            <a href="#/client/meetings" class="client-nav-link ${isMeetings ? 'active' : ''}">
                                <i data-lucide="video"></i>
                                <span>Зустрічі</span>
                            </a>
                        </nav>
                    </div>

                    <div class="client-header-right">
                        ${!PortalAuth.isClientUser() || PortalAuth.isGlobalOwner() ? `
                            <a href="#/portal" class="btn btn-sm btn-primary" style="font-size: 0.8rem; padding: 6px 12px; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; border-radius: 6px; font-weight: 600;" title="Перейти до внутрішнього порталу FIRSTWIN">
                                <i data-lucide="layout-grid" style="width: 14px; height: 14px;"></i>
                                <span>Панель керування (Portal)</span>
                            </a>
                        ` : ''}

                        <!-- Organization Switcher / Display -->
                        <div class="client-org-badge">
                            <i data-lucide="building" style="width: 14px; height: 14px; color: var(--color-primary);"></i>
                            ${hasMultipleOrgs ? `
                                <select id="client-org-switcher" class="client-org-select">
                                    ${clientOrgs.map(o => `
                                        <option value="${o.id}" ${o.id === activeOrg?.id ? "selected" : ""}>
                                            ${escapeHtml(o.name)}
                                        </option>
                                    `).join("")}
                                </select>
                            ` : `
                                <span class="client-org-name">${escapeHtml(orgName)}</span>
                            `}
                        </div>

                        <!-- User Profile Dropdown -->
                        <div class="client-user-menu">
                            <div class="client-avatar" title="${escapeHtml(userName)} (${escapeHtml(userEmail)})">
                                ${initials}
                            </div>
                            <div class="client-user-info">
                                <span class="client-user-name">${escapeHtml(userName)}</span>
                                <span class="client-user-email">${escapeHtml(userEmail)}</span>
                            </div>
                            <button id="btn-client-logout" class="btn btn-sm btn-outline client-logout-btn" title="Вийти з кабінету">
                                <i data-lucide="log-out" style="width: 14px; height: 14px;"></i>
                                <span class="client-logout-text">Вийти</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <!-- Client Main Workspace Content -->
            <main class="client-main" id="client-main-content">
                ${contentHtml}
            </main>
        </div>
    `;
}

export function initClientShellEvents(onOrgChange) {
    if (window.lucide) window.lucide.createIcons();

    // Logout
    document.getElementById("btn-client-logout")?.addEventListener("click", async () => {
        if (confirm("Ви дійсно бажаєте вийти з Client Portal?")) {
            await PortalAuth.signOut();
            window.location.hash = "#/client/login";
        }
    });

    // Org Switcher
    document.getElementById("client-org-switcher")?.addEventListener("change", (e) => {
        const selectedOrgId = e.target.value;
        if (onOrgChange && selectedOrgId) {
            onOrgChange(selectedOrgId);
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
