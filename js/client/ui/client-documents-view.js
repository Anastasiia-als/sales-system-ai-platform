/* js/client/ui/client-documents-view.js - Global Client Documents Workspace */

let selectedCategory = "all";
let selectedProjectId = "all";
let selectedStatus = "all";
let searchKeyword = "";

export function renderClientDocumentsView(documents = [], projects = [], currentFilter = {}) {
    selectedCategory = currentFilter.category || selectedCategory || "all";
    selectedProjectId = currentFilter.projectId || selectedProjectId || "all";
    selectedStatus = currentFilter.status || selectedStatus || "all";
    searchKeyword = currentFilter.search || "";

    // Categories list for filter
    const categories = Array.from(new Set(documents.map(d => d.category))).filter(Boolean);

    // Apply filters
    let displayedDocs = [...documents];

    if (selectedProjectId !== "all") {
        displayedDocs = displayedDocs.filter(d => d.project_id === selectedProjectId);
    }
    if (selectedCategory !== "all") {
        displayedDocs = displayedDocs.filter(d => d.category === selectedCategory);
    }
    if (selectedStatus === "review") {
        displayedDocs = displayedDocs.filter(d => d.status === "client_review");
    } else if (selectedStatus === "approved") {
        displayedDocs = displayedDocs.filter(d => d.status === "approved" || d.status === "final");
    }

    if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        displayedDocs = displayedDocs.filter(d => 
            (d.title && d.title.toLowerCase().includes(kw)) ||
            (d.description && d.description.toLowerCase().includes(kw)) ||
            (d.category && d.category.toLowerCase().includes(kw))
        );
    }

    const reviewPendingCount = documents.filter(d => d.status === "client_review").length;

    return `
        <div class="client-container">
            <!-- Header -->
            <div class="client-section-header" style="margin-bottom: 24px;">
                <div>
                    <h1 class="client-page-title">Документи та матеріали</h1>
                    <p class="client-page-subtitle">Реєстр узгоджених звітів, регламентів, скриптів та артефактів делівері.</p>
                </div>
            </div>

            <!-- Filter Controls Bar -->
            <div class="client-card" style="margin-bottom: 20px; padding: 16px;">
                <div class="client-docs-filter-bar">
                    <!-- Status Pills -->
                    <div class="client-filter-pills" id="client-doc-status-pills">
                        <button class="client-filter-pill ${selectedStatus === 'all' ? 'active' : ''}" data-status="all">
                            Всі документи (${documents.length})
                        </button>
                        <button class="client-filter-pill ${selectedStatus === 'review' ? 'active' : ''}" data-status="review">
                            Потрібне погодження (${reviewPendingCount})
                        </button>
                        <button class="client-filter-pill ${selectedStatus === 'approved' ? 'active' : ''}" data-status="approved">
                            Погоджені
                        </button>
                    </div>

                    <!-- Search & Selects Row -->
                    <div class="client-actions-search-row">
                        <div class="client-search-input-wrap">
                            <i data-lucide="search" class="client-search-icon"></i>
                            <input type="text" id="input-client-doc-search" class="client-search-input" placeholder="Пошук документа..." value="${escapeHtml(searchKeyword)}" />
                        </div>

                        ${projects.length > 1 ? `
                            <select id="select-client-doc-project" class="client-select-input">
                                <option value="all" ${selectedProjectId === 'all' ? 'selected' : ''}>Всі проєкти</option>
                                ${projects.map(p => `
                                    <option value="${p.id}" ${selectedProjectId === p.id ? 'selected' : ''}>
                                        ${escapeHtml(p.name || p.title)}
                                    </option>
                                `).join("")}
                            </select>
                        ` : ''}

                        ${categories.length > 1 ? `
                            <select id="select-client-doc-category" class="client-select-input">
                                <option value="all" ${selectedCategory === 'all' ? 'selected' : ''}>Всі категорії</option>
                                ${categories.map(c => `
                                    <option value="${c}" ${selectedCategory === c ? 'selected' : ''}>
                                        ${escapeHtml(c)}
                                    </option>
                                `).join("")}
                            </select>
                        ` : ''}
                    </div>
                </div>
            </div>

            <!-- Documents Grid / List -->
            ${displayedDocs.length === 0 ? `
                <div class="client-card" style="text-align: center; padding: 60px 20px;">
                    <div class="portal-empty-icon" style="color: var(--text-muted); margin-bottom: 16px;">
                        <i data-lucide="file-text" style="width: 48px; height: 48px;"></i>
                    </div>
                    <h3 style="font-size: 1.15rem; font-weight: 600; margin-bottom: 8px;">Матеріали ще готуються</h3>
                    <p style="color: var(--text-secondary); max-width: 440px; margin: 0 auto;">
                        Документи будуть опубліковані командою FIRSTWIN відповідно до етапів дорожньої карти.
                    </p>
                </div>
            ` : `
                <div class="client-doc-grid">
                    ${displayedDocs.map(d => renderDocWorkspaceCard(d)).join("")}
                </div>
            `}
        </div>
    `;
}

function renderDocWorkspaceCard(d) {
    const latestVer = d.latestVersion;
    const hasFile = !!latestVer;
    const statusBadge = getDocStatusBadge(d.status);
    const projectName = d.project?.name || d.project?.title || "Проєкт";

    return `
        <div class="client-card client-doc-card" onclick="window.location.hash = '#/client/documents/${d.id}'" style="cursor: pointer;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 10px;">
                <span class="client-badge client-badge-neutral" style="font-size: 0.75rem;">
                    <i data-lucide="folder" style="width: 11px; height: 11px;"></i> ${escapeHtml(projectName)}
                </span>
                <span class="client-badge ${statusBadge.badgeClass}">${statusBadge.label}</span>
            </div>

            <div style="display: flex; gap: 6px; margin-bottom: 6px;">
                <span class="client-project-type-tag" style="font-size: 0.75rem;">${escapeHtml(d.category)}</span>
            </div>

            <h4 class="client-doc-card-title">${escapeHtml(d.title)}</h4>
            ${d.description ? `<p class="client-doc-card-desc">${escapeHtml(d.description)}</p>` : ''}

            <div class="client-doc-card-footer">
                <div class="client-doc-card-ver">
                    ${hasFile ? `
                        <i data-lucide="file-check" style="width: 13px; height: 13px; color: var(--color-success);"></i>
                        Версія v${latestVer.version_number} (${formatFileSize(latestVer.size_bytes)})
                    ` : `
                        <i data-lucide="clock" style="width: 13px; height: 13px; color: var(--text-muted);"></i>
                        Готується
                    `}
                </div>
                <div class="client-doc-card-link">
                    <span>Переглянути</span>
                    <i data-lucide="arrow-right" style="width: 13px; height: 13px;"></i>
                </div>
            </div>
        </div>
    `;
}

export function initClientDocumentsEvents(documents = [], projects = [], onFilterChange) {
    if (window.lucide) window.lucide.createIcons();

    // Status Pills
    document.querySelectorAll("#client-doc-status-pills .client-filter-pill").forEach(pill => {
        pill.addEventListener("click", () => {
            selectedStatus = pill.dataset.status;
            if (onFilterChange) {
                onFilterChange({ category: selectedCategory, projectId: selectedProjectId, status: selectedStatus, search: searchKeyword });
            }
        });
    });

    // Project Select
    document.getElementById("select-client-doc-project")?.addEventListener("change", (e) => {
        selectedProjectId = e.target.value;
        if (onFilterChange) {
            onFilterChange({ category: selectedCategory, projectId: selectedProjectId, status: selectedStatus, search: searchKeyword });
        }
    });

    // Category Select
    document.getElementById("select-client-doc-category")?.addEventListener("change", (e) => {
        selectedCategory = e.target.value;
        if (onFilterChange) {
            onFilterChange({ category: selectedCategory, projectId: selectedProjectId, status: selectedStatus, search: searchKeyword });
        }
    });

    // Search Input
    let searchTimeout;
    document.getElementById("input-client-doc-search")?.addEventListener("input", (e) => {
        clearTimeout(searchTimeout);
        searchKeyword = e.target.value;
        searchTimeout = setTimeout(() => {
            if (onFilterChange) {
                onFilterChange({ category: selectedCategory, projectId: selectedProjectId, status: selectedStatus, search: searchKeyword });
            }
        }, 250);
    });
}

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
