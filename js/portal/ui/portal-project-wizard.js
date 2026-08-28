import { supabase } from "../api/supabase-client.js";
import { PortalAuth } from "../auth/auth-service.js";

export async function renderPortalWizard(templateId) {
    return `
        <div class="portal-modal-overlay" id="wizard-modal">
            <div class="portal-modal" style="width: 800px; max-width: 95vw;">
                <div class="portal-modal-header">
                    <h3>Створити проєкт із шаблону</h3>
                    <button class="btn btn-icon btn-close-wizard"><i data-lucide="x"></i></button>
                </div>
                <div class="portal-modal-body">
                    <!-- Step Indicator -->
                    <div class="wizard-steps" style="display: flex; gap: 8px; margin-bottom: 24px;">
                        <div class="step active" id="step-1">1. Клієнт</div>
                        <div class="step" id="step-2">2. Проєкт</div>
                        <div class="step" id="step-3">3. Команда & Фінанси</div>
                        <div class="step" id="step-4">4. Preview</div>
                    </div>
                    
                    <div id="wizard-content">Завантаження...</div>
                </div>
                <div class="portal-modal-footer" style="display: flex; justify-content: space-between;">
                    <button class="btn btn-outline" id="wizard-prev" style="display: none;">Назад</button>
                    <button class="btn btn-primary" id="wizard-next">Далі</button>
                    <button class="btn btn-primary" id="wizard-submit" style="display: none;">Створити проєкт</button>
                </div>
            </div>
        </div>
        <style>
            .wizard-steps .step { flex: 1; text-align: center; padding: 8px; background: var(--bg-card); border-radius: 4px; color: var(--text-secondary); }
            .wizard-steps .step.active { background: var(--color-primary); color: white; }
        </style>
    `;
}

export async function initPortalWizardEvents(templateId, onClose) {
    if (window.lucide) window.lucide.createIcons();

    let currentStep = 1;
    let template = null;
    let version = null;
    let organizations = [];
    let users = [];

    // Form state
    const state = {
        orgId: "",
        projectName: "",
        projectType: "",
        startDate: new Date().toISOString().substring(0, 10),
        targetDate: "",
        pmId: "",
        currency: "UAH",
        contractValue: 0
    };

    // Load data
    const [{ data: tData }, { data: orgData }, { data: uData }] = await Promise.all([
        supabase.from('project_templates').select('*, template_versions(*)').eq('id', templateId).single(),
        supabase.from('organizations').select('id, name').order('name'),
        supabase.from('profiles').select('id, full_name, global_role')
    ]);

    template = tData;
    version = template.template_versions.find(v => v.status === 'published');
    organizations = orgData || [];
    users = uData || [];

    if (!version) {
        alert("У цього шаблону немає опублікованої версії.");
        onClose();
        return;
    }

    state.projectName = `Новий: ${template.name}`;
    state.projectType = template.project_type;
    state.currency = template.default_currency || "UAH";
    if (template.estimated_duration_days) {
        const target = new Date();
        target.setDate(target.getDate() + template.estimated_duration_days);
        state.targetDate = target.toISOString().substring(0, 10);
    }

    const contentEl = document.getElementById("wizard-content");
    const prevBtn = document.getElementById("wizard-prev");
    const nextBtn = document.getElementById("wizard-next");
    const submitBtn = document.getElementById("wizard-submit");

    function renderStep() {
        document.querySelectorAll(".wizard-steps .step").forEach((el, idx) => {
            el.className = `step ${idx + 1 === currentStep ? 'active' : ''}`;
        });

        prevBtn.style.display = currentStep > 1 ? 'block' : 'none';
        nextBtn.style.display = currentStep < 4 ? 'block' : 'none';
        submitBtn.style.display = currentStep === 4 ? 'block' : 'none';

        if (currentStep === 1) {
            contentEl.innerHTML = `
                <div class="form-group">
                    <label>Організація / Клієнт</label>
                    <select class="form-input" id="wiz-org">
                        <option value="">-- Оберіть клієнта --</option>
                        ${organizations.map(o => `<option value="${o.id}" ${state.orgId === o.id ? 'selected' : ''}>${o.name}</option>`).join("")}
                    </select>
                </div>
            `;
        } else if (currentStep === 2) {
            contentEl.innerHTML = `
                <div class="form-group">
                    <label>Назва проєкту</label>
                    <input type="text" class="form-input" id="wiz-name" value="${state.projectName}">
                </div>
                <div class="form-group" style="display:flex; gap:16px;">
                    <div style="flex:1">
                        <label>Дата початку</label>
                        <input type="date" class="form-input" id="wiz-start" value="${state.startDate}">
                    </div>
                    <div style="flex:1">
                        <label>Орієнтовне завершення</label>
                        <input type="date" class="form-input" id="wiz-target" value="${state.targetDate}">
                    </div>
                </div>
            `;
        } else if (currentStep === 3) {
            const pms = users.filter(u => u.global_role === 'pm' || u.global_role === 'owner');
            contentEl.innerHTML = `
                <div class="form-group">
                    <label>Project Manager (PM Placeholder)</label>
                    <select class="form-input" id="wiz-pm">
                        <option value="">-- Призначити PM --</option>
                        ${pms.map(u => `<option value="${u.id}" ${state.pmId === u.id ? 'selected' : ''}>${u.full_name}</option>`).join("")}
                    </select>
                </div>
                <div class="form-group" style="display:flex; gap:16px;">
                    <div style="flex:1">
                        <label>Валюта</label>
                        <select class="form-input" id="wiz-curr">
                            <option value="UAH" ${state.currency==='UAH'?'selected':''}>UAH</option>
                            <option value="EUR" ${state.currency==='EUR'?'selected':''}>EUR</option>
                            <option value="CZK" ${state.currency==='CZK'?'selected':''}>CZK</option>
                        </select>
                    </div>
                    <div style="flex:1">
                        <label>Вартість контракту (опціонально)</label>
                        <input type="number" class="form-input" id="wiz-val" value="${state.contractValue}">
                    </div>
                </div>
            `;
        } else if (currentStep === 4) {
            contentEl.innerHTML = `
                <div class="alert alert-info">
                    <i data-lucide="info"></i>
                    <div>Буде згенеровано blueprint для клієнта. Всі дедлайни будуть розраховані відносно ${state.startDate}.</div>
                </div>
                <ul style="list-style: none; padding: 0; margin-top: 16px;">
                    <li><strong>Клієнт:</strong> ${organizations.find(o => o.id === state.orgId)?.name}</li>
                    <li><strong>Назва:</strong> ${state.projectName}</li>
                    <li><strong>Шаблон:</strong> ${template.name} (v${version.version_number})</li>
                </ul>
            `;
            if (window.lucide) window.lucide.createIcons();
        }
    }

    function saveStepData() {
        if (currentStep === 1) state.orgId = document.getElementById("wiz-org")?.value || state.orgId;
        if (currentStep === 2) {
            state.projectName = document.getElementById("wiz-name")?.value || state.projectName;
            state.startDate = document.getElementById("wiz-start")?.value || state.startDate;
            state.targetDate = document.getElementById("wiz-target")?.value || state.targetDate;
        }
        if (currentStep === 3) {
            state.pmId = document.getElementById("wiz-pm")?.value || state.pmId;
            state.currency = document.getElementById("wiz-curr")?.value || state.currency;
            state.contractValue = document.getElementById("wiz-val")?.value || state.contractValue;
        }
    }

    renderStep();

    document.querySelector(".btn-close-wizard").addEventListener("click", onClose);
    
    prevBtn.addEventListener("click", () => {
        saveStepData();
        if (currentStep > 1) { currentStep--; renderStep(); }
    });

    nextBtn.addEventListener("click", () => {
        saveStepData();
        if (currentStep === 1 && !state.orgId) return alert("Оберіть організацію");
        if (currentStep === 2 && !state.projectName) return alert("Вкажіть назву");
        if (currentStep < 4) { currentStep++; renderStep(); }
    });

    submitBtn.addEventListener("click", async () => {
        submitBtn.disabled = true;
        submitBtn.innerHTML = "Створення...";
        
        try {
            const idempotencyKey = "idem-" + Date.now() + "-" + Math.random().toString(36).substring(7);
            
            const payload = {
                p_template_version_id: version.id,
                p_organization_id: state.orgId,
                p_name: state.projectName,
                p_project_type: state.projectType,
                p_start_date: state.startDate,
                p_target_date: state.targetDate || state.startDate,
                p_team_assignments: { pm: state.pmId || null },
                p_commercials: { currency: state.currency, contract_value: parseFloat(state.contractValue || 0) * 100 },
                p_idempotency_key: idempotencyKey
            };

            const { data, error } = await supabase.rpc('create_project_from_template', payload);
            if (error) throw error;
            if (!data.success) throw new Error(data.error);

            alert("Проєкт успішно створено!");
            onClose();
            window.location.hash = `#/portal/projects/${data.project_id}`;
        } catch (e) {
            alert("Помилка: " + e.message);
            submitBtn.disabled = false;
            submitBtn.innerHTML = "Створити проєкт";
        }
    });
}
