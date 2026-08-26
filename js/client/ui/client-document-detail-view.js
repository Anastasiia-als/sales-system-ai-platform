/* js/client/ui/client-document-detail-view.js - Client Document Passport & Review Workspace */

import { DataClient } from "../../portal/api/data-client.js";

export function renderClientDocumentDetailView(docData) {
    const { 
        id, title, description, category, status, updated_at, created_at,
        project, stage, owner, publishedVersions = [], latestVersion, reviewEvents = [] 
    } = docData;

    const projectName = project?.name || project?.title || "Проєкт";
    const statusBadge = getDocStatusBadge(status);
    const hasFile = !!latestVersion;

    const isPendingReview = status === "client_review";
    const isApproved = status === "approved" || status === "final";
    const isChangesRequested = status === "changes_requested";

    // Most recent review event
    const latestEvent = reviewEvents[0] || null;

    return `
        <div class="client-container">
            <!-- Breadcrumbs -->
            <div class="client-breadcrumbs" style="margin-bottom: 16px;">
                <a href="#/client/documents" class="client-breadcrumb-link">
                    <i data-lucide="arrow-left" style="width: 14px; height: 14px;"></i>
                    <span>Всі документи</span>
                </a>
                <span class="client-breadcrumb-sep">/</span>
                <span class="client-breadcrumb-current">${escapeHtml(title)}</span>
            </div>

            <div class="client-doc-detail-layout">
                <!-- Main Column: Document Info & Current Version -->
                <div class="client-doc-detail-main">
                    <!-- Hero Card -->
                    <div class="client-card" style="margin-bottom: 20px;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; flex-wrap: wrap;">
                            <div>
                                <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 6px; flex-wrap: wrap;">
                                    <span class="client-badge client-badge-neutral">${escapeHtml(category)}</span>
                                    <span class="client-badge client-badge-neutral">
                                        <i data-lucide="folder" style="width: 11px; height: 11px;"></i> ${escapeHtml(projectName)}
                                    </span>
                                </div>
                                <h1 class="client-page-title" style="font-size: 1.5rem; margin-bottom: 6px;">${escapeHtml(title)}</h1>
                            </div>
                            <span class="client-badge ${statusBadge.badgeClass}" style="font-size: 0.88rem; padding: 6px 12px;">
                                ${statusBadge.label}
                            </span>
                        </div>

                        ${description ? `
                            <p style="font-size: 0.95rem; color: var(--text-secondary); line-height: 1.6; margin-bottom: 16px;">
                                ${escapeHtml(description)}
                            </p>
                        ` : ''}

                        <div style="display: flex; gap: 20px; font-size: 0.82rem; color: var(--text-muted); flex-wrap: wrap; border-top: 1px solid var(--border-color); padding-top: 12px;">
                            <span><i data-lucide="calendar" style="width: 12px; height: 12px; display: inline;"></i> Оновлено: ${formatDate(updated_at || created_at)}</span>
                            ${stage ? `<span><i data-lucide="play-circle" style="width: 12px; height: 12px; display: inline;"></i> Етап: ${escapeHtml(stage.name)}</span>` : ''}
                        </div>
                    </div>

                    <!-- Review Actions Banner (If Review Pending or Requested) -->
                    ${isPendingReview && hasFile ? `
                        <div class="client-card client-review-action-banner" style="margin-bottom: 20px;">
                            <div class="client-review-banner-header">
                                <div class="client-review-banner-icon">
                                    <i data-lucide="help-circle"></i>
                                </div>
                                <div>
                                    <h3 style="font-size: 1.05rem; font-weight: 600; color: var(--text-primary);">Очікується погодження документа</h3>
                                    <p style="font-size: 0.88rem; color: var(--text-secondary);">
                                        Будь ласка, ознайомтеся з актуальною версією <strong>v${latestVersion.version_number}</strong> та підтвердіть погодження або надішліть коментарі для доопрацювання.
                                    </p>
                                </div>
                            </div>

                            <div class="client-review-banner-btns">
                                <button class="btn btn-outline" id="btn-request-changes" style="border-color: var(--color-danger); color: var(--color-danger);">
                                    <i data-lucide="message-square-plus" style="width: 15px; height: 15px;"></i> Запросити зміни
                                </button>
                                <button class="btn btn-primary" id="btn-approve-document">
                                    <i data-lucide="check-circle" style="width: 15px; height: 15px;"></i> Погодити документ
                                </button>
                            </div>
                        </div>
                    ` : ''}

                    ${isApproved ? `
                        <div class="client-card" style="margin-bottom: 20px; border-left: 4px solid var(--color-success); background: rgba(16, 185, 129, 0.04);">
                            <div style="display: flex; gap: 12px; align-items: center;">
                                <div style="color: var(--color-success); font-size: 1.5rem;"><i data-lucide="check-circle-2"></i></div>
                                <div>
                                    <h4 style="font-size: 1rem; font-weight: 600; color: var(--color-success);">Документ погоджено</h4>
                                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 2px;">
                                        ${latestEvent && latestEvent.created_at ? `Погоджено ${formatDate(latestEvent.created_at)}` : 'Матеріал затверджено до використання.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ` : ''}

                    ${isChangesRequested ? `
                        <div class="client-card" style="margin-bottom: 20px; border-left: 4px solid var(--color-warning); background: rgba(245, 158, 11, 0.04);">
                            <div style="display: flex; gap: 12px; align-items: flex-start;">
                                <div style="color: var(--color-warning); font-size: 1.5rem;"><i data-lucide="clock"></i></div>
                                <div>
                                    <h4 style="font-size: 1rem; font-weight: 600; color: var(--color-warning);">Запрошено зміни — команда працює над оновленням</h4>
                                    ${latestEvent?.comment ? `
                                        <div style="font-size: 0.88rem; color: var(--text-secondary); margin-top: 6px; padding: 8px 12px; background: var(--bg-card); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                                            <strong>Ваш коментар:</strong> ${escapeHtml(latestEvent.comment)}
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    ` : ''}

                    <!-- Current Published Version Card -->
                    <div class="client-card" style="margin-bottom: 20px;">
                        <div class="client-card-header" style="margin-bottom: 16px;">
                            <div>
                                <h3 class="client-card-title">Актуальна опублікована версія</h3>
                                <p class="client-card-subtitle">Чинний файл артефакту для перегляду та завантаження</p>
                            </div>
                        </div>

                        ${hasFile ? `
                            <div class="client-version-current-box">
                                <div class="client-version-current-icon">
                                    <i data-lucide="file-check"></i>
                                </div>
                                <div style="flex: 1; min-width: 0;">
                                    <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 4px;">
                                        <span class="client-badge client-badge-primary" style="font-size: 0.75rem;">Версія v${latestVersion.version_number}</span>
                                        <span style="font-size: 0.8rem; color: var(--text-muted);">${formatDate(latestVersion.published_to_client_at || latestVersion.created_at)}</span>
                                    </div>
                                    <h4 style="font-size: 1.05rem; font-weight: 600; color: var(--text-primary); word-break: break-all;">
                                        ${escapeHtml(latestVersion.original_filename)}
                                    </h4>
                                    <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 4px;">
                                        Розмір: ${formatFileSize(latestVersion.size_bytes)}
                                    </div>
                                    ${latestVersion.change_note ? `
                                        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 8px; font-style: italic;">
                                            "${escapeHtml(latestVersion.change_note)}"
                                        </div>
                                    ` : ''}
                                </div>

                                <div class="client-version-download-btn-wrap">
                                    <button class="btn btn-primary btn-download-version" data-path="${escapeHtml(latestVersion.storage_path)}" data-filename="${escapeHtml(latestVersion.original_filename)}">
                                        <i data-lucide="download" style="width: 15px; height: 15px;"></i> Завантажити файл
                                    </button>
                                </div>
                            </div>
                        ` : `
                            <div style="text-align: center; padding: 36px 20px; color: var(--text-secondary);">
                                <i data-lucide="clock" style="width: 36px; height: 36px; color: var(--text-muted); margin-bottom: 8px;"></i>
                                <h4 style="font-size: 1.05rem; font-weight: 600; margin-bottom: 4px;">Готується</h4>
                                <p style="font-size: 0.88rem; color: var(--text-muted);">
                                    Файл документа ще формується командою і буде опублікований найближчим часом.
                                </p>
                            </div>
                        `}
                    </div>

                    <!-- Published Version History -->
                    ${publishedVersions.length > 1 ? `
                        <div class="client-card">
                            <div class="client-card-header" style="margin-bottom: 14px;">
                                <h3 class="client-card-title" style="font-size: 1rem;">Історія опублікованих версій</h3>
                            </div>

                            <div class="client-version-history-list">
                                ${publishedVersions.map(v => `
                                    <div class="client-version-history-item ${v.id === latestVersion?.id ? 'active' : ''}">
                                        <div class="client-version-history-badge">v${v.version_number}</div>
                                        <div style="flex: 1; min-width: 0;">
                                            <div style="font-weight: 500; font-size: 0.9rem; color: var(--text-primary); word-break: break-all;">
                                                ${escapeHtml(v.original_filename)}
                                            </div>
                                            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">
                                                Опубліковано: ${formatDate(v.published_to_client_at || v.created_at)} • ${formatFileSize(v.size_bytes)}
                                            </div>
                                            ${v.change_note ? `<div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">${escapeHtml(v.change_note)}</div>` : ''}
                                        </div>
                                        <button class="btn btn-sm btn-ghost btn-download-version" data-path="${escapeHtml(v.storage_path)}" data-filename="${escapeHtml(v.original_filename)}" title="Завантажити цю версію">
                                            <i data-lucide="download" style="width: 14px; height: 14px;"></i>
                                        </button>
                                    </div>
                                `).join("")}
                            </div>
                        </div>
                    ` : ''}
                </div>

                <!-- Sidebar: Review History / Audit -->
                <div class="client-doc-detail-side">
                    <div class="client-card">
                        <div class="client-card-header" style="margin-bottom: 12px;">
                            <h3 class="client-card-title" style="font-size: 0.95rem;">Історія погоджень</h3>
                        </div>

                        ${reviewEvents.length === 0 ? `
                            <div style="padding: 16px 0; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
                                Документ ще не проходив цикл погодження.
                            </div>
                        ` : `
                            <div class="client-review-timeline">
                                ${reviewEvents.map(rev => {
                                    const isApprove = rev.action === "approved";
                                    const reviewerName = rev.reviewer_contact 
                                        ? `${rev.reviewer_contact.first_name || ''} ${rev.reviewer_contact.last_name || ''}`.trim() 
                                        : (rev.reviewer_profile?.full_name || 'Представник клієнта');

                                    return `
                                        <div class="client-review-timeline-item ${isApprove ? 'approve' : 'changes'}">
                                            <div class="client-review-timeline-marker">
                                                <i data-lucide="${isApprove ? 'check' : 'message-square'}" style="width: 12px; height: 12px;"></i>
                                            </div>
                                            <div class="client-review-timeline-content">
                                                <div style="display: flex; justify-content: space-between; gap: 8px;">
                                                    <span style="font-size: 0.85rem; font-weight: 600; color: ${isApprove ? 'var(--color-success)' : 'var(--color-warning)'};">
                                                        ${isApprove ? 'Погоджено' : 'Запрошено зміни'}
                                                    </span>
                                                    <span style="font-size: 0.75rem; color: var(--text-muted);">${formatDate(rev.created_at)}</span>
                                                </div>
                                                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">
                                                    ${escapeHtml(reviewerName)}
                                                </div>
                                                ${rev.comment ? `
                                                    <div style="font-size: 0.82rem; color: var(--text-primary); margin-top: 6px; padding: 6px 8px; background: var(--bg-card-subtle); border-radius: var(--radius-sm); border: 1px solid var(--border-color); line-height: 1.4;">
                                                        "${escapeHtml(rev.comment)}"
                                                    </div>
                                                ` : ''}
                                            </div>
                                        </div>
                                    `;
                                }).join("")}
                            </div>
                        `}
                    </div>
                </div>
            </div>
        </div>

        <!-- Request Changes Modal Container -->
        <div id="client-review-modal-container"></div>
    `;
}

export function initClientDocumentDetailEvents(docData, onRefresh) {
    if (window.lucide) window.lucide.createIcons();

    const { id: docId, latestVersion } = docData;

    // Download buttons
    document.querySelectorAll(".btn-download-version").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const storagePath = btn.dataset.path;
            if (!storagePath) return;

            btn.disabled = true;
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<span class="portal-spinner" style="width:13px;height:13px;"></span> Завантаження...';

            try {
                const { data, error } = await DataClient.getClientDocumentDownloadUrl(storagePath);
                if (error || !data?.signedUrl) {
                    alert("Не вдалося отримати посилання для завантаження: " + (error?.message || "Доступ обмежено"));
                    return;
                }
                window.open(data.signedUrl, "_blank");
            } catch (err) {
                alert("Помилка завантаження: " + err.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
                if (window.lucide) window.lucide.createIcons();
            }
        });
    });

    // Approve Document Button
    document.getElementById("btn-approve-document")?.addEventListener("click", async () => {
        if (!latestVersion) return;
        if (!confirm(`Підтвердіть погодження документа "${docData.title}" (версія v${latestVersion.version_number})?`)) {
            return;
        }

        const btn = document.getElementById("btn-approve-document");
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="portal-spinner" style="width:14px;height:14px;"></span> Погодження...';
        }

        const { error } = await DataClient.approveDocumentVersion(docId, latestVersion.id);
        if (error) {
            alert(error.message || "Помилка при погодженні документа.");
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i data-lucide="check-circle"></i> Погодити документ';
                if (window.lucide) window.lucide.createIcons();
            }
            return;
        }

        if (onRefresh) onRefresh();
    });

    // Request Changes Button -> Open Modal
    document.getElementById("btn-request-changes")?.addEventListener("click", () => {
        if (!latestVersion) return;
        openRequestChangesModal(docId, latestVersion.id, docData.title, latestVersion.version_number, onRefresh);
    });
}

function openRequestChangesModal(docId, versionId, docTitle, versionNumber, onRefresh) {
    const container = document.getElementById("client-review-modal-container");
    if (!container) return;

    container.innerHTML = `
        <div class="portal-modal-overlay" id="modal-request-changes-overlay">
            <div class="portal-modal-card" style="max-width: 520px;">
                <div class="portal-modal-header">
                    <div>
                        <span class="client-badge client-badge-warning" style="font-size: 0.75rem; margin-bottom: 4px;">
                            Версія v${versionNumber}
                        </span>
                        <h3 class="portal-modal-title">Запит на зміни</h3>
                    </div>
                    <button class="portal-modal-close" onclick="closeReviewModal()">&times;</button>
                </div>

                <div class="portal-modal-body">
                    <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 16px;">
                        Вкажіть коментарі та уточнення для команди делівері щодо документа <strong>"${escapeHtml(docTitle)}"</strong>.
                    </p>

                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px; color: var(--text-primary);">
                            Коментар для доопрацювання <span style="color: var(--color-danger);">*</span>
                        </label>
                        <textarea id="input-request-changes-comment" class="client-textarea-input" rows="4" placeholder="Наприклад: Просимо уточнити KPI у розділі 4 та скоригувати терміни запуску..."></textarea>
                    </div>
                </div>

                <div class="portal-modal-footer" style="display: flex; justify-content: space-between;">
                    <button class="btn btn-outline" onclick="closeReviewModal()">Скасувати</button>
                    <button class="btn btn-primary" id="btn-submit-request-changes" style="background: var(--color-danger); border-color: var(--color-danger);">
                        <i data-lucide="send" style="width: 14px; height: 14px;"></i> Надіслати запит
                    </button>
                </div>
            </div>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    document.getElementById("btn-submit-request-changes")?.addEventListener("click", async () => {
        const commentInput = document.getElementById("input-request-changes-comment");
        const comment = commentInput ? commentInput.value.trim() : "";
        if (!comment) {
            alert("Будь ласка, введіть обов'язковий коментар із поясненням необхідних змін.");
            commentInput?.focus();
            return;
        }

        const btn = document.getElementById("btn-submit-request-changes");
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="portal-spinner" style="width:14px;height:14px;"></span> Надсилання...';
        }

        const { error } = await DataClient.requestDocumentChanges(docId, versionId, comment);
        if (error) {
            alert(error.message || "Помилка надсилання запиту на зміни.");
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i data-lucide="send"></i> Надіслати запит';
                if (window.lucide) window.lucide.createIcons();
            }
            return;
        }

        closeReviewModal();
        if (onRefresh) onRefresh();
    });
}

window.closeReviewModal = () => {
    const container = document.getElementById("client-review-modal-container");
    if (container) container.innerHTML = "";
};

function getDocStatusBadge(status) {
    const map = {
        draft: { label: "Чернетка", badgeClass: "client-badge-neutral" },
        internal_review: { label: "На перевірці", badgeClass: "client-badge-info" },
        client_review: { label: "Потрібне погодження", badgeClass: "client-badge-warning" },
        changes_requested: { label: "Запрошено зміни", badgeClass: "client-badge-danger" },
        approved: { label: "Погоджено", badgeClass: "client-badge-success" },
        final: { label: "Фінальний", badgeClass: "client-badge-success" }
    };
    return map[status] || { label: "Документ", badgeClass: "client-badge-neutral" };
}

function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" });
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
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
