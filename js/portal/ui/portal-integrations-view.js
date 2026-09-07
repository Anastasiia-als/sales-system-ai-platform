import { DataClient } from "../api/data-client.js";
import { PortalAuth } from "../auth/auth-service.js";
import { PortalState } from "../state/portal-state.js";

function escapeHtml(str) {
    return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

let transientSecret = null;

export function renderIntegrationsView() {
    return `
        <div class="portal-content">
            <div class="portal-view-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <div class="portal-view-title-group">
                    <h1 class="portal-view-title">Інтеграції та Webhooks</h1>
                    <p class="portal-view-subtitle">Керування вихідними вебхуками, HMAC-SHA256 автентифікацією та журналом доставок</p>
                </div>
                <button class="btn btn-primary" id="btn-create-webhook">
                    <i data-lucide="plus"></i> Додати Webhook
                </button>
            </div>

            <!-- Organization Context Bar -->
            <div class="portal-card" style="padding: 12px 16px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <label for="integrations-org-select" style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary);">Організація / Клієнт:</label>
                    <select id="integrations-org-select" class="portal-select" style="min-width: 240px;">
                        <option value="">Завантаження організацій...</option>
                    </select>
                </div>
                <div id="integrations-org-badge" style="font-size: 0.8rem; color: var(--text-muted);">Керування вебхуками обраної організації</div>
            </div>

            <!-- Tabs: Endpoints & Delivery Log -->
            <div class="portal-tabs" style="display: flex; gap: 12px; margin-bottom: 20px; border-bottom: 1px solid var(--border-color, #e2e8f0); padding-bottom: 8px;">
                <button class="btn btn-sm btn-outline active" id="tab-btn-endpoints">
                    <i data-lucide="webhook"></i> Кінцеві точки (Endpoints)
                </button>
                <button class="btn btn-sm btn-outline" id="tab-btn-deliveries">
                    <i data-lucide="activity"></i> Журнал доставок (Outbox)
                </button>
            </div>

            <!-- Endpoints Section -->
            <div id="section-endpoints" class="portal-card" style="margin-bottom: 24px;">
                <div class="portal-card-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <h2 class="portal-card-title">Налаштовані Webhooks</h2>
                    <button class="btn btn-sm btn-ghost" id="btn-refresh-endpoints" title="Оновити">
                        <i data-lucide="refresh-cw"></i>
                    </button>
                </div>
                <div class="portal-table-wrapper">
                    <table class="portal-table">
                        <thead>
                            <tr>
                                <th>Назва та опис</th>
                                <th>Цільовий URL (Masked)</th>
                                <th>Підписані події</th>
                                <th>Статус</th>
                                <th>Дата створення</th>
                                <th style="text-align: right;">Дії</th>
                            </tr>
                        </thead>
                        <tbody id="endpoints-table-body">
                            <tr>
                                <td colspan="6" style="text-align: center; padding: 24px;">
                                    <div class="portal-spinner" style="margin: 0 auto;"></div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Delivery Log Section -->
            <div id="section-deliveries" class="portal-card" style="display: none; margin-bottom: 24px;">
                <div class="portal-card-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <h2 class="portal-card-title">Журнал Outbox Доставок</h2>
                    <button class="btn btn-sm btn-ghost" id="btn-refresh-deliveries" title="Оновити">
                        <i data-lucide="refresh-cw"></i>
                    </button>
                </div>
                <div class="portal-table-wrapper">
                    <table class="portal-table">
                        <thead>
                            <tr>
                                <th>Час події</th>
                                <th>Тип події</th>
                                <th>Отримувач</th>
                                <th>Статус</th>
                                <th>Спроби</th>
                                <th>HTTP Код</th>
                                <th>Повідомлення</th>
                            </tr>
                        </thead>
                        <tbody id="deliveries-table-body">
                            <tr>
                                <td colspan="7" style="text-align: center; padding: 24px;">
                                    <div class="portal-spinner" style="margin: 0 auto;"></div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Create Webhook Modal -->
            <div id="modal-create-webhook" class="portal-modal-backdrop" style="display: none;">
                <div class="portal-modal" style="max-width: 540px;">
                    <div class="portal-modal-header">
                        <h3 class="portal-modal-title">Створити Webhook Endpoint</h3>
                        <button class="portal-modal-close" id="btn-close-create-modal">&times;</button>
                    </div>
                    <div class="portal-modal-body">
                        <div class="form-group" style="margin-bottom: 16px;">
                            <label class="form-label" for="wh-create-org">Організація / Клієнт *</label>
                            <select id="wh-create-org" class="portal-select" required></select>
                        </div>
                        <div class="form-group" style="margin-bottom: 16px;">
                            <label class="form-label" for="wh-name">Назва інтеграції *</label>
                            <input type="text" id="wh-name" class="portal-input" placeholder="e.g. ERP Webhook, Zapier / Make Relay" required>
                        </div>
                        <div class="form-group" style="margin-bottom: 16px;">
                            <label class="form-label" for="wh-url">Цільовий HTTPS URL *</label>
                            <input type="url" id="wh-url" class="portal-input" placeholder="https://api.yourdomain.com/webhooks" required>
                            <span class="form-hint" style="font-size: 0.75rem; color: var(--text-muted);">
                                Повинен використовувати HTTPS протокол. URL зберігається у захищеному Supabase Vault.
                            </span>
                        </div>
                        <div class="form-group" style="margin-bottom: 16px;">
                            <label class="form-label" for="wh-desc">Опис (необов'язково)</label>
                            <input type="text" id="wh-desc" class="portal-input" placeholder="Коротке призначення кінцевої точки">
                        </div>
                        <div class="form-group" style="margin-bottom: 16px;">
                            <label class="form-label">Підписка на події</label>
                            <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 6px;">
                                <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer;">
                                    <input type="checkbox" id="wh-evt-all" value="*" checked>
                                    <strong>Всі події (*)</strong>
                                </label>
                                <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer;">
                                    <input type="checkbox" class="wh-evt-item" value="task.completed">
                                    <span>Завдання виконано (task.completed)</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer;">
                                    <input type="checkbox" class="wh-evt-item" value="stage.completed">
                                    <span>Етап завершено (stage.completed)</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer;">
                                    <input type="checkbox" class="wh-evt-item" value="document.approved">
                                    <span>Документ погоджено (document.approved)</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer;">
                                    <input type="checkbox" class="wh-evt-item" value="client_action.completed">
                                    <span>Дію клієнта виконано (client_action.completed)</span>
                                </label>
                            </div>
                        </div>
                        <div id="create-wh-error" style="color: var(--color-danger, #ef4444); font-size: 0.85rem; margin-top: 8px; display: none;"></div>
                    </div>
                    <div class="portal-modal-footer">
                        <button class="btn btn-ghost" id="btn-cancel-create-wh">Скасувати</button>
                        <button class="btn btn-primary" id="btn-submit-create-wh">Створити та згенерувати секрет</button>
                    </div>
                </div>
            </div>

            <!-- One-Time Secret Reveal Modal -->
            <div id="modal-webhook-secret-reveal" class="portal-modal-backdrop" style="display: none;">
                <div class="portal-modal" style="max-width: 520px;">
                    <div class="portal-modal-header">
                        <h3 class="portal-modal-title" style="color: var(--color-success, #10b981);">Секрет Webhook згенеровано</h3>
                        <button class="portal-modal-close" id="btn-close-secret-modal">&times;</button>
                    </div>
                    <div class="portal-modal-body">
                        <div class="portal-alert portal-alert-warning" style="margin-bottom: 16px; padding: 12px; border-radius: 6px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3);">
                            <strong style="color: #d97706;">Увага: Одноразовий показ секрету!</strong>
                            <p style="margin: 6px 0 0 0; font-size: 0.85rem; color: var(--text-color);">
                                Цей ключ автентифікації HMAC-SHA256 зберігається у захищеному сховищі Vault і більше ніколи не буде показаний відкритим текстом. Скопіюйте його зараз.
                            </p>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Signing Secret (HMAC-SHA256)</label>
                            <div style="display: flex; gap: 8px;">
                                <input type="text" id="wh-revealed-secret" class="portal-input" readonly style="font-family: monospace; font-size: 0.9rem;">
                                <button class="btn btn-outline" id="btn-copy-wh-secret" title="Скопіювати">
                                    <i data-lucide="copy"></i>
                                </button>
                            </div>
                            <span id="wh-copy-status" style="display: none; color: var(--color-success, #10b981); font-size: 0.8rem; margin-top: 4px;">Скопійовано в буфер!</span>
                        </div>
                    </div>
                    <div class="portal-modal-footer">
                        <button class="btn btn-primary" id="btn-dismiss-secret-modal">Я зберіг секрет</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

let currentOrgId = null;
let accessibleOrgs = [];

async function resolveOrganizationContext() {
    // 1. Check if PortalState already has organizations loaded
    if (PortalState.organizations && PortalState.organizations.length > 0) {
        accessibleOrgs = PortalState.organizations;
    } else {
        // 2. Fetch via authoritative DataClient.getOrganizations()
        const { data: orgs, error: orgsErr } = await DataClient.getOrganizations();
        if (!orgsErr && orgs && orgs.length > 0) {
            accessibleOrgs = orgs;
            PortalState.organizations = orgs;
        } else {
            // 3. Fallback to active memberships if available
            const memberships = PortalAuth.getMemberships();
            if (memberships && memberships.length > 0) {
                accessibleOrgs = memberships
                    .filter(m => m.is_active && m.organizations)
                    .map(m => m.organizations);
            }
        }
    }

    if (accessibleOrgs.length === 0) {
        return null;
    }

    // Determine current active organization
    if (PortalState.currentOrganization?.id && accessibleOrgs.some(o => o.id === PortalState.currentOrganization.id)) {
        currentOrgId = PortalState.currentOrganization.id;
    } else {
        const memberships = PortalAuth.getMemberships();
        const memberOrg = memberships?.find(m => m.is_active && accessibleOrgs.some(o => o.id === m.organization_id));
        if (memberOrg) {
            currentOrgId = memberOrg.organization_id;
        } else {
            currentOrgId = accessibleOrgs[0].id;
        }
    }

    PortalState.currentOrganization = accessibleOrgs.find(o => o.id === currentOrgId) || accessibleOrgs[0];
    return currentOrgId;
}

export async function initIntegrationsViewEvents() {
    if (window.lucide) window.lucide.createIcons();

    const resolvedOrgId = await resolveOrganizationContext();
    const orgSelect = document.getElementById("integrations-org-select");

    if (!resolvedOrgId || accessibleOrgs.length === 0) {
        if (orgSelect) {
            orgSelect.innerHTML = `<option value="">Немає доступних організацій</option>`;
            orgSelect.disabled = true;
        }
        const tbody = document.getElementById("endpoints-table-body");
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 32px; color: var(--text-muted);">
                        Не знайдено доступних організацій для налаштування вебхуків.
                    </td>
                </tr>
            `;
        }
        return;
    }

    // Populate Organization Switcher in header
    if (orgSelect) {
        orgSelect.innerHTML = accessibleOrgs.map(o => `
            <option value="${o.id}" ${o.id === currentOrgId ? "selected" : ""}>
                ${escapeHtml(o.name || "Організація")}
            </option>
        `).join("");

        orgSelect.addEventListener("change", async (e) => {
            currentOrgId = e.target.value;
            const chosen = accessibleOrgs.find(o => o.id === currentOrgId);
            if (chosen) {
                PortalState.currentOrganization = chosen;
            }
            const createOrgSelect = document.getElementById("wh-create-org");
            if (createOrgSelect) createOrgSelect.value = currentOrgId;

            const isDeliveriesActive = document.getElementById("tab-btn-deliveries")?.classList.contains("active");
            if (isDeliveriesActive) {
                await loadDeliveries(currentOrgId);
            } else {
                await loadEndpoints(currentOrgId);
            }
        });
    }

    // Populate Organization in Create Modal
    const createOrgSelect = document.getElementById("wh-create-org");
    if (createOrgSelect) {
        createOrgSelect.innerHTML = accessibleOrgs.map(o => `
            <option value="${o.id}" ${o.id === currentOrgId ? "selected" : ""}>
                ${escapeHtml(o.name || "Організація")}
            </option>
        `).join("");
    }

    // Tab Switching
    const tabEndpoints = document.getElementById("tab-btn-endpoints");
    const tabDeliveries = document.getElementById("tab-btn-deliveries");
    const secEndpoints = document.getElementById("section-endpoints");
    const secDeliveries = document.getElementById("section-deliveries");

    tabEndpoints?.addEventListener("click", () => {
        tabEndpoints.classList.add("active");
        tabDeliveries?.classList.remove("active");
        if (secEndpoints) secEndpoints.style.display = "block";
        if (secDeliveries) secDeliveries.style.display = "none";
        loadEndpoints(currentOrgId);
    });

    tabDeliveries?.addEventListener("click", () => {
        tabDeliveries.classList.add("active");
        tabEndpoints?.classList.remove("active");
        if (secEndpoints) secEndpoints.style.display = "none";
        if (secDeliveries) secDeliveries.style.display = "block";
        loadDeliveries(currentOrgId);
    });

    // Refresh buttons
    document.getElementById("btn-refresh-endpoints")?.addEventListener("click", () => loadEndpoints(currentOrgId));
    document.getElementById("btn-refresh-deliveries")?.addEventListener("click", () => loadDeliveries(currentOrgId));

    // Create Modal handling
    const modalCreate = document.getElementById("modal-create-webhook");
    const btnCreate = document.getElementById("btn-create-webhook");
    const btnCloseCreate = document.getElementById("btn-close-create-modal");
    const btnCancelCreate = document.getElementById("btn-cancel-create-wh");
    const btnSubmitCreate = document.getElementById("btn-submit-create-wh");
    const errBox = document.getElementById("create-wh-error");

    btnCreate?.addEventListener("click", () => {
        if (modalCreate) modalCreate.style.display = "flex";
        if (errBox) errBox.style.display = "none";
        const cOrg = document.getElementById("wh-create-org");
        if (cOrg && currentOrgId) cOrg.value = currentOrgId;
        const nameInput = document.getElementById("wh-name");
        const urlInput = document.getElementById("wh-url");
        const descInput = document.getElementById("wh-desc");
        if (nameInput) nameInput.value = "";
        if (urlInput) urlInput.value = "";
        if (descInput) descInput.value = "";
    });

    const hideCreateModal = () => {
        if (modalCreate) modalCreate.style.display = "none";
    };
    btnCloseCreate?.addEventListener("click", hideCreateModal);
    btnCancelCreate?.addEventListener("click", hideCreateModal);

    // Event checkboxes logic: '*' unchecks others, others uncheck '*'
    const chkAll = document.getElementById("wh-evt-all");
    const itemCheckboxes = document.querySelectorAll(".wh-evt-item");
    chkAll?.addEventListener("change", (e) => {
        if (e.target.checked) {
            itemCheckboxes.forEach(cb => cb.checked = false);
        }
    });
    itemCheckboxes.forEach(cb => {
        cb.addEventListener("change", () => {
            if (cb.checked && chkAll) chkAll.checked = false;
        });
    });

    // Submit Create Webhook
    btnSubmitCreate?.addEventListener("click", async () => {
        const chosenOrgId = document.getElementById("wh-create-org")?.value || currentOrgId;
        const name = document.getElementById("wh-name")?.value?.trim();
        const url = document.getElementById("wh-url")?.value?.trim();
        const desc = document.getElementById("wh-desc")?.value?.trim();

        if (!chosenOrgId) {
            showError("Оберіть організацію");
            return;
        }
        if (!name) {
            showError("Вкажіть назву Webhook");
            return;
        }
        if (!url) {
            showError("Вкажіть цільовий URL");
            return;
        }

        let eventTypes = [];
        if (chkAll?.checked) {
            eventTypes = ["*"];
        } else {
            itemCheckboxes.forEach(cb => {
                if (cb.checked) eventTypes.push(cb.value);
            });
            if (eventTypes.length === 0) eventTypes = ["*"];
        }

        btnSubmitCreate.disabled = true;
        btnSubmitCreate.innerText = "Створення...";

        try {
            const { data, error } = await DataClient.createIntegrationEndpoint({
                organizationId: chosenOrgId,
                name,
                description: desc,
                targetUrl: url,
                eventTypes
            });

            if (error) {
                showError(error.message || "Помилка при створенні Webhook");
                btnSubmitCreate.disabled = false;
                btnSubmitCreate.innerText = "Створити та згенерувати секрет";
                return;
            }

            hideCreateModal();
            await loadEndpoints(currentOrgId);

            // Show one-time secret modal
            if (data?.signing_secret) {
                revealSecret(data.signing_secret);
            }
        } catch (e) {
            showError(e.message || "Непередбачена помилка");
        } finally {
            btnSubmitCreate.disabled = false;
            btnSubmitCreate.innerText = "Створити та згенерувати секрет";
        }
    });

    function showError(msg) {
        if (errBox) {
            errBox.innerText = msg;
            errBox.style.display = "block";
        }
    }

    // Secret Reveal Modal handling
    const modalSecret = document.getElementById("modal-webhook-secret-reveal");
    const secretInput = document.getElementById("wh-revealed-secret");
    const btnCopySecret = document.getElementById("btn-copy-wh-secret");
    const copyStatus = document.getElementById("wh-copy-status");
    const btnCloseSecret = document.getElementById("btn-close-secret-modal");
    const btnDismissSecret = document.getElementById("btn-dismiss-secret-modal");

    function revealSecret(secret) {
        transientSecret = secret;
        if (secretInput) secretInput.value = secret;
        if (modalSecret) modalSecret.style.display = "flex";
        if (copyStatus) copyStatus.style.display = "none";
    }

    function dismissSecret() {
        transientSecret = null;
        if (secretInput) secretInput.value = "";
        if (modalSecret) modalSecret.style.display = "none";
    }

    btnCloseSecret?.addEventListener("click", dismissSecret);
    btnDismissSecret?.addEventListener("click", dismissSecret);

    btnCopySecret?.addEventListener("click", async () => {
        if (!transientSecret) return;
        try {
            await navigator.clipboard.writeText(transientSecret);
            if (copyStatus) {
                copyStatus.style.display = "inline";
                setTimeout(() => { copyStatus.style.display = "none"; }, 3000);
            }
        } catch (_e) {}
    });

    // Initial Load
    await loadEndpoints(currentOrgId);
}

async function loadEndpoints(orgId = currentOrgId) {
    const tbody = document.getElementById("endpoints-table-body");
    if (!tbody) return;

    if (!orgId) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 32px; color: var(--text-muted);">
                    Оберіть організацію для перегляду вебхуків.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = `
        <tr>
            <td colspan="6" style="text-align: center; padding: 24px;">
                <div class="portal-spinner" style="margin: 0 auto;"></div>
            </td>
        </tr>
    `;

    const { data: endpoints, error } = await DataClient.getIntegrationEndpoints(orgId);
    if (error || !endpoints || endpoints.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 32px; color: var(--text-muted);">
                    Немає налаштованих вебхуків. Натисніть «Додати Webhook», щоб створити першу точку інтеграції.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = endpoints.map(ep => {
        const eventsBadges = (ep.event_types || ["*"]).map(evt => 
            `<span class="badge badge-subtle" style="font-size: 0.75rem; margin-right: 4px;">${escapeHtml(evt)}</span>`
        ).join("");

        const statusBadge = ep.is_active
            ? `<span class="badge badge-success">Активний</span>`
            : `<span class="badge badge-neutral">Неактивний</span>`;

        const dateStr = ep.created_at ? new Date(ep.created_at).toLocaleDateString("uk-UA") : "—";

        return `
            <tr data-endpoint-id="${ep.id}">
                <td>
                    <div style="font-weight: 500;">${escapeHtml(ep.name)}</div>
                    ${ep.description ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(ep.description)}</div>` : ""}
                </td>
                <td>
                    <div style="font-family: monospace; font-size: 0.85rem; color: var(--text-color);">${escapeHtml(ep.url_masked)}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(ep.url_hostname)}</div>
                </td>
                <td>${eventsBadges}</td>
                <td>${statusBadge}</td>
                <td style="font-size: 0.85rem; color: var(--text-muted);">${dateStr}</td>
                <td style="text-align: right;">
                    <button class="btn btn-sm btn-ghost btn-toggle-active" data-id="${ep.id}" data-active="${ep.is_active}" title="${ep.is_active ? 'Деактивувати' : 'Активувати'}">
                        <i data-lucide="${ep.is_active ? 'pause-circle' : 'play-circle'}"></i>
                    </button>
                    <button class="btn btn-sm btn-ghost btn-rotate-secret" data-id="${ep.id}" title="Перевипустити секрет">
                        <i data-lucide="key"></i>
                    </button>
                    <button class="btn btn-sm btn-ghost text-danger btn-delete-endpoint" data-id="${ep.id}" title="Видалити">
                        <i data-lucide="trash-2"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join("");

    if (window.lucide) window.lucide.createIcons();

    // Attach row action listeners
    tbody.querySelectorAll(".btn-toggle-active").forEach(btn => {
        btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-id");
            const currentActive = btn.getAttribute("data-active") === "true";
            btn.disabled = true;
            await DataClient.toggleIntegrationEndpointActive(id, !currentActive);
            await loadEndpoints(currentOrgId);
        });
    });

    tbody.querySelectorAll(".btn-rotate-secret").forEach(btn => {
        btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-id");
            if (!confirm("Ви впевнені, що хочете перевипустити секрет HMAC для цього вебхука? Старий секрет миттєво втратить дію.")) return;
            btn.disabled = true;
            const { data, error } = await DataClient.rotateIntegrationEndpointSecret(id);
            btn.disabled = false;
            if (error) {
                alert("Помилка при ротації секрету: " + error.message);
                return;
            }
            if (data?.signing_secret) {
                const secretInput = document.getElementById("wh-revealed-secret");
                const modalSecret = document.getElementById("modal-webhook-secret-reveal");
                transientSecret = data.signing_secret;
                if (secretInput) secretInput.value = data.signing_secret;
                if (modalSecret) modalSecret.style.display = "flex";
            }
        });
    });

    tbody.querySelectorAll(".btn-delete-endpoint").forEach(btn => {
        btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-id");
            if (!confirm("Видалити цей webhook?")) return;
            btn.disabled = true;
            const { error } = await DataClient.deleteIntegrationEndpoint(id);
            if (error) {
                // If historical outbox entries exist, trigger raises 23001
                if (error.code === "23001" || error.message?.includes("history")) {
                    alert("Неможливо видалити endpoint з історією доставок. За правилами безпеки та аудиту деактивуйте його замість видалення.");
                } else {
                    alert("Помилка видалення: " + error.message);
                }
                btn.disabled = false;
                return;
            }
            await loadEndpoints(currentOrgId);
        });
    });
}

async function loadDeliveries(orgId = currentOrgId) {
    const tbody = document.getElementById("deliveries-table-body");
    if (!tbody) return;

    if (!orgId) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 32px; color: var(--text-muted);">
                    Оберіть організацію для перегляду журналу доставок.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = `
        <tr>
            <td colspan="7" style="text-align: center; padding: 24px;">
                <div class="portal-spinner" style="margin: 0 auto;"></div>
            </td>
        </tr>
    `;

    const { data: deliveries, error } = await DataClient.getIntegrationDeliveries(orgId, 50);
    if (error || !deliveries || deliveries.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 32px; color: var(--text-muted);">
                    Історія доставок порожня.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = deliveries.map(d => {
        let badgeClass = "badge-neutral";
        if (d.status === "delivered") badgeClass = "badge-success";
        else if (d.status === "pending" || d.status === "processing") badgeClass = "badge-warning";
        else if (d.status === "retrying") badgeClass = "badge-warning";
        else if (d.status === "failed" || d.status === "rejected_ssrf" || d.status === "dead_letter") badgeClass = "badge-danger";

        const dateStr = d.created_at ? new Date(d.created_at).toLocaleString("uk-UA") : "—";
        const attempts = `${d.attempts_count || 0} / ${d.max_attempts || 5}`;

        return `
            <tr>
                <td style="font-size: 0.85rem; color: var(--text-muted);">${dateStr}</td>
                <td><span class="badge badge-subtle">${escapeHtml(d.event_type)}</span></td>
                <td>
                    <div style="font-weight: 500;">${escapeHtml(d.destination_name || "Webhook")}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">${escapeHtml(d.url_masked || "")}</div>
                </td>
                <td><span class="badge ${badgeClass}">${escapeHtml(d.status)}</span></td>
                <td style="font-size: 0.85rem;">${attempts}</td>
                <td style="font-family: monospace; font-size: 0.85rem;">${d.last_http_status || "—"}</td>
                <td style="font-size: 0.8rem; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(d.last_error || "")}">
                    ${escapeHtml(d.last_error || "—")}
                </td>
            </tr>
        `;
    }).join("");

    if (window.lucide) window.lucide.createIcons();
}
