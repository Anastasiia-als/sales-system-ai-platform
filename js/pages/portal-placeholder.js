/* js/pages/portal-placeholder.js - Technical Route Placeholder for Client Portal */

import { SupabaseConfig } from "../portal/config/supabase-config.js";
import { PortalAuth } from "../portal/auth/auth-service.js";

export const PortalPlaceholder = {
    render() {
        const isConfigured = SupabaseConfig.isConfigured();
        const isAuth = PortalAuth.isAuthenticated();

        return `
            <div class="container" style="padding: 80px 24px; min-height: 60vh; display: flex; align-items: center; justify-content: center;">
                <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 40px; max-width: 600px; width: 100%; text-align: center;">
                    <div style="width: 56px; height: 56px; background: rgba(59, 130, 246, 0.15); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                        <i data-lucide="shield-check" style="width: 28px; height: 28px; color: var(--color-primary);"></i>
                    </div>
                    <h2 style="margin-bottom: 12px;">Client & Project Delivery Platform</h2>
                    <p style="color: var(--text-secondary); margin-bottom: 24px; font-size: 0.95rem;">
                        Phase 0.1A Secure Data Foundation активовано. Модуль підключено до архітектури FIRSTWIN.
                    </p>

                    <div style="background: var(--bg-dark); border: 1px solid var(--border-dark); border-radius: var(--radius-md); padding: 16px; text-align: left; margin-bottom: 24px; font-size: 0.85rem;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span style="color: var(--text-muted);">Data Layer:</span>
                            <span style="color: var(--color-primary); font-weight: 600;">DataClient (Unified Access)</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span style="color: var(--text-muted);">Supabase Status:</span>
                            <span style="color: ${isConfigured ? 'var(--color-success)' : 'var(--color-warning)'}; font-weight: 600;">
                                ${isConfigured ? 'Configured' : 'Ready (Awaiting Credentials)'}
                            </span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--text-muted);">Session State:</span>
                            <span style="color: ${isAuth ? 'var(--color-success)' : 'var(--text-secondary)'}; font-weight: 600;">
                                ${isAuth ? 'Authenticated' : 'Unauthenticated (Expected in Phase 0.1A)'}
                            </span>
                        </div>
                    </div>

                    <div style="display: flex; gap: 12px; justify-content: center;">
                        <a href="#/" class="btn btn-outline" style="font-size: 0.85rem;">На головну</a>
                        <a href="#/admin" class="btn btn-primary" style="font-size: 0.85rem;">В Admin / CRM</a>
                    </div>
                </div>
            </div>
        `;
    },

    async init() {
        await PortalAuth.init();
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
};
