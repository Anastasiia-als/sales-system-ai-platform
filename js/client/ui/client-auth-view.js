/* js/client/ui/client-auth-view.js - Client Portal Login & Activation Screens */

import { PortalAuth } from "../../portal/auth/auth-service.js";
import { DataClient } from "../../portal/api/data-client.js";
import { getSupabase } from "../../portal/api/supabase-client.js";

export function renderClientLoginView() {
    return `
        <div class="client-auth-wrapper">
            <div class="client-auth-card">
                <!-- Branding Header -->
                <div class="client-auth-header">
                    <div class="client-auth-logo">
                        <span class="client-logo-accent">FIRSTWIN</span>
                    </div>
                    <h2 class="client-auth-title">Вхід до Client Workspace</h2>
                    <p class="client-auth-desc">Доступ до Roadmap, статусів та матеріалів вашого проєкту</p>
                </div>

                <!-- Tabs: Password / Magic Link -->
                <div class="client-auth-tabs">
                    <button class="client-auth-tab active" id="tab-auth-password" data-mode="password">Пароль</button>
                    <button class="client-auth-tab" id="tab-auth-magic" data-mode="magic">Швидкий вхід без пароля</button>
                </div>

                <!-- Form Container -->
                <div class="client-auth-body">
                    <!-- Password Form -->
                    <form id="form-client-password-login" class="client-auth-form">
                        <div class="portal-form-group">
                            <label class="portal-label">Робочий Email</label>
                            <input type="email" id="client-login-email" class="portal-input" placeholder="name@company.com" required autocomplete="email" />
                        </div>
                        <div class="portal-form-group">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <label class="portal-label">Пароль</label>
                                <a href="javascript:void(0)" id="link-forgot-password" style="font-size: 0.78rem; color: var(--color-primary);">Забули пароль?</a>
                            </div>
                            <input type="password" id="client-login-password" class="portal-input" placeholder="••••••••" required autocomplete="current-password" />
                        </div>
                        <div id="client-login-error" class="client-auth-error" style="display: none;"></div>
                        <button type="submit" class="btn btn-primary client-auth-submit-btn" id="btn-submit-password-login">
                            <span>Увійти в кабінет</span>
                            <i data-lucide="arrow-right" style="width: 16px; height: 16px;"></i>
                        </button>
                    </form>

                    <!-- Magic Link Form -->
                    <form id="form-client-magic-login" class="client-auth-form" style="display: none;">
                        <div class="portal-form-group">
                            <label class="portal-label">Робочий Email</label>
                            <input type="email" id="client-magic-email" class="portal-input" placeholder="name@company.com" required />
                        </div>
                        <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0 0 16px 0; line-height: 1.4;">
                            Ми надішлемо безпечне одноразове посилання для миттєвого входу на вашу пошту.
                        </p>
                        <div id="client-magic-error" class="client-auth-error" style="display: none;"></div>
                        <div id="client-magic-success" class="client-auth-success" style="display: none;"></div>
                        <button type="submit" class="btn btn-primary client-auth-submit-btn" id="btn-submit-magic-login">
                            <span>Отримати посилання</span>
                            <i data-lucide="send" style="width: 16px; height: 16px;"></i>
                        </button>
                    </form>
                </div>

                <div class="client-auth-footer">
                    <span>Потрібна допомога з доступом?</span>
                    <a href="mailto:support@firstwin.io" style="color: var(--color-primary);">Зв'язатися з підтримкою</a>
                </div>
            </div>
        </div>
    `;
}

export function initClientLoginEvents(onLoginSuccess) {
    if (window.lucide) window.lucide.createIcons();

    // Tab switching
    const tabPassword = document.getElementById("tab-auth-password");
    const tabMagic = document.getElementById("tab-auth-magic");
    const formPassword = document.getElementById("form-client-password-login");
    const formMagic = document.getElementById("form-client-magic-login");

    tabPassword?.addEventListener("click", () => {
        tabPassword.classList.add("active");
        tabMagic?.classList.remove("active");
        if (formPassword) formPassword.style.display = "block";
        if (formMagic) formMagic.style.display = "none";
    });

    tabMagic?.addEventListener("click", () => {
        tabMagic.classList.add("active");
        tabPassword?.classList.remove("active");
        if (formMagic) formMagic.style.display = "block";
        if (formPassword) formPassword.style.display = "none";
    });

    // Password Login submit
    formPassword?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("client-login-email")?.value.trim();
        const password = document.getElementById("client-login-password")?.value;
        const errBox = document.getElementById("client-login-error");
        const submitBtn = document.getElementById("btn-submit-password-login");

        if (errBox) errBox.style.display = "none";
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="portal-spinner" style="width:16px;height:16px;border-width:2px;"></span> Авторизація...`;
        }

        try {
            const { data, error } = await PortalAuth.signInWithPassword(email, password);
            if (error) {
                if (errBox) {
                    errBox.textContent = error.message.includes("Invalid login credentials")
                        ? "Невірний email або пароль."
                        : error.message;
                    errBox.style.display = "block";
                }
            } else {
                // Ensure client portal access activation check
                await DataClient.activateClientPortalAccess();
                if (onLoginSuccess) await onLoginSuccess();
            }
        } catch (err) {
            if (errBox) {
                errBox.textContent = err.message;
                errBox.style.display = "block";
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<span>Увійти в кабінет</span><i data-lucide="arrow-right" style="width: 16px; height: 16px;"></i>`;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    });

    // Magic link submit
    formMagic?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("client-magic-email")?.value.trim();
        const errBox = document.getElementById("client-magic-error");
        const successBox = document.getElementById("client-magic-success");
        const submitBtn = document.getElementById("btn-submit-magic-login");

        if (errBox) errBox.style.display = "none";
        if (successBox) successBox.style.display = "none";

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="portal-spinner" style="width:16px;height:16px;border-width:2px;"></span> Надсилання...`;
        }

        try {
            const { error } = await PortalAuth.signInWithOtp(email);
            if (error) {
                if (errBox) {
                    errBox.textContent = error.message;
                    errBox.style.display = "block";
                }
            } else {
                if (successBox) {
                    successBox.textContent = "Посилання для входу надіслано на вашу пошту. Перевірте inbox!";
                    successBox.style.display = "block";
                }
            }
        } catch (err) {
            if (errBox) {
                errBox.textContent = err.message;
                errBox.style.display = "block";
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<span>Отримати посилання</span><i data-lucide="send" style="width: 16px; height: 16px;"></i>`;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    });

}

export function renderClientActivateView() {
    return `
        <div class="client-auth-wrapper">
            <div class="client-auth-card">
                <div class="client-auth-header">
                    <div class="client-auth-logo">
                        <span class="client-logo-accent">FIRSTWIN</span>
                    </div>
                    <h2 class="client-auth-title">Активація кабінету клієнта</h2>
                    <p class="client-auth-desc">Встановіть надійний пароль для регулярного входу в систему</p>
                </div>

                <div class="client-auth-body">
                    <form id="form-client-activate" class="client-auth-form">
                        <div class="portal-form-group">
                            <label class="portal-label">Встановіть новий пароль</label>
                            <input type="password" id="client-activate-password" class="portal-input" placeholder="Мінімум 8 символів" minlength="8" required />
                        </div>
                        <div class="portal-form-group">
                            <label class="portal-label">Підтвердіть пароль</label>
                            <input type="password" id="client-activate-password-confirm" class="portal-input" placeholder="Повторіть пароль" minlength="8" required />
                        </div>
                        <div id="client-activate-error" class="client-auth-error" style="display: none;"></div>
                        <button type="submit" class="btn btn-primary client-auth-submit-btn" id="btn-submit-activate">
                            <span>Активувати та перейти в кабінет</span>
                            <i data-lucide="check" style="width: 16px; height: 16px;"></i>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    `;
}

export function initClientActivateEvents(onActivateSuccess) {
    if (window.lucide) window.lucide.createIcons();

    const form = document.getElementById("form-client-activate");
    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const pwd = document.getElementById("client-activate-password")?.value;
        const confirmPwd = document.getElementById("client-activate-password-confirm")?.value;
        const errBox = document.getElementById("client-activate-error");
        const btn = document.getElementById("btn-submit-activate");

        if (errBox) errBox.style.display = "none";

        if (pwd !== confirmPwd) {
            if (errBox) {
                errBox.textContent = "Паролі не співпадають.";
                errBox.style.display = "block";
            }
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="portal-spinner" style="width:16px;height:16px;border-width:2px;"></span> Активація...`;
        }

        try {
            const supabase = await getSupabase();
            if (supabase) {
                // Update password for active auth session
                const { error: pwdErr } = await supabase.auth.updateUser({ password: pwd });
                if (pwdErr) throw pwdErr;
            }

            // Call activation RPC
            await DataClient.activateClientPortalAccess();

            if (onActivateSuccess) await onActivateSuccess();
        } catch (err) {
            if (errBox) {
                errBox.textContent = err.message;
                errBox.style.display = "block";
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<span>Активувати та перейти в кабінет</span><i data-lucide="check" style="width: 16px; height: 16px;"></i>`;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    });
}
