import { getSupabase } from "../api/supabase-client.js";
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
    
    // Create modal container
    const modalId = "automation-rule-modal";
    let modal = document.getElementById(modalId);
    if (modal) modal.remove();
    
    modal = document.createElement("div");
    modal.id = modalId;
    modal.className = "portal-modal";
    modal.style.display = "flex";
    
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
            name = data.name;
            trigger = data.trigger_event;
            isActive = data.is_active;
            conditions = data.conditions || [];
            actions = data.actions || [];
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
            alert("Помилка завантаження правила: " + (error?.message || "Unknown error"));
            return;
        }
    }
    
    // We need projects and templates for scope selection
    let orgId = PortalAuth.getUser()?.user_metadata?.org_id || PortalAuth.getProfile()?.organization_id;
    if (!orgId) {
        const u = await supabase.auth.getUser();
        if(u.data?.user?.id) {
            
            
        }
    }
    if(!orgId) {
        const orgReq = await supabase.from("organizations").select("id").limit(1).single();
        if(orgReq.data) orgId = orgReq.data.id;
        else orgId = "mock-org"; 
        console.log("Fetched orgId builder:", orgId);
    }
    let projectsHtml = `<option value="">-- Оберіть проєкт --</option>`;
    let templatesHtml = `<option value="">-- Оберіть шаблон --</option>`;
    
    try {
        const { data: pData } = await supabase.from('projects').select('id, name').eq('organization_id', orgId);
        if (pData) pData.forEach(p => { projectsHtml += `<option value="${p.id}" ${scopeId === p.id ? 'selected' : ''}>${p.name}</option>`; });
        
        const { data: tData } = await supabase.from('project_templates').select('id, name').eq('organization_id', orgId);
        if (tData) tData.forEach(t => { templatesHtml += `<option value="${t.id}" ${scopeId === t.id ? 'selected' : ''}>${t.name}</option>`; });
    } catch (e) {
        console.error("Failed to load scope entities:", e);
    }

    const html = `
    <div class="portal-modal-content" style="max-width: 800px; width: 100%; max-height: 90vh; overflow-y: auto;">
        <div class="portal-modal-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid #e2e8f0; padding-bottom:12px; margin-bottom: 16px;">
            <h2 class="portal-modal-title">${isEditing ? 'Редагувати правило' : 'Створити правило автоматизації'}</h2>
            <button class="btn btn-icon btn-modal-close" style="background:none; border:none; font-size: 20px; cursor:pointer;">&times;</button>
        </div>
        
        <div class="portal-form-group" style="margin-bottom: 16px;">
            <label style="display:block; font-weight:500; margin-bottom:4px;">Назва правила</label>
            <input type="text" id="arb-name" class="portal-input" value="${name}" placeholder="Наприклад: Авто-сповіщення при зміні етапу" style="width:100%;">
        </div>
        
        <div style="display:flex; gap:16px; margin-bottom:16px;">
            <div class="portal-form-group" style="flex:1;">
                <label style="display:block; font-weight:500; margin-bottom:4px;">Тригер події</label>
                <select id="arb-trigger" class="portal-input" style="width:100%;">
                    <option value="stage_started" ${trigger === 'stage_started' ? 'selected' : ''}>${dict["stage_started"]}</option>
                    <option value="stage_completed" ${trigger === 'stage_completed' ? 'selected' : ''}>${dict["stage_completed"]}</option>
                    <option value="client_action_added" ${trigger === 'client_action_added' ? 'selected' : ''}>${dict["client_action_added"]}</option>
                    <option value="client_action_completed" ${trigger === 'client_action_completed' ? 'selected' : ''}>${dict["client_action_completed"]}</option>
                    <option value="test_event" ${trigger === 'test_event' ? 'selected' : ''}>${dict["test_event"]}</option>
                </select>
            </div>
            
            <div class="portal-form-group" style="flex:1;">
                <label style="display:block; font-weight:500; margin-bottom:4px;">Scope (Область дії)</label>
                <select id="arb-scope-type" class="portal-input" style="width:100%;">
                    <option value="global" ${scopeType === 'global' ? 'selected' : ''}>Глобально (всі)</option>
                    <option value="project" ${scopeType === 'project' ? 'selected' : ''}>Конкретний Проєкт</option>
                    <option value="template" ${scopeType === 'template' ? 'selected' : ''}>Конкретний Шаблон</option>
                </select>
            </div>
            
            <div class="portal-form-group" id="arb-scope-id-wrapper" style="flex:1; display:${scopeType === 'global' ? 'none' : 'block'};">
                <label style="display:block; font-weight:500; margin-bottom:4px;">Обрати об'єкт</label>
                <select id="arb-scope-project" class="portal-input" style="width:100%; display:${scopeType === 'project' ? 'block' : 'none'};">
                    ${projectsHtml}
                </select>
                <select id="arb-scope-template" class="portal-input" style="width:100%; display:${scopeType === 'template' ? 'block' : 'none'};">
                    ${templatesHtml}
                </select>
            </div>
        </div>
        
        <div class="portal-form-group" style="margin-bottom: 16px;">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" id="arb-active" ${isActive ? 'checked' : ''}>
                <span style="font-weight:500;">Активне (Active)</span>
            </label>
        </div>
        
        <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin-bottom: 16px; background: #f8fafc;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
                <h3 style="margin:0; font-size:14px;">Умови (Conditions)</h3>
                <button type="button" class="btn btn-sm btn-outline" id="arb-add-condition">+ Додати умову</button>
            </div>
            <div id="arb-conditions-list">
                <!-- conditions dynamically added here -->
            </div>
        </div>

        <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin-bottom: 24px; background: #f8fafc;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
                <h3 style="margin:0; font-size:14px;">Дії (Actions)</h3>
                <button type="button" class="btn btn-sm btn-outline" id="arb-add-action">+ Додати дію</button>
            </div>
            <div id="arb-actions-list">
                <!-- actions dynamically added here -->
            </div>
        </div>
        
        <div id="arb-error-msg" style="color:var(--color-danger); margin-bottom: 16px; display:none; font-size:13px;"></div>
        
        <div class="portal-modal-footer" style="display:flex; justify-content:flex-end; gap:12px; border-top: 1px solid #e2e8f0; padding-top:16px;">
            <button class="btn btn-outline btn-modal-close" style="width: 100px;">Скасувати</button>
            <button class="btn btn-primary" id="arb-save-btn" style="width: 120px;">Зберегти</button>
        </div>
    </div>
    `;
    
    modal.innerHTML = html;
    document.body.appendChild(modal);
    
    // Close handlers
    modal.querySelectorAll(".btn-modal-close").forEach(btn => {
        btn.addEventListener("click", () => modal.remove());
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
            scopeWrapper.style.display = "block";
            scopeProj.style.display = val === "project" ? "block" : "none";
            scopeTemp.style.display = val === "template" ? "block" : "none";
        }
    });
    
    // Helper to render conditions
    const condList = document.getElementById("arb-conditions-list");
    function renderCondition(c) {
        const div = document.createElement("div");
        div.style.display = "flex";
        div.style.gap = "8px";
        div.style.marginBottom = "8px";
        div.innerHTML = `
            <input type="text" class="portal-input cond-field" placeholder="Поле (напр. stage_id)" value="${c.field || ''}" style="flex:1;">
            <select class="portal-input cond-op" style="width: 120px;">
                <option value="equals" ${c.operator === 'equals' ? 'selected' : ''}>==</option>
                <option value="not_equals" ${c.operator === 'not_equals' ? 'selected' : ''}>!=</option>
                <option value="contains" ${c.operator === 'contains' ? 'selected' : ''}>Містить</option>
                <option value="greater_than" ${c.operator === 'greater_than' ? 'selected' : ''}>&gt;</option>
            </select>
            <input type="text" class="portal-input cond-val" placeholder="Значення" value="${c.value || ''}" style="flex:1;">
            <button class="btn btn-sm btn-outline" style="color:var(--color-danger); border-color:var(--color-danger);" onclick="this.parentElement.remove()">Видалити</button>
        `;
        condList.appendChild(div);
    }
    
    // Helper to render actions
    const actList = document.getElementById("arb-actions-list");
    function renderAction(a) {
        const div = document.createElement("div");
        div.style.display = "flex";
        div.style.gap = "8px";
        div.style.marginBottom = "8px";
        div.innerHTML = `
            <select class="portal-input act-type" style="width: 200px;">
                <option value="notify_owner" ${a.type === 'notify_owner' ? 'selected' : ''}>notify_owner</option>
                <option value="create_task" ${a.type === 'create_task' ? 'selected' : ''}>create_task</option>
                <option value="webhook" ${a.type === 'webhook' ? 'selected' : ''}>webhook</option>
                <option value="update_project_health" ${a.type === 'update_project_health' ? 'selected' : ''}>update_project_health</option>
            </select>
            <input type="text" class="portal-input act-payload" placeholder="Payload (JSON)" value="${a.payload ? JSON.stringify(a.payload).replace(/"/g, '&quot;') : '{}'}" style="flex:1;">
            <button class="btn btn-sm btn-outline" style="color:var(--color-danger); border-color:var(--color-danger);" onclick="this.parentElement.remove()">Видалити</button>
        `;
        actList.appendChild(div);
    }
    
    conditions.forEach(renderCondition);
    actions.forEach(renderAction);
    
    document.getElementById("arb-add-condition").addEventListener("click", () => renderCondition({ field: "", operator: "equals", value: "" }));
    document.getElementById("arb-add-action").addEventListener("click", () => renderAction({ type: "notify_owner", payload: {} }));
    
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
            if(!pId) { errMsg.innerText = "Оберіть проєкт."; errMsg.style.display = "block"; return; }
        } else if (sType === "template") {
            tId = scopeTemp.value;
            if(!tId) { errMsg.innerText = "Оберіть шаблон."; errMsg.style.display = "block"; return; }
        }
        
        const finalConds = Array.from(condList.children).map(div => {
            return {
                field: div.querySelector(".cond-field").value.trim(),
                operator: div.querySelector(".cond-op").value,
                value: div.querySelector(".cond-val").value.trim()
            };
        }).filter(c => c.field);
        
        let parseErr = false;
        const finalActs = Array.from(actList.children).map(div => {
            const type = div.querySelector(".act-type").value;
            let payload = {};
            try {
                payload = JSON.parse(div.querySelector(".act-payload").value.trim() || "{}");
            } catch(e) {
                parseErr = true;
            }
            return { type, payload };
        });
        
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
            
            modal.remove();
            
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
