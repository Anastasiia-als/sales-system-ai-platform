/* js/portal/ui/portal-document-detail-view.js - Document Passport & Version History View */

import { DataClient } from "../api/data-client.js";
import { PortalAuth } from "../auth/auth-service.js";
import { 
    DOCUMENT_CATEGORIES, 
    getDocumentStatusLabel, 
    getDocumentStatusBadge, 
    formatBytes 
} from "./portal-documents-view.js";

export function renderDocumentDetailView(documentId) {
    return `
        <div class="portal-content" id="document-detail-container" data-document-id="${documentId}">
            <div class="portal-loading-container">
                <div class="portal-spinner"></div>
                <span>Завантаження документа...</span>
            </div>
        </div>

        <!-- Modals Container -->
        <div id="document-detail-modal-mount"></div>
    `;
}

export async function initDocumentDetailEvents(documentId) {
    await loadDocumentDetail(documentId);
}

async function loadDocumentDetail(documentId) {
    const container = document.getElementById("document-detail-container");
    if (!container) return;

    try {
        const res = await DataClient.getDocumentById(documentId);
        const doc = res.data;

        if (res.error || !doc) {
            container.innerHTML = `
                <div class="portal-empty-state">
                    <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="alert-circle"></i></div>
                    <div class="portal-empty-title">Документ не знайдено</div>
                    <div class="portal-empty-desc">${res.error ? escapeHtml(res.error.message) : "Документ не існує або у вас немає прав доступу."}</div>
                    <a href="#/portal/documents" class="btn btn-outline" style="margin-top: 12px;">
                        <i data-lucide="arrow-left"></i> Назад до документів
                    </a>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        const org = doc.organization;
        const proj = doc.project;
        const stage = doc.stage;
        const versions = doc.versions || [];
        const latestVer = doc.latest_version;
        const isArchived = Boolean(doc.archived_at);

        // Fetch client review events
        const reviewEventsRes = await DataClient.getDocumentReviewEvents(documentId);
        const reviewEvents = reviewEventsRes.data || reviewEventsRes || [];

        const canManage = PortalAuth.isGlobalOwner() || PortalAuth.isOrgAdmin(doc.organization_id);

        const scopeLabel = doc.internal_access_scope === "management" 
            ? `<span class="portal-badge portal-badge-danger" title="Доступно тільки керівництву">Керівництво (Management Only)</span>`
            : `<span class="portal-badge portal-badge-info" title="Доступно всій команді проєкту">Команда проєкту</span>`;

        const clientVisBadge = doc.is_client_visible 
            ? `<span class="portal-badge portal-badge-success">Видно клієнту</span>`
            : `<span class="portal-badge portal-badge-secondary">Внутрішній (Не видно клієнту)</span>`;

        const createdDate = new Date(doc.created_at).toLocaleDateString("uk-UA", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });

        const updatedDate = new Date(doc.updated_at).toLocaleDateString("uk-UA", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });

        container.innerHTML = `
            <!-- Top Breadcrumbs -->
            <div style="margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 8px; font-size: 0.88rem;">
                    <a href="#/portal/documents" class="link-arrow" style="color: var(--text-muted); display: inline-flex; align-items: center; gap: 4px;">
                        <i data-lucide="arrow-left" style="width: 14px; height: 14px;"></i> Документи
                    </a>
                    ${proj ? `
                        <span style="color: var(--border-color);">/</span>
                        <a href="#/portal/projects/${proj.id}" style="color: var(--text-secondary);">
                            ${escapeHtml(proj.name || proj.title)}
                        </a>
                    ` : ""}
                </div>

                ${isArchived ? `
                    <span class="portal-badge portal-badge-danger" style="font-size: 0.82rem; padding: 4px 10px;">
                        <i data-lucide="archive" style="width: 12px; height: 12px; vertical-align: middle;"></i> Документ знаходиться в архіві
                    </span>
                ` : ""}
            </div>

            <!-- Main Title & Action Bar -->
            <div class="portal-view-header" style="margin-bottom: 24px;">
                <div>
                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px;">
                        <h1 class="portal-view-title" style="margin: 0;">${escapeHtml(doc.title)}</h1>
                        <span class="portal-badge portal-badge-secondary">${escapeHtml(doc.category)}</span>
                        ${getDocumentStatusBadge(doc.status)}
                    </div>
                    ${doc.description ? `<p class="portal-view-subtitle" style="margin: 0; max-width: 800px;">${escapeHtml(doc.description)}</p>` : ""}
                </div>

                ${canManage ? `
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button class="btn btn-outline btn-sm" id="btn-edit-document">
                            <i data-lucide="edit-2"></i> Редагувати
                        </button>
                        <button class="btn btn-outline btn-sm" id="btn-toggle-archive-doc" style="${isArchived ? 'color: var(--color-success); border-color: var(--color-success);' : 'color: var(--color-danger); border-color: var(--color-danger);'}">
                            <i data-lucide="${isArchived ? 'rotate-ccw' : 'archive'}"></i> ${isArchived ? 'Відновити' : 'Архівувати'}
                        </button>
                        <button class="btn btn-primary btn-sm" id="btn-upload-new-version">
                            <i data-lucide="upload"></i> Завантажити нову версію
                        </button>
                    </div>
                ` : ""}
            </div>

            <!-- Passport Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
                <!-- Left Passport Card -->
                <div class="portal-section-card">
                    <div class="portal-section-card-title">Паспорт документа</div>
                    <div class="portal-meta-grid" style="grid-template-columns: 1fr 1fr; gap: 14px;">
                        <div class="portal-meta-item">
                            <span class="portal-meta-label">Організація / Клієнт</span>
                            <span class="portal-meta-value">
                                <a href="#/portal/clients/${org ? org.id : ''}" style="color: var(--text-primary); font-weight: 600;">
                                    ${org ? escapeHtml(org.name) : "—"}
                                </a>
                            </span>
                        </div>
                        <div class="portal-meta-item">
                            <span class="portal-meta-label">Проєкт делівері</span>
                            <span class="portal-meta-value">
                                ${proj ? `<a href="#/portal/projects/${proj.id}" style="color: var(--color-primary); font-weight: 600;">${escapeHtml(proj.name || proj.title)}</a>` : "—"}
                            </span>
                        </div>
                        <div class="portal-meta-item">
                            <span class="portal-meta-label">Етап делівері (Roadmap)</span>
                            <span class="portal-meta-value">
                                ${stage ? escapeHtml(stage.name) : `<span style="color: var(--text-muted);">Без прив'язки до етапу</span>`}
                            </span>
                        </div>
                        <div class="portal-meta-item">
                            <span class="portal-meta-label">Відповідальний за документ</span>
                            <span class="portal-meta-value">
                                ${doc.owner ? escapeHtml(doc.owner.full_name || doc.owner.email) : "—"}
                            </span>
                        </div>
                        <div class="portal-meta-item">
                            <span class="portal-meta-label">Внутрішня видимість</span>
                            <span class="portal-meta-value">${scopeLabel}</span>
                        </div>
                        <div class="portal-meta-item">
                            <span class="portal-meta-label">Видимість для клієнта</span>
                            <span class="portal-meta-value">${clientVisBadge}</span>
                        </div>
                        <div class="portal-meta-item">
                            <span class="portal-meta-label">Дата створення</span>
                            <span class="portal-meta-value" style="font-size: 0.82rem; color: var(--text-muted);">${createdDate}</span>
                        </div>
                        <div class="portal-meta-item">
                            <span class="portal-meta-label">Остання активність</span>
                            <span class="portal-meta-value" style="font-size: 0.82rem; color: var(--text-muted);">${updatedDate}</span>
                        </div>
                    </div>
                </div>

                <!-- Right Card: Current Active Version -->
                <div class="portal-section-card">
                    <div class="portal-section-card-title" style="display: flex; justify-content: space-between; align-items: center;">
                        <span>Поточна версія</span>
                        ${latestVer ? `
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span class="portal-badge portal-badge-primary">v${latestVer.version_number}</span>
                                ${latestVer.is_client_visible ? `<span class="portal-badge portal-badge-success" style="font-size: 0.72rem;">Опубліковано клієнту</span>` : `<span class="portal-badge portal-badge-secondary" style="font-size: 0.72rem;">Внутрішня</span>`}
                            </div>
                        ` : ""}
                    </div>

                    ${latestVer ? `
                        <div style="background: #131B2F; padding: 18px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 14px;">
                            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <div style="width: 44px; height: 44px; border-radius: 8px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); display: flex; align-items: center; justify-content: center; color: var(--color-primary);">
                                        <i data-lucide="file-text" style="width: 24px; height: 24px;"></i>
                                    </div>
                                    <div>
                                        <div style="font-weight: 700; font-size: 1rem; color: var(--text-primary); word-break: break-all;">
                                            ${escapeHtml(latestVer.original_filename)}
                                        </div>
                                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
                                            ${formatBytes(latestVer.size_bytes)} • Завантажено ${new Date(latestVer.created_at).toLocaleDateString("uk-UA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            ${latestVer.change_note ? `
                                <div style="font-size: 0.86rem; color: var(--text-secondary); background: #0E1526; padding: 10px 12px; border-radius: 6px; border-left: 3px solid var(--color-primary);">
                                    <strong style="color: var(--text-primary); font-size: 0.78rem; text-transform: uppercase; display: block; margin-bottom: 2px;">Коментар до версії:</strong>
                                    ${escapeHtml(latestVer.change_note)}
                                </div>
                            ` : ""}

                            ${latestVer.uploader ? `
                                <div style="font-size: 0.8rem; color: var(--text-muted);">
                                    Автор завантаження: <strong style="color: var(--text-secondary);">${escapeHtml(latestVer.uploader.full_name || latestVer.uploader.email)}</strong>
                                </div>
                            ` : ""}

                            <div style="display: flex; gap: 10px; margin-top: 6px;">
                                <button class="btn btn-primary btn-sm btn-download-version" data-storage-path="${escapeHtml(latestVer.storage_path)}" data-filename="${escapeHtml(latestVer.original_filename)}" style="flex: 1;">
                                    <i data-lucide="download"></i> Завантажити файл
                                </button>
                                <button class="btn btn-outline btn-sm btn-open-version" data-storage-path="${escapeHtml(latestVer.storage_path)}" title="Відкрити у новій вкладці">
                                    <i data-lucide="external-link"></i> Відкрити
                                </button>
                            </div>
                        </div>
                    ` : `
                        <div class="portal-empty-state" style="padding: 24px 16px;">
                            <div class="portal-empty-icon" style="width: 42px; height: 42px;"><i data-lucide="file-plus"></i></div>
                            <div class="portal-empty-title" style="font-size: 0.95rem;">Файл ще не додано</div>
                            <div class="portal-empty-desc" style="font-size: 0.82rem;">
                                Документ створено як плейсхолдер. Ви можете завантажити першу версію файлу.
                            </div>
                            ${canManage ? `
                                <button class="btn btn-primary btn-sm" id="btn-upload-first-version" style="margin-top: 10px;">
                                    <i data-lucide="upload"></i> Завантажити v1
                                </button>
                            ` : ""}
                        </div>
                    `}
                </div>
            </div>

            <!-- Client Reviews Section (Audit-Safe) -->
            <div class="portal-section-card" style="margin-bottom: 24px;">
                <div class="portal-section-card-title" style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="shield-check" style="width: 16px; height: 16px; color: var(--color-primary);"></i>
                        <span>Погодження клієнта (${reviewEvents.length})</span>
                    </div>
                    <span style="font-size: 0.76rem; color: var(--text-muted);">
                        Історія рішень та коментарів клієнта є незмінною
                    </span>
                </div>

                ${reviewEvents.length > 0 ? `
                    <div class="portal-table-wrapper" style="margin-top: 12px;">
                        <table class="portal-table">
                            <thead>
                                <tr>
                                    <th style="width: 110px;">Дія</th>
                                    <th>Версія</th>
                                    <th>Хто погодив / запросив</th>
                                    <th>Коментар клієнта</th>
                                    <th style="text-align: right;">Дата та час</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${reviewEvents.map(rev => {
                                    const isApprove = rev.action === "approved";
                                    const reviewerName = rev.reviewer_contact 
                                        ? `${rev.reviewer_contact.first_name || ''} ${rev.reviewer_contact.last_name || ''}`.trim() 
                                        : (rev.reviewer_profile?.full_name || rev.reviewer_profile?.email || 'Клієнт');
                                    const revDate = new Date(rev.created_at).toLocaleDateString("uk-UA", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit"
                                    });

                                    return `
                                        <tr>
                                            <td>
                                                <span class="portal-badge ${isApprove ? 'portal-badge-success' : 'portal-badge-danger'}">
                                                    <i data-lucide="${isApprove ? 'check' : 'message-square'}" style="width: 11px; height: 11px;"></i>
                                                    ${isApprove ? 'Погоджено' : 'Запит змін'}
                                                </span>
                                            </td>
                                            <td>
                                                <span class="portal-badge portal-badge-secondary">v${rev.version?.version_number || '—'}</span>
                                            </td>
                                            <td style="font-weight: 500;">
                                                ${escapeHtml(reviewerName)}
                                            </td>
                                            <td style="font-size: 0.86rem; color: var(--text-secondary); max-width: 320px;">
                                                ${rev.comment ? `"${escapeHtml(rev.comment)}"` : '<span style="color: var(--text-muted);">Без коментаря</span>'}
                                            </td>
                                            <td style="text-align: right; font-size: 0.82rem; color: var(--text-muted);">
                                                ${revDate}
                                            </td>
                                        </tr>
                                    `;
                                }).join("")}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.88rem;">
                        Погоджень від клієнта ще не надходило.
                    </div>
                `}
            </div>

            <!-- Version History Section -->
            <div class="portal-section-card" style="margin-bottom: 24px;">
                <div class="portal-section-card-title" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>Історія версій (${versions.length})</span>
                    <span style="font-size: 0.76rem; color: var(--text-muted);">
                        Всі попередні версії зберігаються та доступні для завантаження
                    </span>
                </div>

                ${versions.length > 0 ? `
                    <div class="portal-table-wrapper" style="margin-top: 12px;">
                        <table class="portal-table">
                            <thead>
                                <tr>
                                    <th style="width: 90px;">Версія</th>
                                    <th>Файл</th>
                                    <th>Видимість клієнту</th>
                                    <th>Розмір</th>
                                    <th>Хто завантажив</th>
                                    <th>Дата завантаження</th>
                                    <th>Коментар до змін</th>
                                    <th style="text-align: right;">Дії</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${versions.map(v => {
                                    const isLatest = latestVer && v.id === latestVer.id;
                                    const isPublished = Boolean(v.is_client_visible);
                                    const uploaderName = v.uploader?.full_name || v.uploader?.email || "—";
                                    const vDate = new Date(v.created_at).toLocaleDateString("uk-UA", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit"
                                    });

                                    return `
                                        <tr>
                                            <td>
                                                <div style="display: flex; align-items: center; gap: 6px;">
                                                    <span class="portal-badge ${isLatest ? 'portal-badge-primary' : 'portal-badge-secondary'}">
                                                        v${v.version_number}
                                                    </span>
                                                    ${isLatest ? `<span style="font-size: 0.72rem; color: var(--color-primary); font-weight: 700;">(поточна)</span>` : ""}
                                                </div>
                                            </td>
                                            <td style="font-weight: 600;">
                                                <span style="color: var(--text-primary);">${escapeHtml(v.original_filename)}</span>
                                            </td>
                                            <td>
                                                <span class="portal-badge ${isPublished ? 'portal-badge-success' : 'portal-badge-secondary'}">
                                                    ${isPublished ? 'Опубліковано' : 'Внутрішня'}
                                                </span>
                                            </td>
                                            <td style="font-size: 0.85rem; color: var(--text-muted);">
                                                ${formatBytes(v.size_bytes)}
                                            </td>
                                            <td style="font-size: 0.85rem;">
                                                ${escapeHtml(uploaderName)}
                                            </td>
                                            <td style="font-size: 0.82rem; color: var(--text-muted);">
                                                ${vDate}
                                            </td>
                                            <td style="font-size: 0.85rem; color: var(--text-secondary); max-width: 200px;">
                                                ${v.change_note ? escapeHtml(v.change_note) : `<span style="color: var(--text-muted);">—</span>`}
                                            </td>
                                            <td style="text-align: right;">
                                                <div style="display: inline-flex; gap: 6px; justify-content: flex-end;">
                                                    ${canManage ? `
                                                        <button class="btn btn-sm ${isPublished ? 'btn-outline' : 'btn-primary'} btn-toggle-publish-version" data-version-id="${v.id}" data-current-publish="${isPublished}" style="padding: 4px 8px; font-size: 0.75rem;">
                                                            <i data-lucide="${isPublished ? 'eye-off' : 'eye'}" style="width: 12px; height: 12px;"></i>
                                                            ${isPublished ? 'Зняти' : 'Опублікувати'}
                                                        </button>
                                                    ` : ''}
                                                    <button class="btn btn-sm btn-outline btn-download-version" data-storage-path="${escapeHtml(v.storage_path)}" data-filename="${escapeHtml(v.original_filename)}" title="Завантажити цю версію" style="padding: 4px 8px;">
                                                        <i data-lucide="download" style="width: 13px; height: 13px;"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    `;
                                }).join("")}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.88rem;">
                        Історія версій порожня. Файли ще не завантажувалися.
                    </div>
                `}
            </div>
        `;

        if (window.lucide) window.lucide.createIcons();

        // Attach Event Listeners
        attachDocumentDetailEvents(doc, async () => {
            await loadDocumentDetail(documentId);
        });

    } catch (err) {
        console.error("Error in loadDocumentDetail:", err);
        container.innerHTML = `
            <div class="portal-empty-state">
                <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="alert-triangle"></i></div>
                <div class="portal-empty-title">Помилка завантаження документа</div>
                <div class="portal-empty-desc">${escapeHtml(err.message)}</div>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
    }
}

function attachDocumentDetailEvents(doc, reloadFn) {
    // Download Buttons
    document.querySelectorAll(".btn-download-version").forEach(btn => {
        btn.addEventListener("click", async () => {
            const path = btn.dataset.storagePath;
            const filename = btn.dataset.filename;
            if (!path) return;

            btn.disabled = true;
            try {
                await DataClient.downloadDocumentFile(path, filename);
            } catch (err) {
                alert("Помилка завантаження: " + err.message);
            } finally {
                btn.disabled = false;
            }
        });
    });

    // Open in new tab
    document.querySelectorAll(".btn-open-version").forEach(btn => {
        btn.addEventListener("click", async () => {
            const path = btn.dataset.storagePath;
            if (!path) return;

            btn.disabled = true;
            try {
                const { data: url, error } = await DataClient.getDocumentDownloadUrl(path, 600);
                if (error || !url) throw error || new Error("Не вдалося отримати посилання");
                window.open(url, "_blank");
            } catch (err) {
                alert("Помилка: " + err.message);
            } finally {
                btn.disabled = false;
            }
        });
    });

    // Toggle Version Publication
    document.querySelectorAll(".btn-toggle-publish-version").forEach(btn => {
        btn.addEventListener("click", async () => {
            const versionId = btn.dataset.versionId;
            const currentPublish = btn.dataset.currentPublish === "true";
            const newPublish = !currentPublish;

            btn.disabled = true;
            try {
                const { error } = await DataClient.publishDocumentVersion(versionId, newPublish);
                if (error) throw error;
                await reloadFn();
            } catch (err) {
                alert("Помилка зміни видимості версії: " + err.message);
                btn.disabled = false;
            }
        });
    });

    // Upload New Version Button
    document.getElementById("btn-upload-new-version")?.addEventListener("click", () => {
        openUploadVersionModal(doc, reloadFn);
    });

    document.getElementById("btn-upload-first-version")?.addEventListener("click", () => {
        openUploadVersionModal(doc, reloadFn);
    });

    // Edit Document Button
    document.getElementById("btn-edit-document")?.addEventListener("click", () => {
        openEditDocumentModal(doc, reloadFn);
    });

    // Toggle Archive Button
    document.getElementById("btn-toggle-archive-doc")?.addEventListener("click", async () => {
        const isArchived = Boolean(doc.archived_at);
        const confirmMsg = isArchived 
            ? `Відновити документ "${doc.title}" з архіву?`
            : `Архівувати документ "${doc.title}"? Він буде прихований з активного списку, але історія версій збережеться.`;

        if (!confirm(confirmMsg)) return;

        try {
            const res = await DataClient.archiveDocument(doc.id, !isArchived);
            if (res.error) throw res.error;
            await reloadFn();
        } catch (err) {
            alert("Помилка архівації: " + err.message);
        }
    });
}

// -----------------------------------------------------------------------------
// Modal: Upload New Version
// -----------------------------------------------------------------------------
function openUploadVersionModal(doc, onUploaded) {
    const modalMount = document.getElementById("document-detail-modal-mount") || document.body;

    const nextVer = (doc.latest_version ? doc.latest_version.version_number : 0) + 1;

    const modalHtml = `
        <div class="portal-modal-backdrop" id="modal-upload-ver-backdrop">
            <div class="portal-modal" style="max-width: 520px;">
                <div class="portal-modal-header">
                    <h3 class="portal-modal-title">Завантажити версію v${nextVer}</h3>
                    <button class="portal-modal-close" id="btn-close-upload-ver-modal">&times;</button>
                </div>
                <form id="form-upload-version" class="portal-form">
                    <div style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 14px;">
                        Документ: <strong>${escapeHtml(doc.title)}</strong>
                    </div>

                    <div class="portal-form-group">
                        <label class="portal-label">Виберіть файл *</label>
                        <input type="file" id="ver-form-file" class="portal-input" style="padding: 8px;" required />
                        <span style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; display: block;">
                            Підтримуються: PDF, DOCX, XLSX, PPTX, CSV, MD, PNG, JPG, WEBP тощо (макс. 50 МБ)
                        </span>
                    </div>

                    <div class="portal-form-group">
                        <label class="portal-label">Коментар до версії / Примітки</label>
                        <textarea id="ver-form-change-note" class="portal-textarea" rows="3" placeholder="Опишіть внесені зміни (наприклад: Додано KPI-розрахунки та виправлено блок рекомендацій)..."></textarea>
                    </div>

                    <div class="portal-modal-actions" style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px;">
                        <button type="button" class="btn btn-outline" id="btn-cancel-upload-ver">Скасувати</button>
                        <button type="submit" class="btn btn-primary" id="btn-submit-upload-ver">
                            <i data-lucide="upload"></i> Завантажити v${nextVer}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = modalHtml;
    const modalEl = tempDiv.firstElementChild;
    modalMount.appendChild(modalEl);
    if (window.lucide) window.lucide.createIcons();

    const closeModal = () => modalEl.remove();
    modalEl.querySelector("#btn-close-upload-ver-modal")?.addEventListener("click", closeModal);
    modalEl.querySelector("#btn-cancel-upload-ver")?.addEventListener("click", closeModal);

    const form = modalEl.querySelector("#form-upload-version");
    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const submitBtn = modalEl.querySelector("#btn-submit-upload-ver");
        const fileInput = modalEl.querySelector("#ver-form-file");
        const changeNote = modalEl.querySelector("#ver-form-change-note").value.trim();

        if (!fileInput.files || !fileInput.files[0]) {
            alert("Будь ласка, виберіть файл для завантаження");
            return;
        }

        const file = fileInput.files[0];
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="portal-spinner portal-spinner-sm"></span> Завантаження файлу...`;

        try {
            const res = await DataClient.uploadDocumentVersion(
                doc.id,
                file,
                changeNote,
                nextVer,
                doc.organization_id,
                doc.project_id
            );

            if (res.error) {
                alert("Помилка завантаження версії: " + res.error.message);
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i data-lucide="upload"></i> Завантажити v${nextVer}`;
                if (window.lucide) window.lucide.createIcons();
                return;
            }

            closeModal();
            if (typeof onUploaded === "function") {
                await onUploaded();
            }
        } catch (err) {
            console.error("Upload error:", err);
            alert("Помилка: " + err.message);
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i data-lucide="upload"></i> Завантажити v${nextVer}`;
            if (window.lucide) window.lucide.createIcons();
        }
    });
}

// -----------------------------------------------------------------------------
// Modal: Edit Document Metadata
// -----------------------------------------------------------------------------
async function openEditDocumentModal(doc, onUpdated) {
    const modalMount = document.getElementById("document-detail-modal-mount") || document.body;

    const stagesRes = await DataClient.getProjectRoadmap(doc.project_id);
    const stages = stagesRes.data || [];

    const modalHtml = `
        <div class="portal-modal-backdrop" id="modal-edit-doc-backdrop">
            <div class="portal-modal" style="max-width: 560px;">
                <div class="portal-modal-header">
                    <h3 class="portal-modal-title">Редагувати документ</h3>
                    <button class="portal-modal-close" id="btn-close-edit-doc-modal">&times;</button>
                </div>
                <form id="form-edit-document" class="portal-form">
                    <div class="portal-form-group">
                        <label class="portal-label">Назва документа *</label>
                        <input type="text" id="edit-doc-title" class="portal-input" value="${escapeHtml(doc.title)}" required />
                    </div>

                    <div class="portal-form-group">
                        <label class="portal-label">Опис / Примітки</label>
                        <textarea id="edit-doc-desc" class="portal-textarea" rows="2">${escapeHtml(doc.description || '')}</textarea>
                    </div>

                    <div class="portal-grid-2">
                        <div class="portal-form-group">
                            <label class="portal-label">Категорія *</label>
                            <select id="edit-doc-category" class="portal-select" required>
                                ${DOCUMENT_CATEGORIES.map(c => `<option value="${escapeHtml(c)}" ${c === doc.category ? 'selected' : ''}>${escapeHtml(c)}</option>`).join("")}
                            </select>
                        </div>

                        <div class="portal-form-group">
                            <label class="portal-label">Етап делівері</label>
                            <select id="edit-doc-stage" class="portal-select">
                                <option value="">Без прив'язки</option>
                                ${stages.map(s => `<option value="${s.id}" ${s.id === doc.stage_id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join("")}
                            </select>
                        </div>
                    </div>

                    <div class="portal-grid-2">
                        <div class="portal-form-group">
                            <label class="portal-label">Статус документа</label>
                            <select id="edit-doc-status" class="portal-select">
                                <option value="draft" ${doc.status === 'draft' ? 'selected' : ''}>Чернетка</option>
                                <option value="internal_review" ${doc.status === 'internal_review' ? 'selected' : ''}>Внутрішня перевірка</option>
                                <option value="client_review" ${doc.status === 'client_review' ? 'selected' : ''}>На перевірці клієнта</option>
                                <option value="changes_requested" ${doc.status === 'changes_requested' ? 'selected' : ''}>Потрібні зміни</option>
                                <option value="approved" ${doc.status === 'approved' ? 'selected' : ''}>Погоджено</option>
                                <option value="final" ${doc.status === 'final' ? 'selected' : ''}>Фінальний</option>
                            </select>
                        </div>

                        <div class="portal-form-group">
                            <label class="portal-label">Внутрішній доступ *</label>
                            <select id="edit-doc-scope" class="portal-select">
                                <option value="project_team" ${doc.internal_access_scope === 'project_team' ? 'selected' : ''}>Команда проєкту</option>
                                <option value="management" ${doc.internal_access_scope === 'management' ? 'selected' : ''}>Керівництво (Тільки PM та Власник)</option>
                            </select>
                        </div>
                    </div>

                    <div class="portal-form-group">
                        <label class="portal-checkbox-label" style="font-size: 0.88rem; display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="edit-doc-client-visible" ${doc.is_client_visible ? 'checked' : ''} ${doc.internal_access_scope === 'management' ? 'disabled' : ''} />
                            <span>Дозволити видимість клієнту (is_client_visible)</span>
                        </label>
                    </div>

                    <div class="portal-modal-actions" style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px;">
                        <button type="button" class="btn btn-outline" id="btn-cancel-edit-doc">Скасувати</button>
                        <button type="submit" class="btn btn-primary" id="btn-submit-edit-doc">
                            <i data-lucide="check"></i> Зберегти зміни
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = modalHtml;
    const modalEl = tempDiv.firstElementChild;
    modalMount.appendChild(modalEl);
    if (window.lucide) window.lucide.createIcons();

    const scopeSelect = modalEl.querySelector("#edit-doc-scope");
    const clientVisCheckbox = modalEl.querySelector("#edit-doc-client-visible");

    scopeSelect?.addEventListener("change", () => {
        if (scopeSelect.value === "management") {
            clientVisCheckbox.checked = false;
            clientVisCheckbox.disabled = true;
        } else {
            clientVisCheckbox.disabled = false;
        }
    });

    const closeModal = () => modalEl.remove();
    modalEl.querySelector("#btn-close-edit-doc-modal")?.addEventListener("click", closeModal);
    modalEl.querySelector("#btn-cancel-edit-doc")?.addEventListener("click", closeModal);

    const form = modalEl.querySelector("#form-edit-document");
    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const submitBtn = modalEl.querySelector("#btn-submit-edit-doc");
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="portal-spinner portal-spinner-sm"></span> Збереження...`;

        try {
            const title = modalEl.querySelector("#edit-doc-title").value.trim();
            const description = modalEl.querySelector("#edit-doc-desc").value.trim();
            const category = modalEl.querySelector("#edit-doc-category").value;
            const stageId = modalEl.querySelector("#edit-doc-stage").value || null;
            const status = modalEl.querySelector("#edit-doc-status").value;
            const scope = scopeSelect.value;
            const isClientVis = scope === "management" ? false : clientVisCheckbox.checked;

            const updateData = {
                title,
                description,
                category,
                stage_id: stageId,
                status,
                internal_access_scope: scope,
                is_client_visible: isClientVis
            };

            const res = await DataClient.updateDocument(doc.id, updateData);
            if (res.error) {
                alert("Помилка збереження: " + res.error.message);
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i data-lucide="check"></i> Зберегти зміни`;
                if (window.lucide) window.lucide.createIcons();
                return;
            }

            closeModal();
            if (typeof onUpdated === "function") {
                await onUpdated();
            }
        } catch (err) {
            console.error("Update error:", err);
            alert("Помилка: " + err.message);
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i data-lucide="check"></i> Зберегти зміни`;
            if (window.lucide) window.lucide.createIcons();
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
