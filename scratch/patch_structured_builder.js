const fs = require('fs');

const ruleBuilderContent = `import { getSupabase } from "../api/supabase-client.js";
import { PortalAuth } from "../auth/auth-service.js";

// ==========================================================================
// 1. Business Schema & Dependency-Aware Registry
// ==========================================================================

export const TRIGGER_REGISTRY = {
    "stage_started": {
        label: "Етап проєкту розпочато",
        fields: ["name", "status", "project_health", "priority"],
        actions: ["create_task", "create_client_action", "notify_owner", "update_project_health", "webhook"]
    },
    "stage_completed": {
        label: "Етап проєкту завершено",
        fields: ["name", "status", "project_health", "priority"],
        actions: ["start_stage", "create_task", "create_client_action", "notify_owner", "update_project_health", "webhook"]
    },
    "client_action_added": {
        label: "Клієнту призначено дію",
        fields: ["title", "responsibility_type", "status"],
        actions: ["notify_owner", "create_task", "webhook"]
    },
    "client_action_completed": {
        label: "Клієнт виконав дію",
        fields: ["title", "responsibility_type", "status"],
        actions: ["create_task", "complete_stage", "start_stage", "notify_owner", "update_project_health", "webhook"]
    },
    "document_approved": {
        label: "Документ погоджено клієнтом",
        fields: ["category", "status"],
        actions: ["complete_stage", "create_task", "notify_owner", "update_project_health", "webhook"]
    },
    "document_changes_requested": {
        label: "Клієнт надіслав зауваження до документа",
        fields: ["category", "status"],
        actions: ["create_task", "update_project_health", "notify_owner", "webhook"]
    },
    "task_completed": {
        label: "Завдання команди виконано",
        fields: ["responsibility_type", "status"],
        actions: ["create_client_action", "notify_owner", "update_project_health", "webhook"]
    },
    "test_event": {
        label: "Тестова / Довільна подія",
        fields: ["name", "status", "x"],
        actions: ["create_task", "create_client_action", "notify_owner", "update_project_health", "webhook"]
    }
};

export const FIELD_DEFINITIONS = {
    "name": {
        label: "Назва етапу",
        type: "text",
        placeholder: "Наприклад: Розробка або Дизайн",
        operators: [
            { value: "eq", label: "Дорівнює (==)" },
            { value: "neq", label: "Не дорівнює (!=)" },
            { value: "contains", label: "Містить" }
        ]
    },
    "status": {
        label: "Статус етапу / сутності",
        type: "enum",
        operators: [
            { value: "eq", label: "Дорівнює (==)" },
            { value: "neq", label: "Не дорівнює (!=)" }
        ],
        options: [
            { value: "in_progress", label: "В процесі виконання" },
            { value: "completed", label: "Завершено" },
            { value: "pending", label: "Очікує старту" },
            { value: "review", label: "На перевірці" },
            { value: "approved", label: "Погоджено" },
            { value: "changes_requested", label: "Потребує змін" }
        ]
    },
    "project_health": {
        label: "Стан здоров'я проєкту",
        type: "enum",
        operators: [
            { value: "eq", label: "Дорівнює (==)" },
            { value: "neq", label: "Не дорівнює (!=)" }
        ],
        options: [
            { value: "green", label: "🟢 Здоровий (Green)" },
            { value: "yellow", label: "🟡 Під ризиком (Yellow)" },
            { value: "red", label: "🔴 Критичний (Red)" }
        ]
    },
    "priority": {
        label: "Пріоритет",
        type: "enum",
        operators: [
            { value: "eq", label: "Дорівнює (==)" },
            { value: "neq", label: "Не дорівнює (!=)" }
        ],
        options: [
            { value: "low", label: "Низький" },
            { value: "medium", label: "Середній" },
            { value: "high", label: "Високий" },
            { value: "urgent", label: "Терміновий" }
        ]
    },
    "category": {
        label: "Категорія документа",
        type: "enum",
        operators: [
            { value: "eq", label: "Дорівнює (==)" },
            { value: "neq", label: "Не дорівнює (!=)" }
        ],
        options: [
            { value: "contract", label: "Договір" },
            { value: "act", label: "Акт виконаних робіт" },
            { value: "specification", label: "Технічне завдання / Специфікація" },
            { value: "report", label: "Звіт" }
        ]
    },
    "responsibility_type": {
        label: "Тип відповідальності",
        type: "enum",
        operators: [
            { value: "eq", label: "Дорівнює (==)" },
            { value: "neq", label: "Не дорівнює (!=)" }
        ],
        options: [
            { value: "client", label: "Клієнт" },
            { value: "internal", label: "Внутрішня команда" }
        ]
    },
    "title": {
        label: "Назва / Заголовок дії",
        type: "text",
        placeholder: "Наприклад: Завантажити статут",
        operators: [
            { value: "eq", label: "Дорівнює (==)" },
            { value: "neq", label: "Не дорівнює (!=)" },
            { value: "contains", label: "Містить" }
        ]
    },
    "x": {
        label: "Тестовий параметр (x)",
        type: "text",
        placeholder: "Значення параметра",
        operators: [
            { value: "eq", label: "Дорівнює (==)" },
            { value: "neq", label: "Не дорівнює (!=)" },
            { value: "contains", label: "Містить" }
        ]
    }
};

export const ACTION_DEFINITIONS = {
    "create_task": {
        label: "Створити завдання для команди",
        description: "Автоматично ставить завдання в системі для внутрішніх виконавців",
        fields: [
            { name: "title", label: "Назва завдання", type: "text", placeholder: "Наприклад: Підготувати звіт до етапу", required: true },
            { name: "priority", label: "Пріоритет", type: "select", options: [
                { value: "medium", label: "Середній" },
                { value: "low", label: "Низький" },
                { value: "high", label: "Високий" },
                { value: "urgent", label: "Терміновий" }
            ], defaultValue: "medium" },
            { name: "due_days", label: "Термін виконання (днів)", type: "number", placeholder: "3", defaultValue: "3" }
        ]
    },
    "create_client_action": {
        label: "Створити дію для клієнта",
        description: "Призначає запит/завдання клієнту в його кабінеті",
        fields: [
            { name: "title", label: "Назва дії для клієнта", type: "text", placeholder: "Наприклад: Завантажити скан договору", required: true },
            { name: "description", label: "Інструкція для клієнта", type: "textarea", placeholder: "Будь ласка, завантажте підписаний документ у форматі PDF." }
        ]
    },
    "start_stage": {
        label: "Розпочати етап проєкту",
        description: "Переводить вказаний етап проєкту в статус 'В процесі'",
        fields: [
            { name: "target_name", label: "Назва етапу", type: "text", placeholder: "Наприклад: Дизайн", required: true }
        ]
    },
    "complete_stage": {
        label: "Завершити етап проєкту",
        description: "Переводить вказаний етап проєкту в статус 'Завершено'",
        fields: [
            { name: "target_name", label: "Назва етапу", type: "text", placeholder: "Наприклад: Брифінг", required: true }
        ]
    },
    "notify_owner": {
        label: "Сповістити власника / PM",
        description: "Надсилає системне повідомлення відповідальному менеджеру проєкту",
        fields: [
            { name: "title", label: "Заголовок сповіщення", type: "text", placeholder: "Наприклад: Клієнт погодив етап", required: true },
            { name: "message", label: "Текст повідомлення", type: "textarea", placeholder: "Повідомлення про подію автоматизації" },
            { name: "severity", label: "Рівень важливості", type: "select", options: [
                { value: "info", label: "Інформаційний" },
                { value: "warning", label: "Увага (Warning)" },
                { value: "critical", label: "Критичний" }
            ], defaultValue: "info" }
        ]
    },
    "update_project_health": {
        label: "Оновити стан здоров'я проєкту",
        description: "Змінює світлофор статусу проєкту (Green / Yellow / Red)",
        fields: [
            { name: "health", label: "Новий стан", type: "select", options: [
                { value: "green", label: "🟢 Здоровий (Green)" },
                { value: "yellow", label: "🟡 Під ризиком (Yellow)" },
                { value: "red", label: "🔴 Критичний (Red)" }
            ], defaultValue: "green" },
            { name: "reason", label: "Причина зміни статусу", type: "text", placeholder: "Наприклад: Затримка клієнта з оплатою" }
        ]
    },
    "webhook": {
        label: "Надіслати вебхук (Інтеграція)",
        description: "Виконує HTTP-запит до зовнішньої системи (CRM / ERP / чат-бот)",
        fields: [
            { name: "url", label: "URL адреса вебхука", type: "text", placeholder: "https://api.example.com/webhook", required: true },
            { name: "method", label: "HTTP Метод", type: "select", options: [
                { value: "POST", label: "POST" },
                { value: "PUT", label: "PUT" }
            ], defaultValue: "POST" }
        ]
    }
};

// ==========================================================================
// 2. Main Rule Builder Modal
// ==========================================================================

export async function openRuleBuilderModal(ruleId = null) {
    let existingRule = null;
    const supabase = await getSupabase();
    
    // Remove existing modal overlay if open
    const overlayId = "automation-rule-modal-overlay";
    let existingOverlay = document.getElementById(overlayId);
    if (existingOverlay) existingOverlay.remove();
    
    // Lock background scroll completely & record scroll position
    const scrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    
    function closeModal() {
        document.documentElement.style.overflow = prevHtmlOverflow || "";
        document.body.style.overflow = prevBodyOverflow || "";
        document.removeEventListener("keydown", onKeyDown);
        overlay.removeEventListener("wheel", onOverlayWheel);
        overlay.removeEventListener("touchmove", onOverlayTouch);
        const el = document.getElementById(overlayId);
        if (el) el.remove();
        // Restore exact scroll position without jump
        window.scrollTo({ top: scrollY, behavior: "instant" });
    }
    
    function onOverlayWheel(e) {
        const modalBody = e.target.closest('.portal-modal-body');
        if (!modalBody) {
            e.preventDefault();
            return;
        }
        // Prevent scroll chaining when top/bottom boundary reached
        const isScrollable = modalBody.scrollHeight > modalBody.clientHeight;
        if (!isScrollable) {
            e.preventDefault();
            return;
        }
        const atTop = modalBody.scrollTop <= 0 && e.deltaY < 0;
        const atBottom = modalBody.scrollTop + modalBody.clientHeight >= modalBody.scrollHeight - 1 && e.deltaY > 0;
        if (atTop || atBottom) {
            e.preventDefault();
        }
    }
    
    function onOverlayTouch(e) {
        if (!e.target.closest('.portal-modal-body')) {
            e.preventDefault();
        }
    }
    
    function onKeyDown(e) {
        if (e.key === "Escape") {
            closeModal();
            return;
        }
        const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
        if (!isInput && ['Space', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp'].includes(e.code)) {
            if (!document.activeElement?.closest('.portal-modal-body')) {
                e.preventDefault();
            }
        }
    }
    
    document.addEventListener("keydown", onKeyDown);
    
    // Create overlay container
    const overlay = document.createElement("div");
    overlay.id = overlayId;
    overlay.className = "portal-modal-overlay";
    overlay.style.cssText = "position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; width: 100vw !important; height: 100vh !important; background: rgba(5, 8, 15, 0.85) !important; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); display: flex !important; align-items: center !important; justify-content: center !important; z-index: 10000 !important; padding: 16px !important; box-sizing: border-box !important; margin: 0 !important; overscroll-behavior: contain !important;";
    
    overlay.addEventListener('wheel', onOverlayWheel, { passive: false });
    overlay.addEventListener('touchmove', onOverlayTouch, { passive: false });
    
    let isEditing = !!ruleId;
    let name = "";
    let currentTrigger = "stage_started";
    let scopeType = "global";
    let scopeId = "";
    let isActive = true;
    let initialConditions = [];
    let initialActions = [];
    
    // Fetch if editing
    if (isEditing) {
        const { data, error } = await supabase.from('automation_rules').select('*').eq('id', ruleId).single();
        if (data && !error) {
            existingRule = data;
            name = data.name || "";
            currentTrigger = data.trigger_event || "stage_started";
            isActive = data.is_active !== false;
            initialConditions = Array.isArray(data.conditions) ? data.conditions : [];
            initialActions = Array.isArray(data.actions) ? data.actions : [];
            if (data.project_id) {
                scopeType = "project";
                scopeId = data.project_id;
            } else if (data.template_id) {
                scopeType = "template";
                scopeId = data.template_id;
            } else {
                scopeType = "global";
            }
        } else {
            closeModal();
            alert("Помилка завантаження правила: " + (error?.message || "Unknown error"));
            return;
        }
    }
    
    // Scope entities loading
    let orgId = PortalAuth.getUser()?.user_metadata?.org_id || PortalAuth.getProfile()?.organization_id;
    if (!orgId) {
        const orgReq = await supabase.from("organizations").select("id").limit(1).single();
        if (orgReq.data) orgId = orgReq.data.id;
        else orgId = "mock-org";
    }
    
    let projectsHtml = \`<option value="">-- Оберіть проєкт --</option>\`;
    let templatesHtml = \`<option value="">-- Оберіть шаблон --</option>\`;
    
    try {
        const { data: pData } = await supabase.from('projects').select('id, name').eq('organization_id', orgId);
        if (pData) pData.forEach(p => { projectsHtml += \`<option value="\${p.id}" \${scopeId === p.id ? 'selected' : ''}>\${p.name}</option>\`; });
        
        const { data: tData } = await supabase.from('project_templates').select('id, name').eq('organization_id', orgId);
        if (tData) tData.forEach(t => { templatesHtml += \`<option value="\${t.id}" \${scopeId === t.id ? 'selected' : ''}>\${t.name}</option>\`; });
    } catch (e) {
        console.error("Failed to load scope entities:", e);
    }

    // Build trigger options
    let triggerOptionsHtml = "";
    Object.keys(TRIGGER_REGISTRY).forEach(k => {
        triggerOptionsHtml += \`<option value="\${k}" \${currentTrigger === k ? 'selected' : ''}>\${TRIGGER_REGISTRY[k].label}</option>\`;
    });

    const html = \`
    <div class="portal-modal" id="automation-rule-modal" style="position: relative !important; width: 100% !important; max-width: 860px !important; max-height: 90vh !important; display: flex !important; flex-direction: column !important; background: #0E1526 !important; border: 1px solid rgba(148, 163, 184, 0.2) !important; border-radius: 16px !important; box-shadow: 0 25px 60px rgba(0, 0, 0, 0.7) !important; overflow: hidden !important; color: #F8FAFC !important; margin: auto !important;">
        
        <!-- Header -->
        <div class="portal-modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid rgba(148, 163, 184, 0.15); background: #0E1526; flex-shrink: 0;">
            <h2 class="portal-modal-title" style="margin: 0; font-size: 1.25rem; font-weight: 700; color: #F8FAFC;">\${isEditing ? 'Редагувати правило' : 'Створити правило автоматизації'}</h2>
            <button type="button" class="btn-modal-close" aria-label="Закрити" style="background: transparent; border: none; font-size: 24px; color: #94A3B8; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 6px; transition: color 0.15s;">&times;</button>
        </div>
        
        <!-- Body (internally scrollable with overscroll containment) -->
        <div class="portal-modal-body" style="padding: 24px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 20px; background: #0E1526; color: #F8FAFC; overscroll-behavior: contain !important;">
            
            <!-- Rule Name -->
            <div class="portal-form-group" style="display: flex; flex-direction: column; gap: 6px;">
                <label style="display: block; font-weight: 600; font-size: 0.85rem; color: #94A3B8;">Назва правила</label>
                <input type="text" id="arb-name" class="portal-input" value="\${name}" placeholder="Наприклад: Автоматичний запуск наступного етапу при завершенні" style="width: 100%; background: #141C31 !important; color: #F8FAFC !important; border: 1px solid rgba(148, 163, 184, 0.2) !important; border-radius: 8px; padding: 10px 14px; font-size: 0.9rem;">
            </div>
            
            <!-- Trigger & Scope Row -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
                <div class="portal-form-group" style="display: flex; flex-direction: column; gap: 6px;">
                    <label style="display: block; font-weight: 600; font-size: 0.85rem; color: #94A3B8;">Тригер події</label>
                    <select id="arb-trigger" class="portal-input" style="width: 100%; background: #141C31 !important; color: #F8FAFC !important; border: 1px solid rgba(148, 163, 184, 0.2) !important; border-radius: 8px; padding: 10px 14px; font-size: 0.9rem;">
                        \${triggerOptionsHtml}
                    </select>
                </div>
                
                <div class="portal-form-group" style="display: flex; flex-direction: column; gap: 6px;">
                    <label style="display: block; font-weight: 600; font-size: 0.85rem; color: #94A3B8;">Область дії</label>
                    <select id="arb-scope-type" class="portal-input" style="width: 100%; background: #141C31 !important; color: #F8FAFC !important; border: 1px solid rgba(148, 163, 184, 0.2) !important; border-radius: 8px; padding: 10px 14px; font-size: 0.9rem;">
                        <option value="global" \${scopeType === 'global' ? 'selected' : ''}>Глобально (всі проєкти)</option>
                        <option value="project" \${scopeType === 'project' ? 'selected' : ''}>Конкретний проєкт</option>
                        <option value="template" \${scopeType === 'template' ? 'selected' : ''}>Конкретний шаблон</option>
                    </select>
                </div>
                
                <div class="portal-form-group" id="arb-scope-id-wrapper" style="display: \${scopeType === 'global' ? 'none' : 'flex'}; flex-direction: column; gap: 6px;">
                    <label style="display: block; font-weight: 600; font-size: 0.85rem; color: #94A3B8;">Оберіть об'єкт</label>
                    <select id="arb-scope-project" class="portal-input" style="width: 100%; display: \${scopeType === 'project' ? 'block' : 'none'}; background: #141C31 !important; color: #F8FAFC !important; border: 1px solid rgba(148, 163, 184, 0.2) !important; border-radius: 8px; padding: 10px 14px; font-size: 0.9rem;">
                        \${projectsHtml}
                    </select>
                    <select id="arb-scope-template" class="portal-input" style="width: 100%; display: \${scopeType === 'template' ? 'block' : 'none'}; background: #141C31 !important; color: #F8FAFC !important; border: 1px solid rgba(148, 163, 184, 0.2) !important; border-radius: 8px; padding: 10px 14px; font-size: 0.9rem;">
                        \${templatesHtml}
                    </select>
                </div>
            </div>
            
            <!-- Active checkbox -->
            <div class="portal-form-group">
                <label style="display: inline-flex; align-items: center; gap: 10px; cursor: pointer; user-select: none;">
                    <input type="checkbox" id="arb-active" \${isActive ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #3B82F6; cursor: pointer;">
                    <span style="font-weight: 600; font-size: 0.9rem; color: #F8FAFC;">Активне правило</span>
                </label>
            </div>
            
            <!-- Conditions Card -->
            <div style="background: #111827; border: 1px solid rgba(148, 163, 184, 0.15); border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: #F8FAFC;">Умови виконання</h3>
                        <div style="font-size: 0.78rem; color: #94A3B8; margin-top: 2px;">Правило виконається, тільки якщо всі вказані умови відповідають контексту події</div>
                    </div>
                    <button type="button" class="btn btn-sm btn-outline" id="arb-add-condition" style="color: #60A5FA; border-color: rgba(96, 165, 250, 0.3); background: rgba(59, 130, 246, 0.08); font-weight: 600; font-size: 0.82rem; padding: 6px 12px; border-radius: 6px; cursor: pointer;">+ Додати умову</button>
                </div>
                <div id="arb-conditions-list" style="display: flex; flex-direction: column; gap: 10px;">
                    <!-- conditions items rendered dynamically -->
                </div>
                <div id="arb-empty-cond" style="color: #64748B; font-size: 0.85rem; padding: 10px; background: rgba(15, 23, 42, 0.5); border-radius: 8px; border: 1px dashed rgba(148, 163, 184, 0.15); text-align: center; font-style: italic; display: none;">Умов не додано (правило спрацьовуватиме при кожному настанні обраного тригера)</div>
            </div>

            <!-- Actions Card -->
            <div style="background: #111827; border: 1px solid rgba(148, 163, 184, 0.15); border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: #F8FAFC;">Автоматичні дії</h3>
                        <div style="font-size: 0.78rem; color: #94A3B8; margin-top: 2px;">Дії, які виконуються системою автоматично при спрацьовуванні правила</div>
                    </div>
                    <button type="button" class="btn btn-sm btn-outline" id="arb-add-action" style="color: #60A5FA; border-color: rgba(96, 165, 250, 0.3); background: rgba(59, 130, 246, 0.08); font-weight: 600; font-size: 0.82rem; padding: 6px 12px; border-radius: 6px; cursor: pointer;">+ Додати дію</button>
                </div>
                <div id="arb-actions-list" style="display: flex; flex-direction: column; gap: 12px;">
                    <!-- actions items rendered dynamically -->
                </div>
                <div id="arb-empty-act" style="color: #64748B; font-size: 0.85rem; padding: 10px; background: rgba(15, 23, 42, 0.5); border-radius: 8px; border: 1px dashed rgba(148, 163, 184, 0.15); text-align: center; font-style: italic; display: none;">Дій не додано. Додайте хоча б одну дію для збереження правила.</div>
            </div>
            
            <div id="arb-error-msg" style="color: #EF4444; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; padding: 10px 14px; display: none; font-size: 0.88rem; font-weight: 500;"></div>
            
        </div>
        
        <!-- Footer -->
        <div class="portal-modal-footer" style="display: flex; justify-content: flex-end; align-items: center; gap: 12px; padding: 16px 24px; border-top: 1px solid rgba(148, 163, 184, 0.15); background: rgba(5, 8, 15, 0.6); flex-shrink: 0;">
            <button type="button" class="btn btn-outline btn-modal-close" style="color: #94A3B8; border-color: rgba(148, 163, 184, 0.3); min-width: 100px; padding: 8px 16px; border-radius: 8px; cursor: pointer;">Скасувати</button>
            <button type="button" class="btn btn-primary" id="arb-save-btn" style="background: #3B82F6; color: #FFFFFF; font-weight: 600; min-width: 130px; padding: 8px 20px; border-radius: 8px; border: none; cursor: pointer;">Зберегти</button>
        </div>
    </div>
    \`;
    
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    
    // Close button handlers
    overlay.querySelectorAll(".btn-modal-close").forEach(btn => {
        btn.addEventListener("click", closeModal);
    });
    
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    });
    
    // Scope change logic
    const scopeTypeEl = document.getElementById("arb-scope-type");
    const scopeWrapper = document.getElementById("arb-scope-id-wrapper");
    const scopeProj = document.getElementById("arb-scope-project");
    const scopeTemp = document.getElementById("arb-scope-template");
    
    scopeTypeEl.addEventListener("change", (e) => {
        const val = e.target.value;
        if (val === "global") {
            scopeWrapper.style.display = "none";
        } else {
            scopeWrapper.style.display = "flex";
            scopeProj.style.display = val === "project" ? "block" : "none";
            scopeTemp.style.display = val === "template" ? "block" : "none";
        }
    });
    
    // ==========================================================================
    // 3. Dynamic Structured Conditions Builder
    // ==========================================================================
    const condList = document.getElementById("arb-conditions-list");
    const emptyCond = document.getElementById("arb-empty-cond");
    const triggerEl = document.getElementById("arb-trigger");
    
    function updateCondEmptyState() {
        emptyCond.style.display = condList.children.length === 0 ? "block" : "none";
    }
    
    function renderConditionRow(c = {}) {
        const triggerKey = triggerEl.value;
        const availableFieldKeys = TRIGGER_REGISTRY[triggerKey]?.fields || Object.keys(FIELD_DEFINITIONS);
        
        let selectedField = c.field || availableFieldKeys[0] || "name";
        if (!FIELD_DEFINITIONS[selectedField]) {
            selectedField = availableFieldKeys[0] || "name";
        }
        
        const row = document.createElement("div");
        row.className = "arb-condition-row";
        row.style.cssText = "display: flex; gap: 10px; align-items: center; background: #141C31; border: 1px solid rgba(148, 163, 184, 0.15); border-radius: 8px; padding: 10px 12px; flex-wrap: wrap;";
        
        function rebuildRowInner(fieldName, opVal, valueVal) {
            const fieldDef = FIELD_DEFINITIONS[fieldName] || FIELD_DEFINITIONS["name"];
            
            // Build Field Select Options
            let fieldOptionsHtml = "";
            availableFieldKeys.forEach(fk => {
                const fd = FIELD_DEFINITIONS[fk];
                if (fd) {
                    fieldOptionsHtml += \`<option value="\${fk}" \${fk === fieldName ? 'selected' : ''}>\${fd.label}</option>\`;
                }
            });
            
            // Build Operator Select Options
            let opOptionsHtml = "";
            const activeOp = opVal || fieldDef.operators[0].value;
            fieldDef.operators.forEach(op => {
                opOptionsHtml += \`<option value="\${op.value}" \${op.value === activeOp ? 'selected' : ''}>\${op.label}</option>\`;
            });
            
            // Build Value Control (Enum dropdown or typed input)
            let valueControlHtml = "";
            const curVal = valueVal !== undefined && valueVal !== null ? valueVal : (fieldDef.options ? fieldDef.options[0].value : "");
            
            if (fieldDef.type === "enum" && fieldDef.options) {
                let enumOptsHtml = "";
                fieldDef.options.forEach(opt => {
                    enumOptsHtml += \`<option value="\${opt.value}" \${opt.value === curVal ? 'selected' : ''}>\${opt.label}</option>\`;
                });
                valueControlHtml = \`
                    <select class="portal-input cond-val" style="flex: 1; min-width: 140px; background: #0E1526 !important; color: #F8FAFC !important; border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 6px; padding: 8px 12px; font-size: 0.85rem;">
                        \${enumOptsHtml}
                    </select>
                \`;
            } else if (fieldDef.type === "number") {
                valueControlHtml = \`
                    <input type="number" class="portal-input cond-val" placeholder="\${fieldDef.placeholder || 'Значення'}" value="\${curVal}" style="flex: 1; min-width: 120px; background: #0E1526 !important; color: #F8FAFC !important; border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 6px; padding: 8px 12px; font-size: 0.85rem;">
                \`;
            } else {
                valueControlHtml = \`
                    <input type="text" class="portal-input cond-val" placeholder="\${fieldDef.placeholder || 'Значення'}" value="\${curVal}" style="flex: 1; min-width: 140px; background: #0E1526 !important; color: #F8FAFC !important; border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 6px; padding: 8px 12px; font-size: 0.85rem;">
                \`;
            }
            
            row.innerHTML = \`
                <div style="display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 160px;">
                    <span style="font-size: 0.72rem; color: #94A3B8; font-weight: 600;">Поле умови</span>
                    <select class="portal-input cond-field" style="width: 100%; background: #0E1526 !important; color: #F8FAFC !important; border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 6px; padding: 8px 10px; font-size: 0.85rem;">
                        \${fieldOptionsHtml}
                    </select>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 2px; width: 140px;">
                    <span style="font-size: 0.72rem; color: #94A3B8; font-weight: 600;">Оператор</span>
                    <select class="portal-input cond-op" style="width: 100%; background: #0E1526 !important; color: #F8FAFC !important; border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 6px; padding: 8px 10px; font-size: 0.85rem;">
                        \${opOptionsHtml}
                    </select>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 160px;">
                    <span style="font-size: 0.72rem; color: #94A3B8; font-weight: 600;">Значення</span>
                    \${valueControlHtml}
                </div>
                
                <div style="display: flex; align-items: flex-end; height: 100%; padding-top: 18px;">
                    <button type="button" class="btn btn-sm btn-outline btn-del-cond" style="color: #F87171; border-color: rgba(248, 113, 113, 0.3); background: rgba(239, 68, 68, 0.1); padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 0.82rem; white-space: nowrap;">Видалити</button>
                </div>
            \`;
            
            // Rebind field change
            row.querySelector(".cond-field").addEventListener("change", (e) => {
                rebuildRowInner(e.target.value, null, "");
            });
            
            // Rebind delete
            row.querySelector(".btn-del-cond").addEventListener("click", () => {
                row.remove();
                updateCondEmptyState();
            });
        }
        
        rebuildRowInner(selectedField, c.operator, c.value);
        condList.appendChild(row);
        updateCondEmptyState();
    }
    
    // ==========================================================================
    // 4. Dynamic Structured Actions Builder
    // ==========================================================================
    const actList = document.getElementById("arb-actions-list");
    const emptyAct = document.getElementById("arb-empty-act");
    
    function updateActEmptyState() {
        emptyAct.style.display = actList.children.length === 0 ? "block" : "none";
    }
    
    function renderActionCard(a = {}) {
        const triggerKey = triggerEl.value;
        const availableActionKeys = TRIGGER_REGISTRY[triggerKey]?.actions || Object.keys(ACTION_DEFINITIONS);
        
        let selectedActionType = a.type || availableActionKeys[0] || "create_task";
        if (!ACTION_DEFINITIONS[selectedActionType]) {
            selectedActionType = availableActionKeys[0] || "create_task";
        }
        
        const card = document.createElement("div");
        card.className = "arb-action-card";
        card.style.cssText = "background: #141C31; border: 1px solid rgba(148, 163, 184, 0.15); border-radius: 10px; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px;";
        
        function rebuildCardInner(actionType, payloadData = {}) {
            const actDef = ACTION_DEFINITIONS[actionType] || ACTION_DEFINITIONS["create_task"];
            
            // Action type select options
            let typeOptionsHtml = "";
            availableActionKeys.forEach(ak => {
                const ad = ACTION_DEFINITIONS[ak];
                if (ad) {
                    typeOptionsHtml += \`<option value="\${ak}" \${ak === actionType ? 'selected' : ''}>\${ad.label}</option>\`;
                }
            });
            
            // Render typed input fields
            let fieldsHtml = "";
            actDef.fields.forEach(f => {
                const val = payloadData[f.name] !== undefined ? payloadData[f.name] : (f.defaultValue || "");
                if (f.type === "textarea") {
                    fieldsHtml += \`
                        <div class="portal-form-group" style="display: flex; flex-direction: column; gap: 4px; grid-column: span 2;">
                            <label style="font-size: 0.8rem; color: #94A3B8; font-weight: 600;">\${f.label} \${f.required ? '<span style=\"color:#EF4444;\">*</span>' : ''}</label>
                            <textarea class="portal-input act-field-input" data-param="\${f.name}" placeholder="\${f.placeholder || ''}" style="width: 100%; min-height: 60px; background: #0E1526 !important; color: #F8FAFC !important; border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 6px; padding: 8px 12px; font-size: 0.85rem; resize: vertical;">\${val}</textarea>
                        </div>
                    \`;
                } else if (f.type === "select") {
                    let selectOptsHtml = "";
                    f.options.forEach(opt => {
                        selectOptsHtml += \`<option value="\${opt.value}" \${opt.value === val ? 'selected' : ''}>\${opt.label}</option>\`;
                    });
                    fieldsHtml += \`
                        <div class="portal-form-group" style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-size: 0.8rem; color: #94A3B8; font-weight: 600;">\${f.label}</label>
                            <select class="portal-input act-field-input" data-param="\${f.name}" style="width: 100%; background: #0E1526 !important; color: #F8FAFC !important; border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 6px; padding: 8px 12px; font-size: 0.85rem;">
                                \${selectOptsHtml}
                            </select>
                        </div>
                    \`;
                } else if (f.type === "number") {
                    fieldsHtml += \`
                        <div class="portal-form-group" style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-size: 0.8rem; color: #94A3B8; font-weight: 600;">\${f.label}</label>
                            <input type="number" class="portal-input act-field-input" data-param="\${f.name}" placeholder="\${f.placeholder || ''}" value="\${val}" style="width: 100%; background: #0E1526 !important; color: #F8FAFC !important; border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 6px; padding: 8px 12px; font-size: 0.85rem;">
                        </div>
                    \`;
                } else {
                    fieldsHtml += \`
                        <div class="portal-form-group" style="display: flex; flex-direction: column; gap: 4px; \${actDef.fields.length === 1 ? 'grid-column: span 2;' : ''}">
                            <label style="font-size: 0.8rem; color: #94A3B8; font-weight: 600;">\${f.label} \${f.required ? '<span style=\"color:#EF4444;\">*</span>' : ''}</label>
                            <input type="text" class="portal-input act-field-input" data-param="\${f.name}" placeholder="\${f.placeholder || ''}" value="\${val}" style="width: 100%; background: #0E1526 !important; color: #F8FAFC !important; border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 6px; padding: 8px 12px; font-size: 0.85rem;">
                        </div>
                    \`;
                }
            });
            
            card.innerHTML = \`
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(148, 163, 184, 0.1); padding-bottom: 10px;">
                    <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                        <span style="font-size: 0.78rem; font-weight: 700; color: #60A5FA; text-transform: uppercase;">Дія:</span>
                        <select class="portal-input act-type-select" style="min-width: 260px; background: #0E1526 !important; color: #F8FAFC !important; border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 6px; padding: 8px 12px; font-size: 0.88rem; font-weight: 600;">
                            \${typeOptionsHtml}
                        </select>
                        <span style="font-size: 0.78rem; color: #94A3B8; font-style: italic;">\${actDef.description || ''}</span>
                    </div>
                    <button type="button" class="btn btn-sm btn-outline btn-del-act" style="color: #F87171; border-color: rgba(248, 113, 113, 0.3); background: rgba(239, 68, 68, 0.1); padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.82rem; white-space: nowrap;">Видалити</button>
                </div>
                
                <div class="act-params-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    \${fieldsHtml}
                </div>
            \`;
            
            // Rebind type select
            card.querySelector(".act-type-select").addEventListener("change", (e) => {
                rebuildCardInner(e.target.value, {});
            });
            
            // Rebind delete
            card.querySelector(".btn-del-act").addEventListener("click", () => {
                card.remove();
                updateActEmptyState();
            });
        }
        
        rebuildCardInner(selectedActionType, a.payload || (typeof a === 'object' ? a : {}));
        actList.appendChild(card);
        updateActEmptyState();
    }
    
    // Trigger change handler to update available conditions & actions
    triggerEl.addEventListener("change", () => {
        // Refresh condition rows if their field is no longer valid for trigger
        Array.from(condList.children).forEach(row => {
            const fEl = row.querySelector(".cond-field");
            const opEl = row.querySelector(".cond-op");
            const valEl = row.querySelector(".cond-val");
            if (fEl) {
                const curF = fEl.value;
                const allowed = TRIGGER_REGISTRY[triggerEl.value]?.fields || Object.keys(FIELD_DEFINITIONS);
                if (!allowed.includes(curF)) {
                    fEl.value = allowed[0];
                    fEl.dispatchEvent(new Event("change"));
                }
            }
        });
    });
    
    // Add condition button
    document.getElementById("arb-add-condition").addEventListener("click", () => {
        const allowed = TRIGGER_REGISTRY[triggerEl.value]?.fields || Object.keys(FIELD_DEFINITIONS);
        renderConditionRow({ field: allowed[0] || "name", operator: "eq", value: "" });
    });
    
    // Add action button
    document.getElementById("arb-add-action").addEventListener("click", () => {
        const allowed = TRIGGER_REGISTRY[triggerEl.value]?.actions || Object.keys(ACTION_DEFINITIONS);
        renderActionCard({ type: allowed[0] || "create_task", payload: {} });
    });
    
    // Populate initial conditions & actions
    if (initialConditions.length > 0) {
        initialConditions.forEach(renderConditionRow);
    } else {
        updateCondEmptyState();
    }
    
    if (initialActions.length > 0) {
        initialActions.forEach(act => {
            // Normalize payload from direct action object
            const type = act.type || "create_task";
            let payload = act.payload || {};
            if (Object.keys(payload).length === 0) {
                const clone = { ...act };
                delete clone.type;
                payload = clone;
            }
            renderActionCard({ type, payload });
        });
    } else {
        updateActEmptyState();
    }
    
    // ==========================================================================
    // 5. Validation and Save Handler
    // ==========================================================================
    document.getElementById("arb-save-btn").addEventListener("click", async () => {
        const errMsg = document.getElementById("arb-error-msg");
        errMsg.style.display = "none";
        
        const finalName = document.getElementById("arb-name").value.trim();
        if (!finalName) {
            errMsg.innerText = "Вкажіть назву правила автоматизації.";
            errMsg.style.display = "block";
            return;
        }
        
        const finalTrigger = triggerEl.value;
        const finalActive = document.getElementById("arb-active").checked;
        const sType = scopeTypeEl.value;
        let pId = null;
        let tId = null;
        if (sType === "project") {
            pId = scopeProj.value;
            if (!pId) { errMsg.innerText = "Оберіть конкретний проєкт для області дії."; errMsg.style.display = "block"; return; }
        } else if (sType === "template") {
            tId = scopeTemp.value;
            if (!tId) { errMsg.innerText = "Оберіть конкретний шаблон для області дії."; errMsg.style.display = "block"; return; }
        }
        
        // Collect conditions
        const finalConds = Array.from(condList.children).map(row => {
            const f = row.querySelector(".cond-field")?.value;
            const o = row.querySelector(".cond-op")?.value;
            const v = row.querySelector(".cond-val")?.value?.trim();
            if (!f || !o) return null;
            return {
                field: f,
                operator: o,
                value: v !== undefined ? v : ""
            };
        }).filter(c => c !== null);
        
        // Collect actions
        const finalActs = [];
        let validationError = null;
        
        Array.from(actList.children).forEach(card => {
            const type = card.querySelector(".act-type-select")?.value;
            if (!type) return;
            
            const actDef = ACTION_DEFINITIONS[type];
            const payload = {};
            
            card.querySelectorAll(".act-field-input").forEach(input => {
                const paramName = input.dataset.param;
                const paramVal = input.value.trim();
                payload[paramName] = paramVal;
                
                // Check required fields
                const fieldConfig = actDef?.fields?.find(f => f.name === paramName);
                if (fieldConfig?.required && !paramVal) {
                    validationError = \`Заповніть обов'язкове поле "\${fieldConfig.label}" у дії "\${actDef.label}".\`;
                }
            });
            
            // Canonical action payload structure
            if (type === "create_task") {
                payload.responsibility_type = "internal";
            } else if (type === "create_client_action") {
                payload.responsibility_type = "client";
            }
            
            finalActs.push({
                type: type,
                ...payload,
                payload: payload
            });
        });
        
        if (validationError) {
            errMsg.innerText = validationError;
            errMsg.style.display = "block";
            return;
        }
        
        if (finalActs.length === 0) {
            errMsg.innerText = "Додайте хоча б одну дію для виконання.";
            errMsg.style.display = "block";
            return;
        }
        
        const payload = {
            organization_id: orgId,
            name: finalName,
            trigger_event: finalTrigger,
            is_active: finalActive,
            conditions: finalConds,
            actions: finalActs,
            project_id: pId,
            template_id: tId
        };
        
        try {
            document.getElementById("arb-save-btn").innerText = "Збереження...";
            document.getElementById("arb-save-btn").disabled = true;
            
            if (isEditing) {
                const { error } = await supabase.from('automation_rules').update(payload).eq('id', ruleId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('automation_rules').insert([payload]);
                if (error) throw error;
            }
            
            closeModal();
            
            // Reload the global list automatically
            if (window.loadGlobalAutomationData) {
                await window.loadGlobalAutomationData();
            }
            
        } catch (err) {
            errMsg.innerText = "Помилка збереження в базі даних: " + (err.message || JSON.stringify(err));
            errMsg.style.display = "block";
            document.getElementById("arb-save-btn").innerText = "Зберегти";
            document.getElementById("arb-save-btn").disabled = false;
        }
    });
}
`;

fs.writeFileSync('js/portal/ui/portal-rule-builder-ui.js', ruleBuilderContent, 'utf8');
console.log("Wrote structured portal-rule-builder-ui.js");
