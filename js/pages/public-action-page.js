/* js/pages/public-action-page.js - Public Client Action Page Component (Phase 6D.2) */

import { getSupabase } from "../portal/api/supabase-client.js";

// Canonical allowed extensions
const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'csv', 'png', 'jpg', 'jpeg', 'zip', 'txt'];
const FORBIDDEN_EXTENSIONS = ['exe', 'bat', 'cmd', 'sh', 'js', 'py', 'vbs', 'php', 'jar', 'msi', 'bin', 'dll'];
const MAX_FILES = 5;
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFheXF5ZGNkZnhobHdpemhmanVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQyNjY5MzgsImV4cCI6MjAzOTg0MjkzOH0.W5q9Rj2YmX3f9Fk0_1Z5X5r6nQ_l1bQ6j3_x1Z8y9wE';
const SUPABASE_REST_URL = 'https://aayqydcdfxhlwizhfjun.supabase.co/rest/v1/rpc';

function escapeHtml(str) {
    if (!str || typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export const PublicActionPage = {
    // Transient in-memory state only - NEVER persisted to localStorage or DOM
    _state: {
        status: 'LOADING', // 'LOADING' | 'ACTIVE' | 'SUBMITTING' | 'SUCCESS' | 'ALREADY_COMPLETED' | 'EXPIRED' | 'REVOKED' | 'NOT_FOUND' | 'RATE_LIMITED' | 'NETWORK_ERROR'
        token: null,
        actionData: null,
        formText: '',
        files: [],
        errorMessage: null,
        successData: null
    },

    render() {
        return `
            <div class="public-action-wrapper" id="public-action-root">
                <div class="public-action-brand">
                    <span class="logo-text"><span class="logo-accent">FIRSTWIN</span> | Sales System</span>
                </div>
                <div class="public-action-container" id="public-action-container">
                    ${this._renderStateContent()}
                </div>
            </div>
        `;
    },

    _renderStateContent() {
        const s = this._state;

        switch (s.status) {
            case 'LOADING':
                return `
                    <div class="public-state-card" id="state-loading">
                        <div class="public-spinner" style="width: 44px; height: 44px; margin-bottom: 20px; border-width: 3px; border-top-color: #3B82F6;"></div>
                        <h2 class="public-state-title">Завантаження дії...</h2>
                        <p class="public-state-desc">Перевіряємо дійсність посилання безпеки.</p>
                    </div>
                `;

            case 'ALREADY_COMPLETED':
                return `
                    <div class="public-state-card" id="state-already-completed">
                        <div class="public-state-icon success">
                            <i data-lucide="check-circle-2"></i>
                        </div>
                        <h2 class="public-state-title">Дію вже виконано</h2>
                        <p class="public-state-desc">
                            «${escapeHtml(s.actionData?.title || 'Запит клієнта')}» вже успішно виконано та збережено в системі.
                        </p>
                        <div class="public-security-badge" style="margin-bottom: 0;">
                            <i data-lucide="shield-check"></i> Захищений одноразовий токен використано
                        </div>
                    </div>
                `;

            case 'EXPIRED':
                return `
                    <div class="public-state-card" id="state-expired">
                        <div class="public-state-icon warning">
                            <i data-lucide="clock"></i>
                        </div>
                        <h2 class="public-state-title">Термін дії посилання вичерпано</h2>
                        <p class="public-state-desc">
                            Термін дії цього одноразового посилання безпеки минув. Будь ласка, зверніться до вашого проектного менеджера для отримання нового посилання.
                        </p>
                        <div class="public-security-badge" style="background: rgba(245, 158, 11, 0.1); border-color: rgba(245, 158, 11, 0.2); color: #FBBF24;">
                            <i data-lucide="shield-alert"></i> 14-денний ліміт активності вичерпано
                        </div>
                    </div>
                `;

            case 'REVOKED':
                return `
                    <div class="public-state-card" id="state-revoked">
                        <div class="public-state-icon danger">
                            <i data-lucide="ban"></i>
                        </div>
                        <h2 class="public-state-title">Посилання більше недоступне</h2>
                        <p class="public-state-desc">
                            Це посилання було відкликане адміністратором або замінене новішим. Будь ласка, перевірте останній лист або зв'яжіться з менеджером.
                        </p>
                    </div>
                `;

            case 'NOT_FOUND':
                return `
                    <div class="public-state-card" id="state-not-found">
                        <div class="public-state-icon danger">
                            <i data-lucide="alert-triangle"></i>
                        </div>
                        <h2 class="public-state-title">Дію не знайдено</h2>
                        <p class="public-state-desc">
                            Посилання недійсне або містить некоректний ключ доступу. Перевірте правильність введеної адреси.
                        </p>
                    </div>
                `;

            case 'RATE_LIMITED':
                return `
                    <div class="public-state-card" id="state-rate-limited">
                        <div class="public-state-icon warning">
                            <i data-lucide="shield-alert"></i>
                        </div>
                        <h2 class="public-state-title">Забагато спроб доступу</h2>
                        <p class="public-state-desc">
                            З міркувань безпеки частота запитів тимчасово обмежена. Зачекайте 1 хвилину та оновіть сторінку.
                        </p>
                        <button class="public-btn-secondary" onclick="window.location.reload()">
                            <i data-lucide="refresh-cw"></i> Оновити зараз
                        </button>
                    </div>
                `;

            case 'NETWORK_ERROR':
                return `
                    <div class="public-state-card" id="state-network-error">
                        <div class="public-state-icon warning">
                            <i data-lucide="wifi-off"></i>
                        </div>
                        <h2 class="public-state-title">Помилка з'єднання</h2>
                        <p class="public-state-desc">
                            ${escapeHtml(s.errorMessage || "Не вдалося з'єднатися з сервером. Будь ласка, перевірте підключення.")}
                        </p>
                        <button class="public-btn-secondary" id="public-action-retry-btn">
                            <i data-lucide="refresh-cw"></i> Спробувати знову
                        </button>
                    </div>
                `;

            case 'SUCCESS':
                return `
                    <div class="public-state-card" id="state-success">
                        <div class="public-state-icon success">
                            <i data-lucide="check"></i>
                        </div>
                        <h2 class="public-state-title">Дію успішно надіслано!</h2>
                        <p class="public-state-desc">
                            Дякуємо! Ваша відповідь для «${escapeHtml(s.actionData?.title || '')}» прийнята та збережена в проекті <strong>${escapeHtml(s.actionData?.project_name || '')}</strong>.
                        </p>
                        <div class="public-security-badge" style="background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.2); color: #34D399; margin-bottom: 24px;">
                            <i data-lucide="shield-check"></i> Захищене одноразове виконання зафіксовано
                        </div>
                        <div style="font-size: 0.85rem; color: #64748B;">
                            Команда вже отримала сповіщення та опрацьовує надіслані матеріали.
                        </div>
                    </div>
                `;

            case 'ACTIVE':
            case 'SUBMITTING':
            default:
                const isSubmitting = s.status === 'SUBMITTING';
                const act = s.actionData || {};
                const dueDate = act.due_date ? new Date(act.due_date).toLocaleDateString('uk-UA') : null;

                return `
                    <div id="state-active">
                        <div class="public-security-badge">
                            <i data-lucide="shield-check"></i> Захищена форма дій клієнта • FIRSTWIN Security Core
                        </div>

                        <div class="public-action-header">
                            <h1 class="public-action-title">${escapeHtml(act.title || 'Дія клієнта')}</h1>
                            <div class="public-action-meta-row">
                                ${act.project_name ? `
                                    <div class="public-action-meta-item">
                                        <i data-lucide="folder"></i>
                                        <span>Проєкт: <strong>${escapeHtml(act.project_name)}</strong></span>
                                    </div>
                                ` : ''}
                                ${act.organization_name ? `
                                    <div class="public-action-meta-item">
                                        <i data-lucide="building"></i>
                                        <span>Компанія: <strong>${escapeHtml(act.organization_name)}</strong></span>
                                    </div>
                                ` : ''}
                                ${dueDate ? `
                                    <div class="public-action-meta-item">
                                        <i data-lucide="calendar"></i>
                                        <span>Дедлайн: <strong>${escapeHtml(dueDate)}</strong></span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>

                        ${act.description ? `
                            <div class="public-action-desc-box">${escapeHtml(act.description)}</div>
                        ` : ''}

                        ${s.errorMessage ? `
                            <div class="public-alert danger" id="public-action-error-box">
                                <i data-lucide="alert-circle"></i>
                                <span>${escapeHtml(s.errorMessage)}</span>
                            </div>
                        ` : ''}

                        <form id="public-action-form" onsubmit="return false;">
                            <div class="public-form-group">
                                <label class="public-form-label" for="public-action-text-input">
                                    Ваша відповідь / Коментар
                                    <span class="required-mark">*</span>
                                </label>
                                <textarea 
                                    id="public-action-text-input" 
                                    class="public-form-control" 
                                    placeholder="Введіть текст відповіді або коментар до задачі..."
                                    ${isSubmitting ? 'disabled' : ''}
                                    maxlength="10000"
                                    rows="4"
                                >${escapeHtml(s.formText)}</textarea>
                            </div>

                            <div class="public-form-group">
                                <label class="public-form-label">
                                    Додати файли (до 5 файлів, макс. 25 MB кожен)
                                </label>
                                <div class="public-dropzone" id="public-dropzone">
                                    <input 
                                        type="file" 
                                        id="public-file-input" 
                                        class="public-file-input-hidden" 
                                        multiple 
                                        accept=".pdf,.docx,.xlsx,.csv,.png,.jpg,.jpeg,.zip,.txt"
                                        ${isSubmitting ? 'disabled' : ''}
                                    />
                                    <div class="public-dropzone-icon">
                                        <i data-lucide="upload-cloud"></i>
                                    </div>
                                    <div class="public-dropzone-title">Перетягніть файли сюди або натисніть для вибору</div>
                                    <div class="public-dropzone-hint">Підтримуються PDF, Word, Excel, CSV, PNG, JPG, ZIP (до 25 MB)</div>
                                </div>

                                <div class="public-file-queue" id="public-file-queue">
                                    ${s.files.map((file, idx) => `
                                        <div class="public-file-item" data-file-idx="${idx}">
                                            <div class="public-file-info">
                                                <i data-lucide="file-text" style="color: #60A5FA; flex-shrink: 0;"></i>
                                                <span class="public-file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
                                                <span class="public-file-size">(${formatBytes(file.size)})</span>
                                            </div>
                                            ${!isSubmitting ? `
                                                <button type="button" class="public-file-remove-btn" data-remove-idx="${idx}" title="Видалити">
                                                    <i data-lucide="x"></i>
                                                </button>
                                            ` : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            </div>

                            <button 
                                type="button" 
                                id="public-action-submit-btn" 
                                class="public-btn-primary" 
                                ${isSubmitting ? 'disabled' : ''}
                            >
                                ${isSubmitting ? `
                                    <div class="public-spinner"></div>
                                    <span>Надсилання...</span>
                                ` : `
                                    <i data-lucide="send"></i>
                                    <span>Надіслати відповідь</span>
                                `}
                            </button>
                        </form>
                    </div>
                `;
        }
    },

    async init() {
        // Extract raw token from route hash: #/action/:token
        const hash = window.location.hash || '';
        const tokenMatch = hash.match(/^#\/action\/([a-zA-Z0-9_-]+)/);
        const token = tokenMatch ? tokenMatch[1] : null;

        this._state.token = token;
        this._state.status = 'LOADING';
        this._state.errorMessage = null;
        this._state.files = [];
        this._state.formText = '';
        this._reRender();

        if (!token || token.length < 8) {
            this._state.status = 'NOT_FOUND';
            this._reRender();
            return;
        }

        await this._loadActionDetails();
    },

    async _loadActionDetails() {
        const token = this._state.token;
        try {
            const supabase = await getSupabase();
            let data = null;
            let error = null;

            if (supabase) {
                const res = await supabase.rpc('get_public_client_action', { p_raw_token: token });
                data = res.data;
                error = res.error;
            } else {
                // Direct REST API fallback
                const configRes = await fetch(`${SUPABASE_REST_URL}/get_public_client_action`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                    },
                    body: JSON.stringify({ p_raw_token: token })
                });
                if (!configRes.ok) {
                    if (configRes.status === 429) {
                        this._state.status = 'RATE_LIMITED';
                        this._reRender();
                        return;
                    }
                    throw new Error("HTTP error " + configRes.status);
                }
                data = await configRes.json();
            }

            if (error) {
                console.error("[PublicActionPage] Lookup error:", error);
                this._state.status = 'NETWORK_ERROR';
                this._state.errorMessage = "Не вдалося завантажити дію. Перевірте з'єднання.";
                this._reRender();
                return;
            }

            // Differentiated state handling
            if (!data || data.status === 'not_found') {
                this._state.status = 'NOT_FOUND';
            } else if (data.status === 'already_used' || data.is_completed === true) {
                this._state.status = 'ALREADY_COMPLETED';
                this._state.actionData = data;
            } else if (data.status === 'expired') {
                this._state.status = 'EXPIRED';
                this._state.actionData = data;
            } else if (data.status === 'revoked') {
                this._state.status = 'REVOKED';
                this._state.actionData = data;
            } else if (data.status === 'active') {
                this._state.status = 'ACTIVE';
                this._state.actionData = data;
            } else {
                this._state.status = 'NOT_FOUND';
            }

            this._reRender();
        } catch (e) {
            console.error("[PublicActionPage] Network exception during load:", e);
            this._state.status = 'NETWORK_ERROR';
            this._state.errorMessage = e.message || "Помилка підключення до сервера.";
            this._reRender();
        }
    },

    _reRender() {
        const container = document.getElementById("public-action-container");
        if (container) {
            container.innerHTML = this._renderStateContent();
            if (window.lucide) {
                window.lucide.createIcons();
            }
            this._bindEventListeners();
        }
    },

    _bindEventListeners() {
        const s = this._state;

        // Retry button in Network Error state
        const retryBtn = document.getElementById("public-action-retry-btn");
        if (retryBtn) {
            retryBtn.onclick = () => {
                this._state.status = 'LOADING';
                this._reRender();
                this._loadActionDetails();
            };
        }

        // Active State Controls
        if (s.status === 'ACTIVE') {
            const textInput = document.getElementById("public-action-text-input");
            if (textInput) {
                textInput.oninput = (e) => {
                    this._state.formText = e.target.value;
                };
            }

            const fileInput = document.getElementById("public-file-input");
            const dropzone = document.getElementById("public-dropzone");

            if (fileInput && dropzone) {
                dropzone.ondragover = (e) => {
                    e.preventDefault();
                    dropzone.classList.add('dragover');
                };

                dropzone.ondragleave = (e) => {
                    e.preventDefault();
                    dropzone.classList.remove('dragover');
                };

                dropzone.ondrop = (e) => {
                    e.preventDefault();
                    dropzone.classList.remove('dragover');
                    if (e.dataTransfer?.files) {
                        this._handleFilesSelected(Array.from(e.dataTransfer.files));
                    }
                };

                fileInput.onchange = (e) => {
                    if (e.target.files) {
                        this._handleFilesSelected(Array.from(e.target.files));
                        fileInput.value = ''; // Reset for consecutive same-file selection
                    }
                };
            }

            // Remove file button delegators
            const removeBtns = document.querySelectorAll(".public-file-remove-btn");
            removeBtns.forEach(btn => {
                btn.onclick = (e) => {
                    const idx = parseInt(btn.getAttribute('data-remove-idx'), 10);
                    if (!isNaN(idx) && idx >= 0 && idx < this._state.files.length) {
                        this._state.files.splice(idx, 1);
                        this._state.errorMessage = null;
                        this._reRender();
                    }
                };
            });

            // Submit Button
            const submitBtn = document.getElementById("public-action-submit-btn");
            if (submitBtn) {
                submitBtn.onclick = () => this._handleSubmit();
            }
        }
    },

    _handleFilesSelected(newFiles) {
        if (!newFiles || newFiles.length === 0) return;

        let error = null;
        const currentCount = this._state.files.length;

        if (currentCount + newFiles.length > MAX_FILES) {
            this._state.errorMessage = `Максимальна кількість файлів — ${MAX_FILES}. Ви вже додали ${currentCount}.`;
            this._reRender();
            return;
        }

        for (const file of newFiles) {
            const ext = file.name.split('.').pop().toLowerCase();

            if (FORBIDDEN_EXTENSIONS.includes(ext)) {
                error = `Файл «${file.name}» має заборонений формат (.${ext}). Виконувані файли та скрипти відхилено.`;
                break;
            }

            if (!ALLOWED_EXTENSIONS.includes(ext)) {
                error = `Формат файлу «${file.name}» не підтримується. Дозволено: ${ALLOWED_EXTENSIONS.join(', ')}.`;
                break;
            }

            if (file.size > MAX_FILE_SIZE_BYTES) {
                error = `Файл «${file.name}» перевищує ліміт 25 MB (розмір: ${formatBytes(file.size)}).`;
                break;
            }
        }

        if (error) {
            this._state.errorMessage = error;
            this._reRender();
            return;
        }

        this._state.errorMessage = null;
        for (const file of newFiles) {
            this._state.files.push(file);
        }
        this._reRender();
    },

    async _handleSubmit() {
        const s = this._state;
        if (s.status === 'SUBMITTING') return; // Double-click guard

        // Ensure text is captured from textarea DOM element if not already in memory
        const textEl = document.getElementById("public-action-text-input");
        if (textEl) {
            s.formText = textEl.value;
        }

        const text = (s.formText || '').trim();
        if (!text && s.files.length === 0) {
            this._state.errorMessage = "Будь ласка, введіть відповідь або прикріпіть файли перед надсиланням.";
            this._reRender();
            return;
        }

        // Lock UI in Submitting State
        this._state.status = 'SUBMITTING';
        this._state.errorMessage = null;
        this._reRender();

        try {
            // Process Attachments metadata
            const attachmentsPayload = [];
            for (const file of s.files) {
                attachmentsPayload.push({
                    name: file.name,
                    size: file.size,
                    type: file.type || 'application/octet-stream',
                    last_modified: file.lastModified || Date.now()
                });
            }

            const payload = {
                text: text,
                attachments: attachmentsPayload,
                submitted_at: new Date().toISOString()
            };

            const token = s.token;
            const supabase = await getSupabase();
            let result = null;

            if (supabase) {
                const res = await supabase.rpc('submit_public_client_action', {
                    p_raw_token: token,
                    p_payload: payload
                });
                if (res.error) throw res.error;
                result = res.data;
            } else {
                const fetchRes = await fetch(`${SUPABASE_REST_URL}/submit_public_client_action`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                    },
                    body: JSON.stringify({
                        p_raw_token: token,
                        p_payload: payload
                    })
                });
                if (!fetchRes.ok) {
                    const errData = await fetchRes.json().catch(() => ({}));
                    throw new Error(errData.message || "Помилка при надсиланні (" + fetchRes.status + ")");
                }
                result = await fetchRes.json();
            }

            // Submission Success: clear token and transition state
            this._state.token = null;
            this._state.files = [];
            this._state.formText = '';
            this._state.status = 'SUCCESS';
            this._state.successData = result;
            this._reRender();
        } catch (e) {
            console.error("[PublicActionPage] Submit failure:", e);
            this._state.status = 'ACTIVE';
            this._state.errorMessage = e.message || "Не вдалося надіслати форму. Спробуйте ще раз.";
            this._reRender();
        }
    }
};
