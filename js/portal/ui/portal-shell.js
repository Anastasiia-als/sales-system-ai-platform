/* js/portal/ui/portal-shell.js - SaaS Portal Desktop-First Shell Layout */

import { PortalAuth } from "../auth/auth-service.js";
import { DataClient } from "../api/data-client.js";

export function renderPortalShell(activeSection, childHtml, breadcrumbTitle = "") {
    const user = PortalAuth.getUser();
    const profile = PortalAuth.getProfile();
    const role = PortalAuth.getGlobalRole();

    const fullName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Користувач";
    const email = profile?.email || user?.email || "";
    const initials = (fullName.substring(0, 2) || "FW").toUpperCase();

    const canSeeFinance = PortalAuth.isGlobalOwner() || PortalAuth.isOrgAdmin();

    const navItems = [
        { id: "dashboard", label: "Дашборд", icon: "layout-dashboard", href: "#/portal/dashboard", isPlaceholder: false },
        { id: "notifications", label: "Сповіщення", icon: "bell", href: "#/portal/notifications", isPlaceholder: false },
        { id: "clients", label: "Клієнти", icon: "briefcase", href: "#/portal/clients", isPlaceholder: false },
        { id: "projects", label: "Проєкти", icon: "folder", href: "#/portal/projects", isPlaceholder: false },
        ...(canSeeFinance ? [
            { id: "finance", label: "Фінанси", icon: "dollar-sign", href: "#/portal/finance", isPlaceholder: false },
            { id: "invoices", label: "Рахунки", icon: "file-text", href: "#/portal/invoices", isPlaceholder: false }
        ] : []),
        { id: "tasks", label: "Мої задачі", icon: "check-square", href: "#/portal/tasks", isPlaceholder: false },
        { id: "calendar", label: "Календар", icon: "calendar", href: "#/portal/calendar", isPlaceholder: true },
        { id: "documents", label: "Документи", icon: "file-text", href: "#/portal/documents", isPlaceholder: false },
        { id: "meetings", label: "Зустрічі", icon: "video", href: "#/portal/meetings", isPlaceholder: false },
        { id: "settings", label: "Налаштування", icon: "settings", href: "#/portal/settings", isPlaceholder: true }
    ];

    const navHtml = navItems.map(item => {
        const isActive = activeSection === item.id;
        return `
            <a href="${item.href}" class="portal-nav-item ${isActive ? 'active' : ''}">
                <div class="portal-nav-item-left">
                    <i data-lucide="${item.icon}" style="width: 18px; height: 18px;"></i>
                    <span>${item.label}</span>
                </div>
                ${item.isPlaceholder ? `<span class="portal-nav-badge portal-nav-badge-soon">Скоро</span>` : ""}
            </a>
        `;
    }).join("");

    return `
        <div class="portal-wrapper">
            <!-- Sidebar -->
            <aside class="portal-sidebar">
                <div class="portal-sidebar-brand">
                    <div class="portal-brand-logo">FW</div>
                    <div class="portal-brand-text">
                        <span class="portal-brand-title">FIRSTWIN</span>
                        <span class="portal-brand-subtitle">Delivery Platform</span>
                    </div>
                </div>

                <nav class="portal-nav">
                    <div class="portal-nav-section-title">Основне меню</div>
                    ${navHtml}
                </nav>

                <div class="portal-sidebar-footer">
                    <a href="#/admin" style="font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="arrow-left" style="width: 14px; height: 14px;"></i> До FIRSTWIN CRM
                    </a>
                </div>
            </aside>

            <!-- Main Workspace -->
            <div class="portal-main">
                <!-- Top Header -->
                <header class="portal-header">
                    <div class="portal-breadcrumbs">
                        <a href="#/portal"><i data-lucide="home" style="width: 14px; height: 14px; vertical-align: middle;"></i> Головна</a>
                        <i data-lucide="chevron-right" style="width: 12px; height: 12px;"></i>
                        <span class="portal-breadcrumbs-current">${breadcrumbTitle || capitalize(activeSection)}</span>
                    </div>

                    <div class="portal-header-actions" style="display: flex; align-items: center; gap: 16px;">
                        <!-- Notification Bell Dropdown -->
                        <div class="portal-bell-wrapper" style="position: relative;">
                            <button id="btn-portal-shell-bell" class="portal-bell-btn" title="Сповіщення" aria-label="Сповіщення">
                                <i data-lucide="bell" style="width: 18px; height: 18px;"></i>
                                <span id="portal-shell-bell-badge" class="portal-bell-badge" style="display: none;">0</span>
                            </button>

                            <!-- Bell Dropdown Menu -->
                            <div id="portal-bell-dropdown" class="portal-bell-dropdown" style="display: none;">
                                <div class="portal-bell-dropdown-header">
                                    <div style="font-weight: 600; font-size: 0.88rem; color: var(--text-primary);">Сповіщення</div>
                                    <button id="btn-bell-mark-all" class="portal-bell-quick-action" title="Позначити всі як прочитані">
                                        <i data-lucide="check-check" style="width: 13px; height: 13px;"></i> Всі прочитані
                                    </button>
                                </div>
                                <div id="portal-bell-items-list" class="portal-bell-items-list">
                                    <div class="portal-bell-empty">Завантаження...</div>
                                </div>
                                <div class="portal-bell-dropdown-footer">
                                    <a href="#/portal/notifications" id="link-bell-view-all" class="portal-bell-view-all">
                                        Переглянути всі сповіщення <i data-lucide="arrow-right" style="width: 13px; height: 13px;"></i>
                                    </a>
                                </div>
                            </div>
                        </div>

                        <!-- User Profile Zone -->
                        <div class="portal-user-zone">
                            <div class="portal-user-info">
                                <div class="portal-user-avatar">${initials}</div>
                                <div class="portal-user-details">
                                    <div class="portal-user-name">${escapeHtml(fullName)}</div>
                                    <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
                                        <span class="portal-badge portal-badge-role-${role}">${getRoleLabel(role)}</span>
                                        <span class="portal-user-email">${escapeHtml(email)}</span>
                                    </div>
                                </div>
                            </div>

                            <button id="btn-portal-logout" class="btn btn-sm btn-outline" style="padding: 6px 12px; font-size: 0.8rem;" title="Вийти з акаунта">
                                <i data-lucide="log-out" style="width: 14px; height: 14px;"></i> Вийти
                            </button>
                        </div>
                    </div>
                </header>

                <!-- Page Content Area -->
                <main id="portal-main-container">
                    ${childHtml}
                </main>
            </div>
        </div>
    `;
}

export async function initPortalShellEvents() {
    if (window.lucide) window.lucide.createIcons();

    // Logout
    document.getElementById("btn-portal-logout")?.addEventListener("click", async () => {
        await PortalAuth.signOut();
        window.location.hash = "#/portal";
    });

    // Bell Dropdown Toggle & Sync
    const bellBtn = document.getElementById("btn-portal-shell-bell");
    const dropdown = document.getElementById("portal-bell-dropdown");
    const badge = document.getElementById("portal-shell-bell-badge");
    const itemsList = document.getElementById("portal-bell-items-list");
    const btnMarkAll = document.getElementById("btn-bell-mark-all");

    async function refreshBellBadge() {
        try {
            const count = await DataClient.getUnreadNotificationsCount();
            if (badge) {
                if (count > 0) {
                    badge.textContent = count > 9 ? "9+" : String(count);
                    badge.style.display = "flex";
                } else {
                    badge.textContent = "0";
                    badge.style.display = "none";
                }
            }
        } catch (e) {
            console.warn("[PortalShell] Badge count error:", e);
        }
    }

    async function loadBellDropdownItems() {
        if (!itemsList) return;
        try {
            const { data, error } = await DataClient.getRecentNotifications(8);
            if (error) throw error;

            const items = data || [];
            if (items.length === 0) {
                itemsList.innerHTML = `
                    <div class="portal-bell-empty" style="padding: 24px 16px; text-align: center; color: var(--text-muted); font-size: 0.82rem;">
                        <i data-lucide="bell-off" style="width: 24px; height: 24px; margin: 0 auto 6px; display: block; opacity: 0.5;"></i>
                        Немає нових сповіщень
                    </div>
                `;
                if (window.lucide) window.lucide.createIcons();
                return;
            }

            itemsList.innerHTML = items.map(n => {
                const isUnread = !n.is_read;
                const iconName = n.event_type.includes("task") ? "check-square" :
                                 n.event_type.includes("meeting") ? "video" :
                                 n.event_type.includes("document") ? "file-text" :
                                 n.event_type.includes("project") ? "folder" :
                                 n.severity === "critical" ? "alert-triangle" : "bell";

                const iconColor = n.severity === "critical" ? "var(--color-danger)" :
                                 n.severity === "warning" ? "var(--color-warning)" :
                                 n.severity === "success" ? "var(--color-success)" : "var(--color-primary)";

                const relTime = DataClient.formatRelativeTime(n.created_at);

                return `
                    <div class="portal-bell-item ${isUnread ? 'portal-bell-unread' : ''}" data-id="${n.id}" data-link="${n.deep_link || '#'}">
                        <div style="display: flex; gap: 10px; align-items: flex-start;">
                            <div class="portal-bell-item-icon" style="color: ${iconColor};">
                                <i data-lucide="${iconName}" style="width: 15px; height: 15px;"></i>
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px;">
                                    <span class="portal-bell-item-title">${escapeHtml(n.title)}</span>
                                    ${isUnread ? `<span class="portal-unread-dot-sm"></span>` : ''}
                                </div>
                                <div class="portal-bell-item-msg">${escapeHtml(n.message)}</div>
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                                    <span class="portal-bell-item-meta">${escapeHtml(n.project?.name || n.organization?.name || '')}</span>
                                    <span class="portal-bell-item-time">${relTime}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join("");

            if (window.lucide) window.lucide.createIcons();

            // Item clicks
            itemsList.querySelectorAll(".portal-bell-item").forEach(el => {
                el.addEventListener("click", async () => {
                    const id = el.dataset.id;
                    const link = el.dataset.link;
                    await DataClient.markNotificationAsRead(id);
                    await refreshBellBadge();
                    if (dropdown) dropdown.style.display = "none";
                    if (link && link !== "#") {
                        window.location.hash = link;
                    }
                });
            });
        } catch (err) {
            console.error("[PortalShell] loadBellDropdownItems error:", err);
            itemsList.innerHTML = `<div class="portal-bell-empty">Помилка завантаження</div>`;
        }
    }

    if (bellBtn && dropdown) {
        bellBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const isVisible = dropdown.style.display === "block";
            if (!isVisible) {
                dropdown.style.display = "block";
                await loadBellDropdownItems();
            } else {
                dropdown.style.display = "none";
            }
        });

        document.addEventListener("click", (e) => {
            if (dropdown && dropdown.style.display === "block" && !dropdown.contains(e.target) && !bellBtn.contains(e.target)) {
                dropdown.style.display = "none";
            }
        });
    }

    if (btnMarkAll) {
        btnMarkAll.addEventListener("click", async (e) => {
            e.stopPropagation();
            await DataClient.markAllNotificationsAsRead();
            await refreshBellBadge();
            await loadBellDropdownItems();
        });
    }

    document.getElementById("link-bell-view-all")?.addEventListener("click", () => {
        if (dropdown) dropdown.style.display = "none";
    });

    // Initial Badge Refresh
    await refreshBellBadge();
}

function getRoleLabel(role) {
    switch (role) {
        case "owner": return "Власник";
        case "pm": return "Менеджер проєкту";
        case "specialist": return "Спеціаліст";
        case "client": return "Клієнт";
        default: return role || "Користувач";
    }
}

function capitalize(str) {
    if (!str) return "";
    if (str === "clients") return "Клієнти";
    if (str === "projects") return "Проєкти";
    if (str === "tasks") return "Мої задачі";
    if (str === "dashboard") return "Дашборд";
    return str.charAt(0).toUpperCase() + str.slice(1);
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
