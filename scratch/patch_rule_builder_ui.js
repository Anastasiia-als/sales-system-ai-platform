const fs = require('fs');

const ruleBuilderCode = `import { getSupabase } from "../api/supabase-client.js";
import { PortalAuth } from "../auth/auth-service.js";

// Mapping dictionary for localization
const dict = {
    "stage_started": "Етап розпочато",
    "stage_completed": "Етап завершено",
    "client_action_added": "Дію клієнта додано",
    "client_action_completed": "Дію клієнта завершено",
    "test_event": "Тестова подія"
};

export async function openRuleBuilderModal(ruleId = null) {
    let existingRule = null;
    const supabase = await getSupabase();
    
    // Remove existing modal overlay if open
    const overlayId = "automation-rule-modal-overlay";
    let existingOverlay = document.getElementById(overlayId);
    if (existingOverlay) existingOverlay.remove();
    
    // Lock background page scrolling
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    
    function closeModal() {
        document.body.style.overflow = prevBodyOverflow || "";
        document.documentElement.style.overflow = prevHtmlOverflow || "";
        document.removeEventListener("keydown", onKeyDown);
        const el = document.getElementById(overlayId);
        if (el) el.remove();
    }
    
    function onKeyDown(e) {
        if (e.key === "Escape") {
            closeModal();
        }
    }
    document.addEventListener("keydown", onKeyDown);
    
    // Create overlay container
    const overlay = document.createElement("div");
    overlay.id = overlayId;
    overlay.className = "portal-modal-overlay";
    overlay.style.cssText = "position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; width: 100vw !important; height: 100vh !important; background: rgba(5, 8, 15, 0.85) !important; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); display: flex !important; align-items: center !important; justify-content: center !important; z-index: 10000 !important; padding: 16px !important; box-sizing: border-box !important; margin: 0 !important;";
    
    let isEditing = !!ruleId;
    let name = "";
    let trigger = "stage_started";
    let scopeType = "global";
    let scopeId = "";
    let isActive = true;
    let conditions = [];
    let actions = [];
    
    // Fetch if editing
    if (isEditing) {
        const { data, error } = await supabase.from('automation_rules').select('*').eq('id', ruleId).single();
        if (data && !error) {
            existingRule = data;
            name = data.name || "";
            trigger = data.trigger_event || "stage_started";
            isActive = data.is_active !== false;
            conditions = Array.isArray(data.conditions) ? data.conditions : [];
            actions = Array.isArray(data.actions) ? data.actions : [];
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

    const html = \`
    <div class="portal-modal" id="automation-rule-modal" style="position: relative !important; width: 100% !important; max-width: 820px !important; max-height: 90vh !important; display: flex !important; flex-direction: column !important; background: #0E1526 !important; border: 1px solid rgba(148, 163, 184, 0.2) !important; border-radius: 16px !important; box-shadow: 0 25px 60px rgba(0, 0, 0, 0.7) !important; overflow: hidden !important; color: #F8FAFC !important; margin: auto !important;">
        
        <!-- Header -->
        <div class="portal-modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid rgba(148, 163, 184, 0.15); background: #0E1526; flex-shrink: 0;">
            <h2 class="portal-modal-title" style="margin: 0; font-size: 1.25rem; font-weight: 700; color: #F8FAFC;">\${isEditing ? 'Редагувати правило' : 'Створити правило автоматизації'}</h2>
            <button type="button" class="btn-modal-close" aria-label="Закрити" style="background: transparent; border: none; font-size: 24px; color: #94A3B8; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 6px; transition: color 0.15s;">&times;</button>
        </div>
        
        <!-- Body (internally scrollable) -->
        <div class="portal-modal-body" style="padding: 24px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 20px; background: #0E1526; color: #F8FAFC;">
            
            <!-- Rule Name -->
            <div class="portal-form-group" style="display: flex; flex-direction: column; gap: 6px;">
                <label style="display: block; font-weight: 600; font-size: 0.85rem; color: #94A3B8;">Назва правила</label>
                <input type="text" id="arb-name" class="portal-input" value="\${name}" placeholder="Наприклад: Авто-сповіщення при зміні етапу" style="width: 100%; background: #141C31 !important; color: #F8FAFC !important; border: 1px solid rgba(148, 163, 184, 0.2) !important; border-radius: 8px; padding: 10px 14px; font-size: 0.9rem;">
            </div>
            
            <!-- Trigger & Scope Row -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
                <div class="portal-form-group" style="display: flex; flex-direction: column; gap: 6px;">
                    <label style="display: block; font-weight: 600; font-size: 0.85rem; color: #94A3B8;">Тригер події</label>
                    <select id="arb-trigger" class="portal-input" style="width: 100%; background: #141C31 !important; color: #F8FAFC !important; border: 1px solid rgba(148, 163, 184, 0.2) !important; border-radius: 8px; padding: 10px 14px; font-size: 0.9rem;">
                        <option value="stage_started" \${trigger === 'stage_started' ? 'selected' : ''}>\${dict["stage_started"]}</option>
                        <option value="stage_completed" \${trigger === 'stage_completed' ? 'selected' : ''}>\${dict["stage_completed"]}</option>
                        <option value="client_action_added" \${trigger === 'client_action_added' ? 'selected' : ''}>\${dict["client_action_added"]}</option>
                        <option value="client_action_completed" \${trigger === 'client_action_completed' ? 'selected' : ''}>\${dict["client_action_completed"]}</option>
                        <option value="test_event" \${trigger === 'test_event' ? 'selected' : ''}>\${dict["test_event"]}</option>
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
                    <span style="font-weight: 600; font-size: 0.9rem; color: #F8FAFC;">Активне</span>
                </label>
            </div>
            
            <!-- Conditions Card -->
            <div style="background: #111827; border: 1px solid rgba(148, 163, 184, 0.15); border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: #F8FAFC; display: flex; align-items: center; gap: 8px;">
                        <span>Умови</span>
                    </h3>
                    <button type="button" class="btn btn-sm btn-outline" id="arb-add-condition" style="color: #60A5FA; border-color: rgba(96, 165, 250, 0.3); background: rgba(59, 130, 246, 0.08); font-weight: 600; font-size: 0.82rem; padding: 6px 12px; border-radius: 6px; cursor: pointer;">+ Додати умову</button>
                </div>
                <div id="arb-conditions-list" style="display: flex; flex-direction: column; gap: 8px;">
                    <!-- conditions items -->
                </div>
                <div id="arb-empty-cond" style="color: #64748B; font-size: 0.85rem; padding: 6px 0; font-style: italic; display: none;">Умов не додано (правило спрацьовуватиме при кожному настанні тригера)</div>
            </div>

            <!-- Actions Card -->
            <div style="background: #111827; border: 1px solid rgba(148, 163, 184, 0.15); border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: #F8FAFC; display: flex; align-items: center; gap: 8px;">
                        <span>Дії</span>
                    </h3>
                    <button type="button" class="btn btn-sm btn-outline" id="arb-add-action" style="color: #60A5FA; border-color: rgba(96, 165, 250, 0.3); background: rgba(59, 130, 246, 0.08); font-weight: 600; font-size: 0.82rem; padding: 6px 12px; border-radius: 6px; cursor: pointer;">+ Додати дію</button>
                </div>
                <div id="arb-actions-list" style="display: flex; flex-direction: column; gap: 8px;">
                    <!-- actions items -->
                </div>
                <div id="arb-empty-act" style="color: #64748B; font-size: 0.85rem; padding: 6px 0; font-style: italic; display: none;">Дій не додано</div>
            </div>
            
            <div id="arb-error-msg" style="color: #EF4444; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; padding: 10px 14px; display: none; font-size: 0.88rem; font-weight: 500;"></div>
            
        </div>
        
        <!-- Footer -->
        <div class="portal-modal-footer" style="display: flex; justify-content: flex-end; align-items: center; gap: 12px; padding: 16px 24px; border-top: 1px solid rgba(148, 163, 184, 0.15); background: rgba(5, 8, 15, 0.6); flex-shrink: 0;">
            <button type="button" class="btn btn-outline btn-modal-close" style="color: #94A3B8; border-color: rgba(148, 163, 184, 0.3); min-width: 100px; padding: 8px 16px; border-radius: 8px; cursor: pointer;">Скасувати</button>
            <button type="button" class="btn btn-primary" id="arb-save-btn" style="background: #3B82F6; color: #FFFFFF; font-weight: 600; min-width: 120px; padding: 8px 18px; border-radius: 8px; border: none; cursor: pointer;">Зберегти</button>
        </div>
    </div>
    \`;
    
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    
    // Close handlers
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
    
    // Condition elements & helpers
    const condList = document.getElementById("arb-conditions-list");
    const emptyCond = document.getElementById("arb-empty-cond");
    
    function updateCondEmptyState() {
        if (condList.children.length === 0) {
            emptyCond.style.display = "block";
        } else {
            emptyCond.style.display = "none";
        }
    }
    
    function renderCondition(c) {
        const div = document.createElement("div");
        div.style.cssText = "display: flex; gap: 8px; align-items: center; background: #141C31; border: 1px solid rgba(148, 163, 184, 0.15); border-radius: 8px; padding: 8px 10px;";
        div.innerHTML = \`
            <input type="text" class="portal-input cond-field" placeholder="Поле (напр. stage_id)" value="\${c.field || ''}" style="flex: 1; min-width: 100px; background: #0E1526 !important; color: #F8FAFC !important; border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 6px; padding: 8px 10px; font-size: 0.85rem;">
            <select class="portal-input cond-op" style="width: 140px; background: #0E1526 !important; color: #F8FAFC !important; border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 6px; padding: 8px 10px; font-size: 0.85rem;">
                <option value="equals" \${c.operator === 'equals' ? 'selected' : ''}>Дорівнює (==)</option>
                <option value="not_equals" \${c.operator === 'not_equals' ? 'selected' : ''}>Не дорівнює (!=)</option>
                <option value="contains" \${c.operator === 'contains' ? 'selected' : ''}>Містить</option>
                <option value="greater_than" \${c.operator === 'greater_than' ? 'selected' : ''}>Більше (&gt;)</option>
            </select>
            <input type="text" class="portal-input cond-val" placeholder="Значення" value="\${c.value || ''}" style="flex: 1; min-width: 100px; background: #0E1526 !important; color: #F8FAFC !important; border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 6px; padding: 8px 10px; font-size: 0.85rem;">
            <button type="button" class="btn btn-sm btn-outline btn-del-cond" style="color: #F87171; border-color: rgba(248, 113, 113, 0.3); background: rgba(239, 68, 68, 0.1); padding: 7px 12px; border-radius: 6px; cursor: pointer; font-size: 0.82rem; white-space: nowrap;">Видалити</button>
        \`;
        div.querySelector(".btn-del-cond").addEventListener("click", () => {
            div.remove();
            updateCondEmptyState();
        });
        condList.appendChild(div);
        updateCondEmptyState();
    }
    
    // Action elements & helpers
    const actList = document.getElementById("arb-actions-list");
    const emptyAct = document.getElementById("arb-empty-act");
    
    function updateActEmptyState() {
        if (actList.children.length === 0) {
            emptyAct.style.display = "block";
        } else {
            emptyAct.style.display = "none";
        }
    }
    
    function renderAction(a) {
        const div = document.createElement("div");
        div.style.cssText = "display: flex; gap: 8px; align-items: center; background: #141C31; border: 1px solid rgba(148, 163, 184, 0.15); border-radius: 8px; padding: 8px 10px;";
        div.innerHTML = \`
            <select class="portal-input act-type" style="width: 220px; background: #0E1526 !important; color: #F8FAFC !important; border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 6px; padding: 8px 10px; font-size: 0.85rem;">
                <option value="notify_owner" \${a.type === 'notify_owner' ? 'selected' : ''}>Сповістити власника (notify_owner)</option>
                <option value="create_task" \${a.type === 'create_task' ? 'selected' : ''}>Створити завдання (create_task)</option>
                <option value="webhook" \${a.type === 'webhook' ? 'selected' : ''}>Вебхук (webhook)</option>
                <option value="update_project_health" \${a.type === 'update_project_health' ? 'selected' : ''}>Оновити стан проєкту</option>
            </select>
            <input type="text" class="portal-input act-payload" placeholder='Payload JSON (наприклад: {"title": "..."})' value="\${a.payload ? JSON.stringify(a.payload).replace(/"/g, '&quot;') : '{}'}" style="flex: 1; min-width: 120px; background: #0E1526 !important; color: #F8FAFC !important; border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 6px; padding: 8px 10px; font-family: monospace; font-size: 0.82rem;">
            <button type="button" class="btn btn-sm btn-outline btn-del-act" style="color: #F87171; border-color: rgba(248, 113, 113, 0.3); background: rgba(239, 68, 68, 0.1); padding: 7px 12px; border-radius: 6px; cursor: pointer; font-size: 0.82rem; white-space: nowrap;">Видалити</button>
        \`;
        div.querySelector(".btn-del-act").addEventListener("click", () => {
            div.remove();
            updateActEmptyState();
        });
        actList.appendChild(div);
        updateActEmptyState();
    }
    
    if (conditions.length > 0) {
        conditions.forEach(renderCondition);
    } else {
        updateCondEmptyState();
    }
    
    if (actions.length > 0) {
        actions.forEach(renderAction);
    } else {
        updateActEmptyState();
    }
    
    document.getElementById("arb-add-condition").addEventListener("click", () => {
        renderCondition({ field: "", operator: "equals", value: "" });
    });
    document.getElementById("arb-add-action").addEventListener("click", () => {
        renderAction({ type: "notify_owner", payload: {} });
    });
    
    // Save logic
    document.getElementById("arb-save-btn").addEventListener("click", async () => {
        const errMsg = document.getElementById("arb-error-msg");
        errMsg.style.display = "none";
        
        const finalName = document.getElementById("arb-name").value.trim();
        if (!finalName) {
            errMsg.innerText = "Назва правила обов'язкова.";
            errMsg.style.display = "block";
            return;
        }
        
        const finalTrigger = document.getElementById("arb-trigger").value;
        const finalActive = document.getElementById("arb-active").checked;
        const sType = document.getElementById("arb-scope-type").value;
        let pId = null;
        let tId = null;
        if (sType === "project") {
            pId = scopeProj.value;
            if (!pId) { errMsg.innerText = "Оберіть проєкт."; errMsg.style.display = "block"; return; }
        } else if (sType === "template") {
            tId = scopeTemp.value;
            if (!tId) { errMsg.innerText = "Оберіть шаблон."; errMsg.style.display = "block"; return; }
        }
        
        const finalConds = Array.from(condList.children).map(div => {
            const f = div.querySelector(".cond-field");
            const o = div.querySelector(".cond-op");
            const v = div.querySelector(".cond-val");
            if (!f || !o || !v) return null;
            return {
                field: f.value.trim(),
                operator: o.value,
                value: v.value.trim()
            };
        }).filter(c => c && c.field);
        
        let parseErr = false;
        const finalActs = Array.from(actList.children).map(div => {
            const t = div.querySelector(".act-type");
            const p = div.querySelector(".act-payload");
            if (!t || !p) return null;
            const type = t.value;
            let payload = {};
            try {
                payload = JSON.parse(p.value.trim() || "{}");
            } catch(e) {
                parseErr = true;
            }
            return { type, payload };
        }).filter(a => a !== null);
        
        if (parseErr) {
            errMsg.innerText = "Помилка формату JSON у полі Payload.";
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
            
            // Reload the global list automatically!
            if (window.loadGlobalAutomationData) {
                await window.loadGlobalAutomationData();
            }
            
        } catch (err) {
            errMsg.innerText = "Помилка бази даних: " + (err.message || JSON.stringify(err));
            errMsg.style.display = "block";
            document.getElementById("arb-save-btn").innerText = "Зберегти";
            document.getElementById("arb-save-btn").disabled = false;
        }
    });
}
`;

fs.writeFileSync('js/portal/ui/portal-rule-builder-ui.js', ruleBuilderCode, 'utf8');
console.log("Updated js/portal/ui/portal-rule-builder-ui.js successfully");
