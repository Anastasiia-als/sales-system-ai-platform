/* js/pages/admin.js - Premium SaaS Admin Dashboard */

import { State } from "../state.js";
import { Toast } from "../components/notifications.js";

let adminTab = "dashboard"; 
let isAuthenticated = sessionStorage.getItem("adminAuth") === "true";

// Filters & State
let leadsFilter = { search: "", status: "all", payment: "all" };
let currentRole = "super_admin"; 
let isDemoMode = false;

// Masking helpers
const M = {
    name: (n, id) => isDemoMode ? 'Demo Client ' + id.split('-')[1].substring(0,4) : (n || 'Анонім'),
    phone: (p) => {
        if (!p) return '—';
        if (isDemoMode || currentRole === 'viewer') return '+38 (0**) ***-**-**';
        return p;
    },
    email: (e) => {
        if (!e) return '—';
        if (isDemoMode || currentRole === 'viewer') return 'h***@domain.com';
        return e;
    },
    company: (c) => isDemoMode ? 'Demo Company LLC' : (c || '—'),
    note: (txt) => isDemoMode ? '[Приховано в Demo Mode]' : txt
};

// Badges logic
const B = {
    payment: (status) => {
        switch(status) {
            case 'paid': return '<span class="badge badge-green">Оплачено</span>';
            case 'pending': return '<span class="badge badge-orange">Pending</span>';
            case 'error': return '<span class="badge badge-red">Помилка</span>';
            case 'refund': return '<span class="badge badge-purple">Повернення</span>';
            case 'awaiting': return '<span class="badge badge-yellow">Очікує оплату</span>';
            default: return '<span class="badge badge-gray">Не обрано</span>';
        }
    },
    crm: (status) => {
        switch(status) {
            case 'new': return '<span class="badge badge-blue">Новий лід</span>';
            case 'pending': return '<span class="badge badge-yellow">В роботі</span>';
            case 'paid': return '<span class="badge badge-green">Оплачено</span>';
            case 'decision': return '<span class="badge badge-orange">Очікує рішення</span>';
            case 'success': return '<span class="badge badge-emerald">Закрито успішно</span>';
            case 'rejected': return '<span class="badge badge-red">Закрито неуспішно</span>';
            default: return '<span class="badge badge-gray">' + status + '</span>';
        }
    },
    meeting: (status) => {
        switch(status) {
            case 'confirmed': return '<span class="badge badge-green">Підтверджено</span>';
            case 'pending': return '<span class="badge badge-yellow">Очікує</span>';
            case 'rescheduled': return '<span class="badge badge-purple">Перенесено</span>';
            case 'canceled': return '<span class="badge badge-red">Скасовано</span>';
            case 'done': return '<span class="badge badge-blue">Проведено</span>';
            case 'noshow': return '<span class="badge badge-orange">No-show</span>';
            default: return '<span class="badge badge-gray">' + status + '</span>';
        }
    },
    task: (status) => {
        switch(status) {
            case 'new': return '<span class="badge badge-blue">Нова</span>';
            case 'pending': return '<span class="badge badge-yellow">В роботі</span>';
            case 'done': return '<span class="badge badge-green">Виконано</span>';
            case 'overdue': return '<span class="badge badge-red">Прострочено</span>';
            default: return '<span class="badge badge-gray">Невідомо</span>';
        }
    }
};

const DEFAULT_TASKS = [
    { id: 't-1', title: 'Передзвонити клієнту', leadId: 'lead-1', assignee: 'Sales Manager', deadline: 'Сьогодні', priority: 'high', status: 'new' },
    { id: 't-2', title: 'Надіслати пропозицію', leadId: 'lead-2', assignee: 'Sales Manager', deadline: 'Завтра', priority: 'medium', status: 'pending' },
    { id: 't-3', title: 'Перевірити оплату', leadId: 'lead-3', assignee: 'Admin', deadline: 'Вчора', priority: 'high', status: 'overdue' }
];

export const Admin = {
    render() {
        if (!isAuthenticated) return this.renderLogin();

        return `
            <style>
                .main-header, .main-footer, .top-notice-bar, .mobile-sticky-bar, #chat-widget-container { display: none !important; }
                body { background: #05080F; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; color: #F8FAFC; overflow-x: hidden; }
                #app-content { padding: 0 !important; max-width: 100% !important; margin: 0 !important; min-height: 100vh; }
                
                :root {
                    --admin-bg: #05080F; --admin-sidebar: #0A0F1C; --admin-card: #111827; --admin-border: rgba(255,255,255,0.08);
                    --admin-primary: #3B82F6; --admin-text: #F8FAFC; --admin-text-muted: #94A3B8; --admin-hover: rgba(255,255,255,0.05);
                }

                .saas-layout { display: flex; height: 100vh; overflow: hidden; background: var(--admin-bg); position: relative; }
                .saas-sidebar { width: 260px; background: var(--admin-sidebar); border-right: 1px solid var(--admin-border); display: flex; flex-direction: column; flex-shrink: 0; z-index: 1000; transition: transform 0.3s ease; }
                
                @media (max-width: 768px) {
                    .saas-sidebar { position: fixed; height: 100vh; transform: translateX(-100%); }
                    .saas-sidebar.open { transform: translateX(0); }
                }

                .saas-sidebar-header { padding: 20px 24px; border-bottom: 1px solid var(--admin-border); display: flex; align-items: center; justify-content: space-between; gap: 12px; }
                .saas-nav { padding: 20px 12px; overflow-y: auto; flex-grow: 1; display: flex; flex-direction: column; gap: 4px; }
                .saas-nav-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 8px; color: var(--admin-text-muted); font-weight: 500; font-size: 0.95rem; cursor: pointer; background: transparent; border: none; width: 100%; text-align: left; }
                .saas-nav-item:hover { background: var(--admin-hover); color: white; }
                .saas-nav-item.active { background: rgba(59, 130, 246, 0.1); color: var(--admin-primary); }
                .saas-nav-group { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.3); margin: 16px 0 8px 16px; font-weight: 600; }
                
                .saas-main { flex-grow: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; }
                .saas-topbar { height: 70px; background: var(--admin-sidebar); border-bottom: 1px solid var(--admin-border); display: flex; align-items: center; justify-content: space-between; padding: 0 24px; flex-shrink: 0; z-index:40; }
                .topbar-btn { background: var(--admin-hover); border: 1px solid var(--admin-border); color: white; padding: 8px 16px; border-radius: 8px; font-size: 0.9rem; cursor: pointer; display:flex; align-items:center; gap:8px; white-space:nowrap; }
                .topbar-btn.primary { background: var(--admin-primary); border-color: var(--admin-primary); }
                .burger-btn { background:transparent; border:none; color:white; cursor:pointer; display:none; }
                
                @media (max-width: 768px) {
                    .burger-btn { display:block; }
                    .desktop-only { display:none !important; }
                    .saas-topbar { padding: 0 16px; }
                }

                .saas-content-view { flex-grow: 1; padding: 32px; overflow-y: auto; }
                @media (max-width: 768px) { .saas-content-view { padding: 16px; } }

                .admin-card { background: var(--admin-card); border: 1px solid var(--admin-border); border-radius: 12px; margin-bottom:24px; overflow:hidden; }
                .admin-card-header { padding: 20px 24px; border-bottom: 1px solid var(--admin-border); font-weight:600; color:white; display:flex; justify-content:space-between; }
                
                .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
                .kpi-card { background: var(--admin-card); border: 1px solid var(--admin-border); border-radius: 12px; padding: 20px; }
                .kpi-value { font-size: 1.8rem; font-weight: 700; margin: 12px 0 6px 0; color:white; }
                
                .admin-table-container { overflow-x: auto; max-height: calc(100vh - 250px); overflow-y: auto; }
                .admin-table { width: 100%; border-collapse: separate; border-spacing:0; text-align:left; min-width:800px; }
                .admin-table th { padding: 16px 24px; font-size: 0.8rem; text-transform: uppercase; color: var(--admin-text-muted); border-bottom: 1px solid var(--admin-border); background: #0A0F1C; position: sticky; top: 0; z-index: 10; font-weight:600; letter-spacing:0.5px; }
                .admin-table td { padding: 16px 24px; border-bottom: 1px solid var(--admin-border); font-size: 0.9rem; background: var(--admin-card); transition:background 0.2s; }
                .admin-table tr:hover td { background: rgba(255,255,255,0.03); }
                .text-truncate { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; color:var(--admin-text-muted); font-size:0.8rem; line-height:1.4; max-width:250px; }
                
                .badge { display:inline-flex; align-items:center; padding:4px 10px; border-radius:20px; font-size:0.75rem; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; white-space:nowrap; }
                .badge-gray { background:rgba(255,255,255,0.1); color:#94A3B8; border:1px solid rgba(255,255,255,0.2); }
                .badge-blue { background:rgba(59,130,246,0.15); color:#60A5FA; border:1px solid rgba(59,130,246,0.3); }
                .badge-yellow { background:rgba(234,179,8,0.15); color:#FACC15; border:1px solid rgba(234,179,8,0.3); }
                .badge-orange { background:rgba(249,115,22,0.15); color:#FB923C; border:1px solid rgba(249,115,22,0.3); }
                .badge-green { background:rgba(16,185,129,0.15); color:#34D399; border:1px solid rgba(16,185,129,0.3); }
                .badge-emerald { background:rgba(5,150,105,0.15); color:#10B981; border:1px solid rgba(5,150,105,0.3); }
                .badge-red { background:rgba(239,68,68,0.15); color:#F87171; border:1px solid rgba(239,68,68,0.3); }
                .badge-purple { background:rgba(168,85,247,0.15); color:#C084FC; border:1px solid rgba(168,85,247,0.3); }

                .quick-actions { display:flex; gap:8px; opacity:0.3; transition:0.2s; }
                .admin-table tr:hover .quick-actions { opacity:1; }
                .quick-btn { background:rgba(255,255,255,0.05); border:1px solid var(--admin-border); color:white; width:28px; height:28px; border-radius:6px; display:flex; align-items:center; justify-content:center; cursor:pointer; }
                .quick-btn:hover { background:var(--admin-primary); border-color:var(--admin-primary); }

                .empty-state { text-align:center; padding:60px 20px; color:var(--admin-text-muted); }
                .empty-state-icon { margin-bottom:16px; opacity:0.5; display:flex; justify-content:center; }
                .empty-state h3 { color:white; margin:0 0 8px 0; }

                .notif-bell-container { position:relative; cursor:pointer; }
                .notif-badge { position:absolute; top:-4px; right:-4px; background:#EF4444; color:white; font-size:0.6rem; font-weight:bold; width:16px; height:16px; border-radius:50%; display:flex; align-items:center; justify-content:center; }
                .notif-dropdown { display:none; position:absolute; top:40px; right:0; width:320px; background:var(--admin-card); border:1px solid var(--admin-border); border-radius:12px; box-shadow:0 10px 40px rgba(0,0,0,0.5); z-index:100; overflow:hidden; }
                .notif-dropdown.open { display:block; }
                .notif-header { padding:16px; border-bottom:1px solid var(--admin-border); font-weight:600; color:white; }
                .notif-item { padding:12px 16px; border-bottom:1px solid var(--admin-border); display:flex; gap:12px; align-items:flex-start; font-size:0.85rem; color:var(--admin-text-muted); cursor:pointer; }
                .notif-item:hover { background:rgba(255,255,255,0.02); }

                .kanban-board { display:flex; gap:16px; overflow-x:auto; padding-bottom:16px; height: calc(100vh - 200px); }
                .kanban-col { background:rgba(255,255,255,0.02); border:1px solid var(--admin-border); border-radius:12px; width:300px; flex-shrink:0; display:flex; flex-direction:column; }
                .kanban-col-header { padding:16px; border-bottom:1px solid var(--admin-border); font-weight:600; display:flex; justify-content:space-between; align-items:center; }
                .kanban-cards { padding:16px; overflow-y:auto; flex-grow:1; display:flex; flex-direction:column; gap:12px; }
                .kanban-card { background:var(--admin-card); border:1px solid var(--admin-border); border-radius:8px; padding:16px; cursor:grab; box-shadow:0 2px 4px rgba(0,0,0,0.1); }

                .side-panel { position:fixed; top:0; right:-100%; width:100%; max-width:600px; height:100vh; background:var(--admin-card); border-left:1px solid var(--admin-border); z-index:1001; transition:right 0.3s ease; display:flex; flex-direction:column; box-shadow:-10px 0 30px rgba(0,0,0,0.5); }
                .side-panel.open { right:0; }
                .side-panel-header { padding:24px; border-bottom:1px solid var(--admin-border); display:flex; justify-content:space-between; align-items:center; }
                .side-panel-content { flex-grow:1; padding:24px; overflow-y:auto; }
                .side-panel-overlay { display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:1000; backdrop-filter:blur(2px); }
                .side-panel-overlay.open { display:block; }
            </style>

            <div class="saas-layout">
                <aside class="saas-sidebar" id="saas-sidebar">
                    <div class="saas-sidebar-header">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <div style="width:32px; height:32px; background:#3B82F6; border-radius:8px; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold;">S</div>
                            <div style="font-weight:700; font-size:1.2rem; color:white;">Sales<span style="color:#3B82F6;">System</span></div>
                        </div>
                        <button class="burger-btn" id="close-sidebar-btn">&times;</button>
                    </div>
                    <nav class="saas-nav">
                        <div class="saas-nav-group">CRM</div>
                        <button class="saas-nav-item" data-tab="dashboard">Dashboard</button>
                        <button class="saas-nav-item" data-tab="leads">Ліди / Заявки</button>
                        <button class="saas-nav-item" data-tab="funnel">CRM-воронка</button>
                        <button class="saas-nav-item" data-tab="bookings">Бронювання</button>
                        <button class="saas-nav-item" data-tab="payments">Оплати</button>
                        <button class="saas-nav-item" data-tab="tasks">Задачі</button>
                        
                        <div class="saas-nav-group">Content Module</div>
                        <button class="saas-nav-item" data-tab="blog">Блог</button>
                        <button class="saas-nav-item" data-tab="cases">Кейси</button>
                        <button class="saas-nav-item" data-tab="services">Послуги</button>
                        
                        <div class="saas-nav-group">Management</div>
                        <button class="saas-nav-item" data-tab="integrations">Інтеграції</button>
                        <button class="saas-nav-item" data-tab="analytics">Аналітика</button>
                        <button class="saas-nav-item" data-tab="audit">Журнал дій</button>
                        <button class="saas-nav-item" data-tab="settings">Налаштування</button>
                    </nav>
                </aside>

                <div class="saas-main">
                    <header class="saas-topbar">
                        <div style="display:flex; align-items:center; gap:20px;">
                            <button class="burger-btn" id="open-sidebar-btn"><i data-lucide="menu"></i></button>
                            <label class="desktop-only" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                                <input type="checkbox" id="demo-mode-toggle" ` + (isDemoMode ? 'checked' : '') + `>
                                <span style="color:` + (isDemoMode ? '#EF4444' : 'white') + `; font-size:0.85rem; font-weight:bold;">Demo</span>
                            </label>
                            <select id="role-selector" style="background:var(--admin-bg); color:white; border:1px solid var(--admin-border); border-radius:4px; padding:4px 8px; font-size:0.85rem;">
                                <option value="super_admin" ` + (currentRole==='super_admin'?'selected':'') + `>👑 Super Admin</option>
                                <option value="sales" ` + (currentRole==='sales'?'selected':'') + `>📞 Sales</option>
                                <option value="content" ` + (currentRole==='content'?'selected':'') + `>📝 Content</option>
                                <option value="viewer" ` + (currentRole==='viewer'?'selected':'') + `>👁️ Viewer</option>
                            </select>
                        </div>
                        <div style="display:flex; align-items:center; gap:16px;">
                            <div class="notif-bell-container" id="notif-bell">
                                <i data-lucide="bell" style="color:var(--admin-text-muted); width:20px;"></i>
                                <div class="notif-badge">3</div>
                                <div class="notif-dropdown" id="notif-panel">
                                    <div class="notif-header">Останні події</div>
                                    <div class="notif-list">
                                        <div class="notif-item mock-action-btn" data-action="notif_lead"><i data-lucide="inbox" style="color:#60A5FA; width:16px;"></i> <div><b>Нова заявка:</b> Олена з сайту</div></div>
                                        <div class="notif-item mock-action-btn" data-action="notif_payment"><i data-lucide="dollar-sign" style="color:#34D399; width:16px;"></i> <div><b>Оплата 45,000 ₴:</b> ТОВ БудПостач.</div></div>
                                        <div class="notif-item mock-action-btn" data-action="notif_meeting"><i data-lucide="calendar" style="color:#FBBF24; width:16px;"></i> <div><b>Зустріч:</b> Через 1 год (Google Meet)</div></div>
                                    </div>
                                </div>
                            </div>
                            <button class="topbar-btn primary desktop-only" id="btn-add-lead" ` + (['viewer'].includes(currentRole)?'disabled':'') + `>+ Додати лід</button>
                        </div>
                    </header>
                    <main class="saas-content-view" id="admin-main-content"></main>
                </div>

                <div class="side-panel-overlay" id="panel-overlay"></div>
                <div class="side-panel" id="lead-side-panel"></div>
                
                ` + (isDemoMode ? '<div style="position:fixed; bottom:20px; right:20px; background:rgba(239,68,68,0.2); color:#EF4444; padding:8px 16px; border:1px solid #EF4444; border-radius:8px; font-weight:bold; z-index:9999; pointer-events:none; backdrop-filter:blur(4px);">DEMO DATA ENABLED</div>' : '') + `
            </div>
        `;
    },

    renderLogin() {
        return `
            <style>
                body { background: #0A0F1C; margin: 0; padding: 0; }
                .main-header, .main-footer { display:none !important; }
            </style>
            <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: #0A0F1C; padding:16px;">
                <div class="card" style="padding: 40px; width: 100%; max-width: 400px; text-align: center; border: 1px solid rgba(255,255,255,0.1); background: #111827; border-radius: 12px;">
                    <h2 style="color:white; margin-bottom: 24px;">Admin Access</h2>
                    <form id="admin-login-form">
                        <input type="password" id="admin-password" class="form-input" placeholder="Password" required style="width:100%; margin-bottom:16px; padding:12px; background:#05080F; color:white; border:1px solid rgba(255,255,255,0.1); border-radius:8px;">
                        <button type="submit" style="width: 100%; padding:12px; border-radius:8px; background:#3B82F6; color:white; border:none; cursor:pointer; font-weight:600;">Login</button>
                    </form>
                </div>
            </div>
        `;
    },

    init() {
        if (!isAuthenticated) {
            const loginForm = document.getElementById("admin-login-form");
            if (loginForm) {
                loginForm.addEventListener("submit", (e) => {
                    e.preventDefault();
                    if (document.getElementById("admin-password").value === "admin2026") {
                        sessionStorage.setItem("adminAuth", "true");
                        isAuthenticated = true;
                        this.refreshFullView();
                    } else Toast.error("Помилка", "Невірний пароль");
                });
            }
            return;
        }

        this.updateNavUI();
        this.renderCurrentTab();
        
        // Navigation binds
        document.querySelectorAll(".saas-nav-item[data-tab]").forEach(btn => {
            btn.addEventListener("click", () => {
                adminTab = btn.getAttribute("data-tab");
                this.updateNavUI();
                this.renderCurrentTab();
                document.getElementById("saas-sidebar").classList.remove("open");
            });
        });

        // Sidebar mobile
        document.getElementById("open-sidebar-btn")?.addEventListener("click", () => {
            document.getElementById("saas-sidebar").classList.add("open");
        });
        document.getElementById("close-sidebar-btn")?.addEventListener("click", () => {
            document.getElementById("saas-sidebar").classList.remove("open");
        });

        // Demo and Roles binds
        document.getElementById("demo-mode-toggle")?.addEventListener("change", (e) => {
            isDemoMode = e.target.checked; this.refreshFullView();
        });
        document.getElementById("role-selector")?.addEventListener("change", (e) => {
            currentRole = e.target.value; this.refreshFullView();
        });

        // Notifications
        document.getElementById("notif-bell")?.addEventListener("click", () => {
            document.getElementById("notif-panel").classList.toggle("open");
        });

        document.getElementById("panel-overlay")?.addEventListener("click", () => this.closePanel());
    },

    updateNavUI() {
        document.querySelectorAll(".saas-nav-item[data-tab]").forEach(btn => {
            if (btn.getAttribute("data-tab") === adminTab) btn.classList.add("active");
            else btn.classList.remove("active");
        });
    },

    refreshFullView() {
        const app = document.getElementById("app-content");
        if (app) { app.innerHTML = this.render(); this.init(); }
    },

    renderCurrentTab() {
        const container = document.getElementById("admin-main-content");
        if (!container) return;

        let html = "";
        switch (adminTab) {
            case 'dashboard': html = this.getDashboardHTML(); break;
            case 'leads': html = this.getLeadsHTML(); break;
            case 'funnel': html = this.getFunnelHTML(); break;
            case 'bookings': html = this.getBookingsHTML(); break;
            case 'payments': html = this.getPaymentsHTML(); break;
            case 'tasks': html = this.getTasksHTML(); break;
            case 'blog': html = this.getBlogHTML(); break;
            case 'cases': html = this.getCasesHTML(); break;
            case 'services': html = this.getServicesHTML(); break;
            case 'integrations': html = this.getIntegrationsHTML(); break;
            case 'analytics': html = this.getAnalyticsHTML(); break;
            case 'audit': html = this.getAuditHTML(); break;
            case 'settings': html = this.getSettingsHTML(); break;
            default: html = '<h1>' + adminTab + '</h1>';
        }

        container.innerHTML = html;
        this.bindTabEvents();
        if (window.lucide) window.lucide.createIcons();
    },

    // --- HTML GENERATORS ---

    getEmptyState(title, desc, btnText, actionName) {
        return `
            <div class="admin-card empty-state">
                <div class="empty-state-icon"><i data-lucide="inbox" style="width:48px; height:48px;"></i></div>
                <h3>` + title + `</h3>
                <p>` + desc + `</p>
                ` + (btnText ? '<button class="topbar-btn primary mock-action-btn" data-action="' + actionName + '" style="margin:20px auto 0;">' + btnText + '</button>' : '') + `
            </div>
        `;
    },

    getDashboardHTML() {
        const leads = State.getLeads();
        const paid = leads.filter(l => l.status === 'paid' || l.paymentStatus === 'paid').length;
        const pending = leads.filter(l => l.status === 'pending').length;
        const newL = leads.filter(l => l.status === 'new').length;
        const revenue = leads.reduce((acc, l) => acc + (l.paymentStatus === 'paid' ? (l.paymentAmount || State.getServicePrice(l.service)) : 0), 0);

        return `
            <h1 style="color:white; margin:0 0 24px 0;">Dashboard</h1>
            <div class="kpi-grid">
                <div class="kpi-card"><div style="color:var(--admin-text-muted);">Всього лідів</div><div class="kpi-value">` + leads.length + `</div></div>
                <div class="kpi-card"><div style="color:var(--admin-text-muted);">Нові</div><div class="kpi-value" style="color:#60A5FA;">` + newL + `</div></div>
                <div class="kpi-card"><div style="color:var(--admin-text-muted);">В роботі</div><div class="kpi-value" style="color:#FBBF24;">` + pending + `</div></div>
                <div class="kpi-card"><div style="color:var(--admin-text-muted);">Оплачені</div><div class="kpi-value" style="color:#34D399;">` + paid + `</div></div>
                <div class="kpi-card"><div style="color:var(--admin-text-muted);">Дохід</div><div class="kpi-value">` + revenue.toLocaleString() + ` ₴</div></div>
            </div>
            <div class="admin-card">
                <div class="admin-card-header">Останні активності</div>
                <div style="padding:0;">
                    <div style="padding:16px 24px; border-bottom:1px solid var(--admin-border); display:flex; gap:16px; align-items:center;">
                        <div style="width:8px; height:8px; border-radius:50%; background:var(--admin-primary);"></div>
                        <div style="color:white; flex-grow:1;">Новий лід: Олена (Комплексний аудит)</div>
                        <div style="color:var(--admin-text-muted); font-size:0.8rem;">10 хв тому</div>
                    </div>
                    <div style="padding:16px 24px; border-bottom:1px solid var(--admin-border); display:flex; gap:16px; align-items:center;">
                        <div style="width:8px; height:8px; border-radius:50%; background:#34D399;"></div>
                        <div style="color:white; flex-grow:1;">Оплата: 45,000 ₴ від ТОВ БудПостач</div>
                        <div style="color:var(--admin-text-muted); font-size:0.8rem;">2 год тому</div>
                    </div>
                    <div style="padding:16px 24px; display:flex; gap:16px; align-items:center;">
                        <div style="width:8px; height:8px; border-radius:50%; background:#FBBF24;"></div>
                        <div style="color:white; flex-grow:1;">Зустріч змінено: Олександр (Аудит відділу продажів)</div>
                        <div style="color:var(--admin-text-muted); font-size:0.8rem;">Вчора</div>
                    </div>
                </div>
            </div>
        `;
    },

    getLeadsHTML() {
        let leads = State.getLeads();
        if (leadsFilter.search) {
            const q = leadsFilter.search.toLowerCase();
            leads = leads.filter(l => (l.name||'').toLowerCase().includes(q) || (l.phone||'').includes(q) || (l.email||'').toLowerCase().includes(q));
        }
        if (leadsFilter.status !== "all") leads = leads.filter(l => l.status === leadsFilter.status);
        if (leadsFilter.payment !== "all") leads = leads.filter(l => l.paymentStatus === leadsFilter.payment);

        let trs = leads.map(l => {
            const clientName = M.name(l.name, l.id);
            const avatar = clientName.charAt(0).toUpperCase();
            return `
                <tr class="lead-row" data-id="` + l.id + `" style="cursor:pointer;">
                    <td style="width:40px;"><input type="checkbox" class="row-check"></td>
                    <td>
                        <div style="display:flex; align-items:center; gap:12px;">
                            <div style="width:32px; height:32px; border-radius:50%; background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; font-weight:bold; color:white; flex-shrink:0;">` + avatar + `</div>
                            <div>
                                <div style="color:white; font-weight:500;">` + clientName + `</div>
                                <div style="color:var(--admin-text-muted); font-size:0.75rem;">` + M.company(l.company) + `</div>
                            </div>
                        </div>
                    </td>
                    <td><div style="color:white;">` + M.phone(l.phone) + `</div><div style="color:var(--admin-text-muted); font-size:0.75rem;">` + M.email(l.email) + `</div></td>
                    <td><span style="color:var(--admin-primary); font-weight:500; font-size:0.85rem;">` + State.getServiceName(l.service) + `</span></td>
                    <td><div class="text-truncate">` + M.note(l.problem || 'Деталей немає') + `</div></td>
                    <td>` + B.crm(l.status) + `</td>
                    <td>` + B.payment(l.paymentStatus || 'awaiting') + `</td>
                    <td>
                        <div class="quick-actions">
                            <div class="quick-btn mock-action-btn" data-action="open_telegram" title="Написати в Telegram"><i data-lucide="send" style="width:14px;"></i></div>
                            <div class="quick-btn mock-action-btn" data-action="create_invoice" title="Створити Invoice"><i data-lucide="file-text" style="width:14px;"></i></div>
                            <div class="quick-btn open-details-btn" title="Відкрити деталі"><i data-lucide="maximize-2" style="width:14px;"></i></div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        const emptyHTML = this.getEmptyState('Заявок ще немає', 'Немає результатів за цими фільтрами.', 'Додати лід', 'add_lead');

        return `
            <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:24px;">
                <div><h1 style="color:white; margin:0 0 8px 0;">Ліди / Заявки</h1></div>
                <div style="display:flex; gap:12px;"><button class="topbar-btn mock-btn" ` + (isDemoMode?'disabled':'') + `>Експорт CSV</button></div>
            </div>
            <div class="admin-card" style="padding:16px 24px; display:flex; gap:16px; flex-wrap:wrap; align-items:center;">
                <input type="text" id="filter-search" placeholder="Пошук..." value="` + leadsFilter.search + `" style="background:var(--admin-bg); border:1px solid var(--admin-border); color:white; padding:8px 12px; border-radius:6px; flex-grow:1; min-width:200px;">
                <select id="filter-status" style="background:var(--admin-bg); border:1px solid var(--admin-border); color:white; padding:8px 12px; border-radius:6px;">
                    <option value="all" ` + (leadsFilter.status==='all'?'selected':'') + `>Всі статуси</option>
                    <option value="new" ` + (leadsFilter.status==='new'?'selected':'') + `>Новий</option>
                    <option value="pending" ` + (leadsFilter.status==='pending'?'selected':'') + `>В роботі</option>
                    <option value="paid" ` + (leadsFilter.status==='paid'?'selected':'') + `>Оплачено</option>
                </select>
                <button class="topbar-btn" id="btn-reset-filters">Скинути</button>
            </div>
            <div class="admin-card admin-table-container">
                <table class="admin-table">
                    <thead><tr><th style="width:40px;"><input type="checkbox"></th><th>Клієнт / Компанія</th><th>Контакти</th><th>Послуга</th><th>Проблема</th><th>CRM Статус</th><th>Оплата</th><th>Дії</th></tr></thead>
                    <tbody>` + (trs.length > 0 ? trs : '<tr><td colspan="8">' + emptyHTML + '</td></tr>') + `</tbody>
                </table>
            </div>
        `;
    },

    getFunnelHTML() {
        const columns = [ { id: 'new', title: 'Нові', leads: [] }, { id: 'pending', title: 'В роботі', leads: [] }, { id: 'paid', title: 'Оплачено', leads: [] } ];
        State.getLeads().forEach(l => { const col = columns.find(c => c.id === l.status) || columns[0]; col.leads.push(l); });
        let colsHtml = columns.map(c => `
            <div class="kanban-col">
                <div class="kanban-col-header"><span style="color:white;">` + c.title + `</span><span class="badge badge-gray">` + c.leads.length + `</span></div>
                <div class="kanban-cards">
                    ` + c.leads.map(l => `
                        <div class="kanban-card lead-row" data-id="` + l.id + `">
                            <div style="font-weight:600; color:white; margin-bottom:4px;">` + M.name(l.name, l.id) + `</div>
                            <div style="font-size:0.8rem; color:var(--admin-text-muted); margin-bottom:8px;">` + State.getServiceName(l.service) + `</div>
                            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem;">` + B.payment(l.paymentStatus) + ` <span style="color:var(--admin-text-muted);">` + new Date(l.date).toLocaleDateString() + `</span></div>
                        </div>
                    `).join('') + `
                </div>
            </div>
        `).join('');
        return `<h1 style="color:white; margin:0 0 24px 0;">CRM Воронка</h1><div class="kanban-board">` + colsHtml + `</div>`;
    },

    getBookingsHTML() {
        const bookings = State.getBookings();
        const leads = State.getLeads();
        let trs = bookings.map(b => {
            const l = leads.find(x => x.id === b.leadId) || {};
            return `
                <tr>
                    <td><div style="font-weight:600; color:white;">` + M.name(l.name, l.id || 'x-1') + `</div></td>
                    <td><div style="color:var(--admin-primary);">` + (b.serviceName || State.getServiceName(l.service)) + `</div></td>
                    <td><div style="color:white;">` + new Date(b.dateTime).toLocaleString('uk-UA') + `</div></td>
                    <td>` + B.meeting(b.status) + `</td>
                    <td><div class="quick-actions"><div class="quick-btn mock-action-btn" data-action="generate_link" title="Згенерувати лінк"><i data-lucide="link" style="width:14px;"></i></div><div class="quick-btn mock-action-btn" data-action="send_reminder" title="Надіслати нагадування"><i data-lucide="bell" style="width:14px;"></i></div></div></td>
                </tr>
            `;
        }).join('');
        const empty = this.getEmptyState('Бронювань на цей період немає', '', '');
        return `<h1 style="color:white; margin:0 0 24px 0;">Бронювання</h1><div class="admin-card admin-table-container"><table class="admin-table"><thead><tr><th>Клієнт</th><th>Послуга</th><th>Дата / Час</th><th>Статус</th><th>Дії</th></tr></thead><tbody>` + (trs || '<tr><td colspan="5">'+empty+'</td></tr>') + `</tbody></table></div>`;
    },

    getPaymentsHTML() {
        const leads = State.getLeads().filter(l => l.paymentAmount > 0 || l.paymentStatus !== 'pending');
        let trs = leads.map(l => `
            <tr>
                <td><div style="font-weight:600; color:white;">` + M.name(l.name, l.id) + `</div></td>
                <td>` + State.getServiceName(l.service) + `</td>
                <td><div style="color:white; font-weight:bold;">` + (l.paymentAmount || State.getServicePrice(l.service)).toLocaleString() + ` ₴</div></td>
                <td>` + B.payment(l.paymentStatus || 'awaiting') + `</td>
                <td><div class="quick-actions"><div class="quick-btn mock-action-btn" data-action="create_invoice" title="Створити Invoice"><i data-lucide="file-text" style="width:14px;"></i></div></div></td>
            </tr>
        `).join('');
        const empty = this.getEmptyState('Оплат не знайдено', '', '');
        return `<h1 style="color:white; margin:0 0 24px 0;">Оплати</h1><div class="admin-card admin-table-container"><table class="admin-table"><thead><tr><th>Клієнт</th><th>Послуга</th><th>Сума</th><th>Статус</th><th>Дії</th></tr></thead><tbody>` + (trs || '<tr><td colspan="5">'+empty+'</td></tr>') + `</tbody></table></div>`;
    },

    getTasksHTML() {
        let trs = DEFAULT_TASKS.map(t => `
            <tr>
                <td><div style="color:white; font-weight:600;">` + t.title + `</div></td>
                <td><div style="color:var(--admin-text-muted);">` + t.assignee + `</div></td>
                <td><div style="color:white;">` + t.deadline + `</div></td>
                <td><span class="badge ` + (t.priority==='high'?'badge-red':'badge-blue') + `">` + t.priority + `</span></td>
                <td>` + B.task(t.status) + `</td>
                <td><button class="topbar-btn mock-action-btn" data-action="edit_task">Редагувати</button></td>
            </tr>
        `).join('');
        return `<h1 style="color:white; margin:0 0 24px 0;">Задачі</h1><div class="admin-card admin-table-container"><table class="admin-table"><thead><tr><th>Назва</th><th>Відповідальний</th><th>Дедлайн</th><th>Пріоритет</th><th>Статус</th><th>Дії</th></tr></thead><tbody>` + trs + `</tbody></table></div>`;
    },

    getIntegrationsHTML() {
        const ints = [
            {cat: 'CRM', icon: 'database', items: [
                {n:'Pipedrive', s:'connected', c:'badge-green', t:'1 год тому', desc:'Синхронізація лідів, контактів та угод'},
                {n:'KeyCRM', s:'disconnected', c:'badge-gray', t:'—', desc:'Інтеграція з KeyCRM для e-commerce'},
                {n:'HubSpot', s:'disconnected', c:'badge-gray', t:'—', desc:'Marketing + Sales Hub'},
                {n:'Bitrix24', s:'disconnected', c:'badge-gray', t:'—', desc:'Задачі, CRM, телефонія'},
                {n:'Zoho CRM', s:'disconnected', c:'badge-gray', t:'—', desc:'Комплексна CRM-платформа'},
                {n:'Custom API', s:'configured', c:'badge-blue', t:'3 дні тому', desc:'Власний REST API endpoint'}
            ]},
            {cat: 'Calendar', icon: 'calendar', items: [
                {n:'Google Calendar', s:'connected', c:'badge-green', t:'Щойно', desc:'Автосинхронізація зустрічей та бронювань'},
                {n:'Zoom', s:'connected', c:'badge-green', t:'5 хв тому', desc:'Автогенерація лінків на зустрічі'},
                {n:'Google Meet', s:'disconnected', c:'badge-gray', t:'—', desc:'Альтернатива Zoom для відеозустрічей'}
            ]},
            {cat: 'Payments', icon: 'credit-card', items: [
                {n:'MonoPay (monobank)', s:'connected', c:'badge-green', t:'Вчора', desc:'Приймання оплат через monobank Acquiring'},
                {n:'LiqPay', s:'error', c:'badge-red', t:'Помилка API', desc:'Платіжний шлюз від ПриватБанку'},
                {n:'WayForPay', s:'disconnected', c:'badge-gray', t:'—', desc:'Онлайн-еквайринг та рекурентні платежі'},
                {n:'Portmone', s:'disconnected', c:'badge-gray', t:'—', desc:'Платіжний сервіс з підтримкою Apple/Google Pay'},
                {n:'Crypto / USDT / Whitepay', s:'configured', c:'badge-blue', t:'7 днів тому', desc:'Приймання криптовалютних платежів'}
            ]},
            {cat: 'Notifications', icon: 'bell', items: [
                {n:'Telegram Bot', s:'connected', c:'badge-green', t:'Щойно', desc:'Миттєві нотифікації про нових лідів та оплати'},
                {n:'Email (SMTP)', s:'connected', c:'badge-green', t:'2 год тому', desc:'Транзакційні листи та follow-up'},
                {n:'Slack', s:'disconnected', c:'badge-gray', t:'—', desc:'Командні нотифікації (опціонально)'}
            ]},
            {cat: 'Analytics', icon: 'bar-chart-3', items: [
                {n:'Google Analytics 4', s:'connected', c:'badge-green', t:'Real-time', desc:'Відстеження подій та конверсій сайту'},
                {n:'Google Tag Manager', s:'connected', c:'badge-green', t:'Налаштовано', desc:'Менеджер тегів для трекінгу'},
                {n:'Google Sheets', s:'configured', c:'badge-blue', t:'Вчора', desc:'Автоекспорт лідів та звітності в таблиці'},
                {n:'Looker Studio', s:'disconnected', c:'badge-gray', t:'—', desc:'Інтерактивні дашборди та звіти'},
                {n:'Power BI', s:'disconnected', c:'badge-gray', t:'—', desc:'Enterprise-рівень аналітики та візуалізації'}
            ]}
        ];
        const statusLabel = (s) => {
            switch(s) {
                case 'connected': return 'Підключено';
                case 'disconnected': return 'Не підключено';
                case 'error': return 'Помилка';
                case 'configured': return 'Налаштовано';
                default: return s;
            }
        };
        let html = ints.map(cat => `
            <div style="margin-bottom:32px;">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
                    <div style="width:36px; height:36px; background:rgba(59,130,246,0.15); border-radius:8px; display:flex; align-items:center; justify-content:center;">
                        <i data-lucide="` + cat.icon + `" style="width:18px; height:18px; color:var(--admin-primary);"></i>
                    </div>
                    <h3 style="color:white; margin:0; font-size:1.1rem;">` + cat.cat + `</h3>
                    <span class="badge badge-gray" style="font-size:0.7rem;">` + cat.items.length + ` сервісів</span>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); gap:16px;">
                    ` + cat.items.map(i => `
                        <div class="admin-card" style="margin:0; padding:20px; display:flex; flex-direction:column; gap:12px;">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                <div>
                                    <div style="color:white; font-weight:600; font-size:1rem; margin-bottom:2px;">` + i.n + `</div>
                                    <div style="color:var(--admin-text-muted); font-size:0.8rem; line-height:1.4;">` + i.desc + `</div>
                                </div>
                                <span class="badge ` + i.c + `">` + statusLabel(i.s) + `</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; padding-top:12px; border-top:1px solid var(--admin-border);">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <i data-lucide="refresh-cw" style="width:12px; height:12px; color:var(--admin-text-muted);"></i>
                                    <span style="color:var(--admin-text-muted); font-size:0.75rem;">Sync: ` + i.t + `</span>
                                </div>
                                <div style="display:flex; gap:8px;">
                                    <button class="quick-btn mock-action-btn" data-action="view_int_log" title="Лог помилок" style="width:28px; height:28px;">
                                        <i data-lucide="file-warning" style="width:14px;"></i>
                                    </button>
                                    <button class="topbar-btn mock-action-btn" data-action="edit_integration" style="font-size:0.8rem; padding:6px 12px;" ` + (currentRole==='viewer'?'disabled':'') + `>Налаштувати</button>
                                </div>
                            </div>
                        </div>
                    `).join('') + `
                </div>
            </div>
        `).join('');
        return `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
                <div>
                    <h1 style="color:white; margin:0 0 4px 0;">Інтеграції</h1>
                    <p style="color:var(--admin-text-muted); margin:0; font-size:0.9rem;">Керуйте підключеннями до зовнішніх сервісів</p>
                </div>
                <div style="display:flex; gap:12px;">
                    <button class="topbar-btn mock-action-btn" data-action="refresh_all_integrations"><i data-lucide="refresh-cw" style="width:14px;"></i> Синхронізувати всі</button>
                </div>
            </div>
        ` + html;
    },

    getSettingsHTML() {
        return `
            <h1 style="color:white; margin:0 0 24px 0;">Налаштування</h1>
            <div style="display:flex; gap:24px; flex-wrap:wrap;">
                <div style="width:100%; max-width:240px; display:flex; flex-direction:column; gap:8px;">
                    <div class="topbar-btn active">Профіль</div>
                    <div class="topbar-btn">Компанія / Бренд</div>
                    <div class="topbar-btn">Email-шаблони</div>
                    <div class="topbar-btn">Ролі доступу</div>
                    <div class="topbar-btn" style="color:#EF4444;">Developer Tools</div>
                </div>
                <div class="admin-card" style="flex-grow:1; padding:24px;">
                    <h3 style="color:white; margin-top:0;">Скинути базу даних</h3>
                    <p style="color:var(--admin-text-muted); font-size:0.9rem; margin-bottom:20px;">Ця дія видалить всі ліди та бронювання.</p>
                    <button class="btn btn-primary" id="open-reset-btn" style="background:rgba(239,68,68,0.1); color:#EF4444; border:1px solid #EF4444; padding:10px 20px;" ` + (isDemoMode || currentRole!=='super_admin'?'disabled':'') + `>Скинути (RESET)</button>
                    <div id="reset-confirm-box" style="display:none; margin-top:20px; padding:16px; background:rgba(0,0,0,0.2); border:1px solid var(--admin-border); border-radius:8px;">
                        <input type="text" id="reset-input" placeholder="Введіть RESET" style="background:var(--admin-bg); color:white; border:1px solid var(--admin-border); padding:8px; width:100%; box-sizing:border-box;">
                        <button id="exec-reset-btn" style="background:#EF4444; color:white; border:none; padding:8px 16px; border-radius:4px; margin-top:12px;" disabled>Підтвердити</button>
                    </div>
                </div>
            </div>
        `;
    },
    
    getBlogHTML() { return '<h1 style="color:white; margin:0 0 24px 0;">Блог</h1>' + this.getEmptyState('Статей ще немає', 'Створіть першу статтю.', '+ Додати статтю', 'add_article'); },
    getCasesHTML() { return '<h1 style="color:white; margin:0 0 24px 0;">Кейси</h1>' + this.getEmptyState('Кейсів ще немає', 'Створіть перший кейс.', '+ Додати кейс', 'add_case'); },
    getServicesHTML() { return '<h1 style="color:white; margin:0 0 24px 0;">Послуги</h1>' + this.getEmptyState('Послуги не налаштовані', 'Додайте послуги в налаштуваннях.', '+ Створити послугу', 'add_service'); },
    getAnalyticsHTML() { 
        return `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
                <h1 style="color:white; margin:0;">Аналітика</h1>
                <select style="background:var(--admin-bg); color:white; border:1px solid var(--admin-border); padding:8px 12px; border-radius:6px;">
                    <option>Останні 30 днів</option>
                    <option>Останні 7 днів</option>
                    <option>Поточний місяць</option>
                </select>
            </div>
            <div class="kpi-grid">
                <div class="kpi-card"><div style="color:var(--admin-text-muted);">Конверсія в лід</div><div class="kpi-value">4.8%</div><div style="color:#34D399; font-size:0.8rem;">↑ 1.2%</div></div>
                <div class="kpi-card"><div style="color:var(--admin-text-muted);">Вартість ліда (CPL)</div><div class="kpi-value">$12.50</div><div style="color:#F87171; font-size:0.8rem;">↓ $0.80</div></div>
                <div class="kpi-card"><div style="color:var(--admin-text-muted);">Середній чек (AOV)</div><div class="kpi-value">38,000 ₴</div><div style="color:#34D399; font-size:0.8rem;">↑ 5,000 ₴</div></div>
                <div class="kpi-card"><div style="color:var(--admin-text-muted);">Закриття (Win Rate)</div><div class="kpi-value">68%</div><div style="color:#34D399; font-size:0.8rem;">↑ 3%</div></div>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(400px, 1fr)); gap:24px;">
                <div class="admin-card">
                    <div class="admin-card-header">Джерела трафіку</div>
                    <div style="padding:24px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:12px;"><span style="color:white;">Google Ads</span><span style="color:white; font-weight:bold;">45%</span></div>
                        <div style="width:100%; height:8px; background:rgba(255,255,255,0.1); border-radius:4px; margin-bottom:20px;"><div style="width:45%; height:100%; background:var(--admin-primary); border-radius:4px;"></div></div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:12px;"><span style="color:white;">SEO</span><span style="color:white; font-weight:bold;">30%</span></div>
                        <div style="width:100%; height:8px; background:rgba(255,255,255,0.1); border-radius:4px; margin-bottom:20px;"><div style="width:30%; height:100%; background:#34D399; border-radius:4px;"></div></div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:12px;"><span style="color:white;">Direct</span><span style="color:white; font-weight:bold;">25%</span></div>
                        <div style="width:100%; height:8px; background:rgba(255,255,255,0.1); border-radius:4px;"><div style="width:25%; height:100%; background:#FBBF24; border-radius:4px;"></div></div>
                    </div>
                </div>
                <div class="admin-card">
                    <div class="admin-card-header">Популярні послуги</div>
                    <div style="padding:24px;">
                        <ul style="list-style:none; padding:0; margin:0; color:white; display:flex; flex-direction:column; gap:16px;">
                            <li style="display:flex; justify-content:space-between;"><span>1. Автоматизація продажів</span><b>12 лідів</b></li>
                            <li style="display:flex; justify-content:space-between;"><span>2. Аудит відділу продажів</span><b>8 лідів</b></li>
                            <li style="display:flex; justify-content:space-between;"><span>3. Скрипти та стандарти</span><b>5 лідів</b></li>
                        </ul>
                    </div>
                </div>
            </div>
        `; 
    },
    getAuditHTML() { 
        return `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
                <h1 style="color:white; margin:0;">Журнал дій (Audit Log)</h1>
                <button class="topbar-btn mock-action-btn" data-action="export_audit">Експорт логів</button>
            </div>
            <div class="admin-card admin-table-container">
                <table class="admin-table">
                    <thead><tr><th>Дата / Час</th><th>Користувач</th><th>Дія</th><th>Сутність</th><th>IP Адреса</th></tr></thead>
                    <tbody>
                        <tr><td>Сьогодні, 14:30</td><td><span style="color:white; font-weight:bold;">Super Admin</span></td><td>Оновлено статус на "Оплачено"</td><td>Лід: Олена</td><td>192.168.1.1</td></tr>
                        <tr><td>Сьогодні, 12:15</td><td><span style="color:var(--admin-text-muted);">Система (API)</span></td><td>Створено нову заявку</td><td>Лід: Олена</td><td>—</td></tr>
                        <tr><td>Вчора, 18:45</td><td><span style="color:white; font-weight:bold;">Sales Manager</span></td><td>Відправлено нагадування (Email)</td><td>Зустріч: Олександр</td><td>10.0.0.45</td></tr>
                        <tr><td>Вчора, 10:00</td><td><span style="color:white; font-weight:bold;">Super Admin</span></td><td>Змінено налаштування інтеграції</td><td>MonoPay</td><td>192.168.1.1</td></tr>
                    </tbody>
                </table>
            </div>
        `; 
    },

    // --- BINDING ---

    bindTabEvents() {
        const sSearch = document.getElementById("filter-search");
        if (sSearch) sSearch.addEventListener("input", (e) => { leadsFilter.search = e.target.value; this.renderCurrentTab(); });
        document.getElementById("filter-status")?.addEventListener("change", (e) => { leadsFilter.status = e.target.value; this.renderCurrentTab(); });
        document.getElementById("btn-reset-filters")?.addEventListener("click", () => { leadsFilter = {search:"", status:"all", payment:"all"}; this.renderCurrentTab(); });

        document.querySelectorAll(".lead-row").forEach(el => el.addEventListener("click", (e) => {
            if (e.target.closest('.open-details-btn')) {
                this.openPanel(el.getAttribute("data-id"));
                return;
            }
            if (e.target.closest('.quick-actions') || e.target.tagName === 'INPUT') return;
            this.openPanel(el.getAttribute("data-id"));
        }));

        document.querySelectorAll(".mock-btn").forEach(btn => btn.addEventListener("click", () => Toast.success("Успіх", "Дія виконана (Mock)")));
        document.querySelectorAll(".mock-error").forEach(btn => btn.addEventListener("click", () => Toast.error("Помилка", "Не вдалося виконати дію (Error State)")));

        document.querySelectorAll(".mock-action-btn").forEach(btn => btn.addEventListener("click", (e) => {
            this.handleAction(e.currentTarget.getAttribute("data-action"));
        }));

        document.getElementById("btn-add-lead")?.addEventListener("click", () => this.handleAction("add_lead"));

        document.querySelectorAll(".notif-item").forEach(item => item.addEventListener("click", () => {
            document.getElementById("notif-panel").classList.remove("open");
        }));

        // Reset DB
        document.getElementById("open-reset-btn")?.addEventListener("click", () => { document.getElementById("reset-confirm-box").style.display = "block"; });
        const rInput = document.getElementById("reset-input"), execBtn = document.getElementById("exec-reset-btn");
        if (rInput && execBtn) {
            rInput.addEventListener("input", (e) => { execBtn.disabled = e.target.value !== "RESET"; });
            execBtn.addEventListener("click", () => { localStorage.removeItem("sales_app_leads"); Toast.success("Базу скинуто"); setTimeout(() => window.location.reload(), 1000); });
        }
    },

    openPanel(leadId) {
        const lead = State.getLeads().find(l => l.id === leadId);
        if (!lead) return;

        const panel = document.getElementById("lead-side-panel");
        panel.innerHTML = `
            <div class="side-panel-header"><h2 style="color:white; margin:0;">` + M.name(lead.name, lead.id) + `</h2><button id="close-panel" style="background:transparent; border:none; color:white; cursor:pointer; font-size:1.5rem;">&times;</button></div>
            <div class="side-panel-content">
                <div style="display:flex; justify-content:space-between; margin-bottom:24px;">
                    <div><div style="color:var(--admin-text-muted);">` + M.company(lead.company) + `</div></div>
                    <div>
                        <select id="panel-status-change" style="background:var(--admin-bg); color:white; border:1px solid var(--admin-border); padding:8px; border-radius:6px;" ` + (currentRole==='viewer'?'disabled':'') + `>
                            <option value="new" ` + (lead.status==='new'?'selected':'') + `>Новий</option>
                            <option value="pending" ` + (lead.status==='pending'?'selected':'') + `>В роботі</option>
                            <option value="paid" ` + (lead.status==='paid'?'selected':'') + `>Оплачено</option>
                        </select>
                    </div>
                </div>
                <div class="admin-card" style="padding:16px; margin-bottom:24px;">
                    <h3 style="color:white; font-size:1rem; margin:0 0 16px 0;">Контакти</h3>
                    <p style="color:white; margin:4px 0;">Phone: ` + M.phone(lead.phone) + `</p>
                    <p style="color:white; margin:4px 0;">Email: ` + M.email(lead.email) + `</p>
                </div>
                <div class="admin-card" style="padding:16px; margin-bottom:24px;">
                    <h3 style="color:white; font-size:1rem; margin:0 0 16px 0;">Запит</h3>
                    <p style="color:var(--admin-primary); font-weight:bold; margin:0 0 8px 0;">` + State.getServiceName(lead.service) + `</p>
                    <p style="color:white; font-size:0.9rem; line-height:1.5;">` + M.note(lead.problem || 'Деталей немає') + `</p>
                </div>
            </div>
        `;

        panel.classList.add("open"); document.getElementById("panel-overlay").classList.add("open");
        document.getElementById("close-panel").addEventListener("click", () => this.closePanel());
        document.getElementById("panel-status-change")?.addEventListener("change", (e) => {
            State.updateLeadStatus(leadId, e.target.value); Toast.success("Статус оновлено"); this.renderCurrentTab();
        });
    },

    closePanel() {
        document.getElementById("lead-side-panel").classList.remove("open");
        document.getElementById("panel-overlay").classList.remove("open");
    },

    handleAction(action) {
        if (currentRole === 'viewer') {
            Toast.error("Помилка", "Недостатньо прав для цієї дії");
            return;
        }

        let title = "Дія";
        let content = "<p>Налаштування...</p>";

        switch(action) {
            case "add_lead":
                title = "Додати новий лід";
                content = '<label class="modal-label">Ім\'я клієнта</label><input type="text" class="modal-input" placeholder="Наприклад, Олексій"><label class="modal-label">Телефон</label><input type="text" class="modal-input" placeholder="+38 (000) 000-00-00"><label class="modal-label">Проблема</label><textarea class="modal-input" rows="2"></textarea>';
                break;
            case "add_article":
                title = "Нова стаття блогу";
                content = '<label class="modal-label">Заголовок</label><input type="text" class="modal-input" placeholder="Як збільшити продажі..."><label class="modal-label">Контент</label><textarea class="modal-input" rows="4" placeholder="Текст статті..."></textarea>';
                break;
            case "add_case":
                title = "Новий кейс";
                content = '<label class="modal-label">Назва клієнта</label><input type="text" class="modal-input" placeholder="ТОВ Компанія"><label class="modal-label">Результат</label><input type="text" class="modal-input" placeholder="x2 до конверсії">';
                break;
            case "add_service":
                title = "Створити послугу";
                content = '<label class="modal-label">Назва послуги</label><input type="text" class="modal-input" placeholder="Консультація"><label class="modal-label">Вартість (₴)</label><input type="number" class="modal-input" placeholder="5000">';
                break;
            case "edit_integration":
                title = "Налаштування інтеграції";
                content = '<label class="modal-label">API Key</label><input type="password" class="modal-input" placeholder="••••••••••••••••"><p style="color:var(--admin-text-muted); font-size:0.8rem;">Введіть ключ доступу з вашого кабінету.</p>';
                break;
            case "edit_task":
                title = "Редагувати задачу";
                content = '<label class="modal-label">Статус</label><select class="modal-input"><option>В роботі</option><option>Виконано</option></select><label class="modal-label">Коментар</label><textarea class="modal-input" rows="3"></textarea>';
                break;
            case "open_telegram":
                title = "Повідомлення в Telegram";
                content = '<p style="color:var(--admin-text-muted); font-size:0.9rem; margin-bottom:16px;">Напишіть повідомлення клієнту безпосередньо з CRM.</p><textarea class="modal-input" rows="4" placeholder="Добрий день! Щодо вашої заявки..."></textarea>';
                break;
            case "create_invoice":
                title = "Створення Інвойсу";
                content = '<label class="modal-label">Сума (₴)</label><input type="number" class="modal-input" value="45000"><label class="modal-label">Призначення платежу</label><input type="text" class="modal-input" value="Оплата за послуги автоматизації">';
                break;
            case "generate_link":
                title = "Згенерувати лінк на зустріч";
                content = '<label class="modal-label">Платформа</label><select class="modal-input"><option>Google Meet</option><option>Zoom</option></select><div style="padding:12px; background:rgba(59,130,246,0.1); border:1px solid var(--admin-primary); border-radius:6px; color:white; font-size:0.85rem; word-break:break-all;">https://meet.google.com/xyz-abcd-efg</div>';
                break;
            case "send_reminder":
                title = "Надіслати нагадування";
                content = '<p style="color:var(--admin-text-muted); font-size:0.9rem; margin-bottom:16px;">Клієнт отримає SMS та Email з деталями майбутньої зустрічі.</p><label class="modal-label">Додатковий коментар (опціонально)</label><input type="text" class="modal-input" placeholder="Не забудьте взяти з собою звіти...">';
                break;
            case "notif_lead":
                title = "Деталі нової заявки";
                content = '<p style="color:white; margin-bottom:16px;">Клієнт <b>Олена</b> залишила заявку на послугу "Комплексний аудит".</p><label class="modal-label">Дія менеджера</label><select class="modal-input"><option>Взяти в роботу (Призначити на себе)</option><option>Передати іншому менеджеру</option></select><label class="modal-label">Нотатка</label><textarea class="modal-input" rows="2" placeholder="Зателефонувати після 15:00..."></textarea>';
                break;
            case "notif_payment":
                title = "Підтвердження оплати";
                content = '<p style="color:white; margin-bottom:16px;">Компанія <b>ТОВ БудПостач</b> перерахувала 45,000 ₴.</p><label class="modal-label">Наступний крок</label><select class="modal-input"><option>Згенерувати акт виконаних робіт</option><option>Надіслати чек клієнту</option><option>Змінити статус ліда на "Оплачено"</option></select>';
                break;
            case "notif_meeting":
                title = "Зустріч через 1 годину";
                content = '<p style="color:white; margin-bottom:16px;">Онлайн-консультація з клієнтом <b>Олександр</b>.</p><div style="padding:12px; background:rgba(59,130,246,0.1); border:1px solid var(--admin-primary); border-radius:6px; color:white; font-size:0.85rem; word-break:break-all; margin-bottom:16px; text-align:center;">https://meet.google.com/xyz-abcd-efg</div><button class="topbar-btn primary" style="width:100%; display:block; text-align:center;" onclick="window.open(\'https://meet.google.com\')">Приєднатися зараз (Google Meet)</button>';
                break;
            case "export_audit":
                title = "Експорт логів";
                content = '<p style="color:white; margin-bottom:16px;">Оберіть період для експорту системних логів (CSV).</p><select class="modal-input"><option>Останні 7 днів</option><option>Останні 30 днів</option><option>Весь час</option></select>';
                break;
            case "view_int_log":
                title = "Лог помилок інтеграції";
                content = '<div style="background:#05080F; border:1px solid var(--admin-border); border-radius:8px; padding:16px; font-family:monospace; font-size:0.8rem; color:var(--admin-text-muted); max-height:300px; overflow-y:auto; line-height:1.8;">'
                    + '<div>[2026-07-23 09:15:33] <span style="color:#34D399;">INFO</span> — Sync started</div>'
                    + '<div>[2026-07-23 09:15:34] <span style="color:#34D399;">INFO</span> — Connected to API endpoint</div>'
                    + '<div>[2026-07-23 09:15:35] <span style="color:#FBBF24;">WARN</span> — Rate limit approaching (80/100)</div>'
                    + '<div>[2026-07-23 09:15:36] <span style="color:#F87171;">ERROR</span> — Token expired. Re-authentication required.</div>'
                    + '<div>[2026-07-23 09:15:37] <span style="color:#34D399;">INFO</span> — Retry #1: refreshing token...</div>'
                    + '<div>[2026-07-23 09:15:38] <span style="color:#34D399;">INFO</span> — Token refreshed successfully</div>'
                    + '<div>[2026-07-23 09:15:40] <span style="color:#34D399;">INFO</span> — Sync completed: 24 records processed</div>'
                    + '</div>';
                break;
            case "refresh_all_integrations":
                title = "Синхронізація";
                content = '<p style="color:white; margin-bottom:16px;">Запустити повну синхронізацію всіх підключених інтеграцій?</p><p style="color:var(--admin-text-muted); font-size:0.85rem;">Це може зайняти до 2 хвилин. Активні сервіси: Pipedrive, Google Calendar, Zoom, MonoPay, Telegram Bot, GA4, GTM, Google Sheets.</p>';
                break;
            default:
                title = "Форма";
                content = "<p>Функціонал у розробці.</p>";
        }

        const modal = document.createElement("div");
        modal.id = "generic-modal";
        modal.innerHTML = `
            <div style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:2000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(4px);">
                <div class="admin-card" style="width:100%; max-width:500px; margin:20px; animation: modalIn 0.2s ease;">
                    <div class="admin-card-header">
                        <h3 style="margin:0; color:white;">` + title + `</h3>
                        <button id="close-modal-btn" style="background:none; border:none; color:white; font-size:1.5rem; cursor:pointer;">&times;</button>
                    </div>
                    <div style="padding:24px;">
                        ` + content + `
                        <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:24px;">
                            <button class="topbar-btn" id="cancel-modal-btn">Скасувати</button>
                            <button class="topbar-btn primary" id="save-modal-btn">Зберегти</button>
                        </div>
                    </div>
                </div>
            </div>
            <style>
                @keyframes modalIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                .modal-input { width:100%; padding:10px 12px; background:var(--admin-bg); border:1px solid var(--admin-border); color:white; border-radius:6px; margin-bottom:16px; box-sizing:border-box; font-family:inherit; }
                .modal-label { display:block; color:var(--admin-text-muted); font-size:0.85rem; margin-bottom:6px; }
            </style>
        `;
        document.body.appendChild(modal);

        const close = () => modal.remove();
        document.getElementById("close-modal-btn").onclick = close;
        document.getElementById("cancel-modal-btn").onclick = close;
        document.getElementById("save-modal-btn").onclick = () => {
            close();
            Toast.success("Збережено", "Дані успішно оновлено");
        };
    }
};
