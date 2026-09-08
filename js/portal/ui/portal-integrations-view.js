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
                    <p class="portal-view-subtitle">Керування вихідними вебхуками, сповіщеннями Telegram та журналом доставок</p>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-outline" id="btn-create-calendar">
                        <i data-lucide="calendar"></i> Додати Календар (iCal)
                    </button>
                    <button class="btn btn-outline" id="btn-create-telegram">
                        <i data-lucide="send"></i> Підключити Telegram
                    </button>
                    <button class="btn btn-primary" id="btn-create-webhook">
                        <i data-lucide="plus"></i> Додати Webhook
                    </button>
                </div>
            </div>

            <!-- Organization Context Bar -->
            <div class="portal-card" style="padding: 12px 16px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <label for="integrations-org-select" style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary);">Організація / Клієнт:</label>
                    <select id="integrations-org-select" class="portal-select" style="min-width: 240px;">
                        <option value="">Завантаження організацій...</option>
                    </select>
                </div>
                <div id="integrations-org-badge" style="font-size: 0.8rem; color: var(--text-muted);">Керування інтеграціями обраної організації</div>
            </div>

            <!-- Tabs: Endpoints, Telegram, Calendars & Delivery Log -->
            <div class="portal-tabs" style="display: flex; gap: 12px; margin-bottom: 20px; border-bottom: 1px solid var(--border-color, #e2e8f0); padding-bottom: 8px;">
                <button class="btn btn-sm btn-outline active" id="tab-btn-endpoints">
                    <i data-lucide="webhook"></i> Кінцеві точки (Webhooks)
                </button>
                <button class="btn btn-sm btn-outline" id="tab-btn-telegram">
                    <i data-lucide="send"></i> Telegram канали
                </button>
                <button class="btn btn-sm btn-outline" id="tab-btn-calendars">
                    <i data-lucide="calendar"></i> Календарі (iCal)
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

            <!-- Telegram Destinations Section -->
            <div id="section-telegram" class="portal-card" style="display: none; margin-bottom: 24px;">
                <div class="portal-card-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <h2 class="portal-card-title">Підключені Telegram напрямки</h2>
                    <button class="btn btn-sm btn-ghost" id="btn-refresh-telegram" title="Оновити">
                        <i data-lucide="refresh-cw"></i>
                    </button>
                </div>
                <div class="portal-table-wrapper">
                    <table class="portal-table">
                        <thead>
                            <tr>
                                <th>Назва та опис</th>
                                <th>Чат / Канал</th>
                                <th>Бот</th>
                                <th>Підписані події</th>
                                <th>Статус</th>
                                <th>Дата створення</th>
                                <th style="text-align: right;">Дії</th>
                            </tr>
                        </thead>
                        <tbody id="telegram-table-body">
                            <tr>
                                <td colspan="7" style="text-align: center; padding: 24px;">
                                    <div class="portal-spinner" style="margin: 0 auto;"></div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Calendars Section (RFC 5545 iCal - Phase 7C) -->
            <div id="section-calendars" class="portal-card" style="display: none; margin-bottom: 24px;">
                <div class="portal-card-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <h2 class="portal-card-title">Підписки на Календарі (RFC 5545 iCalendar)</h2>
                    <button class="btn btn-sm btn-ghost" id="btn-refresh-calendars" title="Оновити">
                        <i data-lucide="refresh-cw"></i>
                    </button>
                </div>
                <div class="portal-table-wrapper">
                    <table class="portal-table">
                        <thead>
                            <tr>
                                <th>Назва підписки</th>
                                <th>Область (Scope)</th>
                                <th>Проєкт</th>
                                <th>Створив</th>
                                <th>Прев'ю токена</th>
                                <th>Останній доступ</th>
                                <th>Запитів</th>
                                <th>Статус</th>
                                <th style="text-align: right;">Дії</th>
                            </tr>
                        </thead>
                        <tbody id="calendars-table-body">
                            <tr>
                                <td colspan="9" style="text-align: center; padding: 24px;">
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
            <div id="modal-create-webhook" class="portal-modal-backdrop portal-modal-overlay" style="display: none;">
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
            <div id="modal-webhook-secret-reveal" class="portal-modal-backdrop portal-modal-overlay" style="display: none;">
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

            <!-- Create Telegram Destination Modal -->
            <div id="modal-create-telegram" class="portal-modal-backdrop portal-modal-overlay" style="display: none;">
                <div class="portal-modal" style="max-width: 560px;">
                    <div class="portal-modal-header">
                        <h3 class="portal-modal-title">Підключити Telegram канал або групу</h3>
                        <button class="portal-modal-close" id="btn-close-create-tg-modal">&times;</button>
                    </div>
                    <div class="portal-modal-body">
                        <div class="form-group" style="margin-bottom: 14px;">
                            <label class="form-label" for="tg-create-org">Організація / Клієнт *</label>
                            <select id="tg-create-org" class="portal-select" required></select>
                        </div>
                        <div class="form-group" style="margin-bottom: 14px;">
                            <label class="form-label" for="tg-name">Назва підключення *</label>
                            <input type="text" id="tg-name" class="portal-input" placeholder="напр., Alerts Team Chat, Client Notifications" required>
                        </div>
                        <div class="form-group" style="margin-bottom: 14px;">
                            <label class="form-label" for="tg-desc">Опис (необов'язково)</label>
                            <input type="text" id="tg-desc" class="portal-input" placeholder="Призначення чату чи теми">
                        </div>
                        <div class="form-group" style="margin-bottom: 14px;">
                            <label class="form-label" for="tg-token">Telegram Bot Token *</label>
                            <input type="password" id="tg-token" class="portal-input" placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ" autocomplete="new-password" required>
                            <span class="form-hint" style="font-size: 0.75rem; color: var(--text-muted);">
                                Отримується у @BotFather. Зберігається виключно у зашифрованому Vault і ніколи не повертається у відкритому вигляді.
                            </span>
                        </div>
                        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px; margin-bottom: 14px;">
                            <div class="form-group">
                                <label class="form-label" for="tg-chat-id">Chat ID *</label>
                                <input type="text" id="tg-chat-id" class="portal-input" placeholder="-1001234567890 або @channel" required>
                                <span class="form-hint" style="font-size: 0.75rem; color: var(--text-muted);">
                                    Для груп/супергруп ID починається з мінуса (-100...)
                                </span>
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="tg-thread-id">Topic ID (опціонально)</label>
                                <input type="number" id="tg-thread-id" class="portal-input" placeholder="напр. 42">
                                <span class="form-hint" style="font-size: 0.75rem; color: var(--text-muted);">
                                    Тільки для Forum Supergroups
                                </span>
                            </div>
                        </div>

                        <!-- Connection Test Button & Alert -->
                        <div style="margin-bottom: 16px;">
                            <button type="button" class="btn btn-sm btn-outline" id="btn-test-tg-connection" style="width: 100%;">
                                <i data-lucide="shield-check"></i> Перевірити з'єднання (getMe + getChat)
                            </button>
                            <div id="tg-test-result" style="margin-top: 8px; font-size: 0.85rem; display: none;"></div>
                        </div>

                        <div class="form-group" style="margin-bottom: 14px;">
                            <label class="form-label">Підписка на події</label>
                            <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 6px;">
                                <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer;">
                                    <input type="checkbox" id="tg-evt-all" value="*" checked>
                                    <strong>Всі події (*)</strong>
                                </label>
                                <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer;">
                                    <input type="checkbox" class="tg-evt-item" value="task.completed">
                                    <span>Завдання виконано (task.completed)</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer;">
                                    <input type="checkbox" class="tg-evt-item" value="stage.completed">
                                    <span>Етап завершено (stage.completed)</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer;">
                                    <input type="checkbox" class="tg-evt-item" value="document.approved">
                                    <span>Документ погоджено (document.approved)</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer;">
                                    <input type="checkbox" class="tg-evt-item" value="client_action.completed">
                                    <span>Дію клієнта виконано (client_action.completed)</span>
                                </label>
                            </div>
                        </div>
                        <div id="create-tg-error" style="color: var(--color-danger, #ef4444); font-size: 0.85rem; margin-top: 8px; display: none;"></div>
                    </div>
                    <div class="portal-modal-footer">
                        <button class="btn btn-ghost" id="btn-cancel-create-tg">Скасувати</button>
                        <button class="btn btn-primary" id="btn-submit-create-tg">Підключити Telegram</button>
                    </div>
                </div>
            </div>

            <!-- Create Calendar Feed Modal (Phase 7C) -->
            <div id="modal-create-calendar" class="portal-modal-backdrop portal-modal-overlay" style="display: none;">
                <div class="portal-modal" style="max-width: 540px;">
                    <div class="portal-modal-header">
                        <h3 class="portal-modal-title">Створити iCal календарну підписку</h3>
                        <button class="portal-modal-close" id="btn-close-create-cal-modal">&times;</button>
                    </div>
                    <div class="portal-modal-body">
                        <div class="form-group" style="margin-bottom: 14px;">
                            <label for="cal-create-org" style="font-weight: 600; font-size: 0.85rem;">Організація:</label>
                            <select id="cal-create-org" class="portal-select" style="width: 100%;" disabled>
                                <option value="">Оберіть організацію</option>
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom: 14px;">
                            <label for="cal-name" style="font-weight: 600; font-size: 0.85rem;">Назва календаря: <span style="color: red;">*</span></label>
                            <input type="text" id="cal-name" class="portal-input" placeholder="напр., Мій робочий розклад чи Календар проєкту" style="width: 100%;">
                        </div>
                        <div class="form-group" style="margin-bottom: 14px;">
                            <label for="cal-scope" style="font-weight: 600; font-size: 0.85rem;">Область видимості (Scope): <span style="color: red;">*</span></label>
                            <select id="cal-scope" class="portal-select" style="width: 100%;">
                                <option value="personal">Персональний (тільки призначені мені етапи та завдання)</option>
                                <option value="project">Проєкт (всі етапи та завдання обраного проєкту)</option>
                                <option value="organization">Організація (всі активні проєкти та завдання організації)</option>
                                <option value="client">Клієнтський (тільки клієнтські етапи та задачі обраного проєкту)</option>
                            </select>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
                                Для областей «Проєкт» та «Клієнтський» обов'язково вкажіть конкретний проєкт.
                            </div>
                        </div>
                        <div class="form-group" id="cal-project-group" style="margin-bottom: 14px; display: none;">
                            <label for="cal-project" style="font-weight: 600; font-size: 0.85rem;">Проєкт: <span style="color: red;">*</span></label>
                            <select id="cal-project" class="portal-select" style="width: 100%;">
                                <option value="">Завантаження проєктів...</option>
                            </select>
                        </div>
                        <div id="create-cal-error" style="color: var(--color-danger, #ef4444); font-size: 0.85rem; margin-top: 8px; display: none;"></div>
                    </div>
                    <div class="portal-modal-footer">
                        <button class="btn btn-ghost" id="btn-cancel-create-cal">Скасувати</button>
                        <button class="btn btn-primary" id="btn-submit-create-cal">Згенерувати посилання</button>
                    </div>
                </div>
            </div>

            <!-- Show Calendar Token Modal (Phase 7C) -->
            <div id="modal-show-calendar-token" class="portal-modal-backdrop portal-modal-overlay" style="display: none;">
                <div class="portal-modal" style="max-width: 600px;">
                    <div class="portal-modal-header">
                        <h3 class="portal-modal-title">Посилання на iCal календар</h3>
                        <button class="portal-modal-close" id="btn-close-cal-token-modal">&times;</button>
                    </div>
                    <div class="portal-modal-body">
                        <div class="portal-alert portal-alert-warning" style="margin-bottom: 16px; font-size: 0.85rem; background: #fffbeb; border: 1px solid #fef3c7; color: #92400e; padding: 12px; border-radius: 6px;">
                            <strong>Важливо:</strong> Повний токен генерується одноразово. Збережіть або підключіть посилання до вашого календаря зараз. У системі зберігається виключно криптографічний хеш SHA-256.
                        </div>
                        <div class="form-group" style="margin-bottom: 16px;">
                            <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 6px;">
                                Посилання підписки (webcal://) — для Apple Calendar, Google Calendar, Outlook:
                            </label>
                            <div style="display: flex; gap: 8px;">
                                <input type="text" id="cal-webcal-url-input" class="portal-input" readonly style="flex: 1; font-family: monospace; font-size: 0.8rem; background: var(--bg-surface-alt, #f8fafc);">
                                <button class="btn btn-primary btn-sm" id="btn-copy-cal-webcal">Копіювати</button>
                            </div>
                        </div>
                        <div class="form-group" style="margin-bottom: 16px;">
                            <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 6px;">
                                Прямий HTTPS URL:
                            </label>
                            <div style="display: flex; gap: 8px;">
                                <input type="text" id="cal-https-url-input" class="portal-input" readonly style="flex: 1; font-family: monospace; font-size: 0.8rem; background: var(--bg-surface-alt, #f8fafc);">
                                <button class="btn btn-outline btn-sm" id="btn-copy-cal-https">Копіювати</button>
                            </div>
                        </div>
                    </div>
                    <div class="portal-modal-footer">
                        <button class="btn btn-primary" id="btn-confirm-cal-token">Зрозуміло, закрити</button>
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
            const tgOrgSelect = document.getElementById("tg-create-org");
            if (tgOrgSelect) tgOrgSelect.value = currentOrgId;
            const calOrgSelect = document.getElementById("cal-create-org");
            if (calOrgSelect) calOrgSelect.value = currentOrgId;

            const isDeliveriesActive = document.getElementById("tab-btn-deliveries")?.classList.contains("active");
            const isTelegramActive = document.getElementById("tab-btn-telegram")?.classList.contains("active");
            const isCalendarsActive = document.getElementById("tab-btn-calendars")?.classList.contains("active");
            if (isDeliveriesActive) {
                await loadDeliveries(currentOrgId);
            } else if (isTelegramActive) {
                await loadTelegramDestinations(currentOrgId);
            } else if (isCalendarsActive) {
                await loadCalendars(currentOrgId);
            } else {
                await loadEndpoints(currentOrgId);
            }
        });
    }

    // Populate Organization in Create Modals
    const createOrgSelect = document.getElementById("wh-create-org");
    if (createOrgSelect) {
        createOrgSelect.innerHTML = accessibleOrgs.map(o => `
            <option value="${o.id}" ${o.id === currentOrgId ? "selected" : ""}>
                ${escapeHtml(o.name || "Організація")}
            </option>
        `).join("");
    }
    const tgCreateOrgSelect = document.getElementById("tg-create-org");
    if (tgCreateOrgSelect) {
        tgCreateOrgSelect.innerHTML = accessibleOrgs.map(o => `
            <option value="${o.id}" ${o.id === currentOrgId ? "selected" : ""}>
                ${escapeHtml(o.name || "Організація")}
            </option>
        `).join("");
    }
    const calCreateOrgSelect = document.getElementById("cal-create-org");
    if (calCreateOrgSelect) {
        calCreateOrgSelect.innerHTML = accessibleOrgs.map(o => `
            <option value="${o.id}" ${o.id === currentOrgId ? "selected" : ""}>
                ${escapeHtml(o.name || "Організація")}
            </option>
        `).join("");
    }

    // Tab Switching: Endpoints, Telegram, Calendars, Deliveries
    const tabEndpoints = document.getElementById("tab-btn-endpoints");
    const tabTelegram = document.getElementById("tab-btn-telegram");
    const tabCalendars = document.getElementById("tab-btn-calendars");
    const tabDeliveries = document.getElementById("tab-btn-deliveries");
    const secEndpoints = document.getElementById("section-endpoints");
    const secTelegram = document.getElementById("section-telegram");
    const secCalendars = document.getElementById("section-calendars");
    const secDeliveries = document.getElementById("section-deliveries");

    tabEndpoints?.addEventListener("click", () => {
        tabEndpoints.classList.add("active");
        tabTelegram?.classList.remove("active");
        tabCalendars?.classList.remove("active");
        tabDeliveries?.classList.remove("active");
        if (secEndpoints) secEndpoints.style.display = "block";
        if (secTelegram) secTelegram.style.display = "none";
        if (secCalendars) secCalendars.style.display = "none";
        if (secDeliveries) secDeliveries.style.display = "none";
        loadEndpoints(currentOrgId);
    });

    tabTelegram?.addEventListener("click", () => {
        tabTelegram.classList.add("active");
        tabEndpoints?.classList.remove("active");
        tabCalendars?.classList.remove("active");
        tabDeliveries?.classList.remove("active");
        if (secTelegram) secTelegram.style.display = "block";
        if (secEndpoints) secEndpoints.style.display = "none";
        if (secCalendars) secCalendars.style.display = "none";
        if (secDeliveries) secDeliveries.style.display = "none";
        loadTelegramDestinations(currentOrgId);
    });

    tabCalendars?.addEventListener("click", () => {
        tabCalendars.classList.add("active");
        tabEndpoints?.classList.remove("active");
        tabTelegram?.classList.remove("active");
        tabDeliveries?.classList.remove("active");
        if (secCalendars) secCalendars.style.display = "block";
        if (secEndpoints) secEndpoints.style.display = "none";
        if (secTelegram) secTelegram.style.display = "none";
        if (secDeliveries) secDeliveries.style.display = "none";
        loadCalendars(currentOrgId);
    });

    tabDeliveries?.addEventListener("click", () => {
        tabDeliveries.classList.add("active");
        tabEndpoints?.classList.remove("active");
        tabTelegram?.classList.remove("active");
        tabCalendars?.classList.remove("active");
        if (secDeliveries) secDeliveries.style.display = "block";
        if (secEndpoints) secEndpoints.style.display = "none";
        if (secTelegram) secTelegram.style.display = "none";
        if (secCalendars) secCalendars.style.display = "none";
        loadDeliveries(currentOrgId);
    });

    // Refresh buttons
    document.getElementById("btn-refresh-endpoints")?.addEventListener("click", () => loadEndpoints(currentOrgId));
    document.getElementById("btn-refresh-telegram")?.addEventListener("click", () => loadTelegramDestinations(currentOrgId));
    document.getElementById("btn-refresh-calendars")?.addEventListener("click", () => loadCalendars(currentOrgId));
    document.getElementById("btn-refresh-deliveries")?.addEventListener("click", () => loadDeliveries(currentOrgId));

    // Create Webhook Modal handling
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

    // Event checkboxes logic for Webhook
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

    // Create Telegram Destination Modal handling (Phase 7B)
    const modalCreateTg = document.getElementById("modal-create-telegram");
    const btnCreateTg = document.getElementById("btn-create-telegram");
    const btnCloseCreateTg = document.getElementById("btn-close-create-tg-modal");
    const btnCancelCreateTg = document.getElementById("btn-cancel-create-tg");
    const btnSubmitCreateTg = document.getElementById("btn-submit-create-tg");
    const btnTestTg = document.getElementById("btn-test-tg-connection");
    const tgTestResult = document.getElementById("tg-test-result");
    const tgErrBox = document.getElementById("create-tg-error");

    btnCreateTg?.addEventListener("click", () => {
        if (modalCreateTg) modalCreateTg.style.display = "flex";
        if (tgErrBox) tgErrBox.style.display = "none";
        if (tgTestResult) tgTestResult.style.display = "none";
        const cOrg = document.getElementById("tg-create-org");
        if (cOrg && currentOrgId) cOrg.value = currentOrgId;
        const nameInput = document.getElementById("tg-name");
        const descInput = document.getElementById("tg-desc");
        const tokenInput = document.getElementById("tg-token");
        const chatIdInput = document.getElementById("tg-chat-id");
        const threadIdInput = document.getElementById("tg-thread-id");
        if (nameInput) nameInput.value = "";
        if (descInput) descInput.value = "";
        if (tokenInput) tokenInput.value = "";
        if (chatIdInput) chatIdInput.value = "";
        if (threadIdInput) threadIdInput.value = "";
    });

    const hideCreateTgModal = () => {
        if (modalCreateTg) modalCreateTg.style.display = "none";
    };
    btnCloseCreateTg?.addEventListener("click", hideCreateTgModal);
    btnCancelCreateTg?.addEventListener("click", hideCreateTgModal);

    // Event checkboxes logic for Telegram
    const tgChkAll = document.getElementById("tg-evt-all");
    const tgItemCheckboxes = document.querySelectorAll(".tg-evt-item");
    tgChkAll?.addEventListener("change", (e) => {
        if (e.target.checked) {
            tgItemCheckboxes.forEach(cb => cb.checked = false);
        }
    });
    tgItemCheckboxes.forEach(cb => {
        cb.addEventListener("change", () => {
            if (cb.checked && tgChkAll) tgChkAll.checked = false;
        });
    });

    function showTgError(msg) {
        if (tgErrBox) {
            tgErrBox.innerText = msg;
            tgErrBox.style.display = "block";
        }
    }

    // Test Telegram Connection
    btnTestTg?.addEventListener("click", async () => {
        const token = document.getElementById("tg-token")?.value?.trim();
        const chatId = document.getElementById("tg-chat-id")?.value?.trim();
        const threadId = document.getElementById("tg-thread-id")?.value?.trim();

        if (!token) {
            showTgError("Введіть Telegram Bot Token для перевірки");
            return;
        }
        if (!chatId) {
            showTgError("Введіть Chat ID для перевірки");
            return;
        }

        if (tgErrBox) tgErrBox.style.display = "none";
        btnTestTg.disabled = true;
        btnTestTg.innerHTML = `<div class="portal-spinner" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 6px;"></div> Перевірка...`;

        try {
            const res = await DataClient.verifyTelegramConnection({
                botToken: token,
                chatId,
                threadId: threadId ? Number(threadId) : null
            });

            if (tgTestResult) {
                tgTestResult.style.display = "block";
                if (res.ok) {
                    tgTestResult.innerHTML = `
                        <div style="padding: 10px; border-radius: 6px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); color: var(--color-success, #10b981);">
                            <strong>✓ З'єднання успішне!</strong>
                            <div style="font-size: 0.8rem; margin-top: 4px; color: var(--text-color);">
                                Бот: <strong>@${escapeHtml(res.bot.username)}</strong> (${escapeHtml(res.bot.first_name)})<br>
                                Чат: <strong>${escapeHtml(res.chat.title)}</strong> [${escapeHtml(res.chat.type)}]
                            </div>
                        </div>
                    `;
                } else {
                    tgTestResult.innerHTML = `
                        <div style="padding: 10px; border-radius: 6px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: var(--color-danger, #ef4444);">
                            <strong>✕ Перевірка не пройшла:</strong> ${escapeHtml(res.error || res.reason || "Невідома помилка")}
                        </div>
                    `;
                }
            }
        } catch (e) {
            if (tgTestResult) {
                tgTestResult.style.display = "block";
                tgTestResult.innerHTML = `<div style="color: var(--color-danger, #ef4444);">Помилка мережі: ${escapeHtml(e.message)}</div>`;
            }
        } finally {
            btnTestTg.disabled = false;
            btnTestTg.innerHTML = `<i data-lucide="shield-check"></i> Перевірити з'єднання (getMe + getChat)`;
            if (window.lucide) window.lucide.createIcons();
        }
    });

    // Submit Create Telegram Destination
    btnSubmitCreateTg?.addEventListener("click", async () => {
        const chosenOrgId = document.getElementById("tg-create-org")?.value || currentOrgId;
        const name = document.getElementById("tg-name")?.value?.trim();
        const desc = document.getElementById("tg-desc")?.value?.trim();
        const token = document.getElementById("tg-token")?.value?.trim();
        const chatId = document.getElementById("tg-chat-id")?.value?.trim();
        const threadId = document.getElementById("tg-thread-id")?.value?.trim();

        if (!chosenOrgId) {
            showTgError("Оберіть організацію");
            return;
        }
        if (!name) {
            showTgError("Вкажіть назву підключення");
            return;
        }
        if (!token) {
            showTgError("Вкажіть Telegram Bot Token");
            return;
        }
        if (!chatId) {
            showTgError("Вкажіть Chat ID");
            return;
        }

        let eventTypes = [];
        if (tgChkAll?.checked) {
            eventTypes = ["task.completed", "stage.completed", "document.approved", "client_action.completed"];
        } else {
            tgItemCheckboxes.forEach(cb => {
                if (cb.checked) eventTypes.push(cb.value);
            });
            if (eventTypes.length === 0) {
                eventTypes = ["task.completed", "stage.completed", "document.approved", "client_action.completed"];
            }
        }

        btnSubmitCreateTg.disabled = true;
        btnSubmitCreateTg.innerText = "Підключення...";

        try {
            const { data, error } = await DataClient.createTelegramDestination({
                organizationId: chosenOrgId,
                name,
                description: desc,
                botToken: token,
                chatId,
                threadId: threadId ? Number(threadId) : null,
                eventTypes
            });

            if (error) {
                if (error.code === "23505" || error.message?.includes("duplicate") || error.message?.includes("uq_telegram_dest_active_endpoint")) {
                    showTgError("Такий активний напрямок Telegram (той самий бот, чат та тема) вже існує для цієї організації.");
                } else {
                    showTgError(error.message || "Помилка при підключенні Telegram");
                }
                btnSubmitCreateTg.disabled = false;
                btnSubmitCreateTg.innerText = "Підключити Telegram";
                return;
            }

            hideCreateTgModal();
            // Switch to Telegram tab to show new connection
            tabTelegram?.click();
        } catch (e) {
            showTgError(e.message || "Непередбачена помилка");
        } finally {
            btnSubmitCreateTg.disabled = false;
            btnSubmitCreateTg.innerText = "Підключити Telegram";
        }
    });

    // Calendar Feed Modal Handling (Phase 7C)
    const modalCreateCal = document.getElementById("modal-create-calendar");
    const btnCreateCal = document.getElementById("btn-create-calendar");
    const btnCloseCreateCal = document.getElementById("btn-close-create-cal-modal");
    const btnCancelCreateCal = document.getElementById("btn-cancel-create-cal");
    const btnSubmitCreateCal = document.getElementById("btn-submit-create-cal");
    const calScopeSelect = document.getElementById("cal-scope");
    const calProjectGroup = document.getElementById("cal-project-group");
    const calProjectSelect = document.getElementById("cal-project");
    const createCalError = document.getElementById("create-cal-error");

    const modalShowCalToken = document.getElementById("modal-show-calendar-token");
    const btnCloseCalToken = document.getElementById("btn-close-cal-token-modal");
    const btnConfirmCalToken = document.getElementById("btn-confirm-cal-token");
    const calWebcalInput = document.getElementById("cal-webcal-url-input");
    const calHttpsInput = document.getElementById("cal-https-url-input");
    const btnCopyWebcal = document.getElementById("btn-copy-cal-webcal");
    const btnCopyHttps = document.getElementById("btn-copy-cal-https");

    async function loadProjectsForCalendarSelect(orgId) {
        if (!calProjectSelect || !orgId) return;
        calProjectSelect.innerHTML = `<option value="">Завантаження проєктів...</option>`;
        try {
            const { data: projects, error } = await DataClient.getProjects({ organizationId: orgId, status: "all" });
            if (error) {
                console.error("Failed to load projects for calendar select:", error);
                calProjectSelect.innerHTML = `<option value="">Помилка завантаження проєктів</option>`;
                return;
            }

            const seenIds = new Set();
            const seenNames = new Set();
            const deduplicated = [];

            // Sort by created_at DESC so the newest project for any given name is prioritized
            const validProjects = (projects || [])
                .filter(p => p.status !== 'archived')
                .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

            for (const p of validProjects) {
                const normName = (p.name || p.title || '').trim().toLowerCase();
                if (!p.id || seenIds.has(p.id) || seenNames.has(normName)) {
                    continue;
                }
                seenIds.add(p.id);
                seenNames.add(normName);
                deduplicated.push(p);
            }

            if (deduplicated.length === 0) {
                calProjectSelect.innerHTML = `<option value="">Немає доступних проєктів</option>`;
            } else {
                calProjectSelect.innerHTML = `
                    <option value="">Оберіть проєкт...</option>
                    ${deduplicated.map(p => `
                        <option value="${p.id}">${escapeHtml(p.name || p.title)}</option>
                    `).join("")}
                `;
            }
        } catch (err) {
            console.error("Error populating calendar projects:", err);
            calProjectSelect.innerHTML = `<option value="">Помилка завантаження проєктів</option>`;
        }
    }

    btnCreateCal?.addEventListener("click", async () => {
        if (modalCreateCal) modalCreateCal.style.display = "flex";
        if (createCalError) createCalError.style.display = "none";
        const cOrg = document.getElementById("cal-create-org");
        if (cOrg && currentOrgId) cOrg.value = currentOrgId;
        const nameInput = document.getElementById("cal-name");
        if (nameInput) nameInput.value = "";
        if (calScopeSelect) calScopeSelect.value = "personal";
        if (calProjectGroup) calProjectGroup.style.display = "none";

        // Preload projects for dropdown
        await loadProjectsForCalendarSelect(currentOrgId);
    });

    const hideCreateCalModal = () => {
        if (modalCreateCal) modalCreateCal.style.display = "none";
    };
    btnCloseCreateCal?.addEventListener("click", hideCreateCalModal);
    btnCancelCreateCal?.addEventListener("click", hideCreateCalModal);

    calScopeSelect?.addEventListener("change", async (e) => {
        const val = e.target.value;
        if (val === "project" || val === "client") {
            if (calProjectGroup) calProjectGroup.style.display = "block";
            await loadProjectsForCalendarSelect(currentOrgId);
        } else {
            if (calProjectGroup) calProjectGroup.style.display = "none";
        }
    });

    btnSubmitCreateCal?.addEventListener("click", async () => {
        const chosenOrgId = document.getElementById("cal-create-org")?.value || currentOrgId;
        const name = document.getElementById("cal-name")?.value?.trim();
        const scope = calScopeSelect?.value || "personal";
        const projectId = (scope === "project" || scope === "client") ? calProjectSelect?.value : null;

        if (!chosenOrgId) {
            if (createCalError) {
                createCalError.textContent = "Оберіть організацію";
                createCalError.style.display = "block";
            }
            return;
        }
        if (!name) {
            if (createCalError) {
                createCalError.textContent = "Вкажіть назву підписки на календар";
                createCalError.style.display = "block";
            }
            return;
        }
        if ((scope === "project" || scope === "client") && !projectId) {
            if (createCalError) {
                createCalError.textContent = "Для обраної області необхідно обрати конкретний проєкт";
                createCalError.style.display = "block";
            }
            return;
        }

        btnSubmitCreateCal.disabled = true;
        btnSubmitCreateCal.innerText = "Генерація...";

        try {
            const { data, error } = await DataClient.createCalendarFeed({
                organizationId: chosenOrgId,
                name,
                feedScope: scope,
                projectId
            });

            if (error) {
                if (createCalError) {
                    createCalError.textContent = error.message || "Помилка створення календарної підписки";
                    createCalError.style.display = "block";
                }
                btnSubmitCreateCal.disabled = false;
                btnSubmitCreateCal.innerText = "Згенерувати посилання";
                return;
            }

            hideCreateCalModal();

            // Display single-use presentation modal
            if (modalShowCalToken && data) {
                if (calWebcalInput) calWebcalInput.value = data.webcal_url || "";
                if (calHttpsInput) calHttpsInput.value = data.https_url || "";
                modalShowCalToken.style.display = "flex";
            }

            tabCalendars?.click();
            await loadCalendars(currentOrgId);
        } catch (e) {
            if (createCalError) {
                createCalError.textContent = e.message || "Непередбачена помилка";
                createCalError.style.display = "block";
            }
        } finally {
            btnSubmitCreateCal.disabled = false;
            btnSubmitCreateCal.innerText = "Згенерувати посилання";
        }
    });

    const hideShowTokenModal = () => {
        if (modalShowCalToken) modalShowCalToken.style.display = "none";
    };
    btnCloseCalToken?.addEventListener("click", hideShowTokenModal);
    btnConfirmCalToken?.addEventListener("click", hideShowTokenModal);

    btnCopyWebcal?.addEventListener("click", () => {
        if (calWebcalInput?.value) {
            navigator.clipboard.writeText(calWebcalInput.value);
            btnCopyWebcal.textContent = "Скопійовано!";
            setTimeout(() => { btnCopyWebcal.textContent = "Копіювати"; }, 2000);
        }
    });

    btnCopyHttps?.addEventListener("click", () => {
        if (calHttpsInput?.value) {
            navigator.clipboard.writeText(calHttpsInput.value);
            btnCopyHttps.textContent = "Скопійовано!";
            setTimeout(() => { btnCopyHttps.textContent = "Копіювати"; }, 2000);
        }
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

async function loadTelegramDestinations(orgId = currentOrgId) {
    const tbody = document.getElementById("telegram-table-body");
    if (!tbody) return;

    if (!orgId) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 32px; color: var(--text-muted);">
                    Оберіть організацію для перегляду Telegram напрямків.
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

    const { data: destinations, error } = await DataClient.getTelegramDestinations(orgId);
    if (error || !destinations || destinations.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 32px; color: var(--text-muted);">
                    Немає підключених Telegram напрямків. Натисніть «Підключити Telegram», щоб налаштувати бота для сповіщень.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = destinations.map(dest => {
        const eventsBadges = (dest.event_types || []).map(evt => 
            `<span class="badge badge-subtle" style="font-size: 0.75rem; margin-right: 4px;">${escapeHtml(evt)}</span>`
        ).join("");

        const statusBadge = dest.is_active
            ? `<span class="badge badge-success">Активний</span>`
            : `<span class="badge badge-neutral">Неактивний</span>`;

        const dateStr = dest.created_at ? new Date(dest.created_at).toLocaleDateString("uk-UA") : "—";
        const threadBadge = dest.thread_id ? `<span class="badge badge-neutral" style="font-size: 0.7rem; margin-left: 4px;">Topic: ${dest.thread_id}</span>` : "";

        return `
            <tr data-telegram-id="${dest.id}">
                <td>
                    <div style="font-weight: 500;">${escapeHtml(dest.name)}</div>
                    ${dest.description ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(dest.description)}</div>` : ""}
                </td>
                <td>
                    <div style="font-weight: 500; font-size: 0.85rem;">${escapeHtml(dest.chat_title || "Чат")} ${threadBadge}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">ID: ${escapeHtml(dest.chat_id)} (${escapeHtml(dest.chat_type || "чат")})</div>
                </td>
                <td>
                    <div style="font-family: monospace; font-size: 0.85rem; color: #0284c7;">@${escapeHtml(dest.bot_username || "bot")}</div>
                </td>
                <td>${eventsBadges}</td>
                <td>${statusBadge}</td>
                <td style="font-size: 0.85rem; color: var(--text-muted);">${dateStr}</td>
                <td style="text-align: right;">
                    <button class="btn btn-sm btn-ghost btn-toggle-tg-active" data-id="${dest.id}" data-active="${dest.is_active}" title="${dest.is_active ? 'Деактивувати' : 'Активувати'}">
                        <i data-lucide="${dest.is_active ? 'pause-circle' : 'play-circle'}"></i>
                    </button>
                    <button class="btn btn-sm btn-ghost text-danger btn-delete-tg" data-id="${dest.id}" title="Видалити">
                        <i data-lucide="trash-2"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join("");

    if (window.lucide) window.lucide.createIcons();

    // Attach row action listeners
    tbody.querySelectorAll(".btn-toggle-tg-active").forEach(btn => {
        btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-id");
            const currentActive = btn.getAttribute("data-active") === "true";
            btn.disabled = true;
            await DataClient.toggleTelegramDestinationActive(id, !currentActive);
            await loadTelegramDestinations(currentOrgId);
        });
    });

    tbody.querySelectorAll(".btn-delete-tg").forEach(btn => {
        btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-id");
            if (!confirm("Видалити це підключення Telegram?")) return;
            btn.disabled = true;
            const { error } = await DataClient.deleteTelegramDestination(id);
            if (error) {
                // If historical outbox entries exist, trigger raises 23001
                if (error.code === "23001" || error.message?.includes("history")) {
                    alert("Неможливо видалити напрямок Telegram з історією доставок. За правилами аудиту деактивуйте його замість видалення.");
                } else {
                    alert("Помилка видалення: " + error.message);
                }
                btn.disabled = false;
                return;
            }
            await loadTelegramDestinations(currentOrgId);
        });
    });
}

async function loadCalendars(orgId = currentOrgId) {
    const tbody = document.getElementById("calendars-table-body");
    if (!tbody) return;

    if (!orgId) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 32px; color: var(--text-muted);">
                    Оберіть організацію для перегляду календарних підписок.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = `
        <tr>
            <td colspan="9" style="text-align: center; padding: 24px;">
                <div class="portal-spinner" style="margin: 0 auto;"></div>
            </td>
        </tr>
    `;

    const { data: feeds, error } = await DataClient.getCalendarFeeds(orgId);
    if (error || !feeds || feeds.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 32px; color: var(--text-muted);">
                    Немає створених календарних підписок. Натисніть «Додати Календар (iCal)», щоб згенерувати посилання для Apple Calendar, Google Calendar чи Outlook.
                </td>
            </tr>
        `;
        return;
    }

    const scopeLabels = {
        personal: "Персональний",
        project: "Проєкт",
        organization: "Організація",
        client: "Клієнтський"
    };

    tbody.innerHTML = feeds.map(feed => {
        const scopeLabel = scopeLabels[feed.feed_scope] || feed.feed_scope;
        let scopeBadgeClass = "badge-neutral";
        if (feed.feed_scope === "personal") scopeBadgeClass = "badge-subtle";
        else if (feed.feed_scope === "project") scopeBadgeClass = "badge-primary";
        else if (feed.feed_scope === "organization") scopeBadgeClass = "badge-warning";
        else if (feed.feed_scope === "client") scopeBadgeClass = "badge-success";

        const statusBadge = feed.is_active
            ? `<span class="badge badge-success">Активний</span>`
            : `<span class="badge badge-danger">Відкликаний</span>`;

        const lastAccess = feed.last_accessed_at ? new Date(feed.last_accessed_at).toLocaleString("uk-UA") : "—";
        const dateStr = feed.created_at ? new Date(feed.created_at).toLocaleDateString("uk-UA") : "—";

        return `
            <tr data-feed-id="${feed.id}">
                <td>
                    <div style="font-weight: 500;">
                        <i data-lucide="calendar" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px; color: #0284c7;"></i>
                        ${escapeHtml(feed.name)}
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">Створено: ${dateStr}</div>
                </td>
                <td><span class="badge ${scopeBadgeClass}">${escapeHtml(scopeLabel)}</span></td>
                <td style="font-size: 0.85rem;">${escapeHtml(feed.project_name || "—")}</td>
                <td style="font-size: 0.85rem; color: var(--text-secondary);">${escapeHtml(feed.creator_name || "—")}</td>
                <td><code style="font-size: 0.75rem; background: var(--bg-surface-alt, #f1f5f9); padding: 2px 6px; border-radius: 4px;">${escapeHtml(feed.token_preview)}...</code></td>
                <td style="font-size: 0.85rem; color: var(--text-muted);">${lastAccess}</td>
                <td style="font-size: 0.85rem; font-weight: 600; text-align: center;">${feed.access_count || 0}</td>
                <td>${statusBadge}</td>
                <td style="text-align: right; white-space: nowrap;">
                    <button class="btn btn-sm btn-ghost btn-rotate-cal" data-id="${feed.id}" title="Перевипустити токен">
                        <i data-lucide="refresh-cw"></i>
                    </button>
                    <button class="btn btn-sm btn-ghost btn-revoke-cal" data-id="${feed.id}" data-active="${feed.is_active}" title="${feed.is_active ? 'Відкликати доступ' : 'Активувати'}">
                        <i data-lucide="${feed.is_active ? 'slash' : 'check-circle'}"></i>
                    </button>
                    <button class="btn btn-sm btn-ghost text-danger btn-delete-cal" data-id="${feed.id}" title="Видалити">
                        <i data-lucide="trash-2"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join("");

    if (window.lucide) window.lucide.createIcons();

    // Attach row action listeners
    tbody.querySelectorAll(".btn-revoke-cal").forEach(btn => {
        btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-id");
            btn.disabled = true;
            await DataClient.revokeCalendarFeed(id, currentOrgId);
            await loadCalendars(currentOrgId);
        });
    });

    tbody.querySelectorAll(".btn-rotate-cal").forEach(btn => {
        btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-id");
            if (!confirm("Ви впевнені, що бажаєте перевипустити токен для цього календаря? Попереднє посилання негайно перестане працювати.")) {
                return;
            }
            btn.disabled = true;
            const { data, error } = await DataClient.rotateCalendarFeed(id, currentOrgId);
            if (error) {
                alert("Помилка перевипуску: " + error.message);
                btn.disabled = false;
                return;
            }
            if (data) {
                const modalShowCalToken = document.getElementById("modal-show-calendar-token");
                const calWebcalInput = document.getElementById("cal-webcal-url-input");
                const calHttpsInput = document.getElementById("cal-https-url-input");
                if (modalShowCalToken && calWebcalInput && calHttpsInput) {
                    calWebcalInput.value = data.webcal_url || "";
                    calHttpsInput.value = data.https_url || "";
                    modalShowCalToken.style.display = "flex";
                }
            }
            await loadCalendars(currentOrgId);
        });
    });

    tbody.querySelectorAll(".btn-delete-cal").forEach(btn => {
        btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-id");
            if (!confirm("Видалити цю календарну підписку назавжди?")) {
                return;
            }
            btn.disabled = true;
            const { error } = await DataClient.deleteCalendarFeed(id, currentOrgId);
            if (error) {
                alert("Помилка видалення: " + error.message);
                btn.disabled = false;
                return;
            }
            await loadCalendars(currentOrgId);
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

        const isTelegram = d.channel_type === "telegram";
        const destIcon = isTelegram
            ? `<i data-lucide="send" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px; color: #0284c7;"></i>`
            : `<i data-lucide="webhook" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px; color: #6366f1;"></i>`;

        const destSubtext = isTelegram
            ? `Chat: ${escapeHtml(d.chat_id || "—")} ${d.bot_username ? '(@' + escapeHtml(d.bot_username) + ')' : ''}`
            : escapeHtml(d.url_masked || "");

        return `
            <tr>
                <td style="font-size: 0.85rem; color: var(--text-muted);">${dateStr}</td>
                <td><span class="badge badge-subtle">${escapeHtml(d.event_type)}</span></td>
                <td>
                    <div style="font-weight: 500;">${destIcon} ${escapeHtml(d.destination_name || (isTelegram ? "Telegram" : "Webhook"))}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">${destSubtext}</div>
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
