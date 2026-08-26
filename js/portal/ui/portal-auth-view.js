/* js/portal/ui/portal-auth-view.js - Portal Authentication Screen */

import { PortalAuth } from "../auth/auth-service.js";

export function renderPortalAuthView() {
    return `
        <div class="portal-auth-container">
            <div class="portal-auth-card">
                <div class="portal-auth-header">
                    <div class="portal-brand-logo" style="width: 48px; height: 48px; font-size: 1.4rem;">FW</div>
                    <h2 style="font-size: 1.5rem; margin-top: 8px;">FIRSTWIN Portal</h2>
                    <p style="font-size: 0.85rem; color: var(--text-secondary);">Вхід до платформи ведення клієнтів та проєктів</p>
                </div>

                <div class="portal-auth-tabs">
                    <button class="portal-auth-tab-btn active" id="btn-tab-pwd">Пароль</button>
                    <button class="portal-auth-tab-btn" id="btn-tab-otp">Magic Link / OTP</button>
                    <button class="portal-auth-tab-btn" id="btn-tab-reset">Відновлення</button>
                </div>

                <!-- 1. Password Login Form -->
                <form id="portal-form-pwd" style="display: flex; flex-direction: column; gap: 16px;">
                    <div class="portal-form-group">
                        <label class="portal-label">Email</label>
                        <input type="email" id="auth-email-pwd" class="portal-input" placeholder="owner@firstwin.com" required autocomplete="email" />
                    </div>
                    <div class="portal-form-group">
                        <label class="portal-label">Пароль</label>
                        <input type="password" id="auth-password" class="portal-input" placeholder="••••••••" required autocomplete="current-password" />
                    </div>
                    <div id="auth-error-pwd" style="color: var(--color-danger); font-size: 0.82rem; display: none;"></div>
                    <button type="submit" class="btn btn-primary" id="btn-submit-pwd" style="width: 100%; justify-content: center; margin-top: 8px;">
                        <i data-lucide="log-in"></i> Увійти
                    </button>
                </form>

                <!-- 2. Magic Link / OTP Form -->
                <form id="portal-form-otp" style="display: none; flex-direction: column; gap: 16px;">
                    <div class="portal-form-group">
                        <label class="portal-label">Email</label>
                        <input type="email" id="auth-email-otp" class="portal-input" placeholder="owner@firstwin.com" required autocomplete="email" />
                    </div>
                    <p style="font-size: 0.78rem; color: var(--text-muted); margin: -4px 0 4px;">
                        Ми надішлемо одноразове посилання для безпечного входу без пароля.
                    </p>
                    <div id="auth-msg-otp" style="font-size: 0.82rem; display: none;"></div>
                    <button type="submit" class="btn btn-primary" id="btn-submit-otp" style="width: 100%; justify-content: center; margin-top: 8px;">
                        <i data-lucide="send"></i> Надіслати посилання
                    </button>
                </form>

                <!-- 3. Reset Password Form -->
                <form id="portal-form-reset" style="display: none; flex-direction: column; gap: 16px;">
                    <div class="portal-form-group">
                        <label class="portal-label">Email для відновлення</label>
                        <input type="email" id="auth-email-reset" class="portal-input" placeholder="owner@firstwin.com" required autocomplete="email" />
                    </div>
                    <div id="auth-msg-reset" style="font-size: 0.82rem; display: none;"></div>
                    <button type="submit" class="btn btn-primary" id="btn-submit-reset" style="width: 100%; justify-content: center; margin-top: 8px;">
                        <i data-lucide="key"></i> Надіслати інструкцію
                    </button>
                </form>

                <div style="text-align: center; border-top: 1px solid var(--border-color); padding-top: 16px;">
                    <a href="#/" style="font-size: 0.82rem; color: var(--text-muted);"><i data-lucide="arrow-left" style="width: 14px; height: 14px; vertical-align: middle;"></i> На головний сайт</a>
                </div>
            </div>
        </div>
    `;
}

export function initPortalAuthEvents(onSuccess) {
    const tabPwd = document.getElementById("btn-tab-pwd");
    const tabOtp = document.getElementById("btn-tab-otp");
    const tabReset = document.getElementById("btn-tab-reset");

    const formPwd = document.getElementById("portal-form-pwd");
    const formOtp = document.getElementById("portal-form-otp");
    const formReset = document.getElementById("portal-form-reset");

    if (window.lucide) window.lucide.createIcons();

    function setTab(activeTab) {
        tabPwd?.classList.toggle("active", activeTab === "pwd");
        tabOtp?.classList.toggle("active", activeTab === "otp");
        tabReset?.classList.toggle("active", activeTab === "reset");

        if (formPwd) formPwd.style.display = activeTab === "pwd" ? "flex" : "none";
        if (formOtp) formOtp.style.display = activeTab === "otp" ? "flex" : "none";
        if (formReset) formReset.style.display = activeTab === "reset" ? "flex" : "none";
    }

    tabPwd?.addEventListener("click", () => setTab("pwd"));
    tabOtp?.addEventListener("click", () => setTab("otp"));
    tabReset?.addEventListener("click", () => setTab("reset"));

    // Handle Password Login
    formPwd?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("auth-email-pwd")?.value.trim();
        const password = document.getElementById("auth-password")?.value;
        const errBox = document.getElementById("auth-error-pwd");
        const btn = document.getElementById("btn-submit-pwd");

        if (!email || !password) return;

        if (errBox) errBox.style.display = "none";
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="portal-spinner" style="width:16px;height:16px;border-width:2px;"></span> Авторизація...`;
        }

        try {
            const { data, error } = await PortalAuth.signInWithPassword(email, password);
            if (error) {
                if (errBox) {
                    errBox.textContent = error.message === "Invalid login credentials"
                        ? "Невірний email або пароль."
                        : error.message;
                    errBox.style.display = "block";
                }
            } else if (data?.session) {
                if (onSuccess) onSuccess();
            }
        } catch (err) {
            if (errBox) {
                errBox.textContent = err.message || "Помилка авторизації";
                errBox.style.display = "block";
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i data-lucide="log-in"></i> Увійти`;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    });

    // Handle OTP / Magic Link
    formOtp?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("auth-email-otp")?.value.trim();
        const msgBox = document.getElementById("auth-msg-otp");
        const btn = document.getElementById("btn-submit-otp");

        if (!email) return;

        if (msgBox) msgBox.style.display = "none";
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="portal-spinner" style="width:16px;height:16px;border-width:2px;"></span> Відправка...`;
        }

        try {
            const { error } = await PortalAuth.signInWithOtp(email);
            if (error) {
                if (msgBox) {
                    msgBox.style.color = "var(--color-danger)";
                    msgBox.textContent = error.message;
                    msgBox.style.display = "block";
                }
            } else {
                if (msgBox) {
                    msgBox.style.color = "var(--color-success)";
                    msgBox.textContent = "Посилання для входу надіслано на вашу пошту!";
                    msgBox.style.display = "block";
                }
            }
        } catch (err) {
            if (msgBox) {
                msgBox.style.color = "var(--color-danger)";
                msgBox.textContent = err.message;
                msgBox.style.display = "block";
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i data-lucide="send"></i> Надіслати посилання`;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    });

    // Handle Password Reset
    formReset?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("auth-email-reset")?.value.trim();
        const msgBox = document.getElementById("auth-msg-reset");
        const btn = document.getElementById("btn-submit-reset");

        if (!email) return;

        if (msgBox) msgBox.style.display = "none";
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="portal-spinner" style="width:16px;height:16px;border-width:2px;"></span> Відправка...`;
        }

        try {
            const { error } = await PortalAuth.resetPasswordForEmail(email);
            if (error) {
                if (msgBox) {
                    msgBox.style.color = "var(--color-danger)";
                    msgBox.textContent = error.message;
                    msgBox.style.display = "block";
                }
            } else {
                if (msgBox) {
                    msgBox.style.color = "var(--color-success)";
                    msgBox.textContent = "Інструкцію зі скидання пароля надіслано на email.";
                    msgBox.style.display = "block";
                }
            }
        } catch (err) {
            if (msgBox) {
                msgBox.style.color = "var(--color-danger)";
                msgBox.textContent = err.message;
                msgBox.style.display = "block";
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i data-lucide="key"></i> Надіслати інструкцію`;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    });
}
